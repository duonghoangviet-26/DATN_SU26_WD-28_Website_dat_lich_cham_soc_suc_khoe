# Kế hoạch task chi tiết FE · BE · DB cho các chức năng còn thiếu — actor Lễ tân

Ngày lập: **2026-08-02** · Nhánh: `Bac_si`

Tài liệu này bóc từng chức năng còn thiếu thành **task độc lập**, mỗi task ghi rõ phải chạm
vào DB / Backend / Frontend chỗ nào, ràng buộc gì, xung đột với luồng nào, và kiểm thử ra sao.

Viết theo đúng workflow 6 bước mục 2 trong kế hoạch của thầy — mỗi task đều chốt đủ contract
trước khi code.

## Tóm tắt tác động tầng DB

Đây là câu hỏi quan trọng nhất, trả lời trước:

| Task | Đổi schema? | Chi tiết |
|---|---|---|
| E-1 Timeline hợp nhất | **Không** | Chỉ đọc; index `{loai_doi_tuong, doi_tuong_id}` đã có |
| E-2 UI sửa hồ sơ | **Không** | API đã xong |
| E-3 Cần gọi thủ công | ⚠️ **Có — cần thiết kế** | `NhatKyThaoTac` là immutable, không update được để đánh dấu "đã gọi" |
| E-4 Chuyển lượt chờ | **Không** | `HangDoi` đã có `doctor_id`, `phong_kham`, `specialty_id` |
| E-5 Lịch bác sĩ trong ngày | **Không** | Chỉ đọc |
| E-6 Điều phối lô | **Không** | `LichSuLichHen.loai_thay_doi` là String tự do |
| E-7 In phiếu STT | **Không** | Thuần frontend |
| E-8 Dữ liệu phân biệt hồ sơ | **Không** | Backend đã trả sẵn |
| E-9 Tạo hồ sơ walk-in | **Không** | Thuần frontend |
| E-10 Khám lần thứ N | **Không** | Đếm runtime; cân nhắc index |
| E-11 Đóng lượt bỏ về | **Không** | `HangDoi.trang_thai` đã có `cancelled` |
| E-12 Gỡ `nurse` | ⚠️ **Có — đổi enum** | Cần kiểm dữ liệu cũ trước khi gỡ |

**Chỉ 2/12 task chạm DB**, và cả hai đều nhỏ. Không có task nào cần tạo collection mới.
Đây là tin tốt: rủi ro phá dữ liệu thấp.

---

# NHÓM 1 — Gói đang triển khai

## E-2 · UI sửa thông tin hành chính hồ sơ + lịch sử

**Giải quyết:** tình huống 31 · **Ưu tiên** 🔴 · **Phụ thuộc:** không

### DB
Không đổi.

### Backend
Không đổi. Hai API đã xong từ commit `1761448`:
```
PATCH /api/receptionist/patient-intake/profiles/:id
GET   /api/receptionist/patient-intake/profiles/:id/audit
```

### Frontend

| File | Việc |
|---|---|
| `services/receptionist-patient-intake.service.ts` | Thêm `updateProfileAdministrative()`, `getProfileAuditLogs()`, type `ProfileAuditLog` |
| `components/receptionist/ProfileAdminEditModal.tsx` | **Mới** — 9 trường + ô lý do + bảng preview trước/sau |
| `components/receptionist/ProfileAuditPanel.tsx` | **Mới** — modal lịch sử |
| `pages/receptionist/PatientIntake.tsx` | Thêm 2 nút vào khối hồ sơ đã chọn (`:449-456`) |

### Ràng buộc bắt buộc
- **Chỉ gửi trường thực sự đổi** + lý do. Backend dùng `hasOwnProperty`; gửi thừa trường lạ → **403**
- Bảng audit **phải bỏ qua khoá `changed_fields`** khi render diff — backend nhét nó chung vào `du_lieu_cu`/`du_lieu_moi`
- `ngay_sinh`: chuyển đổi ISO ↔ `YYYY-MM-DD` cả hai chiều
- **400 "không có gì thay đổi"** hiển thị trung tính, không phải lỗi đỏ

