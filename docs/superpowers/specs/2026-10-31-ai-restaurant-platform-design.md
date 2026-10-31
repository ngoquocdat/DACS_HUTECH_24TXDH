# AI-enabled Restaurant Platform — Design Specification

**Project:** DACS_HUTECH_24TXDH / iPOS Pokesaigon  
**Date:** 2026-10-31  
**Status:** Proposed design — implementation requires approval  
**Selected approach:** Hướng B — AI-enabled Restaurant Platform

## 1. Intent

Nâng cấp đồ án cơ sở `iPOS Pokesaigon` thành Đồ án chuyên ngành Công nghệ thông tin theo hướng Software Engineering + AI Engineering, tận dụng tối đa source hiện tại thay vì viết lại từ đầu.

Hệ thống sau nâng cấp phải thể hiện được đồng thời:

- một quy trình nghiệp vụ nhà hàng hoàn chỉnh;
- kiến trúc cloud/serverless có thể triển khai thật;
- authentication, authorization, validation, testing, CI/CD và observability;
- AI features có giá trị nghiệp vụ thật, không chỉ là chatbot gắn thêm;
- phương pháp đánh giá AI bằng dataset/evals và guardrails.

Tên đề tài đề xuất:

> **Xây dựng nền tảng quản lý đặt món và vận hành nhà hàng thông minh tích hợp trí tuệ nhân tạo trên kiến trúc Serverless**

Tên tiếng Anh:

> **Design and Implementation of an AI-enabled Smart Restaurant Ordering and Operations Platform on Serverless Architecture**

## 2. Current System

Source hiện tại đã có ba user flows chính:

- Customer/Staff tạo order tại `/order`.
- Kitchen cập nhật trạng thái order tại `/kitchen`.
- Cashier tìm order và xác nhận thanh toán tại `/cashier`.

Order lifecycle hiện tại:

`PENDING -> PREPARING -> READY -> PAID`, với `CANCELLED` từ các trạng thái cho phép.

Kiến trúc hiện tại:

`React + Vite -> API Gateway HTTP API -> AWS Lambda Node.js/TypeScript -> DynamoDB`, với SNS notification optional.

Backend đã có separation cơ bản:

`handler -> service -> repository -> DynamoDB`.

Điểm hạn chế hiện tại cần nâng cấp:

- Chưa có authentication/RBAC.
- Frontend/backend chưa có automated test framework.
- Một Lambda handler đang đảm nhận toàn bộ routing.
- DynamoDB hiện chủ yếu dùng partition key `orderId`; các filter nghiệp vụ vẫn phụ thuộc scan.
- Menu bị duplicate giữa frontend và backend.
- Kitchen dùng polling thay vì event-driven/realtime.
- Chưa có Manager/Analytics capability.
- Chưa có CI/CD quality gate.
- Chưa có AI orchestration, evals hoặc guardrails.
- Repo đang có credential CSV ở root; phải revoke/rotate và loại bỏ khỏi history trước khi tiếp tục dùng AWS credentials mới.

## 3. Goals

### 3.1 Software Engineering Goals

1. Giữ và hoàn thiện end-to-end restaurant flow.
2. Tách domain theo module có boundary rõ ràng.
3. Thêm authentication và RBAC cho các role:
   - CUSTOMER
   - KITCHEN
   - CASHIER
   - MANAGER
   - ADMIN
4. Thêm unit, integration và E2E tests.
5. Thêm CI/CD quality gates.
6. Thêm structured logging, tracing/metrics cơ bản và health checks.
7. Deploy được trên AWS bằng Infrastructure as Code.
8. Có OpenAPI/API documentation và architecture documentation.

### 3.2 AI Engineering Goals

1. AI Recommendation dựa trên menu thật và business constraints.
2. Restaurant Copilot cho Manager bằng tool calling.
3. RAG cho menu/ingredient/allergen/policy knowledge.
4. Structured outputs + schema validation.
5. AI guardrails và business-rule validation.
6. AI evaluation dataset + automated eval runner.
7. Theo dõi latency, token usage và estimated cost cho AI request.

## 4. Non-goals

Trong 10 tuần, các mục sau không phải yêu cầu bắt buộc:

- Full multi-agent architecture.
- Autonomous agent được phép thay đổi payment/order state trực tiếp.
- Computer vision nhận diện món ăn.
- Voice ordering production-grade.
- Demand forecasting bằng ML model riêng.
- Microservices decomposition thành nhiều deployable services.
- Migration khỏi AWS serverless stack hiện tại chỉ để dùng công nghệ mới hơn.

