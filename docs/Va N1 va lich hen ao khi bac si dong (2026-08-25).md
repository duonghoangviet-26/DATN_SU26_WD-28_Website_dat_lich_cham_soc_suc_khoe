# Vá N1 (đếm trùng bước 3 điều phối) + lịch hẹn ảo khi bác sĩ đã đóng — 2026-08-25

> Ledger gốc của N1/N2/N3/N4: `.superpowers/sdd/2026-08-25-quan-ly-va-dieu-phoi/progress.md`
> (dòng 90-111). Doc này là bản vá THẬT SỰ áp dụng cho 4 finding đó + 1 lỗi mới phát hiện
> ngoài phạm vi ledger (lịch hẹn ảo khi đặt cho bác sĩ đã đóng/nghỉ ở luồng lễ tân).

## Bối cảnh

Đợt gộp "Quản lý và điều phối" (`docs/Quan ly va dieu phoi - trien khai (2026-08-25).md`)
sửa 6 lỗi C1/C2/I1/I2/I3/I4 và đã commit (`f198296..c3792c4`, 5 commit). Một review sau đó
(opus re-review) phát hiện I1 và I2 — dù mỗi cái ĐÚNG riêng lẻ — khi CỘNG DỒN lại sinh ra
lỗi mới (N1), cộng thêm 3 lỗi Minor (N2-N4). Ledger ghi rõ hình dạng fix đúng nhưng **không**
tự sửa (đúng luật "one fix wave" của skill). Đây là lượt áp dụng bản vá đó.

## N1 (Important) — bước 3 ProcessBar báo "xong" sai vì cộng dồn 3 counter chồng lấn

### Vấn đề
`buoc3Xong = so_da_doi + so_khong_co_cho_da_xu_ly + so_da_ket_thuc >= so_lich_anh_huong`.

I1 thêm `so_da_ket_thuc` (đếm `da_huy`). I2 bỏ điều kiện `trang_thai` khỏi `so_khong_co_cho`.
Hệ quả: một lịch `da_huy` với `phuong_an.length === 0` VỪA rơi vào `so_khong_co_cho_da_xu_ly`
(nếu đã liên hệ) VỪA rơi vào `so_da_ket_thuc` — bị đếm **2 lần**. Tổng 3 counter có thể chạm
`so_lich_anh_huong` (báo "xong 100%") trong khi một lịch **khác hoàn toàn** vẫn treo chưa xử
lý. Đường thứ hai (không cần fix gì thêm, tự khỏi theo cách sửa dưới đây):
`chonPhuongAnTuDo` áp phương án cho lịch 0-phương-án mà không xoá `phuong_an` — lịch đó vừa
đếm ở `so_da_doi` vừa đếm ở `so_khong_co_cho` vĩnh viễn (callout tím "cần liên hệ tay" không
bao giờ tắt cho lịch này dù đã xong).

### Sửa
**`backend/src/controllers/admin/reschedule-approval.controller.js`** — `tongQuanTheoDonNghi`:
thay vì trả riêng 3 counter rồi để FE tự cộng, BE build một **Set id đã khử trùng lặp**
(hợp của `da_ap_dung` ∪ `da_huy` ∪ id đã liên hệ xong trong nhóm không-có-chỗ), trả thêm field
tính toán `so_hoan_tat: idsHoanTat.size` (KHÔNG thêm field DB — vẫn đúng ràng buộc toàn cục).
Giữ nguyên mọi counter cũ (`so_da_doi`, `so_khong_co_cho`, `so_khong_co_cho_da_xu_ly`,
`so_da_ket_thuc`) vì UI khác vẫn dùng chúng để hiển thị chi tiết từng loại.

**`frontend/src/utils/dieuPhoiHelpers.ts`** — `xepBuocQuyTrinh`: `buoc3Xong` đổi thành
`input.so_hoan_tat >= input.so_lich_anh_huong` — không tự cộng lại 3 counter nữa.

**`frontend/src/services/receptionist-reschedule-approvals.service.ts`**,
**`frontend/src/pages/receptionist/DieuPhoiLichHen.tsx`**: truyền `so_hoan_tat` từ API xuống
`xepBuocQuyTrinh(...)`.

**Test** (`frontend/src/__tests__/utils/dieuPhoiHelpers.test.ts`): cập nhật mọi lời gọi cũ để
truyền `so_hoan_tat` đúng giá trị dự kiến; thêm 2 case khoá hành vi:
- Tổng 3 counter riêng lẻ = 9 (chồng lấn, ≥ 5) nhưng `so_hoan_tat: 2` (dedup thật) → bước 3
  **PHẢI** báo `xong:false` — nếu ai vô tình quay lại công thức cộng cũ, test này đỏ ngay.
- `so_hoan_tat: 5` đủ dù tổng 3 counter riêng lẻ = 5 (thấp hơn `so_lich_anh_huong`) → bước 3
  **PHẢI** báo `xong:true` (chứng minh trường hợp `chonPhuongAnTuDo` ở trên tự đúng theo BE).

