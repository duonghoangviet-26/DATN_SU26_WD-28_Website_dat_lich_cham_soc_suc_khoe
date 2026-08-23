# Phân tích lỗ hổng — Trang Điều phối bác sĩ (2026-08-23)

> Phạm vi: toàn bộ luồng "bác sĩ nghỉ/bận đột xuất → điều phối lịch hẹn cũ".
> Căn cứ rule: `.claude/rules/lich-lam-viec-bac-si.md` mục 5, 7, 11, 14, 15.
> Kết quả: **3 cài đặt song song, mâu thuẫn nhau** + **12 lỗ hổng** (4 P0 gây sai dữ liệu/mất tiền).

---

## PHẦN A — Bản đồ luồng hiện tại

Hiện có **ba** đường "dời lịch hàng loạt" chạy song song, không đường nào biết đường nào:

| # | Đường | Điểm vào | Service | Tuân rule? |
|---|---|---|---|---|
| **1** | Lễ tân báo nghỉ đột xuất | `POST /receptionist/appointments/doctor-unavailable` | `taoDeXuatDoiChoDonNghi` → `sinhPhuongAnDoi` | ✅ Có |
| **2** | Duyệt đơn bác sĩ xin nghỉ | `PATCH /receptionist/doctor-leaves/:id/approve` | `duyetDonNghi` → cùng service #1 | ✅ Có |
| **3** | **Dời hàng loạt "Auto-fill"** | `POST /receptionist/appointments/bulk-reschedule` | **Tự cài đặt riêng, inline trong controller** | ❌ **Không** |

Đường #3 (`appointment.controller.js:1292`) là bản cài đặt **cũ hơn, viết tay, bỏ qua toàn bộ nghiệp vụ** đã chốt. Nó đang hiển thị trên UI ở `pages/receptionist/Appointments.tsx` (nút "Dời N lịch hẹn (Auto-fill)"), và theo `docs/Le tan/*.md` thì đây chính là thứ được ghi nhận là "✅ đã xong" cho chức năng LT-01 "Bác sĩ nghỉ đột xuất, chuyển bác sĩ".

**Đây là gốc rễ của cảm giác "chưa nắm rõ quy trình":** cùng một mục tiêu nghiệp vụ nhưng có 2 nút ở 2 trang khác nhau, hành xử hoàn toàn khác nhau, một cái đúng rule một cái sai rule.

### Trạng thái một lịch hẹn khi bị điều phối (đường #1/#2 — đường đúng)

```
Bác sĩ nghỉ
   │
   ├─ Khách ĐÃ CHECK-IN (có HangDoi)  ──► KHÔNG dời. Chuyển bác sĩ tại quầy
   │                                       (QueueTransferModal, giữ nguyên STT)
   │
   └─ Khách CHƯA ĐẾN
        │
        ├─ sinhPhuongAnDoi()  → tối đa 4 phương án, sắp theo độ lệch phút
        ├─ giuChoPhuongAn(PA#1) → slot mới chuyển `locked` (giữ sẵn)
        │
        ├─ CHƯA thanh toán ──► de_xuat_doi.trang_thai = 'cho_khach_chon'
        │                       khách tự chọn trên app, hạn 12h
        │
        └─ ĐÃ thanh toán  ──► de_xuat_doi.trang_thai = 'cho_admin_duyet'
                               lễ tân/admin duyệt → 'cho_khach_chon' → khách chọn
                               hạn 24h, quá hạn cron tự áp PA#1
```

---

## PHẦN B — 12 lỗ hổng

### 🔴 P0-1 · `bulk-reschedule` nhả slot cũ về pool → mất chỗ / đặt trùng

`appointment.controller.js:1323-1335`

```js
slot.benh_nhan_id = null
slot.benh_nhan_tam_giu_id = null
slot.status = 'active'          // ⛔ trả về pool
await schedule.save({ session })
```

Rule mục 15 nói rõ: *"Slot cũ phải chuyển `locked`, KHÔNG trả về pool — bác sĩ bận thật, không bán lại cho ai."*

Nghiêm trọng hơn: slot cũ được nhả **trước** khi tìm chỗ mới. Nếu vòng tìm 14 ngày không ra chỗ nào (`newSlotFound === false`), **không có đường phục hồi**:
- Slot cũ: `status='active'`, `benh_nhan_id=null` → hệ thống coi là trống, bán cho khách khác.
- `LichHen` vẫn giữ nguyên `schedule_id`/`slot_id` trỏ vào chính slot đó.

