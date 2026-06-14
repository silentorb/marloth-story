# Static website deploy (CI/CD)

Deploy the Astro static site from `dist/web/` to an existing S3 bucket and invalidate CloudFront via GitHub Actions.

## Summary

On pushes to `main` (and manual dispatch), a GitHub Actions workflow builds the site inside the devcontainer Docker image, syncs output to S3 with full replacement, and invalidates the CloudFront distribution. S3 and CloudFront are **already provisioned**; this feature covers repo-side automation and the IAM/GitHub wiring to connect them.

## When to read this

- Changing deploy triggers, path filters, or workflow steps
- Configuring GitHub secrets/variables or AWS IAM for deploy
- Troubleshooting failed deploys or stale CloudFront cache

## Requirements

- **Must** build with the same devcontainer image used for local development (Bun + pinned lockfile).
- **Must** run `bun run web:build` to produce `dist/web/` (see [`static-website.md`](./static-website.md)).
- **Must** deploy on relevant changes to `main` via path filters (content, static-site package, marloth-db, lockfiles, devcontainer, workflow).
- **Must** replace bucket contents on each deploy (`aws s3 sync --delete`).
- **Must** invalidate CloudFront after each successful sync (`/*`).
- **Must** authenticate to AWS via GitHub OIDC (no long-lived access keys in the repository).
- **Should** run `marloth-static-site` tests before build in CI.
- **May** support manual `workflow_dispatch` for first deploy and debugging.

## Design rationale

Building inside the devcontainer image keeps CI aligned with local dev (same Bun version, same dependency install path). Deploy steps run on the GitHub runner so OIDC credential exchange stays straightforward. Full bucket replace matches the ephemeral bucket model; CloudFront invalidation ensures HTML and assets update without per-object cache tuning in v1.

## Behavior / pipeline

1. **Trigger:** push to `main` matching path filters, or `workflow_dispatch`.
2. **Checkout** repository.
3. **Build devcontainer image** from `.devcontainer/Dockerfile` (Docker layer cache via GHA).
4. **Build in container:** mount workspace, `bun install --frozen-lockfile`, run static-site tests, `bun run web:build`.
5. **Assume IAM role** via GitHub OIDC (`aws-actions/configure-aws-credentials`).
6. **Sync to S3:** `aws s3 sync dist/web/ s3://$S3_BUCKET/ --delete`.
7. **Invalidate CloudFront:** `aws cloudfront create-invalidation --paths "/*"`.

Concurrency group `deploy-static-site` with `cancel-in-progress: true` so overlapping pushes deploy only the latest.

## Inputs / outputs / artifacts

| Input | Source |
| --- | --- |
| Design corpus | `content/` (git-tracked) |
| Build tooling | `packages/marloth-static-site/`, `packages/marloth-db/` |
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

### First deploy

Actions → **Deploy static site** → **Run workflow**.

## Configuration

| Option | Where | Default |
| --- | --- | --- |
| Deploy branch | Workflow | `main` |
| Site base path | `MARLOTH_WEB_BASE` at build time | `/` |
| Path filters | Workflow | content, static-site, marloth-db, lockfiles, devcontainer, workflow |

If the site is served under a CloudFront path prefix, set `MARLOTH_WEB_BASE` in the workflow build step.

## Verification

1. Run workflow via `workflow_dispatch`.
2. Confirm objects in S3: `index.html`, `nodes/*/index.html`, `_astro/*`.
3. Open the CloudFront URL; confirm content matches latest `main`.
4. Push a small `content/` change on `main`; confirm automatic redeploy.

Local parity check (same commands CI uses inside the container):

```bash
docker build -f .devcontainer/Dockerfile -t marloth-ci:local .
docker run --rm -v "$PWD:/workspaces/marloth-story" -w /workspaces/marloth-story marloth-ci:local \
  bash -lc 'bun install --frozen-lockfile && bun run --filter marloth-static-site test && bun run web:build'
```

## Implementation pointers

| Piece | Path |
| --- | --- |
| Workflow | `.github/workflows/deploy-static-site.yml` |
| Devcontainer image | `.devcontainer/Dockerfile` |
| Docker build context exclusions | `.dockerignore` |
| Static site build | `bun run web:build` → [`static-website.md`](./static-website.md) |

## See also

- [`static-website.md`](./static-website.md) — Astro build and output layout
- [`marloth-db.md`](./marloth-db.md) — content store read at build time
