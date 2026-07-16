# Debug — Số ngày uống thuốc / ngày tái khám mất khi cập nhật kết quả khám

> Theo yêu cầu trực tiếp: "cập nhật kết quả khám phần ngày tái khám và số ngày uống thuốc khi cập nhật thì dữ liệu không được lưu". Xử lý theo quy trình systematic-debugging (root cause trước, không patch mù). **Đã sửa và test PASS.**

---

## 1. Root cause #1 (bug thật) — `updateResult()` không đọc `thuoc` từ `req.body`

**File:** `backend/src/controllers/doctor/appointments.controller.js` — `updateResult()` (PUT `/api/doctor/appointments/:id/result`).

So sánh với `createResult()` (POST, cùng file): `createResult` có xử lý `thuoc` (tạo `DonThuoc`), nhưng `updateResult` **destructure thiếu hẳn `thuoc`** — chỉ xử lý `chan_doan`, `huong_dan_dieu_tri`, `ghi_chu`, `ngay_tai_kham`. Frontend (`DoctorAppointments.tsx`, hàm `handleSave`) vẫn gửi `thuoc: drugs` lên trong cả 2 trường hợp tạo mới lẫn cập nhật — nên mọi thay đổi đơn thuốc (kể cả `so_ngay`) ở lần sửa sau khi đã có hồ sơ đều bị **âm thầm bỏ qua**, không lỗi, không cảnh báo.

**Bằng chứng (test tái hiện lỗi trước khi sửa):** thêm test `PUT /doctor/appointments/:id/result -> sua so_ngay trong don thuoc phai duoc luu lai` vào `backend/tests/doctor.api.test.js`, dùng fixture có sẵn `TESTAPT004` (seed, hồ sơ `da_xac_nhan` + đơn thuốc `so_ngay=5`). Chạy trước khi sửa → **FAIL** (`undefined !== 5`, xem mục 2 để biết vì sao ra `undefined` chứ không phải `5`).

**Fix:** `updateResult()` giờ đọc `thuoc` từ `req.body`; nếu là mảng khác rỗng thì tìm `DonThuoc` theo `medical_record_id: result._id` — có thì `items = thuoc` rồi `save()`, chưa có thì `create()` mới (dùng `a.member_id`/`a.ten_khach` lấy từ chính lịch hẹn, đã mở rộng `.select()` ở đầu hàm để có đủ field). Response trả kèm `thuoc` giống `createResult()`.

Chạy lại test sau khi sửa → **PASS** (12/12 test file `doctor.api.test.js`, không có test nào khác bị vỡ).

## 2. Phát hiện phụ — dữ liệu cũ trong MongoDB Cloud chưa được migrate theo schema mới

Khi debug root cause #1, kiểm tra trực tiếp document `DonThuoc` của fixture `TESTAPT004` trong MongoDB Cloud (query raw, không qua Mongoose cast) thì thấy:

```json
{
  "items": [{
    "ten_thuoc": "(TEST) Paracetamol 500mg",
    "gio_uong": ["07:00", "12:00", "19:00"],
    "ngay_bat_dau": "2026-07-10T08:43:41.457Z",
    "ngay_ket_thuc": "2026-07-15T08:43:41.457Z"
    // KHÔNG có so_ngay
  }]
}
```

Đây là document được tạo **trước** ngày đổi schema (`ngay_bat_dau`/`ngay_ket_thuc` → `so_ngay`, xem [[Sua doi - Ngay tai kham va so ngay uong thuoc + Doi chieu field Ket qua kham (2026-07-11)]]). Lần đổi schema đó chỉ sửa code (model + 3 script seed chạy lại từ đầu) — **không migrate document đã tồn tại sẵn trong MongoDB Cloud**. Vì Mongoose chỉ cast field theo schema lúc *ghi*, không lúc *đọc*, các document cũ này vẫn nằm im với field cũ, và `so_ngay` đọc ra `undefined` — đúng như triệu chứng "không lưu được" mà bạn thấy trên UI (thực ra là chưa từng có `so_ngay` để mà đọc, chứ không phải mất do sửa).

**Sau khi fix root cause #1**, document này đã được "tự vá" đúng schema mới nhờ chính lần `update()` trong test (đã verify lại raw doc: còn `so_ngay`, hết `ngay_bat_dau`/`ngay_ket_thuc`). Nhưng đây chỉ là 1 document được test chạm tới — **các `DonThuoc` khác tạo trước 2026-07-11 mà chưa từng được sửa lại vẫn còn thiếu `so_ngay`** cho tới khi có ai đó update chúng hoặc chạy migration thật.

**Cập nhật 2026-07-16 (sau khi bàn riêng mục B) — ĐÃ MIGRATE:** viết `backend/scripts/migrations/009-backfill-don-thuoc-so-ngay.js` (theo khuôn migration `007`), quét toàn bộ `don_thuoc` có item thiếu `so_ngay`, tính `so_ngay = round((ngay_ket_thuc - ngay_bat_dau) / 86400000)` (kẹp `[1, 90]`, mặc định 7 nếu thiếu mốc ngày), ghi đè `items` và bỏ 2 field cũ. Đã chạy trên MongoDB Cloud thật: **5 document / 6 item được migrate**, xác nhận lại `countDocuments` còn thiếu `so_ngay` = 0. Báo cáo chi tiết: `backend/reports/migration/don-thuoc-backfill-so-ngay.md`. Chạy lại `doctor.api.test.js` sau migration: 12/12 PASS, không có gì vỡ.

