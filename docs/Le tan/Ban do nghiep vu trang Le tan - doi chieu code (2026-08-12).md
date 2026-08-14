# Bản đồ nghiệp vụ trang Lễ tân — đối chiếu tài liệu ↔ code

Ngày lập: 2026-08-12
Phạm vi đọc: 3 tài liệu nền + toàn bộ route/controller/service/model/màn hình lễ tân.
Mục đích: trả lời được cho từng tình huống khó — **hệ thống xử lý thế nào · màn nào show được ·
dữ liệu nào đổi · có audit không**.

Tài liệu này **bổ sung** cho `Kiem thu toan dien trang Le tan - bo kich ban hoi dong (2026-08-12).md`,
không thay thế. Phần mới nằm ở mục 6 (đối chiếu code) và mục 7 (khoảng hở phát hiện thêm).

---

## 1. Kết quả kiểm chứng chạy lại hôm nay

| Lệnh | Kết quả |
|---|---|
| `cd backend && node --test --test-concurrency=1 "tests/receptionist*.test.js"` | **71/71 pass**, exit 0 |

Khớp con số ghi trong tài liệu kiểm thử. Chưa chạy lại `typecheck`/`build` frontend trong phiên này.

---

## 2. Kiến trúc dữ liệu — 3 bảng phải phân biệt

| Bảng | Là gì | Ai tạo |
|---|---|---|
| `HoSoBenhNhan` | **Người được khám** (không phải tài khoản đặt lịch) | Lễ tân tạo tại quầy, hoặc có sẵn từ tài khoản online |
| `LichHen` | Chỉ dành cho luồng **online/đặt trước** | Khách đặt online |
| `HangDoi` | **Sự thật vận hành trong ngày**: ai đã đến, đang chờ, đã gọi, đang khám, xong | Sinh ra lúc check-in / tiếp nhận |

**Khách vãng lai KHÔNG tạo `LichHen` giả.** Cầu nối duy nhất sang bác sĩ là `HangDoi.doctor_id`;
bác sĩ đọc thẳng `GET /doctor/queue`, socket chỉ là best-effort.

Vòng đời `HangDoi.trang_thai` (`models/HangDoi.js`):
`cho_dieu_phoi → dang_cho → da_goi → trong_phong → (cho_dich_vu) → hoan_thanh` | `skipped` | `cancelled`.

Bậc ưu tiên **tính động lúc query** (`tinhBacUuTienDong`), không đọc `muc_uu_tien` lưu trong DB
(field đó chỉ còn là snapshot lúc check-in, đã đánh dấu deprecated):
- `online_uu_tien` — online, đã tới khung (`now ≥ T`), check-in ≤ `T+15'`
- `online_thuong` — online đến sớm (chưa tới `T`); tới `T` tự lên bậc, **không bị phạt vì đến sớm**
- `offline` — walk-in, hoặc online check-in sau `T+15'`
- Aging: chờ ≥ 60′ (`QUEUE_AGING_PHUT`) nâng `offline → online_thuong`, **không nâng tiếp** để người
  đến sớm không bị gọi trước đầu khung của mình.

---

## 3. Hai đường tiếp nhận — cùng một đích `HangDoi`

```
Khách ĐÃ có lịch online
  PATCH /api/receptionist/appointments/:id/arrived
  → markAsArrived (appointment.controller.js)
      · bắt buộc body {ho_so_benh_nhan_id, so_dien_thoai, ho_ten} — chống nhầm người
      · appointmentBelongsToProfile() → sai hồ sơ = 409, KHÔNG tạo hàng đợi
      · lần đầu hồ sơ tại quầy gặp tài khoản online thì tự liên kết (tai_khoan_id / nguoi_giam_ho_id)
  → checkInLichHen() (services/checkIn.service.js) — service DUY NHẤT, bác sĩ cũng gọi cùng hàm
      · transaction: LichHen.status='checked_in' + tạo HangDoi(nguon='online') — rollback cả hai nếu lỗi
      · cấp số thứ tự, tính tuổi/nhóm máu/dị ứng/bệnh nền từ ThanhVien hoặc HoSoBenhNhan
      · cảnh báo (KHÔNG chặn): chưa thanh toán đủ / đến sớm / trễ quá 15'
      · audit LT_CHECK_IN

Khách VÃNG LAI (không có lịch)
  POST /api/receptionist/offline-queue/intake  (hoặc /patient-intake/offline-queue/intake)
  → tiepNhanOfflineVaoHangDoiTrungTam() (services/centralOfflineQueue.service.js)
      · chặn hồ sơ đã có lượt đang mở trong ngày (409)
      · gọi lại capacity NGAY trong luồng; tam_dung_nhan → 409; canh_bao_day mà chưa tick → 409
      · transaction + kiểm lại lần 2 bên trong → 2 lễ tân bấm cùng lúc chỉ 1 người thành công
      · tạo HangDoi(nguon='offline', trang_thai='cho_dieu_phoi', doctor_id=null)
      · audit LT_OFFLINE_INTAKE_CENTRAL
```

