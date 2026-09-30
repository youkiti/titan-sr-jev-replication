import { gzipSync } from 'zlib';
import { BenchError, readLedger } from './ledger';
import { atomicWrite, benchConfig, configHash, fail, ledgerPath, loadConfig, loadData, scoresPath } from './common';

export interface Score { id: string; review: string; label: number; p: number; has_abstract: boolean }
function main(): void {
    const args = process.argv.slice(2);
    if (args.some(a => !['--fake', '--allow-partial'].includes(a))) throw new BenchError('Arguments: --fake / --allow-partial.');
    const fake = args.includes('--fake'), allowPartial = args.includes('--allow-partial');
    const config = loadConfig(), bench = benchConfig(config);
    const scores: Score[] = [];
    let missing = 0;
    for (const review of Object.keys(config.reviews)) {
        const data = loadData(config, review);
        const { rows, brokenLines } = readLedger(ledgerPath(config, fake, review), configHash(bench, review), review);
        if (brokenLines) console.warn(`Warning: excluded ${brokenLines} invalid ledger lines for ${review}.`);
        const ids = new Set(data.map(r => r.id));
        if ([...rows.keys()].some(id => !ids.has(id))) throw new BenchError(`Unknown ledger ID: ${review}`);
        let incomplete = 0;
        for (const record of data) {
            const row = rows.get(record.id);
            if (!row) { incomplete++; continue; }
            if (row.label_included !== record.label_included || row.model_requested !== config.model || row.ledger_version !== config.ledgerVersion) {
                throw new BenchError(`Ledger label, model or version mismatch: ${review}`);
            }
            scores.push({ id: record.id, review, label: record.label_included, p: row.include_probability, has_abstract: !!record.abstract });
        }
        missing += incomplete;
        console.log(`${review}: ${incomplete} incomplete records`);
    }
    if (missing && !allowPartial) throw new BenchError(`No output: ${missing} incomplete records. Use --allow-partial for provisional output.`);
    const file = scoresPath(config, fake, allowPartial);
    atomicWrite(file, gzipSync(scores.map(row => JSON.stringify(row)).join('\n') + (scores.length ? '\n' : '')));
    console.log(`Scores written: ${file} (${scores.length} complete, ${missing} incomplete)`);
}
if (require.main === module) { try { main(); } catch (error) { fail(error); } }
