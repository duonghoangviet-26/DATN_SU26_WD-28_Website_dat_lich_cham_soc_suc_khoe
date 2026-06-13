# VitaFamily — Backend (API)

Máy chủ API cho hệ thống VitaFamily. **Node.js + Express**.

> ⚠️ Giai đoạn hiện tại: backend mới là **khung mẫu (skeleton)**, chưa kết nối database.
> Nhóm đang tập trung làm giao diện Admin với dữ liệu fix cứng ở frontend.
> Khi giao diện xong sẽ gắn **MongoDB** vào (xem `src/config/db.js`).

## Chạy thử

```bash
cd backend
npm install
cp .env.example .env      # rồi sửa lại giá trị trong .env
npm run dev               # chạy ở http://localhost:5000
```

Kiểm tra: mở http://localhost:5000 — phải thấy `VitaFamily API đang chạy 🚀`.

## Cấu trúc thư mục

```
backend/src/
├── config/         ← Kết nối DB, cấu hình ngoài (db.js)
├── models/         ← Schema dữ liệu (thêm khi gắn Mongo)
├── controllers/    ← Xử lý nghiệp vụ (auth.controller.js là MẪU)
├── routes/         ← Khai báo endpoint (lớp mỏng, gom ở index.js)
├── middlewares/    ← verifyToken, requireRole (auth.middleware.js là MẪU)
├── services/       ← Gọi dịch vụ ngoài (email, FCM, Gemini)
├── utils/          ← Hàm dùng chung (response.js)
├── app.js          ← Cấu hình Express
└── index.js        ← Điểm khởi chạy
```

## Quy ước

- Định dạng response: `{ success, message, data }` — dùng `utils/response.js`.
- Controller luôn `try/catch`, không viết logic trong file route.
- `verifyToken` đặt trước `requireRole`.
- Không commit file `.env`.
