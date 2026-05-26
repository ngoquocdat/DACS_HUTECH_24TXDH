# iPOS Pokesaigon Order Application — AWS Implementation Plan

## 1. Mục tiêu demo

Xây dựng một ứng dụng iPOS đơn giản cho tiệm Pokesaigon, cho phép khách hàng order món theo menu có sẵn, lưu thông tin order theo bàn, gửi order cho kitchen, và lưu số điện thoại khách hàng để cập nhật trạng thái order.

Demo ưu tiên đơn giản, dễ hoàn thành, có tích hợp AWS services nhưng không làm quá phức tạp.

---

## 2. Phạm vi tính năng

### 2.1. Customer order flow

Khách hàng hoặc nhân viên chọn món theo các bước:

1. Chọn bàn / table number
2. Nhập số điện thoại khách hàng
3. Chọn base:
   - Cơm trắng
   - Gạo lức
   - Quinoa
   - 1/2 cơm + salad
4. Chọn protein:
   - Salmon
   - Tuna
5. Chọn topping
6. Chọn gia vị / sauce
7. Chọn nước uống
8. Review order
9. Submit order
10. Hiển thị mã order và trạng thái ban đầu: `PENDING`

### 2.2. Kitchen flow

Kitchen có màn hình riêng để xem danh sách order mới.

Trạng thái order đề xuất:

```txt
PENDING -> PREPARING -> READY -> PAID / CANCELLED
```

Kitchen có thể:

- Xem order mới
- Đổi trạng thái sang `PREPARING`
- Đổi trạng thái sang `READY`

### 2.3. Cashier flow

Cashier có thể:

- Tìm order theo table number hoặc phone number
- Xem order information
- Xác nhận thanh toán
- Đổi trạng thái sang `PAID`

---

## 3. AWS services đề xuất

Ưu tiên dùng 3 services chính để phù hợp demo và hạn chế chi phí.

## Option A — Recommended for demo

| Service | Mục đích dùng | Vì sao chọn |
|---|---|---|
| Amazon API Gateway | Tạo REST API cho frontend gọi backend | Dễ demo kiến trúc client-server, có free tier cho lượng request nhỏ |
| AWS Lambda | Xử lý business logic: tạo order, cập nhật trạng thái, lấy danh sách order | Không cần quản lý server, phù hợp demo nhỏ |
| Amazon DynamoDB | Lưu table, order information, phone number, order status | Serverless database, phù hợp dữ liệu order dạng JSON |

### Lý do chọn Option A

Đây là kiến trúc serverless đơn giản nhất nhưng vẫn thể hiện rõ việc dùng AWS services thật.

Frontend không gọi database trực tiếp. Frontend gọi API Gateway, API Gateway trigger Lambda, Lambda đọc/ghi DynamoDB.

```txt
Frontend iPOS
   ↓
Amazon API Gateway
   ↓
AWS Lambda
   ↓
Amazon DynamoDB
```

### Pros

- Dễ implement.
- Dễ giải thích trong báo cáo đồ án.
- Không cần EC2/server riêng.
- Có thể demo CRUD order rõ ràng.
- Phù hợp free-tier-friendly nếu lượng request nhỏ.

### Cons

- Cần hiểu basic IAM permission cho Lambda truy cập DynamoDB.
- API Gateway + Lambda cần cấu hình CORS.
- Nếu muốn realtime kitchen board thì cần polling hoặc nâng cấp thêm WebSocket/AppSync.

---

## Option B — Có thông báo kitchen bằng AWS SNS

Thêm service:

| Service | Mục đích dùng |
|---|---|
| Amazon SNS | Gửi notification khi có order mới hoặc khi order READY |

Kiến trúc:

```txt
Frontend iPOS
   ↓
API Gateway
   ↓
Lambda
   ↓
DynamoDB
   ↓
SNS Topic: NewOrderTopic / OrderReadyTopic
```

### Cách dùng SNS trong demo

Nên dùng một trong hai cách:

1. SNS Email notification cho kitchen.
2. Mock SMS notification trong database nếu muốn tránh chi phí SMS.

Không nên bắt buộc gửi SMS thật trong demo vì SNS SMS có thể phát sinh phí, cần cấu hình quốc gia, sandbox, spending limit.

### Pros

- Thể hiện rõ event-driven architecture.
- Có điểm cộng trong báo cáo vì hệ thống biết gửi notification.
- Dễ mở rộng sau này.

