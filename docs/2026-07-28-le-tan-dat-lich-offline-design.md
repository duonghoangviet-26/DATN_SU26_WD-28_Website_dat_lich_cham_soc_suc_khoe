# Thiết kế: Lễ tân tiếp nhận khách vãng lai (walk-in) tại quầy

> Ngày: 2026-07-28
> Rule bắt buộc tuân thủ: `.claude/rules/lich-lam-viec-bac-si.md` (đặc biệt mục 4, 6, 11, 12, 13).
> Audit lỗ hổng đi kèm: `docs/lo-hong-dat-lich-offline-le-tan-2026-07-28.md`.

## 1. Bối cảnh & vấn đề

Khách đến trực tiếp quầy lễ tân (không đặt trước), cần: lễ tân hỏi tên + số điện thoại, tra cứu xem
đã là khách cũ chưa (có tài khoản online, là thành viên gia đình ai đó, hoặc từng là khách vãng lai),
nếu chưa có thì tạo hồ sơ mới — sau đó tìm bác sĩ đang có khung khám trống **gần nhất/đang rảnh nhất**
để đưa khách vào khám, có xét tới việc hàng đợi bác sĩ đó đang đông hay không.

Trang "Tạo lịch khám" hiện tại của lễ tân (`frontend/src/pages/receptionist/Booking.tsx` + 4 bước
`BookingStep1-4`, backend `receptionist/booking.controller.js: createBooking`) là bản sao luồng đặt
online: cho chọn ngày trong 7 ngày tới, gán bác sĩ bằng `Math.random()`, có bước thanh toán VNPAY.
Đây là kiến trúc **sai theo rule mục 13** — lễ tân không được chạm slot online hay chọn ngày tương
lai. Audit chi tiết các lỗ hổng cụ thể (đang khai thác được) nằm ở file audit đính kèm.

**Quyết định:** thay thế hoàn toàn trang này bằng luồng walk-in mới, chỉ hoạt động cho HÔM NAY, chỉ
slot `walk_in`, không có bước thanh toán.

## 2. Phạm vi

**Trong phạm vi:**
- Tra cứu khách hàng theo số điện thoại (tài khoản đã đăng ký + khách vãng lai cũ).
- Tạo hồ sơ khách vãng lai mới (`KhachVangLai`) khi không tìm thấy.
- Hiển thị danh sách bác sĩ đang có thể tiếp nhận NGAY (khung hiện tại/kế tiếp, cùng ca, hôm nay),
  kèm số người đang chờ + cảnh báo quá tải, lễ tân chọn tay.
- Check-in khách vào `HangDoi` của bác sĩ đã chọn.

**Ngoài phạm vi (nợ kỹ thuật đã biết, xử lý ở spec riêng sau):**
- Tạo hoá đơn/thu tiền sau khi khám xong cho khách vãng lai không có `LichHen` (mục B6 trong audit).
  Khuyến nghị tối thiểu: thêm danh sách cuối ca "đã hoàn thành nhưng chưa có hoá đơn" để đối chiếu
  thủ công — nhưng bản thân cơ chế tạo hoá đơn này KHÔNG nằm trong spec này.
- Đa chi nhánh (`chi_nhanh_id`) cho `KhachVangLai` — model hiện không có field này; nếu phòng khám
  chỉ có 1 chi nhánh thì không cần xử lý ngay.

## 3. Kiến trúc tổng thể — 3 bước

```
Bước 1: Tìm/tạo khách        Bước 2: Chọn bác sĩ trống       Bước 3: Xác nhận
─────────────────────        ──────────────────────────      ─────────────────
Nhập SĐT → tra cứu      →    Chọn chuyên khoa → thấy      →  Xem lại thông tin
NguoiDung + KhachVangLai     danh sách bác sĩ đang rảnh       → Check-in vào
Có thì chọn hồ sơ/thành      kèm số người đang chờ,           hàng đợi (HangDoi)
viên gia đình; không thì     giờ khung gần nhất, cảnh          NGAY — không thu
tạo KhachVangLai mới         báo quá tải → lễ tân chọn 1       tiền, không tạo
                             bác sĩ                            LichHen ở bước này
```

