# Thiết kế — Nâng cấp luồng Bác sĩ & Lễ tân sau demo hội đồng

> **Ngày:** 2026-08-08
> **Bối cảnh:** 5 lỗi hội đồng nêu khi demo thử. Tài liệu này phân tích nguyên nhân gốc từng lỗi,
> chốt giải pháp, và chia thành 5 workstream độc lập.
> **Rule bất biến áp dụng:** `.claude/rules/lich-lam-viec-bac-si.md` — thiết kế này KHÔNG sửa
> bất kỳ điều khoản nào của rule đó.

---

## 0. Tóm tắt điều hành

| # | Lỗi hội đồng nêu | Nguyên nhân gốc | Workstream |
|---|---|---|---|
| 1 | Luồng khám quá sơ sài | 1 form phẳng nhồi mọi field; hàng đợi nhảy thẳng `trong_phong → hoan_thanh`; bước "dịch vụ" chưa từng tồn tại | **WS-1** |
| 2 | BS không xem lại được BN đã khám | Tab "Đã qua" mặc định rỗng, chỉ hiện lịch hẹn, không gộp thành hồ sơ | **WS-2** |
| 3 | Lễ tân không nhận thông báo từ BS | Không có kênh BS → LT; thông báo hiện tại là dữ liệu bịa | **WS-3** |
| 4 | Không có lịch sử thao tác lễ tân | `checkIn.service.js` không ghi audit dòng nào | **WS-4** |
| 5 | Giao diện check-in rối | 1 trang 1340 dòng gánh 2 nghiệp vụ khác nhau + 8 modal | **WS-5** |

**Thứ tự thi công:** WS-4 → WS-1 → WS-2 → WS-3 → WS-5.

---

## 1. Nguyên tắc nền — KHÔNG đụng rule đã đóng băng

Thiết kế này **không sửa**: `HangDoi` (bậc ưu tiên động, aging, overflow), `LichHen` (trạng thái,
`ly_do_doi`, hạn mức dời), `LichLamViec`/`MauLichLamViec`, quota online/walk-in 70/30, các mốc
`T-30' / T-15' / T / T+15'`, chính sách không hoàn tiền, cơ chế `no_show` tự động.

Toàn bộ thay đổi schema là **thêm field mới có default**, không phá dữ liệu demo:

| Model | Field thêm | Kiểu | Default | Ảnh hưởng dữ liệu cũ |
|---|---|---|---|---|
| `KetQuaKham` | `buoc_hien_tai` | enum `tiep_nhan\|chan_doan\|dich_vu\|ke_don\|hoan_tat` | `tiep_nhan` | Không — bản ghi cũ đều đã `da_xac_nhan`, đọc ra coi như `hoan_tat` |
| `ThongBao` | `nhom_nhan` | enum `receptionist\|doctor\|admin\|null` | `null` | Không — `null` giữ nguyên hành vi gửi theo `user_id` |
| `ThongBao` | `da_doc_boi` | `[ObjectId]` | `[]` | Không |
| `NhatKyThaoTac` | 10 giá trị `hanh_dong` mới | — | — | **Không đổi schema chút nào** — `hanh_dong` là `String` tự do (maxlength 100), `loai_doi_tuong` cũng vậy. Chỉ thêm giá trị + cập nhật khối comment danh mục |

**KHÔNG tạo collection mới.** **KHÔNG dùng** trạng thái `cho_dich_vu` (quyết định mục 3.3).

---

## 2. Quyết định nghiệp vụ đã chốt (2026-08-08)

