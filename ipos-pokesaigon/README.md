# iPOS Pokesaigon — Order Application
Ứng dụng đặt món poke bowl cho tiệm Pokesaigon. Đây là đồ án sinh viên dùng AWS
serverless architecture.

## Architecture

```
[Customer / Staff UI (React + Vite)]
           |
           | HTTPS
           ▼
[Amazon API Gateway — HTTP API]
           |
           | Trigger
           ▼
[AWS Lambda — Node.js 20 TypeScript]
           |
           | Read / Write
           ▼
[Amazon DynamoDB — PokesaigonOrders]
           |
           | Optional
           ▼
[Amazon SNS — Kitchen email notification]
```

## Features

| Page    | Path       | Description                                                   |
| ------- | ---------- | ------------------------------------------------------------- |
| Order   | `/order`   | Customer/staff creates a poke bowl order (multi-step wizard)  |
| Kitchen | `/kitchen` | Kitchen views and updates order status, auto-refresh every 8s |
| Cashier | `/cashier` | Cashier searches orders and confirms payment                  |

## Order status flow

```
PENDING → PREPARING → READY → PAID
   ↓           ↓
CANCELLED  CANCELLED
```

---

## Project structure

```
ipos-pokesaigon/
├── aws.config.example       ← AWS credentials template — copy & fill in
├── .gitignore
├── README.md
│
├── frontend/                ← React + TypeScript + Vite
│   ├── src/
│   │   ├── pages/
│   │   │   ├── OrderPage.tsx
│   │   │   ├── KitchenPage.tsx
│   │   │   └── CashierPage.tsx
│   │   ├── components/
│   │   │   ├── Nav.tsx
│   │   │   └── OrderCard.tsx
│   │   ├── services/
│   │   │   └── orderApi.ts      ← calls API Gateway
│   │   ├── constants/
│   │   │   └── menu.ts
│   │   └── types/
│   │       └── order.ts
│   ├── .env.example             ← copy to .env, set VITE_API_BASE_URL
│   └── package.json
│
├── backend/                 ← AWS Lambda Node.js TypeScript
│   ├── src/
│   │   ├── handler.ts           ← Lambda entry point, all routing
│   │   ├── services/
│   │   │   └── orderService.ts  ← business logic, price calculation
│   │   ├── repositories/
│   │   │   └── orderRepository.ts  ← DynamoDB operations
│   │   ├── validators/
│   │   │   └── orderValidator.ts
│   │   ├── constants/
│   │   │   └── menu.ts          ← trusted price source (backend only)
│   │   └── types/
│   │       └── order.ts
│   ├── .env.example
│   └── package.json
│
└── infra/                   ← AWS SAM CloudFormation template
    ├── template.yaml            ← defines API Gateway + Lambda + DynamoDB
    └── README.md                ← detailed deploy reference
```

---

## Prerequisites

Install these tools before starting. Check each with the version command shown.

| Tool        | Version | Install                                                                                             |
| ----------- | ------- | --------------------------------------------------------------------------------------------------- |
| Node.js     | 20+     | https://nodejs.org                                                                                  |
| AWS CLI     | 2.x     | https://aws.amazon.com/cli                                                                          |
| AWS SAM CLI | 1.x     | https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html |
| Git         | any     | https://git-scm.com                                                                                 |

```bash
node --version     # v20.x.x
aws --version      # aws-cli/2.x.x
sam --version      # SAM CLI, version 1.x.x
```

---

## Part 1 — AWS Account Setup

> Do this once. These steps create the IAM user and get the credentials you need
> to deploy.

### 1.1 — Create an AWS account (if you don't have one)

1. Go to https://aws.amazon.com and click **Create an AWS account**.
2. Enter your email, choose a root account password, and complete billing setup.
3. A credit card is required but the free tier covers everything this project
   uses.
4. Choose the **Basic (Free)** support plan.

### 1.2 — Create an IAM user for programmatic access

> **Never use your root account credentials for development.** Create a separate
> IAM user.

