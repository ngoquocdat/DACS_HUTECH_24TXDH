# Thesis-final AWS setup: UAT bootstrap

Account: **884028226523**; Region: **us-east-1**; repository: **ngoquocdat/DACS_HUTECH_24TXDH**.

## Confirmed evidence
- AWS Free Tier credits: $120 active on 2026-11-10.
- Monthly cost budget: $15.
- AWS IAM root MFA enabled and no root active access keys (per console screenshots).
- Amazon Bedrock Nova Lite inference passed in Playground (not yet integrated with application).
- GitHub Actions -> AWS OIDC STS verification passed.
- UAT deploy role exists but its permissions are not yet configured.
- No AWS public UAT/production deployment is claimed.

## Critical security blockers
1. **Previously committed credential files:** the proposed branch removes both CSV files from its latest tree. This does NOT purge historical Git commits. AWS operator must revoke/rotate any affected AWS keys immediately, inspect CloudTrail/billing, and plan coordinated git-filter-repo history cleanup. Never use leaked keys.
2. **Unauthenticated API:** current backend accepts payment/status updates without JWT/RBAC. Never expose current API publicly as Production/UAT before remediation.
3. **Business correctness:** payment lacks validated transition; DynamoDB updates can race; order IDs can collide.
4. **Release protection:** branch main must have required PR checks; UAT GitHub Environment must restrict branches/reviewers.

## GitHub settings to bootstrap
Create GitHub Environment **uat** (Settings > Environments), restrict allowed deployment branches, enable review protections where supported. Update IAM OIDC trust policy to match the actual environment subject (e.g. repo:ngoquocdat/DACS_HUTECH_24TXDH:environment:uat) or custom GitHub OIDC subject if enabled. Branch-only OIDC trust from the verification workflow must NOT be copied blindly to deployment roles.

Environment variables:
- AWS_UAT_ROLE_ARN: copied GitHub UAT deploy IAM role ARN (repository variable already used by verification).
- AWS_CFN_UAT_EXECUTION_ROLE_ARN: CloudFormation service execution role (after bootstrap).
- AWS_UAT_ARTIFACT_BUCKET: privately secured, precreated deployment artifact S3 bucket (no public access).
- UAT_FRONTEND_ORIGIN: exact HTTPS URL of UAT frontend, e.g. CloudFront distribution.
- UAT_DEPLOY_APPROVED: leave unset/false until ALL P0 risks resolved. Never use this variable alone as a substitute for code review.

## IAM architecture (least privilege)
1. GitHub UAT deploy role: CloudFormation changeset operations scoped to thesis-pokesaigon-uat stack and deployments; S3 bucket object upload/download limited to artifact bucket; iam:PassRole only to exact CloudFormation execution role, conditioned on iam:PassedToService=cloudformation.amazonaws.com.
2. CloudFormation execution role: trusted entity cloudformation.amazonaws.com, restricted to creating/updating UAT Lambda, API Gateway, DynamoDB, runtime execution roles and logging resources. Any unavoidable Resource:* actions require a justified reviewed policy and conditions; never attach AdministratorAccess. Use IAM Access Analyzer to validate before enabling.
3. Runtime Lambda execution role: only DynamoDB table access and optional model-specific Bedrock invoke rights when AI is implemented. No long-lived AWS access keys.

The exact IAM JSON depends on final stack resources and deployment artifact bucket. IAM bootstrap requires an authorized human to inspect and apply a policy; it is intentionally **not** auto-applied.

## Infrastructure changes in this branch
- Node.js 24 Lambda runtime; parameterized environment-specific resource names.
- HTTPS-only CORS parameter; scoped optional SNS publish.
- Production-only DynamoDB point-in-time recovery; table DeletionPolicy Retain.
- Backend build stays in backend/dist. Before first SAM deploy, test artifact bundling and runtime dependencies.
- No S3/CloudFront frontend infrastructure in this baseline.

## Verification
On pull request: CI installs and builds FE and BE. No unit/integration test runners existed in original package manifests; add tests and security scans before UAT sign-off.
The deploy-uat workflow only performs gated OIDC authentication, not actual deployment. This prevents accidental public exposure until authentication and IAM bootstrap have been completed.

## Next implementation PRs
- Fix legacy order/payment security and concurrency.
- Add JWT authorization and staff role guards.
- Introduce backend tests, CI verification and secret scanning.
- Provision restricted IAM deployment policies and artifact bucket.
- Extend guarded workflow to execute sam validate/build/deploy after UAT sign-off.
- Add S3+CloudFront HTTPS frontend hosting; test end-to-end; integrate Bedrock Nova Lite with proper IAM and cost controls.