### Xung đột cần kiểm
| Với | Rủi ro | Cách tránh |
|---|---|---|
| Bệnh án cũ | Sửa hồ sơ làm lệch dữ liệu đã dùng lúc khám | Backend đã bảo đảm không sửa snapshot; FE ghi rõ cho lễ tân biết |
| Tra cứu SĐT | Đổi `so_dien_thoai` làm hồ sơ biến mất khỏi kết quả cũ | Sau khi lưu phải `searchByPhone` lại bằng **số mới** |
| E-1 | Panel audit này sẽ bị E-1 thay thế | Tách component riêng để E-1 chỉ đổi nguồn dữ liệu |

### Kiểm thử
1. Sửa 1 trường có lý do → 200, audit hiện đúng trước/sau
2. Submit không đổi gì → thông báo trung tính, không phải lỗi
3. Submit không lý do → 400
4. Đổi SĐT → danh sách refresh theo số mới
5. Hồ sơ `archived` → 404

---

## E-8 · Bổ sung dữ liệu phân biệt hồ sơ trùng SĐT

**Giải quyết:** tình huống 7 · **Ưu tiên** 🟠 · **Phụ thuộc:** không

### DB · Backend
Không đổi. `searchPatientProfiles` **đã trả sẵn** `quan_he`, `nhom_gia_dinh`,
`so_dien_thoai`, `nguoi_lien_he`, `loai_lien_ket_tai_khoan`.

### Frontend
`pages/receptionist/PatientIntake.tsx:430-446` — card hồ sơ bổ sung:
- SĐT **của chính hồ sơ** (khác số tra cứu là manh mối quan trọng)
- `quan_he` + `nhom_gia_dinh`
- Tuổi tính từ `ngay_sinh`
- Nhãn giới tính tiếng Việt thay vì in raw `nam`/`nu`

### Xung đột cần kiểm
`e2e/receptionist-patient-intake.spec.ts` dùng `page.getByText(profileA.ho_ten, { exact: true })`.
Giữ họ tên là một text node độc lập, đừng gộp vào chuỗi lớn.

---

## E-9 · Tạo hồ sơ walk-in trên SĐT đã có tài khoản

**Giải quyết:** tình huống 11 · **Ưu tiên** 🟠 · **Phụ thuộc:** không

### DB · Backend
Không đổi. `createPatientProfile` đã cho `tai_khoan_id` là **optional**; giới hạn nằm ở FE.

### Frontend
`pages/receptionist/PatientIntake.tsx`:
- Thêm lựa chọn **"Không liên kết tài khoản online (khách dùng nhờ số)"**
- Bỏ điều kiện disable cứng `accounts.length > 0 && !selectedAccountId` (`:585`)
- `createProfileAndCheckIn:247` — **bỏ fallback `|| accounts[0]`**, không đoán tài khoản

### Xung đột cần kiểm
| Với | Rủi ro | Cách tránh |
|---|---|---|
| e2e | `forms.nth(1).locator('input').nth(0)` = ô Họ tên | Checkbox mới đặt **sau** ô Họ tên trong thứ tự DOM |
| Backend 409 | `createPatientProfile` trả 409 nếu SĐT của tài khoản không khớp | Khi chọn "không liên kết" thì **không gửi** `tai_khoan_id` |

### Kiểm thử
1. SĐT có 1 tài khoản, chọn "không liên kết" → tạo được hồ sơ rời
2. SĐT có 2 tài khoản, không chọn gì → nút vẫn tạo được nếu tick "không liên kết"
3. Trùng hoàn toàn tên + ngày sinh + SĐT → 409

---

# NHÓM 2 — Truy vết

## E-1 · Timeline hợp nhất + "Ai sửa gần nhất"

**Giải quyết:** tình huống 32, 33 · **Ưu tiên** 🔴 · **Phụ thuộc:** E-2

### Vấn đề gốc
Lễ tân và admin ghi audit vào **hai đối tượng khác nhau** nên không thấy nhau:

| Ai | `loai_doi_tuong` | `doi_tuong_id` |
|---|---|---|
| Lễ tân | `patient_profile` | `HoSoBenhNhan._id` |
| Admin | `patient` / `user` | `NguoiDung._id` |

### DB
**Không đổi schema.** Index `{loai_doi_tuong: 1, doi_tuong_id: 1}` đã có sẵn trong
`NhatKyThaoTac`, đủ cho truy vấn này.