## N2 (Minor) — badge "Làm việc" nhầm cho ngày bác sĩ chưa đăng ký ca nhưng đã có đơn nghỉ

### Vấn đề
`xepTrangThaiTheBacSi` chỉ coi `trang_thai_ngay === 'nghi' | 'nghi_phep'` là đang nghỉ. Một
đơn nghỉ NHIỀU NGÀY phủ một ngày bác sĩ **chưa từng đăng ký ca** (không có `LichLamViec`) thì
`trang_thai_ngay = 'khong_co_lich'` — rơi vào nhánh mặc định `'lam_viec'` dù `leave_id` có
giá trị THẬT. Kết quả: badge xanh "Làm việc" + nút "Báo nghỉ đột xuất" sống, bấm vào 409 vì
đã có đơn nghỉ mà lễ tân không thấy màn hình nào xử lý.

### Sửa
`dangNghiTheoNgay = doctor.trang_thai_ngay !== 'lam_viec'` (thay vì liệt kê đúng 2 chuỗi) —
đã kiểm lại toàn bộ 8 test cũ, không có test nào assert hành vi ngược lại nên đổi an toàn.
Thêm 1 test case cho `trang_thai_ngay: 'khong_co_lich'`.

## N3 (Minor) — CHỦ ĐỘNG KHÔNG SỬA

Hệ quả trực tiếp của I4 (đúng như spec I4 yêu cầu): bác sĩ nghỉ MỘT KHUNG (mục 15) không còn
xuất hiện ở Tab 1 với chỉ số "Còn X/Y lịch chưa điều phối" — vẫn vào được qua Tab 2, không
phải ngõ cụt, chỉ mất một lối tắt. Ledger tự mô tả đây là "surface loss traded deliberately
for fixing the mislabeling" — cố gắng khôi phục lối tắt này có nguy cơ làm sống lại đúng lỗi
I4 vừa vá (badge nhầm cho nghỉ-một-khung). Không đụng.

## N4 (Minor) — chữ trên box amber suy diễn sai nguyên nhân

### Vấn đề
`laDonNganHanChoLeTan` trả `false` (⇒ cần Admin duyệt) vì HAI lý do khác nhau: (a) khoảng
nghỉ dài hơn 1 ngày, HOẶC (b) bác sĩ tự gửi đơn 1 ngày nhưng cho một ngày xa hơn ngày mai.
Box amber cũ chốt cứng "Khoảng nghỉ dài hơn 1 ngày" — sai với case (b).

### Sửa
`frontend/src/components/receptionist/DoctorUnavailableModal.tsx`: đổi câu chỉ nói tới HỆ QUẢ
thật ("vượt thẩm quyền lễ tân xử lý trực tiếp — cần Admin duyệt"), không suy diễn nguyên nhân.

## Lỗi MỚI (ngoài phạm vi ledger) — lịch hẹn ảo khi đặt walk-in cho bác sĩ đã đóng/nghỉ

### Phát hiện
`backend/src/controllers/receptionist/booking.controller.js` — `createBooking` (luồng lễ
tân đặt tại quầy) có **3 lỗ hổng** không tồn tại ở `patient/booking.controller.js`:

1. **Nhánh chọn thủ công (`else`, không phải `doctor_id==='auto'`)**: tra bác sĩ bằng
   `BacSi.findOne({_id: doctor_id})` — **KHÔNG lọc** `trang_thai_duyet:'approved'` /
   `la_hien:true`. Nếu admin vừa khoá/ẩn bác sĩ SAU khi trang lễ tân đã tải (dữ liệu cũ trên
   trình duyệt), lễ tân vẫn đặt được cho bác sĩ đã "đóng" — tạo lịch hẹn không ai tiếp nhận,
   khách đã trả tiền (`payment_method:'cash'` → `payment_status:'paid'` NGAY LÚC TẠO) nhưng
   không có bác sĩ thật khám — đúng mô tả "lịch hẹn ảo gây lỗi thanh toán".
2. **Cùng nhánh**: tra `LichLamViec` bằng `{_id: schedule_id, doctor_id: doc._id}` — KHÔNG
   lọc `trang_thai_ngay:'lam_viec'`. Bác sĩ vừa báo nghỉ CẢ NGÀY sau khi trang tải vẫn đặt
   được nếu (hiếm nhưng có thể) slot cụ thể chưa kịp bị khoá.
3. **Cả 2 nhánh (auto lẫn thủ công)**: câu query `LichLamViec.find({"slots.gio_bat_dau":...,
   "slots.status":"active"})` và `findOneAndUpdate({"slots._id":..., "slots.status":"active"})`
   viết RỜI từng điều kiện trên mảng `slots`, không gói `$elemMatch` — đúng lỗi "claim slot
   sai phần tử mảng" mà rule mục 9 (P0) ghi đã sửa ở `patient/booking.controller.js` **và**
   claim ở đây, nhưng thực tế file lễ tân này KHÔNG hề dùng `$elemMatch` ở đâu cả (đã grep
   xác nhận). Hệ quả: chỉ cần lịch còn BẤT KỲ slot 'active' nào (giờ khác) là điều kiện
   `status` đã thoả — không đảm bảo đúng SLOT khách chọn còn trống/chưa bị khoá nghỉ phép.

