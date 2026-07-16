# Phân tích khoảng trống Database — Lịch làm việc bác sĩ (Prompt 1)

> Ngày: **2026-07-13**. **CHỈ đề xuất — KHÔNG thêm field, KHÔNG migration, KHÔNG chạy seed.**
> Nguồn: đọc model `backend/src/models/*.js` + báo cáo dữ liệu thật sẵn có
> `docs/Bác sĩ/Audit - Doi chieu du lieu that MongoDB - Bac si Khang (2026-07-11).md`.
> Quy ước đặt tên: **field tiếng Việt snake_case** (khớp toàn dự án). Mọi đề xuất field mới đều
> **additive-safe** (thêm mới + `default`), không đổi field cũ.

---

## A. Database hiện tại (liên quan lịch làm việc)

### A.1 `LichLamViec` (collection `lich_lam_viec`)

- **Cấp document**: `doctor_id` (ref BacSi), `nurse_id` (ref NguoiDung, `default: null`),
  `chi_nhanh_id` (ref ThongTinPhongKham), `ngay` (Date, **required**),
  `trang_thai_ngay` enum `['lam_viec','nghi','nghi_phep']`, `ghi_chu_ngay`, `slots[]`.
- **Cấp slot** (`slots[]._id: true`): `gio_bat_dau`, `gio_ket_thuc` (HH:MM, validate),
  `benh_nhan_id`, `benh_nhan_tam_giu_id`, `specialty_id`, `phong_kham` (String),
  `status` enum `['active','pending_payment','booked','locked','cancelled','expired']`,
  `lock_expires_at`, `pending_expired_at`, `cancel_requested`, `cancel_reason`,
  `bi_khoa_boi_nghi_phep`, `nghi_phep_id`.
- **Index**: unique `{doctor_id, ngay}`, `{ngay}`, `{slots._id, slots.status}`,
  `{chi_nhanh_id, ngay}`, `{slots.specialty_id, slots.status}`.
- **Mô hình**: **1 document = 1 bác sĩ × 1 ngày**, chứa nhiều slot 30 phút; mỗi slot = 1 chỗ khám.

### A.2 `LichHen` (collection `lich_hen`)

- Liên kết ca: `schedule_id` (ref LichLamViec) + `slot_id` — **bắt buộc** (`pre('validate')`).
- Y tá: `nurse_id` (snapshot lúc đặt). Phòng: `phong_kham` (snapshot String).
- `status` enum: `pending, confirmed, checked_in, in_progress, waiting_doctor_confirm, completed, cancelled, no_show`.
- `payment_status` enum: `unpaid, partial, paid, refunded`.
- Check-in/hàng đợi: `trang_thai_den`, `gio_den_thuc_te`, `no_show_confirmed_at`, `ghi_chu_tiep_nhan`.
- Offline/guest: `khach_vang_lai_id`, `ten_khach`, `loai_benh_nhan`, `hinh_thuc_dat_lich`, `dat_ho`.

### A.3 `NghiPhepBacSi` (collection `nghi_phep_bac_si`)

- `bac_si_id`, `tu_ngay`, `den_ngay`, `gio_bat_dau/gio_ket_thuc` (null = cả ngày), `ly_do`,
  `trang_thai` enum `['cho_duyet','da_duyet','tu_choi','da_huy']`, `nguoi_duyet_id`,
  `thoi_diem_duyet`, `ghi_chu`.
- **Liên kết theo NGÀY/khung giờ, KHÔNG liên kết `schedule_id`/`slot_id`.**
- Index: `{bac_si_id, tu_ngay, den_ngay}`, `{trang_thai}`.

### A.4 Những gì DB **đã đáp ứng**

- Xác định bác sĩ, lịch theo bác sĩ + ngày, ca (slot), phòng, trạng thái slot.
- Liên kết lịch hẹn ↔ ca (schedule_id + slot_id).
- Y tá cấp ngày + snapshot lịch hẹn (`nurse_id` — đã có, đã có dữ liệu).
- Chống trùng lịch bác sĩ/ngày (unique index).
- Vòng đời yêu cầu nghỉ đủ 4 trạng thái (kể cả `da_huy`).
- Cờ nghỉ ở slot: `bi_khoa_boi_nghi_phep`, `nghi_phep_id` (đã có sẵn để liên kết slot ↔ đơn nghỉ khi Admin duyệt).

