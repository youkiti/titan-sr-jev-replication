import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface BenchConfig {
    model: string;
    questionDesign: string;
    ledgerVersion: string;
    datasets: Record<string, {
        path: string; labelField: string;
        expected: { n: number; positives: number; emptyAbstracts: number };
        criteria: string;
    }>;
    defaultScreeningPrompt: string;
    outputLanguage: string;
    concurrency: number;
    thresholds: { primary: number; reference: number };
    retry: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number };

}

export interface DatasetRecord {
    id: string;
    title: string;
    abstract: string;
    label_included: number;
}

export interface ScoredRecord {
    label_included: number;
    include_probability: number;
}

export interface LedgerRow extends ScoredRecord {
    key: string;
    dataset: string;
    model_requested: string;
    model_version: string | null;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    attempts: number;
    config_hash: string;
    ledger_version: string;
    completed_at: string;
}

export class BenchError extends Error {}

export const projectRoot = path.resolve(__dirname, '..');
export function screeningPrompt(config: BenchConfig, dataset: string): string {
    const criteria = config.datasets[dataset].criteria;
    return config.defaultScreeningPrompt.includes('{{CRITERIA}}')
        ? config.defaultScreeningPrompt.replace('{{CRITERIA}}', criteria)
        : criteria ? `## Inclusion Criteria\n${criteria}\n\n${config.defaultScreeningPrompt}` : config.defaultScreeningPrompt;
}

export function configHash(config: BenchConfig, dataset: string): string {
    return createHash('sha256').update(JSON.stringify({
        model: config.model, questionDesign: config.questionDesign, screeningPrompt: screeningPrompt(config, dataset),
        outputLanguage: config.outputLanguage,
    })).digest('hex');
}

export function readLedger(file: string, expectedHash: string, dataset: string): { rows: Map<string, LedgerRow>; brokenLines: number } {
    const rows = new Map<string, LedgerRow>();
    let brokenLines = 0;
    if (!fs.existsSync(file)) return { rows, brokenLines };
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let row: LedgerRow;
        try { row = JSON.parse(line); } catch { brokenLines++; continue; }
        if (row && row.config_hash !== undefined && row.config_hash !== expectedHash) {
            throw new BenchError('Ledger config_hash differs from current settings. Restore settings or change the version tag.');
        }
        if (!row || typeof row.key !== 'string' || row.config_hash !== expectedHash
            || row.dataset !== dataset || typeof row.model_requested !== 'string'
            || (row.model_version !== null && typeof row.model_version !== 'string')
            || typeof row.ledger_version !== 'string' || ![0, 1].includes(row.label_included)
            || !Number.isFinite(row.include_probability) || row.include_probability < 0 || row.include_probability > 1
            || ![row.input_tokens, row.output_tokens, row.latency_ms].every(n => Number.isFinite(n) && n >= 0)
            || !Number.isInteger(row.attempts) || row.attempts < 1 || !Number.isFinite(Date.parse(row.completed_at))) {
            brokenLines++; continue;
        }
        rows.set(row.key, row);
    }
    return { rows, brokenLines };
}

export function appendLedger(file: string, row: LedgerRow): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    let prefix = '';
    if (fs.existsSync(file)) {
        const fd = fs.openSync(file, 'r');
        try {
            const size = fs.fstatSync(fd).size;
            if (size) {
                const byte = Buffer.alloc(1);
                fs.readSync(fd, byte, 0, 1, size - 1);
                if (byte[0] !== 10) prefix = '\n';
            }
        } finally { fs.closeSync(fd); }
    }
    fs.appendFileSync(file, prefix + JSON.stringify(row) + '\n', 'utf8');
}

export function calculateMetrics(items: ScoredRecord[], threshold: number) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (const item of items) {
        const predicted = item.include_probability >= threshold;
        if (item.label_included === 1) { if (predicted) tp++; else fn++; }
        else { if (predicted) fp++; else tn++; }
    }
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const specificity = tn + fp > 0 ? tn / (tn + fp) : 0;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const fBeta7 = recall + precision > 0 ? 50 * precision * recall / (49 * precision + recall) : 0;
    return { threshold, recall, specificity, precision, fBeta7, tp, fp, tn, fn };
}

export function rocAuc(items: ScoredRecord[]): number | null {
    const sorted = [...items].sort((a, b) => a.include_probability - b.include_probability);
    const positives = sorted.filter(r => r.label_included === 1).length;
    const negatives = sorted.length - positives;
    if (!positives || !negatives) return null;
    let rankSum = 0;
    for (let i = 0; i < sorted.length;) {
        let end = i + 1;
        while (end < sorted.length && sorted[end].include_probability === sorted[i].include_probability) end++;
        const averageRank = (i + 1 + end) / 2;
        for (let j = i; j < end; j++) if (sorted[j].label_included === 1) rankSum += averageRank;
        i = end;
    }
    return (rankSum - positives * (positives + 1) / 2) / (positives * negatives);
}
