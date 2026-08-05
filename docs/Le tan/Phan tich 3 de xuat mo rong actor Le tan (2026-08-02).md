# Phân tích 3 đề xuất mở rộng actor Lễ tân + kịch bản phản biện

Ngày lập: **2026-08-02** · Nhánh: `Bac_si`

Tài liệu phân tích 3 đề xuất bổ sung cho lễ tân, và rà soát các tình huống mà hội đồng
chấm có thể hỏi để bảo đảm hệ thống trả lời được.

Ba đề xuất:

1. **Lịch sử thao tác** — lưu ở thao tác nào, actor nào ghi, lễ tân có thấy được admin và
   bác sĩ đã sửa gì không.
2. **Tiếp nhận tại quầy** — làm rõ hai đối tượng: khách đã đặt online và khách offline.
3. **Khám kéo dài** — hàng đợi bị đẩy xa thì lễ tân xử lý thế nào.

## Kết luận nhanh

| Đề xuất | Backend | Frontend | Kết luận |
|---|---|---|---|
| 1. Lịch sử thao tác | ⚠️ có nhưng phân mảnh | ❌ | **Có lỗ hổng thật** — lễ tân không thấy admin sửa gì (§A.3) |
| 2. Tiếp nhận 2 đối tượng | ✅ đã đủ, kể cả chọn bác sĩ rảnh | ⚠️ luồng chưa rõ | Chủ yếu là việc **làm rõ UI**, không phải xây mới |
| 3. Khám kéo dài | ⚠️ cảnh báo có, điều phối chưa | ⚠️ | **Thiếu 3 chức năng** (§C.3) |

---

# PHẦN A — Lịch sử thao tác

## A.1 Hiện trạng: ba hệ thống lịch sử chạy song song, không nối nhau

| Hệ thống | Lưu gì | Phạm vi | `vai_tro` cho phép |
|---|---|---|---|
| `LichSuLichHen` | Lịch sử của **một lịch hẹn**: trạng thái, thanh toán, bác sĩ, ngày/giờ, slot, phòng — đều có cũ/mới | Lịch hẹn | `admin` `doctor` `user` `receptionist` `system` |
| `NhatKyThaoTac` | Audit toàn hệ thống: hành động, đối tượng, lý do, `du_lieu_cu`/`du_lieu_moi` | Mọi thực thể | `admin` `doctor` `user` `system` **`nurse`** `receptionist` |
| `KetQuaKham.lich_su_sua` | Lịch sử sửa bệnh án, nhúng trong chính bệnh án | Bệnh án | (không có trường vai trò) |

⚠️ `NhatKyThaoTac.vai_tro` **vẫn còn `'nurse'`** trong enum, dù hệ thống không có vai trò y tá.
Cần gỡ cùng đợt sửa rule để tránh có người dựa vào đó mà code.

## A.2 Ma trận: actor nào ghi lịch sử ở thao tác nào

Rà toàn bộ `grep hanh_dong` — hiện có **23 hành động** được ghi vào `NhatKyThaoTac`:

### Lễ tân ghi

| Hành động | Đối tượng | Thao tác thực tế |
|---|---|---|
| `UPDATE_PATIENT_PROFILE_ADMINISTRATIVE` | `patient_profile` | Sửa 9 trường hành chính hồ sơ |
| `REQUEST_MEDICAL_RECORD_REVISION` | `examination_result` | Yêu cầu bác sĩ sửa bệnh án *(đang chờ quyết định gỡ)* |
| `PRINT_INVOICE` | `hoa_don` | In biên lai |
| `DOI_LICH_HEN` | `lich_hen` | Dời lịch (qua `appointmentReschedule.service`) |
| `CUSTOMER_CONTACT_REQUIRED` | `lich_hen` | Khách không có tài khoản, cần gọi tay |

Ngoài ra mọi thao tác dời/hủy/đến muộn đều ghi `LichSuLichHen` với `vai_tro='receptionist'`.

### Bác sĩ ghi

