# Sửa đổi — Ngày tái khám / Số ngày uống thuốc + Đối chiếu field "Kết quả khám" với DB

> Thực hiện theo yêu cầu trực tiếp (không phải audit-only). 2 mục đầu **đã sửa code**, mục 3 **chỉ đối chiếu/báo cáo, chưa sửa**.

---

## 1. Ngày tái khám — bắt buộc từ ngày tiếp theo trở đi

**Trước:** input `type="date"` không có giới hạn `min`; backend (`createResult`/`updateResult`) nhận `ngay_tai_kham` bất kỳ, không validate.

**Sau:**
- Backend (`backend/src/controllers/doctor/appointments.controller.js`): thêm helper `isNgayTaiKhamHopLe(ngayTaiKham, ngayKham)` — so sánh theo ngày (bỏ giờ), bắt buộc `ngay_tai_kham > ngay_kham`. Áp dụng ở cả `createResult()` và `updateResult()` (khi `ngay_tai_kham` được truyền), trả `400` nếu vi phạm. Đây là chặn ở **backend** — nguồn sự thật, không tin riêng validate FE.
- Frontend (`DoctorAppointments.tsx`, `ExamModal`): thêm `min={minNgayTaiKham}` cho input ngày tái khám, tính từ `appt.ngay_kham + 1 ngày` — chặn chọn ngay trên UI trước khi gọi API.

**Lý do dùng `ngay_kham` (ngày khám của lịch hẹn) làm mốc, không dùng "hôm nay":** nếu bác sĩ nhập kết quả trễ hơn ngày khám thực tế (vẫn được phép — xem `createResult` cho phép nhập cả khi `status='completed'`), mốc so sánh đúng nghiệp vụ phải là ngày diễn ra buổi khám, không phải ngày bác sĩ ngồi gõ máy.

## 2. Đơn thuốc — dùng "số ngày uống" thay vì khoảng ngày bắt đầu/kết thúc

**Trước:** `DonThuoc.items` có `ngay_bat_dau`, `ngay_ket_thuc` (2 field `Date`, bắt buộc), validate chênh lệch tối đa 90 ngày.

**Sau:**
- `backend/src/models/DonThuoc.js`: bỏ `ngay_bat_dau`/`ngay_ket_thuc` + hook `pre('validate')` tính chênh lệch ngày. Thay bằng 1 field duy nhất `so_ngay: Number, required, min 1, max 90` (giữ nguyên hằng số `MAX_NGAY = 90` đã có).
- `frontend/src/types/index.ts` (`PrescriptionDrug`): bỏ `ngay_bat_dau`/`ngay_ket_thuc`, thêm `so_ngay: number`.
- `frontend/src/pages/doctor/DoctorAppointments.tsx` (`ExamModal`): bỏ 2 ô chọn ngày, thay bằng 1 ô số "Số ngày uống" (min 1, max 90, mặc định 7 khi thêm thuốc mới); cập nhật `EMPTY_DRUG`, `addDrug()`, và phần load lại thuốc đã có (`useEffect`) theo field mới.
- Số liều/ngày **không cần thêm field riêng** — đã có sẵn qua độ dài mảng `gio_uong` (mỗi giờ = 1 liều) và mô tả `tan_suat` (vd "3 lần/ngày") — đúng như yêu cầu "1 ngày bao nhiêu liều" đã có cách thể hiện, không thiếu.

**Đã cập nhật luôn 3 script seed** để không bị lỗi validate khi chạy lại (không thuộc yêu cầu gốc nhưng bắt buộc để tránh script hỏng ngay sau khi đổi schema): `backend/src/scripts/seed-doctor-test-data.js`, `backend/src/scripts/seed-all.js`, `backend/scripts/demo-seed/_demo-dataset.js` — đổi `ngay_bat_dau`/`ngay_ket_thuc` → `so_ngay` tương ứng (giữ nguyên số ngày gốc: 3 hoặc 5 tùy dòng).

