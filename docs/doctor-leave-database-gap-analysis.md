# Phân tích khoảng trống Database — Xin nghỉ bác sĩ

> Ngày: **2026-07-14**. Chế độ **CHỈ ĐỌC** — không insert/update/delete/seed/migration.
> Nguồn: đọc model `backend/src/models/*.js` + đọc trực tiếp MongoDB Cloud (read-only, qua
> mongoose `.find().lean()`) collection `nghi_phep_bac_si`, `lich_lam_viec`, `bac_si`.
> Không in URI kết nối, password, token, hoặc dữ liệu nhạy cảm không cần thiết.

---

## A. Model/collection thực tế liên quan

### A.1 `NghiPhepBacSi` (collection `nghi_phep_bac_si`) — `backend/src/models/NghiPhepBacSi.js`

| Field | Kiểu | Ghi chú |
|---|---|---|
| `bac_si_id` | ObjectId ref `BacSi`, required | Chủ sở hữu đơn nghỉ |
| `tu_ngay` | Date, required | Ngày bắt đầu (UTC midnight khi tạo qua API) |
| `den_ngay` | Date, required | Ngày kết thúc, validate `den_ngay >= tu_ngay` |
| `gio_bat_dau` | String HH:MM, default null | **null = nghỉ cả ngày**, có giá trị = nghỉ theo khung giờ |
| `gio_ket_thuc` | String HH:MM, default null | Đi kèm `gio_bat_dau` |
| `ly_do` | String, maxlength 500, default null | Lý do bác sĩ nhập |
| `trang_thai` | enum `['cho_duyet','da_duyet','tu_choi','da_huy']`, default `cho_duyet` | |
| `nguoi_duyet_id` | ObjectId ref `NguoiDung`, default null | Admin xử lý |
| `thoi_diem_duyet` | Date, default null | |
| `ghi_chu` | String, maxlength 500, default null | Ghi chú xử lý của Admin |
| `ngay_tao`/`ngay_cap_nhat` | timestamps tự động | |

**Index**: `{bac_si_id, tu_ngay, den_ngay}` (không unique), `{trang_thai}` (không unique).

**KHÔNG có**: mảng lịch sử trạng thái (timeline), field liên kết `schedule_id`/`slot_id`, field phân loại
"nghỉ khẩn cấp", field snapshot số lịch hẹn bị ảnh hưởng tại thời điểm gửi.

### A.2 `LichLamViec` (collection `lich_lam_viec`) — liên quan

- Cấp ngày: `trang_thai_ngay` enum `['lam_viec','nghi','nghi_phep']`.
- Cấp slot: `status` enum `['active','pending_payment','booked','locked','cancelled','expired']`,
  `bi_khoa_boi_nghi_phep` (Boolean, default false), `nghi_phep_id` (ObjectId ref `NghiPhepBacSi`,
  default null) — **cả 2 field này đã có sẵn trong schema từ trước**, được backend ghi bởi
  `admin/doctor-leaves.controller.js:lockSlotsForLeave()` (sửa 2026-07-14, xem
  `docs/superpowers/plans/2026-07-14-doctor-leave-sync-fix.md`).
- Index unique `{doctor_id, ngay}` — **không unique theo "ngày lịch"** mà theo giá trị Date tuyệt đối
  (xem GAP-8 ở `docs/doctor-schedule-database-gap-analysis.md`) — liên quan trực tiếp mục C.3 dưới đây.

### A.3 `LichHen` — liên quan

- `doctor_id`, `ngay_kham`, `gio_kham`, `schedule_id`, `slot_id`, `status`. Dùng để đếm/liệt kê lịch
  hẹn bị ảnh hưởng (`demLichHenAnhHuong`, `findAffectedAppointments`).

### A.4 `BacSi` — liên quan (phát hiện quan trọng, xem mục C.1)

