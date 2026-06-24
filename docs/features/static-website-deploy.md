# Static website deploy (CI/CD)

Deploy the Astro static site from `dist/web/` to an existing S3 bucket and invalidate CloudFront via GitHub Actions.

## Summary

On pushes to `main` (and manual dispatch), a GitHub Actions workflow checks out **marloth-story** and **silentorb/tome**, builds the site inside the devcontainer Docker image, syncs output to S3 with full replacement, and invalidates the CloudFront distribution. S3 and CloudFront are **already provisioned**; this feature covers repo-side automation and the IAM/GitHub wiring to connect them.

## When to read this

- Changing deploy triggers, path filters, or workflow steps
- Configuring GitHub secrets/variables or AWS IAM for deploy
- Troubleshooting failed deploys or stale CloudFront cache

## Requirements

- **Must** build with the same devcontainer image used for local development (Bun + pinned lockfile from `silentorb/tome`).
- **Must** checkout `silentorb/tome` alongside marloth-story in CI (build tooling lives in the tome repo).
- **Must** run `tome-static-site` tests and `web:build` to produce `dist/web/` (see [`static-website.md`](../tome/docs/features/static-website.md) in the tome repo).
- **Must** deploy on relevant changes to `main` via path filters (content, marloth CI scripts, devcontainer, workflow).
- **Must** replace bucket contents on each deploy (`aws s3 sync --delete`).
- **Must** invalidate CloudFront after each successful sync (`/*`).
- **Must** authenticate to AWS via GitHub OIDC (no long-lived access keys in the repository).
- **Should** run `tome-static-site` tests before build in CI.
- **May** support manual `workflow_dispatch` for first deploy and debugging.

## Design rationale

Building inside the devcontainer image keeps CI aligned with local dev (same Bun version, same dependency install path). The tome repo supplies packages and `bun.lock`; marloth-story supplies `content/`. Deploy steps run on the GitHub runner so OIDC credential exchange stays straightforward. Full bucket replace matches the ephemeral bucket model; CloudFront invalidation ensures HTML and assets update without per-object cache tuning in v1.

**Tome-only changes** do not auto-trigger marloth deploy (path filters are marloth-scoped). After updating tome packages, run `workflow_dispatch` or bump the optional `TOME_REF` repository variable.

## Behavior / pipeline

1. **Trigger:** push to `main` matching path filters, or `workflow_dispatch`.
2. **Checkout** marloth-story and `silentorb/tome` (into `./tome`; ref from `vars.TOME_REF` or `main`).
3. **Build devcontainer image** from `.devcontainer/Dockerfile` (Docker layer cache via GHA).
4. **Build in container:** bind-mount marloth and tome, `bun install --frozen-lockfile` in tome workspace, run static-site tests, `bun run web:build` with `--content-dir` pointing at marloth `content/`.
5. **Assume IAM role** via GitHub OIDC (`aws-actions/configure-aws-credentials`).
6. **Sync to S3:** `aws s3 sync dist/web/ s3://$S3_BUCKET/ --delete`.
7. **Invalidate CloudFront:** `aws cloudfront create-invalidation --paths "/*"`.

Concurrency group `deploy-static-site` with `cancel-in-progress: true` so overlapping pushes deploy only the latest.

## Inputs / outputs / artifacts

| Input | Source |
| --- | --- |
| Design corpus | `content/` (git-tracked, marloth-story) |
| Build tooling | `silentorb/tome` (`packages/tome-static-site/`, `packages/tome-db/`, `bun.lock`) |
| Devcontainer image | `.devcontainer/Dockerfile` |

| Output | Destination |
| --- | --- |
| Static HTML | Existing S3 bucket (full replace) |
| CDN cache bust | CloudFront invalidation on existing distribution |

