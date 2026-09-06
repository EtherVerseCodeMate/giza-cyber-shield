# Validation Test Suite (TRL10)

Proves the Khepra security detector actually works — it does **not** grep a
fixture for its own marker string. It drives the real rule engine over labelled
fixtures and asserts **both** failure modes:

- every fixture under `fixtures/fail/<category>/` **must be flagged** (no false negatives)
- every fixture under `fixtures/pass/<category>/` **must be clean** (no false positives)
- a flagged fail-fixture whose directory maps to a known category must be flagged
  for the **right** reason (no accidental passes)

The suite exits non-zero on any false negative, false positive, wrong-category
flag, or if there are no fixtures at all (a suite with nothing to validate is a
silent no-op and is treated as a failure).

## Run

```bash
bash tests/validation/scripts/run-validation-tests.sh
```

Pure Python 3 stdlib — no Go/Node toolchain, so it is immune to dependency or
toolchain drift. Wired into CI as the "Test Validation Suite" check.

## Layout

```
tests/validation/
├── detector.py        # the real rule engine (secret / sql_injection / command_injection / weak_crypto)
├── run_validation.py  # confusion-matrix harness (TP/FN/TN/FP + precision/recall)
├── scripts/run-validation-tests.sh   # thin entry point CI invokes
└── fixtures/
    ├── fail/<category>/*.go   # known-vulnerable — MUST be flagged
    ├── pass/<category>/*.go   # safe idioms — MUST stay clean
    └── samples/               # sample data
```

`fail`/`pass` category directory names map to detector categories in
`run_validation.py::CATEGORY_MAP`.

## Extending

1. Add a fixture under `fixtures/fail/<category>/` (vulnerable) or
   `fixtures/pass/<category>/` (safe idiom). Prefer **discriminating** pass
   fixtures — code that a naive detector would wrongly flag (e.g. a `fmt.Sprintf`
   that builds a non-SQL string, a secret sourced from `os.Getenv`). These keep
   precision honest.
2. If it is a new vulnerability class, add a rule to `detector.py` and map the
   fail directory name in `CATEGORY_MAP`.
3. Run the suite. Then confirm it can still *fail* by temporarily crippling the
   rule and re-running — a suite that cannot fail proves nothing.

## Why this is TRL10, not a smoke test

The previous runner ran `grep -q 'khepra-dev-key' fixtures/fail/hardcoded_keys.go`
and asserted the string was present — i.e. it checked that the fixture contained
its own marker, which validates nothing about the detector and broke the moment
the fixture layout changed. This suite runs a general detector that would catch
novel instances, measures precision **and** recall, and is mutation-tested to
confirm it flags regressions rather than rubber-stamping them.