`pre('validate')` của `HangDoi` **ép cứng**: hễ `trang_thai='cho_dieu_phoi'` thì `doctor_id`,
`phong_kham`, `schedule_id`, `slot_id`, `khung_index`, `gio_hen_goc` bị set null — không thể lách
để gán bác sĩ sớm.

---

## 4. Ngưỡng vận hành (đọc từ env, không hardcode)

`services/offlineQueueConfig.service.js`:

| Env | Mặc định | Ý nghĩa |
|---|---:|---|
| `MAX_OFFLINE_WAIT_MINUTES` | 90 | Chờ dự báo quá mốc này → `tam_dung_nhan` |
| `OFFLINE_WARNING_WAIT_MINUTES` | 60 | Quá mốc → `canh_bao_day`, bắt tick xác nhận |
| `MAX_CENTRAL_OFFLINE_QUEUE_SIZE` | 10 | Trần khách `cho_dieu_phoi` |
| `MAX_OFFLINE_PER_SHIFT_PER_SPECIALTY` | 20 | Trần offline/ca/chuyên khoa |
| `MIN_ONLINE_PROTECTION_MINUTES` | 15 | Vùng bảo vệ trước lịch online sắp tới |
| `DISPATCH_BUFFER_MINUTES` | 5 | Buffer khi chèn offline |
| `SHIFT_CLOSING_BUFFER_MINUTES` | 30 | Còn dưới mốc này thì slot không được coi là an toàn |

`services/queueOverflow.service.js`:

| Env | Mặc định | Hiệu lực |
|---|---:|---|
| `OVERFLOW_NGUNG_WALKIN_PHUT` | 30 | Trễ ≥ mốc → ngừng nhận walk-in khung còn lại |
| `OVERFLOW_CHAN_ONLINE_PHUT` | 60 | Trễ ≥ mốc → chặn cả đặt online khung còn lại |

Độ trễ ca = `max(` trễ hàng đợi, vượt chuẩn trong phòng `)`:
- **trễ hàng đợi** = `now − gio_hen_goc` của người `dang_cho` có khung sớm nhất (kẹp ≥ 0)
- **vượt chuẩn trong phòng** = `now − thoi_diem_vao_phong − thoi_gian_kham_trung_binh_phut` của chuyên khoa

---

## 5. Từng tình huống khó → xử lý · màn hình · dữ liệu · audit

### 5.1 Bác sĩ nghỉ đột xuất