1. Sign in to the AWS Console: https://console.aws.amazon.com
2. In the search bar, type **IAM** and open the IAM service.
3. In the left sidebar click **Users** → **Create user**.
4. Set **User name**: `pokesaigon-dev` (or any name you prefer).
5. On the permissions page, choose **Attach policies directly**.
6. Search for and select **AdministratorAccess** (suitable for a dev/demo
   project).
7. Click through to **Create user**.

### 1.3 — Generate access keys

1. Click on the user you just created (`pokesaigon-dev`).
2. Go to the **Security credentials** tab.
3. Scroll to **Access keys** → click **Create access key**.
4. Choose **Application running outside AWS**.
5. Click **Create access key**.
6. **Copy both values now** — the secret key is only shown once:
   - Access key ID: `AKIA...`
   - Secret access key: `wJalr...`

### 1.4 — Configure AWS CLI with your credentials

Run this in your terminal and enter the values from step 1.3:

```bash
aws configure
```

```
AWS Access Key ID     : AKIA...your-key-id...
AWS Secret Access Key : wJalr...your-secret...
Default region name   : ap-southeast-1
Default output format : json
```

Verify it works:

```bash
aws sts get-caller-identity
```

Expected output (your account ID will differ):

```json
{
	"UserId": "AIDA...",
	"Account": "123456789012",
	"Arn": "arn:aws:iam::123456789012:user/pokesaigon-dev"
}
```

### 1.5 — Fill in the project config file

```bash
# From the ipos-pokesaigon/ folder
cp aws.config.example aws.config
```

Open `aws.config` and fill in:

```ini
AWS_REGION=ap-southeast-1
AWS_ACCOUNT_ID=123456789012          # your 12-digit account ID from step above
AWS_ACCESS_KEY_ID=AKIA...            # from step 1.3
AWS_SECRET_ACCESS_KEY=wJalr...       # from step 1.3
DYNAMODB_TABLE_NAME=PokesaigonOrders
```

Leave `API_BASE_URL`, `SNS_NEW_ORDER_TOPIC_ARN`, and `S3_RECEIPT_BUCKET` empty
for now — you will fill them in after deploying.

> `aws.config` is listed in `.gitignore` and will **never** be committed to git.

---

## Part 2 — Build the Backend

### 2.1 — Install dependencies

```bash
cd backend
npm install
```

### 2.2 — Build TypeScript

```bash
npm run build
```

This compiles `src/` to `dist/`. The `dist/` folder is what Lambda runs.

Verify the build output exists:

```bash
# Windows
dir dist\handler.js

# Mac / Linux
ls dist/handler.js
```

---

## Part 2B — Run Backend Locally (without deploying to AWS)

> Use this to develop and test the backend on your machine. The local server
> connects directly to **real DynamoDB on AWS** — no Docker or SAM CLI needed.

### Prerequisites

- AWS CLI is configured (`aws sts get-caller-identity` returns your account)
- DynamoDB table `PokesaigonOrders` already exists on AWS (see Part 4 to create
  it first, or create it manually in the console)

### Start the local server

```bash
cd backend
npm install        # only needed once
```

**Git Bash / Mac / Linux:**

```bash
AWS_REGION=ap-southeast-1 DYNAMODB_TABLE_NAME=PokesaigonOrders npm run dev
```

**Windows Command Prompt (cmd.exe):**

```cmd
set AWS_REGION=ap-southeast-1 && set DYNAMODB_TABLE_NAME=PokesaigonOrders && npm run dev
```

**Windows PowerShell:**

```powershell
$env:AWS_REGION="ap-southeast-1"; $env:DYNAMODB_TABLE_NAME="PokesaigonOrders"; npm run dev
```

Expected output:

```
🚀 iPOS Pokesaigon local server running
   http://localhost:3000

Available routes:
  POST   http://localhost:3000/orders
  GET    http://localhost:3000/orders
  GET    http://localhost:3000/orders/{orderId}
  PATCH  http://localhost:3000/orders/{orderId}/status
  PATCH  http://localhost:3000/orders/{orderId}/payment

DynamoDB table: PokesaigonOrders
Region: ap-southeast-1
```

### Test the server is working

```bash
curl http://localhost:3000/orders
```