**Đã kiểm tra không phá vỡ luồng khác:** grep toàn bộ `backend/src` và `frontend/src` cho `ngay_bat_dau`/`ngay_ket_thuc` trước khi sửa — chỉ xuất hiện ở model + 3 script seed + `DoctorAppointments.tsx` + `types/index.ts` (đã liệt kê hết ở trên). **Không có cron/job nào thật sự tạo `NhacNho` (nhắc uống thuốc) từ 2 field này** — model `NhacNho` đã tồn tại (comment nói "cron 5 phút") nhưng grep xác nhận **không có route/controller/cron nào ghi `NhacNho`** — tính năng nhắc thuốc tự động chỉ là scaffolding, chưa triển khai. Vì vậy đổi schema lần này **an toàn, không có luồng nào phụ thuộc ngầm vào khoảng ngày cũ**.

---

## 3. Đối chiếu "Kết quả khám" (trang bác sĩ) với DB — thiếu/thừa/đề xuất

So sánh 3 lớp: **DB (`KetQuaKham` model)** ↔ **kiểu dữ liệu FE (`ExaminationResult`, `types/index.ts`)** ↔ **UI thực tế (`ExamModal`, `DoctorAppointments.tsx`)**.

| Field trong DB (`KetQuaKham`) | Có trong type FE `ExaminationResult`? | Có hiển thị/sửa trên UI? | Kết luận |
|---|---|---|---|
| `chan_doan` | ✅ | ✅ (bắt buộc) | Khớp |
| `huong_dan_dieu_tri` | ✅ | ✅ | Khớp |
| `ghi_chu` | ✅ | ✅ | Khớp |
| `ngay_tai_kham` | ✅ | ✅ (đã thêm ràng buộc ở mục 1) | Khớp |
| `co_the_sua` | ✅ | ✅ (dùng để khóa form, không cho sửa trực tiếp) | Khớp |
| `status` | ❌ **thiếu trong `ExaminationResult`** | ⚠️ hiển thị gián tiếp qua `DoctorAppointmentDetail.ket_qua_status` (fetch riêng từ API list, không phải từ chính `ExaminationResult`) | Không sai chức năng nhưng là 2 nguồn dữ liệu cho cùng 1 field — nếu sau này 2 API lệch nhịp cache, badge trạng thái có thể hiển thị sai so với nội dung modal đang mở |
| `nguoi_nhap_id`, `bac_si_phu_trach_id` | ❌ thiếu | ❌ không hiển thị | Chấp nhận được hiện tại (luôn là chính bác sĩ đang xem — xem [[Phan tich - Chuc nang xac nhan ho so kham (2026-07-10)]]), nhưng sẽ **cần** khi có module y tá — lúc đó "ai nhập hồ sơ" phải hiển thị rõ |
| `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan` | ❌ **thiếu** | ❌ không hiển thị dù đã ghi vào DB khi bác sĩ bấm "Xác nhận hồ sơ" | **Gap thật**: dữ liệu được ghi (`confirmResult()` set cả 2 field) nhưng không ai đọc lại — bác sĩ xác nhận xong không có cách nào tự xem lại "mình xác nhận lúc nào" trên chính giao diện đó |
| `lich_su_sua[]` (lịch sử yêu cầu chỉnh sửa) | ❌ **thiếu trong type, dù backend đã trả về** | ❌ **không hiển thị ở đâu cả** | **Gap đáng chú ý nhất**: `getResult()` trả `{...result}` (spread toàn bộ document, gồm cả `lich_su_sua`) nhưng type `ExaminationResult` không khai báo field này nên FE không đọc, không hiển thị. Hệ quả: bác sĩ bấm "Yêu cầu chỉnh sửa" (bắt buộc nhập lý do) → lý do được lưu vào `lich_su_sua` → nhưng khi mở lại `ExamModal` để sửa, **không thấy lại lý do mình vừa yêu cầu** — phải nhớ trong đầu. Nên thêm `lich_su_sua` vào `ExaminationResult` type + hiển thị dòng cuối cùng (nếu `status === 'yeu_cau_chinh_sua'`) ngay trong `ExamModal` |
| `dich_vu_phat_sinh[]`, `dich_vu_tu_choi[]` | ❌ thiếu | ❌ không có UI nhập | Đã biết từ trước — field tồn tại trong DB nhưng chưa từng được ghi bởi bất kỳ controller nào (kể cả sau khi thêm điều kiện `WAITING_PAYMENT` ở lần sửa trước) — **thừa thật sự** cho tới khi có quyết định làm luồng dịch vụ phát sinh |
| `chi_dinh_tai_kham` (boolean) | ❌ thiếu | ❌ không có checkbox riêng | UI hiện chỉ có ô ngày `ngay_tai_kham` — nếu bác sĩ để trống thì ngầm hiểu "không chỉ định tái khám", nhưng field boolean riêng trong DB thì **luôn `false` mặc định, không ai set `true`** dù có nhập `ngay_tai_kham`. Nên xử lý 1 trong 2 hướng: (a) bỏ hẳn field `chi_dinh_tai_kham` nếu `ngay_tai_kham` đã đủ diễn đạt ý này, hoặc (b) tự động set `chi_dinh_tai_kham = true` trong `createResult`/`updateResult` khi có `ngay_tai_kham` — hiện tại là **thừa/không đồng bộ** |
| `da_dat_lich_tai_kham`, `da_gui_cho_benh_nhan` (boolean) | ❌ thiếu | ❌ không dùng | Grep xác nhận không có controller nào set giá trị khác `false` mặc định — **thừa hoàn toàn**, chưa có luồng nào cần tới |