---

## B. Khoảng trống dữ liệu

### GAP-1 — API không đọc `nurse_id` (dữ liệu đã có, chưa lấy)

- **Chức năng ảnh hưởng**: hiển thị "Y tá hỗ trợ" trong ca.
- **Hiện có**: `LichLamViec.nurse_id` (đã populate được), dữ liệu thật đã gắn cho bác sĩ Khang.
- **Còn thiếu**: `flattenSchedules()` không trả `nurse_id`; FE hardcode "Chưa phân công y tá".
- **Vì sao chưa đủ**: chỉ là thiếu ở tầng API/FE, **không thiếu field**.
- **Tính từ dữ liệu hiện có?** Có — chỉ cần populate + trả.
- **Cần lưu thêm?** **Không.** Ưu tiên xử lý ở backend/frontend, không đụng model.
- **Ưu tiên**: **Bắt buộc** (đã hứa hiển thị y tá).

### GAP-2 — `NghiPhepBacSi.ghi_chu` không được API trả

- **Ảnh hưởng**: "Xem ghi chú xử lý của Admin".
- **Hiện có**: field `ghi_chu` + `nguoi_duyet_id` + `thoi_diem_duyet` trong model.
- **Thiếu**: `formatLeave()` chỉ trả `trang_thai`, bỏ `ghi_chu`.
- **Tính từ hiện có?** Có. **Cần lưu thêm?** Không. **Ưu tiên**: Nên có.

### GAP-3 — Sức chứa / "ca đầy" chưa có định nghĩa dữ liệu

- **Ảnh hưởng**: "số chỗ còn lại", "ca đã đầy", kiểm soát quá tải.
- **Hiện có**: mỗi slot = 1 chỗ; "đầy" **suy ra** = không còn slot `active`.
- **Thiếu**: không có field sức chứa tường minh; không có khái niệm "ca gộp nhiều BN".
- **Tính từ hiện có?** **Có** ở mô hình 1 BN/slot (đếm slot `active`). **KHÔNG** tính được nếu
  nghiệp vụ muốn "1 ca nhiều bệnh nhân với sức chứa N".
- **Cần lưu thêm?** **Chỉ khi** đổi sang mô hình ca-nhiều-BN. Với mô hình slot hiện tại: **không cần**.
- **Ưu tiên**: Cần **quyết định nghiệp vụ trước** (xem C, đề xuất có điều kiện).
- ⚠️ **Không hardcode sức chứa. Không kết luận "ca đầy" chỉ từ số lịch hẹn khi chưa chốt mô hình.**

### GAP-4 — Không đếm "số lịch hẹn bị ảnh hưởng" khi xin nghỉ

- **Ảnh hưởng**: bác sĩ cần biết gửi nghỉ thì bao nhiêu lịch hẹn bị ảnh hưởng.
- **Hiện có**: có thể đếm `lich_hen` theo `doctor_id + ngay_kham` (+ khung giờ) với `status` còn hiệu lực.
- **Thiếu**: chưa có logic đếm; `NghiPhepBacSi` không lưu con số này.
- **Tính từ hiện có?** **Có** (đếm động lúc hiển thị). **Cần lưu thêm?** Tùy — nếu muốn "chụp" số
  lượng tại thời điểm gửi thì thêm 1 field snapshot; nếu chỉ hiển thị thì tính động, không cần lưu.
- **Ưu tiên**: Nên có.

### GAP-5 — Trạng thái "đã gửi yêu cầu nghỉ" của slot không bền vững

- **Ảnh hưởng**: nút "Gửi yêu cầu nghỉ" chỉ ẩn nhờ state RAM (`leaveRequestedSlotIds`) → reload là mất,
  có thể gửi trùng.
- **Hiện có**: slot đã có `bi_khoa_boi_nghi_phep`, `nghi_phep_id` (nhưng chỉ set khi Admin **duyệt**,
  không phải khi bác sĩ **gửi**); `NghiPhepBacSi` không liên kết slot khi đang `cho_duyet`.
- **Thiếu**: không có cách biết "slot này đã có đơn nghỉ đang chờ" một cách bền vững.
- **Tính từ hiện có?** **Gần đủ** — có thể đối chiếu `NghiPhepBacSi` (ngày + khung giờ) với slot
  ở tầng hiển thị, KHÔNG cần thêm field. **Cần lưu thêm?** Không bắt buộc.
