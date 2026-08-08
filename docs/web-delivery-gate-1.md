# Pinega Web Delivery Gate 1 — Cloudflare commit previews

## Status

Implementation: complete, live activation pending.

Provider: Cloudflare Pages Direct Upload.

Production deployment: explicitly out of scope.

The repository contains the complete validation, provenance, attestation,
preview deployment, and remote verification path. Cloudflare writes remain
disabled until the repository-level `CLOUDFLARE_PREVIEW_ENABLED` variable is
set to `true` and the named GitHub Environment contains the required values.

## Delivery invariant

The authoritative contract is:

```text
tested pull-request merge snapshot
        = one web/dist build
        = locally validated content
        = deterministic attested archive
        = Cloudflare Direct Upload input
        = content served by the immutable preview URL
```

Cloudflare must never rebuild the repository. GitHub Actions uses Direct Upload
because Pages supports uploading prebuilt assets from a custom CI system:

<https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/>

## Commit identities

A pull-request build records three independent identities:

```text
source_sha = pull_request.head.sha
base_sha   = pull_request.base.sha
tested_sha = github.sha
```

For `pull_request`, `tested_sha` identifies the merge snapshot checked out and
tested by the workflow. `validate` fails if `git rev-parse HEAD` differs from
that identity.

The deployed build exposes:

```text
/.well-known/pinega-deployment.json
```

Its schema is `web/deployment/pinega-deployment.schema.json`. The manifest
contains source, base, tested merge, PR, refs, workflow run, build profile,
provider, and expected environment. It intentionally does not contain its own
artifact checksum, which would create a cyclic hash dependency.

## Workflow boundaries

`.github/workflows/check-web-foundation.yml` contains four jobs.

### `validate`

This is the only job that builds the site and runs repository code. It has
read-only repository permissions and no Cloudflare secret.

It:

1. checks out the tested merge snapshot;
2. installs exact locked dependencies with lifecycle scripts disabled;
3. validates tokens, types, unit contracts, build budgets, browser behaviour,
   accessibility, and committed visual baselines;
4. adds the deployment provenance manifest;
5. creates a deterministic GNU tar + timestamp-free gzip archive;
6. records and verifies SHA-256;
7. uploads the deployable archive only after every quality gate succeeds.

Diagnostics remain a separate always-uploaded artifact and cannot be mistaken
for deployable content.

### `attest`

This job does not checkout or execute pull-request code. It downloads the exact
archive, verifies SHA-256, and creates a GitHub build-provenance attestation
using OIDC. Only this job receives `id-token: write` and `attestations: write`.

GitHub artifact attestations bind a digest to the repository, workflow, commit,
event, and OIDC identity:

<https://docs.github.com/en/actions/concepts/security/artifact-attestations>

### `deploy`

This job does not checkout or execute pull-request code. It receives the
Cloudflare credential only after validation and attestation succeed.

It:

1. downloads and verifies the same deterministic archive;
2. rejects missing configuration and any preview branch equal to the configured
   Cloudflare production branch;
3. runs pinned `cloudflare/wrangler-action` and exact Wrangler `4.120.0`;
4. supplies explicit branch, full tested SHA, commit message, and clean-state
   metadata to `wrangler pages deploy`;
5. requires Cloudflare to report `environment=preview` and an immutable
   hash-based `pages.dev` URL;
6. verifies root, docs, `noindex`, exact remote provenance, and a real HTTP 404
   directly over HTTPS;
7. publishes a provider deployment record containing Cloudflare deployment ID,
   immutable URL, alias, commits, and artifact SHA-256.

The GitHub job uses `environment.url`, so the immutable URL appears as
`View deployment` in the pull request:

<https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/deploy-to-environment>

### `remote-smoke`

This job has no deployment credential. It runs Chromium and axe-core against
the immutable Cloudflare URL and compares the served provenance to the
downloaded expected artifact. It verifies essential routes, nearest-404
behaviour, static assets, internal navigation, console errors, and blocking
accessibility findings.

If the artifact contains `ru/404.html`, the same test automatically requires a
Russian nearest-404 response for an unknown `/ru/...` route. This lets Gate 3A
activate locale hosting coverage without coupling Delivery Gate 1 to its code.

## Preview identity and aliases

Each tested merge uses a distinct branch identity:

```text
pr-<number>-<source-short-sha>-m-<tested-short-sha>
```

Cloudflare creates:

```text
https://<deployment-hash>.<project>.pages.dev/   authoritative immutable URL
https://<branch-alias>.<project>.pages.dev/      convenience alias
```

Only the immutable URL is recorded as the GitHub Environment URL and used by
remote verification. Cloudflare documents hash URLs as atomic and permanently
addressable while a branch alias moves to the latest deployment:

<https://developers.cloudflare.com/pages/configuration/preview-deployments/#preview-aliases>

Workflow-level concurrency cancels superseded runs for the same PR. The unique
branch identity additionally prevents a late older run from moving the alias of
a newer tested merge.

## Security boundary

- Fork pull requests execute `validate` but never receive attestation or
  deployment authority.
- Only same-repository pull requests may enter `attest` and `deploy`.
- The Cloudflare token must have only `Account / Cloudflare Pages / Edit` for
  the selected account.
- The token is an Environment secret and is never committed, printed, embedded
  into `dist`, or passed to remote Playwright.
- Third-party actions are pinned to full commit SHAs; Wrangler is pinned to an
  exact npm version.
- Preview URLs are public unless Cloudflare Access is deliberately configured.
  The current smoke contract assumes public previews and does not accept an
  interactive login page as a successful deployment.
- Cloudflare adds `X-Robots-Tag: noindex` to preview deployments by default, but
  `noindex` is not access control.

## Required GitHub configuration

Repository variable, available before environment selection:

```text
CLOUDFLARE_PREVIEW_ENABLED = true
```

GitHub Environment (initial implementation name):

```text
cloudflare-preview
```

Environment secret:

```text
CLOUDFLARE_API_TOKEN
```

Environment variables:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_PAGES_PROJECT
CLOUDFLARE_PRODUCTION_BRANCH
```

If the Environment restricts deployment branches, it must permit pull-request
merge refs (`refs/pull/*/merge`). No Cloudflare user ID, account password,
Global API Key, or API email belongs in this workflow.

## Retention

Deployable, diagnostic, provider-record, and remote-smoke GitHub artifacts use a
30-day retention period.

Cloudflare commit URLs are intentionally immutable. The latest deployment for a
Pages branch cannot be deleted, and this gate uses a unique branch for every
tested merge. Therefore automatic Cloudflare deletion is not claimed in Gate 1;
provider-side retention is manual until Pinega adopts either a project-level
retention mechanism or a different branch/tombstone policy that does not weaken
commit identity. Cloudflare documents the latest-per-branch deletion constraint:

<https://developers.cloudflare.com/pages/configuration/preview-deployments/#delete-preview-deployments>

## Activation and rollback

Activation is a separate configuration commit after the exact existing
Environment names and values are confirmed. Until then, absence of
`CLOUDFLARE_PREVIEW_ENABLED=true` makes every Cloudflare-write job skip.

Rollback is immediate and does not change source code:

```text
CLOUDFLARE_PREVIEW_ENABLED = false
```

The regular Web validation path remains active on pull requests and `main`; no
merge in this gate can publish production content.
