# Thesis-final — UAT bootstrap and release runbook

**Status:** Infrastructure source prepared; AWS resources are NOT created merely by merging the PR.

**Account:** 884028226523 · **Region:** us-east-1 · **Stack (bootstrap):** `thesis-pokesaigon-uat-bootstrap` · **App stack:** `thesis-pokesaigon-uat`.

## Cost / scope

Full thesis, low-traffic, target USD 10–25 monthly (not a guarantee). AWS current USD 15 budget is **an alert, not a hard cap**. This stack creates one CloudFront distribution and private S3 buckets, which can incur usage charges. It does not create EC2, NAT Gateways, WAF, OpenSearch or paid model throughput. CloudFront global resources need additional propagation time after first create.

## P0 — Required **before** creating any AWS resource

1. Revoke and rotate AWS access keys that were exposed in the repository's historical CSV files, inspect IAM/CloudTrail/billing; deletion from the branch does NOT remove git history.
2. Review this PR's two CloudFormation templates, generated IAM roles, and the IAM actions with an experienced AWS account administrator. **No AdministratorAccess policies should be attached to OIDC deploy roles.** The CFN execution role has broad API Gateway/Cognito actions (`Resource: "*"` for certain control-plane APIs); this is a bounded-service bootstrap compromise, NOT rigorously proven least privilege.
3. Configure GitHub Environment `uat` (Settings > Environments): limit deployment to `main`, use required reviewer approval if available. If unavailable, do not rely on repository variables as an approval boundary; manually control which workflow can run.
4. Update the existing IAM deploy role trust policy. The role **has a trailing dot**: `HUTECH-GitHub-UAT-DeployRole.`.
5. Existing `AWS_UAT_ROLE_ARN` repository variable must exactly match its ARN.

### Required OIDC trust condition after moving deployment to environment

Existing OIDC trust may permit `repo:ngoquocdat/DACS_HUTECH_24TXDH:ref:refs/heads/main`.
The UAT workflow now uses `environment: uat`, changing the default OIDC `sub` to
`repo:ngoquocdat/DACS_HUTECH_24TXDH:environment:uat`.
With the standard issuer/audience in AWS IAM, apply this exact subject after verifying actual GitHub OIDC claims:

```json
{
  "Version":"2012-10-17",
  "Statement":[{
    "Effect":"Allow",
    "Principal":{"Federated":"arn:aws:iam::884028226523:oidc-provider/token.actions.githubusercontent.com"},
    "Action":"sts:AssumeRoleWithWebIdentity",
    "Condition":{"StringEquals":{
      "token.actions.githubusercontent.com:aud":"sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub":"repo:ngoquocdat/DACS_HUTECH_24TXDH:environment:uat"
    }}
  }]
}
```

**Do not** open trust to arbitrary branches/subjects. The original branch-only OIDC verification workflow may stop working after this change. That's expected; deploy workflow is the new environment-based OIDC integration test.

## Bootstrap once — AWS Console

1. Open AWS Console **us-east-1 → CloudFormation → Create stack (With new resources)**.
2. Choose **Upload a template file** and use `ipos-pokesaigon/infra/bootstrap-uat.yaml` from a reviewed commit in the PR.
3. Stack name exactly: `thesis-pokesaigon-uat-bootstrap`.
4. Parameter `GitHubDeployRoleName`: `HUTECH-GitHub-UAT-DeployRole.` (verify actual IAM role name).
5. Inspect the change set carefully: private S3 artifact bucket, private web bucket, CloudFront distribution/OAC, Lambda runtime role, CloudFormation execution role and IAM policy attached to the existing GitHub OIDC role.
6. Acknowledge `CAPABILITY_NAMED_IAM` **only after** reviewing named IAM roles/policies. Then create stack.
7. Wait for `CREATE_COMPLETE` and record outputs (no secrets): `ArtifactBucketName`, `FrontendBucketName`, `FrontendOrigin`, `FrontendDistributionId`, `RuntimeRoleArn`, `CloudFormationExecutionRoleArn`.
8. Examine S3 Block Public Access (must be enabled for both), inspect CloudFront OAC, and inspect granted IAM policies.

**Do not delete the bootstrap stack casually:** buckets are retained and CloudFront may remain dependent on origin access/bucket policies.

## Enable UAT GitHub workflow (ONLY after bootstrap + signoff)

1. Enforce `main` branch protection and CI checks.
2. Confirm UAT OIDC trust matches environment; `uat` restricted to `main`.
3. Confirm backend JWT/RBAC, DynamoDB transition tests, Cognito Pool and CFN security review.
4. In GitHub Environment `uat`, set `UAT_DEPLOY_APPROVED=true` only when signoff is complete. Leave false otherwise.
5. Go to GitHub Actions → `Deploy Thesis UAT (manual, guarded)` → Run workflow on `main`. This is **not** triggered automatically on merge.
6. Deployment checks out `main`, builds/tests backend, builds frontend, validates SAM, retrieves bootstrap outputs, deploys the app stack using restricted CFN role, then builds FE with API/Cognito public outputs and uploads to the private S3 origin.
7. CloudFront invalidation completes asynchronously. Visit `FrontendOrigin` from bootstrap outputs and test sign-in.

## Post-deploy smoke tests

- Cognito sign-up: create an unprivileged customer, verify email, login via PKCE, order successfully.
- Cognito console: create *separate staff users* and assign `KITCHEN`, `CASHIER`, `MANAGER` groups, then sign back in.
- Confirm anonymous invalid JWT rejected (401); wrong staff roles rejected (403); different customer order returns 404.
- Test flow: create → PENDING → PREPARING → READY → PAID; invalid/stale requests return 409.
- Verify Frontend CloudFront HTTPS, SPA callback, API CORS, and AWS logs.
- Check DynamoDB table retention + bills, S3 objects privately stored, and current budget alarms.
- If API not healthy: turn off deployments, inspect logs; do not publicize the URL before smoke tests.

## Important limitations / follow-ups

- Current CloudFront SPA fallback maps S3 403/404 to `index.html`. Incorrect asset paths can return HTML and should be checked during smoke tests. Frontend should eventually use route-aware CloudFront Functions if needed.
- Existing backend source is built by npm before `sam build`; SAM must package runtime dependencies. Verify deployed Lambda with real API requests before release.
- SNS `SnsTopicArn` is default-empty/disabled. Runtime IAM role intentionally has no SNS publish privileges.
- DynamoDB Scan still scans whole table; acceptable only for low traffic. Add GSIs + pagination for growth.
- GitHub action checkout/setup-node versions may need maintenance as Node.js action runtimes evolve.
- Auth browser stores access token in sessionStorage (XSS risk). Harden CSP and consider BFF+HttpOnly cookie approach for commercial use.
- IAM/CloudFormation runtime permissions in the bootstrap must be tested and tightened based on CloudTrail before classifying UAT as production ready.
- Production is **NOT** provisioned by this bootstrap. It requires separate IAM roles, isolation, change review and explicit authorization.

## Supporting documentation

- `docs/security/COGNITO-JWT-RBAC.md`
- `docs/architecture/ADR-001-low-traffic-full-thesis-aws.md`
- `docs/deployment/THESIS-FINAL-RELEASE-CHECKLIST.md`