| # | Câu hỏi | Quyết định | Lý do |
|---|---|---|---|
| Q1 | Chỉ định dịch vụ thì BN có rời phòng không? | **Luôn ở trong phòng** | Đơn giản, không đụng hàng đợi. Đánh đổi: phòng bị khóa suốt thời gian làm dịch vụ → chính là tình huống sinh thông báo "ca kéo dài" ở WS-3 |
| Q2 | Thu tiền dịch vụ phát sinh ở đâu? | **Quầy, khi khách ra về** | `billing.controller` đã cho phép lập hóa đơn ở trạng thái `hoan_thanh`. Bác sĩ không chạm tiền |
| Q3 | Trang check-in làm lại thế nào? | **Tách trang "Quầy tiếp nhận" mới** | 2 nghiệp vụ khác nhau phải ở 2 trang khác nhau |
| Q4 | 2 lễ tân có phân vai cứng không? | **Không phân quyền, chỉ ghi nhật ký** | Đúng yêu cầu "người này nghỉ người kia làm thay" |
| Q5 | BS gửi thông báo gì cho LT? | **Cả 4 loại** (ca kéo dài, không thấy BN, thu tiền DV, tạm dừng phòng) | Xem bảng mục 5.2 |
| Q6 | Nhắc gọi khách trễ tính từ mốc nào? | **T+10'** | Còn 5 phút cứu khách trước khi tụt bậc `offline` lúc `T+15'` |
| Q7 | Bước 1 bắt buộc field nào? | **Chỉ triệu chứng** | Cân nặng/chiều cao khuyến nghị, cảnh báo vàng không chặn — bắt buộc sẽ sinh dữ liệu rác khi tái khám |

---

## 3. WS-1 — Luồng khám 4 bước (Bác sĩ)

### 3.1 Hiện trạng và nguyên nhân gốc

- `frontend/src/components/doctor/ExamResultModal.tsx` là **một form phẳng** chứa đồng thời sinh hiệu
  (`can_nang`, `chieu_cao`, `huyet_ap`, `nhiet_do`, `nhip_tim`), chẩn đoán, hướng dẫn, ghi chú, ngày
  tái khám. Bác sĩ nhìn thấy tất cả cùng lúc → không có "quy trình", đúng như hội đồng nhận xét.
- Hàng đợi đi thẳng `trong_phong → hoan_thanh` (`doctor/queue.controller.js` `finish`). Không có
  điểm dừng nào giữa chừng.
- Trạng thái `cho_dich_vu` **đã tồn tại** trong enum `HangDoi.trang_thai` và `billing.controller.js`
  đã coi nó là hợp lệ để lập hóa đơn — nhưng **không có API nào đưa bệnh nhân vào trạng thái đó**.
  Bước dịch vụ chưa từng được hiện thực.
- Bác sĩ nhập hồ sơ **sau khi** đã bấm hoàn thành → thứ tự ngược với thực tế khám bệnh.

### 3.2 Kiến trúc mới

**Đổi modal thành trang riêng** `/doctor/exam/:queueId` (`ExamSessionPage`).
Lý do: 4 bước + đơn thuốc nhiều dòng không vừa modal; click ra ngoài modal là mất toàn bộ dữ liệu.

```
BƯỚC 1            BƯỚC 2            BƯỚC 3            BƯỚC 4          XÁC NHẬN
Tiếp nhận    →    Chẩn đoán    →    Dịch vụ     →     Kê đơn     →    Đọc lại
sinh hiệu         chẩn đoán*        chỉ định DV       đơn thuốc       toàn bộ hồ sơ
triệu chứng*      giải pháp         (bỏ qua được)     (bỏ qua được)        ↓
                  lưu ý                                          [Hoàn tất & mời BN kế tiếp]
                  ngày tái khám
