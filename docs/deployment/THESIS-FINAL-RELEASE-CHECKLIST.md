# Thesis-final release gates

## P0
- [ ] All leaked AWS credentials invalidated; audit CloudTrail.
- [ ] Sensitive CSVs removed from Git history (branch-tip removal alone is insufficient).
- [ ] JWT authentication and RBAC protect mutation endpoints.
- [ ] Payment and status transition race/idempotency fixes verified.
- [ ] GitHub main protection, restricted UAT environment and reviewed AWS role permissions.

## UAT
- [ ] Frontend/backend clean npm ci and build.
- [ ] Unit, integration, and E2E core workflow tests pass.
- [ ] SAM validates and packaged Node.js 24 handler runs.
- [ ] Correct CloudFormation service role, artifact bucket, CORS and frontend hosting.
- [ ] Smoke test: order -> preparing -> ready -> paid, 401/403/409 cases.
- [ ] Bedrock Nova Lite API integrated via Lambda IAM, not a developer API key.
- [ ] RAG is grounded, recommendation pricing uses real menu, Copilot tools read-only.
- [ ] Monitoring/budget alerts confirmed and UAT accepted.

## Production demo
- [ ] Isolated production stack/resources and Cognito.
- [ ] DynamoDB PITR enabled, rollback documented.
- [ ] Production approval, release tag, test evidence, thesis screenshots.