⚠️ Điểm kỹ thuật: **không thể chỉ bỏ điều kiện lọc** vì hai bên dùng hai `doi_tuong_id`
khác nhau. Phải nối qua `HoSoBenhNhan.tai_khoan_id` → `NguoiDung._id`, và một hồ sơ có thể
có `nguoi_giam_ho_id` nữa.

### Backend

**File mới:** `services/receptionistTimeline.service.js`

```
GET /api/receptionist/timeline?loai=ho_so&id=<HoSoBenhNhan._id>
GET /api/receptionist/timeline?loai=lich_hen&id=<LichHen._id>
```

Logic `loai=ho_so`:
1. Đọc `HoSoBenhNhan` → lấy `tai_khoan_id`, `nguoi_giam_ho_id`
2. Gom `NhatKyThaoTac` với `$or`:
   - `{loai_doi_tuong: 'patient_profile', doi_tuong_id: profile._id}`
   - `{loai_doi_tuong: {$in: ['patient','user']}, doi_tuong_id: {$in: [tai_khoan_id, nguoi_giam_ho_id]}}`
3. Sort `ngay_tao: -1`, populate `nguoi_thuc_hien_id`
4. Chuẩn hoá về một dạng dòng thống nhất

Logic `loai=lich_hen`: gộp `LichSuLichHen` (theo `appointment_id`) + `NhatKyThaoTac`
(`loai_doi_tuong: 'appointment'|'lich_hen'`), trộn rồi sort theo thời gian.

**Response chuẩn hoá — mỗi dòng:**
```json
{
  "nguon": "nhat_ky | lich_su_lich_hen",
  "thoi_diem": "...",
  "nguoi": { "ho_ten": "...", "vai_tro": "admin" },
  "hanh_dong": "UPDATE_PATIENT",
  "nhan": "Admin sửa thông tin bệnh nhân",
  "ly_do": "...",
  "thay_doi": [{ "truong": "so_dien_thoai", "cu": "090...", "moi": "091..." }]
}
```

**Thêm `sua_gan_nhat`** vào response của `searchPatientProfiles` và danh sách lịch hẹn —
chính là dòng đầu tiên của timeline, để lễ tân thấy ngay mà không cần mở modal.

⚠️ Cân nhắc hiệu năng: nếu `sua_gan_nhat` gọi cho **từng** hồ sơ trong danh sách sẽ thành
N+1 query. Dùng một truy vấn gom theo `$in` tất cả id rồi map lại.

### Frontend

| File | Việc |
|---|---|
| `services/receptionist-timeline.service.ts` | **Mới** |
| `components/receptionist/TimelinePanel.tsx` | **Mới** — thay `ProfileAuditPanel` của E-2 |
| `pages/receptionist/PatientIntake.tsx` | Dòng "Sửa gần nhất: ..." trên đầu hồ sơ |
| `pages/receptionist/Appointments.tsx` | Thêm mục timeline vào modal chi tiết lịch hẹn |

### Bảng nhãn tiếng Việt cần bổ sung
23 hành động hiện có đều là mã tiếng Anh. Cần một map `hanh_dong → nhãn tiếng Việt` đặt ở
`utils/constants.ts` để cả admin lẫn lễ tân dùng chung.

### Xung đột cần kiểm
| Với | Rủi ro | Cách tránh |
|---|---|---|
| Quyền xem | Lễ tân thấy audit admin xoá tài khoản, đổi giá dịch vụ | **Whitelist** hành động lễ tân được xem, không trả tất |
| Dữ liệu nhạy cảm | `du_lieu_cu`/`du_lieu_moi` là Mixed, có thể chứa trường không nên hiện | Lọc theo whitelist trường trước khi trả |
| E-2 | Trùng chức năng | E-1 thay panel của E-2, không chạy song song hai màn lịch sử |

### Kiểm thử
1. Admin sửa SĐT → lễ tân mở timeline **thấy dòng của admin**
2. Lễ tân sửa tiếp → timeline có 2 dòng đúng thứ tự
3. `sua_gan_nhat` trả đúng dòng mới nhất bất kể ai làm
4. Hồ sơ chưa ai sửa → `sua_gan_nhat = null`, không lỗi
5. Danh sách 20 hồ sơ → **không quá 2 query** cho `sua_gan_nhat`
6. Hành động ngoài whitelist không lọt sang lễ tân

