# Bug fix — Dashboard bác sĩ trắng trang khi ca làm việc đã gán y tá

> Ngày: 2026-07-20 · Nhánh `Bac_si` · Debug theo systematic-debugging.

## 1. Triệu chứng
Đăng nhập tài khoản **bác sĩ** → vào `/doctor` (Dashboard) → **trắng trang / crash** (lỗi JavaScript runtime).

## 2. Root cause
Mismatch kiểu dữ liệu giữa backend và frontend ở trường `y_ta_ho_tro`:

- Backend `GET /api/doctor/stats/today` (`stats.controller.js` → `getTodayOverview`) trả:
  ```js
  y_ta_ho_tro: schedule?.nurse_id ? { id, ho_ten } : null   // OBJECT hoặc null
  ```
- Frontend `DoctorDashboard.tsx` (dòng 143) render trực tiếp:
  ```jsx
  {overview!.y_ta_ho_tro ?? 'Chưa phân công y tá'}
  ```
  Type khai báo `y_ta_ho_tro: string | null` (comment cũ ghi "luôn null ở giai đoạn hiện tại").

Khi ca hôm nay **đã được gán y tá**, `y_ta_ho_tro` là **object** → React cố render object làm child → ném *"Objects are not valid as a React child (found: object with keys {id, ho_ten})"* → trắng trang.

**Vì sao mới lộ:** trước đây chưa ca nào gán y tá nên `y_ta_ho_tro` **luôn null** (render fallback, không crash). Khi gán y tá "Điều dưỡng Thanh Hà" vào ca hôm nay của BS Khang (TEST) (bộ dữ liệu demo luồng y tá↔bác sĩ), điều kiện object lần đầu xảy ra → bug lộ. Frontend chưa từng được test với ca có y tá thật.

## 3. Fix (frontend — cho khớp contract giàu hơn của backend)
`frontend/src/types/index.ts`:
```ts
y_ta_ho_tro: { id: string; ho_ten: string } | null;   // trước: string | null
```
`frontend/src/pages/doctor/DoctorDashboard.tsx` (dòng 143):
```jsx
{overview!.y_ta_ho_tro?.ho_ten ?? 'Chưa phân công y tá'}
```

## 4. Verify
- Reproduce ở mức biên dịch: sau khi sửa type, `tsc --noEmit` báo đúng dòng 143 `Type 'string | { id, ho_ten }' is not assignable to type 'ReactNode'` — chứng minh chỗ render object.
- Sau khi sửa component → lỗi ở `DoctorDashboard.tsx` **hết**. Dashboard render tên y tá "Điều dưỡng Thanh Hà".

## 5. Ghi nhận ngoài phạm vi (không sửa)
`tsc` còn ~110 lỗi type CÓ SẴN ở `src/mock/doctor-appointments.ts`, `src/pages/client/Profile.tsx`, `src/types/index.ts` (duplicate identifier). Không liên quan crash này, không chặn runtime (Vite/esbuild không typecheck). Để lại xử lý riêng nếu cần.
