# Audit — Route & Phân quyền trang Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ route/page/component liên quan `/doctor`. Không sửa route admin/patient/nurse, không đổi cấu trúc route toàn dự án.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1. Route hiện có cho bác sĩ

**Frontend** — `frontend/src/routes/AppRoutes.tsx` (dòng 76–89)

| Path | Component | Ghi chú |
|---|---|---|
| `/doctor` (index) | `DoctorDashboard` | |
| `/doctor/appointments` | `DoctorAppointments` | |
| `/doctor/schedule` | `DoctorSchedule` | số ít, không phải `/schedules` |
| `/doctor/profile` | `DoctorProfile` | |

Chưa có: `/doctor/appointments/:id`, `/doctor/medical-records/pending`, `/doctor/leave-requests`.

**Backend API** — `backend/src/routes/doctor/*`, mount tại `/api/doctor`, gate ở đầu `routes/doctor/index.js`: `router.use(verifyToken, requireRole('doctor'))` (áp dụng mọi route con).

| Path | File |
|---|---|
| `GET/PUT /api/doctor/profile` | `profile.routes.js` |
| `GET /api/doctor/schedule`, `PATCH /:scheduleId/slots/:slotId`, `POST .../request-cancel` | `schedule.routes.js` |
| `GET /api/doctor/appointments`, `GET/PATCH /:id`, `PATCH /:id/confirm`, `/cancel`, `/complete`, `GET/POST/PUT /:id/result` | `appointments.routes.js` |
| `GET /api/doctor/stats`, `GET /api/doctor/stats/reviews` | `stats.routes.js` |

---

## 2. Sau khi đăng nhập, bác sĩ đi vào trang nào

`frontend/src/pages/auth/Login.tsx` dòng 24–30:
```js
if (user.role === 'admin')       navigate(from?.startsWith('/admin')  ? from : '/admin',  { replace: true })
else if (user.role === 'doctor') navigate(from?.startsWith('/doctor') ? from : '/doctor', { replace: true })
else                              navigate(from || '/', { replace: true })
```
Bác sĩ đăng nhập → vào `/doctor` (`DoctorDashboard`) — đúng. Có kiểm tra `from.startsWith('/doctor')` nên không bị redirect nhầm path role khác dù có `state.from`.

⚠️ Lưu ý nhỏ (chỉ nêu, chưa sửa): nhánh `else` (role khác admin/doctor, dòng 29) dùng thẳng `from || '/'`, **không** kiểm tra `from.startsWith(...)`. Nếu patient bị điều hướng tới `/login` từ `/doctor/...`, sau đăng nhập UI sẽ thử `navigate('/doctor/...')` trước khi `ProtectedRoute` chặn và hiện màn "Không có quyền truy cập". Không lộ dữ liệu, chỉ là nhịp điều hướng thừa.

---

## 3. Role guard cho bác sĩ — có, 2 lớp độc lập

**Frontend** — `frontend/src/routes/ProtectedRoute.tsx`: bọc `/doctor` bằng `<ProtectedRoute roles={['doctor']}>`.
- Chưa đăng nhập → `Navigate to="/login"`.
- Sai role → render màn "Không có quyền truy cập" (không redirect ngầm, không lộ layout).
- Đây là guard **UI**, dựa vào `user.role` đọc từ `localStorage` (`AuthContext.tsx`) — về lý thuyết sửa được ở client.

**Backend** — `backend/src/middlewares/auth.middleware.js`:
- `verifyToken`: giải mã JWT, gán `req.user = decoded` (không tin body/localStorage).
- `requireRole('doctor')`: so `req.user.role` (từ token) với danh sách cho phép, trả `403` nếu sai.
- Đây là ranh giới bảo mật thật, độc lập với frontend.

→ Kết luận: dù sửa `localStorage.user.role` để lách `ProtectedRoute`, mọi gọi API `/api/doctor/*` vẫn bị backend chặn 403 vì JWT payload không đổi được từ client. **Guard đang đúng chuẩn.**

---

## 4. Bác sĩ có vào nhầm trang admin/patient không

- **Admin** (`/admin/*`): bọc riêng `<ProtectedRoute roles={['admin']}>`. Bác sĩ vào `/admin` → bị chặn màn "Không có quyền truy cập", không có route/layout nào dùng chung giữa `/doctor` và `/admin`. Backend cũng chặn tương tự qua `requireRole('admin')`.
- **Client/patient** (`/`, `/dich-vu/...`): không có role guard — là trang public (chọn dịch vụ/bác sĩ/chuyên khoa), không phải "khu vực riêng patient", nên bác sĩ xem được là bình thường, không phải lỗi phân quyền.
- Trong `AppRoutes.tsx` hiện tại **không thấy route riêng cho tài khoản patient đã đăng nhập** (kiểu `/tai-khoan`, `/lich-hen-cua-toi`) — chỉ nêu để lưu ý, không kiểm tra sâu vì thuộc phần patient, ngoài phạm vi lần này.
- Không có path trùng, không có fallback route nào vô tình khớp cả 2 khu vực.

---

## 5. Đề xuất cấu trúc route (chỉ đề xuất — CHƯA áp dụng)

| Đề xuất | Hiện có? | Ghi chú |
|---|---|---|
| `/doctor` hoặc `/doctor/dashboard` | ✅ (`/doctor` index) | Giữ nguyên. |
| `/doctor/schedules` | ⚠️ đang là `/doctor/schedule` (số ít) | Khác tên gọi, không phải lỗi — có thể giữ nguyên để khỏi đổi FE + convention hiện có. |
| `/doctor/appointments` | ✅ | |
| `/doctor/appointments/:id` | ❌ | Cần nếu muốn trang chi tiết lịch hẹn riêng (deep-link) — hiện là expand-row trong bảng, chưa có URL riêng. |
| `/doctor/medical-records/pending` | ❌ | Phụ thuộc backend có API luồng y tá-nhập/bác-sĩ-xác-nhận trước (xem `Audit - Ra soat trang bac si (2026-07-08).md` mục 3). |
| `/doctor/leave-requests` | ❌ | Phụ thuộc API xin nghỉ tự phục vụ cho bác sĩ (hiện chỉ có API admin tạo hộ). |
| `/doctor/profile` | ✅ | |

Nên thêm 3 route còn thiếu **sau khi** có API backend tương ứng, tránh route trỏ vào trang gọi API chưa tồn tại. Chưa tạo file, chưa sửa `AppRoutes.tsx` hay `doctorMenu.ts`.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ (file, chức năng thiếu, bug `DoctorProfile.tsx`).