| Tình huống | Xử lý | Màn hình | Dữ liệu đổi | Audit |
|---|---|---|---|---|
| Nghỉ, khách **chưa đến** (`pending`/`confirmed`) | `reportDoctorUnavailable` tạo `NghiPhepBacSi` trạng thái `da_duyet`, `nguon_tao='le_tan_ghi_nhan'` → khóa slot → `taoDeXuatDoiChoDonNghi` sinh phương án và **giữ sẵn chỗ** | `/receptionist/doctor-day-view` → "Báo nghỉ đột xuất" | `NghiPhepBacSi` mới; slot `status='locked'` + `bi_khoa_boi_nghi_phep`; `LichHen.de_xuat_doi` | `LichSuLichHen` loại `reschedule_proposal` cho từng lịch |
| Nghỉ **một khoảng giờ** | Chỉ khóa slot giao `gio_bat_dau`–`gio_ket_thuc`; slot khác trong ngày giữ nguyên; nếu để trống giờ → nghỉ cả ngày, `trang_thai_ngay='nghi_phep'` | Modal nghỉ đột xuất (2 ô time) | Chỉ slot giao khoảng | như trên |
| Đã trùng đơn nghỉ | `overlappingLeave` → **409** kèm `leave_id`, không tạo trùng | Modal báo lỗi | Không | Không |
| Khách **đã check-in**, `dang_cho`/`da_goi` | Bị **loại khỏi** nhóm sinh đề xuất; trả về `can_dieu_phoi_tai_quay` với `ly_do_bo_qua='da_checkin_can_dieu_phoi_tai_quay'` | Ngay trong modal có nút **"Chuyển bác sĩ"**, và Dashboard | `HangDoi.doctor_id`/`phong_kham` đổi khi bấm chuyển; giữ nguyên `ma_so_thu_tu`, `checkin_time` | `NhatKyThaoTac` `CHUYEN_HANG_DOI` + `LichSuLichHen` loại `queue_transfer` |
| Khách **đang trong phòng** | `ly_do_bo_qua='benh_nhan_dang_trong_phong'`; backend **chặn** đóng lượt lẫn chuyển lượt | Modal ghi "N lịch đang trong phòng khám — không cần điều phối" | Không đụng | Không |
| Khách đã trả tiền, chưa check-in | Không bị `no_show` — `noShowSweep` bỏ qua `ca_bi_nghi` | ContactTasks / Appointments | `de_xuat_doi` | có |
| Nghỉ sau khi đã khám xong | Không ảnh hưởng; ca đã sang thu ngân | `/receptionist/payments` | Không | — |
| Bác sĩ tự xin nghỉ (`cho_duyet`) | Lễ tân duyệt được **đơn ngắn hạn** (`laDonNganHanChoLeTan`: kết thúc ≤ ngày mai, kéo dài ≤ 1 ngày, và **`den_ngay >= hôm nay`** để đơn rác cũ không lọt) | DoctorDayView → badge "Đang xin nghỉ" → `DoctorLeaveApprovalModal` | `NghiPhepBacSi.trang_thai`, `nguoi_duyet_id`; slot khóa | có |

Điểm chốt để trả lời hội đồng: **khách chưa đến thì dời/báo trước; khách đã đến quầy thì xử lý theo
hàng đợi (chuyển bác sĩ), không bắt đặt lại; khách đang khám thì không ai cắt ngang.**

### 5.2 Khám nhanh/chậm, quá tải ca

| Tình huống | Xử lý | Màn hình |
|---|---|---|
| Bác sĩ khám lâu hơn TB chuyên khoa | `thoiGianKhamVuotChuanPhut` từ `thoi_diem_vao_phong`; `nguyen_nhan_do_tre='trong_phong'` | `/receptionist` — thẻ bác sĩ hiện "Ca đang trễ N phút do lượt trong phòng" |
| Người khung sớm nhất vẫn đang chờ quá giờ | `nguyen_nhan_do_tre='hang_doi'` | như trên |
| Trễ ≥ 30′ | `ngungBanWalkIn=true` → capacity offline chuyển sang chặn; cảnh báo lễ tân | Dashboard + PatientIntake (capacity) |
| Trễ ≥ 60′ | `chanDatOnline=true`; `trang_thai_van_hanh` chuyển `qua_tai_tam_thoi` | Dashboard, nút **"Điều phối ca quá tải"** → `/receptionist/appointments?overload_doctor=` |
| Bác sĩ khám nhanh, có khoảng trống | `layGoiYDieuPhoiOffline` trả `de_xuat_tot_nhat` | `/receptionist/offline-queue` + panel "Tín hiệu hàng đợi vãng lai" ở DoctorDayView |
| Có online sắp đến trong vùng bảo vệ | Ứng viên bị gắn `ly_do_chan=['dang_bao_ve_lich_online_gan']` → **không** gợi ý; nếu vẫn gọi assign thì transaction kiểm lại → 409 | OfflineQueue hiện "Chưa có bác sĩ an toàn" |