- `trang_thai` enum `['active','nghi_phep','nghi_viec']` — trạng thái **cấp bác sĩ** (nhân sự dài hạn),
  set bởi Admin qua `backend/src/services/doctor.service.js` (module Quản lý bác sĩ C2), **hoàn toàn
  độc lập** với `NghiPhepBacSi`. Không có bất kỳ đoạn code nào đồng bộ 2 khái niệm này với nhau.

### A.5 `NhatKyThaoTac` (audit log chung) và `LichSuLichHen` (lịch sử lịch hẹn)

- `NhatKyThaoTac.hanh_dong` là **String tự do** (không enum) — có thể ghi log cho đơn nghỉ mà **không
  cần đổi schema**, nhưng hiện **không nơi nào trong `controllers/doctor/leaves.controller.js` hoặc
  `controllers/admin/doctor-leaves.controller.js` gọi `NhatKyThaoTac.create(...)`** (đã grep xác nhận
  0 kết quả).
- `LichSuLichHen` chỉ ghi lịch sử cho `LichHen` (appointment_id required) — **không áp dụng** cho
  `NghiPhepBacSi`. Không có model nào đóng vai trò "lịch sử trạng thái đơn nghỉ".

---

## B. Dữ liệu hiện tại có gì (đọc trực tiếp MongoDB Cloud, 2026-07-14)

> **Quan trọng — minh bạch nguồn dữ liệu**: `nghi_phep_bac_si` hiện có **90 document**, nhưng
> **85/90 document** có `ly_do` bắt đầu bằng `"test "` — đây là **artifact do chính phiên làm việc
> hôm nay tạo ra** khi viết + chạy `backend/tests/doctor.leave-sync.test.js` nhiều lần (mỗi lần chạy
> tạo mới vài đơn nghỉ trên ngày tương lai xa, một số không thể dọn vì đã `da_duyet` — xem giới hạn đã
> biết ở plan SYNC-02). **Chỉ 5 document là dữ liệu seed/thật**, không liên quan phiên test:

| Nguồn | bac_si_id (rút gọn) | Khoảng ngày | Loại | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| `seed-doctor-test-data.js` | `...7cae` | 2026-07-19 | Cả ngày | `cho_duyet` | "Xin nghỉ khám sức khỏe định kỳ" |
| `seed-doctor-test-data.js` | `...7cae` | 2026-07-20 | Cả ngày | `da_duyet` | "Đã duyệt — đã sắp xếp bác sĩ trực thay" |
| `seed-doctor-test-data.js` | `...7cae` | 2026-07-21 | Cả ngày | `tu_choi` | "Từ chối — đã có bác sĩ khác nghỉ cùng ngày" |
| `seed-all.js` | `...0c1a` | 2026-07-20 | Cả ngày | `cho_duyet` | "Khám sức khỏe định kỳ." |
| `seed-all.js` | `...0c19` | 2026-07-16 → 2026-07-18 (3 ngày) | Cả ngày | **`da_duyet`** | "Tham gia hội thảo nhi khoa." |

**Không có document `NghiPhepBacSi` thật nào dùng `gio_bat_dau`/`gio_ket_thuc`** (nghỉ theo ca) trong
dữ liệu seed — cả 5 document thật đều là nghỉ **cả ngày**. Toàn bộ 46 document `gio_bat_dau != null`
trong tổng 90 đều là artifact test hôm nay.

### B.1 Bằng chứng cụ thể — đơn `da_duyet` (seed-all.js) chưa từng đồng bộ sang `LichLamViec`

Đơn `bac_si_id=...0c19`, `tu_ngay=2026-07-16`, `den_ngay=2026-07-18`, `trang_thai=da_duyet`,
`nguoi_duyet_id` có giá trị (được seed set thẳng, **không qua API duyệt**). Đọc trực tiếp
`lich_lam_viec` trong khoảng này:

