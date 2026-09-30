import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import { BenchError, calculateMetrics, rocAuc } from './ledger';
import type { Score } from './export-scores';
import { atomicWrite, Config, directory, fail, fakeDirectory, loadConfig, scoresPath } from './common';
import { medianIqr, operatingPointAtRecall } from './metrics';

const number = (value: number | null) => value === null ? '—' : value.toFixed(4);
const distribution = (values: Array<number | null>) => {
    const valid = values.filter((v): v is number => v !== null);
    const { median, q1, q3 } = medianIqr(valid);
    return `${number(median)} [${number(q1)}, ${number(q3)}] (${valid.length} reviews)`;
};
function analyze(scores: Score[], config: Config) {
    return Object.keys(config.reviews).map(review => {
        const items = scores.filter(r => r.review === review).map(r => ({ label_included: r.label, include_probability: r.p }));
        return { review, items, n: items.length, positives: items.filter(r => r.label_included === 1).length,
            primary: calculateMetrics(items, config.thresholds.primary), reference: calculateMetrics(items, config.thresholds.reference),
            auc: rocAuc(items), r99: operatingPointAtRecall(items, 0.99), r95: operatingPointAtRecall(items, 0.95) };
    });
}
type Analysis = ReturnType<typeof analyze>;
function section(title: string, analysis: Analysis, config: Config): string[] {
    const { primary, reference } = config.thresholds;
    const rows = [
        `## ${title}`, '',
        `| Review | N | Included | Recall@${primary} | Specificity@${primary} | FN@${primary} | Recall@${reference} | Specificity@${reference} | FN@${reference} | AUC | S@99R | S@95R | WSS@95 |`,
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ];
    for (const r of analysis) rows.push(`| ${r.review} | ${r.n} | ${r.positives} | ${[
        r.positives ? number(r.primary.recall) : '—', r.n > r.positives ? number(r.primary.specificity) : '—', r.primary.fn,
        r.positives ? number(r.reference.recall) : '—', r.n > r.positives ? number(r.reference.specificity) : '—', r.reference.fn,
        number(r.auc), number(r.r99?.specificity ?? null), number(r.r95?.specificity ?? null), number(r.r95?.wss_at_recall ?? null),
    ].join(' | ')} |`);
    rows.push('', '### Review-level medians [IQR]', '', '| Metric | Median [Q1, Q3]; valid reviews |', '|---|---|');
    const metrics: Array<[string, Array<number | null>]> = [
        ['AUC', analysis.map(r => r.auc)], ['S@99R', analysis.map(r => r.r99?.specificity ?? null)],
        ['S@95R', analysis.map(r => r.r95?.specificity ?? null)],
        [`Recall@${primary}`, analysis.map(r => r.positives ? r.primary.recall : null)],
        [`Specificity@${primary}`, analysis.map(r => r.n > r.positives ? r.primary.specificity : null)],
        [`Recall@${reference}`, analysis.map(r => r.positives ? r.reference.recall : null)],
        [`Specificity@${reference}`, analysis.map(r => r.n > r.positives ? r.reference.specificity : null)],
    ];
    metrics.forEach(([name, values]) => rows.push(`| ${name} | ${distribution(values)} |`));
    const all = analysis.flatMap(r => r.items);
    rows.push('', `Pooled (micro): N=${all.length}, included=${all.filter(r => r.label_included === 1).length}.`, '',
        '| Threshold | Recall | Specificity | FN |', '|---:|---:|---:|---:|');
    for (const threshold of [primary, reference]) {
        const m = calculateMetrics(all, threshold);
        rows.push(`| ${threshold} | ${number(m.tp + m.fn ? m.recall : null)} | ${number(m.tn + m.fp ? m.specificity : null)} | ${m.fn} |`);
    }
    rows.push('', `Recall ≥99% at threshold ${primary}: ${analysis.filter(r => r.positives && r.primary.recall >= 0.99).length} / ${analysis.length} reviews.`, '');
    return rows;
}
function loadScores(file: string, config: Config, partial: boolean): Score[] {
    const scores: Score[] = gunzipSync(fs.readFileSync(file)).toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    const seen = new Set<string>();
    for (const row of scores) {
        const expected = row && config.reviews[row.review];
        const suffix = typeof row?.id === 'string' ? row.id.slice(row.review.length + 1) : '';
        const index = Number(suffix);
        if (!expected || !Number.isInteger(index) || index < 0 || index >= expected.n || row.id !== `${row.review}:${index}`
            || seen.has(row.id) || ![0, 1].includes(row.label) || !Number.isFinite(row.p) || row.p < 0 || row.p > 1
            || typeof row.has_abstract !== 'boolean') throw new BenchError('Invalid score format, ID, probability or duplicate.');
        seen.add(row.id);
    }
    for (const [review, expected] of Object.entries(config.reviews)) {
        const items = scores.filter(r => r.review === review);
        const positives = items.filter(r => r.label === 1).length;
        const empty = items.filter(r => !r.has_abstract).length;
        if ((!partial && (items.length !== expected.n || positives !== expected.positives || empty !== expected.emptyAbstracts))
            || positives > expected.positives || empty > expected.emptyAbstracts) throw new BenchError(`Score counts do not match config: ${review}`);
    }
    if (!partial && scores.filter(r => !r.has_abstract && r.label === 1).length !== 129) throw new BenchError('Included records without abstracts do not match the expected count.');
    return scores;
}
function main(): void {
    const args = process.argv.slice(2);
    if (args.some(a => !['--fake', '--partial'].includes(a))) throw new BenchError('Arguments: --fake / --partial.');
    const fake = args.includes('--fake'), config = loadConfig();
    const completeFile = scoresPath(config, fake), partialFile = scoresPath(config, fake, true);
    const file = args.includes('--partial') ? partialFile : fs.existsSync(completeFile) ? completeFile : partialFile;
    if (args.includes('--partial') && !fs.existsSync(file)) throw new BenchError('Partial scores missing. Run export-scores with --allow-partial first.');
    if (!fs.existsSync(file)) throw new BenchError('Scores missing. Run export-scores first.');
    const partial = file === partialFile;
    const scores = loadScores(file, config, partial);
    const mainAnalysis = analyze(scores, config), abstractAnalysis = analyze(scores.filter(r => r.has_abstract), config);
    const report = path.join(fake ? fakeDirectory : directory, 'report.md');
    const link = (target: string) => path.relative(path.dirname(report), target).replace(/\\/g, '/');
    const source = (name: string) => `[${name}](${link(path.join(directory, name))})`;
    const lines = [
        `# TITAN-SR external validation: TypeSafe ${config.model}${fake ? ' (fake responses; not for performance evaluation)' : ''}${partial ? ' (partial)' : ''}`, '',
        '## Shared settings', '',
        `Model: ${config.model}; question design: ${config.questionDesign} (one overall Noul question); output language: ${config.outputLanguage}.`,
        `The prompt uses defaultScreeningPrompt from [config.json](${link(path.join(directory, 'config.json'))}), replacing {{CRITERIA}} with the review criteria at run time.`,
        'Data sources: [Chan et al. 2025](https://doi.org/10.1017/rsm.2025.1), [Mendeley](https://doi.org/10.17632/7sgmg89zb6).',
        'Reference paper: [Pitre et al. 2026, TITAN-SR](https://doi.org/10.1016/j.jclinepi.2026.112514).',
        `Source: ${['src/prepare.ts', 'src/run.ts', 'src/export-scores.ts', 'src/metrics.ts', 'src/summarize.ts', 'config.json', 'README.md'].map(source).join(' / ')}.`,
        `Reproduction input: [compressed scores](${link(file)}) and config only. Ledgers and record text are not needed.`,
        `Completed ${scores.length} / 142504 records. ${partial ? 'Partial results exclude unfinished records from denominators and may be biased by missingness; they cannot be compared with complete results.' : 'All 22 reviews complete.'}`,
        '', 'The primary analysis uses all 142,504 records, including 768 positives. The secondary analysis uses 136,456 records with abstracts, including 639 positives (excluding 6,048 records without abstracts, including 129 positives).',
        'The secondary analysis matches the 136,456-record external set mentioned at line 492 of the journal pre-proof, suggesting the same conditions as TITAN-SR. However, the paper does not state that records without abstracts were excluded, so equivalence is uncertain.',
        'S@rR is specificity at a threshold meeting the target recall. The threshold is the ceil(r*positives/100)-th positive score in descending order; all ties are screened. WSS@95 = fraction not screened - 0.05. Quantiles use linear interpolation, as in NumPy defaults.',
        'Values are proportions (0 to 1). Undefined values are shown as an em dash and excluded from medians; valid review counts are reported.', '',
        ...section('Primary analysis (including records without abstracts)', mainAnalysis, config),
        ...section('Secondary analysis (records with abstracts)', abstractAnalysis, config),
    ];
    lines.push('', '## Comparison with paper text and Table 2 summary values', '', '| Condition | Median AUC | Median S@99R | Median S@95R |', '|---|---:|---:|---:|');
    for (const [name, value] of Object.entries(config.paperSummary)) lines.push(`| ${name}${name === 'ASReview' ? ' (with warm-up)' : ''} | ${number(value.auc)} | ${number(value.s99)} | ${number(value.s95)} |`);
    for (const [name, analysis] of [['Jev secondary analysis', abstractAnalysis], ['Jev primary analysis', mainAnalysis]] as const) {
        const median = (values: Array<number | null>) => number(medianIqr(values.filter((v): v is number => v !== null)).median);
        lines.push(`| ${name} | ${median(analysis.map(r => r.auc))} | ${median(analysis.map(r => r.r99?.specificity ?? null))} | ${median(analysis.map(r => r.r95?.specificity ?? null))} |`);
    }
    lines.push('', 'No discussion is auto-generated.', '');
    atomicWrite(report, lines.join('\n'));
    console.log(`Report written: ${report}`);
}
if (require.main === module) { try { main(); } catch (error) { fail(error); } }