Điều kiện một bác sĩ được nhận offline (`layUngVienBacSiChoDieuPhoi`) — hiện đủ 4 chốt:
`khong_con_khung_an_toan` · `phong_<trạng thái>` (khác `san_sang`) · `dang_co_benh_nhan_trong_phong` ·
`dang_bao_ve_lich_online_gan` (cả lịch online sắp tới **lẫn** online đã ngồi trong hàng đợi).

### 5.3 Bệnh nhân đã check-in rồi bỏ về

| Trạng thái | Thao tác lễ tân | Dữ liệu | Audit |
|---|---|---|---|
| `dang_cho` / `da_goi` | Dashboard → **"Đóng lượt"** (bắt buộc nhập lý do với role receptionist) | `HangDoi.trang_thai='cancelled'`; nếu có `appointment_id` thì `LichHen.status='cancelled'`; nếu không có lịch thì `traSlotVePool()` nhả slot walk-in | `NhatKyThaoTac` `HUY_LUOT_HANG_DOI` + `LT_HUY_CHECK_IN` + `LichSuLichHen` loại `queue_cancel` |
| `trong_phong` | **Backend chặn** — "Bệnh nhân đang trong phòng khám, không thể đóng lượt" | Không | Không |
| Offline `cho_dieu_phoi` bỏ về | `/receptionist/offline-queue` → **"Hủy chờ"** (bắt nhập lý do) | `cancelled` | `LT_OFFLINE_CANCEL_CENTRAL` |
| Offline `dang_cho` cần điều phối lại | `/receptionist/offline-queue` → **"Trả về hàng đợi"** | clear `doctor_id`/`phong_kham`/`schedule_id`/`slot_id`/`gio_hen_goc`, về `cho_dieu_phoi` | `LT_OFFLINE_RETURN_CENTRAL` |

**Không bao giờ thành `no_show`.** `queueCancel.service.js` cố ý **không** set `no_show`, và
`noShowSweep` loại trừ theo **sự tồn tại** bản ghi `HangDoi` (không lọc theo trạng thái đang hoạt
động) nên lượt đã đóng vẫn miễn nhiễm vĩnh viễn.

### 5.4 `no_show` — chỉ hệ thống, chỉ cuối ca

`services/noShowSweep.service.js` + cron 5′. Bốn tầng loại trừ (đếm được qua `boQua`):
`da_toi_quay` (có `HangDoi`) · `ca_bi_nghi` (lịch làm việc không phải `lam_viec`, hoặc bị `tu_choi`,
hoặc slot `bi_khoa_boi_nghi_phep`, hoặc không tra được lịch) · `chua_het_ca` · `khong_ro_gio`.
Chỉ nhận `status ∈ {pending, confirmed}` — **cố ý loại `checked_in`** vì dữ liệu cũ có thể
`checked_in` mà thiếu `HangDoi`.

⚠️ **Cron mặc định CHỈ bật khi `NODE_ENV=production`** (sau sự cố 2026-07-26 quét nhầm 5 lịch demo
đã thanh toán trên DB dùng chung). Ghi đè bằng `NO_SHOW_SWEEP_ENABLED`. Hoàn tác:
`src/scripts/hoan-tac-no-show.js`.

Ghi `NhatKyThaoTac` `AUTO_MARK_NO_SHOW` (`vai_tro='system'`) + `ThongBao` cho khách nêu rõ không hoàn tiền.

### 5.5 Khách khám xong chưa trả tiền

`billing.controller.js`:
- Ca chỉ vào danh sách thu khi **bác sĩ đã xác nhận** `KetQuaKham.status='da_xac_nhan'`; chưa xác
  nhận → **409** "Bác sĩ chưa xác nhận hồ sơ khám".
- Điều kiện trạng thái: offline `hoan_thanh|cho_dich_vu`; online `waiting_record|completed`
  (nhận cả hai nên luồng khám 4 bước mới nhảy thẳng `completed` vẫn hiện đúng).
- Tổng luôn **dựng lại từ hồ sơ khám mới nhất**, không tin tổng hóa đơn cũ: `phí khám + dịch vụ phát
  sinh − đã thu`. Đơn giá dịch vụ tính lại server-side từ `DichVu.gia`.