| `ngay` | `trang_thai_ngay` | Slot `locked` |
|---|---|---|
| 2026-07-16T00:00:00.000Z | `lam_viec` | 0/15 |
| 2026-07-16T17:00:00.000Z *(bản trùng GAP-8)* | `undefined` | 0/16 |
| 2026-07-17T00:00:00.000Z | `lam_viec` | 0/15 |
| 2026-07-17T17:00:00.000Z | `lam_viec` | 0/16 |
| 2026-07-18T00:00:00.000Z | `lam_viec` | 0/15 |

**Kết luận xác nhận bằng dữ liệu thật**: đơn nghỉ đã "duyệt" này **không có tác dụng thực tế nào** lên
lịch làm việc — đúng như phát hiện SYNC-02 (đã sửa cho các đơn duyệt **từ nay về sau** qua API thật,
nhưng **không backfill dữ liệu cũ** — xem mục D). Đồng thời dữ liệu này lộ ra **cùng lúc 2 vấn đề**:
bản ghi `2026-07-16T17:00:00.000Z` là **document trùng ngày lịch** (GAP-8, đã ghi nhận ở
`docs/doctor-schedule-database-gap-analysis.md`) — cho thấy 2 vấn đề (đồng bộ nghỉ phép + trùng ngày
GAP-8) cộng dồn trên cùng một bác sĩ/khoảng ngày.

### B.2 Toàn vẹn tham chiếu

- `bac_si_id` orphan (không tồn tại trong `bac_si`): **0/90**.
- `nguoi_duyet_id` thiếu khi `trang_thai` đã xử lý (`da_duyet`/`tu_choi`): **0** trường hợp thiếu (mọi
  đơn đã xử lý đều có `nguoi_duyet_id`) — nhưng lưu ý 2 đơn seed ở trên có `nguoi_duyet_id` được **set
  cứng lúc seed**, không phải qua hành động duyệt thật của tài khoản admin đăng nhập.

---

## C. Dữ liệu còn thiếu / rủi ro — vì sao cần lưu ý

### C.1 (Không phải thiếu field — thiếu ranh giới nghiệp vụ) Trùng tên "nghỉ phép" ở 2 cấp độ khác nhau

- `BacSi.trang_thai = 'nghi_phep'` (cấp **bác sĩ**, nhân sự dài hạn, Admin set tay qua module Quản lý
  bác sĩ — `backend/src/services/doctor.service.js:44,152`) và `LichLamViec.trang_thai_ngay =
  'nghi_phep'` (cấp **ngày làm việc**, do luồng `NghiPhepBacSi` sinh ra) **dùng cùng một từ tiếng Việt
  nhưng là 2 khái niệm hoàn toàn độc lập, không có code nào liên kết chúng**.
- **Rủi ro**: một bác sĩ có `BacSi.trang_thai='nghi_phep'` (nghỉ dài hạn, có thể nhiều tháng) vẫn có
  thể có `LichLamViec` với `trang_thai_ngay='lam_viec'` (vì 2 field độc lập) → cron sinh lịch
  (`generateRollingWindowForAllDoctors`) vẫn tiếp tục sinh ca làm việc mới cho bác sĩ đang nghỉ dài hạn
  nếu điều kiện lọc bác sĩ (`trang_thai_duyet:'approved', trang_thai:'active', la_hien:true` — xem
  `scheduleGenerator.service.js`) **không loại trừ đúng**. Cần kiểm tra thêm ở phạm vi Lịch làm việc,
  **không sửa trong bước phân tích này**.
- **Không cần thêm field** — đây là vấn đề đặt tên/ranh giới nghiệp vụ, không phải thiếu dữ liệu.

### C.2 (Có sẵn nhưng chưa dùng đúng) `bi_khoa_boi_nghi_phep`/`nghi_phep_id` không được Admin API trả

- `backend/src/controllers/admin/doctor-leaves.controller.js:formatDoctorLeave()` (dòng 11-33) **không
  trả `gio_bat_dau`/`gio_ket_thuc`** trong response (khác với `doctor/leaves.controller.js:formatLeave()`
  vốn có trả 2 field này). **Hệ quả xác nhận bằng dữ liệu thật**: gọi `GET /admin/doctor-leaves` không
  cách nào phân biệt đơn "nghỉ cả ngày" hay "nghỉ theo ca" — Admin duyệt/từ chối mà **không biết** hành
  vi khóa lịch sẽ khác nhau thế nào (khóa cả ngày vs khóa 1 khung giờ, xem `lockSlotsForLeave`).