### Cons

- SMS thật không nên xem là free hoàn toàn.
- Cấu hình SNS có thể tốn thời gian hơn API Gateway + Lambda + DynamoDB.
- Với demo nhỏ, email notification hoặc mock notification là đủ.

---

## Option C — Thêm S3 để host frontend hoặc lưu export receipt

| Service | Mục đích dùng |
|---|---|
| Amazon S3 | Host static frontend hoặc lưu file receipt/order export JSON |

### Gợi ý dùng S3 trong demo

Có 2 hướng:

1. Host React/Vite frontend bằng S3 static website hosting.
2. Khi order được tạo, Lambda có thể export một file JSON receipt vào S3 bucket.

### Pros

- Dễ chứng minh thêm một AWS service.
- S3 rất phổ biến, dễ trình bày trong báo cáo.
- Nếu dùng frontend static hosting thì kiến trúc hoàn chỉnh hơn.

### Cons

- Nếu thêm CloudFront thì phức tạp hơn.
- Nếu chỉ lưu receipt JSON thì giá trị nghiệp vụ không lớn bằng DynamoDB.

---

## 4. Kiến trúc khuyến nghị cuối cùng

Để vừa đủ đồ án, nên chọn:

1. Amazon API Gateway
2. AWS Lambda
3. Amazon DynamoDB

Optional nếu muốn nâng cấp:

4. Amazon SNS cho kitchen notification hoặc customer notification
5. Amazon S3 để host frontend hoặc lưu receipt
6. Amazon CloudWatch để xem logs Lambda

### Final architecture

```txt
[Customer / Staff UI]
        |
        | HTTP Request
        v
[Amazon API Gateway]
        |
        | Trigger
        v
[AWS Lambda Functions]
        |
        | Read / Write
        v
[Amazon DynamoDB]
        |
        | Optional Event
        v
[Amazon SNS / CloudWatch]
```

---

## 5. Data model đề xuất

### 5.1. DynamoDB table: `PokesaigonOrders`

Primary key:

- Partition key: `orderId` string

Attributes:

```json
{
  "orderId": "ORD-20260517-0001",
  "tableNumber": "A01",
  "customerPhone": "0901234567",
  "items": [
    {
      "base": "brown_rice",
      "protein": "salmon",
      "toppings": ["avocado", "corn", "seaweed"],
      "sauce": "spicy_mayo",
      "drink": "coke",
      "quantity": 1,
      "note": "less sauce"
    }
  ],
  "status": "PENDING",
  "paymentStatus": "UNPAID",
  "totalAmount": 129000,
  "createdAt": "2026-05-17T06:30:00.000Z",
  "updatedAt": "2026-05-17T06:30:00.000Z"
}
```

### 5.2. Global Secondary Index đề xuất

Nếu có thời gian, thêm GSI:

| GSI | Mục đích |
|---|---|
| `tableNumber-createdAt-index` | Tìm order theo bàn |
| `status-createdAt-index` | Kitchen lấy order theo trạng thái |
| `customerPhone-createdAt-index` | Tìm order theo số điện thoại |

Nếu demo đơn giản, có thể chưa cần GSI. Có thể dùng `scan` với lượng data nhỏ, nhưng nên ghi chú rằng production cần GSI.

---

## 6. API design

Base URL:

```txt
https://{api-id}.execute-api.{region}.amazonaws.com/dev
```

### 6.1. Create order

```http
POST /orders
```

Request body:

```json
{
  "tableNumber": "A01",
  "customerPhone": "0901234567",
  "items": [
    {
      "base": "brown_rice",
      "protein": "salmon",
      "toppings": ["avocado", "corn"],
      "sauce": "spicy_mayo",
      "drink": "water",
      "quantity": 1,
      "note": "less sauce"
    }
  ]
}
```

Response:

```json
{
  "orderId": "ORD-20260517-0001",
  "status": "PENDING",
  "message": "Order created successfully"
}
```

Lambda responsibility:

- Validate required fields.
- Generate `orderId`.
- Calculate total price.
- Save order to DynamoDB.
- Optional: publish message to SNS kitchen topic.

---

### 6.2. Get order detail

```http
GET /orders/{orderId}
```

Response:

```json
{
  "orderId": "ORD-20260517-0001",
  "tableNumber": "A01",
  "customerPhone": "0901234567",
  "status": "PENDING",
  "paymentStatus": "UNPAID",
  "items": []
}
```