| Hành động | Đối tượng |
|---|---|
| `UPDATE_EXAMINATION_RESULT` | `examination_result` |
| `DOCTOR_REVISE_MEDICAL_RECORD` | `examination_result` |
| `CHANGE_DOCTOR_STATUS` | `room_status` |
| `CHECKIN_QUEUE` · `CALL_PATIENT` · `SKIP_PATIENT` | `queue_entry` |
| `CANCEL_SLOT` | `doctor_schedule` |

### Admin ghi

| Hành động | Đối tượng |
|---|---|
| `UPDATE_PATIENT` · `SOFT_DELETE_PATIENT` · `RESTORE_PATIENT` · `HARD_DELETE_USER` | `patient` / `user` |
| `ADMIN_OVERRIDE_MEDICAL_RECORD` | `examination_result` |
| `HIDE_REVIEW` · `RESTORE_REVIEW` · `DELETE_REVIEW` | `review` |
| Dịch vụ, chuyên khoa, phòng, mẫu lịch trực, tin tức | tương ứng |

### Hệ thống (cron) ghi

`AUTO_CANCEL_APPOINTMENT` · `AUTO_MARK_NO_SHOW` · `UNDO_AUTO_MARK_NO_SHOW` ·
`CHUYEN_SLOT_ONLINE_SANG_WALK_IN` · `RELEASE_STUCK_PENDING_SLOTS` ·
`REGENERATE_FUTURE_SCHEDULE_SLOTS` · `DEDUPE_SLOT_APPOINTMENT`

**Trả lời trực tiếp câu hỏi:** admin và bác sĩ **có** thao tác lên cùng những đối tượng mà
lễ tân đụng tới (hồ sơ bệnh nhân, lịch hẹn, bệnh án), và **đều có ghi lịch sử**.

## A.3 🔴 Lỗ hổng: lễ tân KHÔNG thấy admin đã sửa gì

Đây là phát hiện quan trọng nhất của phần A.

Cùng một bệnh nhân, nhưng hai bên ghi audit vào **hai đối tượng khác nhau**:

| Ai sửa | `loai_doi_tuong` | `doi_tuong_id` | Hành động |
|---|---|---|---|
| **Lễ tân** | `patient_profile` | `HoSoBenhNhan._id` | `UPDATE_PATIENT_PROFILE_ADMINISTRATIVE` |
| **Admin** | `patient` / `user` | `NguoiDung._id` | `UPDATE_PATIENT` |

Và hai API đọc lịch sử lọc lệch nhau:

```js
// Lễ tân — patient-intake.controller.js:565
NhatKyThaoTac.find({
  loai_doi_tuong: 'patient_profile',
  doi_tuong_id: profile._id,
  hanh_dong: 'UPDATE_PATIENT_PROFILE_ADMINISTRATIVE',   // ← lọc cứng đúng 1 hành động
})

// Admin — patient.controller.js:641
NhatKyThaoTac.find({
  doi_tuong_id: patient._id,
  loai_doi_tuong: { $in: ['patient', 'user'] },
})
```

**Hệ quả:** admin sửa số điện thoại bệnh nhân lúc 9h; 10h lễ tân mở lịch sử hồ sơ —
**không thấy gì cả**, tưởng dữ liệu chưa ai đụng. Lễ tân sửa tiếp, ghi đè thay đổi của admin.
Và ngược lại, admin cũng không thấy lễ tân đã sửa.

Đây đúng là tình huống bạn nêu: *"để lễ tân biết ai là người sửa gần nhất"* — hiện **không
biết được**.

Lưu ý kỹ thuật khi khắc phục: không chỉ bỏ điều kiện lọc, vì `doi_tuong_id` của hai bên là
hai id khác nhau. Phải nối qua `HoSoBenhNhan.tai_khoan_id` → `NguoiDung._id`.

## A.4 Đề xuất

### A.4.1 Contract "Ai sửa gần nhất"

Thêm vào response của hồ sơ bệnh nhân và lịch hẹn một khối gọn:

```json
"sua_gan_nhat": {
  "nguoi": "Trần Thị B",
  "vai_tro": "admin",
  "hanh_dong": "UPDATE_PATIENT",
  "truong_thay_doi": ["so_dien_thoai"],
  "ly_do": "Khách báo đổi số",
  "thoi_diem": "2026-08-02T09:12:00Z"
}
```