→ **Hai bệnh nhân, một slot.** Nếu index `uniq_lich_hen_theo_slot` đã build thì khách thứ hai nhận lỗi duplicate-key khó hiểu; nếu chưa build (rule mục 9 ghi *"⚠️ CHƯA CHẠY trên DB nhóm"*) thì đặt trùng thật.

### 🔴 P0-2 · `bulk-reschedule` crash 100% khi tìm được slot

`appointment.controller.js:1383`

```js
const phongKhamMoi = availableSlot.phong_id
  ? (await mongoose.model('MauLichLamViec')
       .findOne({'ca_kham.phong_id': availableSlot.phong_id}))
       .ca_kham.find(...)?.ten_phong
  : null;
```

`MauLichLamViec` **không có** field `ca_kham` — `phong_id` nằm ở **cấp cao nhất** (`models/MauLichLamViec.js:73`). Vậy `findOne()` luôn trả `null`, rồi `.ca_kham` trên `null` → **TypeError**.

Mà `phong_id` ở cấp slot là field **bắt buộc từ migration 011** (rule mục 10.A), nên `availableSlot.phong_id` luôn truthy.

→ **Hàm này ném 500 ngay khi nó thành công tìm được chỗ.** Nghĩa là: hoặc nó báo "dời được 0/N lịch" (không tìm ra chỗ), hoặc nó crash. **Không có nhánh nào chạy đúng.** Kết hợp P0-1: transaction abort nhưng nếu abort lỗi thì slot đã nhả vẫn nằm đó.

### 🔴 P0-3 · `apDungPhuongAn` chiếm được cả slot đang bị khoá vì nghỉ phép

`appointmentReschedule.service.js:225-231`

```js
slots: { $elemMatch: { _id: phuongAn.slot_id, status: { $in: ['active', 'locked'] } } }
```

`locked` được dùng cho **ba** việc khác hẳn nhau:
1. Chỗ giữ sẵn cho **chính khách này** (`giuChoPhuongAn`) — hợp lệ để chiếm.
2. Slot cũ của khách vừa dời đi (`apDungPhuongAn:249`) — **bác sĩ bận, không được bán**.
3. Slot bị khoá vì **bác sĩ nghỉ phép** (`bi_khoa_boi_nghi_phep=true`) — **tuyệt đối không được bán**.

Query trên không phân biệt được ba loại. Kịch bản hỏng thật:

> 09:00 — BS A nghỉ. Khách X (đã trả tiền) nhận đề xuất PA#1 = "BS B, 14:00", chỗ giữ sẵn.
> 11:00 — BS B cũng báo nghỉ. Slot 14:00 của B → `locked` + `bi_khoa_boi_nghi_phep=true`.
> Nhưng slot đó **cũng đang là chỗ giữ sẵn của X**, nên `lockSlotsForSuddenLeave` bỏ qua
> (chỉ khoá `active`/`pending_payment`) — nó vẫn `locked` từ trước.
> 09:00+24h — cron `apDungDeXuatQuaHan` áp PA#1 → **X bị chuyển sang một bác sĩ cũng đang nghỉ.**

Đường `chonPhuongAnTuDo` thì an toàn (có gọi `slotConTrong` kiểm `bi_khoa_boi_nghi_phep`), nhưng cả 3 đường còn lại — khách tự chọn (`patient/reschedule.controller.js:125`), admin duyệt rồi khách chọn, và cron quá hạn — đều đi thẳng vào `apDungPhuongAn` với phương án đã sinh từ nhiều giờ trước.

**Bản chất: `de_xuat_doi.phuong_an` là ảnh chụp cũ, nhưng lúc áp dụng không ai kiểm lại tính hợp lệ.**

### 🔴 P0-4 · Khách tự dời → slot cũ bị khoá vĩnh viễn (rò rỉ công suất)

`appointmentReschedule.service.js:246-252` khoá slot cũ **vô điều kiện**, kể cả khi `lyDoDoi='khach_yeu_cau'`.

Nhưng lý do khoá (mục 15) là *"bác sĩ bận thật"*. Khi **khách** tự đổi lịch, bác sĩ **không** bận — slot đó hoàn toàn bán lại được, và mục 11 hàm ý phải trả về pool.

