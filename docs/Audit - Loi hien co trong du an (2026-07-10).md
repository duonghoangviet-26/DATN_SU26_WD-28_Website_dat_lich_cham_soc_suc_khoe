# Audit — Lỗi hiện có trong dự án (2026-07-10)

> Chỉ kiểm tra và ghi nhận. **Không sửa code** trong lần audit này — chờ xác nhận của chủ dự án trước khi đụng vào từng lỗi.

## Cách kiểm tra
- Frontend: `npx tsc --noEmit -p tsconfig.json` (toàn bộ project, không giới hạn theo trang bác sĩ).
- Backend: `node --check` trên toàn bộ file `.js` trong `src/` (lỗi cú pháp) + `npm test` (test suite có sẵn `tests/doctor.api.test.js`).

---

## A. Frontend — 40 lỗi TypeScript (`tsc --noEmit`)

### A1. Typo tên type DOM — `Textarea.tsx`
- **File:** `frontend/src/components/common/Textarea.tsx:3,8`
- **Lỗi:** dùng `HTMLTextareaElement` (chữ thường "textarea") — TypeScript không nhận ra, tên đúng là `HTMLTextAreaElement` (chữ hoa "TextArea").
- **Ảnh hưởng:** component dùng chung (`common/`), nên có thể ảnh hưởng nhiều trang có ô nhập textarea.
- **Cách sửa:** đổi `HTMLTextareaElement` → `HTMLTextAreaElement` ở cả 2 vị trí (dòng 3 và dòng 8). Sửa 1-dòng, không đổi logic.

### A2. Mock data lệch type — `mock/doctor-appointments.ts` (18 object, 32 lỗi)
- **File:** `frontend/src/mock/doctor-appointments.ts` (các dòng 13, 24, 37, 48, 60, 71, 82, 94, 105, 116, 129, 141, 153, 165, 177, 189)
- **Lỗi:** field `id` và `benh_nhan_id` trong mock là `number` (`id: 1`, `benh_nhan_id: 1`, …) nhưng type `DoctorAppointmentDetail` (đã có comment sẵn "Mongo ObjectId — backend trả về string, không phải number") khai báo `id: string; benh_nhan_id: string;`.
- **Đã kiểm tra:** grep toàn repo, **không còn nơi nào import `mockDoctorAppointments`** — file này là mock cũ, đã bị bỏ rơi từ khi trang bác sĩ chuyển sang gọi API thật.
- **Cách sửa (2 lựa chọn, cần bạn quyết định):**
  1. Xoá hẳn file (nếu chắc chắn không dùng nữa) — gọn nhất.
  2. Nếu muốn giữ lại làm tài liệu/fallback, đổi toàn bộ `id`/`benh_nhan_id` sang chuỗi (`id: '1'`).

### A3. Field không tồn tại trên `User` — `Booking.tsx`
- **File:** `frontend/src/pages/client/Booking.tsx:149`
- **Lỗi:** code viết `user?._id`, nhưng `interface User` (`types/index.ts:14-26`) chỉ có field `id: string`, không có `_id`.
- **Ảnh hưởng:** dòng này luôn `undefined` lúc runtime (JS không báo lỗi vì optional chaining), fallback về `'mock-user-123'` — nghĩa là **lịch hẹn tạo mới không gắn đúng user thật**, đây là lỗi logic ẩn, không chỉ lỗi type.
- **Cách sửa:** đổi `user?._id` → `user?.id`.

### A4. Module bị thiếu — `@/mock/news` (3 file)
- **File:** `frontend/src/pages/client/Home.tsx:4`, `NewsList.tsx:3`, `NewsDetail.tsx:3`
- **Lỗi:** cả 3 file `import { mockNews } from '@/mock/news'` nhưng `frontend/src/mock/news.ts` (hoặc `.js`) **không tồn tại** trong repo — có thể đã bị xoá nhầm hoặc chưa từng được tạo.
- **Ảnh hưởng:** đây là lỗi nghiêm trọng nhất trong nhóm frontend — 3 trang này sẽ **crash khi build/chạy** (`Cannot find module`), không phải chỉ cảnh báo type.
- **Cách sửa (cần bạn quyết định):**
  1. Tạo lại file `frontend/src/mock/news.ts` với mảng `mockNews` mẫu (nếu tính năng Tin tức đang được làm dở).
  2. Hoặc nếu tính năng Tin tức chưa cần dùng lúc này, tạm ẩn/xoá 3 trang này khỏi route để tránh lỗi build.