Các feature trên chỉ thực hiện khi Must-have và Should-have đã hoàn thành.

## 5. Approaches Considered

### Approach A — AI Assistant only

Giữ hệ thống gần như hiện tại và thêm chatbot/recommendation đơn giản.

**Ưu:** nhanh, ít thay đổi.  
**Nhược:** AI mang tính trang trí; không chứng minh được Software Engineering/AI Engineering depth.

### Approach B — AI-enabled Restaurant Platform — Selected

Giữ domain và stack chính, nâng cấp platform theo từng lớp: engineering foundation, authentication, analytics, AI recommendation, tool-calling copilot, RAG và evals.

**Ưu:** cân bằng giữa khả năng hoàn thành 10 tuần và độ sâu chuyên ngành; tận dụng source hiện tại; demo và bảo vệ rõ ràng.  
**Nhược:** cần kiểm soát scope và thứ tự dependency chặt chẽ.

### Approach C — Full Agentic/Multi-agent Platform

Supervisor Agent + Ordering/Analytics/Inventory/Support agents + MCP.

**Ưu:** mới và có chiều sâu agentic architecture.  
**Nhược:** scope quá lớn cho 10 tuần; testing/evaluation phức tạp; rủi ro tạo demo nhiều hơn sản phẩm hoàn chỉnh.

## 6. Selected Architecture

```text
┌────────────────────────────────────────────────────┐
│                React Web Application               │
│ Customer | Kitchen | Cashier | Manager | Admin    │
└─────────────────────────┬──────────────────────────┘
                          │ HTTPS
                          ▼
                API Gateway HTTP API
                          │
                          ▼
                 Lambda Application
  ┌───────────────────────┼────────────────────────┐
  │                       │                        │
  ▼                       ▼                        ▼
Order Module          Analytics Module          AI Module
  │                       │              ┌────────┼────────┐
  │                       │              ▼        ▼        ▼
  │                       │          Provider    RAG      Tools
  └───────────────┬───────┘              │        │        │
                  ▼                      └────────┼────────┘
               DynamoDB                           │
                                                 ▼
                                        Guardrails/Evals
```

### Architectural principle

AI is an advisory/orchestration layer. Deterministic business services remain authoritative for price, order state, payment state and authorization.

## 7. Domain Modules

Target backend logical modules:

```text
backend/src/
├── modules/
│   ├── auth/
│   ├── menu/
│   ├── order/
│   ├── kitchen/
│   ├── cashier/
│   ├── analytics/
│   └── ai/
├── shared/
│   ├── config/
│   ├── errors/
│   ├── logging/
│   ├── http/
│   └── validation/
└── handler.ts
```

Không bắt buộc restructure toàn bộ ở một commit. Existing `orderService`, `orderRepository`, `orderValidator` được refactor dần theo các task cần thiết.

## 8. Authentication and Authorization

Recommended implementation: Amazon Cognito User Pool + JWT validation tại API layer.

Role model:

| Role | Main capabilities |
|---|---|
| CUSTOMER | tạo/xem order của bản thân |
| KITCHEN | xem order cần chế biến, cập nhật PREPARING/READY |
| CASHIER | tìm order, xác nhận PAID |
| MANAGER | dashboard, analytics, Restaurant Copilot |
| ADMIN | quản trị menu/user/configuration |

Authorization phải được enforce ở backend; frontend route guards chỉ phục vụ UX.

## 9. Menu as Source of Truth

Hiện menu constants tồn tại cả frontend và backend. Target design chuyển menu thành backend-owned domain data.

Frontend lấy menu qua API:

`GET /menu`

Backend là source of truth cho:

- item ID;
- name;
- category;
- price;
- availability;
- nutrition metadata nếu có;
- allergens/tags nếu có.

Order price luôn được tính lại ở backend.

## 10. AI Recommendation

### User scenario

Customer nhập yêu cầu tự nhiên, ví dụ:

> Tôi muốn một phần poke dưới 150.000đ, nhiều protein, không cay.

### Pipeline

```text
Natural-language preference
        ↓
Input validation
        ↓
Deterministic candidate filtering
        ↓
LLM recommendation over valid candidates
        ↓
Structured JSON output
        ↓
Schema validation
        ↓
Business-rule validation
        ↓
Recommendation UI
```

