import type { APIGatewayProxyEventV2 } from "aws-lambda";

export type AppRole = "CUSTOMER" | "KITCHEN" | "CASHIER" | "MANAGER";
export interface Principal {
  sub: string;
  roles: readonly AppRole[];
}

// API Gateway's JWT authorizer verifies JWT signature, issuer, expiry and app-client audience.
// Never parse an Authorization header as trustworthy claims inside this Lambda.
export function principalFromVerifiedGatewayEvent(event: APIGatewayProxyEventV2): Principal | null {
  const claims = event.requestContext.authorizer?.jwt?.claims;
  const configuredClientId = process.env.COGNITO_CLIENT_ID;
  if (!claims || !configuredClientId) return null;
  if (claims.token_use !== "access" || claims.client_id !== configuredClientId) return null;
  if (typeof claims.sub !== "string" || !claims.sub.trim()) return null;
  const rawGroups: unknown = claims["cognito:groups"];
  const groups: string[] =
    Array.isArray(rawGroups) ? rawGroups.filter((x): x is string => typeof x === "string") :
    typeof rawGroups === "string" ? rawGroups.replace(/^\[/, "").replace(/\]$/, "").split(",").map(x => x.trim()) : [];
  const allowed: AppRole[] = ["KITCHEN", "CASHIER", "MANAGER"];
  const matched = allowed.filter(role => groups.includes(role));
  // New accounts cannot self-assign privileges: only admin-assigned Cognito groups are elevated.
  return { sub: claims.sub, roles: matched.length ? matched : ["CUSTOMER"] };
}

export function can(principal: Principal, action: "order:create" | "order:list" | "order:read-all" | "order:status" | "order:payment"): boolean {
  switch (action) {
    case "order:create": return true;
    case "order:list":
    case "order:read-all": return principal.roles.some(r => r === "KITCHEN" || r === "CASHIER" || r === "MANAGER");
    case "order:status": return principal.roles.some(r => r === "KITCHEN" || r === "MANAGER");
    case "order:payment": return principal.roles.some(r => r === "CASHIER" || r === "MANAGER");
  }
}
