import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import { BenchError, projectRoot } from './ledger';
import { fail } from './common';

function main(): void {
    const source = path.join(projectRoot, 'ledgers');
    const destination = path.join(projectRoot, 'results');
    const files = fs.readdirSync(source, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.jsonl.gz'))
        .map(entry => entry.name).sort();
    let writtenFiles = 0, writtenLines = 0, existingFiles = 0, existingLines = 0;
    fs.mkdirSync(destination, { recursive: true });
    for (const name of files) {
        const contents = gunzipSync(fs.readFileSync(path.join(source, name)));
        const output = path.join(destination, name.slice(0, -3));
        const lines = contents.length === 0 ? 0
            : contents.toString('utf8').split('\n').length - (contents[contents.length - 1] === 10 ? 1 : 0);
        try {
            fs.writeFileSync(output, contents, { flag: 'wx' });
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
            if (!fs.readFileSync(output).equals(contents)) {
                throw new BenchError(`Refusing to overwrite differing file: results/${path.basename(output)}`);
            }
            existingFiles++;
            existingLines += lines;
            continue;
        }
        writtenFiles++;
        writtenLines += lines;
    }
    console.log(`Written: ${writtenFiles} files, ${writtenLines} lines. Already identical (unchanged): ${existingFiles} files, ${existingLines} lines.`);
}

if (require.main === module) { try { main(); } catch (error) { fail(error); } }
