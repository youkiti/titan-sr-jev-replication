import { createHash } from 'crypto';
import { performance } from 'node:perf_hooks';
import { BenchConfig, DatasetRecord, LedgerRow } from './ledger';

interface ScreeningResult {
    output: { include_probability: number };
    usageMetadata: { promptTokenCount: number; candidatesTokenCount: number };
    responseMetadata: { modelVersion?: string };
}

export type Screen = (record: DatasetRecord, attempt: number) => Promise<ScreeningResult>;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function fakeHash(id: string): number {
    return createHash('sha256').update(id).digest().readUInt32BE(0);
}

export const fakeScreen: Screen = async (record, attempt) => {
    const hash = fakeHash(record.id);
    if (hash % 97 === 0 || (hash % 10 === 0 && attempt === 1)) {
        throw new Error('Retryable fake error');
    }
    return {
        output: { include_probability: hash / 0xffffffff },
        usageMetadata: { promptTokenCount: 100 + hash % 50, candidatesTokenCount: 5 },
        responseMetadata: { modelVersion: 'fake-jev-1.13.0' },
    };
};

function fatalReason(error: unknown): string {
    const message = error instanceof Error ? error.message : '';
    if (/API error 401\b/.test(message)) return 'Authentication error (401)';
    if (/API error 403\b/.test(message)) return 'Access denied (403)';
    if (/API error 400\b/.test(message)) return 'Invalid model (400)';
    return 'Non-retryable error';
}

export interface RunOptions {
    dataset: string;
    records: DatasetRecord[];
    existing: Map<string, LedgerRow>;
    config: BenchConfig;
    hash: string;
    concurrency: number;
    fake: boolean;
    screen: Screen;
    append: (row: LedgerRow) => void;
    log?: (message: string) => void;
}

export async function runRecords(options: RunOptions): Promise<number> {
    const { records, existing, config, hash, concurrency, fake, screen, append, dataset } = options;
    const log = options.log ?? console.log;
    const pending = records.filter(r => !existing.has(r.id));
    let completed = records.length - pending.length;
    let failed = 0, cursor = 0, finished = 0;
    let cooldownUntil = 0;
    let stopReason: string | null = null;
    let stopCode = 3;
    log(`Skipping ${completed} existing records; ${pending.length} pending`);
    const progress = () => log(`Completed ${completed} / ${records.length} (failed ${failed})`);

    async function waitForCooldown(): Promise<void> {
        while (!stopReason && Date.now() < cooldownUntil) {
            await sleep(Math.min(100, cooldownUntil - Date.now()));
        }
    }

    async function processRecord(record: DatasetRecord): Promise<void> {
        for (let attempt = 1; attempt <= config.retry.maxAttempts; attempt++) {
            while (!stopReason && Date.now() < cooldownUntil) await waitForCooldown();
            if (stopReason) return;
            const start = performance.now();
            let result: ScreeningResult;
            try {
                result = await screen(record, attempt);
                const probability = result.output.include_probability;
                if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
                    throw new Error('Invalid response probability.');
                }
            } catch (error) {
                if (typeof error === 'object' && error !== null && 'retryable' in error && error.retryable === false) {
                    stopReason ??= fatalReason(error);
                    return;
                }
                const delay = fake ? 1 : Math.min(config.retry.maxDelayMs,
                    config.retry.baseDelayMs * 2 ** (attempt - 1) * (1 + Math.random()));
                if (error instanceof Error && /API error (429|529)\b/.test(error.message)) {
                    cooldownUntil = Math.max(cooldownUntil, Date.now() + delay);
                }
                if (attempt === config.retry.maxAttempts) { failed++; return; }
                const retryAt = Date.now() + delay;
                while (!stopReason && Date.now() < retryAt) await sleep(Math.min(100, retryAt - Date.now()));
                continue;
            }
            const row: LedgerRow = {
                key: record.id, dataset, label_included: record.label_included,
                include_probability: result.output.include_probability,
                model_requested: config.model, model_version: result.responseMetadata.modelVersion ?? null,
                input_tokens: result.usageMetadata.promptTokenCount,
                output_tokens: result.usageMetadata.candidatesTokenCount,
                latency_ms: Math.round(performance.now() - start), attempts: attempt,
                config_hash: hash, ledger_version: config.ledgerVersion, completed_at: new Date().toISOString(),
            };
            try { append(row); }
            catch { stopReason = 'Could not save ledger'; stopCode = 1; return; }
            completed++;
            return;
        }
    }

    async function worker(): Promise<void> {
        while (!stopReason) {
            await waitForCooldown();
            if (stopReason || cursor >= pending.length) return;
            const record = pending[cursor++];
            await processRecord(record);
            finished++;
            if (finished % 50 === 0) progress();
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, () => worker()));
    progress();
    if (stopReason) { log(`Run stopped: ${stopReason}`); return stopCode; }
    return failed ? 2 : 0;
}

