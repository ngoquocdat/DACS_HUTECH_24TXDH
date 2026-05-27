# DACS_HUTECH_24TXDH

## Mô tả dự án

Đây là bản demo hệ thống iPOS Pokesaigon dành cho nhà hàng poke bowl. Dự án bao gồm backend serverless chạy trên AWS Lambda và frontend web React/Vite, mô phỏng quy trình từ đặt order, bếp xử lý đến thu ngân xác nhận thanh toán.

Các tính năng của demo :

- Cung cấp giao diện đặt order cho khách hàng với việc chọn base, protein, toppings, số lượng và nước uống theo từng bước.
- Xây dựng bảng điều khiển Kitchen để bếp theo dõi order đang chờ và cập nhật trạng thái.
- Xây dựng trang Cashier để nhân viên thu ngân tìm order, kiểm tra trạng thái và ghi nhận thanh toán.
- Triển khai backend serverless với AWS Lambda và DynamoDB để lưu trữ order, kèm OpenAPI/Swagger phục vụ kiểm thử.

## Các kỹ thuật và ngôn ngữ sử dụng

### Frontend

- React 18
- Vite
- TypeScript
- React Router DOM
- CSS tùy chỉnh

Các trang frontend chính :

- `OrderPage.tsx`: giao diện đặt order theo từng bước.
- `KitchenPage.tsx`: dashboard bếp tự động làm mới và cập nhật trạng thái order.
- `CashierPage.tsx`: tìm order theo số bàn hoặc số điện thoại và xác nhận thanh toán.

### Backend

- Node.js / TypeScript
- AWS Lambda
- AWS SDK v3
- DynamoDB (qua `@aws-sdk/lib-dynamodb`)
- SNS (tùy chọn để gửi thông báo khi order mới được tạo)
- OpenAPI / Swagger UI cho tài liệu API local

Các thành phần backend :

- `handler.ts`: xử lý routing cho các endpoint REST API order.
- `services/orderService.ts`: nghiệp vụ tạo order, tính giá và cập nhật trạng thái.
- `repositories/orderRepository.ts`: tương tác với DynamoDB để lưu và truy vấn order.
- `validators/orderValidator.ts`: xác thực dữ liệu đầu vào.
- `local-server.ts`: server local để chạy handler Lambda và cung cấp Swagger UI.

### Cấu trúc triển khai

- `ipos-pokesaigon/backend`: mã nguồn backend Lambda và server local.
- `ipos-pokesaigon/frontend`: ứng dụng web React/Vite.
- `ipos-pokesaigon/infra`: cấu hình SAM/AWS để triển khai serverless.

## Tính năng nổi bật

- Quản lý quy trình order với các trạng thái: `PENDING`, `PREPARING`, `READY`, `PAID`, `CANCELLED`.
- Tính tổng tiền bên backend dựa trên menu chuẩn, tránh phụ thuộc vào dữ liệu giá từ frontend.
- Server local hỗ trợ Swagger UI và API docs.
- Tìm order cho thu ngân theo số bàn hoặc số điện thoại.
- Dashboard bếp tự động làm mới để cập nhật order mới liên tục.