### A5. So sánh trạng thái sai — `Profile.tsx`
- **File:** `frontend/src/pages/client/Profile.tsx:238, 247`
- **Lỗi:** code so sánh `app.status === 'approved'`, nhưng enum trạng thái lịch hẹn thật (`LichHen.status`) không có giá trị `'approved'` (chỉ có `pending | confirmed | cancelled | checked_in | in_progress | no_show | completed`). Có vẻ đây là tên cũ trước khi đổi thành `'confirmed'`.
- **Ảnh hưởng:** nhánh `'approved'` **không bao giờ chạy** — lịch hẹn đã được bác sĩ xác nhận (`confirmed`) vẫn hiển thị nhãn "Chờ duyệt" (màu vàng) thay vì "Đã duyệt" (màu xanh) → sai UI, gây hiểu nhầm cho bệnh nhân.
- **Cách sửa:** đổi `'approved'` → `'confirmed'` ở cả 2 dòng (238 và 247).

---

## B. Backend

### B1. Cú pháp (`node --check` toàn bộ `src/`)
- **Kết quả:** không có lỗi cú pháp nào.

### B2. Test suite có sẵn — `npm test` (`tests/doctor.api.test.js`): 8 pass / **3 fail**

**Nguyên nhân gốc (1 lỗi, gây cascade ra 3 test fail):**
- **File:** `backend/tests/doctor.api.test.js:62-68`
- Test hard-code kỳ vọng `GET /doctor/appointments` (không filter) trả về đúng **8** lịch hẹn:
  ```js
  assert.equal(res.body.data.length, 8)
  ```
- Thực tế API trả về **10** — đúng theo dữ liệu hiện tại, vì `seed-doctor-test-data.js` đã được mở rộng ở phiên làm việc trước (thêm 2 lịch hẹn `checked_in`/`in_progress` để test đủ trạng thái cho giao diện bác sĩ, theo yêu cầu đã thống nhất với bạn). **Đây không phải lỗi API** — API đúng, test cũ chưa cập nhật theo seed mới.
- Vì `assert.equal` ném lỗi ngay tại dòng 66, dòng `appointments = res.body.data` (dòng 67) **không bao giờ chạy** → biến `appointments` ở scope ngoài vẫn `undefined`.
- Hai test sau đó (dòng 84 và 94) đều dùng `appointments[0]` → `Cannot read properties of undefined (reading '0')` — hệ quả trực tiếp của lỗi trên, không phải lỗi độc lập.

- **Cách sửa (cần bạn xác nhận vì đụng vào test):** sửa dòng 66 từ `assert.equal(res.body.data.length, 8)` thành `assert.equal(res.body.data.length, 10)` (hoặc lỏng hơn: `assert.ok(res.body.data.length >= 8)` nếu muốn test không vỡ mỗi lần seed thêm dữ liệu sau này).

---

## Tổng kết — mức độ ưu tiên đề xuất

| # | Lỗi | Mức độ | Gây crash/sai dữ liệu thật? |
|---|---|---|---|
| A4 | Thiếu file `mock/news` | 🔴 Cao | Có — crash khi build/chạy trang Tin tức |
| A3 | `user?._id` sai field | 🔴 Cao | Có — đặt lịch có thể gắn sai/thiếu `user_id` |
| A5 | So sánh `'approved'` sai | 🟠 Trung bình | Không crash, nhưng UI hiển thị sai trạng thái cho bệnh nhân |
| B2 | Test cũ hard-code 8 | 🟠 Trung bình | Không ảnh hưởng người dùng thật, chỉ CI/test tự vỡ |
| A1 | Typo `HTMLTextareaElement` | 🟡 Thấp | Chỉ lỗi type, textarea vẫn chạy đúng lúc runtime |
| A2 | Mock `doctor-appointments.ts` lệch type | 🟡 Thấp | Không dùng ở đâu — an toàn xoá hoặc sửa type |

**Tất cả đều CHƯA được sửa** — chờ bạn xác nhận từng mục (đặc biệt A2, A4, B2 có nhiều hơn 1 cách xử lý) trước khi tiến hành.
