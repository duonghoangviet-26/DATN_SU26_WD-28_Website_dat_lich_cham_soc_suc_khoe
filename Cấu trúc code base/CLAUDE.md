# CLAUDE.md — Đồ Án Sinh Viên

> File này được Claude Code đọc tự động khi khởi động.
> Cập nhật khi tech stack hoặc convention thay đổi.

---

## 🎯 Thông tin Dự án

**Tên dự án:** [Điền tên dự án]
**Đề tài:** [Điền đề tài — ví dụ: Website bán hàng / Quản lý đặt lịch / ...]
**Môn học:** [Tên môn]
**Nhóm:** [Tên nhóm / MSSV]
**Deadline:** [Ngày tháng]

---

## 🛠️ Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js 20 + Express 4 |
| Database | MongoDB + Mongoose |
| Authentication | JWT — expire 7 ngày, lưu localStorage |
| File Upload | Cloudinary |
| Frontend Deploy | Vercel |
| Backend Deploy | Render |

---

## 📁 Cấu trúc Thư mục

```
project-root/
├── backend/
│   └── src/
│       ├── config/         ← DB config, cloudinary
│       ├── models/         ← Mongoose schemas
│       ├── controllers/    ← Business logic (không viết logic trong route)
│       ├── routes/         ← Express routes (thin layer)
│       ├── middlewares/    ← verifyToken, requireRole, upload
│       ├── services/       ← External services (Cloudinary, email...)
│       ├── utils/          ← Helper functions, response formatter
│       ├── app.js
│       └── index.js
└── frontend/
    └── src/
        ├── assets/
        ├── components/
        │   ├── admin/      ← Components chỉ dùng trong admin
        │   ├── client/     ← Components chỉ dùng trong client
        │   └── common/     ← Components dùng chung
        ├── layouts/
        │   ├── AdminLayout.jsx
        │   ├── ClientLayout.jsx
        │   └── AuthLayout.jsx
        ├── pages/
        │   ├── admin/      ← Dashboard, ManageUsers, ManageProducts...
        │   ├── client/     ← Home, ProductList, Cart, Profile...
        │   └── auth/       ← Login, Register
        ├── routes/
        │   ├── AppRoutes.jsx
        │   └── ProtectedRoute.jsx
        ├── services/       ← axiosInstance.js + [module].service.js
        ├── context/        ← AuthContext, CartContext
        ├── hooks/          ← Custom hooks
        └── utils/          ← formatDate, formatPrice...
```

---

## ⚙️ API Conventions

- **Base URL:** `http://localhost:5000/api`
- **Auth Header:** `Authorization: Bearer <token>`
- **Admin Routes:** `/api/admin/*` — yêu cầu role = `"admin"`
- **Response Format:**
  ```json
  { "success": true,  "message": "Thành công", "data": { ... } }
  { "success": false, "message": "Mô tả lỗi cụ thể" }
  ```
- **HTTP Status Codes:** 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Server Error

---

## 📝 Code Conventions

### Đặt tên
- **File:** `camelCase.js` (userController.js, authMiddleware.js)
- **React Component file:** `PascalCase.jsx` (UserCard.jsx, ProductList.jsx)
- **Biến / hàm:** `camelCase` (getUserById, formatPrice)
- **Hằng số:** `UPPER_SNAKE_CASE` (JWT_SECRET, MAX_FILE_SIZE)
- **Route API:** `kebab-case` (/api/product-categories, /api/order-items)

### Code style
- **Async:** Dùng `async/await`, KHÔNG dùng callback
- **Error handling:** Mọi controller phải có `try/catch`
- **Logic:** KHÔNG viết business logic trong route file — chuyển vào controller
- **Comment:** Tiếng Việt cho logic phức tạp, tiếng Anh cho docstring
- **Import:** Absolute imports từ `src/` (dùng alias `@/`)

---

## 🔐 Security Rules

- KHÔNG hardcode password/secret trong code
- KHÔNG commit file `.env` (đã có trong `.gitignore`)
- KHÔNG lưu password dạng plain text (dùng bcrypt)
- Middleware `verifyToken` phải đặt trước `requireRole`
- Validate input ở cả frontend (UX) VÀ backend (security)

---

## 🌿 Git Workflow

- **Branch:** `feature/[tên-tính-năng]` hoặc `fix/[tên-bug]`
- **Commit format:** Conventional Commits
  - `feat: thêm tính năng X`
  - `fix: sửa lỗi Y`
  - `docs: cập nhật README`
  - `refactor: tái cấu trúc Z`
- **Không** push thẳng lên `main`
- **Không** commit `node_modules/`, `.env`, `.DS_Store`

---

## 🤖 AG Kit — Hướng dẫn nhanh

Dự án này tích hợp AG Kit. Khi bắt đầu:

1. **Đọc context:** `.agents/memory/` để hiểu dự án
2. **Dùng agent phù hợp:**
   - Viết API → `backend-specialist`
   - Viết React UI → `frontend-specialist`
   - Debug khó → `debugger`
   - Thiết kế DB → `database-architect`
   - Lên kế hoạch → `project-planner`
3. **Dùng workflow:**
   - `/plan [tính năng]` — trước khi code
   - `/debug [mô tả bug]` — khi gặp lỗi
   - `/verify` — trước khi commit
   - `/remember [quyết định]` — lưu context

Xem đầy đủ: `.agents/ARCHITECTURE.md`
