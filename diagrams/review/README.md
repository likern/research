# Diagram review artifacts

The academic renderer review cycle produces generated artifacts from GitHub Actions.

Expected artifact contents:

```text
pdf/
  mvcc-academic.pdf
  linearizability-academic.pdf
  comparison.pdf

png/
  mvcc-review.png
  linearizability-review.png

svg/
  mvcc.svg
  linearizability.svg

models/
  version-chain.json
  history.json
```

Each iteration should create a new immutable artifact name so visual reviews can be compared over time.