- **Không cần thêm field** — field đã tồn tại trong model, chỉ thiếu ở tầng API response. Đây là lỗi
  **High**, nêu chi tiết ở báo cáo chính (`docs/doctor-leave-comprehensive-analysis.md` Phần 14).

### C.3 (Rủi ro tương thích) GAP-8 (document `LichLamViec` trùng ngày lịch) làm sai lệch việc khóa slot khi duyệt nghỉ

- `lockSlotsForLeave()` dùng `LichLamViec.find({doctor_id, ngay: {$gte, $lt}})` — nếu tồn tại **2**
  document cho cùng 1 "ngày lịch" (do GAP-8, xem bằng chứng cụ thể ở mục B.1), cả 2 document đều nằm
  trong khoảng `$gte/$lt` nên **cả 2 đều được khóa** nếu duyệt lại đơn đó **sau khi GAP-8 được dọn**.
  Hiện tại (dữ liệu seed cũ, duyệt trước khi có fix) chưa bị ảnh hưởng vì chưa từng chạy qua
  `lockSlotsForLeave`, nhưng nếu Admin duyệt một đơn MỚI trùng vào ngày đang có GAP-8 duplicate,
  **cả 2 bản ghi trùng đều bị khóa** — về mặt kỹ thuật là "an toàn thừa" (không bỏ sót), nhưng phản
  ánh sự phụ thuộc chưa được kiểm chứng giữa 2 vấn đề riêng biệt.
- **Đề xuất (chỉ đề xuất, chưa làm)**: khi dọn GAP-8 (Lớp D, xem
  `docs/doctor-schedule-database-gap-analysis.md`), cần kiểm tra lại các đơn nghỉ `da_duyet` có
  `nghi_phep_id` trỏ tới slot thuộc document bị xoá, tránh để `nghi_phep_id` orphan.

### C.4 (Có điều kiện — chỉ nếu chốt nghiệp vụ) Field lịch sử trạng thái / snapshot ảnh hưởng

- Nếu nghiệp vụ muốn hiển thị **timeline đầy đủ** (ai đổi, khi nào, từ trạng thái nào sang trạng thái
  nào — mục 12.5/Phần 13 của yêu cầu phân tích), model hiện tại **chỉ lưu snapshot cuối cùng**
  (`nguoi_duyet_id`, `thoi_diem_duyet`, `ghi_chu`) — không có mảng lịch sử. Muốn có timeline đầy đủ cần
  1 trong 2 hướng: (a) thêm mảng `lich_su: [{tu_trang_thai, den_trang_thai, nguoi_thuc_hien_id,
  thoi_diem}]` vào `NghiPhepBacSi` (schema change, additive), hoặc (b) dùng `NhatKyThaoTac` (đã có,
  **không cần đổi schema**) và ghi log ở 4 điểm: tạo, duyệt, từ chối, hủy.
- **Khuyến nghị**: dùng hướng (b) — tận dụng `NhatKyThaoTac` sẵn có, `hanh_dong` là String tự do nên có
  thể dùng ngay giá trị như `"CREATE_LEAVE"`, `"APPROVE_LEAVE"`, `"REJECT_LEAVE"`, `"CANCEL_LEAVE"` mà
  **không cần migration**. Đây chỉ là đề xuất, **chưa triển khai**.
- **Ưu tiên**: Nên có (không chặn nghiệp vụ chính, chỉ ảnh hưởng khả năng truy vết).

### C.5 (Không khuyến nghị trong phạm vi đồ án) Field snapshot `so_lich_hen_anh_huong` trên `NghiPhepBacSi`