Hiển thị ngay trên đầu hồ sơ dạng một dòng: *"Sửa gần nhất: Admin Trần Thị B · 09:12 hôm nay
· đổi số điện thoại"*. Lễ tân biết ngay trước khi sửa tiếp.

### A.4.2 Timeline hợp nhất

API mới cho lễ tân, gộp cả ba nguồn theo trục thời gian:

```
GET /api/receptionist/timeline?loai=ho_so|lich_hen&id=<id>
```

- `loai=ho_so` → gộp `NhatKyThaoTac` của **cả** `patient_profile` lẫn `patient`/`user`
  (nối qua `tai_khoan_id`)
- `loai=lich_hen` → gộp `LichSuLichHen` + `NhatKyThaoTac` cùng `appointment_id`

Mỗi dòng trả: thời điểm · người thực hiện · vai trò · hành động (nhãn tiếng Việt) · lý do ·
trường thay đổi trước/sau.

### A.4.3 Ranh giới ghi — giữ nguyên nguyên tắc hiện có

| Nguyên tắc | Lý do |
|---|---|
| Audit chỉ INSERT, không UPDATE/DELETE | Đã ghi trong comment model, phải giữ |
| Mọi thao tác đổi dữ liệu phải có `ly_do` | Đã enforce ở LT-10, nên áp cho cả admin |
| Ghi đúng `vai_tro` thật của người thao tác | LT-09 đã sửa, không ghi lễ tân thành admin |
| Gỡ `'nurse'` khỏi enum `NhatKyThaoTac.vai_tro` | Hệ thống không có vai trò này |

---

# PHẦN B — Tiếp nhận tại quầy: hai đối tượng

## B.1 Luồng nghiệp vụ chuẩn

```
                    ┌─────────────────────────┐
                    │  Khách đến quầy         │
                    └───────────┬─────────────┘
                                │
                    Tra số điện thoại
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
      ĐÃ ĐẶT ONLINE                        CHƯA CÓ LỊCH (offline)
              │                                   │
     Xác minh đúng người                          │
              │                          ┌────────┴────────┐
     Hiện: giờ khám, bác sĩ,             │                 │
     phòng, đã thanh toán chưa      ĐÃ CÓ HỒ SƠ      CHƯA CÓ HỒ SƠ
              │                          │                 │
              │                   (khám lần 2+)      Tạo hồ sơ mới
              │                    có/không có       để lần sau
              │                    tài khoản online    dùng lại
              │                          │                 │
              │                          └────────┬────────┘
              │                                   │
              │                        Kiểm tra lịch bác sĩ:
              │                        chọn bác sĩ rảnh nhất /
              │                        hàng đợi ngắn nhất
              │                                   │
              └─────────────────┬─────────────────┘
                                │
                    Sinh mã số thứ tự
                                │
                  Vào hàng đợi của bác sĩ
                                │
                        In phiếu cho khách
```

## B.2 Đối chiếu với code hiện tại

### Luồng 1 — Khách đã đặt online

| Bước | Trạng thái |
|---|---|
| Tra SĐT, tìm lịch hôm nay | ✅ `GET /patient-intake/search` trả `lich_hen_hom_nay` |
| Hiện giờ khám, bác sĩ, phòng, chuyên khoa | ✅ đã có trong `serializeAppointment` |
| Hiện trạng thái thanh toán | ✅ `payment_status` |
| Xác minh đúng người bệnh | ⚠️ có danh sách nhưng thiếu dữ liệu phân biệt |
| Check-in → vào hàng đợi **đúng bác sĩ đã gán** | ✅ `checkInLichHen` giữ nguyên `doctor_id` |
| Sinh mã số thứ tự | ✅ |
| In phiếu | ❌ chỉ có `alert` giả |

**Điểm mấu chốt đúng nghiệp vụ:** khách đã đặt online thì **không** đi qua bước chọn bác sĩ —
hệ thống giữ nguyên bác sĩ đã gán khi đặt. UI hiện đã tách đúng: nhánh "2A. Lịch hẹn đã đặt"
không hiện nút kiểm tra sức chứa.