---

## E-12 · Gỡ `'nurse'` khỏi enum

**Giải quyết:** dọn dẹp · **Ưu tiên** 🟡 · **Phụ thuộc:** không

### DB
⚠️ **Đổi enum** `NhatKyThaoTac.vai_tro`: bỏ `'nurse'`.

**Bắt buộc kiểm tra trước:**
```js
db.nhat_ky_thao_tac.countDocuments({ vai_tro: 'nurse' })
```
- Nếu **= 0** → gỡ thẳng, không cần migration
- Nếu **> 0** → viết script đổi sang `'receptionist'` kèm ghi chú, hoặc giữ enum và chỉ ghi
  chú deprecated. **Không xoá bản ghi audit** (immutable log)

### Backend
- `models/NhatKyThaoTac.js` — bỏ `'nurse'` khỏi enum
- `.claude/rules/lich-lam-viec-bac-si.md` mục 7 — sửa dòng 72
- `CLAUDE.md` — sửa "3 vai trò" → 4 vai trò

### Frontend
Không đổi.

---

# NHÓM 3 — Điều phối

## E-4 · Chuyển lượt đang chờ sang bác sĩ khác

**Giải quyết:** tình huống 26 · **Ưu tiên** 🔴 · **Phụ thuộc:** E-5

### Phân biệt bắt buộc

| | Dời `LichHen` (đã có) | Chuyển `HangDoi` (task này) |
|---|---|---|
| Đối tượng | Khách **chưa đến** | Khách **đang ngồi chờ** |
| Đổi gì | Ngày, giờ, bác sĩ, slot | Bác sĩ khám cho lượt hiện tại |
| Slot `LichLamViec` | Trả slot cũ, chiếm slot mới | **Không đụng** |
| Số thứ tự | Không liên quan | **Giữ nguyên** |

### DB
**Không đổi schema.** `HangDoi` đã có đủ: `doctor_id`, `phong_kham`, `specialty_id`,
`trang_thai`. Index `{doctor_id, trang_thai}` đã có.

Thêm **một giá trị `hanh_dong` mới** cho audit: `CHUYEN_HANG_DOI`. `hanh_dong` là String
tự do (`maxlength: 100`) nên **không cần đổi schema**.

### Backend

**File mới:** `services/queueTransfer.service.js`
**Endpoint:** `PATCH /api/receptionist/queue/:id/transfer`

Payload: `{ doctor_id_moi, ly_do }`

Ràng buộc — **kiểm tất cả trong transaction**:

| # | Ràng buộc | Lỗi |
|---|---|---|
| 1 | Lượt phải ở `dang_cho` | 409 nếu `trong_phong`/`hoan_thanh`/`cancelled` |
| 2 | Bác sĩ đích **cùng `specialty_id`** | 409 |
| 3 | Bác sĩ đích đang có `LichLamViec` hôm nay, ca hiện tại | 409 |
| 4 | Bác sĩ đích không nghỉ phép | 409 |
| 5 | **Giữ nguyên `ma_so_thu_tu` và `so_thu_tu_checkin`** | — |
| 6 | Cập nhật `phong_kham` theo phòng của bác sĩ mới | — |
| 7 | Bắt buộc `ly_do` | 400 |

Ghi:
- `NhatKyThaoTac`: `CHUYEN_HANG_DOI`, `loai_doi_tuong: 'queue_entry'`, `du_lieu_cu`/`du_lieu_moi`
  chứa `doctor_id` + `phong_kham` cũ/mới
- Nếu lượt có `appointment_id`: ghi thêm `LichSuLichHen` với `loai_thay_doi='queue_transfer'`
- Thông báo khách qua `notifyAppointmentCustomerChange` (đổi bác sĩ, đổi phòng)
- Emit realtime cho **cả hai** dashboard bác sĩ

### Frontend
- `services/receptionist-queue.service.ts` — **mới**
- `components/receptionist/QueueTransferModal.tsx` — **mới**: chọn bác sĩ đích (chỉ hiện
  bác sĩ hợp lệ kèm số người đang chờ), ô lý do, cảnh báo "số thứ tự giữ nguyên"
- Nút "Chuyển bác sĩ" trên từng lượt trong khối hàng đợi ở `Dashboard.tsx`