(* = bắt buộc)
```

### 3.3 Chi tiết từng bước

**Bước 1 — Tiếp nhận**
- Ghi vào `SinhHieuKham` (model đã đủ field, có unique index theo `hang_doi_id`/`appointment_id`).
- `trieu_chung_ban_dau` ghi vào `KetQuaKham` (field đã có).
- Hiển thị sẵn dị ứng / bệnh nền / nhóm máu đọc từ `HoSoBenhNhan` — bác sĩ không phải hỏi lại.
- BMI tự tính khi có đủ cân nặng + chiều cao.
- **Chặn sang bước 2 khi thiếu triệu chứng.** Thiếu cân nặng/chiều cao → cảnh báo vàng, vẫn cho đi tiếp.

**Bước 2 — Chẩn đoán**
- `chan_doan` (bắt buộc — schema đã `required`), `huong_dan_dieu_tri` (giải pháp),
  `ghi_chu` (lưu ý), `ngay_tai_kham`.
- ⚠️ Tên field trong `KetQuaKham` là **`huong_dan_dieu_tri`**, không phải `huong_dan`.

**Bước 3 — Dịch vụ**
- Danh sách checkbox lấy từ `DichVu` với `loai='related'`, lọc theo `specialty_id` của bác sĩ.
  API `listRelatedServices` (`doctor/appointments.controller.js:636`) đã có sẵn.
- Tick → hiện dòng có tên, số lượng, đơn giá, thành tiền.
- **Bệnh nhân ở lại trong phòng** (quyết định Q1). Bác sĩ thực hiện dịch vụ rồi bấm "Đã thực hiện xong".
- Ghi vào `KetQuaKham.dich_vu_phat_sinh[]` — sub-schema đã có đủ `service_id`, `ten`, `so_luong`,
  `don_gia`, `thanh_tien`, `chi_dinh_boi_bac_si_id`.
- Nút "Bỏ qua bước này" khi không chỉ định gì.
- **Bác sĩ không thao tác tiền.** Tiền do lễ tân thu ở quầy (quyết định Q2).
- Trạng thái `cho_dich_vu` **không dùng** trong luồng này — giữ nguyên trong enum cho tương lai.

**Bước 4 — Kê đơn**
- Dùng `DonThuoc` hiện có: tối đa 10 thuốc, mỗi thuốc có `ten_thuoc`, `lieu_luong`, `tan_suat`,
  `gio_uong[]` (HH:MM — nối được vào nhắc uống thuốc), `so_ngay` (1–90), `ghi_chu`.
- Đặt `nguon='bac_si'`, `doctor_id`, `ket_qua_kham_id`, `medical_record_id`.
- Nút "Không kê đơn" — hoàn toàn tùy bác sĩ (yêu cầu người dùng).
- Gợi ý bối cảnh: hiển thị lại chẩn đoán bước 2 + dịch vụ bước 3 ở cột bên để bác sĩ quyết định.

**Màn Xác nhận**
- Đọc lại toàn bộ 4 bước trên một trang — đây chính là "hồ sơ bệnh án hoàn chỉnh" hội đồng yêu cầu.
- Nút **"Hoàn tất ca khám & mời bệnh nhân tiếp theo"** chạy 1 transaction:
  1. `KetQuaKham.status = 'da_xac_nhan'`, `buoc_hien_tai = 'hoan_tat'`, `thoi_diem_xac_nhan = now`
  2. `HangDoi.trang_thai = 'hoan_thanh'`, `thoi_diem_ket_thuc = now`
  3. `LichHen.status = 'completed'`
  4. Nếu `dich_vu_phat_sinh.length > 0` → bắn thông báo `BS_THU_TIEN_DICH_VU` cho nhóm lễ tân (WS-3)
  5. Ghi audit `DOCTOR_COMPLETE_EXAM` (`vai_tro='doctor'`, `loai_doi_tuong='examination_result'`)
     — đây là `hanh_dong` mới thuộc WS-1, tách khỏi 10 mã `LT_*` của WS-4
- Response **trả kèm bệnh nhân kế tiếp** trong hàng đợi (sort theo `soSanhThuTuHangDoi`) → UI hiện
  ngay thẻ "Tiếp theo: Nguyễn Văn B — [Gọi]". Bác sĩ không phải quay về trang hàng đợi.

### 3.4 Lưu nháp

- Mỗi lần bấm "Tiếp tục" → `PATCH /api/doctor/exam-session/:queueId/step/:buoc` lưu nháp bước đó,
  `KetQuaKham.status = 'ban_nhap'`, `buoc_hien_tai` = bước kế tiếp.
- Mở lại trang → đọc `buoc_hien_tai`, nhảy đúng vào bước đang dở.
- **Không có nút "Lưu" thủ công** — tránh bác sĩ quên lưu.
- Cho phép quay lại bước trước để sửa (breadcrumb bấm được) khi còn `ban_nhap`.
- Sau khi hoàn tất: khóa theo cơ chế hiện có (`co_the_sua` → false sau 24h qua cron
  `LOCK_EXAMINATION_RESULT`).

### 3.5 Backend

**File mới:** `backend/src/services/examSession.service.js` — **nguồn duy nhất** ghi phiên khám.

Hàm export:
- `layPhienKham(queueId, doctorId)` — trả về nháp hiện tại + `buoc_hien_tai` + dữ liệu bối cảnh
- `luuBuocTiepNhan(...)` — ghi `SinhHieuKham` + `trieu_chung_ban_dau`
- `luuBuocChanDoan(...)`
- `luuBuocDichVu(...)` — ghi `dich_vu_phat_sinh[]`
- `luuBuocKeDon(...)` — ghi/cập nhật `DonThuoc`
- `hoanTatPhienKham(...)` — transaction mục 3.3, trả về bệnh nhân kế tiếp

**Endpoint cũ giữ nguyên chữ ký** (`createResult`, `createResultByQueue`, `updateResult`) nhưng
gọi vào service này bên trong — không nhân đôi luồng ghi, đúng nguyên tắc "đi qua duy nhất 1 service"
của rule mục 7.

**File mới:** `backend/src/controllers/doctor/exam-session.controller.js` +
`backend/src/routes/doctor/exam-session.routes.js`, mount tại `/api/doctor/exam-session`.

### 3.6 Frontend

- `frontend/src/pages/doctor/ExamSessionPage.tsx` — khung trang + thanh bước + điều hướng
- `frontend/src/components/doctor/exam/StepTiepNhan.tsx`
- `frontend/src/components/doctor/exam/StepChanDoan.tsx`
- `frontend/src/components/doctor/exam/StepDichVu.tsx`
- `frontend/src/components/doctor/exam/StepKeDon.tsx`
- `frontend/src/components/doctor/exam/StepXacNhan.tsx`
- `frontend/src/services/doctor-exam-session.service.js`

`ExamResultModal.tsx` giữ lại cho luồng xem/sửa hồ sơ đã có, **không** dùng cho ca khám mới.
`DoctorExamQueue.tsx`: nút "Vào phòng" điều hướng sang `/doctor/exam/:queueId` thay vì mở modal.

---

## 4. WS-2 — Bệnh nhân đã khám (Bác sĩ)

### 4.1 Nguyên nhân gốc

- `DoctorAppointments.tsx` có tab "Đã qua" nhưng biến `historyLocked` (dòng ~177) làm tab này
  **mặc định rỗng**, chỉ hiện khi có từ khóa tìm kiếm hoặc chọn ngày cụ thể.
- Nội dung tab là **lịch hẹn**, không phải hồ sơ khám: không có sinh hiệu, không có dịch vụ, không
  có đơn thuốc.
- `getPatientProfileHistory` (`appointments.controller.js:1020`) đã tồn tại nhưng chưa có màn hình
  nào dùng đúng mục đích này.

### 4.2 Thiết kế

**Trang mới** `/doctor/patients` — "Bệnh nhân đã khám".

**Danh sách:**
- Nguồn: `KetQuaKham` có `bac_si_phu_trach_id = bác sĩ đang đăng nhập`, sort `ngay_tao` giảm dần.
- Cột: ngày khám · tên bệnh nhân · tuổi/giới · chẩn đoán (rút gọn) · có đơn thuốc · có dịch vụ.
- Lọc: khoảng ngày, tìm theo tên/SĐT, lọc "có đơn thuốc", lọc "có dịch vụ".
- **Không khóa mặc định** — mở trang là thấy danh sách gần nhất ngay.

**Chi tiết hồ sơ** — một trang gộp đầy đủ:
1. Hành chính: tên, tuổi, giới, SĐT, dị ứng, bệnh nền, nhóm máu
2. Sinh hiệu (`SinhHieuKham`) + BMI
3. Triệu chứng ban đầu
4. Chẩn đoán (`chan_doan`) · Hướng dẫn (`huong_dan_dieu_tri`) · Lưu ý (`ghi_chu`) · Ngày tái khám
5. Dịch vụ đã sử dụng + thành tiền (`dich_vu_phat_sinh[]`)
6. Đơn thuốc (`DonThuoc`) — bảng thuốc, liều, giờ uống, số ngày
7. Hóa đơn liên quan (`HoaDon`) — trạng thái thanh toán
8. Lịch sử chỉnh sửa hồ sơ (`lich_su_sua[]`)

**Lịch sử khám của bệnh nhân đó:** danh sách các lần khám trước — **phạm vi bác sĩ đang đăng nhập**
(theo đúng yêu cầu "bệnh nhân đã khám của bác sĩ đó"). Bấm vào xem chi tiết lần đó để so diễn tiến.

**In hồ sơ:** print CSS cho trang chi tiết (khổ A4, ẩn nav/nút).

### 4.3 API

- `GET /api/doctor/patients` — danh sách hồ sơ đã khám của mình (phân trang, lọc)
- `GET /api/doctor/patients/:memberId/history` — các lần khám trước của BN đó, phạm vi bác sĩ này
- `GET /api/doctor/records/:ketQuaKhamId` — hồ sơ đầy đủ (gộp populate 8 mục trên)

Kiểm tra quyền: mọi endpoint chặn `bac_si_phu_trach_id !== docId` → 403.

---

## 5. WS-3 — Kênh thông báo Bác sĩ → Lễ tân

### 5.1 Nguyên nhân gốc

`backend/src/controllers/receptionist/notification.controller.js` hiện:
- Lấy 20 `LichHen` mới nhất rồi **ghép chuỗi bịa** ra thông báo "Có lịch khám mới!"
- Trạng thái đã đọc lưu ở `localStorage` phía trình duyệt (`receptionist_last_viewed_notification`)
- **Không có bất kỳ kênh nào từ bác sĩ sang lễ tân**

`ThongBao` hiện gắn `user_id` = một người cụ thể → không gửi được cho "nhóm lễ tân".

### 5.2 Thiết kế

**Schema:** thêm `ThongBao.nhom_nhan` (enum `receptionist|doctor|admin|null`, default `null`) và
`ThongBao.da_doc_boi` (`[ObjectId]`, default `[]`).
- `nhom_nhan = 'receptionist'` → mọi lễ tân đều thấy.
- Đã đọc tính **theo từng người** qua `da_doc_boi` → 2 lễ tân không giẫm chân nhau.
- Không tạo collection mới. Index: `{ nhom_nhan: 1, ngay_tao: -1 }`.

**Bốn loại thông báo:**

| Mã | Nguồn | Kích hoạt | Nội dung | Lễ tân xử lý |
|---|---|---|---|---|
| `BS_CA_KEO_DAI` | BS bấm | Nút "Báo ca kéo dài" trong `ExamSessionPage`, chọn ~N phút | "BS X báo ca hiện tại còn ~20 phút, hàng đợi đang trễ" | Trấn an khách đang chờ |
| `BS_KHONG_THAY_BENH_NHAN` | BS bấm | Sau khi `so_lan_goi >= 2` → hiện nút "Nhờ lễ tân tìm khách" **trước** nút "Bỏ lượt" | "Đã gọi 2 lần không thấy Nguyễn Văn A (STT 07)" | Loa gọi / gọi điện, báo lại kết quả |
| `BS_THU_TIEN_DICH_VU` | Tự sinh | Hoàn tất ca có `dich_vu_phat_sinh` | "Khách Nguyễn Văn A có 350.000đ dịch vụ cần thu khi ra về" | Thu tiền, lập hóa đơn |
| `BS_TAM_DUNG_PHONG` | BS bấm | Đổi `TrangThaiPhongKham` sang `tam_nghi` / `san_sang` | "BS X tạm dừng nhận bệnh nhân" / "đã sẵn sàng trở lại" | Ngừng / tiếp tục đưa khách vào |

**Phản hồi hai chiều:** với `BS_KHONG_THAY_BENH_NHAN`, lễ tân có nút "Đã tìm thấy" / "Không liên
lạc được" → sinh `ThongBao` ngược lại cho bác sĩ + ghi audit `LT_XU_LY_THONG_BAO_BS`. Bác sĩ mới
quyết định bỏ lượt.

**Hiển thị:**
- Chuông ở `receptionist/Layout.tsx` (đã có, bỏ hẳn `localStorage`, dùng `da_doc_boi`)
- **Hàng cảnh báo cố định trên trang Quầy tiếp nhận** cho thông báo chưa xử lý — không để lọt

**Bỏ hoàn toàn** phần "thông báo ảo" từ `LichHen` trong controller cũ.

### 5.3 Nhắc gọi khách trễ 10 phút

**File mới:** `backend/src/services/lateArrivalReminder.service.js` + cron 5 phút.

Điều kiện quét:
- `LichHen` hôm nay, `status = 'confirmed'` **và** `payment_status = 'paid'`
  (⚠️ `paid` nằm ở `payment_status`, **không** nằm trong enum `status` — enum `status` là
  `pending | confirmed | checked_in | in_progress | waiting_record | waiting_doctor_confirm |
  completed | cancelled | no_show | skipped`)
- **Chưa có** bản ghi `HangDoi` (chưa check-in)
- `now >= T + 10'` với `T` = giờ bắt đầu khung, tính qua `utils/clinicTime.js`
- Chưa hết ca
- **Chưa từng nhắc** cho lịch hẹn này (idempotent — kiểm tra `NhatKyThaoTac` đã có
  `CUSTOMER_CONTACT_REQUIRED` cho `doi_tuong_id` đó chưa)