### Phát hiện phụ liên quan (ngoài chính `KetQuaKham` nhưng cùng domain "kết quả khám")

- **`HoSoYTe` (hồ sơ y tế cá nhân bệnh nhân) không được tự tạo khi bác sĩ nhập kết quả khám**, dù comment trong chính model (`HoSoYTe.js:7`) mô tả `nguon: 'tu_kham'` = *"tự tạo từ appointment khi bác sĩ ghi kết quả (B4)"*. Grep `HoSoYTe.create` trong toàn `backend/src`: chỉ có 1 chỗ duy nhất — trong `scripts/seed-all.js` (dữ liệu giả), **không có trong `createResult()` thật**. Nghĩa là bệnh nhân xem "Hồ sơ y tế" của mình (nếu trang đó đọc từ `HoSoYTe`) sẽ **không tự động thấy** các lần khám qua đặt lịch — cần xác nhận với nhóm đây có phải thiết kế cố ý (2 khái niệm tách biệt: `KetQuaKham` = "kết quả 1 lần khám qua hệ thống", `HoSoYTe` = "bệnh nhân tự khai lịch sử khám nơi khác") hay là 1 bug thiếu tích hợp.
- **`DonThuoc` có 2 field trỏ tới "hồ sơ khám" nhưng dùng lẫn lộn**: schema khai `ket_qua_kham_id: ref 'KetQuaKham'` (đúng ngữ nghĩa) và `medical_record_id: ref 'HoSoYTe'` (khác collection hẳn). Nhưng thực tế code (`doctor/appointments.controller.js:createResult`, `patient/records.controller.js:71`) đều **set/query qua `medical_record_id` bằng chính `KetQuaKham._id`** — tức lưu ID của 1 collection vào field khai `ref` tới collection khác. Không gây lỗi runtime (Mongoose không ép kiểu `ref` lúc query bằng `findOne`), nhưng là **field thừa/đặt sai tên** gây khó hiểu khi đọc lại code sau này — đã được ghi nhận trước đó ngay trong comment của `seed-doctor-test-data.js`.

### Tổng kết đề xuất riêng cho mục 3 (chưa làm — cần bạn xác nhận trước)

| Ưu tiên | Đề xuất | File cần sửa nếu làm |
|---|---|---|
| Cao | Thêm `lich_su_sua` vào `ExaminationResult`, hiển thị lý do yêu cầu sửa gần nhất trong `ExamModal` khi `status = yeu_cau_chinh_sua` | `types/index.ts`, `DoctorAppointments.tsx` |
| Trung bình | Thêm `nguoi_xac_nhan_id`+`thoi_diem_xac_nhan` vào type, hiển thị "Đã xác nhận lúc..." khi `da_xac_nhan` | như trên |
| Thấp | Quyết định giữ/bỏ `chi_dinh_tai_kham`, `da_dat_lich_tai_kham`, `da_gui_cho_benh_nhan`, `dich_vu_phat_sinh`, `dich_vu_tu_choi` — hiện đều là field chết | `KetQuaKham.js` (nếu bỏ) hoặc controller (nếu làm cho sống) |
| Cần xác nhận nghiệp vụ | `HoSoYTe` có nên tự tạo từ `createResult()` không | `doctor/appointments.controller.js` |

---
*2 mục đầu đã sửa và có thể chạy thử ngay. Mục 3 chỉ là đối chiếu — chưa đụng code, chờ bạn chọn hạng mục nào cần làm tiếp.*
