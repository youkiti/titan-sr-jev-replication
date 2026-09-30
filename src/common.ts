import fs from 'fs';
import path from 'path';
import { BenchConfig, BenchError, DatasetRecord, configHash, projectRoot } from './ledger';

export interface Config {
    model: string; questionDesign: string; ledgerVersion: string; outputLanguage: string;
    concurrency: number; retry: BenchConfig['retry']; thresholds: BenchConfig['thresholds'];
    defaultScreeningPrompt: string;
    dataSha256: Record<string, string>;
    reviews: Record<string, { n: number; positives: number; emptyAbstracts: number; criteria: string }>;
    paperSummary: Record<string, { auc: number | null; s99: number; s95: number }>;
}
export const directory = projectRoot;
export const fakeDirectory = path.join(projectRoot, '.tmp/fake');
export const loadConfig = (): Config => JSON.parse(fs.readFileSync(path.join(directory, 'config.json'), 'utf8'));
export function benchConfig(config: Config): BenchConfig {
    if (!config.defaultScreeningPrompt.includes('{{CRITERIA}}')) throw new BenchError('The prompt template has no criteria placeholder.');
    return { ...config,
        datasets: Object.fromEntries(Object.entries(config.reviews).map(([id, review]) => [id, {
            path: '', labelField: 'label_included', expected: review, criteria: review.criteria,
        }])) };
}
export function ledgerPath(config: Config, fake: boolean, review: string): string {
    return path.join(fake ? fakeDirectory : path.join(directory, 'results'), `${review}_${config.model}_overall_${config.ledgerVersion}.jsonl`);
}
export function scoresPath(config: Config, fake: boolean, partial = false): string {
    return path.join(fake ? fakeDirectory : path.join(directory, 'scores'), `${config.model}_${config.ledgerVersion}${partial ? '.partial' : ''}.jsonl.gz`);
}
export function validateData(config: Config, review: string, data: { criteria: string; records: DatasetRecord[] }): void {
    const expected = config.reviews[review];
    const rows = data.records;
    if (!expected || data.criteria !== expected.criteria || !Array.isArray(rows)
        || rows.length !== expected.n || rows.some((r, i) => !r || r.id !== `${review}:${i}`
            || typeof r.title !== 'string' || typeof r.abstract !== 'string' || ![0, 1].includes(r.label_included))
        || rows.filter(r => r.label_included === 1).length !== expected.positives
        || rows.filter(r => !r.abstract).length !== expected.emptyAbstracts) {
        throw new BenchError(`Data counts, includes, empty abstracts, criteria or format do not match config: ${review}`);
    }
}
export function loadData(config: Config, review: string): DatasetRecord[] {
    const file = path.join(directory, 'data', `${review}.json`);
    if (!fs.existsSync(file)) throw new BenchError(`Data missing. Run prepare-data with --input <JSONL path>: ${review}`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    validateData(config, review, data);
    return data.records;
}
export function atomicWrite(file: string, contents: string | Buffer): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try { fs.writeFileSync(file + '.tmp', contents); fs.renameSync(file + '.tmp', file); }
    finally { if (fs.existsSync(file + '.tmp')) fs.unlinkSync(file + '.tmp'); }
}
export function fail(error: unknown): void {
    console.error(error instanceof BenchError ? error.message : 'Processing failed. Check configuration, input and output paths.');
    process.exitCode = 1;
}
export { configHash };