### Xung đột cần kiểm
| Với | Rủi ro | Cách tránh |
|---|---|---|
| Dashboard bác sĩ | Bác sĩ đang mở hàng đợi, lượt biến mất giữa chừng | Emit realtime sau commit; bác sĩ cũ thấy thông báo |
| Bác sĩ vừa gọi bệnh nhân | Chuyển đúng lúc bác sĩ bấm "Gọi" | Kiểm `trang_thai='dang_cho'` **trong transaction**, không tin FE |
| Thứ tự hàng đợi | Người được chuyển chen ngang hàng đợi mới | Thứ tự tính động theo `checkin_time` — **giữ nguyên `checkin_time`**, không reset |
| Quá tải bác sĩ đích | Chuyển từ chỗ tắc sang chỗ sắp tắc | Modal hiện số người đang chờ + độ trễ của từng bác sĩ |

### Kiểm thử
1. Chuyển lượt `dang_cho` → thành công, `ma_so_thu_tu` **không đổi**
2. Chuyển lượt `trong_phong` → 409
3. Chuyển sang bác sĩ khác chuyên khoa → 409
4. Chuyển sang bác sĩ không có lịch hôm nay → 409
5. Hai lễ tân cùng chuyển một lượt → chỉ một thành công
6. Sau chuyển: `checkin_time` giữ nguyên, vị trí trong hàng đợi mới đúng theo thời điểm check-in
7. Audit có `doctor_id` cũ/mới + lý do

---

## E-5 · Màn "Lịch bác sĩ trong ngày"

**Giải quyết:** tình huống 25 · **Ưu tiên** 🟠 · **Phụ thuộc:** không

### DB
Không đổi.

### Backend
API đã có đủ, **có thể không cần thêm gì**:
- `GET /receptionist/booking/doctors/:id/slots?date=` — slot từng bác sĩ
- `GET /receptionist/appointments/doctor-statuses` — trạng thái vận hành + độ trễ

Nếu gọi từng bác sĩ sẽ thành N request. Cân nhắc thêm **một endpoint gom**:
`GET /receptionist/booking/day-overview?date=` trả ma trận bác sĩ × khung giờ.

### Frontend
`pages/receptionist/DoctorDayView.tsx` — **mới**, thêm mục sidebar "Lịch bác sĩ".

Bảng ngang: dòng = bác sĩ, cột = khung giờ 30′, ô = số slot còn trống.
- **Tách rõ ca sáng / ca chiều** bằng vạch ngăn — để thấy ngay "sáng BS A tắc, chiều BS B còn 6 chỗ"
- Tô màu theo độ trễ của bác sĩ
- Bấm vào ô → mở dời lịch với bác sĩ + khung đã chọn sẵn

### Kiểm thử
1. Bác sĩ không có lịch hôm nay → hiện "không có lịch", **không phải** "hết chỗ"
2. Bác sĩ nghỉ phép → ô bị khoá hiện đúng
3. Ca sáng và chiều tách rõ, nghỉ trưa 11:30–13:30 không hiện khung

---

## E-6 · Điều phối ca quá tải theo lô

**Giải quyết:** tình huống 27 · **Ưu tiên** 🟠 · **Phụ thuộc:** E-5

### DB
Không đổi. `LichSuLichHen.loai_thay_doi` là String tự do → thêm giá trị
`'overload_reschedule'` không cần migration.

### Backend
Tái dùng `bulkRescheduleAppointments` đã có. Chỉ thêm **endpoint lấy đầu vào**:

```
GET /api/receptionist/appointments/overload-affected?doctor_id=&date=
```

Trả các lịch **chưa check-in** còn lại của ca đang trễ, kèm mức độ ảnh hưởng
(thời gian chờ ước tính). Nguồn dữ liệu: `doctor-statuses` đã tính sẵn
`lich_chua_checkin_bi_anh_huong`.

### Frontend
Mở rộng chế độ bulk sẵn có trong `Appointments.tsx`: thêm nút "Điều phối ca quá tải" từ
cảnh báo trên Dashboard, chọn nhiều lịch → một lý do chung → một loạt thông báo.