### Luồng 2 — Khách offline

| Trường hợp | Trạng thái |
|---|---|
| 2a. Đã có hồ sơ, **có** tài khoản online | ✅ tìm được qua `tai_khoan_id` / `nguoi_giam_ho_id` |
| 2b. Đã có hồ sơ, **chỉ có** thông tin bệnh nhân | ✅ tìm được qua `so_dien_thoai_tim_kiem` |
| 2c. Chưa có hồ sơ → tạo mới | ⚠️ **kẹt** khi SĐT đã có tài khoản online |
| Kiểm tra lịch bác sĩ, chọn người rảnh nhất | ✅ **đã có** — xem B.3 |
| Vào hàng đợi | ✅ |

### B.3 Chọn bác sĩ rảnh / hàng đợi thấp — ĐÃ CÓ SẴN

Đề xuất *"chuyển hồ sơ cho bác sĩ đang rảnh hay có hàng đợi thấp, tránh khách đợi lâu"*
**đã được cài đặt** trong `services/offlineIntake.service.js`, hàm `sapXepUngVien()`:

```js
1. Khung giờ sớm nhất
2. Độ trễ của ca thấp nhất        (do_tre_phut)
3. Hàng đợi ngắn nhất             (so_nguoi_dang_cho)
4. doctor_id tăng dần             (tie-break để kiểm thử lặp lại được)
```

Kết quả trả về `slot_de_xuat` kèm `ly_do_de_xuat` giải thích bằng tiếng Việt:

> *"Chọn BS Nguyễn Văn A vì có khung gần nhất 09:30–10:00, còn 2 slot walk-in, đang chờ
> 3 người và độ trễ 5 phút."*

UI đã hiển thị khối "Phương án tiếp nhận đề xuất" này. **Không cần xây mới**, chỉ cần làm
nổi bật hơn để lễ tân tin và dùng thay vì tự chọn.

## B.4 Đề xuất bổ sung cho phần B

| # | Đề xuất | Loại |
|---|---|---|
| B-1 | Tách rõ 2 luồng bằng bước đầu tiên: "Khách có lịch hẹn không?" thay vì để lễ tân tự suy từ kết quả tra cứu | FE |
| B-2 | Với khách đã đặt online: hiện thẻ tóm tắt **giờ khám · bác sĩ · phòng · đã thanh toán** ngay khi tra ra, không bắt bấm thêm | FE |
| B-3 | Đánh dấu hồ sơ **"khám lần thứ N"** + ngày khám gần nhất, để lễ tân biết là khách cũ | FE + BE nhỏ |
| B-4 | Bỏ khoá cứng khi tạo hồ sơ trên SĐT đã có tài khoản (mục 2c) | FE |
| B-5 | Làm nổi bật phương án đề xuất + nút "Dùng phương án này" một chạm | FE |

---

# PHẦN C — Khám kéo dài, hàng đợi bị đẩy xa

## C.1 Hiện trạng

| Có sẵn | Cơ chế |
|---|---|
| Phát hiện ca khám kéo dài | `queueOverflow.service.js` — tính độ trễ tích luỹ của ca |
| Ngừng bán slot walk-in khi trễ ≥ 30′ | Tự động, ngưỡng đọc từ env |
| Chặn cả đặt online khi trễ ≥ 60′ | Tự động |
| Cảnh báo trên dashboard lễ tân | `GET /appointments/doctor-statuses` |
| Danh sách lượt chờ bị ảnh hưởng | `luot_cho_bi_anh_huong` |
| Danh sách lịch chưa check-in bị ảnh hưởng | `lich_chua_checkin_bi_anh_huong` |
| Chống bỏ đói: chờ > 60′ tự nâng 1 bậc ưu tiên | `models/HangDoi.js` |

Nghĩa là hệ thống **đã phát hiện và cảnh báo tốt**. Vấn đề nằm ở chỗ: **lễ tân nhìn thấy
vấn đề nhưng không có công cụ để xử lý.**

