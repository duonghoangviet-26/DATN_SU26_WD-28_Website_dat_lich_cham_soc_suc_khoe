# PROMPT 17 — Báo cáo sửa nền tảng Route/Layout/Phân quyền nurse

> Ngày: 2026-07-18 · Nhánh `Bac_si`. Phạm vi: chỉ nền tảng (route, layout, sidebar, guard, danh tính, điều hướng).

## Kết luận: nền tảng ĐÃ ĐÚNG SẴN — chỉ 1 sửa type tối thiểu

Sau khi kiểm chứng từng phần, **7/8 hạng mục nền tảng đã đúng, không cần sửa**. Chỉ có **1 khiếm khuyết type thật** cần sửa.

### Kiểm chứng (không sửa)
| Hạng mục | Hiện trạng | Bằng chứng |
|---|---|---|
| Nurse routes | ✅ `/nurse` bọc `ProtectedRoute roles={['nurse']}` + `NurseLayout` | `AppRoutes.tsx:146-158` |
| Nurse layout | ✅ Sidebar+Header+Outlet | `NurseLayout.tsx` |
| Sidebar/menu | ✅ Render `nurseMenu`, active state | `NurseSidebar.tsx`, `nurseMenu.ts` |
| Route guard | ✅ loading→spinner; chưa login→`/login` (giữ `from`); sai role→trang "Không có quyền" | `ProtectedRoute.tsx` |
| Danh tính nurse (BE) | ✅ `req.user.id` từ token; **0 chỗ** lấy nurseId từ body/query | grep `req.body/query.nurse*` = 0 match |
| Danh tính nurse (FE) | ✅ `useAuth().user` | `NurseHeader.tsx` |
| Điều hướng sau đăng nhập | ✅ nurse→`/nurse` (tôn trọng `from`) | `Login.tsx:31-32` |
| Điều hướng thiếu quyền | ✅ sai role→trang chặn; chưa login→`/login` | `ProtectedRoute.tsx:23-46` |
| Backend bảo vệ quyền | ✅ `verifyToken`+`requireRole('nurse')` cho **toàn bộ** `/api/nurse/*` | `routes/nurse/index.js:15` |

### Sửa (1 file, tối thiểu)
**Vấn đề:** `type Role` thiếu `"nurse"` → `Login.tsx:31` (so sánh `role==='nurse'` báo TS2367 "no overlap") và `AppRoutes.tsx:149` (`roles={['nurse']}` TS2322 "not assignable"). Runtime vẫn chạy nhưng type-check gãy ở đúng phân quyền nurse.

**Căn cứ (không bịa cấu trúc):** backend `NguoiDung.role` enum = `['user, patient, doctor, admin, receptionist, nurse']` — FE type thiếu `nurse`.

| File sửa | Thay đổi | Lý do |
|---|---|---|
| `frontend/src/types/index.ts:4` | `Role` thêm `| "nurse"` | Khớp enum backend; sửa 2 lỗi type nền tảng nurse |

```diff
- export type Role = "user" | "doctor" | "admin" | "receptionist";
+ export type Role = "user" | "doctor" | "admin" | "receptionist" | "nurse";
```

## Kết quả kiểm thử

| Kiểm thử | Trước | Sau |
|---|---|---|
| type-check (`tsc --noEmit`) | 112 lỗi / 5 file | **110 lỗi / 3 file** — 2 lỗi nền tảng nurse (Login, AppRoutes) đã hết; **không phát sinh lỗi mới** |
| build (`vite build`) | — | ✅ **Thành công** (1158 module; chỉ cảnh báo chunk >500kB) |
| Truy cập theo role (BE) | — | Xác minh tĩnh: không token→401; role≠nurse→403; role=nurse→OK (`requireRole`) |
| Truy cập theo role (FE) | — | Xác minh tĩnh: chưa login→`/login`; sai role→trang chặn; nurse→render |
| URL trực tiếp | — | Xác minh tĩnh: `/nurse/*` qua `ProtectedRoute` trước; chi tiết còn gate ownership ở BE (404 nếu không thuộc) |

**110 lỗi type còn lại:** ở `mock/doctor-appointments.ts` (32), `client/Profile.tsx` (2), `types/index.ts` phần HoaDon/thanh toán (76) — **đều có sẵn từ trước, ngoài phạm vi nurse, KHÔNG sửa** theo ràng buộc.

## API / Database ảnh hưởng
- **API:** không đổi (không sửa controller/route).
- **Database:** không đụng.
- **Logic lịch hẹn / hồ sơ khám:** không đụng.
- **Admin/doctor/patient UI:** không đụng.

## Rủi ro
- **Rất thấp.** Chỉ mở rộng union type để khớp backend. Đã xác minh không phát sinh lỗi type mới (không có switch exhaustive nào trên `Role` bị gãy). Build xanh.
- Không refactor auth; tương thích mọi role khác giữ nguyên.

## Vấn đề còn tồn (ghi nhận, không sửa trong bước này)
- `Role` vẫn thiếu `"patient"` (backend enum có) — không gây lỗi FE hiện tại; để bước sau nếu cần.
- 110 lỗi type sẵn có ở mock/Profile/types (ngoài phạm vi nurse).
- Nền tảng đã sẵn sàng cho **Bước 3 (scope theo CA)** và **Bước 4 (decouple createDraft)**.