Hành động: ghi `NhatKyThaoTac` với `hanh_dong='CUSTOMER_CONTACT_REQUIRED'` (tái dùng cơ chế đang
chạy tốt ở `contactTasks.service.js`, cặp `CUSTOMER_CONTACT_REQUIRED` / `CUSTOMER_CONTACTED`) +
1 `ThongBao` nhóm lễ tân.

Việc hiện lên trang "Cần liên hệ" đã có sẵn (`ContactTasks.tsx`) — không phải làm màn hình mới.

**Vì sao mốc T+10':** khách còn 5 phút để tới trước khi tụt xuống bậc `offline` lúc `T+15'`
(rule mục 11). Gọi sớm còn cứu được ưu tiên; gọi ở T+15' chỉ còn để tránh `no_show`.

**Công tắc tắt:** biến môi trường `LATE_ARRIVAL_REMINDER_ENABLED` — mặc định bật, tắt được khi demo.
Áp dụng bài học từ sự cố cron `no_show` chạy trên DB dùng chung (rule mục 9).

---

## 6. WS-4 — Nhật ký thao tác lễ tân

### 6.1 Nguyên nhân gốc (đã xác minh)

- `backend/src/services/checkIn.service.js` **không ghi `NhatKyThaoTac` dòng nào**.
- Toàn hệ thống chỉ có 25 loại `hanh_dong`; lễ tân duy nhất có `PRINT_INVOICE`
  (`billing.controller.js:430`).
- Câu hỏi "ai check-in khách này", "ai thu tiền khách này" hiện **không trả lời được**.

### 6.2 Thiết kế

Dùng `NhatKyThaoTac` có sẵn (insert-only, đã có `nguoi_thuc_hien_id`, `vai_tro`, `hanh_dong`,
`loai_doi_tuong`, `doi_tuong_id`, `du_lieu_cu`, `du_lieu_moi`).

**10 `hanh_dong` mới:**

| Mã | Ghi ở đâu | `loai_doi_tuong` | `du_lieu_moi` chứa |
|---|---|---|---|
| `LT_CHECK_IN` | `checkIn.service.js` | `queue_entry` | STT, nguồn (online/tại chỗ), giờ khung |
| `LT_HUY_CHECK_IN` | `queueCancel.service.js` | `queue_entry` | lý do |
| `LT_TAO_KHACH_VANG_LAI` | `offlineIntake.service.js` | `walk_in_guest` | tên, SĐT, khung được xếp |
| `LT_XAC_NHAN_THANH_TOAN` | `offline-payment.controller.js` | `payment` | số tiền, hình thức |
| `LT_LAP_HOA_DON` | `billing.controller.js` | `invoice` | tổng tiền, các khoản |
| `LT_IN_PHIEU_STT` | `checkInNumber.service.js` | `queue_entry` | STT |
| `LT_DOI_LICH` | `appointmentReschedule.service.js` | `appointment` | khung cũ → khung mới, `ly_do_doi` |
| `LT_HUY_LICH` | `receptionist/appointment.controller.js` | `appointment` | lý do |
| `LT_GOI_KHACH` | `contactTasks.service.js` (đã có `CUSTOMER_CONTACTED`) | `appointment` | ghi chú cuộc gọi |
| `LT_XU_LY_THONG_BAO_BS` | `notification` service (WS-3) | `notification` | mã thông báo, kết quả xử lý |

**Nguyên tắc:** ghi **bên trong service**, không trong controller. Lý do: `checkIn.service.js` được
gọi từ cả `doctor/queue.controller.js` lẫn `receptionist/appointment.controller.js` — ghi ở service
thì mọi đường vào đều được ghi, đúng nguyên tắc rule mục 7.

### 6.3 Hai chỗ đọc

**A. Trang mới "Nhật ký ca trực"** — `/receptionist/activity-log`
- Lọc: theo ngày (mặc định hôm nay) · theo người thực hiện · theo nhóm hành động
- Cột: giờ · người thực hiện · hành động · khách hàng liên quan · chi tiết
- Mục đích: người trực thay biết việc đang dở tới đâu khi đồng nghiệp nghỉ (yêu cầu người dùng)

**B. Tab "Lịch sử" trong panel chi tiết khách** (thuộc WS-5)
- Mọi thao tác lên đúng khách đó, ai làm, lúc nào
- Trả lời "ai check-in khách này", "ai đã thu tiền"

**Mở rộng** `backend/src/services/receptionistTimeline.service.js` — thêm nhóm hành động mới vào
`LICH_HEN_WHITELIST_HANH_DONG` và whitelist trường an toàn. Cơ chế whitelist đã có sẵn, chỉ bổ sung
danh sách.

**API:**
- `GET /api/receptionist/activity-log?ngay=&nguoi_id=&nhom=` — nhật ký ca trực
- `GET /api/receptionist/timeline/:appointmentId` — đã có, mở rộng nguồn dữ liệu

---

## 7. WS-5 — Thiết kế lại Quầy tiếp nhận

### 7.1 Nguyên nhân gốc (đã đo)

`frontend/src/pages/receptionist/Appointments.tsx`:
- **1340 dòng**, ~25 `useState`
- **8 modal**: đổi lịch · khách đến muộn · hết lượt đổi lịch · hủy hàng loạt · đổi lịch hàng loạt ·
  chi tiết · timeline · xác minh check-in — cộng thêm in phiếu STT
- **4 tab** thời gian: hôm nay / ngày mai / sắp tới / đã qua
- **Một trang gánh 2 nghiệp vụ khác hẳn nhau**: quầy tiếp nhận (chỉ hôm nay, thao tác nhanh, áp lực
  thời gian, khách đang đứng trước mặt) và quản trị lịch hẹn (nhiều ngày, thao tác hàng loạt, làm
  lúc rảnh). Hai nghiệp vụ này khác nhau về nhịp độ, về dữ liệu, về người dùng — nhồi chung nên rối.

### 7.2 Trang mới `/receptionist/counter` — CHỈ HÔM NAY

```
┌─ ⚠ 2 khách trễ hơn 10 phút chưa đến ──────────── [Xem danh sách] ─┐
├───────────────────────────────┬───────────────────────────────────┤
│ ● Chờ check-in (5)            │  PANEL THAO TÁC                   │
│   Khách vãng lai              │  ─────────────────────────────    │
│   Đang trong hàng đợi (3)     │  Nguyễn Văn A · 08:30 · BS Minh   │
│ ───────────────────────────── │                                   │
│  08:30  Nguyễn Văn A    [Check-in] │  ① Xác minh danh tính        │
│  09:00  Trần Thị B  ⚠   [Check-in] │     tên · SĐT · ngày sinh    │
│  09:00  Lê Văn C        [Check-in] │  ② Thanh toán: ✓ Đã trả online│
│  09:30  Phạm Thị D      [Check-in] │  ③ [In phiếu STT]            │
│                               │                                   │
│                               │  ── Lịch sử khách này ──          │
│                               │  09:12 Lễ tân Hoa · check-in      │
└───────────────────────────────┴───────────────────────────────────┘
```

**Tab 1 — Chờ check-in** (mặc định): khách online đã đặt hôm nay, chưa vào hàng đợi. Sort theo khung
giờ. Badge đỏ khi quá `T+10'`.