- **Ưu tiên**: Nên có (chống gửi trùng).

### GAP-6 — Không phân biệt nghỉ thường / khẩn cấp

- **Ảnh hưởng**: xử lý "báo vắng khẩn cấp", "ngưng ca đang diễn ra".
- **Hiện có**: chỉ `trang_thai` (vòng duyệt), không có "loại nghỉ".
- **Thiếu**: field phân loại.
- **Cần lưu thêm?** Chỉ khi nghiệp vụ đồ án yêu cầu phân biệt. **Ưu tiên**: Có thể phát triển sau.

### GAP-7 — Không phân biệt online/offline **ở cấp lịch làm việc**

- **Ảnh hưởng**: đếm đúng số bệnh nhân thực tế / sức chứa nếu có khách offline.
- **Hiện có**: `LichHen` phân biệt được (khach_vang_lai_id/hinh_thuc_dat_lich); slot chỉ có 1
  `benh_nhan_id` (ref NguoiDung) → **khách offline không có tài khoản sẽ không hiện tên** ở slot.
- **Tính từ hiện có?** Phần lớn từ `LichHen`. **Cần lưu thêm?** Không, nếu màn lịch join sang `LichHen`.
- **Ưu tiên**: Nên có (khi làm chi tiết ca).

---

## C. Đề xuất thay đổi (KHÔNG tự áp dụng — chỉ đề xuất)

> Ưu tiên **không đụng model**. Đa số gap giải quyết ở tầng backend/frontend. Các đề xuất field mới
> dưới đây là **có điều kiện** (chỉ làm nếu chốt nghiệp vụ tương ứng).

### C.1 (Có điều kiện) `NghiPhepBacSi.loai_nghi` — chỉ khi làm nghỉ khẩn cấp

- **Mục đích**: phân biệt nghỉ có kế hoạch vs khẩn cấp.
- **Dữ liệu cần biểu diễn**: 2–3 giá trị.
- **Tên đề xuất** (theo quy ước): `loai_nghi`.
- **Kiểu**: `String`, enum `['co_ke_hoach','khan_cap']`, `default: 'co_ke_hoach'`.
- **Quan hệ**: không. **Ràng buộc**: enum. **Mặc định**: `co_ke_hoach` (dữ liệu cũ an toàn).
- **Ảnh hưởng dữ liệu cũ**: không (mặc định). **API**: thêm vào `createLeaveRequest`/`formatLeave`.
- **Frontend**: thêm lựa chọn ở form Xin nghỉ. **Rủi ro**: thấp. **Migration**: không bắt buộc.
- **Đây chỉ là đề xuất.**

### C.2 (Có điều kiện) `NghiPhepBacSi.so_lich_hen_anh_huong` — snapshot số lịch hẹn

- **Mục đích**: lưu số lịch hẹn bị ảnh hưởng tại thời điểm gửi (GAP-4) nếu muốn cố định con số.
- **Kiểu**: `Number`, `default: 0`, `min: 0`. **Quan hệ**: tính từ `LichHen`.
- **Lưu ý**: **Chỉ cần nếu** muốn "chụp" con số. Nếu chỉ hiển thị realtime thì **không cần field** —
  tính động ở API. **Ưu tiên**: thấp. **Đây chỉ là đề xuất.**

### C.3 (KHÔNG khuyến nghị trừ khi đổi mô hình) Field `suc_chua` ở slot/ngày

- **Mục đích**: mô hình "1 ca nhiều bệnh nhân với sức chứa N".
- **Lý do KHÔNG nên vội**: mô hình hiện tại là **1 slot = 1 BN**, đã đủ để tính "còn/hết chỗ" bằng
  cách đếm slot `active`. Thêm `suc_chua` sẽ **mâu thuẫn** với `benh_nhan_id` đơn trên slot và kéo
  theo sửa cả luồng đặt lịch bệnh nhân + generator → phạm vi lớn, rủi ro cao.
- **Ưu tiên**: **Không cần thiết trong phạm vi đồ án**, trừ khi nghiệp vụ đổi hẳn sang ca gộp.