- Hiện tính động mỗi lần gọi (`demLichHenAnhHuong`, `findAffectedAppointments`) — đủ dùng, không cần
  lưu cứng. Tương tự đề xuất C.2 đã ghi trong
  `docs/doctor-schedule-database-gap-analysis.md` — giữ nguyên khuyến nghị "không cần field mới".

---

## D. Model/collection bị ảnh hưởng nếu áp dụng các đề xuất

| Đề xuất | Model bị ảnh hưởng | Loại thay đổi |
|---|---|---|
| C.2 — Admin API trả `gio_bat_dau`/`gio_ket_thuc` | Không đổi model — chỉ sửa `formatDoctorLeave()` | Backend-only |
| C.4(b) — Ghi audit log qua `NhatKyThaoTac` | Không đổi model (field tự do sẵn có) | Backend-only |
| C.4(a) — Thêm mảng lịch sử vào `NghiPhepBacSi` | `NghiPhepBacSi` | Schema change (additive, có default `[]`) |
| C.1 — Ranh giới `BacSi.trang_thai` vs `trang_thai_ngay` | `BacSi`, `scheduleGenerator.service.js` | Cần quyết định nghiệp vụ trước, có thể không cần đổi schema (chỉ cần thêm điều kiện lọc ở generator) |

## E. Rủi ro tương thích nếu áp dụng

- C.2 (bổ sung field response Admin API): **rủi ro thấp** — chỉ thêm field vào response JSON, không
  phá vỡ client hiện tại (chưa có Admin FE tiêu thụ API này — xem báo cáo chính Phần 3/10).
- C.4(b) (audit log qua `NhatKyThaoTac`): **rủi ro thấp** — chỉ thêm `.create()` calls, không đổi luồng
  hiện tại, `NhatKyThaoTac` là insert-only.
- C.4(a) (thêm mảng lịch sử vào model): **rủi ro thấp/trung bình** — additive nhưng cần cập nhật đồng
  thời 4 điểm ghi (create/approve/reject/cancel) để nhất quán, dễ bỏ sót nếu làm vội.
- C.1 (ranh giới nghiệp vụ `BacSi.trang_thai`): **cần quyết định nghiệp vụ trước khi đánh giá rủi ro
  kỹ thuật** — chưa đủ căn cứ để đề xuất cách sửa cụ thể trong bước phân tích này.

## F. Đề xuất migration/cập nhật dữ liệu sau này (chỉ đề xuất — KHÔNG chạy)

- **Không có migration bắt buộc** để chức năng "Xin nghỉ" hoạt động đúng — mọi gap đều xử lý được ở
  tầng API/backend (C.2, C.4b), không đụng dữ liệu cũ.
- **Dữ liệu cũ (2 đơn `da_duyet` seed trước fix SYNC-02, mục B.1)**: nếu muốn dữ liệu demo/seed nhất
  quán với logic mới, có thể cân nhắc **chạy lại `lockSlotsForLeave` tương đương** cho các đơn
  `da_duyet` cũ (script 1 chiều, chỉ set field, không xoá gì) — nhưng đây là dữ liệu **demo/seed**, không
  phải dữ liệu người dùng thật, rủi ro thấp nếu có sai sót. **Không tự chạy trong bước phân tích này.**
- Nếu quyết định thêm C.4(a) (mảng lịch sử): thứ tự đề xuất — (1) thêm field vào model (default `[]`,
  an toàn với dữ liệu cũ) → (2) cập nhật 4 controller function để push vào mảng → (3) không cần backfill
  dữ liệu cũ (lịch sử trước đó đơn giản là rỗng, chấp nhận được).

---

**Xác nhận**: Không insert/update/delete bất kỳ document nào trong bước phân tích này. Không sửa
model/schema. Không chạy seed/migration. Toàn bộ số liệu ở trên đọc trực tiếp từ MongoDB Cloud
(`nghi_phep_bac_si`, `lich_lam_viec`, `bac_si`) bằng truy vấn `.find()/.countDocuments()/.aggregate()`
chỉ đọc, ngày 2026-07-14.