| GitHub configuration | Purpose |
| --- | --- |
| `AWS_ROLE_ARN` (variable) | IAM role for OIDC assume-role |
| `AWS_REGION` (variable) | S3 bucket region |
| `S3_BUCKET` (variable) | Existing bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` (variable) | Existing distribution ID |
| `TOME_REF` (variable, optional) | Git ref for `silentorb/tome` checkout (default: `main`) |

## Quick start

### One-time AWS / GitHub wiring

**Already in place:** S3 bucket and CloudFront distribution.

**Create deploy IAM role** (if not already present):

1. Ensure IAM OIDC provider for `token.actions.githubusercontent.com` exists in the AWS account.
2. Create a role with trust policy scoped to this repo and branch:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:silentorb/marloth-story:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

3. Attach a policy granting:

- **S3:** `ListBucket`, `GetBucketLocation` on the bucket; `PutObject`, `DeleteObject`, `GetObject` on `arn:aws:s3:::BUCKET_NAME/*`
- **CloudFront:** `CreateInvalidation` on `arn:aws:cloudfront::ACCOUNT_ID:distribution/DISTRIBUTION_ID`

**Set GitHub repository settings** (Settings → Secrets and variables → Actions):

| Name | Type |
| --- | --- |
| `AWS_ROLE_ARN` | Variable |
| `AWS_REGION` | Variable |
| `S3_BUCKET` | Variable |
| `CLOUDFRONT_DISTRIBUTION_ID` | Variable |
| `TOME_REF` | Variable (optional) |

**Cross-repo checkout:** If `silentorb/tome` is private, ensure the marloth-story workflow token can read it (org setting: allow workflows to access other org repos). If checkout fails with 403/404, add a fine-grained PAT as `secrets.TOME_REPO_TOKEN` on the tome checkout step.

### First deploy

Actions → **Deploy static site** → **Run workflow**.

## Configuration

| Option | Where | Default |
| --- | --- | --- |
| Deploy branch | Workflow | `main` |
| Tome ref | `vars.TOME_REF` | `main` |
| Site base path | `TOME_WEB_BASE` or `MARLOTH_WEB_BASE` at build time | `/` |
| Path filters | Workflow | content, CI scripts, devcontainer, workflow |

If the site is served under a CloudFront path prefix, set `TOME_WEB_BASE` (or `MARLOTH_WEB_BASE`) in the workflow build step env.

## Verification

### Simulate CI build (before push)

On the **host** (or WSL) where Docker is installed — not inside a devcontainer that lacks Docker:

```bash
# Clone tome alongside marloth-story (or set TOME_ROOT)
git clone https://github.com/silentorb/tome.git tome   # once
bun run web:build:ci
```

Same as `bash scripts/ci-build-static-site.sh`: builds the devcontainer image, bind-mounts marloth and tome, runs as the checkout owner UID/GID (like GitHub Actions), then tests + `web:build`. Bun is installed to `/usr/local/bun` in the image so it is available regardless of container user.

From **silentorb-workbench**, point at the mounted sibling repos:

```bash
cd repos/marloth-story
TOME_ROOT="$(pwd)/../tome" bun run web:build:ci
```

For a fast in-workbench build (not CI parity), use `bash scripts/build-static-site.sh` from the workbench root instead.

### After deploy hook-up

1. Run workflow via `workflow_dispatch`.
2. Confirm objects in S3: `index.html`, `{id}/index.html`, `_astro/*`.
3. Open the CloudFront URL; confirm content matches latest `main`.
4. Push a small `content/` change on `main`; confirm automatic redeploy.

## Implementation pointers

| Piece | Path |
| --- | --- |
| CI build simulation | `scripts/ci-build-static-site.sh` (`bun run web:build:ci`) |
| Workflow | `.github/workflows/deploy-static-site.yml` |
| Devcontainer image | `.devcontainer/Dockerfile` |
| Docker build context exclusions | `.dockerignore` |
| Static site build (tome repo) | `web:build` in `silentorb/tome` → [`static-website.md`](../tome/docs/features/static-website.md) |

## See also

- [`static-website.md`](../tome/docs/features/static-website.md) — Astro build and output layout
- [`tome-db.md`](../tome/docs/features/tome-db.md) — content store read at build time
