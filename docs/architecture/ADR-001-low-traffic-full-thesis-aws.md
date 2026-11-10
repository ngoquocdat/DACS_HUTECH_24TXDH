# ADR — Full Thesis, Low-Traffic AWS Architecture & Cost Controls

- **Date:** 2026-11-10
- **Decision:** Accepted by project owner
- **Scope:** AI-enabled Restaurant Ordering & Operations Platform, complete thesis feature set
- **Region:** `us-east-1`
- **Target monthly run rate:** **USD 10–25** for both UAT and Production under light usage
- **Operating contingency:** USD 25–40/month (not a hard ceiling)
- **Existing AWS monthly budget:** USD 15; keep it as an early alert during setup, revisit only after measured costs justify a change.
- **Credit balance:** USD 120 as evidenced in AWS console on 2026-11-10; eligibility/expiry must be checked within AWS Billing.

## Agreed functionality (no longer demo-only)

Customer ordering, kitchen workflow, cashier/payment confirmation, Cognito authentication and RBAC, manager dashboard and analytics, AI recommendations constrained by real menu/prices, read-only manager Copilot, small-corpus RAG, validation, evaluation/test cases, CI/CD, UAT and Production environments, CloudWatch observability, backup and rollback runbooks.

## Cost-efficient target architecture

| Component | Decision |
| --- | --- |
| Frontend | React/Vite static build, private S3 + CloudFront with Origin Access Control |
| API | HTTP API Gateway + Node.js 24 AWS Lambda |
| Data | DynamoDB PAY_PER_REQUEST, separate `uat`/`prod` tables, Prod PITR |
| Authentication | Cognito user pools and server-side JWT/role guards |
| AI inference | Amazon Bedrock on-demand **Nova Lite**; strict per-user quotas, maximum tokens and maximum tool calls |
| Recommendation | Backend filters candidate menu items and pricing deterministically **before** LLM |
| Copilot | Whitelisted, read-only analytics tools; server authorizes each tool call |
| RAG | Small curated knowledge corpus in S3, lightweight retrieval in Lambda; avoid paid always-on vector search. Evaluate semantic indexing only if needed |
| CI/CD | GitHub Actions with OIDC and restrictive IAM roles, separate GitHub environments |
| Monitoring | Structured logs, bounded log retention, alarms and AWS Budgets |
| Network | No NAT Gateway, idle EC2, provisioned Bedrock capacity or always-on OpenSearch for MVP |

## Cost model — planning assumptions, not an AWS quote

- One small restaurant, light user traffic, minimal stored images, limited AI evaluation runs.
- Expected budget range `$10–25/month`, **not guaranteed**: service pricing, region, free allowances and traffic affect actual bill.
- Keep UAT quiet outside testing; separate UAT and Production resources, do not run expensive load testing repeatedly.
- Default AWS Budget `$15/month` already exists; budgets alert rather than enforce a charge limit.
- At `$25/month`, USD 120 credits correspond to 4.8 months of arithmetic spend coverage, **but actual credit eligibility and expiry override this calculation**.
- Validate Free Plan support for each service before provisioning. Some resources may be unavailable under Free Plan.
- Budget for CloudWatch/WAF, data egress, DynamoDB backups and Bedrock requests; WAF and DNS may add fixed charges if enabled.
- Production hardening may exceed USD 25 in a given month; surface any forecasted overrun before enabling paid resources.

## Safety and deployment controls

1. Rotate/revoke credentials previously leaked in repository history. Delete visible files from branch HEAD (done in PR #3) **does not** remove leaked history.
2. Enforce Cognito/JWT + RBAC before public API deployment. No UAT/Production deployment until backend authorization, payment/concurrency and tests pass.
3. Gate AWS deploy via GitHub environment, manually approved restricted IAM roles and CloudFormation execution role.
4. Use resource tags `Project=ThesisFinal` and `Environment=uat|prod` for cost attribution.
5. Limit Bedrock per-request token usage, per-user daily requests, tool depth and concurrency; configure API throttling and alerts.
6. Enable DynamoDB Prod PITR, logging, rollback and smoke tests.
7. Reassess actual AWS Cost Explorer spend after first UAT deployment and update the forecast before Production deployment.

## Delivery priorities

1. P0 credential rotation + backend order/payment correctness + authentication/RBAC + tests.
2. Secure infrastructure and UAT deployment with reviewed IAM and cost protections.
3. Manager analytics, Bedrock Recommendation/Copilot and small-corpus RAG.
4. E2E/security/AI evaluation, production release and thesis evidence.

## Not selected

- Full-featured commercial multi-region high availability
- EC2/GPU inference hosting
- NAT gateway by default
- OpenSearch Serverless provisioned/always-on vector index
- Paid Bedrock provisioned throughput
- Unrestricted multi-agent/tool automation