---

### 6.3. List orders for kitchen

```http
GET /orders?status=PENDING
```

Response:

```json
{
  "items": [
    {
      "orderId": "ORD-20260517-0001",
      "tableNumber": "A01",
      "status": "PENDING",
      "createdAt": "2026-05-17T06:30:00.000Z"
    }
  ]
}
```

---

### 6.4. Update order status

```http
PATCH /orders/{orderId}/status
```

Request body:

```json
{
  "status": "PREPARING"
}
```

Allowed status:

```txt
PENDING, PREPARING, READY, PAID, CANCELLED
```

Lambda responsibility:

- Validate new status.
- Update DynamoDB item.
- If status is `READY`, optional publish notification.

---

### 6.5. Mark order as paid

```http
PATCH /orders/{orderId}/payment
```

Request body:

```json
{
  "paymentStatus": "PAID"
}
```

---

## 7. Frontend pages đề xuất

### 7.1. `/order`

Trang tạo order.

Components:

- `TableNumberInput`
- `PhoneInput`
- `BaseSelector`
- `ProteinSelector`
- `ToppingSelector`
- `SauceSelector`
- `DrinkSelector`
- `OrderSummary`
- `SubmitOrderButton`

### 7.2. `/kitchen`

Trang kitchen board.

Components:

- `OrderQueue`
- `OrderCard`
- `UpdateStatusButton`

Cách đơn giản: polling API mỗi 5-10 giây.

```txt
setInterval -> GET /orders?status=PENDING
```

### 7.3. `/cashier`

Trang cashier.

Components:

- `SearchOrderInput`
- `OrderPaymentSummary`
- `MarkAsPaidButton`

---

## 8. Backend Lambda functions

Có 2 cách tổ chức.

### Cách 1 — Một Lambda xử lý nhiều route

```txt
ipos-order-api-handler
```

Pros:

- Dễ deploy.
- Ít file cấu hình.
- Phù hợp demo nhanh.

Cons:

- Code dễ dài nếu nhiều route.
- Khó maintain nếu project lớn.

### Cách 2 — Nhiều Lambda theo chức năng

```txt
createOrderFunction
getOrderFunction
listOrdersFunction
updateOrderStatusFunction
markOrderPaidFunction
```

Pros:

- Rõ trách nhiệm từng function.
- Gần với production architecture hơn.

Cons:

- Cấu hình nhiều hơn.
- Tốn thời gian hơn cho đồ án nhỏ.

### Recommendation

Dùng Cách 1 cho demo level 2.

---

## 9. Folder structure đề xuất

```txt
ipos-pokesaigon/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── OrderPage.tsx
│   │   │   ├── KitchenPage.tsx
│   │   │   └── CashierPage.tsx
│   │   ├── components/
│   │   ├── services/
│   │   │   └── orderApi.ts
│   │   ├── constants/
│   │   │   └── menu.ts
│   │   └── types/
│   │       └── order.ts
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── handler.ts
│   │   ├── routes/
│   │   ├── services/
│   │   │   └── orderService.ts
│   │   ├── repositories/
│   │   │   └── orderRepository.ts
│   │   ├── validators/
│   │   └── types/
│   └── package.json
│
├── infra/
│   ├── template.yaml
│   └── README.md
│
└── README.md
```

---

## 10. Implementation plan

## Phase 1 — Prepare project

### Tasks

- Create Git repository.
- Create frontend app using Vite + React + TypeScript.
- Create backend folder using Node.js + TypeScript.
- Define shared order types.
- Define static menu constants.

### Output

- Frontend runs locally.
- Backend code structure ready.
- Menu data available in code.

### Pros

- Nhanh, dễ bắt đầu.
- Chưa phụ thuộc AWS ngay từ đầu.

### Cons

- Chưa có backend thật.

---

## Phase 2 — Build frontend order flow

### Tasks

- Build order wizard UI.
- Validate table number and phone number.
- Allow user to choose base, protein, topping, sauce, drink.
- Build order summary before submit.
- Use mock API first.

### Output

- User có thể hoàn tất order flow trên UI.

### Notes

Phone number chỉ nên validate basic format, không cần OTP để tránh phức tạp.

---

## Phase 3 — Build Lambda API locally

### Tasks