### Xung đột cần kiểm
| Với | Rủi ro | Cách tránh |
|---|---|---|
| Cam kết đặt lịch | Dời hàng loạt làm khách mất niềm tin | **Chỉ dời lịch chưa check-in**; khách đã đến thì dùng E-4 |
| Thông báo | Bùng nổ thông báo | Một sự kiện một thông báo, có idempotency key |
| Hạn mức dời của khách | Lần dời này ăn mất quyền của khách | Bắt buộc `ly_do_doi='phong_kham'` → **không tính hạn mức** |

---

# NHÓM 4 — Khép kín vận hành

## E-3 · Màn "Cần gọi thủ công" + đánh dấu đã gọi

**Giải quyết:** tình huống 36 · **Ưu tiên** 🔴 · **Phụ thuộc:** không

### ⚠️ Vấn đề thiết kế DB — task duy nhất cần quyết định

`NhatKyThaoTac` được thiết kế **chỉ INSERT, không update, không delete** (ghi rõ trong
comment đầu model). Nhưng "đánh dấu đã gọi" về bản chất là **cập nhật trạng thái** của một
bản ghi đã có.

Ba phương án:

| PA | Cách làm | Ưu | Nhược |
|---|---|---|---|
| **A** *(khuyến nghị)* | Insert bản ghi mới `CUSTOMER_CONTACTED` trỏ cùng `doi_tuong_id`. "Chưa gọi" = có `CUSTOMER_CONTACT_REQUIRED` mà **chưa có** `CUSTOMER_CONTACTED` sau đó | Giữ nguyên tính immutable; không đổi schema | Truy vấn phức tạp hơn (cần `$lookup` hoặc 2 bước) |
| **B** | Thêm field `da_xu_ly` vào `NhatKyThaoTac` | Truy vấn đơn giản | **Phá nguyên tắc immutable** của audit log |
| **C** | Tạo collection `ViecCanLienHe` riêng | Sạch về mặt mô hình | Thêm bảng mới — trái nguyên tắc "chỉ thêm khi không suy ra được" |

**Chọn phương án A.** Vừa giữ được audit bất biến, vừa không cần bảng mới, và bản thân việc
"ai đã gọi lúc nào" cũng là một sự kiện đáng lưu vào audit.

### DB
Không đổi schema. Cân nhắc thêm index phụ:
```js
{ hanh_dong: 1, ngay_tao: -1 }   // đã có index đơn trên hanh_dong; index ghép giúp lọc danh sách
```

### Backend

```
GET   /api/receptionist/contact-tasks?trang_thai=chua_goi|da_goi&tu_ngay=&den_ngay=
PATCH /api/receptionist/contact-tasks/:auditId/done    body: { ghi_chu }
```

`GET` — pipeline:
1. `match` các bản ghi `CUSTOMER_CONTACT_REQUIRED`
2. `lookup` các bản ghi `CUSTOMER_CONTACTED` cùng `doi_tuong_id` có `ngay_tao` lớn hơn
3. `chua_goi` = mảng lookup rỗng
4. Join `LichHen` để lấy tên khách, SĐT, giờ hẹn cũ/mới, bác sĩ

`PATCH` — insert `CUSTOMER_CONTACTED` với `nguoi_thuc_hien_id` = lễ tân đang đăng nhập,
`ly_do` = ghi chú cuộc gọi.

`du_lieu_moi` của bản ghi gốc đã chứa `title`, `content`, `delivery_status` — dùng luôn để
hiện nội dung cần báo cho khách, lễ tân không phải tự nghĩ lời.

### Frontend
- `pages/receptionist/ContactTasks.tsx` — **mới**, thêm mục sidebar "Cần gọi khách" kèm
  **badge số lượng chưa gọi**
- Mỗi dòng: tên khách · SĐT · sự kiện · lịch cũ → mới · nút "Đã gọi" mở ô ghi chú
- Hiện badge cảnh báo trên Dashboard nếu còn việc chưa gọi

### Xung đột cần kiểm
| Với | Rủi ro | Cách tránh |
|---|---|---|
| Hiệu năng | Bảng audit lớn dần, `$lookup` chậm | Mặc định chỉ lấy **7 ngày gần nhất**; có index trên `hanh_dong` |
| Hai lễ tân | Cùng gọi một khách | Hiện tên người đã nhận việc; chấp nhận trùng vì insert-only, hiển thị cả hai |
| Khách có tài khoản | Lọt vào danh sách gọi tay dù đã nhận in-app | Backend chỉ ghi `CUSTOMER_CONTACT_REQUIRED` khi **không có** `user_id` — đã đúng |