Expected response: `{"items":[]}`

### Configure frontend to use local backend

Set `frontend/.env`:

```ini
VITE_API_BASE_URL=http://localhost:3000
```

Then start the frontend (`npm run dev` in `frontend/`) and it will call your
local backend.

### Stop the server

Press `Ctrl + C` in the terminal.

---

## Part 3 — Deploy to AWS with SAM

### 3.1 — First-time guided deploy

Run this from the `infra/` folder:

```bash
cd ../infra
sam deploy --guided
```

Answer the interactive prompts:

```
Stack Name [sam-app]                    : ipos-pokesaigon-stack
AWS Region [us-east-1]                  : ap-southeast-1
Parameter CorsOrigin [*]                : *
Parameter SnsTopicArn []                : (press Enter to skip)
Confirm changes before deploy [y/N]     : y
Allow SAM IAM role creation [Y/n]       : Y
Disable rollback [y/N]                  : N
Save arguments to configuration file [Y/n] : Y
SAM configuration file [samconfig.toml] : (press Enter)
SAM configuration environment [default] : (press Enter)
```

SAM will package the Lambda code, upload it to S3, and create all AWS resources
via CloudFormation. This takes about 1–2 minutes.

### 3.2 — Copy the API URL from the output

When deploy finishes you will see an Outputs section:

```
-----------------------------------------------------------------------
Outputs
-----------------------------------------------------------------------
Key    ApiUrl
Value  https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com
-----------------------------------------------------------------------
```

**Copy the `ApiUrl` value.** You need it in the next step.

Also update `aws.config`:

```ini
API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com
```

### 3.3 — Subsequent deploys (after the first time)

Every time you change backend code, rebuild and redeploy:

```bash
cd backend && npm run build
cd ../infra && sam deploy
```

---

## Part 4 — Run the Frontend

### 4.1 — Create the frontend environment file

```bash
cd ../frontend
cp .env.example .env
```

Open `frontend/.env` and set the API URL from Part 3:

```ini
VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com
```

### 4.2 — Install dependencies

```bash
npm install
```

### 4.3 — Start development server

```bash
npm run dev
```

Open your browser at **http://localhost:5173**

You should see the iPOS Pokesaigon app with three pages: Order, Kitchen,
Cashier.

---

## Part 5 — Test the Full Flow

Work through the demo checklist in order:

1. **Create an order** — go to `/order`, fill in table number (e.g. `A01`) and a
   phone number (e.g. `0901234567`), choose base → protein → toppings → sauce →
   drink, then submit.
2. **Check DynamoDB** — go to AWS Console → DynamoDB → Tables →
   `PokesaigonOrders` → Explore items. Your order should appear with status
   `PENDING`.
3. **Kitchen board** — go to `/kitchen`. The new order appears under "Chờ xác
   nhận". Click **Bắt đầu làm** → status changes to `PREPARING`. Click **Xong
   rồi** → status changes to `READY`.
4. **Cashier** — go to `/cashier`. Search by table number `A01`. Click **Thanh
   toán** → status changes to `PAID`.
5. **CloudWatch logs** — go to AWS Console → CloudWatch → Log groups →
   `/aws/lambda/ipos-order-api-handler`. Each API call produces a structured
   JSON log line.

---

## Part 6 — Optional: SNS Email Notification for Kitchen

When a new order is created, Lambda can send an email to the kitchen.

### 6.1 — Create an SNS topic

1. AWS Console → **SNS** → **Topics** → **Create topic**.
2. Type: **Standard**.
3. Name: `PokesaigonNewOrderTopic`.
4. Click **Create topic**.
5. Copy the **Topic ARN** — it looks like:
   `arn:aws:sns:ap-southeast-1:123456789012:PokesaigonNewOrderTopic`.

### 6.2 — Subscribe the kitchen email

1. On the topic page click **Create subscription**.
2. Protocol: **Email**.
3. Endpoint: enter the kitchen email address.
4. Click **Create subscription**.
5. Check the inbox and click the **Confirm subscription** link in the email.

### 6.3 — Re-deploy with the topic ARN