Tái dùng tối đa hạ tầng đã có: `checkInVangLai()` (services/checkIn.service.js), `HangDoi` model,
`walkInWindow.service.js`, `queueOverflow.service.js`. Không tạo `LichHen`/`HoaDon`/`ThanhToan` ở
luồng này.

## 4. API & luồng dữ liệu

### 4.1 Tra cứu khách hàng — Bước 1

```
GET /api/receptionist/walkin/patients?phone=0912345678
```

Thứ tự tìm kiếm phía server:
1. `NguoiDung` (role `user`/`patient`, `status: active`, `so_dien_thoai` khớp chính xác) → nếu có,
   gọi trực tiếp hàm `getFamilyGroup()` đã có sẵn (`receptionist/booking.controller.js`, dùng
   `user._id` vừa tìm được) để lấy danh sách thành viên gia đình — không viết lại logic này.
2. Không có → tìm `KhachVangLai` theo `so_dien_thoai` (có thể ra nhiều bản ghi — hộ gia đình dùng
   chung số điện thoại).
3. Không thấy gì → trả mảng rỗng, FE hiện form tạo khách mới.

**An toàn (audit B3):**
- Chỉ trả `ho_ten`, `ngay_sinh`, `gioi_tinh` ở bước tìm kiếm — KHÔNG trả `di_ung`, `benh_nen` hay dữ
  liệu y tế nhạy cảm khác. Chi tiết y tế chỉ hiện sau khi lễ tân đã chọn đúng hồ sơ (màn hình khác,
  ngoài phạm vi bước tra cứu này).
- Mỗi lần gọi endpoint này PHẢI ghi một bản ghi `NhatKyThaoTac` (`hanh_dong: 'TRA_CUU_KHACH_WALKIN'`,
  `nguoi_thuc_hien_id`, số điện thoại đã tra) — theo đúng tiền lệ của `getAvailability()` hiện có.
  Mục đích: nếu sau này phát hiện một tài khoản lễ tân dò hàng loạt số điện thoại, có dấu vết để
  điều tra.

### 4.2 Tạo khách vãng lai mới — Bước 1 (khi không tìm thấy)

```
POST /api/receptionist/walkin/guests   { ho_ten, so_dien_thoai, ngay_sinh?, gioi_tinh? }
```

Tái dùng nguyên `createGuestPatient()` từ `admin/guest-patients.controller.js` — thêm route cho
receptionist gọi tới cùng hàm, KHÔNG viết lại logic.

**An toàn (audit B5):** trước khi tạo, kiểm tra lại `so_dien_thoai` đã tồn tại trong `KhachVangLai`
chưa (dùng lại kết quả bước 4.1 nếu FE vừa tra cứu; hoặc kiểm tra lại phía server để tránh race
condition hai lễ tân tạo trùng lúc). Nếu trùng, KHÔNG tạo âm thầm — trả cảnh báo
`409 { trung_so_dien_thoai: [...các bản ghi trùng] }` để FE hỏi lại lễ tân "đây có phải người khác
không?" trước khi cho phép tạo tiếp (force=true để xác nhận vẫn tạo).

### 4.3 Danh sách bác sĩ đang rảnh — Bước 2

```
GET /api/receptionist/walkin/available-doctors?specialty_id=...
```

File mới: `backend/src/services/walkInAssignment.service.js` (tách khỏi `doctorAssignment.service.js`
vì đây là quy tắc RIÊNG cho walk-in, không lẫn với mục 12 online — khác cả điều kiện lọc slot lẫn
tiêu chí sắp xếp).