## 3. Root cause #2 — `ngay_tai_kham` hiển thị trống sau khi lưu (không phải lỗi lưu)

**File:** `frontend/src/pages/doctor/DoctorAppointments.tsx`, `ExamModal`, dòng nạp dữ liệu cũ (`useEffect`).

Backend **lưu đúng** `ngay_tai_kham` (đã xác nhận đọc code `updateResult()` — set `result.ngay_tai_kham = new Date(...)` rồi `save()`, không có gap). Nhưng frontend gán thẳng `res.ngay_tai_kham` (chuỗi ISO datetime đầy đủ, ví dụ `"2026-07-20T00:00:00.000Z"`, do `Date` field serialize qua JSON) vào state rồi bind trực tiếp vào `<input type="date">`. Input này **chỉ chấp nhận đúng format `YYYY-MM-DD`** — nhận chuỗi datetime đầy đủ, trình duyệt coi là invalid và hiển thị **rỗng**, dù DB có giá trị đúng. Mở lại modal sau khi lưu → thấy ô ngày trống → tưởng "không lưu được".

**Fix:** cắt chuỗi về `YYYY-MM-DD` khi nạp vào state: `res.ngay_tai_kham ? res.ngay_tai_kham.slice(0, 10) : ''`.

## 4. Mục C — Đơn thuốc không bắt buộc + nút xóa + khóa theo thời gian (2026-07-16)

Khảo sát trước khi sửa: nút xóa từng thuốc (`removeDrug`) **đã có sẵn** trong code, nhưng bị khóa điều kiện `drugs.length > 1` (không bao giờ xóa hết được), và form luôn khởi tạo sẵn **1 dòng thuốc trống** (`useState([{ ...EMPTY_DRUG }])`) — nghĩa là đơn thuốc đang bị ép "phải có" dù backend đã sẵn sàng cho trường hợp không có (chỉ tạo `DonThuoc` `if (thuoc.length)`).

Quyết định khung thời gian sửa/xóa đơn thuốc: **dùng chung khóa `co_the_sua` (24 giờ)** đã có sẵn cho toàn bộ hồ sơ khám, không thêm mốc thời gian riêng cho thuốc — đơn giản, nhất quán, không cần field mới.

**Đã sửa:**
- `backend/src/controllers/doctor/appointments.controller.js` (`updateResult()`): thêm nhánh — nếu `thuoc` là mảng **rỗng** và đã có `DonThuoc` từ trước, `deleteOne()` luôn (không để lại đơn rỗng/mồ côi trong DB khi bác sĩ xóa hết thuốc đã kê nhầm).
- `frontend/src/pages/doctor/DoctorAppointments.tsx`: `drugs` mặc định `[]` (không còn dòng trống ép sẵn); bỏ điều kiện `drugs.length > 1` ở nút xóa (xóa được về 0); thêm dòng placeholder "Chưa kê đơn thuốc nào" khi rỗng.
- `backend/tests/doctor.api.test.js`: thêm test "9" — xóa hết `thuoc` qua PUT phải xóa luôn `DonThuoc` trong DB (GET lại phải thấy `thuoc: []`), test tự phục hồi dữ liệu gốc ở `finally` để không phá fixture cho lần chạy sau.

Chạy `node --test tests/doctor.api.test.js tests/doctor.schedule.test.js tests/doctor.leave-sync.test.js`: **32/32 PASS**. `tsc --noEmit`: không có lỗi mới trong `DoctorAppointments.tsx` (108 lỗi còn lại thuộc `types/index.ts`/`mock/doctor-appointments.ts`, có từ trước, ngoài phạm vi).

## Tổng kết thay đổi

| File | Thay đổi |
|---|---|
| `backend/src/controllers/doctor/appointments.controller.js` | `updateResult()`: đọc `thuoc`, tạo/cập nhật/xóa `DonThuoc` tương ứng, mở rộng `.select()` lấy `member_id`/`ten_khach`/`ngay_kham` |
| `backend/tests/doctor.api.test.js` | Test mục 8 (sửa `so_ngay`) + mục 9 (xóa hết thuốc → xóa `DonThuoc`) |
| `frontend/src/pages/doctor/DoctorAppointments.tsx` | Cắt `ngay_tai_kham` về `YYYY-MM-DD`; `drugs` mặc định rỗng; bỏ giới hạn tối thiểu 1 dòng thuốc; thêm placeholder rỗng |
| `backend/scripts/migrations/009-backfill-don-thuoc-so-ngay.js` | Migration một lần cho dữ liệu `DonThuoc` cũ trên MongoDB Cloud (đã chạy — mục 2) |

**Chưa làm (để bàn riêng — mục D):**
- Lọc lịch hẹn theo luật 6 ngày làm việc / theo thứ + đổi tab lịch sử sang tìm kiếm thay vì hiển thị toàn bộ.