## C.2 Bốn phương án xử lý bạn nêu — đối chiếu

| Phương án | Trạng thái |
|---|---|
| 1. Dời sang **bác sĩ khác cùng ngày** còn trống | ⚠️ dời được `LichHen` (khách chưa đến); **không** chuyển được `HangDoi` (khách đang ngồi chờ) |
| 2. Sáng quá tải → dời sang **buổi chiều** cùng ngày | ⚠️ `markLateArrival` có `nearest_available` nhưng chỉ dùng cho khách đến muộn, không dùng cho ca quá tải |
| 3. Dời sang **khung giờ / ngày khác** | ✅ có, qua `PATCH /:id/reschedule` |
| 4. Lễ tân **xem được lịch bác sĩ** để quyết định | ⚠️ **API có, UI không có** |

Về phương án 4: `GET /receptionist/booking/doctors/:id/slots` đã tồn tại, nhưng frontend
chỉ dùng nó bên trong modal dời lịch — lễ tân **không có màn hình nào để xem lịch tổng
quan của các bác sĩ trong ngày** rồi mới quyết định dời đi đâu.

## C.3 🔴 Ba chức năng còn thiếu

### C-1. Chuyển lượt đang chờ sang bác sĩ khác

Thiếu **cả backend lẫn frontend**. Rà toàn bộ `controllers/receptionist/`: `HangDoi` chỉ
được **đọc**, chưa có chỗ nào ghi `doctor_id` mới.

Phân biệt cho rõ — đây là hai việc khác nhau:

| | Dời `LichHen` (đã có) | Chuyển `HangDoi` (chưa có) |
|---|---|---|
| Đối tượng | Khách **chưa đến** | Khách **đang ngồi chờ tại quầy** |
| Đổi gì | Cam kết đặt chỗ: ngày, giờ, bác sĩ, slot | Bác sĩ sẽ khám cho lượt hiện tại |
| Slot | Trả slot cũ, chiếm slot mới | Không đụng `LichLamViec.slots[]` |
| Số thứ tự | Không liên quan | **Giữ nguyên** mã đã phát cho khách |

Ràng buộc bắt buộc:
- Chỉ chuyển được lượt `dang_cho`; lượt `trong_phong` bị khoá cứng
- Bác sĩ đích phải **cùng chuyên khoa** và đang trong ca
- **Giữ nguyên `ma_so_thu_tu`** — khách đã cầm phiếu, đổi số là sai audit
- Ghi `NhatKyThaoTac` hành động mới `CHUYEN_HANG_DOI` với bác sĩ cũ/mới + lý do
- Thông báo cho khách (đổi phòng, đổi bác sĩ)

### C-2. Màn "Lịch bác sĩ trong ngày" cho lễ tân

Bảng ngang: mỗi dòng một bác sĩ, mỗi cột một khung giờ, ô hiển thị số slot còn trống.
Phân biệt rõ ca sáng / ca chiều để thấy ngay *"sáng BS A quá tải, chiều BS B còn 6 chỗ"*.

Backend đã có đủ (`doctors/:id/slots` + `doctor-statuses`), chủ yếu là việc gom lại.

### C-3. Điều phối ca quá tải theo lô

Khi một ca trễ ≥ 60′: hiện danh sách các lịch **chưa check-in** còn lại của ca đó, cho lễ tân
chọn nhiều lịch và áp một phương án chung — dời sang bác sĩ khác / sang ca chiều / sang ngày
mai — với **một lý do chung**, sinh **một loạt thông báo**.

Tái dùng `bulkRescheduleAppointments` đã có, chỉ khác đầu vào là "các lịch bị ảnh hưởng bởi
quá tải" thay vì "các lịch của bác sĩ nghỉ".

## C.4 Lịch sử cho các thao tác điều phối

Mọi thao tác ở C-1 và C-3 phải ghi rõ **ai dời**:

| Thao tác | Ghi vào | `vai_tro` |
|---|---|---|
| Lễ tân chuyển lượt chờ | `NhatKyThaoTac` (`CHUYEN_HANG_DOI`) | `receptionist` |
| Lễ tân dời lịch do quá tải | `LichSuLichHen` (`loai_thay_doi='overload_reschedule'`) | `receptionist` |
| Bác sĩ tự báo bận một khung | `NghiPhepBacSi` + `LichHen.de_xuat_doi` | `doctor` |
| Admin duyệt phương án dời | `LichSuLichHen` | `admin` |
| Cron tự áp phương án khi khách hết hạn phản hồi | `NhatKyThaoTac` | `system` |

Ba vai trò đều có thể dời cùng một lịch, nên timeline hợp nhất ở **§A.4.2** là điều kiện
bắt buộc để phân biệt được ai làm gì.

---

# PHẦN D — Kịch bản hội đồng có thể hỏi

Bảng dưới liệt kê các tình huống thực tế và khả năng xử lý của hệ thống. Cột "TT": ✅ xử lý
được · ⚠️ xử lý được nhưng thao tác thủ công/chưa mượt · ❌ chưa xử lý được.

## D.1 Nhóm tiếp đón

| # | Tình huống | Hệ thống xử lý | TT |
|---|---|---|---|
| 1 | Khách đặt online đến đúng giờ | Check-in → hàng đợi bác sĩ đã gán, bậc `online_uu_tien` | ✅ |
| 2 | Khách đến sớm 30′ | Vẫn check-in, bậc `online_thuong`, tự lên `online_uu_tien` khi tới khung. **Đến sớm không bị phạt** | ✅ |
| 3 | Khách đến muộn 20′ (còn trong ca) | Vẫn khám, tụt xuống bậc `offline`, **không mất tiền** | ✅ |
| 4 | Khách đến muộn, chọn dời | 3 phương án: cuối ca / slot gần nhất / ngày mai | ✅ |
| 5 | Khách không đến hết ca | Cron tự đặt `no_show`, **chỉ khi không có bản ghi `HangDoi`** | ✅ |
| 6 | Khách đã tới quầy nhưng hết ca chưa được gọi | **Không bao giờ** thành `no_show` vì đã có `HangDoi` | ✅ |
| 7 | Ba người nhà chung một SĐT cùng đến | Tra ra 3 hồ sơ, lễ tân chọn từng người | ⚠️ thiếu dữ liệu phân biệt trên màn hình |
| 8 | Khách vãng lai, còn slot walk-in | Đề xuất bác sĩ rảnh nhất kèm lý do | ✅ |
| 9 | Khách vãng lai, hết slot walk-in | Từ chối rõ ràng + gợi ý khung trống gần nhất. **Trần overbook = 0** | ✅ |
| 10 | Khách vãng lai đến ngoài giờ / nghỉ trưa | Trả `khong_co_khung_gan` + mốc quay lại | ✅ |
| 11 | Khách vãng lai chưa có hồ sơ | Tạo hồ sơ tại quầy để lần sau dùng lại | ⚠️ kẹt nếu SĐT đã có tài khoản |

## D.2 Nhóm chống gian lận / chống nhầm

| # | Tình huống | Hệ thống xử lý | TT |
|---|---|---|---|
| 12 | Khách gọi điện hỏi còn chỗ không | Chỉ trả **mức độ** (còn nhiều / còn ít / đã đầy), không trả con số, có ghi nhật ký | ✅ |
| 13 | Khách nhờ lễ tân đặt hộ qua điện thoại | **Từ chối** — rule mục 13, chặn ở cả `getSlots` lẫn `createBooking` | ✅ |
| 14 | Lễ tân cố lấy slot online cho khách quen | `walkInWindow.service.js` chỉ cho slot `walk_in`, chỉ hôm nay, chỉ khung hiện tại + kế tiếp | ✅ |
| 15 | Hai lễ tân check-in cùng một lịch | Unique index `appointment_id` trên `HangDoi` | ✅ |
| 16 | Hai lễ tân cùng bán một slot walk-in | Claim nguyên tử bằng một `$elemMatch` | ✅ |
| 17 | Hai lễ tân cùng phát số thứ tự | `Counter` nguyên tử + unique index `{ngay_checkin_key, so_thu_tu_checkin}` | ✅ |
| 18 | Khách sắp trễ, bấm dời để né mất tiền | Chặn dời sau mốc `T-30′` | ✅ |
| 19 | Khách đòi dời lần thứ hai | Trần 1 lần cho `khach_yeu_cau`; lần do phòng khám không tính | ✅ |
| 20 | Lễ tân sửa lịch khi bệnh nhân đang khám | `lock_reason=IN_ROOM` → **409** ở mọi endpoint | ✅ |

