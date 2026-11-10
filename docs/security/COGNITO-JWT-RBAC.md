# Authentication and role-based access control

## AWS boundary (P0)

The SAM HTTP API uses a **default JWT authorizer** linked to its environment's Cognito User Pool.
API Gateway authenticates JWT signatures, issuer, expiry and app client ID. Lambda reads claims **only**
from `requestContext.authorizer.jwt.claims`, checks `token_use=access` and `client_id`, and performs route-level authorization.
There is **no fallback to unverified Authorization headers** and no DEV_BYPASS flag.

**Never deploy the unauthenticated legacy handler**, and do not bypass authorizer to fix local workflows.
Current `backend/src/local-server.ts` does not validate JWTs and is not a production-equivalent auth environment:
use real API Gateway + Cognito UAT for full integration tests. Backend tests inject preverified gateway contexts only.

## Roles / route authorization

| Action | CUSTOMER | KITCHEN | CASHIER | MANAGER |
| --- | --- | --- | --- | --- |
| POST /orders | Yes | Yes | Yes | Yes |
| GET /orders (staff board) | No | Yes | Yes | Yes |
| GET /orders/{id} | Only when `ownerSub === token.sub` | Yes | Yes | Yes |
| PATCH /orders/{id}/status | No | Yes | No | Yes |
| PATCH /orders/{id}/payment | No | No | Yes | Yes |

New self-registered accounts with no assigned staff group receive CUSTOMER permissions.
KITCHEN/CASHIER/MANAGER are Cognito groups, **not** custom request headers or parameters.
Group assignment MUST use trusted admin action after identity verification.
Legacy orders with no `ownerSub` are staff-only.

Cognito does **not** automatically make a newly registered user a Manager; creating a Manager is an admin-only operation.

## Manual UAT prerequisites (requires approved IAM bootstrap)

1. Complete AWS credential rotation, audit, GitHub OIDC environment trust and least-privilege roles.
2. Deploy stack only when gates are met; collect stack outputs `CognitoUserPoolId`, `CognitoClientId`, `CognitoHostedUiBaseUrl`, `ApiUrl`.
3. Set frontend build-time Vite variables `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`, `VITE_API_BASE_URL` from the **same stack**. These are PUBLIC identifiers, not secrets.
4. Ensure `CorsOrigin` is the exact HTTPS frontend origin and Cognito callback is `<origin>/auth/callback`.
5. Configure CloudFront SPA routing to return `index.html` for frontend client routes (only on legitimate SPA paths); do not rewrite missing JS assets to HTML.
6. Cognito Hosted UI supports customer self-signup with email verification. Register separate staff accounts.
7. From AWS Console Cognito > User pools > UAT pool > Groups, select `KITCHEN`, `CASHIER` or `MANAGER`; add the appropriate verified staff users. Least privilege, no self-assigned staff groups.
8. Sign out/sign in again after group changes so new access tokens contain the updated groups.
9. Verify 401 for missing/invalid/ID token, 403 for wrong staff role, 404 when customer reads a different user's order and 409 for conflicting status/payment writes.
10. Test production Cognito user pool separately with distinct users/groups; never copy UAT customer records into Production.

## Client behavior and security limits

Frontend uses Cognito Hosted UI authorization code + PKCE, short-lived access tokens in tab-scoped `sessionStorage`;
it does **not** store long-lived AWS credentials or Cognito app secrets. When access tokens expire, user signs in again.
This low-traffic thesis baseline still needs CSP/XSS review; BFF + HttpOnly Secure SameSite cookies may be preferable for
real commercial deployments. There is no hidden refresh-token persistence or silent token renewal.

## Known follow-ups

- End-to-end tests with live Cognito/APIGateway/DynamoDB.
- Consider customer self-service order history with an `ownerSub` GSI and cursor pagination, avoiding a table scan.
- Anti-abuse controls and request throttling on customer order creation.
- Stronger browser session controls, CSP and error monitoring.
- Separate admin user-management tools; never let Customer assign a Cognito group.
- Confirm CloudFormation execution role includes tightly scoped Cognito User Pool, App Client, Domain and Group permissions.