- **Tiền mặt** → `ThanhToan.status='paid'` ngay + audit `LT_XAC_NHAN_THANH_TOAN`.
  **Chuyển khoản** → `pending`, chưa tính là đã thu cho tới khi `confirmTransfer`; xác nhận 2 tab thì
  tab sau 409. Hủy → `failed`, tạo lại được.
- **In hóa đơn bị chặn 3 lớp**: dịch vụ phát sinh đã đổi so với hóa đơn → 409; chưa
  `da_xac_nhan_thu_ngan` → 409; chưa `da_thanh_toan_du` → 409.
- Audit: `LT_LAP_HOA_DON`, `LT_XAC_NHAN_THANH_TOAN`, `PRINT_INVOICE`.

**Giới hạn thật (phải nói thẳng nếu hội đồng hỏi):** khách bỏ về không trả → ca **vẫn nằm nguyên tab
"Chờ thu"** với `con_phai_thu`, nhưng **chưa có workflow công nợ/contact task sau khám**. Hệ thống
phát hiện được, chưa có quy trình thu hồi. Đây là backlog, không phải lỗi.

### 5.6 Khách không đến / đến muộn

| Tình huống | Xử lý | Màn |
|---|---|---|
| Quá giờ 10′ (`CONTACT_LATE_ARRIVAL_MINUTES`) chưa check-in | `contactTasks.service.js` sinh **task ảo** `late:<appointmentId>` (không ghi DB), loại `xac_nhan_den_muon` | `/receptionist/contact-tasks` tab "Chưa liên hệ" |
| Lễ tân gọi xong | Insert `CUSTOMER_CONTACTED` mới (log **insert-only**, không sửa bản ghi cũ) | ContactTasks → tab "Đã liên hệ" + ActivityLog |
| 2 lễ tân cùng gọi | **Không chặn** — cố ý; hiển thị người gọi ĐẦU TIÊN sau yêu cầu | ContactTasks |
| Cuộc gọi cũ trước task mới | Chỉ tính `CUSTOMER_CONTACTED` có `ngay_tao` **lớn hơn** thời điểm yêu cầu | test E-3 |
| Khách đến muộn nhưng còn trong ngày | `markLateArrival` — bắt buộc đã qua `T`, tìm slot theo `policy` (mặc định `nearest_available`), dùng chung `apDungPhuongAn()` với luồng bệnh nhân | `/receptionist/appointments` |

### 5.7 Số điện thoại dùng chung nhiều hồ sơ

- Search SĐT trả **nhiều hồ sơ** + `ambiguous_appointments` (lịch cũ chỉ có SĐT, hệ thống **không tự đoán**)
  + `account_appointments` (lịch của tài khoản online mà hồ sơ tại quầy chưa liên kết — **không bị ẩn**).
- Check-in bắt buộc đi qua `CheckInVerifyModal`; backend đối chiếu `normalizePhone` + `normalizeName`
  và `appointmentBelongsToProfile` → chọn sai = **409**, không tạo hàng đợi.
- Mỗi hồ sơ một lượt riêng; không gộp người nhà.

### 5.8 Giới hạn chuyên môn của lễ tân

`patient-intake.controller.js` có **danh sách trắng** `ADMINISTRATIVE_PROFILE_FIELDS` (9 trường) và
**danh sách đen** `PROFESSIONAL_PROFILE_FIELDS` (`chan_doan`, `don_thuoc`, `sinh_hieu`,
`ket_qua_kham`, `dich_vu_phat_sinh`…). Gửi trường chuyên môn → **403** kèm tên trường; trường lạ →
403. **Bắt buộc `ly_do_cap_nhat`** (400 nếu thiếu). Diff trước/sau ghi vào audit; không đổi gì thì
`changed_fields` rỗng. `medical-record.controller.js` chặn thẳng mọi PATCH y khoa từ lễ tân.

### 5.9 Hai lễ tân thao tác đồng thời

