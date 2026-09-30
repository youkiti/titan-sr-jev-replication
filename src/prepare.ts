import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { createHash } from 'crypto';
import { BenchError, DatasetRecord } from './ledger';
import { atomicWrite, directory, fail, loadConfig, validateData } from './common';

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--input' || !args[1]) throw new BenchError('Specify --input <JSONL path>.');
    const config = loadConfig();
    const reviews = new Map<string, { criteria: string; records: DatasetRecord[] }>();
    const input = fs.createReadStream(args[1]);
    const lines = readline.createInterface({ input, crlfDelay: Infinity });
    let previous: string | undefined;
    for await (const line of lines) {
        const row = JSON.parse(line);
        const id = row.cochrane_id;
        if (!Object.prototype.hasOwnProperty.call(config.reviews, id)
            || typeof row.selection_criteria !== 'string' || typeof row.title !== 'string'
            || (row.abstract != null && typeof row.abstract !== 'string')
            || !['included', 'excluded'].includes(row.label)) throw new BenchError('Invalid input format or review ID.');
        if (previous !== id && reviews.has(id)) throw new BenchError('Rows for each review must be contiguous.');
        previous = id;
        if (!reviews.has(id)) reviews.set(id, { criteria: row.selection_criteria, records: [] });
        const data = reviews.get(id)!;
        if (data.criteria !== row.selection_criteria) throw new BenchError(`Inconsistent criteria within review: ${id}`);
        data.records.push({ id: `${id}:${data.records.length}`, title: row.title,
            abstract: row.abstract ?? '', label_included: row.label === 'included' ? 1 : 0 });
    }
    for (const id of Object.keys(config.reviews)) {
        const data = reviews.get(id);
        if (!data) throw new BenchError(`Missing review: ${id}`);
        validateData(config, id, data);
        const digest = createHash('sha256').update(JSON.stringify(data) + '\n').digest('hex');
        if (digest !== config.dataSha256[id]) throw new BenchError(`Data SHA-256 mismatch; no files written: ${id}`);
    }
    for (const [id, data] of reviews) atomicWrite(path.join(directory, 'data', `${id}.json`), JSON.stringify(data) + '\n');
    console.log(`Verified and wrote ${reviews.size} reviews, ${[...reviews.values()].reduce((n, d) => n + d.records.length, 0)} records.`);
}
if (require.main === module) main().catch(fail);