### Sửa
`backend/src/controllers/receptionist/booking.controller.js` — `createBooking`:
- Nhánh thủ công: thêm `trang_thai_duyet:'approved', la_hien:true` vào tra bác sĩ (khớp
  đúng pattern nhánh "auto" và `patient/booking.controller.js` đã dùng), thêm
  `trang_thai_ngay:'lam_viec', trang_thai_xac_nhan:{$ne:'tu_choi'}` vào tra lịch làm việc.
- Câu query candidate schedules (nhánh auto) và `findOneAndUpdate` claim (cả 2 nhánh): gói
  lại trong MỘT `$elemMatch` mỗi nơi, thêm điều kiện `bi_khoa_boi_nghi_phep: {$ne: true}`
  (trước đây không hề kiểm tra field này ở file lễ tân, dù nó là cờ chính đánh dấu slot bị
  khoá do nghỉ phép — mục 15).
- Chọn slot theo giờ ở nhánh auto (`schedule.slots.find(s => s.gio_bat_dau === ...)`) trước
  đây chỉ khớp GIỜ — nếu khung có nhiều slot cùng giờ (TMH 2 slot/khung), có thể trúng đúng
  slot đã khoá trong khi slot còn lại (cùng giờ) vẫn trống. Nay lọc đủ điều kiện
  (`status==='active' && !benh_nhan_id && !bi_khoa_boi_nghi_phep`) khi chọn.
- Câu kiểm tra cuối trước khi tạo lịch hẹn (`if (!slot || slot.status !== 'active')`) thêm
  `|| slot.benh_nhan_id || slot.bi_khoa_boi_nghi_phep` cho rõ ràng, đổi thông báo lỗi nêu rõ
  khả năng "bác sĩ đã báo nghỉ đúng khung này".

### KHÔNG đụng
- `patient/booking.controller.js` — đã đúng từ trước (có `$elemMatch`, có lọc
  `trang_thai_duyet`/`la_hien`/`trang_thai_ngay` ở mọi nhánh), dùng làm mẫu đối chiếu.
- `receptionist/booking.controller.js` — `getSlots`/`getAvailability`/`getDoctorDayOverview`:
  đã lọc đúng ở tầng hiển thị (`trang_thai_duyet`, `la_hien`, `trang_thai_ngay`, và
  `status==='active'` loại slot đã `locked` do nghỉ) — không có gì để sửa, lỗ hổng chỉ nằm ở
  bước GHI (`createBooking`), không nằm ở bước ĐỌC.
- Không thêm field DB, không đổi schema — chỉ thêm điều kiện lọc vào query có sẵn.

## Bằng chứng kiểm thử

- Backend `node --check` sạch trên cả 2 file controller đã sửa.
- Backend `npm test`: **189 test, 184 pass, 5 fail** — giống hệt baseline đã biết
  (`POST /doctor/leaves...`, không liên quan phạm vi sửa này).
- Frontend `npx vitest run`: **17 file, 82 test pass** (79 cũ + 3 mới: 2 case N1 dedup + 1
  case N2 `khong_co_lich`).
- Frontend `npm run typecheck`: vẫn đúng 3 lỗi pre-existing (`ManageDoctorLeaves.tsx`,
  `DoctorProfile.tsx` ×2), không có lỗi mới.
- ESLint (`--max-warnings 0`) trên toàn bộ 5 file frontend đã sửa: sạch.
- **KHÔNG THỰC HIỆN ĐƯỢC**: kiểm thử tay qua trình duyệt/dev server thật (môi trường job nền
  không có). Lỗi "lịch hẹn ảo" đặc biệt cần một người thật: (1) khoá/ẩn một bác sĩ, (2) mở
  sẵn trang đặt lịch lễ tân TRƯỚC khi khoá (mô phỏng dữ liệu cũ trên trình duyệt), (3) thử đặt
  — xác nhận nay bị chặn 404/400 thay vì tạo được lịch.

## File đã sửa

Backend:
- `backend/src/controllers/admin/reschedule-approval.controller.js` (N1)
- `backend/src/controllers/receptionist/booking.controller.js` (lịch hẹn ảo)

Frontend:
- `frontend/src/utils/dieuPhoiHelpers.ts` (N1, N2)
- `frontend/src/__tests__/utils/dieuPhoiHelpers.test.ts` (N1, N2 — TDD)
- `frontend/src/services/receptionist-reschedule-approvals.service.ts` (N1)
- `frontend/src/pages/receptionist/DieuPhoiLichHen.tsx` (N1)
- `frontend/src/components/receptionist/DoctorUnavailableModal.tsx` (N4)