| Thao tác | Cơ chế chống đua |
|---|---|
| Tiếp nhận offline | transaction + lock hồ sơ + kiểm lại lượt đang mở **bên trong** transaction |
| Gán bác sĩ | filter `{trang_thai:'cho_dieu_phoi', doctor_id:null}` + kiểm lại `trong_phong`/online cần bảo vệ trong session |
| Chuyển bác sĩ | filter kèm `doctor_id` **cũ** → người thứ hai không khớp → 409 |
| Đóng lượt | filter kèm `trang_thai` cũ |
| Xác nhận chuyển khoản | `findOneAndUpdate({status:'pending'})` → tab sau 409 |
| Đánh dấu đã gọi | **Cố ý không chặn** (log insert-only) |

### 5.10 Nhật ký ca trực

`receptionistAudit.service.js` — 15 mã hành động, 4 nhóm lọc (`tiep_nhan`, `thanh_toan`, `lich_hen`,
`lien_he`). Trang `/receptionist/activity-log` lọc theo **ngày / nhóm / người trực**, giới hạn 500 bản ghi.

Hai điểm thiết kế đáng nói:
- `ghiNhatKyLeTan()` **không bao giờ throw** và luôn gọi **ngoài transaction nghiệp vụ** — ghi log
  hỏng không được phép làm check-in thất bại (vì thất bại = cuối ca bị `no_show` = mất 100% tiền).
- Tên khách được bù từ nghiệp vụ (`payment → invoice → queue/appointment`) khi audit không có sẵn,
  nên dòng "thu tiền" vẫn hiện đúng tên người.
- `locMaTheoNhom` dùng `Object.hasOwn` để `?nhom=constructor` không làm 500.

---

## 6. Bản đồ endpoint ↔ màn hình (đã đối chiếu route thật)

Toàn bộ `/api/receptionist/*` đi qua `verifyToken` + `requireRole('receptionist','admin')`
(`routes/receptionist/index.js:36`), khớp `ProtectedRoute roles={['receptionist','admin']}`.

| Màn | Route FE | Endpoint chính |
|---|---|---|
| Tổng quan | `/receptionist` | `GET appointments?timeframe=today`, `GET appointments/pending-checkin`, `GET appointments/doctor-statuses`, `GET contact-tasks` |
| Tiếp nhận | `/receptionist/patient-intake` | `GET patient-intake/search`, `POST patient-intake/profiles`, `PATCH patient-intake/profiles/:id`, `GET .../offline-queue/capacity`, `POST .../offline-queue/intake`, `PATCH appointments/:id/arrived` |
| Hàng đợi vãng lai | `/receptionist/offline-queue` | `GET offline-queue`, `GET offline-queue/dispatch-suggestions`, `POST offline-queue/:id/assign`, `POST .../return-central`, `PATCH .../cancel` |
| Điều phối bác sĩ | `/receptionist/doctor-day-view` | `GET booking/day-overview`, `POST appointments/doctor-unavailable`, `GET doctor-leaves/pending`, `PATCH doctor-leaves/:id/approve|reject`, + 2 API offline-queue |
| Lịch hẹn | `/receptionist/appointments` | `GET appointments`, `PATCH :id/reschedule|late|cancel`, `POST bulk-*`, `GET :id/reschedule-history`, `GET appointments/overload-affected` |
| Liên hệ | `/receptionist/contact-tasks` | `GET contact-tasks`, `PATCH contact-tasks/:id/done` |
| Nhật ký | `/receptionist/activity-log` | `GET activity-log` |
| Viện phí | `/receptionist/payments` | `GET payments/cases?view=pending|paid`, `POST .../invoice`, `POST .../payments/:id/confirm|cancel`, `POST .../receipt` |
| Hàng đợi bác sĩ | (Dashboard) | `PATCH queue/:id/transfer`, `PATCH queue/:id/cancel` |

---

## 7. Khoảng hở phát hiện thêm (ngoài tài liệu 2026-08-12)

### 7.1 ⚠️ Thông báo tiếng Việt bị hỏng mã hóa trong `appointment.controller.js`

`backend/src/controllers/receptionist/appointment.controller.js` có **510 chuỗi bị double-encode
UTF-8**. Lễ tân sẽ nhìn thấy đúng những dòng này trên màn hình:

```
"Check-in pháº£i tra cá»©u vÃ  xÃ¡c nháº­n há»“ sÆ¡..."
"Lá»‹ch háº¹n khÃ´ng thuá»™c Ä‘Ãºng bá»‡nh nhÃ¢n vá»«a Ä‘Æ°á»£c xÃ¡c nháº­n."
"ÄÃ£ há»§y lá»‹ch háº¹n"
```