Thuật toán:
1. Lấy bác sĩ `trang_thai_duyet: 'approved', la_hien: true` thuộc chuyên khoa, có `LichLamViec` hôm
   nay (`trang_thai_ngay: 'lam_viec'`, `trang_thai_xac_nhan: { $ne: 'tu_choi' }`).
2. Với mỗi bác sĩ: áp `locSlotBanTaiQuay(schedule, now)` (đã có, `walkInWindow.service.js`) để lấy
   slot `walk_in` hợp lệ ở khung hiện tại/kế tiếp. Không còn slot nào → loại khỏi danh sách.
3. Với bác sĩ còn slot: đếm `HangDoi.countDocuments({doctor_id, trang_thai: { $in: ['dang_cho',
   'da_goi', 'trong_phong'] } })` (dùng đúng tập trạng thái mà `queueOverflow.service.js` đang coi là
   "đang chiếm chỗ", KHÔNG tự định nghĩa tập trạng thái mới — tránh lệch với logic quá tải đã có);
   gọi `kiemTraQuaTai(doctorId)` lấy cảnh báo quá tải nếu có.
4. Sắp xếp: (1) không có cảnh báo quá tải trước, (2) số người chờ tăng dần, (3) giờ khung gần nhất
   sớm hơn trước, (4) `doctor_id` tăng dần (tie-break xác định, không random).
5. Trả về `{doctor_id, ho_ten, anh_dai_dien, so_nguoi_dang_cho, khung_gan_nhat, canh_bao_qua_tai}[]`.
   Bác sĩ quá tải vẫn hiện (lễ tân có thể vẫn cần chọn nếu không còn ai khác) nhưng xếp cuối, có badge
   cảnh báo rõ ràng.

**An toàn (audit B4):** ghi lại trong response (không cần hiện lên UI) bác sĩ nào đứng ĐẦU danh sách
(gợi ý của hệ thống) để đối chiếu với bác sĩ lễ tân THỰC CHỌN ở bước 4.4 — phục vụ audit thiên vị về
sau, không chặn quyền chọn tay của lễ tân.

### 4.4 Check-in — Bước 3

```
POST /api/receptionist/walkin/checkin
{
  doctor_id, specialty_id,
  khach: { loai: 'nguoi_dung' | 'thanh_vien' | 'khach_vang_lai' | 'moi', id?, ho_ten, so_dien_thoai, tuoi?, gioi_tinh? },
  ly_do_kham?
}
```

Mở rộng `checkInVangLai()` (services/checkIn.service.js) để nhận thêm `memberId`/`khachVangLaiId`
optional và lưu vào field đã có sẵn trên `HangDoi` (`member_id`, `khach_vang_lai_id` — tồn tại trong
schema nhưng chưa từng được set ở bất kỳ đâu). KHÔNG đổi schema `HangDoi`.

**An toàn bắt buộc trước khi tạo `HangDoi` (audit B1, B2):**
1. **Chống trùng hàng đợi (B1):** kiểm tra đã có `HangDoi` đang hoạt động
   (`trang_thai: { $in: ['dang_cho','da_goi','trong_phong'] }`) cùng `so_dien_thoai` (hoặc cùng
   `member_id`/`khach_vang_lai_id` nếu có) trong HÔM NAY chưa. Nếu có → trả `409` kèm thông tin lượt
   đang chờ đó, KHÔNG tạo thêm — chặn tình huống 2 lễ tân check-in trùng 1 người vào 2 bác sĩ.
2. **Xác thực lại tại thời điểm submit, không tin danh sách client gửi lên (B2):** gọi lại
   `locSlotBanTaiQuay` cho đúng `doctor_id` NGAY trong request này. Nếu khung đã đổi (đã hết
   khung hiện tại/kế tiếp, hoặc bác sĩ vừa hết slot walk-in) → trả `409` rõ ràng, yêu cầu FE tải lại
   danh sách bác sĩ ở bước 2 thay vì âm thầm chấp nhận theo dữ liệu cũ.