→ Mỗi lần một khách bấm "dời lịch", phòng khám **mất vĩnh viễn 1 slot**. Chạy vài tháng là bảng lịch đầy slot `locked` ma. Rule mục 9 đã đánh dấu đây là câu hỏi *"❓ Cần chốt"* — đây là bằng chứng nó đang rò rỉ thật.

Ảnh hưởng cả `patient/reschedule.controller.js:155` (khách tự dời) lẫn `receptionist` `rescheduleAppointment`.

---

### 🟠 P1-5 · Không có đường "Khôi phục" sau khi báo nghỉ

`reportDoctorUnavailable` tạo `NghiPhepBacSi` với `trang_thai: 'da_duyet'` **ngay lập tức** (`appointment.controller.js:1515`).

- Bác sĩ chỉ hủy được đơn của **chính mình** và **chỉ khi còn `cho_duyet`** (`doctor/leaves.controller.js:172`).
- Lễ tân/admin: routes chỉ có `approve` / `reject`, **không có** `cancel` / `restore`.

→ Bấm nhầm "Báo nghỉ đột xuất" = **không có đường lùi**. Slot đã khoá, đề xuất đã sinh, thông báo đã gửi cho khách. Phải sửa tay trong DB.

Tin tốt: enum `NghiPhepBacSi.trang_thai` **đã có sẵn `'da_huy'`** (`models/NghiPhepBacSi.js:38`) — không cần đổi schema.

### 🟠 P1-6 · Một lịch hẹn chỉ chứa được MỘT đề xuất

`de_xuat_doi` là subdocument đơn, không phải mảng. Cả hai điểm vào đều lọc `&& !appointment.de_xuat_doi` (`appointment.controller.js:1535`, `doctorLeaveApproval.service.js:135`).

Kịch bản thường gặp: lễ tân báo nghỉ ca sáng trước, 10 phút sau bác sĩ báo nghỉ nốt cả ngày → gọi lại `doctor-unavailable`. Các lịch ca sáng đã có `de_xuat_doi` → bị đẩy sang `ly_do_bo_qua: 'dang_co_de_xuat_doi_mo'` → rơi vào rổ **"cần liên hệ thủ công"**, không phải vì thiếu chỗ mà chỉ vì trạng thái kỹ thuật.

Cũng chặn cả trường hợp P0-3 ở trên: khi bác sĩ đích cũng nghỉ, lịch đó **không được sinh đề xuất mới**.

### 🟠 P1-7 · Không đảm bảo "≥2 lựa chọn" như rule yêu cầu

Rule mục 15: *"Khách luôn được thông báo kèm **≥2 lựa chọn**"*.

`sinhPhuongAnDoi:131-137` chạy `slice(0,6)` → `gopPhuongAnTrung()` → `capTranLanWalkIn()` → `slice(0,4)`. Cả hai bộ lọc chạy **sau** khi đã cắt còn 6. Nếu 6 ứng viên đầu trùng khung (TMH 2 slot/khung) hoặc đều là walk-in cùng khung, kết quả có thể còn **1 phương án duy nhất** — và không có kiểm tra nào chặn.

Sửa đúng: lọc trùng/trần **trước**, cắt **sau**; nếu ra < 2 thì nới vòng tìm (ngày kế tiếp) trước khi bỏ cuộc.

### 🟠 P1-8 · Chỉ tìm phương án TRONG NGÀY

`sinhPhuongAnDoi:65` — `ngay: { $gte: ngay, $lt: addDays(ngay, 1) }`. Đúng 1 ngày.

Ghi chú hệ thống nói thẳng: *"Khong tim duoc phuong an nao trong ngay — phai lien he khach thu cong."* Nghĩa là bác sĩ nghỉ nguyên ngày mà không ai cùng chuyên khoa trực hôm đó → **100% lịch rơi vào xử lý tay**. Với phòng khám 1 chuyên khoa (TMH) và ít bác sĩ, đây là trường hợp **thường xuyên**, không phải ngoại lệ.

Đây chính xác là điều bạn nói: *"chỉ chọn trong ngày, không có chọn ngày khác"* — và nó nằm ở **backend**, không phải chỉ ở UI.

### 🟠 P1-9 · `bulk-reschedule` bỏ qua toàn bộ ràng buộc thời gian & loại slot