Đây là **lỗi hiển thị thật, không phải lỗi đọc file** — đã kiểm bằng decode nhị phân. Ảnh hưởng
đúng các thông báo lỗi quan trọng nhất của luồng check-in/hủy lịch. File khác cùng bệnh (nhẹ hơn):
`patient-intake.controller.js` (2), `admin/auth.controller.js` (6), `scripts/seed-doctor-test-data.js` (4),
`frontend/.../ManageServiceSpecialtyDetail.tsx` (4).

Sửa: decode `latin-1 → utf-8` cho các chuỗi hỏng. Không đụng logic.

### 7.2 ⚠️ Còn đường tiếp nhận offline CŨ chưa gỡ, bỏ qua hàng đợi trung tâm

`POST /api/receptionist/patient-intake/check-in` → `checkInPatientProfile` →
`tiepNhanHoSoVaoHangDoi()` (`offlineIntake.service.js`) — luồng **cũ**: tự chọn slot `walk_in` và
**gán bác sĩ ngay**, `trang_thai='dang_cho'`.

Route này **vẫn mount** song song với `/offline-queue/intake`. Frontend hiện gọi luồng mới
(`checkInWalkIn` → `intakeCentralOffline`), nhưng endpoint cũ vẫn gọi được và **không đi qua** trần
`MAX_CENTRAL_OFFLINE_QUEUE_SIZE`, không qua vùng bảo vệ online của `centralOfflineQueue`. Kế hoạch
WQ-18 dự kiến để feature flag `CENTRAL_OFFLINE_QUEUE_ENABLED` — flag đó **chưa tồn tại trong code**.

Đề xuất: hoặc gỡ route cũ, hoặc bọc bằng flag đúng như WQ-18 đã chốt.

### 7.3 Code chết đã xác nhận

- `checkInVangLai()` trong `checkIn.service.js` — không còn nơi gọi (đã ghi trong doc 2026-08-08).
- `hoanTatLuotKhamOnlineNeuDaThuDu()` — vô hiệu với ca đi qua luồng khám 4 bước (WS-1 đặt thẳng
  `completed`, không còn `waiting_record` để hàm này chuyển). Không sai dữ liệu, chỉ là nhánh chết.

### 7.4 `cho_dich_vu` mới có enum, chưa có endpoint

`HangDoi.trang_thai` và `LichHen.status` đều đã mở `cho_dich_vu`, `billing` đã nhận nó là ca đủ điều
kiện thu tiền, nhưng **không endpoint nào chuyển sang trạng thái này**. Đúng như ghi chú trong model.

### 7.5 UX nhỏ ở `OfflineQueue.tsx`

"Hủy chờ" và "Trả về hàng đợi" lấy lý do bằng `window.prompt`. Chạy được, nhưng lệch với chuẩn modal
của các màn khác (`QueueCancelModal`, `QueueTransferModal`) và không hợp phong cách demo. Ngoài ra
toàn bộ text màn này là **tiếng Việt không dấu**, khác các màn còn lại.

---

## 8. Ba câu chốt để trả lời hội đồng

1. **"Khách vãng lai có chen mất khách online không?"** — Không. Offline vào `cho_dieu_phoi`, chưa có
   `doctor_id` nên bác sĩ không thấy. Chỉ được gán khi bác sĩ có khoảng an toàn thật, và ngay lúc
   confirm hệ thống kiểm lại lần nữa trong transaction → có online vừa check-in thì 409.

2. **"Khách đã đến quầy rồi bỏ về có mất 100% tiền không?"** — Không bao giờ. `no_show` chỉ do hệ
   thống đặt, và điều kiện loại trừ đầu tiên là **đã tồn tại bản ghi `HangDoi`** — bất kể lượt đó sau
   đó bị đóng. Bỏ về = `cancelled` có lý do, có audit.

3. **"Ai đã thu tiền / hủy lịch / check-in khách này?"** — `/receptionist/activity-log`, lọc theo
   ngày · nhóm việc · người trực. `NhatKyThaoTac` là bảng insert-only, không sửa không xóa.
