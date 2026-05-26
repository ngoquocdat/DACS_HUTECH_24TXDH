/** * Local development server — wraps the Lambda handler as a plain HTTP server. * Usage: npx ts-node src/local-server.ts * * This file is NOT deployed to AWS. It is only for local development. */import * as path from "path";
import * as http from "http";
import * as url from "url";
import * as dotenv from "dotenv";

// Load .env from backend root (local dev only — not used in Lambda)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { handler } from "./handler";
import { openApiSpec } from "./openapi";
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from "aws-lambda";

const PORT = process.env.PORT || 5681;

const server = http.createServer(async (req, res) => {
	const parsedUrl = url.parse(req.url || "/", true);
	const pathname = parsedUrl.pathname || "/";

	// Read request body
	let body = "";
	req.on("data", (chunk) => {
		body += chunk;
	});

	req.on("end", async () => {
		// ── Swagger UI (/docs) ───────────────────────────────────────────────
		if (pathname === "/docs" || pathname === "/docs/") {
			res.statusCode = 200;
			res.setHeader("Content-Type", "text/html");
			res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>iPOS Pokesaigon — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/docs/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`);
			return;
		}

		// ── OpenAPI JSON spec (/docs/openapi.json) ───────────────────────────
		if (pathname === "/docs/openapi.json") {
			res.statusCode = 200;
			res.setHeader("Content-Type", "application/json");
			res.end(JSON.stringify(openApiSpec, null, 2));
			return;
		}

		// ── Lambda handler (all other routes) ────────────────────────────────
		const event: APIGatewayProxyEventV2 = {
			version: "2.0",
			routeKey: `${req.method} ${pathname}`,
			rawPath: pathname,
			rawQueryString: parsedUrl.search?.slice(1) || "",
			headers: req.headers as Record<string, string>,
			queryStringParameters: parsedUrl.query as Record<string, string>,
			requestContext: {
				accountId: "123456789012",
				apiId: "local",
				domainName: "localhost",
				domainPrefix: "localhost",
				requestId: `local-${Date.now()}`,
				routeKey: `${req.method} ${pathname}`,
				stage: "$default",
				time: new Date().toISOString(),
				timeEpoch: Date.now(),
				http: {
					method: req.method || "GET",
					path: pathname,
					protocol: "HTTP/1.1",
					sourceIp: req.socket.remoteAddress || "127.0.0.1",
					userAgent: req.headers["user-agent"] || "",
				},
			},
			body: body || undefined,
			pathParameters: undefined,
			isBase64Encoded: false,
		};

		try {
			const result = (await handler(event)) as APIGatewayProxyResultV2;

			if (
				typeof result === "object" &&
				result !== null &&
				"statusCode" in result
			) {
				const r = result as {
					statusCode: number;
					headers?: Record<string, string>;
					body?: string;
				};

				// Write status
				res.statusCode = r.statusCode;

				// Write headers
				if (r.headers) {
					Object.entries(r.headers).forEach(([k, v]) => res.setHeader(k, v));
				}
				res.setHeader("Content-Type", "application/json");

				res.end(r.body || "");
			} else {
				res.statusCode = 200;
				res.end(JSON.stringify(result));
			}
		} catch (err) {
			console.error("Handler error:", err);
			res.statusCode = 500;
			res.end(
				JSON.stringify({
					error: { code: "INTERNAL_SERVER_ERROR", message: String(err) },
				}),
			);
		}
	});
});

server.listen(PORT, () => {
	console.log(`\n🚀 iPOS Pokesaigon local server running`);
	console.log(`   http://localhost:${PORT}`);
	console.log(`\n📖 Swagger UI:  http://localhost:${PORT}/docs`);
	// console.log(`   OpenAPI JSON: http://localhost:${PORT}/docs/openapi.json`);
	console.log(
		`\nDynamoDB table: ${process.env.DYNAMODB_TABLE_NAME || "PokesaigonOrders"}`,
	);
	console.log(`Region: ${process.env.AWS_REGION || "ap-southeast-1"}\n`);
});