### C.4 (KHÔNG cần field mới) Hiển thị y tá / ghi chú / trạng thái đơn nghỉ trên slot

- GAP-1, GAP-2, GAP-5, GAP-7 **giải quyết hoàn toàn ở backend/frontend** (populate + join + trả field
  đã có). **Không thêm field.** Đây là phần **bắt buộc** và **rủi ro thấp nhất**.

---

## D. Index & ràng buộc (chỉ đề xuất, không tạo)

- Đã có `{doctor_id, ngay}` unique, `{schedule_id}` trên `lich_hen`, `{bac_si_id, tu_ngay, den_ngay}`
  trên nghỉ phép — **đủ** cho truy vấn lịch theo bác sĩ+thời gian, lịch hẹn theo ca, và tra nghỉ phép.
- **Đề xuất (nếu tối ưu)**: index `lich_hen {doctor_id, schedule_id}` để đếm nhanh "số lịch hẹn/ca"
  (GAP-4). Hiện đã có `{schedule_id}` đơn — thường là **đủ**, chỉ cân nhắc nếu đo thấy chậm.
- **Chống trùng đơn nghỉ** (GAP, mục A.5 report): cân nhắc unique một phần `{bac_si_id, tu_ngay,
  gio_bat_dau, gio_ket_thuc}` với `trang_thai='cho_duyet'` — **nhưng** unique một phần trên Mongo cần
  partial index cẩn thận; ưu tiên **kiểm tra trùng ở tầng controller** trước, không vội tạo index.
- **Không tạo/không xóa index nào trong Prompt 1.**

---

## E. Migration

Với các đề xuất C.1/C.2 (nếu làm): đều **additive** (field mới + default) → **không cần migration**
dữ liệu (bản ghi cũ nhận default). Nếu vẫn muốn backfill:
- **Dữ liệu chuyển đổi**: có thể backfill `so_lich_hen_anh_huong` bằng đếm động (không bắt buộc).
- **Backup**: `backend/src/scripts/backup-db.js` (đã có) trước mọi thay đổi.
- **Rollback**: field additive có thể bỏ qua (Mongoose không xóa dữ liệu cũ khi bỏ field).
- **Kiểm thử**: chạy trên DB test (`manage-test-databases.js`) trước.
- **Thứ tự**: (1) thêm field vào model → (2) cập nhật controller → (3) backfill (tùy chọn).
- **Không chạy migration trong Prompt 1.**

---

## F. Phân loại đề xuất

| Đề xuất | Loại |
|---|---|
| GAP-1 API trả `nurse_id` (không thêm field) | **Bắt buộc để chức năng đúng** |
| GAP-2 API trả `ghi_chu` đơn nghỉ (không thêm field) | Nên có |
| GAP-4 đếm động lịch hẹn ảnh hưởng (không thêm field) | Nên có |
| GAP-5 đối chiếu đơn nghỉ ↔ slot ở tầng hiển thị (không thêm field) | Nên có |
| GAP-7 join `LichHen` cho chi tiết ca (không thêm field) | Nên có |
| C.1 `loai_nghi` (field mới) | Có thể phát triển sau |
| C.2 `so_lich_hen_anh_huong` (field mới) | Có thể phát triển sau |
| C.3 `suc_chua` (field mới) | **Không cần thiết trong phạm vi đồ án** (trừ khi đổi mô hình) |

> **Chốt lại**: phần lớn khoảng trống là **API/FE chưa expose dữ liệu đã có**, **không phải DB thiếu**.
> Chỉ cân nhắc thêm field khi có quyết định nghiệp vụ rõ ràng (nghỉ khẩn cấp, snapshot ảnh hưởng).

---

## G. Trạng thái sau Prompt 2 (Backend — 2026-07-13)

**KHÔNG thêm field, KHÔNG migration, KHÔNG chạy seed.** Cập nhật tình trạng từng gap:

| Gap | Trạng thái sau Prompt 2 |
|---|---|
| GAP-1 (API trả `nurse_id`) | ✅ **Đã xử lý ở backend** — `GET /doctor/schedule` + chi tiết ca trả `nurse`/`nurse_id`. Không thêm field. FE dùng ở Prompt 3. |
| GAP-2 (API trả `ghi_chu` đơn nghỉ) | ✅ **Đã xử lý** — `formatLeave` trả `ghi_chu`, `thoi_diem_duyet`. Không thêm field. |
| GAP-4 (đếm lịch hẹn ảnh hưởng) | ✅ **Đã xử lý bằng đếm động** — `createLeaveRequest` trả `so_lich_hen_anh_huong`; chi tiết ca trả `so_lich_hen_con_hieu_luc`. **Không cần field** `so_lich_hen_anh_huong` (C.2) trừ khi muốn snapshot lịch sử. |
| GAP-5 (nút "đã gửi yêu cầu nghỉ" bền vững) | ⚠️ **Một phần** — backend đã chống trùng (409). Việc FE đối chiếu đơn nghỉ ↔ slot để ẩn nút sau reload là **Prompt 3** (không cần field). |
| GAP-7 (chi tiết ca cho khách offline) | ✅ **Đã xử lý** — chi tiết ca join `ten_khach`, cờ `la_khach_vang_lai`. Không thêm field. |
| GAP-3 (sức chứa tường minh) | ⏸ **Chưa làm** — giữ mô hình 1 slot = 1 chỗ; "đầy" suy ra từ slot. Field `suc_chua` (C.3) **vẫn không khuyến nghị**. |
| GAP-6 / C.1 (`loai_nghi` nghỉ khẩn cấp) | ⏸ **Chưa làm** — cần field mới + quyết định nghiệp vụ. **Vẫn cần được duyệt** trước khi thêm. |

### Khoảng trống CÒN LẠI cần thay đổi database (chưa áp dụng, chờ duyệt)

- **C.1 `NghiPhepBacSi.loai_nghi`** — nếu làm nghỉ khẩn cấp.
- **C.2 `NghiPhepBacSi.so_lich_hen_anh_huong`** — chỉ nếu muốn *lưu* snapshot (hiện tính động đủ dùng).
- **C.3 `suc_chua`** — chỉ nếu đổi sang mô hình ca-nhiều-BN (không khuyến nghị trong đồ án).

### API chưa thể hoàn thiện vì thiếu dữ liệu

- Không có. Các API đã sửa đều chạy được trên dữ liệu thật hiện có (đã kiểm thử với `doctor.test`).
  Trạng thái "đang diễn ra theo thời gian" là **tính toán ở FE** (Prompt 3), không cần dữ liệu mới.

---

## H. Phát hiện mới sau Prompt 3 — Bất thường dữ liệu THẬT (2026-07-13, qua kiểm thử trình duyệt)

### GAP-8 (MỚI) — Trùng document `LichLamViec` cho cùng bác sĩ + cùng ngày lịch

- **Phát hiện qua**: kiểm thử Playwright thật (không phải suy đoán) — bác sĩ `doctor.test`
  (BS. Trần Minh Khang TEST) có **2 document `LichLamViec` khác nhau** (`schedule_id` khác nhau,
  `slots[]` khác nhau — 1 bản có `phong_kham` set, 1 bản `null`; bệnh nhân khác nhau) cho **cùng
  `doctor_id` + cùng ngày lịch** ở 5 ngày liên tiếp (2026-07-13 → 2026-07-17).
- **Vì sao unique index không bắt được**: index `{doctor_id: 1, ngay: 1}` là unique trên **giá trị
  Date chính xác** (mili-giây), không phải trên "ngày lịch". Cả `scheduleGenerator.service.js`
  (`getRollingWindowDates`) và `seed-doctor-test-data.js` (`startOfDay`) đều dùng
  `new Date(x); x.setHours(0,0,0,0)` — nếu 2 quy trình này chạy **độc lập vào 2 thời điểm khác nhau**
  (vd script seed chạy 1 lần, cron `generateRollingWindowForAllDoctors` chạy mỗi ngày 23:55 và tự
  sinh thêm ngày mới cho bác sĩ đã duyệt — bao gồm cả `doctor.test`), rất dễ tạo ra 2 Date instant
  hơi khác nhau (nếu code chạy khác thời điểm/khác tiến trình có múi giờ hiệu lực khác nhau) nhưng
  cùng biểu diễn "cùng 1 ngày lịch" khi đọc bằng local getters — index không phát hiện trùng vì so
  sánh giá trị Date tuyệt đối, không so sánh "ngày lịch".
