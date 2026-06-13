# CLAUDE.md — VitaFamily

> File này được Claude Code đọc **tự động** mỗi khi khởi động.
> Cập nhật khi có thay đổi lớn về stack, cấu trúc hoặc convention.

---

## 🎯 Dự án

| | |
|---|---|
| **Tên** | VitaFamily |
| **Đề tài** | Website quản lý chăm sóc sức khỏe gia đình |
| **Nhóm** | 4 thành viên — DATN_SU26_WD-28 |
| **Phiên bản** | 1.0 |

**Mô tả ngắn:** Bệnh nhân đặt lịch khám online, quản lý hồ sơ y tế và nhắc uống thuốc cho cả gia đình trong một tài khoản. 3 vai trò: Bệnh nhân · Bác sĩ (cần admin duyệt) · Admin.

---

## 🛠️ Tech Stack

| Layer | Công nghệ |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS (code JS/JSX) |
| Backend | Node.js + Express 4 |
| Database | MongoDB (gắn sau — xem phần Giai đoạn bên dưới) |
| Auth | JWT — expire 7 ngày, lưu localStorage |
| Email | Nodemailer + Gmail (OTP, xác nhận lịch hẹn, nhắc thuốc) |
| Push Notification | Firebase FCM |
| Nhắc tự động | node-cron |
| AI Chatbot | Google Gemini |
| Deploy | Vercel (FE) + Render (BE) |

---

## ⚡ Giai đoạn phát triển hiện tại

> **Frontend-first với mock data.**
> Nhóm đang hoàn thiện giao diện Admin chi tiết trước khi gắn database.

```
Bây giờ:  Page → service → mock data (src/mock/*.js)
Sau này:  Page → service → axios → MongoDB API
```

Khi gắn MongoDB: chỉ đổi phần thân hàm trong `frontend/src/services/*.service.js`, UI giữ nguyên.

---

## 📁 Cấu trúc thư mục

```
DATN_SU26_WD-28_ViteFamily/
├── CLAUDE.md                ← File này
├── docs/                    ← Tài liệu AI-readable (đọc để hiểu chi tiết)
│   ├── README.md            ← Bản đồ tài liệu
│   ├── features.md          ← 20 chức năng (A1–A7, B1–B5, C1–C8)
│   └── database.md          ← 27 bảng schema tóm tắt
├── Tài liệu dự án/          ← Tài liệu gốc (PDF + SQL — nguồn chính xác nhất)
│   ├── Đặc tả/              ← Dac_Ta_Du_An_VitaFamily.md
│   ├── Chức Năng Chính/     ← Chi tiết từng chức năng (PDF)
│   └── Cơ sở dữ liệu/      ← VitaFamily_Database.sql (MySQL schema gốc)
├── frontend/src/
│   ├── mock/                ← Dữ liệu fix cứng (xóa khi có DB thật)
│   ├── services/            ← axiosInstance + *.service.js (chỗ duy nhất chạm data)
│   ├── layouts/             ← AdminLayout, ClientLayout, AuthLayout
│   ├── pages/admin/         ← ManageUsers.jsx là trang MẪU để copy
│   ├── pages/client/        ← Giao diện bệnh nhân
│   ├── pages/auth/          ← Login, Register
│   ├── components/admin/    ← Sidebar, AdminHeader, icons
│   ├── components/common/   ← Badge, ConfirmDialog, PageHeader
│   ├── context/             ← AuthContext
│   ├── routes/              ← AppRoutes, ProtectedRoute, adminMenu.js
│   └── utils/               ← constants.js, format.js
└── backend/src/
    ├── config/db.js         ← Kết nối MongoDB (chờ gắn)
    ├── models/              ← Schema Mongoose (chờ gắn)
    ├── controllers/         ← Business logic (auth.controller.js là MẪU)
    ├── routes/              ← Endpoints (thin layer)
    ├── middlewares/         ← verifyToken, requireRole
    ├── services/            ← Email, FCM, Gemini...
    └── utils/response.js    ← Trả response chuẩn { success, message, data }
```

---

## 👥 Vai trò người dùng

| Role | Mô tả | Trang |
|---|---|---|
| `user` | Bệnh nhân — đăng ký tự do | `/` (client) |
| `doctor` | Bác sĩ — cần Admin duyệt | `/` (client) |
| `admin` | Quản trị viên — tạo sẵn | `/admin` |

---

## 🗺️ Menu Admin (8 chức năng C1–C8)

| Route | Trang | Chức năng |
|---|---|---|
| `/admin` | Dashboard | Tổng quan số liệu |
| `/admin/users` | ManageUsers ✅ | C1 — Quản lý người dùng |
| `/admin/doctors` | Placeholder | C2 — Duyệt hồ sơ bác sĩ |
| `/admin/hospitals` | Placeholder | C3 — Bệnh viện & Chuyên khoa |
| `/admin/services` | Placeholder | C4 — Quản lý dịch vụ |
| `/admin/appointments` | Placeholder | C5 — Lịch hẹn hệ thống |
| `/admin/reviews` | Placeholder | C6 — Đánh giá & phản hồi |
| `/admin/notifications` | Placeholder | C7 — Thông báo hệ thống |
| `/admin/payments` | Placeholder | C8 — Quản lý thanh toán |

✅ = đã hoàn chỉnh với mock data

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

---

## 📝 Code Conventions

### Đặt tên
| Loại | Convention | Ví dụ |
|---|---|---|
| File backend | `camelCase.js` | `userController.js` |
| File frontend component | `PascalCase.jsx` | `UserCard.jsx` |
| Biến / hàm | `camelCase` | `getUserById` |
| Hằng số | `UPPER_SNAKE` | `JWT_SECRET` |
| Route API | `kebab-case` | `/api/doctor-profiles` |
| Trường dữ liệu | tiếng Việt (khớp DB) | `ho_ten`, `mat_khau` |

### Quy tắc code
- **Async/Await** — không dùng callback
- **try/catch** trong mọi controller
- **Không viết logic trong route** — chuyển vào controller
- **Comment tiếng Việt** cho logic phức tạp

---

## 🔐 Bảo mật

- Không hardcode password/secret trong code
- Không commit file `.env`
- Mật khẩu hash bằng **bcrypt** (không lưu plaintext)
- `verifyToken` đặt **trước** `requireRole`
- Validate input ở cả FE (UX) và BE (security)

---

## 🌿 Git Workflow

- Branch: `feature/[tên-tính-năng]` hoặc `fix/[tên-bug]`
- Commit: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- Không push thẳng lên `main`
- Không commit `node_modules/`, `.env`

---

## 📖 Đọc thêm

- `docs/features.md` — chi tiết 20 chức năng
- `docs/database.md` — 27 bảng schema
- `Tài liệu dự án/Đặc tả/Dac_Ta_Du_An_VitaFamily.md` — đặc tả gốc đầy đủ
- `frontend/README.md` — cách làm trang Admin mới
- `backend/README.md` — hướng dẫn backend
