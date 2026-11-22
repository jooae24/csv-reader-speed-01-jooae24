[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/jooae24/csv-reader-speed-01-jooae24/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/jooae24/csv-reader-speed-01-jooae24/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# Fast csv-reader drop-in (make.fun csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0 that answers exactly as
it does on every input: `{columns, rows, errors}` for `{text, header}`,
including its whole broken-row policy (BOM, CRLF/LF, stray CR, quoted fields
with doubled quotes, quote junk, unterminated quotes, short/long rows with
their error records).

## How it is faster

- A whole record line with no quote and no stray CR is split at once
  (`String.split`), instead of being read character by character.
- Fields are scanned with global regexes (`/[,\r\n]/g` for unquoted fields,
  `/["\r\n]/g` inside quoted fields): one native scan jumps from delimiter
  to delimiter, and a field is usually a single `slice`.
- No per-field allocation beyond the field strings and the row arrays the
  answer itself needs; no per-character loop, no regex per field.

## Correctness

Checked against the reference on the kit's practice set (6/6 cases identical)
plus ~6,200 hand-written edge cases, random fuzz inputs and generator-drawn
full-size cases — 100% identical answers.

## Local speed (practice set, 10.2 MB of CSV, 6 cases)

- `run()` only: ~0.19 s vs csv-reader 1.0.0's ~0.68 s (**~3.6x faster**)
- Whole `main.ts` run (JSON parse + answers + stringify): ~1.15 s vs ~1.97 s

## Files

- `solve.js` — the fast reader: `run(input)` returns csv-reader's answer.
- `main.ts` — the harness driver (the kit's driver, unchanged): reads
  `/input/cases.json`, answers each case with `run`, writes
  `/output/answers.json`.
- `package.json` — `{"type": "module"}`.

MIT licensed.