- **Ảnh hưởng chức năng**: FE hiển thị lịch cho ngày đó bị **gộp** dữ liệu từ 2 document (số slot có
  thể vượt 16, giờ trùng lặp, phòng/bệnh nhân không nhất quán) — gây hiểu nhầm nghiêm trọng nếu
  không được cảnh báo rõ.
- **Xử lý tạm thời (Prompt 3, chỉ ở tầng hiển thị)**: phát hiện >1 `schedule_id`/ngày → hiện badge
  cảnh báo, tách riêng "Chi tiết" theo từng document, gắn nhãn "Bản ghi N" mỗi slot — **không tự
  gộp, không tự chọn 1 bản ghi "đúng"**, không sửa dữ liệu.
- **Cần lưu thêm?** Không — đây không phải thiếu field, mà là **thiếu ràng buộc/quy trình** đảm bảo
  tính duy nhất theo Ý NGHĨA "ngày lịch" (calendar day), không phải theo Date instant tuyệt đối.
- **Đề xuất hướng sửa** (chỉ đề xuất, CẦN DUYỆT, KHÔNG tự làm):
  1. **Điều tra trước**: xác nhận nguồn gốc 2 document (seed script chạy lại nhiều lần? cron đang
     chạy song song với dữ liệu seed cũ? timezone khác nhau giữa lúc seed và lúc cron chạy?).
  2. **Cân nhắc đổi cách lưu `ngay`**: lưu dạng `String 'YYYY-MM-DD'` thay vì `Date` cho riêng mục
     đích "định danh ngày lịch" — loại bỏ hoàn toàn nhập nhằng múi giờ ở gốc. Đây là **thay đổi
     schema**, rủi ro cao (ảnh hưởng mọi query dùng `$gte/$lte` trên `ngay`), cần kế hoạch migration
     riêng, KHÔNG làm trong các Prompt tiếp theo nếu chưa duyệt rõ ràng.
  3. **Hoặc nhẹ hơn**: thêm bước dọn dữ liệu (script đọc, KHÔNG tự động xóa) liệt kê toàn bộ cặp
     `{doctor_id, ngay-theo-lịch-địa-phương}` bị trùng trên toàn hệ thống, để Admin xem xét thủ công
     trước khi quyết định giữ bản nào / xóa bản nào.
- **Ưu tiên**: **Cao — cần Admin/backend-owner xác nhận trước khi Prompt tiếp theo động vào lịch
  làm việc**, vì đây là lỗi toàn vẹn dữ liệu (data integrity), không phải thiếu tính năng.

---

# Cập nhật sau Prompt 4 (Final Review — 2026-07-13)

Trạng thái các khoảng trống sau review nghiệm thu cuối. **Không có thay đổi database nào được thực
hiện** trong Prompt 4 (chỉ đọc, theo đúng ràng buộc).

| Gap | Trạng thái | Xử lý |
|---|---|---|
| GAP-1 (y tá hardcode) | ✅ Đã đóng bằng cách tính | API trả `nurse` thật; FE fallback "Chưa phân công" |
| GAP-2 (ghi chú Admin không hiện) | ✅ Đã đóng bằng cách tính | API expose `ghi_chu`; FE hiển thị ở trang yêu cầu nghỉ |
| GAP-5 (theo dõi "đã xin nghỉ" tạm thời) | ✅ Đã đóng bằng cách tính | Đối chiếu `GET /doctor/leaves` thật (`findCoveringLeave`) |
| Lệch múi giờ đọc/ghi `ngay` | ✅ Đã đóng bằng cách tính | `localDateStr`/`localStartOfDay` đối xứng với cách ghi (không đổi write-path/dữ liệu) |
| **GAP-8 (document trùng ngày lịch)** | ⚠️ **Còn mở — CẦN thay đổi database** | FE cảnh báo trung thực; chờ Admin/backend duyệt 1 trong 3 hướng đã nêu. **Không tự sửa.** |
| Sức chứa ca / số chỗ còn lại | ⚠️ Chưa có trong DB → **hướng phát triển** | Không hardcode; hiện không tuyên bố kiểm soát quá tải |
| Khách offline có tính vào ca | ✅ Đã hỗ trợ | `getScheduleDetail` gộp `member/ten_khach/user`, cờ `la_khach_vang_lai` |
| Dữ liệu check-in đến sớm/trễ | Chưa thuộc màn lịch làm việc → **hướng phát triển** | Thuộc lịch hẹn + hàng đợi (nurse), không suy đoán theo giờ hiện tại |