Vòng tìm slot (`:1359-1367`) chỉ kiểm `status==='active' && !benh_nhan_id && !bi_khoa_boi_nghi_phep`. **Không** kiểm:

| Ràng buộc | Rule | Hệ quả khi thiếu |
|---|---|---|
| `isSlotInPast` | — | Xếp khách vào 08:00 khi đang là 15:00 |
| `quaSatGioBatDau` (đệm 15′) | mục 15 | Khách không kịp tới nơi |
| `daQuaCutoffOnline` (T-30′) | mục 11 | Xếp vào khung đã đóng |
| `loai_slot === 'walk_in'` | mục 5 | **Ăn hết slot khách vãng lai**, trần 1/khung bị bỏ |

Ngoài ra `getBookedSlotIds()` (`:1310`) quét **toàn bộ collection `LichHen`** không lọc ngày — quả bom hiệu năng khi dữ liệu lớn.

### 🟠 P1-10 · `bulk-reschedule` không ghi field bắt buộc, không báo khách đúng cách

- Ghi `ly_do_doi_lich` (chuỗi tự do) thay vì `ly_do_doi` (enum bắt buộc `khach_yeu_cau|phong_kham` — rule mục 10.D).
- Không tăng `so_lan_doi_khach_yeu_cau`, không kiểm trần 1 lần.
- Hardcode `vai_tro: 'admin'` (`:1393`) dù lễ tân thao tác → **nhật ký sai người**.
- Không tạo `de_xuat_doi`, **không cho khách chọn gì** — chỉ gửi email *"Phòng khám đã tự động dời lịch hẹn của bạn sang..."*. Trái thẳng mục 15 (*"khách luôn được thông báo kèm ≥2 lựa chọn, có hạn phản hồi"*).

---

### 🟡 P2-11 · API đã hỗ trợ chọn từng lịch, UI thì không

`reportDoctorUnavailable` **đã nhận** `appointment_ids` (`:1445-1448`) để chỉ điều phối một tập lịch được chọn. Nhưng `DoctorUnavailableModal.tsx` **không gửi** field này → luôn điều phối toàn bộ.

Tức là năng lực "chọn lịch nào cần dời" **đã có sẵn ở backend**, chỉ thiếu giao diện.

### 🟡 P2-12 · Giao diện: modal lồng 3 tầng, không nhìn được toàn cục

Chuỗi hiện tại: `DoctorDayView` → `DoctorUnavailableModal` (max-w-2xl) → `RescheduleNeedsApprovalList` → `ChonKhacPanel` (z-60) → và song song `QueueTransferModal`.

Hệ quả cụ thể:
- **Kết quả điều phối chỉ tồn tại trong RAM.** Đóng modal là mất — không có trang nào xem lại được "đơn nghỉ này đã xử lý tới đâu". Muốn xem phải sang `Liên hệ khách hàng` đọc nhật ký.
- Danh sách hiện dạng **thẻ xếp dọc**, mỗi thẻ chỉ hiện `so_phuong_an` + 6 ký tự cuối của `appointment_id`. **Không hiện tên khách, giờ khám, phương án là gì.** Người duyệt bấm "Duyệt" mà không biết mình đang duyệt cái gì.
- Không có checkbox → **không thao tác hàng loạt được**, dù mọi thứ backend cần đã có.
- `ChonKhacPanel` bắt chọn bác sĩ trước rồi mới hiện slot của **một** bác sĩ trong **một** ngày → muốn so sánh phải bấm qua lại từng người.

---

## PHẦN C — Giải pháp đề xuất

### C.1 · Nguyên tắc: gộp về MỘT service (áp mục 7)

Rule mục 7 đã có tiền lệ: *"Check-in đi qua **duy nhất 1 service**"*. Áp nguyên tắc đó cho dời lịch:

- **Xoá** `bulkRescheduleAppointments` (đường #3) — không sửa, vì nó sai từ thiết kế: nhả slot về pool, tự dời không hỏi khách, và đằng nào cũng crash.
- Thay bằng `POST /receptionist/reschedule-approvals/bulk-*` gọi **đúng** `apDungPhuongAn()`/`chonPhuongAnTuDo()`.
- Nút "Dời hàng loạt (Auto-fill)" ở `Appointments.tsx` đổi thành link sang trang điều phối mới.

### C.2 · Vá 4 lỗi P0

| Lỗi | Cách sửa |
|---|---|
| P0-1, P0-2 | Xoá hàm (theo C.1). Không còn code để lỗi. |
| **P0-3** | Thêm `lyDoKhoa` phân biệt 3 loại `locked`. Query chiếm slot đổi thành: `status='active'` **HOẶC** (`status='locked'` **VÀ** `benh_nhan_tam_giu_id = user_id của chính lịch này` **VÀ** `bi_khoa_boi_nghi_phep != true`). Không cần field mới — dùng `benh_nhan_tam_giu_id` đã có. |
| **P0-4** | `apDungPhuongAn` nhận thêm `khoaSlotCu` (mặc định `true`). `lyDoDoi==='khach_yeu_cau'` → truyền `false`, trả slot cũ về `active` cho pool. |

### C.3 · Nâng cấp thuật toán sinh phương án

1. **Mở rộng phạm vi ngày** (vá P1-8): tìm ngày gốc trước; nếu chưa đủ 2 phương án thì nới sang ngày kế tiếp, tối đa `SO_NGAY_TIM_PHUONG_AN` (mặc định 7, đọc từ env). Vẫn sắp theo độ lệch phút — lệch sang ngày khác cộng thêm penalty ngày để không nhảy ngày khi cùng ngày còn chỗ.
2. **Đảo thứ tự lọc/cắt** (vá P1-7): `gopPhuongAnTrung` → `capTranLanWalkIn` → **rồi mới** `slice(0,4)`. Đảm bảo ≥2 hoặc ghi rõ lý do không đủ.
3. **Kiểm lại lúc áp dụng**: trước khi `apDungPhuongAn`, chạy lại `slotConTrong()` trên dữ liệu mới nhất. Không hợp lệ → sinh lại phương án thay vì áp mù (vá phần còn lại của P0-3).

### C.4 · Nút "Khôi phục" (vá P1-5)

Endpoint mới `PATCH /receptionist/doctor-leaves/:id/huy-bao-nghi`, theo đúng lựa chọn đã chốt (*"chỉ tắt trạng thái nghỉ, không đụng lịch đã xử lý"*):

```
1. leave.trang_thai = 'da_huy'                        (enum đã có sẵn)
2. Mở khoá slot:  bi_khoa_boi_nghi_phep=true
                + nghi_phep_id = leave._id
                + status='locked'
                + benh_nhan_id=null           →  status='active'
   (slot đã 'booked' hoặc đang giữ chỗ cho khách khác: KHÔNG đụng)
3. schedule.trang_thai_ngay: 'nghi_phep' → 'lam_viec'
4. Huỷ đề xuất CHƯA áp dụng:
      de_xuat_doi.trang_thai ∈ {cho_khach_chon, cho_admin_duyet}
      ∧ de_xuat_doi.nghi_phep_id = leave._id
   → nhaChoDaGiu() từng phương án, set trang_thai='da_huy',
     gửi ThongBao "Bác sĩ đã đi làm lại, lịch của bạn giữ nguyên"
5. Đề xuất ĐÃ 'da_ap_dung': GIỮ NGUYÊN, chỉ đếm và báo cáo
6. Ghi NhatKyThaoTac 'HUY_BAO_NGHI' + LichSuLichHen cho từng lịch bị đảo
```

**UI:** trên thẻ bác sĩ ở `DoctorDayView`, khi `trang_thai_ngay ∈ {nghi, nghi_phep}` thì nút "Báo nghỉ đột xuất" **được thay bằng** cụm:

```
[⚠ Đang nghỉ]  [Khôi phục]  [Điều phối lịch hẹn →]
```

Bấm "Khôi phục" hiện xác nhận nêu rõ: *"N lịch đã được dời sẽ GIỮ NGUYÊN ở chỗ mới. M lịch chưa xử lý sẽ trở về giờ cũ."*

### C.5 · Trang "Điều phối lịch hẹn" — route riêng, dạng bảng

`/receptionist/dieu-phoi/:leaveId` (đã chốt: trang riêng, có URL).

**Bố cục:**

```
┌─ BS Nguyễn Văn A · nghỉ 23/08 ca sáng · "Việc gia đình"  [Khôi phục]
│  12 lịch ảnh hưởng · 8 đã có phương án · 3 chờ duyệt · 1 chưa có chỗ
├────────────────────────────────────────────────────────────────────
│ ☐  Giờ   Khách          SĐT        Trạng thái      Phương án đề xuất
│ ☑ 08:00  Trần Thị B     09xx  Chờ duyệt (đã trả)  BS C · 08:00 (giữ giờ) ▾
│ ☑ 08:30  Lê Văn D       09xx  Chờ khách chọn      BS C · 09:00 (+30′)    ▾
│ ☐ 09:00  Phạm Thị E     09xx  ⚠ Không có chỗ      — chọn tay —           ▾
│ ☐ 09:30  Hoàng Văn F    09xx  ✓ Đã dời            BS C · 10:00           ✓
│ ☐ 10:00  Vũ Thị G       09xx  🔵 Đang tại quầy    → Chuyển bác sĩ ngay
├────────────────────────────────────────────────────────────────────
│ Đã chọn 2  [Duyệt phương án đề xuất]  [Chọn khác cho từng lịch]
```

Mỗi dòng bung ra (▾) hiện **cả 4 phương án** kèm radio, có nhãn "đã giữ chỗ", "lấn walk-in", độ lệch phút. Chọn tay = mở `ChonKhacPanel` cho đúng dòng đó.

Dữ liệu: `GET /receptionist/reschedule-approvals?leave_id=...` (mở rộng `list` hiện có — thêm filter `leave_id` và trả thêm `ten_khach`, `gio_kham`, `payment_status`, đủ 4 phương án — hầu hết `fmt()` đã trả sẵn).

### C.6 · Chuyển hàng loạt — quy trình chặt

**Chỉ cho hàng loạt ở nhánh AN TOÀN**, tay ở nhánh cần cân nhắc:

| Hành động | Hàng loạt? | Vì sao |
|---|---|---|
| Duyệt phương án #1 hệ thống đề xuất | ✅ Có | Đã qua thuật toán, đã giữ chỗ, khách vẫn được chọn lại |
| Chọn tay theo yêu cầu khách | ❌ Không | Mỗi khách một yêu cầu riêng — gộp là nguồn sai số |
| Chuyển bác sĩ tại quầy | ❌ Không | Khách đang ngồi chờ, phải nói chuyện từng người |

`POST /receptionist/reschedule-approvals/bulk-approve` với `{ appointment_ids: [...] }`:

1. **Xác nhận 2 bước** — hộp thoại liệt kê từng dòng "Khách → phương án", buộc đọc trước khi bấm.
2. **Kiểm lại từng slot** ngay trước khi ghi (C.3.3) — slot vừa mất thì dòng đó **fail riêng**, không kéo cả lô.
3. **Không dùng transaction cho cả lô** — mỗi lịch một transaction nhỏ. 1 lịch hỏng không rollback 11 lịch đã xong.
4. **Trả bảng kết quả từng dòng** (`thanh_cong` / `that_bai` + lý do), không phải `alert()` một câu như hiện tại.
5. **Ghi audit từng dòng** + một bản ghi `LT_DIEU_PHOI_HANG_LOAT` gộp, để truy vết được "ai bấm nút gì lúc mấy giờ".

---

## Thứ tự triển khai đề xuất

| Đợt | Nội dung | Rủi ro |
|---|---|---|
| **1** | P0-3, P0-4 (2 hàm trong `appointmentReschedule.service.js`) | Thấp — sửa tại chỗ, có unit test |
| **2** | Xoá `bulk-reschedule` + nút UI (P0-1, P0-2, P1-9, P1-10) | Thấp — gỡ code chết |
| **3** | Khôi phục báo nghỉ (P1-5) + đổi nút trên `DoctorDayView` | Trung bình — endpoint mới |
| **4** | Mở rộng ngày + đảo thứ tự lọc (P1-7, P1-8) | Trung bình — đổi thuật toán, cần test |
| **5** | Trang `/receptionist/dieu-phoi/:leaveId` (P2-11, P2-12) | Cao — nhiều UI mới |
| **6** | `bulk-approve` (C.6) | Trung bình — dựa trên đợt 5 |

P1-6 (nhiều đề xuất/lịch) cần đổi schema `de_xuat_doi` thành mảng — **để sau**, vì đợt 3 (khôi phục) đã giảm phần lớn tình huống gây ra nó.