### Kiểm thử
1. Dời lịch khách không có tài khoản → xuất hiện trong danh sách chưa gọi
2. Dời lịch khách **có** tài khoản → **không** xuất hiện
3. Bấm "Đã gọi" → chuyển sang tab đã gọi, ghi đúng người + thời điểm
4. Bản ghi gốc **không bị sửa** (kiểm bằng `ngay_tao` và nội dung không đổi)
5. Badge đếm đúng số việc chưa gọi

---

## E-7 · In phiếu số thứ tự thật

**Giải quyết:** tình huống 30 · **Ưu tiên** 🟠 · **Phụ thuộc:** không

### DB · Backend
Không đổi. `ma_so_thu_tu` đã có trong response check-in.

### Frontend
`QueueTicketTemplate.tsx` đã viết đúng và đầy đủ — chỉ chưa ai gọi.

| File | Việc |
|---|---|
| `pages/receptionist/Appointments.tsx` | Gọi `setPrintData({...})` sau check-in thành công rồi `window.print()`; **bỏ `alert` giả** ở `:364` |
| `pages/receptionist/PatientIntake.tsx` | Import `QueueTicketTemplate`, làm tương tự; bỏ `alert` giả ở `:232` và `:307` |

Cần một nút **"In lại phiếu"** cho trường hợp máy in kẹt — không phải check-in lại.

### Xung đột cần kiểm
`window.print()` là hàm **đồng bộ chặn UI**. Phải gọi **sau** khi state đã render xong
(dùng `useEffect` theo dõi `printData`), nếu không sẽ in ra phiếu trống.

### Kiểm thử
1. Check-in → hộp thoại in mở ra với đúng số thứ tự, tên, bác sĩ, phòng
2. Huỷ hộp thoại in → lượt check-in **vẫn giữ**, không rollback
3. Nút in lại → in đúng phiếu cũ, không sinh số mới

---

## E-10 · Đánh dấu "khám lần thứ N"

**Ưu tiên** 🟡 · **Phụ thuộc:** không

### DB
Không đổi schema. Đếm runtime từ `LichHen` (`status='completed'`) và `HangDoi`
(`trang_thai='hoan_thanh'`) theo `ho_so_benh_nhan_id`.

Nếu chậm, thêm index `{ho_so_benh_nhan_id: 1, status: 1}` trên `LichHen`.

### Backend
Thêm vào `serializeProfile` của `searchPatientProfiles`:
```json
"lich_su_kham": { "so_lan": 3, "lan_gan_nhat": "2026-06-14", "bac_si_gan_nhat": "BS Nguyễn Văn A" }
```
Dùng **một** truy vấn gom theo `$in` tất cả `profileIds`, không lặp từng hồ sơ.

### Frontend
Nhãn trên card hồ sơ: *"Khách cũ · đã khám 3 lần · gần nhất 14/06 với BS A"*.

Giá trị phụ: `bac_si_gan_nhat` giúp giữ mạch tái khám khi chọn bác sĩ (đúng thứ tự ưu tiên
tự gán ở rule mục 12).

---

## E-11 · Đóng lượt khi khách bỏ về

**Giải quyết:** tình huống 29 · **Ưu tiên** 🟡 · **Phụ thuộc:** không

### DB
Không đổi. `HangDoi.trang_thai` đã có `'cancelled'`.

### Backend
Bác sĩ **đã có** thao tác này (`doctor/queue.controller.js:471` đặt `trang_thai='cancelled'`),
nhưng route thuộc nhóm bác sĩ nên lễ tân không gọi được.

Thêm endpoint lễ tân dùng **chung service** với bác sĩ:
```
PATCH /api/receptionist/queue/:id/cancel   body: { ly_do }
```

Ràng buộc:
- Chỉ đóng được lượt `dang_cho` hoặc `da_goi`; `trong_phong` → 409
- Bắt buộc `ly_do`
- **Không** đặt `LichHen.status='no_show'` — khách đã đến quầy, theo rule mục 8 thì không
  bao giờ được tính `no_show`