## D.3 Nhóm sự cố vận hành

| # | Tình huống | Hệ thống xử lý | TT |
|---|---|---|---|
| 21 | Bác sĩ nghỉ cả ca, khách đã trả tiền | Thang 3 bước: cùng khung khác bác sĩ → khung/ngày gần nhất → giữ quyền dời mở. **Không hoàn tiền** | ✅ |
| 22 | Bác sĩ chỉ bận một khung | Khung chưa ai đặt → bác sĩ tự khoá. Đã có khách trả tiền → tạo yêu cầu, **admin duyệt** | ✅ |
| 23 | Khách được đề xuất dời nhưng không phản hồi | Cron áp phương án đã giữ sẵn, khách không mất chỗ | ✅ |
| 24 | Bác sĩ khám một người 60 phút | Cảnh báo + ngừng bán walk-in + chặn đặt online cho các khung còn lại | ✅ |
| 25 | Ca sáng quá tải, ca chiều còn trống | **Lễ tân không có màn xem lịch tổng quan để quyết định** | ❌ |
| 26 | Chuyển khách đang ngồi chờ sang bác sĩ khác | Không có API | ❌ |
| 27 | Điều phối hàng loạt các lịch còn lại của ca quá tải | Chỉ có bulk cho bác sĩ nghỉ, không có cho quá tải | ❌ |
| 28 | Khách hủy lịch, người khác muốn đặt ngay | Slot trả về `active` trong cùng transaction, sạch `benh_nhan_id` | ✅ |
| 29 | Khách đã check-in rồi bỏ về | Có `HangDoi` nên không bị `no_show`; nhưng **không có thao tác đóng lượt** | ⚠️ |
| 30 | Máy in phiếu hỏng | **Chưa in thật**, hiện chỉ báo giả là đã in | ❌ |

## D.4 Nhóm dữ liệu & truy vết

| # | Tình huống | Hệ thống xử lý | TT |
|---|---|---|---|
| 31 | Sai họ tên / ngày sinh trên hồ sơ cũ | Backend cho sửa, bắt buộc lý do, ghi audit — **nhưng chưa có UI** | ❌ |
| 32 | Hội đồng hỏi "ai sửa hồ sơ này gần nhất?" | Audit có ghi, nhưng **lễ tân không thấy phần admin sửa** | ❌ |
| 33 | Hội đồng hỏi "ai dời lịch này, lúc nào, vì sao?" | `LichSuLichHen` đủ dữ liệu; UI chỉ hiện khi khách hết lượt dời | ⚠️ |
| 34 | Lễ tân phát hiện bệnh án sai | Bị chặn **403**, không sửa được | ✅ đúng thiết kế |
| 35 | Admin cần sửa bệnh án khẩn | Override 4 trường, bắt buộc lý do, không xoá được `lich_su_sua` | ✅ |
| 36 | Khách không có tài khoản bị dời lịch | Ghi `CUSTOMER_CONTACT_REQUIRED`, nhưng **không màn nào hiển thị → không ai gọi** | ❌ |
| 37 | Chứng minh khách đã đồng ý điều khoản không hoàn tiền | `dieu_khoan_version` + `dieu_khoan_dong_y_luc` lưu trên `LichHen` | ✅ |
| 38 | Sửa dữ liệu mà không nêu lý do | Chặn **400** | ✅ |

## D.5 Thống kê khả năng phản biện

