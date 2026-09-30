# TITAN-SR external validation with Jev

## Purpose

This repository replicates the temporal external validation set of TITAN-SR
([Pitre et al., J Clin Epidemiol 2026](https://doi.org/10.1016/j.jclinepi.2026.112514))
with the TypeSafe `jev-1.13.0` screening model, as used by the
[TiAb Review Plugin](https://github.com/youkiti/tiab-review-plugin).

This is a single replication, not a head-to-head re-analysis.
Jev is a closed commercial model. The TITAN-SR comparison uses only the
paper's Table 2 summary medians; the comparator models were not rerun here.

## Results summary

### Comparison with paper text and Table 2 summary values

| Condition | Median AUC | Median S@99R | Median S@95R |
|---|---:|---:|---:|
| TITAN-SR | 0.9760 | 0.8790 | 0.8970 |
| ASReview (with warm-up) | — | 0.7470 | 0.7520 |
| Jev secondary analysis | 0.9845 | 0.9150 | 0.9452 |
| Jev primary analysis | 0.9827 | 0.9059 | 0.9339 |

### Primary analysis: all records

Pooled (micro): N=142504, included=768.

| Threshold | Recall | Specificity | FN |
|---:|---:|---:|---:|
| 0.3 | 0.9349 | 0.8568 | 50 |
| 0.5 | 0.8255 | 0.9382 | 134 |

### Secondary analysis: records with abstracts

Pooled (micro): N=136456, included=639.

| Threshold | Recall | Specificity | FN |
|---:|---:|---:|---:|
| 0.3 | 0.9233 | 0.8758 | 49 |
| 0.5 | 0.8075 | 0.9477 | 123 |

The primary analysis uses all 142,504 records, including 768 positives.
The secondary analysis uses 136,456 records with abstracts, including
639 positives. It excludes 6,048 records without abstracts, including
129 positives.

The secondary analysis matches the 136,456-record external set mentioned
at line 492 of the journal pre-proof. The paper does not state that records
without abstracts were excluded, so equivalence is uncertain.

See [report.md](report.md) for per-review results and review-level medians
with interquartile ranges. Pooled results combine records across reviews;
review-level medians describe the distribution across reviews.

## Model and setup

The endpoint is `https://api.typesafe.ai/v1/systemone`.
Each record receives one request with one overall include question:

> Based on `screening_prompt`, should this record be included at the title/abstract screening stage?

The response supplies an inclusion probability, with no reasoning text.
Titles and abstracts are sent untruncated. A record without an abstract
is sent with the placeholder `(no abstract)`.

The full prompt template in [config.json](config.json) is:

```text
You are a screener for a systematic review.
Sensitivity is paramount in systematic reviews to avoid missing relevant studies.
If you are unsure or if the full text is required to make a definitive decision, you MUST include the study.

## Inclusion Criteria
{{CRITERIA}}

Include studies that meet the inclusion criteria.
Exclude studies that do not meet the criteria or are clearly irrelevant.
```

`{{CRITERIA}}` is replaced by each review's selection criteria.
The configured concurrency is 4, with up to 5 attempts and backoff.
The base delay is 2000 ms and the maximum delay is 60000 ms.

Recall is the proportion of included records retained for screening.
Specificity is the proportion of excluded records correctly set aside.
FN is the number of included records missed at the stated threshold.
AUC summarizes discrimination across thresholds.

S@rR is specificity at a threshold meeting the target recall. The threshold is the ceil(r*positives/100)-th positive score in descending order; all ties are screened. WSS@95 = fraction not screened - 0.05. Quantiles use linear interpolation, as in NumPy defaults.

Values are proportions (0 to 1). Undefined values are shown as an em dash and excluded from medians; valid review counts are reported.

## Threshold

The primary threshold, 0.3, is the default include threshold of the
TiAb Review Plugin. It has been unchanged since 2025-12-30 and was used
as the primary threshold in the plugin's earlier Jev benchmarks.
It was not tuned on this set or on Jev. The threshold 0.5 is reported
for reference.

## Data

The source is [Chan et al. 2025, Res Synth Methods](https://doi.org/10.1017/rsm.2025.1),
with data available through [Mendeley](https://doi.org/10.17632/7sgmg89zb6)
under CC BY 4.0. This replication uses the `manual_search` part:
22 Cochrane reviews.

Download the dataset zip by hand. The expected SHA-256 of the downloaded zip is:

```text
27dc9142917b9b528bfcc4bc57532181fb7d792883e19d02b1a001f0ce6a0eba
```

The eligibility-criteria text stored in [config.json](config.json) comes
from that CC BY dataset. The set matches the TITAN-SR external holdout
released with the paper: 22 reviews, 142,504 records, and 768 includes.

## Reproduction

Use Node 22. Run commands from the repository root and install the locked
dependencies first:

```sh
npm ci
```

On Windows PowerShell, use `npm.cmd` in place of `npm`.

### A. Recreate the report from committed scores

This path needs neither an API key nor the source data.

```sh
npm run build
npm run summarize
npm test
```

The report is generated from the compressed scores and configuration.
The tests check metrics, the request body, and every review's configuration hash.

### B. Rebuild and verify the input data

After building, use Python to convert the manually downloaded zip, then
prepare the per-review files. Replace `<zip>` and `<file.jsonl>` with your
chosen filenames; quote filenames containing spaces.

```sh
python scripts/extract_manual_search.py --zip <zip> --out <file.jsonl>
npm run prepare-data -- --input <file.jsonl>
```

The extractor prints the downloaded zip's SHA-256 for comparison with the
expected value above. `prepare-data` writes nothing unless all 22 per-review
files match the SHA-256 values in [config.json](config.json).
It also checks the criteria and expected record counts before writing.

### C. Re-run screening

Build and prepare the input data first. Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

Set `TYPE_SAFE_API_KEY` in `.env`, then run:

```sh
npm run screen
npm run export-scores
npm run summarize
```

Screening options are `--review CDxxxxxx`, `--concurrency N`, and `--fake`.
Pass options after the npm argument separator, for example:

```sh
npm run screen -- --review CD011218 --concurrency 4
npm run screen -- --fake
```

Results are appended to `results/` one successful record at a time.
Re-running the same command resumes only unfinished records.
After screening completes, `export-scores` creates the compressed scores
and `summarize` regenerates the report.

`--fake` needs no key and writes to `.tmp/fake/`. It still needs the prepared
input data. It exits with code 2 by design because the fake includes
permanent failures.

## Run record

The run was completed on 2026-09-30 for all 142,504 records.
Successful request logs recorded 131.8M input tokens (about 925 per record)
and 2,850,080 output tokens.

Using the billing rate observed on our TypeSafe account ($2.7 for 71.1M
tokens, about $0.038 per million tokens), the estimated cost was about $5.0. At the OpenRouter
reference rate of $0.042, it was about $5.5. These estimates exclude
charges for failed attempts; the reference rate does not describe the
request route used here.

The initial run exhausted retries for 4 records in CD013822 and 1 record
in CD014715. Re-running the same command completed those records.

Another 4 records in CD013042 initially succeeded but had negative
`latency_ms` values (-1,133 to -1,283 ms). Ledger validation skipped them,
so they were screened again. All had the timestamp 2026-09-29T22:58:20Z.
The PC clock appears to have moved backwards by about 1.5 seconds while
elapsed time was measured using differences in `Date.now()`.
The analysis used the final entry for each record, from the rerun.

Some abstract fields contained lengthy trial-registration descriptions or
protocol text. Titles and abstracts were sent without truncation.

## Provenance

The code was extracted from the
[TiAb Review Plugin](https://github.com/youkiti/tiab-review-plugin), commit
`a4f7d1fca8510847f91b5484e2cfb0230382017b`.
See also [Kataoka et al., arXiv:2604.08602](https://arxiv.org/abs/2604.08602).

The data-preparation script replaces a converter that is not public.
Its output was verified byte-for-byte against the data used for the
original run, using the SHA-256 of every per-review file.
[src/verify.selftest.ts](src/verify.selftest.ts) checks that the configuration
hash of every review equals the hash recorded during the original run.

## Funding

API costs were funded by AMED under Grant Number JP26rea522132.

## License

The code is licensed under MIT. The dataset and the criteria text remain
under their original licenses (CC BY 4.0).