**Tab 2 — Khách vãng lai**: form ngắn tạo lượt tại quầy. Tái dùng `walkInWindow.service.js` (đã chặn
đúng: chỉ hôm nay, chỉ slot `walk_in`, chỉ khung đang diễn ra + kế tiếp cùng ca).

**Tab 3 — Đang trong hàng đợi**: read-only theo dõi — ai đang khám, ai chờ, ai trễ. Không có nút
hành động (thao tác hàng đợi thuộc bác sĩ).

### 7.3 Ba quy tắc chống rối

1. **Mỗi dòng đúng 1 nút hành động chính.** Thao tác phụ giấu trong menu `…`.
2. **Không modal lồng modal.** Check-in là 1 luồng liền mạch 3 bước trong panel bên phải, không phải
   3 modal bật ra chồng nhau.
3. **Đổi lịch / hủy / thao tác hàng loạt không thuộc quầy** — chuyển hết sang trang Lịch hẹn.

### 7.4 Cắt gọn `Appointments.tsx`

Bỏ khỏi trang này: check-in, xác minh check-in, in phiếu STT, xử lý khách đến muộn.
Giữ lại: 4 tab thời gian, lọc, đổi lịch, hủy, thao tác hàng loạt, xem chi tiết.
Tách `useAppointments` hook + component con. **Mục tiêu ≤ 500 dòng.**