**Kết luận DB**: chức năng Lịch làm việc chạy đúng trên dữ liệu thật hiện có. Khoảng trống **bắt buộc
sửa ở tầng database** chỉ còn **GAP-8**; các mục còn lại là hướng phát triển, không làm sai dữ liệu
đang hiển thị. Không mục nào được tự động migration/seed/sửa document trong Prompt 4.

---

# GAP-8 — Chẩn đoán bằng dữ liệu thật + Fix write-path đã triển khai (2026-07-13)

## Bằng chứng (query read-only `lich_lam_viec`)
```
Tổng document:                     133
Số (bác sĩ + ngày-lịch VN) trùng:   21
Phân bố GIỜ:PHÚT (UTC) của `ngay`:
   00:00Z  -> 112 document   ← ghi bởi tiến trình múi giờ UTC (server/cron)
   17:00Z  ->  21 document   ← 00:00 giờ VN (+07) = 17:00Z → ghi bởi máy dev VN (+7)
```
Mỗi cặp trùng gồm đúng 1 bản `00:00Z` + 1 bản `17:00Z` cho cùng ngày lịch VN → xác nhận nguyên nhân:
`ngay` là `Date` (instant) phụ thuộc múi giờ tiến trình ghi; unique index `{doctor_id, ngay}` và các
chốt find-before-create so khớp theo instant nên bản `00:00Z` và `17:00Z` "cùng ngày" lọt qua.

## Đã sửa trong Prompt 4 — Lớp A+B+C+E (CHẶN LỖI MỚI, không đụng 21 bản cũ)
> Đây là thay đổi **CODE + config**, KHÔNG phải migration/seed/sửa document. Đã được người dùng
> phê duyệt rõ ràng. 21 document trùng cũ **giữ nguyên** (thuộc Lớp D bên dưới, cần Admin duyệt).

| Lớp | Nội dung | File |
|---|---|---|
| E | Ép `process.env.TZ='UTC'` cho toàn tiến trình (import đầu tiên) | `backend/src/config/timezone.js` (mới), `backend/src/index.js`, `backend/src/scripts/seed-doctor-test-data.js` |
| A/B | Helper `toScheduleDayUTC()` chuẩn hoá `ngay` về **00:00:00Z** độc lập múi giờ | `backend/src/services/scheduleGenerator.service.js`, `seed-doctor-test-data.js` (`startOfDay`) |
| C | `generateSlotsForDoctorDate` chuyển sang **upsert idempotent** `$setOnInsert` theo `{doctor_id, ngay}` (choke point ghi duy nhất) | `backend/src/services/scheduleGenerator.service.js` |

**Kiểm chứng**: server sau restart chạy offset 0 (UTC); `toScheduleDayUTC` luôn trả `00:00:00Z`; upsert
lại 1 ngày đã tồn tại → `upsertedCount=0`, tổng document `133 → 133` (không sinh bản trùng mới); backend
test **25/25**; browser E2E **0 console error**. Vì mọi ngày `17:00Z` legacy đều đã có bản `00:00Z` song
sinh, fix này **không** tạo thêm cặp trùng cho dữ liệu cũ.

## Còn lại — Lớp D (dọn 21 bản trùng cũ) — CHƯA làm, cần Admin/backend duyệt
- Script **2 pha**: (1) báo cáo read-only 21 cặp; (2) hợp nhất — giữ bản có dữ liệu thật (nhiều slot /
  có `booked` / có `LichHen.schedule_id` trỏ tới), trỏ lại lịch hẹn nếu cần, rồi mới xoá bản thừa.
- **Rủi ro cao**: nếu cả 2 bản đều có slot `booked` → đụng bệnh nhân thật. Phải backup collection trước
  và rà `LichHen` trước khi xoá. **Không tự động thực hiện** (điều kiện dừng).
- Lưu ý: sau khi ép TZ=UTC, các bản `17:00Z` legacy hiển thị lệch −1 ngày khi đọc ở môi trường UTC —
  đây chính là các bản "sai ngày" cần dọn; frontend vẫn cảnh báo trùng ở nơi còn co-located.