```bash
cd infra
sam deploy --parameter-overrides SnsTopicArn=arn:aws:sns:ap-southeast-1:123456789012:PokesaigonNewOrderTopic
```

Also update `aws.config`:

```ini
SNS_NEW_ORDER_TOPIC_ARN=arn:aws:sns:ap-southeast-1:123456789012:PokesaigonNewOrderTopic
```

Now every new order triggers an email to the kitchen address.

---

## Part 7 — Clean Up (Delete All AWS Resources)

When you are done with the demo, delete everything to avoid any charges:

```bash
cd infra
sam delete --stack-name ipos-pokesaigon-stack
```

Confirm with `y` when prompted. This deletes:

- The Lambda function
- The API Gateway
- The DynamoDB table (all order data will be lost)
- The IAM role created by SAM

---

## API endpoints reference

| Method  | Path                        | Description                                                            |
| ------- | --------------------------- | ---------------------------------------------------------------------- |
| `POST`  | `/orders`                   | Create new order                                                       |
| `GET`   | `/orders`                   | List orders (filter by `?status=`, `?tableNumber=`, `?customerPhone=`) |
| `GET`   | `/orders/{orderId}`         | Get order detail                                                       |
| `PATCH` | `/orders/{orderId}/status`  | Update order status                                                    |
| `PATCH` | `/orders/{orderId}/payment` | Mark order as paid                                                     |

---

## AWS services used

| Service                       | Purpose                    |
| ----------------------------- | -------------------------- |
| Amazon API Gateway (HTTP API) | REST API endpoint, CORS    |
| AWS Lambda (Node.js 20)       | Business logic, order CRUD |
| Amazon DynamoDB               | Order persistence          |
| Amazon CloudWatch Logs        | Lambda logs (automatic)    |
| Amazon SNS _(optional)_       | Kitchen email notification |

---

## Config file reference

| File                    | Purpose                                            | Committed to git?   |
| ----------------------- | -------------------------------------------------- | ------------------- |
| `aws.config.example`    | Template showing all variables                     | Yes                 |
| `aws.config`            | Your actual credentials and ARNs                   | **No** (gitignored) |
| `frontend/.env.example` | Frontend env template                              | Yes                 |
| `frontend/.env`         | Your actual frontend env                           | **No** (gitignored) |
| `backend/.env.example`  | Backend env template                               | Yes                 |
| `backend/.env`          | Your actual backend env (local dev only)           | **No** (gitignored) |
| `infra/samconfig.toml`  | SAM deploy settings (generated after first deploy) | **No** (gitignored) |

Key variables:

| Variable                  | File                      | Description                       |
| ------------------------- | ------------------------- | --------------------------------- |
| `AWS_REGION`              | `aws.config`              | AWS region (ap-southeast-1)       |
| `AWS_ACCOUNT_ID`          | `aws.config`              | Your 12-digit account ID          |
| `AWS_ACCESS_KEY_ID`       | `aws.config`              | IAM user access key               |
| `AWS_SECRET_ACCESS_KEY`   | `aws.config`              | IAM user secret key               |
| `API_BASE_URL`            | `aws.config`              | API Gateway URL (after deploy)    |
| `VITE_API_BASE_URL`       | `frontend/.env`           | Same API URL — used by Vite/React |
| `DYNAMODB_TABLE_NAME`     | `aws.config` / Lambda env | DynamoDB table name               |
| `SNS_NEW_ORDER_TOPIC_ARN` | `aws.config`              | Optional SNS topic ARN            |

---

## Demo success checklist

- [ ] `aws sts get-caller-identity` returns your account info
- [ ] `sam deploy` completes without errors
- [ ] API Gateway URL is reachable (returns 404 JSON, not a network error)
- [ ] Frontend loads at http://localhost:5173
- [ ] User creates order → success screen shows order ID
- [ ] Order appears in DynamoDB console
- [ ] Kitchen page shows the new order
- [ ] Kitchen changes status: PENDING → PREPARING → READY
- [ ] Cashier finds order and marks as PAID
- [ ] CloudWatch log group has entries for each request

Optional:

- [ ] Kitchen email receives SNS notification on new order
