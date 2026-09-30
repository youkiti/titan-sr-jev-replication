# TITAN-SR external validation: TypeSafe jev-1.13.0

## Shared settings

Model: jev-1.13.0; question design: overall-noul (one overall Noul question); output language: en.
The prompt uses defaultScreeningPrompt from [config.json](config.json), replacing {{CRITERIA}} with the review criteria at run time.
Data sources: [Chan et al. 2025](https://doi.org/10.1017/rsm.2025.1), [Mendeley](https://doi.org/10.17632/7sgmg89zb6).
Reference paper: [Pitre et al. 2026, TITAN-SR](https://doi.org/10.1016/j.jclinepi.2026.112514).
Source: [src/prepare.ts](src/prepare.ts) / [src/run.ts](src/run.ts) / [src/export-scores.ts](src/export-scores.ts) / [src/metrics.ts](src/metrics.ts) / [src/summarize.ts](src/summarize.ts) / [config.json](config.json) / [README.md](README.md).
Reproduction input: [compressed scores](scores/jev-1.13.0_v1.jsonl.gz) and config only. Ledgers and record text are not needed.
Completed 142504 / 142504 records. All 22 reviews complete.

The primary analysis uses all 142,504 records, including 768 positives. The secondary analysis uses 136,456 records with abstracts, including 639 positives (excluding 6,048 records without abstracts, including 129 positives).
The secondary analysis matches the 136,456-record external set mentioned at line 492 of the journal pre-proof, suggesting the same conditions as TITAN-SR. However, the paper does not state that records without abstracts were excluded, so equivalence is uncertain.
S@rR is specificity at a threshold meeting the target recall. The threshold is the ceil(r*positives/100)-th positive score in descending order; all ties are screened. WSS@95 = fraction not screened - 0.05. Quantiles use linear interpolation, as in NumPy defaults.
Values are proportions (0 to 1). Undefined values are shown as an em dash and excluded from medians; valid review counts are reported.

## Primary analysis (including records without abstracts)

| Review | N | Included | Recall@0.3 | Specificity@0.3 | FN@0.3 | Recall@0.5 | Specificity@0.5 | FN@0.5 | AUC | S@99R | S@95R | WSS@95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CD011218 | 690 | 14 | 1.0000 | 0.8743 | 0 | 0.7857 | 0.9453 | 3 | 0.9680 | 0.8876 | 0.8876 | 0.8196 |
| CD012268 | 4586 | 18 | 0.8333 | 0.9398 | 3 | 0.7778 | 0.9746 | 4 | 0.9528 | 0.6504 | 0.6504 | 0.5978 |
| CD013042 | 1005 | 27 | 1.0000 | 0.6472 | 0 | 0.8889 | 0.8405 | 3 | 0.9500 | 0.7331 | 0.8037 | 0.7331 |
| CD013059 | 5441 | 17 | 1.0000 | 0.9261 | 0 | 0.9412 | 0.9655 | 1 | 0.9903 | 0.9539 | 0.9539 | 0.9009 |
| CD013071 | 9962 | 52 | 0.6923 | 0.8556 | 16 | 0.3846 | 0.9692 | 32 | 0.9014 | 0.7010 | 0.7010 | 0.6473 |
| CD013197 | 2464 | 43 | 1.0000 | 0.8864 | 0 | 1.0000 | 0.9137 | 0 | 0.9931 | 0.9302 | 0.9513 | 0.8855 |
| CD013199 | 2238 | 16 | 1.0000 | 0.7084 | 0 | 1.0000 | 0.8798 | 0 | 0.9891 | 0.9572 | 0.9572 | 0.9004 |
| CD013295 | 3137 | 115 | 1.0000 | 0.5685 | 0 | 1.0000 | 0.6701 | 0 | 0.9178 | 0.7296 | 0.7687 | 0.6915 |
| CD013358 | 3542 | 99 | 0.7778 | 0.7842 | 22 | 0.4646 | 0.9039 | 53 | 0.8684 | 0.5272 | 0.6433 | 0.5765 |
| CD013377 | 5955 | 10 | 1.0000 | 0.8688 | 0 | 1.0000 | 0.9325 | 0 | 0.9927 | 0.9770 | 0.9770 | 0.9253 |
| CD013421 | 2400 | 23 | 0.9565 | 0.9748 | 1 | 0.9130 | 0.9882 | 2 | 0.9972 | 0.9727 | 0.9849 | 0.9258 |
| CD013590 | 1852 | 28 | 0.8214 | 0.9112 | 5 | 0.5714 | 0.9704 | 12 | 0.9579 | 0.7670 | 0.8366 | 0.7745 |
| CD013591 | 10958 | 20 | 1.0000 | 0.7159 | 0 | 0.9500 | 0.8704 | 1 | 0.9724 | 0.8310 | 0.9039 | 0.8524 |
| CD013822 | 10314 | 18 | 1.0000 | 0.9430 | 0 | 0.9444 | 0.9809 | 1 | 0.9965 | 0.9703 | 0.9703 | 0.9186 |
| CD013880 | 11642 | 43 | 0.9535 | 0.9190 | 2 | 0.6744 | 0.9690 | 14 | 0.9718 | 0.8682 | 0.9229 | 0.8697 |
| CD014715 | 49162 | 133 | 0.9925 | 0.8582 | 1 | 0.9474 | 0.9460 | 7 | 0.9860 | 0.8642 | 0.9405 | 0.8881 |
| CD014736 | 6128 | 8 | 1.0000 | 0.9714 | 0 | 1.0000 | 0.9892 | 0 | 0.9991 | 0.9967 | 0.9967 | 0.9454 |
| CD015038 | 2196 | 14 | 1.0000 | 0.7915 | 0 | 1.0000 | 0.8850 | 0 | 0.9913 | 0.9707 | 0.9707 | 0.9145 |
| CD015042 | 3057 | 9 | 1.0000 | 0.9177 | 0 | 0.8889 | 0.9600 | 1 | 0.9920 | 0.9524 | 0.9524 | 0.8996 |
| CD015067 | 2068 | 12 | 1.0000 | 0.5559 | 0 | 1.0000 | 0.8059 | 0 | 0.9486 | 0.8283 | 0.8283 | 0.7735 |
| CD015306 | 1671 | 6 | 1.0000 | 0.9237 | 0 | 1.0000 | 0.9658 | 0 | 0.9928 | 0.9658 | 0.9658 | 0.9123 |
| CD015432 | 2036 | 43 | 1.0000 | 0.8570 | 0 | 1.0000 | 0.9242 | 0 | 0.9793 | 0.9242 | 0.9272 | 0.8586 |

### Review-level medians [IQR]

| Metric | Median [Q1, Q3]; valid reviews |
|---|---|
| AUC | 0.9827 [0.9541, 0.9925] (22 reviews) |
| S@99R | 0.9059 [0.7823, 0.9636] (22 reviews) |
| S@95R | 0.9339 [0.8304, 0.9636] (22 reviews) |
| Recall@0.3 | 1.0000 [0.9655, 1.0000] (22 reviews) |
| Specificity@0.3 | 0.8715 [0.7860, 0.9225] (22 reviews) |
| Recall@0.5 | 0.9459 [0.8115, 1.0000] (22 reviews) |
| Specificity@0.5 | 0.9456 [0.8897, 0.9692] (22 reviews) |

Pooled (micro): N=142504, included=768.

| Threshold | Recall | Specificity | FN |
|---:|---:|---:|---:|
| 0.3 | 0.9349 | 0.8568 | 50 |
| 0.5 | 0.8255 | 0.9382 | 134 |

Recall ≥99% at threshold 0.3: 16 / 22 reviews.

## Secondary analysis (records with abstracts)

| Review | N | Included | Recall@0.3 | Specificity@0.3 | FN@0.3 | Recall@0.5 | Specificity@0.5 | FN@0.5 | AUC | S@99R | S@95R | WSS@95 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CD011218 | 674 | 14 | 1.0000 | 0.8848 | 0 | 0.7857 | 0.9530 | 3 | 0.9716 | 0.8985 | 0.8985 | 0.8298 |
| CD012268 | 4501 | 18 | 0.8333 | 0.9460 | 3 | 0.7778 | 0.9770 | 4 | 0.9547 | 0.6596 | 0.6596 | 0.6070 |
| CD013042 | 945 | 26 | 1.0000 | 0.6670 | 0 | 0.8846 | 0.8596 | 3 | 0.9537 | 0.7530 | 0.8215 | 0.7500 |
| CD013059 | 5347 | 17 | 1.0000 | 0.9315 | 0 | 0.9412 | 0.9677 | 1 | 0.9908 | 0.9580 | 0.9580 | 0.9049 |
| CD013071 | 9103 | 49 | 0.6735 | 0.9049 | 16 | 0.3878 | 0.9855 | 30 | 0.9282 | 0.7533 | 0.7533 | 0.6992 |
| CD013197 | 2395 | 43 | 1.0000 | 0.8903 | 0 | 1.0000 | 0.9154 | 0 | 0.9931 | 0.9315 | 0.9528 | 0.8865 |
| CD013199 | 1769 | 16 | 1.0000 | 0.7547 | 0 | 1.0000 | 0.9013 | 0 | 0.9891 | 0.9635 | 0.9635 | 0.9048 |
| CD013295 | 2885 | 101 | 1.0000 | 0.6063 | 0 | 1.0000 | 0.6994 | 0 | 0.9310 | 0.7579 | 0.7963 | 0.7195 |
| CD013358 | 3217 | 82 | 0.7439 | 0.8147 | 21 | 0.4146 | 0.9225 | 48 | 0.8765 | 0.5907 | 0.6967 | 0.6301 |
| CD013377 | 5565 | 9 | 1.0000 | 0.8961 | 0 | 1.0000 | 0.9408 | 0 | 0.9940 | 0.9789 | 0.9789 | 0.9274 |
| CD013421 | 2311 | 23 | 0.9565 | 0.9795 | 1 | 0.9130 | 0.9913 | 2 | 0.9976 | 0.9773 | 0.9886 | 0.9292 |
| CD013590 | 1674 | 24 | 0.7917 | 0.9370 | 5 | 0.5000 | 0.9806 | 12 | 0.9661 | 0.8303 | 0.8855 | 0.8234 |
| CD013591 | 10741 | 19 | 1.0000 | 0.7236 | 0 | 0.9474 | 0.8760 | 1 | 0.9742 | 0.8376 | 0.8376 | 0.7861 |
| CD013822 | 9707 | 18 | 1.0000 | 0.9723 | 0 | 0.9444 | 0.9905 | 1 | 0.9978 | 0.9863 | 0.9863 | 0.9344 |
| CD013880 | 11282 | 43 | 0.9535 | 0.9319 | 2 | 0.6744 | 0.9734 | 14 | 0.9757 | 0.8849 | 0.9353 | 0.8819 |
| CD014715 | 48250 | 49 | 0.9796 | 0.8689 | 1 | 0.9388 | 0.9528 | 3 | 0.9875 | 0.7564 | 0.9478 | 0.8969 |
| CD014736 | 6013 | 8 | 1.0000 | 0.9799 | 0 | 1.0000 | 0.9935 | 0 | 0.9992 | 0.9973 | 0.9973 | 0.9460 |
| CD015038 | 1881 | 12 | 1.0000 | 0.8737 | 0 | 1.0000 | 0.9337 | 0 | 0.9924 | 0.9775 | 0.9775 | 0.9213 |
| CD015042 | 2995 | 9 | 1.0000 | 0.9260 | 0 | 0.8889 | 0.9635 | 1 | 0.9925 | 0.9575 | 0.9575 | 0.9046 |
| CD015067 | 1906 | 11 | 1.0000 | 0.5989 | 0 | 1.0000 | 0.8433 | 0 | 0.9586 | 0.8623 | 0.8623 | 0.8073 |
| CD015306 | 1426 | 6 | 1.0000 | 0.9585 | 0 | 1.0000 | 0.9782 | 0 | 0.9946 | 0.9782 | 0.9782 | 0.9241 |
| CD015432 | 1869 | 42 | 1.0000 | 0.8878 | 0 | 1.0000 | 0.9414 | 0 | 0.9816 | 0.9414 | 0.9425 | 0.8724 |

### Review-level medians [IQR]

| Metric | Median [Q1, Q3]; valid reviews |
|---|---|
| AUC | 0.9845 [0.9605, 0.9929] (22 reviews) |
| S@99R | 0.9150 [0.7760, 0.9738] (22 reviews) |
| S@95R | 0.9452 [0.8438, 0.9740] (22 reviews) |
| Recall@0.3 | 1.0000 [0.9623, 1.0000] (22 reviews) |
| Specificity@0.3 | 0.8932 [0.8282, 0.9357] (22 reviews) |
| Recall@0.5 | 0.9428 [0.8104, 1.0000] (22 reviews) |
| Specificity@0.5 | 0.9529 [0.9172, 0.9779] (22 reviews) |

Pooled (micro): N=136456, included=639.

| Threshold | Recall | Specificity | FN |
|---:|---:|---:|---:|
| 0.3 | 0.9233 | 0.8758 | 49 |
| 0.5 | 0.8075 | 0.9477 | 123 |

Recall ≥99% at threshold 0.3: 15 / 22 reviews.


## Comparison with paper text and Table 2 summary values

| Condition | Median AUC | Median S@99R | Median S@95R |
|---|---:|---:|---:|
| TITAN-SR | 0.9760 | 0.8790 | 0.8970 |
| ASReview (with warm-up) | — | 0.7470 | 0.7520 |
| Jev secondary analysis | 0.9845 | 0.9150 | 0.9452 |
| Jev primary analysis | 0.9827 | 0.9059 | 0.9339 |

No discussion is auto-generated.