Sau khi qua 2 kiểm tra trên mới gọi `checkInVangLai()` để tạo `HangDoi`.

## 5. UI — 3 bước, dùng lại khung Stepper hiện có

Giữ nguyên component Stepper (`renderStepper` trong `receptionist/Booking.tsx`), đổi 4→3 bước và đổi
nhãn. Xoá hẳn `BookingStep4Payment.tsx` và toàn bộ state VNPAY/QR/chọn-ngày-7-ngày trong
`Booking.tsx`. Viết lại `BookingStep1DateSlot.tsx` → đổi thành bước tìm/tạo khách;
`BookingStep2PatientInfo.tsx` → đổi thành bước chọn chuyên khoa + bác sĩ; `BookingStep3Confirm.tsx` →
giữ vai trò xác nhận nhưng bỏ phần thanh toán.

- **Bước 1:** ô nhập SĐT + nút tra cứu (debounce) → card kết quả (chọn đúng hồ sơ/thành viên gia
  đình) hoặc form tạo khách mới nếu không tìm thấy (có cảnh báo trùng SĐT nếu xảy ra — mục 4.2).
- **Bước 2:** chọn chuyên khoa (pill giống `Booking.tsx` phía patient) → danh sách card bác sĩ (ảnh,
  tên, số người chờ nổi bật, khung giờ gần nhất, badge cảnh báo quá tải nếu có) → bấm chọn 1.
- **Bước 3:** tóm tắt khách + bác sĩ + chuyên khoa, ô triệu chứng sơ bộ (optional) → nút "Xác nhận &
  đưa vào hàng đợi" → gọi API check-in → toast thành công + số thứ tự ước tính → điều hướng về
  `/receptionist/appointments` hoặc trang hàng đợi.

## 6. Xử lý lỗi / edge case (tổng hợp từ audit)

| Tình huống | Xử lý |
|---|---|
| Không chuyên khoa nào còn bác sĩ rảnh | Thông báo rõ, gợi ý khách đặt online cho khung sau — KHÔNG giữ chỗ giả |
| Bác sĩ vừa hết slot walk-in giữa lúc thao tác (race) | `checkin` tự kiểm tra lại `locSlotBanTaiQuay`, trả 409, FE tải lại danh sách bác sĩ (mục 4.4.2) |
| SĐT trùng nhiều `KhachVangLai` (hộ gia đình chung số) | Hiển thị tất cả, không tự chọn đại 1 người |
| Tạo khách mới nhưng SĐT đã tồn tại | Cảnh báo xác nhận, không tạo âm thầm (mục 4.2) |
| Cùng một khách bị check-in 2 lần (2 lễ tân) | Chặn ở tầng service trước khi tạo `HangDoi` (mục 4.4.1) |
| Lễ tân luôn chọn 1 bác sĩ bất kể gợi ý | Không chặn cứng (đã chốt lễ tân được chọn tay), nhưng ghi log gợi ý-vs-thực-chọn để đối chiếu (mục 4.3 bước 5) |

## 7. Kế hoạch kiểm thử tối thiểu

Dựa trên các test case đã liệt kê trong audit (`docs/lo-hong-dat-lich-offline-le-tan-2026-07-28.md`),
implementation plan (bước tiếp theo, qua `writing-plans`) cần có test cho tối thiểu:
- Không thể lấy được slot có `loai_slot='online'` hay ngày khác hôm nay qua endpoint mới.
- Gọi `checkin` 2 lần liên tiếp cùng khách → lần 2 bị chặn 409.
- Giả lập khung vừa đóng giữa lúc tải danh sách và lúc check-in → bị chặn 409, không tạo `HangDoi`.
- Tra cứu SĐT ghi đúng 1 bản ghi `NhatKyThaoTac` mỗi lần gọi.
- Tạo khách mới trùng SĐT → nhận cảnh báo, không tự tạo bản ghi thứ hai nếu không xác nhận `force`.