- Ghi audit + `LichSuLichHen`

### Frontend
Nút "Đóng lượt" trên hàng đợi ở Dashboard, kèm ô lý do.

### Xung đột cần kiểm
Rất dễ sai chỗ này: đóng lượt **không đồng nghĩa** khách vắng mặt. Nếu vô tình để cron
`noShowSweep` bắt được lịch này (vì `HangDoi` đã `cancelled`) thì khách **mất 100% tiền oan**.

→ Phải kiểm `noShowSweep.service.js` xem điều kiện loại trừ có tính cả `HangDoi` trạng thái
`cancelled` không. Nếu chỉ loại trừ khi *tồn tại* bản ghi `HangDoi` thì an toàn; nếu lọc theo
trạng thái đang hoạt động thì **phải sửa**.

---

# Luồng làm việc cho từng task

Áp dụng đúng workflow 6 bước mục 2 kế hoạch của thầy. Với mỗi task, làm theo thứ tự:

```
1. Đọc code hiện tại của đúng luồng đó
2. Ghi lại hiện trạng + điểm thiếu vào doc
3. So với contract trong tài liệu này
4. Kiểm bảng "Xung đột cần kiểm" của task
5. Nếu chạm DB → kiểm dữ liệu cũ TRƯỚC, viết migration nếu cần
6. Code backend trước, có test
7. Code frontend, dùng service sẵn có
8. Chạy: backend node --test → FE typecheck → lint → test → build
9. Kiểm thử tay theo kịch bản của task
10. Commit riêng từng task, không gộp
```

## Quy tắc chống lỗi ngoài ý muốn

| Quy tắc | Lý do |
|---|---|
| **Một task một commit**, không gộp | Dễ revert khi hỏng, dễ review |
| Task chạm DB **phải kiểm dữ liệu cũ trước** | E-12 và E-3 |
| Không đổi enum khi chưa đếm dữ liệu đang dùng giá trị đó | Mongoose sẽ fail validate bản ghi cũ |
| Mọi ràng buộc kiểm **trong transaction**, không tin FE | Hai lễ tân thao tác đồng thời |
| Guard backend là nguồn quyết định, `allowed_actions` chỉ để UI đỡ gây hiểu nhầm | Rule LT-00 |
| Không đụng `HangDoi`, `NghiPhepBacSi`, `CauHinhPhongKham` schema | Rule mục 10 |
| Emit realtime **sau commit**, không trước | Tránh dashboard bác sĩ đọc dữ liệu chưa commit |
| Thông báo là một phần của giao dịch | Không trả 200 "đã dời" khi chưa tạo được bản ghi thông báo |

## Thứ tự thực thi đề xuất

| Đợt | Task | Vì sao đợt này |
|---|---|---|
| **1** | E-2 · E-8 · E-9 + fix check-in + mojibake | Thuần FE, backend đã sẵn, gỡ lỗi chặn nghiệp vụ |
| **2** | E-5 → E-4 → E-6 | E-5 là điều kiện để E-4/E-6 có chỗ đặt nút; đóng 3 tình huống ❌ dễ bị hỏi nhất |
| **3** | E-1 → E-12 | E-1 cần E-2 xong trước để thay panel; E-12 đi kèm vì cùng chạm audit |
| **4** | E-3 · E-7 · E-10 · E-11 | Khép kín vận hành, không chặn gì |

Riêng **E-11 phải kiểm `noShowSweep` trước khi làm** — đây là chỗ dễ gây mất tiền oan cho
khách nhất trong toàn bộ danh sách.

---

## Tài liệu liên quan

- `docs/Le tan/Phan tich 3 de xuat mo rong actor Le tan (2026-08-02).md` — phân tích + 38 kịch bản hội đồng
- `docs/Le tan/Danh muc chuc nang actor Le tan (2026-08-02).md` — 53 chức năng hiện có
- `docs/Le tan/2026-08-02-nang-luc-le-tan-doi-chieu-ke-hoach-thay.md` — đối chiếu LT-00→LT-12
- `docs/Le tan/Ke hoach xu ly loi actor Le tan 2026-08-02.md` — kế hoạch gốc của thầy
- `.claude/rules/lich-lam-viec-bac-si.md` — rule nghiệp vụ (bất biến)
