import fs from 'fs';
import path from 'path';
import { projectRoot } from './ledger';

const envFile = path.join(projectRoot, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

import { appendLedger, BenchError, readLedger, screeningPrompt } from './ledger';
import { fakeScreen, runRecords, Screen } from './runner';
import { benchConfig, configHash, fail, ledgerPath, loadConfig, loadData } from './common';

async function main(): Promise<number> {
    const config = loadConfig();
    const bench = benchConfig(config);
    let fake = false, concurrency = config.concurrency;
    const requested: string[] = [];
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--fake') fake = true;
        else if (args[i] === '--concurrency') concurrency = Number(args[++i]);
        else if (args[i] === '--review') requested.push(args[++i]);
        else throw new BenchError('Arguments: --fake / --review CDxxxx / --concurrency N.');
    }
    if (!Number.isInteger(concurrency) || concurrency < 1 || !Number.isInteger(config.retry.maxAttempts)
        || config.retry.maxAttempts < 1 || ![config.retry.baseDelayMs, config.retry.maxDelayMs].every(n => Number.isFinite(n) && n > 0)) {
        throw new BenchError('Invalid concurrency or retry settings.');
    }
    if (requested.some(id => !Object.prototype.hasOwnProperty.call(config.reviews, id))) throw new BenchError('Requested review is not in config.');
    if (!fake && !process.env.TYPE_SAFE_API_KEY?.trim()) throw new BenchError('Set TYPE_SAFE_API_KEY in the environment or root .env file.');
    const reviews = Object.keys(config.reviews).filter(id => !requested.length || requested.includes(id));
    let exitCode = 0;
    for (const review of reviews) {
        const records = loadData(config, review);
        const hash = configHash(bench, review);
        const file = ledgerPath(config, fake, review);
        const { rows, brokenLines } = readLedger(file, hash, review);
        if (brokenLines) console.warn(`Warning: skipped ${brokenLines} invalid ledger lines for ${review}.`);
        let screen: Screen = fakeScreen;
        if (!fake) {
            const { screenViaTypeSafe } = await import('./typesafe');
            const prompt = screeningPrompt(bench, review);
            screen = record => screenViaTypeSafe({ title: record.title, abstract: record.abstract,
                screeningPrompt: prompt, model: config.model, outputLanguage: config.outputLanguage });
        }
        console.log(`Starting review ${review}: ${records.length} records`);
        const code = await runRecords({ dataset: review, records, existing: rows, config: bench, hash,
            concurrency, fake, screen, append: row => appendLedger(file, row) });
        console.log(`Finished review ${review}: exit code ${code}`);
        if (code === 1 || code === 3) return code;
        if (code === 2) exitCode = 2;
    }
    return exitCode;
}
if (require.main === module) main().then(code => { process.exitCode = code; }).catch(fail);