| Nhóm | ✅ | ⚠️ | ❌ |
|---|---:|---:|---:|
| Tiếp đón | 9 | 2 | 0 |
| Chống gian lận / nhầm | 9 | 0 | 0 |
| Sự cố vận hành | 6 | 1 | 3 |
| Dữ liệu & truy vết | 4 | 1 | 3 |
| **Tổng** | **28** | **4** | **6** |

**28/38 tình huống xử lý trọn vẹn.** Điểm yếu tập trung đúng hai chỗ: **điều phối khi quá
tải** (25, 26, 27) và **truy vết/thông báo** (31, 32, 36) — cộng thêm việc in phiếu (30).

---

# PHẦN E — Tổng hợp chức năng đề xuất thêm

| Mã | Chức năng | Nhóm | BE | FE | Ưu tiên | Giải quyết tình huống |
|---|---|---|---|---|---|---|
| **E-1** | Timeline hợp nhất + "sửa gần nhất" | Lịch sử | ✚ | ✚ | 🔴 | 32, 33 |
| **E-2** | UI sửa hồ sơ hành chính + audit | Lịch sử | ✅ | ✚ | 🔴 | 31 |
| **E-3** | Màn "Cần gọi thủ công" + đánh dấu đã gọi | Thông báo | ✚ | ✚ | 🔴 | 36 |
| **E-4** | Chuyển lượt đang chờ sang bác sĩ khác | Điều phối | ✚ | ✚ | 🔴 | 26 |
| **E-5** | Màn "Lịch bác sĩ trong ngày" | Điều phối | ✅ | ✚ | 🟠 | 25 |
| **E-6** | Điều phối ca quá tải theo lô | Điều phối | ✚ | ✚ | 🟠 | 27 |
| **E-7** | In phiếu số thứ tự thật | Tiếp đón | ✅ | ✚ | 🟠 | 30 |
| **E-8** | Bổ sung dữ liệu phân biệt hồ sơ trùng SĐT | Tiếp đón | ✅ | ✚ | 🟠 | 7 |
| **E-9** | Tạo hồ sơ walk-in trên SĐT đã có tài khoản | Tiếp đón | ✅ | ✚ | 🟠 | 11 |
| **E-10** | Đánh dấu "khám lần thứ N" + lần khám gần nhất | Tiếp đón | ✚ | ✚ | 🟡 | — |
| **E-11** | Thao tác đóng lượt khi khách bỏ về | Hàng đợi | ✚ | ✚ | 🟡 | 29 |
| **E-12** | Gỡ `'nurse'` khỏi enum `NhatKyThaoTac.vai_tro` | Dọn dẹp | ✚ | — | 🟡 | — |

✅ = đã có · ✚ = cần làm

## Gợi ý chia gói

| Gói | Nội dung | Mã |
|---|---|---|
| **Gói 1** (đang triển khai) | Check-in + LT-07 + LT-10 + gỡ LT-11 | E-2, E-8, E-9 |
| **Gói 2** — Truy vết | Timeline hợp nhất, sửa gần nhất, gỡ `nurse` | E-1, E-12 |
| **Gói 3** — Điều phối | Chuyển lượt chờ, lịch bác sĩ, điều phối lô | E-4, E-5, E-6 |
| **Gói 4** — Khép kín vận hành | Gọi thủ công, in phiếu, đóng lượt, khám lần N | E-3, E-7, E-10, E-11 |

Nếu ưu tiên cho buổi bảo vệ, nên làm theo thứ tự **Gói 1 → Gói 3 → Gói 2 → Gói 4**: gói 3
đóng lại 3 tình huống ❌ dễ bị hỏi nhất (25, 26, 27), gói 2 đóng 2 tình huống về truy vết.

---

## Tài liệu liên quan

- `docs/Le tan/Danh muc chuc nang actor Le tan (2026-08-02).md` — 53 chức năng hiện có
- `docs/Le tan/2026-08-02-nang-luc-le-tan-doi-chieu-ke-hoach-thay.md` — đối chiếu LT-00→LT-12
- `docs/Le tan/Ke hoach xu ly loi actor Le tan 2026-08-02.md` — kế hoạch gốc của thầy
- `.claude/rules/lich-lam-viec-bac-si.md` — rule nghiệp vụ (bất biến)