### 7.5 Điều hướng sidebar lễ tân sau nâng cấp

```
├ Tổng quan
├ Quầy tiếp nhận      ← MỚI (hôm nay)
├ Lịch hẹn            ← cắt gọn, quản trị nhiều ngày
├ Thanh toán
├ Cần liên hệ         ← đã có, nay nhận thêm việc trễ 10'
├ Lịch bác sĩ trong ngày
├ Nhật ký ca trực     ← MỚI
└ Tin tức
```

---

## 8. Phụ thuộc và thứ tự thi công

```
WS-4 (nhật ký)          ─┬─→ WS-5 (tab lịch sử khách trong panel)
                         │
WS-1 (khám 4 bước)      ─┼─→ WS-2 (cần dữ liệu hồ sơ đầy đủ)
                         └─→ WS-3 (cần sự kiện hoàn tất ca để bắn thu tiền DV)
                                    │
                                    └─→ WS-5 (hàng cảnh báo trễ 10')
```

**Thứ tự:** WS-4 → WS-1 → WS-2 → WS-3 → WS-5.

Lý do đặt WS-4 đầu: rủi ro thấp nhất (chỉ thêm dòng ghi log, không đổi hành vi), nhưng là nền tảng
cho WS-5, và cho phép quan sát hệ thống trong lúc làm các workstream sau.