LLM không được tự tạo product ID hoặc price ngoài dữ liệu menu.

Target structured output:

```ts
interface MenuRecommendation {
  items: Array<{
    productId: string;
    reason: string;
  }>;
  summary: string;
}
```

Final total/price được tính bằng deterministic menu/order service.

## 11. Restaurant Copilot

Manager có thể hỏi bằng natural language:

- Doanh thu hôm nay là bao nhiêu?
- Món nào bán nhiều nhất tuần này?
- Bao nhiêu order bị chậm?
- Khoảng thời gian nào kitchen có tải cao nhất?

Agent chỉ được truy cập allow-listed read tools, ví dụ:

```ts
getRevenueSummary(range)
getOrderStatusSummary(range)
getTopMenuItems(range, limit)
getKitchenPerformance(range)
```

Mặc định Restaurant Copilot **read-only**.

Không expose tool trực tiếp để:

- mark payment;
- change order status;
- delete order;
- edit price;
- modify user roles.

## 12. RAG Knowledge Assistant

Knowledge scope:

- menu descriptions;
- ingredient information;
- allergen information;
- restaurant policy;
- operational guide.

Pipeline:

```text
Documents
  ↓
Chunking
  ↓
Embeddings
  ↓
Vector store
  ↓
Retrieval
  ↓
LLM answer + citations
```

RAG answers phải trả về evidence/source metadata. Với câu hỏi allergen, nếu không tìm được evidence đủ mạnh thì hệ thống phải nói không đủ dữ liệu thay vì suy đoán.

## 13. AI Provider Boundary

Frontend không gọi LLM provider trực tiếp.

Backend expose provider-neutral interface, ví dụ:

```ts
interface AIProvider {
  generateStructured<T>(request: AIRequest<T>): Promise<AIResponse<T>>;
}
```

First implementation có thể dùng một provider duy nhất; interface tồn tại để tránh coupling business logic với SDK cụ thể.

API key/credentials chỉ nằm ở backend environment/secrets store.

## 14. AI Guardrails

Mỗi AI flow phải có:

1. request size/input validation;
2. role/permission check;
3. allow-listed tools;
4. structured output schema;
5. business-rule validation;
6. timeout/retry policy có giới hạn;
7. fallback response khi provider lỗi;
8. audit metadata: request ID, model/provider, latency, token counts nếu provider hỗ trợ.

AI output không được trở thành authoritative value cho price/payment/order transition.

## 15. AI Evaluation

Repository có thư mục:

```text
evals/
├── datasets/
├── cases/
└── README.md
```

Metrics tối thiểu:

- constraint compliance;
- recommendation validity;
- tool-call correctness;
- groundedness/citation validity cho RAG;
- hallucination/invalid-product rate;
- latency;
- token usage;
- estimated cost/request.

Evals phải có deterministic assertions ở những chỗ có thể kiểm tra trực tiếp. LLM-as-judge chỉ dùng bổ sung, không thay thế business assertions.

## 16. Analytics and Manager Dashboard

Dashboard minimum metrics:

- total orders;
- revenue;
- orders by status;
- average preparation time;
- top-selling items;
- peak order period.

Analytics service cung cấp cùng một business logic cho cả Dashboard API và AI tools để tránh hai cách tính khác nhau.

## 17. DynamoDB Evolution

Không rewrite database ngay từ đầu.

Phase đầu giữ `orderId` partition key và bổ sung indexes/access patterns khi analytics/query requirements rõ ràng.

Các access patterns cần hỗ trợ hiệu quả:

- orders by status/time;
- orders by customer;
- orders by table;
- orders by created date/time;
- analytics over bounded time range.

Tránh `Scan` cho production-like paths khi đã có access pattern rõ ràng.

## 18. Realtime Strategy

Kitchen polling 8 giây hiện tại có thể giữ trong baseline.

Should-have improvement: Server-Sent Events hoặc API Gateway WebSocket cho order status updates.

Realtime chỉ được triển khai sau khi core business tests ổn định.

## 19. Testing Strategy

### Backend

- Unit: validators, price calculation, state transition, analytics calculations, AI business validation.
- Integration: repositories/API with isolated test data or local emulation where practical.

### Frontend

- Unit/component: order interactions, role-specific views, recommendation rendering.
- E2E: Playwright.

Required E2E scenarios:

1. Customer creates order.
2. Kitchen moves PENDING -> PREPARING -> READY.
3. Cashier moves READY -> PAID.
4. Unauthorized role cannot perform forbidden action.
5. AI recommendation respects menu IDs and budget constraint.
6. Manager Copilot invokes only allowed read tools.

## 20. CI/CD

Pull request quality gate:

```text
install
  ↓
lint
  ↓
typecheck
  ↓
unit tests
  ↓
integration tests
  ↓
frontend/backend build
```

E2E có thể chạy trên dedicated workflow/environment nếu AWS integration làm pipeline quá chậm.

Main/release deployment phải dùng GitHub Actions OIDC -> AWS role; không lưu static AWS access key trong repository.

## 21. Observability

Minimum:

- structured JSON logs;
- request/correlation ID;
- API latency/error logging;
- AI latency/model/token metadata;
- CloudWatch metrics/dashboard cho API errors và Lambda duration;
- không log secrets, access tokens hoặc raw credential values.

## 22. Security Requirements

Priority zero trước feature development:

1. Revoke/rotate credentials từng xuất hiện trong public repository.
2. Remove credential files khỏi current tree.
3. Rewrite/purge git history nếu file từng chứa credential thật.
4. Add root-level secret/config ignore patterns.
5. Use least-privilege IAM roles.
6. Use GitHub OIDC for CI/CD.
7. Validate request payloads server-side.
8. Enforce RBAC server-side.
9. Rate-limit/limit AI endpoints where practical.
10. Never expose provider API keys to Vite/frontend environment.

## 23. Scope Priorities

### Must-have

- existing Order/Kitchen/Cashier flows preserved;
- security credential cleanup;
- backend-owned menu;
- authentication + RBAC;
- Manager dashboard + analytics;
- AI Recommendation;
- Restaurant Copilot with read-only tools;
- automated tests;
- CI quality gates;
- AWS deployment;
- documentation and weekly reports.

### Should-have

- RAG knowledge assistant;
- AI eval automation;
- realtime kitchen updates;
- improved observability;
- DynamoDB index optimization.

### Nice-to-have

- MCP exposure for selected tools;
- multi-agent supervisor;
- voice ordering;
- demand forecasting;
- image/food recognition.

## 24. 10-week Delivery Shape

| Week | Primary outcome |
|---|---|
| 1 | security cleanup, baseline audit, requirements, architecture |
| 2 | engineering foundation, tests/CI, domain/API design |
| 3 | menu source-of-truth + order refactor |
| 4 | Cognito authentication + RBAC |
| 5 | analytics + Manager dashboard |
| 6 | AI Recommendation |
| 7 | Restaurant Copilot + tool calling |
| 8 | RAG + AI evaluation |
| 9 | E2E, deployment hardening, observability/realtime as capacity allows |
| 10 | optimization, thesis documentation, evidence, presentation/demo |

Weekly reports will follow actual completed work; they must not claim features that have not been implemented.

## 25. Final Demo Narrative

Recommended defense/demo sequence:

1. Login with role-specific account.
2. Customer creates a normal order.
3. Customer asks AI for a constrained recommendation and adds a valid recommendation to the order.
4. Kitchen processes the order.
5. Cashier confirms payment.
6. Manager opens dashboard.
7. Manager asks Copilot an operational question; UI shows tool-backed answer.
8. Ask a knowledge/allergen question and show RAG evidence if RAG is completed.
9. Show automated tests/evals and CI result.
10. Show AWS architecture/logging and explain security boundaries.

## 26. Success Criteria

The project is considered successful when:

- core restaurant flow remains functional end-to-end;
- authorization is enforced by backend roles;
- production-like code has automated tests and CI;
- AWS deployment is reproducible from IaC;
- AI recommendation cannot invent price/product IDs without being rejected;
- Restaurant Copilot uses explicit read-only tools rather than unrestricted database access;
- at least one AI evaluation dataset can be executed repeatedly;
- documentation explains architecture, security, testing, AI design and limitations;
- 10 weekly progress reports reflect traceable commits/evidence.

## 27. Decisions Left to Builder

The implementation plan may choose minor details that do not change product scope, including:

- exact file split inside each module;
- test fixture naming;
- UI component library, provided migration cost stays bounded;
- vector store implementation for RAG;
- exact LLM provider/model after current pricing/capability verification;
- SSE versus WebSocket if realtime is implemented.

Any choice that changes Must-have scope, security boundary or 10-week delivery order requires project-owner approval.