- Implement routes:
  - `POST /orders`
  - `GET /orders/{orderId}`
  - `GET /orders`
  - `PATCH /orders/{orderId}/status`
  - `PATCH /orders/{orderId}/payment`
- Implement validation.
- Implement response format.

### Output

- Backend có thể test bằng Postman/curl.

### Pros

- Backend logic rõ trước khi deploy AWS.

### Cons

- Cần setup local test hoặc dùng AWS SAM nếu muốn giống môi trường AWS.

---

## Phase 4 — Create AWS resources

### AWS resources

1. DynamoDB table: `PokesaigonOrders`
2. Lambda function: `ipos-order-api-handler`
3. API Gateway HTTP API
4. IAM role cho Lambda truy cập DynamoDB
5. CloudWatch Logs mặc định cho Lambda

### Output

- Có API endpoint thật từ AWS.
- Lambda có thể ghi/read DynamoDB.

### IAM permission tối thiểu

Lambda cần:

```txt
dynamodb:PutItem
dynamodb:GetItem
dynamodb:UpdateItem
dynamodb:Scan
dynamodb:Query
```

Nên giới hạn quyền theo ARN của table `PokesaigonOrders`.

---

## Phase 5 — Connect frontend to AWS API

### Tasks

- Add environment variable:

```txt
VITE_API_BASE_URL=https://{api-id}.execute-api.{region}.amazonaws.com/dev
```

- Replace mock API bằng real API.
- Test create order.
- Test kitchen board.
- Test cashier payment.

### Output

- Full flow hoạt động end-to-end.

---

## Phase 6 — Optional SNS notification

### Tasks

- Create SNS topic: `PokesaigonNewOrderTopic`.
- Subscribe kitchen email.
- In Lambda `createOrder`, publish message to SNS.
- Optional: publish message when order status becomes `READY`.

### Message example

```txt
New order: ORD-20260517-0001
Table: A01
Items: Salmon poke bowl, brown rice, spicy mayo
Status: PENDING
```

### Recommendation

Dùng SNS Email cho demo. Không bắt buộc dùng SMS thật để tránh chi phí.

---

## Phase 7 — Optional S3

### Option 1: Host frontend

- Build frontend:

```bash
npm run build
```

- Upload `dist/` to S3 bucket.
- Enable static website hosting.

### Option 2: Save receipt JSON

Khi order được tạo, Lambda ghi thêm file receipt vào S3:

```txt
receipts/ORD-20260517-0001.json
```

Recommendation: nếu cần thêm service đơn giản để trình bày, chọn S3 receipt export dễ hơn static hosting.

---

## 11. Menu constants đề xuất

```ts
export const POKE_MENU = {
  bases: [
    { id: 'white_rice', name: 'Cơm trắng', price: 0 },
    { id: 'brown_rice', name: 'Gạo lức', price: 5000 },
    { id: 'quinoa', name: 'Quinoa', price: 15000 },
    { id: 'half_rice_salad', name: '1/2 cơm + salad', price: 10000 }
  ],
  proteins: [
    { id: 'salmon', name: 'Salmon', price: 45000 },
    { id: 'tuna', name: 'Tuna', price: 40000 }
  ],
  toppings: [
    { id: 'avocado', name: 'Avocado', price: 15000 },
    { id: 'corn', name: 'Corn', price: 5000 },
    { id: 'seaweed', name: 'Seaweed', price: 5000 },
    { id: 'edamame', name: 'Edamame', price: 10000 }
  ],
  sauces: [
    { id: 'spicy_mayo', name: 'Spicy Mayo', price: 0 },
    { id: 'soy_sauce', name: 'Soy Sauce', price: 0 },
    { id: 'sesame', name: 'Sesame Sauce', price: 0 }
  ],
  drinks: [
    { id: 'water', name: 'Water', price: 10000 },
    { id: 'coke', name: 'Coke', price: 15000 },
    { id: 'tea', name: 'Tea', price: 12000 }
  ]
};
```

---

## 12. Validation rules

### Create order

Required fields:

- `tableNumber`
- `customerPhone`
- `items`
- `items[].base`
- `items[].protein`
- `items[].sauce`

Rules:

- `customerPhone` must be 9-11 digits.
- `items` must not be empty.
- `quantity` must be greater than 0.
- `status` is created by backend, not frontend.
- `totalAmount` is calculated by backend, not frontend.

Reason:

Frontend price can be modified by user, so backend must be source of truth for price calculation.

---

## 13. Error handling