---

## 9. Kiểm thử

| WS | Cách kiểm chứng |
|---|---|
| WS-1 | Script e2e: check-in → vào phòng → đi hết 4 bước → hoàn tất → xác nhận `KetQuaKham` đủ 4 phần, `HangDoi='hoan_thanh'`, `LichHen='completed'`, response có BN kế tiếp. Thêm ca bỏ qua bước 3+4. Thêm ca đóng tab giữa chừng rồi mở lại đúng bước |
| WS-2 | Bác sĩ A không đọc được hồ sơ của bác sĩ B (403). Danh sách hiện ngay khi mở trang |
| WS-3 | 4 loại thông báo tới được nhóm lễ tân; 2 lễ tân đọc độc lập (`da_doc_boi`); cron trễ 10' idempotent — chạy 3 lần chỉ sinh 1 việc |
| WS-4 | Check-in từ đường bác sĩ và từ đường lễ tân đều sinh `LT_CHECK_IN`; nhật ký lọc đúng theo người + ngày |
| WS-5 | Đếm dòng `Appointments.tsx` ≤ 500; trang quầy không có modal lồng modal; luồng check-in 3 bước hoàn tất không rời panel |

---

## 10. Rủi ro đã biết

| Rủi ro | Mức | Xử lý |
|---|---|---|
| Dịch vụ làm trong phòng khóa hàng đợi lâu | Trung bình | Đã chấp nhận (Q1). Giảm nhẹ bằng thông báo `BS_CA_KEO_DAI` để lễ tân trấn an khách |
| Cron nhắc trễ 10' chạy trên DB dùng chung khi demo | Cao | Công tắc `LATE_ARRIVAL_REMINDER_ENABLED`. Bài học từ sự cố cron `no_show` (rule mục 9) |
| `ExamResultModal` cũ và luồng mới cùng ghi `KetQuaKham` | Trung bình | Cả hai đi qua `examSession.service.js`, không có đường ghi thứ hai |
| Cắt `Appointments.tsx` làm hỏng luồng đang chạy | Trung bình | Làm WS-5 cuối cùng, sau khi trang quầy mới đã chạy được |
| Trạng thái `cho_dich_vu` bị bỏ không | Thấp | Giữ nguyên trong enum, `billing.controller` vẫn chấp nhận — không xóa để tránh phá dữ liệu cũ |

---

## 11. Ngoài phạm vi

- Bậc ưu tiên `khan_cap` trong hàng đợi (chưa có cơ chế đánh dấu — đã ghi ở rule mục 9)
- Phân ca cứng giữa 2 lễ tân (quyết định Q4: không làm)
- Trạng thái `cho_dich_vu` cho luồng bệnh nhân rời phòng làm dịch vụ (quyết định Q1: không làm)
- Thay đổi bất kỳ điều khoản nào của `.claude/rules/lich-lam-viec-bac-si.md`
