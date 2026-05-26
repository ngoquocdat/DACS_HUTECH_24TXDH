# Infrastructure — Deploy Guide
This folder contains the AWS SAM template for deploying the iPOS Pokesaigon
backend to AWS.

## What gets deployed

| Resource             | Type            | Name                                 |
| -------------------- | --------------- | ------------------------------------ |
| API Gateway HTTP API | REST endpoint   | Auto-generated URL                   |
| Lambda function      | Node.js 20      | `ipos-order-api-handler`             |
| DynamoDB table       | NoSQL           | `PokesaigonOrders`                   |
| IAM role             | Least-privilege | Auto-created by SAM                  |
| CloudWatch logs      | Auto            | `/aws/lambda/ipos-order-api-handler` |

---

## Prerequisites

1. **AWS CLI installed and configured**

   ```bash
   aws --version
   aws configure
   ```

   Enter your `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, region
   (`ap-southeast-1`), and output format (`json`).

2. **AWS SAM CLI installed**

   ```bash
   # Windows (via Chocolatey)
   choco install aws-sam-cli

   # Or download installer from:
   # https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

   sam --version
   ```

3. **Backend built**

   ```bash
   cd ../backend
   npm install
   npm run build
   ```

---

## Deploy to AWS

### Step 1 — Install AWS SAM CLI

```bash
# Windows — install via pip (requires Python)
pip install aws-sam-cli

# Verify
sam --version
```

### Step 2 — Configure AWS credentials

```bash
aws configure
```

Enter:

```
AWS Access Key ID     : <your key>
AWS Secret Access Key : <your secret>
Default region name   : ap-southeast-1
Default output format : json
```

### Step 3 — Build backend

```bash
cd ../backend
npm install
npm run build
```

This compiles TypeScript to `backend/dist/`. SAM packages `dist/` +
`node_modules` and uploads to S3.

### Step 4 — First-time guided deploy

```bash
cd ../infra
sam deploy --guided
```

Answer the prompts:

```
Stack Name                        : ipos-pokesaigon-stack
AWS Region                        : ap-southeast-1
CorsOrigin                        : *
SnsTopicArn                       : (leave empty, press Enter)
Confirm changes before deploy     : Y
Allow SAM CLI IAM role creation   : Y
OrderApiFunction has no auth...   : Y  (press Y twice)
Save arguments to samconfig.toml  : Y
SAM configuration file            : (Enter)
SAM configuration environment     : (Enter)
Deploy this changeset?            : Y
```

SAM will:

1. Create a managed S3 bucket
   (`aws-sam-cli-managed-default-samclisourcebucket-*`) to store the Lambda
   package
2. Upload the compiled backend (~10 MB) to that S3 bucket
3. Create a CloudFormation changeset and deploy 7 resources:
   - `AWS::DynamoDB::Table` — PokesaigonOrders
   - `AWS::IAM::Role` — Lambda execution role
   - `AWS::Lambda::Function` — ipos-order-api-handler
   - `AWS::ApiGatewayV2::Api` — HTTP API
   - `AWS::ApiGatewayV2::Stage` — default stage
   - `AWS::Lambda::Permission` × 2 — allow API Gateway to invoke Lambda

### Step 5 — Subsequent deploys (after samconfig.toml is saved)

```bash
cd infra
sam deploy
```

### Step 6 — Copy the API URL

After deploy completes, copy the `ApiUrl` from the Outputs section:

```
Outputs
-------
Key   ApiUrl
Value https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com
```

Put this URL in:

- `frontend/.env` → `VITE_API_BASE_URL=https://xxxxxxxxxx...`
- `aws.config` → `API_BASE_URL=https://xxxxxxxxxx...`

### Troubleshooting: DynamoDB table already exists

If a previous partial deploy left a `PokesaigonOrders` table outside
CloudFormation, the deploy will fail with `ResourceExistenceCheck`. Fix:

```bash
# Delete the orphaned table (only if it has 0 items)
aws dynamodb delete-table --table-name PokesaigonOrders --region ap-southeast-1
aws dynamodb wait table-not-exists --table-name PokesaigonOrders --region ap-southeast-1

# Then retry
sam deploy
```

---

## Local development with SAM CLI

You can run the Lambda locally without deploying to AWS:

```bash
# In backend/ — build first
cd ../backend && npm run build && cd ../infra

# Start local API (uses DynamoDB Local or AWS DynamoDB depending on env)
sam local start-api --env-vars env.json
```

Create `infra/env.json` for local overrides:

```json
{
	"OrderApiFunction": {
		"DYNAMODB_TABLE_NAME": "PokesaigonOrders",
		"DYNAMODB_ENDPOINT": "http://host.docker.internal:8000",
		"CORS_ORIGIN": "*",
		"SNS_NEW_ORDER_TOPIC_ARN": ""
	}
}
```

---

## View Lambda logs

```bash
# Stream logs in real time
sam logs -n ipos-order-api-handler --stack-name ipos-pokesaigon-stack --tail

# Or use AWS CLI
aws logs tail /aws/lambda/ipos-order-api-handler --follow
```

---

## Tear down (delete all AWS resources)

```bash
sam delete --stack-name ipos-pokesaigon-stack
```

This deletes Lambda, API Gateway, and the DynamoDB table (all data will be
lost).

---

## Optional: SNS Email notification

1. Go to **AWS Console → SNS → Create topic**
   - Type: Standard
   - Name: `PokesaigonNewOrderTopic`

2. **Create subscription**
   - Protocol: Email
   - Endpoint: kitchen email address

3. **Confirm** the subscription in the email inbox.

4. Copy the Topic ARN and re-deploy:

   ```bash
   sam deploy --parameter-overrides SnsTopicArn=arn:aws:sns:ap-southeast-1:123456789012:PokesaigonNewOrderTopic
   ```

---

## Optional: S3 receipt export

Add S3 permissions to `template.yaml` and implement the export in
`backend/src/handler.ts`. Set `S3_RECEIPT_BUCKET` in the Lambda environment
variables.

---

## Deployed stack — AWS Console links

Stack deployed to region: `ap-southeast-1` Stack name: `ipos-pokesaigon-stack`

| Service         | AWS Console Link                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lambda          | [ipos-order-api-handler](https://ap-southeast-1.console.aws.amazon.com/lambda/home?region=ap-southeast-1#/functions/ipos-order-api-handler)                                  |
| DynamoDB        | [PokesaigonOrders table](https://ap-southeast-1.console.aws.amazon.com/dynamodbv2/home?region=ap-southeast-1#table?name=PokesaigonOrders)                                    |
| API Gateway     | [HTTP APIs](https://ap-southeast-1.console.aws.amazon.com/apigateway/home?region=ap-southeast-1)                                                                             |
| CloudFormation  | [ipos-pokesaigon-stack](https://ap-southeast-1.console.aws.amazon.com/cloudformation/home?region=ap-southeast-1#/stacks)                                                     |
| CloudWatch Logs | [Lambda log group](https://ap-southeast-1.console.aws.amazon.com/cloudwatch/home?region=ap-southeast-1#logsV2:log-groups/log-group/%2Faws%2Flambda%2Fipos-order-api-handler) |

### API endpoint

```
https://noc6xmty0c.execute-api.ap-southeast-1.amazonaws.com
```

Set this in `frontend/.env`:

```
VITE_API_BASE_URL=https://noc6xmty0c.execute-api.ap-southeast-1.amazonaws.com
```