Response format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "customerPhone is required"
  }
}
```

Common errors:

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | Request data invalid |
| `ORDER_NOT_FOUND` | Order does not exist |
| `INVALID_STATUS` | Status transition invalid |
| `INTERNAL_SERVER_ERROR` | Unexpected error |

---

## 14. Status transition rules

```txt
PENDING -> PREPARING
PREPARING -> READY
READY -> PAID
PENDING -> CANCELLED
PREPARING -> CANCELLED
```

Do not allow:

```txt
PAID -> PENDING
READY -> PENDING
CANCELLED -> PREPARING
```

Reason:

Tránh sai logic nghiệp vụ và tránh kitchen/cashier update nhầm trạng thái.

---

## 15. Security notes

For demo:

- Enable CORS only for frontend domain or localhost.
- Do not expose AWS credentials in frontend.
- Frontend only calls API Gateway URL.
- Lambda role should only access required DynamoDB table.
- Do not store sensitive customer data except phone number needed for order status.

For production later:

- Add authentication for kitchen/cashier.
- Add Cognito or staff login.
- Add rate limit.
- Add API key or authorizer.
- Mask customer phone number in UI.

---

## 16. Testing checklist

### Frontend

- Can select base.
- Can select salmon/tuna.
- Can select multiple toppings.
- Can select sauce and drink.
- Cannot submit without table number.
- Cannot submit without phone number.
- Shows order summary.
- Shows success screen after submit.

### Backend

- `POST /orders` creates order.
- `GET /orders/{orderId}` returns order.
- `GET /orders?status=PENDING` returns pending orders.
- `PATCH /orders/{orderId}/status` updates status.
- `PATCH /orders/{orderId}/payment` marks paid.
- Invalid status returns error.

### AWS

- Lambda logs appear in CloudWatch.
- DynamoDB has new order item.
- API Gateway endpoint works from frontend.
- CORS works.
- Optional SNS email receives message.

---

## 17. Minimum demo success criteria

Demo được xem là hoàn thành nếu:

1. User tạo order thành công từ frontend.
2. Order được lưu trong DynamoDB.
3. Kitchen page thấy order mới.
4. Kitchen đổi trạng thái order được.
5. Cashier thấy order và mark as paid được.
6. CloudWatch có log request của Lambda.

Optional:

7. Kitchen nhận SNS email khi có order mới.
8. Receipt JSON được lưu vào S3.

---

## 18. Suggested AI coding agent instruction

Use this section as the prompt for an AI coding agent.

```txt
Build an iPOS Pokesaigon order application with React + TypeScript frontend and AWS serverless backend.

Main features:
1. Customer/staff can create a poke bowl order.
2. Order flow includes table number, customer phone, base, protein, toppings, sauce, drink, quantity, and note.
3. Backend calculates total price and saves order.
4. Kitchen page lists PENDING/PREPARING orders and can update status.
5. Cashier page can search/view order and mark it as PAID.

AWS architecture:
- Amazon API Gateway for HTTP API.
- AWS Lambda Node.js TypeScript function for backend logic.
- Amazon DynamoDB table PokesaigonOrders for persistence.
- Optional Amazon SNS email notification when a new order is created.
- Optional Amazon S3 receipt export.

Implementation requirements:
- Do not expose AWS credentials in frontend.
- Frontend must call API Gateway only.
- Backend must validate request body.
- Backend must calculate totalAmount from trusted menu constants.
- Use clear order status transition rules.
- Add CloudWatch logs for create order and update status.
- Keep code simple and suitable for a student demo project.
```

---

## 19. Recommended final scope for approval

Final recommended scope:

```txt
Frontend: React + TypeScript + Vite
Backend: AWS Lambda + API Gateway
Database: DynamoDB
Monitoring: CloudWatch Logs
Optional notification: SNS Email
```

Do not implement real SMS in first version. Store customer phone number and show order status in UI. Add SNS SMS only after the core demo is stable.

---

## 20. References

- AWS Lambda free tier includes 1 million requests per month and 400,000 GB-seconds of compute time per month.
- Amazon API Gateway free tier includes 1 million API calls per month for REST APIs and HTTP APIs for up to 12 months.
- Amazon DynamoDB free tier includes free storage/capacity allowances suitable for small demo workloads.
- Amazon SNS supports SMS to many countries, but SMS is pay-as-you-go and should be treated as optional for this demo.
