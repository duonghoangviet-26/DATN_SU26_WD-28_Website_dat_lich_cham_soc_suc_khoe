# VitaFamily — DB Gap Analysis (B2 · B3 · B4)

> Tài liệu này ghi lại toàn bộ sự khác biệt giữa **frontend TypeScript types + mock data**
> và **MongoDB schema thực tế** (docs/database.md).
> Mục đích: checklist khi chuyển từ mock → gắn DB thật.
>
> Cập nhật: 2026-06-22 (v2) · Scope: B2 (lịch làm việc), B3 (lịch hẹn bác sĩ), B4 (kết quả khám)
> Trạng thái legend: ✅ Đã sửa | 🔴 Nghiêm trọng — crash ngay | 🟡 Cần sửa — sai logic | 🟢 Xử lý ở BE

---

## Mục lục

1. [Nhóm 🔴 Nghiêm trọng](#nhóm--nghiêm-trọng)
2. [Nhóm 🟡 Cần sửa](#nhóm--cần-sửa)
3. [Nhóm 🟢 Xử lý ở tầng Backend](#nhóm--xử-lý-ở-backend)
4. [Nhóm 🆕 Gap mới phát hiện (phòng khám)](#nhóm--gap-mới-phát-hiện)
5. [Checklist sửa file](#checklist-sửa-file)
6. [Sơ đồ luồng ghi kết quả khám (B4)](#sơ-đồ-luồng-b4)

---

## Nhóm 🔴 Nghiêm trọng

> Những điểm này sẽ gây `undefined`, runtime crash, hoặc mất chức năng hoàn toàn ngay khi switch sang API thật.

---

### ✅ GAP-01 · `DoctorAppointmentDetail` thiếu `dia_chi_kham` — ĐÃ SỬA

**Vấn đề (đã sửa):** DB `lich_hen` có field bắt buộc khi `loai_kham='home'`:

```js
dia_chi_kham: String | null   // BẮT BUỘC khi loai_kham='home'; null khi 'clinic'
```

**Đã sửa trong:**
- `types/index.ts` → `DoctorAppointmentDetail.dia_chi_kham?: string | null`
- `mock/doctor-appointments.ts` → thêm `dia_chi_kham` cho id=6 và id=12
- `DoctorAppointments.tsx` → hiển thị trong cột "Hình thức" và expanded row

---

### ✅ GAP-02 · `DoctorSlot.benh_nhan` và `benh_nhan_id` không có trong DB — XỬ LÝ Ở BE

**Vấn đề (BE sẽ xử lý):** DB `lich_lam_viec.slots[]` không có `benh_nhan`, `benh_nhan_id`. Backend phải JOIN từ `lich_hen → thanh_vien` qua `slot_id`.

```js
// Aggregate pipeline khi GET /api/doctor/schedule
LichLamViec.aggregate([
  { $match: { doctor_id, ngay: { $gte: startDate } } },
  { $unwind: '$slots' },
  {
    $lookup: {
      from: 'lich_hens',
      localField: 'slots._id',
      foreignField: 'slot_id',
      as: 'appointment'
    }
  },
  {
    $addFields: {
      'slots.benh_nhan':    { $ifNull: [{ $arrayElemAt: ['$member.ho_ten', 0] }, null] },
      'slots.benh_nhan_id': { $ifNull: [{ $arrayElemAt: ['$appointment.member_id', 0] }, null] },
    }
  }
])
```

**Frontend type `DoctorSlot` giữ nguyên** — đây là API response shape (computed), không phải DB shape.

---

### ✅ GAP-03 · `PrescriptionDrug.lieu_dung` ≠ DB `lieu_luong` — ĐÃ SỬA

**Đã sửa trong:**
- `types/index.ts` → đổi `lieu_dung` → `lieu_luong`
- `mock/examinations.ts` → đổi tất cả field
- `DoctorAppointments.tsx` → form sửa label + field name
- `__tests__/services/examination.service.test.ts` → cập nhật DRUG constant

---

### ✅ GAP-04 · `PrescriptionDrug` thiếu `gio_uong`, `ngay_bat_dau`, `ngay_ket_thuc` — ĐÃ SỬA

**Đã sửa trong:**
- `types/index.ts` → bỏ `so_ngay`, thêm `gio_uong: string[]`, `ngay_bat_dau: string`, `ngay_ket_thuc: string`
- `mock/examinations.ts` → tất cả thuốc có đủ 3 field mới
- `DoctorAppointments.tsx` → form thay "Số ngày" bằng "Ngày bắt đầu" + "Ngày kết thúc" + "Giờ uống"
- Drug đầu tiên khi mở modal có default: `ngay_bat_dau = hôm nay`, `ngay_ket_thuc = hôm nay + 30 ngày`

---

## Nhóm 🟡 Cần sửa

> Không crash ngay nhưng sai spec hoặc dữ liệu không nhất quán với DB.

---

### ✅ GAP-05 · `loai_kham` vẫn có `'video'` — ĐÃ SỬA

**Đã sửa:**
- `types/index.ts` → `Appointment.loai_kham: 'clinic' | 'home'` (bỏ `'video'`)
- `DoctorAppointments.tsx` → `LOAI_LABEL` bỏ `video`, type `loai_kham: 'clinic' | 'home'`
- `mock/doctor-appointments.ts` → đổi 3 record từ `'video'` → `'clinic'`

---

### ✅ GAP-06 · `Appointment` (admin) còn `hospital_id` — ĐÃ SỬA

**Đã sửa:**
- `types/index.ts` → xóa `hospital_id` khỏi `Appointment` interface

---

### ✅ GAP-07 · `ExaminationResult` thiếu `ghi_chu` — ĐÃ SỬA

**Đã sửa:**
- `types/index.ts` → `ExaminationResult.ghi_chu?: string | null`
- `mock/examinations.ts` → thêm `ghi_chu` vào tất cả records
- `services/examination.service.ts` → `ExamPayload.ghi_chu?: string | null`
- `DoctorAppointments.tsx` → thêm textarea "Ghi chú bổ sung" trong ExamModal

---

### ✅ GAP-08 · `DoctorAppointmentDetail` thiếu `ten_dich_vu` — ĐÃ SỬA

**Đã sửa:**
- `types/index.ts` → `DoctorAppointmentDetail.ten_dich_vu?: string | null`
- `mock/doctor-appointments.ts` → thêm `ten_dich_vu` cho tất cả 13 records
- `DoctorAppointments.tsx` → hiển thị dưới ngày/giờ ở row chính và trong expanded row

---

## Nhóm 🟢 Xử lý ở Backend

> Frontend type đúng (đây là API response shape), nhưng backend cần làm thêm logic.

---

### 🟢 GAP-09 · `da_co_ket_qua` không có trong `lich_hen` — backend compute

Field `da_co_ket_qua: boolean` trong `DoctorAppointmentDetail` **không lưu trong DB**.

Backend tính khi query:

```js
// GET /api/doctor/appointments
const da_co_ket_qua = await KetQuaKham.exists({ appointment_id: appointment._id })
// Trả về computed field trong response JSON
```

Không cần thêm vào DB schema. Compute on-the-fly là đủ (index `{ appointment_id: 1 }` unique → O(1)).

---

### 🟢 GAP-10 · `thuoc[]` trong `ExaminationResult` — thực tế là 3 collection riêng

Hiện tại mock gộp prescriptions vào `ExaminationResult.thuoc[]`. DB thực tế tách thành 3 tầng:

```
ket_qua_kham  (examination_results)
    ↓ appointment_id
lich_hen
    ↓ member_id
ho_so_y_te  (medical_records)  ← phải tạo/upsert
    ↓ medical_record_id
don_thuoc   (prescriptions)    ← chứa items[]
    ↓ prescription_item_id
nhac_nho    (reminders)        ← cron tạo từ gio_uong[]
```

Khi bác sĩ submit form kết quả khám, API `POST /api/doctor/examination` phải:

```
1. Upsert ket_qua_kham { appointment_id, chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham }
2. Upsert ho_so_y_te   { appointment_id, member_id, nguon: 'tu_kham', ... }
3. Upsert don_thuoc    { medical_record_id, member_id, doctor_id, nguon: 'bac_si', items: [...] }
4. Delete nhac_nho cũ của don_thuoc này
5. Create nhac_nho mới theo gio_uong[] × ngay_bat_dau → ngay_ket_thuc
6. Update lich_hen.status = 'completed' (nếu chưa completed)
```

**Frontend type `ExaminationResult.thuoc[]` là API response shape — giữ nguyên.** Backend join và trả về tổng hợp.

---

### 🟢 GAP-11 · `DoctorAppointmentDetail.benh_nhan` — JOIN từ nhiều nguồn

Bệnh nhân có thể là thành viên gia đình (`member_id`) hoặc khách vãng lai (`ten_khach`):

```js
// Backend logic khi build DoctorAppointmentDetail
const benh_nhan = appointment.member_id
  ? (await ThanhVien.findById(appointment.member_id)).ho_ten
  : appointment.ten_khach

const so_dien_thoai = appointment.member_id
  ? (await NguoiDung.findById(family.user_id)).so_dien_thoai
  : appointment.so_dien_thoai_khach

const tuoi = appointment.member_id
  ? calculateAge(member.ngay_sinh)
  : (new Date().getFullYear() - appointment.nam_sinh_khach)
```

**Lưu ý:** Khách vãng lai (`member_id = null`) không có `gioi_tinh`, `di_ung`, `benh_nen` trong DB. Frontend xử lý `null/undefined` gracefully (đã implement).

---

## Nhóm 🆕 Gap mới phát hiện

> Phát hiện 2026-06-22 khi implement tính năng hiển thị phòng khám trong lịch hẹn.

---

### 🔴 GAP-12 · `bac_si.phong_kham_mac_dinh` — THIẾU trong DB

**Vấn đề:** Luồng nghiệp vụ: mỗi bác sĩ có 1 phòng khám mặc định, khi tạo slot mới phòng này tự động điền vào `slots[].phong_kham`. Nhưng `bac_si` collection **không có field `phong_kham_mac_dinh`**.

```js
// bac_si collection — HIỆN TẠI (thiếu)
{
  _id, user_id, tieu_su, bang_cap, kinh_nghiem, so_nam_kinh_nghiem,
  phi_tu_van, trang_thai_duyet, ...
  // ❌ Không có phong_kham_mac_dinh
}
```

**Cần thêm vào `bac_si` collection:**

```js
// bac_si collection — SAU KHI SỬA
{
  // ... các field hiện có ...
  phong_kham_mac_dinh: String | null,  // 🆕 "Phòng 201, Tầng 2, Tòa A"
                                        // null = chưa được gán phòng cố định
}
```

**Luồng sử dụng:**
1. Admin gán `phong_kham_mac_dinh` cho bác sĩ khi duyệt hồ sơ (C2)
2. Khi bác sĩ tạo slot mới (B2), backend tự điền `slot.phong_kham = bac_si.phong_kham_mac_dinh`
3. Bác sĩ có thể override `slot.phong_kham` riêng lẻ trong lịch làm việc (B2)
4. Khi lịch làm việc đổi phòng → lịch hẹn tương ứng cần cập nhật (xem GAP-13)

**Ảnh hưởng khi gắn DB:**
- Thêm field vào Mongoose schema `bac_si`
- API `POST /api/doctor/schedule/slots` tự lấy `phong_kham_mac_dinh` từ doctor profile

---

### 🔴 GAP-13 · `lich_hen.phong_kham` — THIẾU trong DB

**Vấn đề:** `lich_hen` collection không có field `phong_kham`. Khi lịch hẹn được tạo, số phòng từ `lich_lam_viec.slots[].phong_kham` **không được snapshot** vào `lich_hen`.

```js
// lich_hen collection — HIỆN TẠI (thiếu)
{
  _id, user_id, doctor_id, slot_id, loai_kham, ngay_kham, gio_kham,
  dia_chi_kham,  // ✅ home: địa chỉ bệnh nhân
  // ❌ clinic: không lưu phong_kham
}
```

**Phương án 1 — Snapshot (khuyến nghị):**

```js
// lich_hen collection — SAU KHI SỬA
{
  // ... các field hiện có ...
  phong_kham: String | null,  // 🆕 Snapshot từ slots[].phong_kham lúc đặt lịch
                               // null khi loai_kham='home'
}
```

Ưu điểm: Bệnh nhân nhận thông báo ngay lập tức phòng họ cần đến. Không cần JOIN khi hiển thị.

**Phương án 2 — JOIN on-the-fly:**

Không thêm field vào `lich_hen`. Backend JOIN qua `slot_id` mỗi lần GET.

```js
// GET /api/doctor/appointments
LichHen.aggregate([
  { $lookup: { from: 'lich_lam_viecs', localField: 'slot_id', ... } },
  { $addFields: { phong_kham: '$slot.phong_kham' } }
])
```

Nhược điểm: Chậm hơn, phức tạp hơn. Không lưu lịch sử nếu bác sĩ đổi phòng sau.

> **Quyết định: Dùng Phương án 1 (snapshot).** Lý do: Khi bác sĩ đổi phòng trong lịch làm việc, cần update cả `lich_hen.phong_kham` tương ứng. Snapshot + cron/hook update sẽ rõ ràng hơn JOIN.

**Cần implement khi gắn DB:**
- Thêm `phong_kham: String | null` vào Mongoose schema `lich_hen`
- `POST /api/appointments` (đặt lịch): snapshot `slot.phong_kham → lich_hen.phong_kham`
- `PATCH /api/doctor/schedule/slots/:id` (đổi phòng): cập nhật `lich_hen.phong_kham` của tất cả `confirmed/pending` appointments liên kết với slot đó

---

### ✅ GAP-14 · `DoctorAppointmentDetail` thiếu `phong_kham` — ĐÃ SỬA (frontend mock)

**Đã sửa trong frontend (chờ DB thật):**
- `types/index.ts` → `DoctorAppointmentDetail.phong_kham?: string | null`
- `mock/doctor-appointments.ts` → tất cả 11 clinic records có `phong_kham: 'Phòng 201, Tầng 2, Tòa A'`
- `DoctorAppointments.tsx`:
  - Cột "Hình thức": hiển thị `phong_kham` màu xanh lá dưới text "Tại phòng khám"
  - Expanded row: block "Phòng khám" với icon bệnh viện, border xanh lá

**Khi gắn DB:** Backend join `lich_hen.phong_kham` và trả về trong response `DoctorAppointmentDetail`. FE không cần thay đổi.

---

## Checklist sửa file

Khi bắt đầu gắn DB thật, làm theo thứ tự sau:

### Bước 1 — Types (ĐÃ HOÀN THÀNH)

**File:** `frontend/src/types/index.ts`

- [x] `DoctorAppointmentDetail`: thêm `dia_chi_kham?: string | null`
- [x] `DoctorAppointmentDetail`: thêm `ten_dich_vu?: string | null`
- [x] `DoctorAppointmentDetail`: thêm `phong_kham?: string | null` *(GAP-14)*
- [x] `DoctorAppointmentDetail`: sửa `loai_kham` → `'clinic' | 'home'` (bỏ 'video')
- [x] `PrescriptionDrug`: đổi `lieu_dung` → `lieu_luong`
- [x] `PrescriptionDrug`: bỏ `so_ngay`, thêm `gio_uong: string[]`, `ngay_bat_dau: string`, `ngay_ket_thuc: string`
- [x] `ExaminationResult`: thêm `ghi_chu?: string | null`
- [x] `Appointment` (admin): xóa `hospital_id`, sửa `loai_kham` bỏ 'video'

### Bước 2 — DB Schema (CẦN LÀM KHI GẮN MONGODB)

**Collection `bac_si`:**
- [ ] Thêm field `phong_kham_mac_dinh: { type: String, default: null }` *(GAP-12)*
- [ ] Cập nhật Mongoose schema + migration seed

**Collection `lich_hen`:**
- [ ] Thêm field `phong_kham: { type: String, default: null }` *(GAP-13)*
- [ ] Hook pre-save: khi `loai_kham='home'` → set `phong_kham = null`
- [ ] Cập nhật Mongoose schema

### Bước 3 — Backend Services (CẦN LÀM KHI GẮN MONGODB)

**Appointment booking flow:**
- [ ] `POST /api/appointments`: Snapshot `slot.phong_kham → lich_hen.phong_kham` khi tạo clinic appointment
- [ ] `PATCH /api/doctor/schedule/slots/:id` (đổi phòng): Propagate `phong_kham` sang tất cả pending/confirmed appointments

**Doctor schedule:**
- [ ] `POST /api/doctor/schedule/slots`: Tự điền `phong_kham = bac_si.phong_kham_mac_dinh` nếu không truyền
- [ ] Response aggregate: thêm `phong_kham` vào `DoctorAppointmentDetail`

### Bước 4 — Frontend Services (thay mock bằng axios)

**File:** `frontend/src/services/doctor-appointment.service.ts`

```ts
async getAll(filters) {
  const res = await axiosInstance.get('/doctor/appointments', { params: filters })
  return res.data.data
}
async confirm(id) {
  const res = await axiosInstance.post(`/doctor/appointments/${id}/confirm`)
  return res.data.data
}
async reject(id, ly_do) {
  const res = await axiosInstance.post(`/doctor/appointments/${id}/reject`, { ly_do })
  return res.data.data
}
async complete(id) {
  const res = await axiosInstance.post(`/doctor/appointments/${id}/complete`)
  return res.data.data
}
async cancelConfirmed(id, ly_do) {
  const res = await axiosInstance.post(`/doctor/appointments/${id}/cancel`, { ly_do })
  return res.data.data
}
```

**File:** `frontend/src/services/examination.service.ts`

```ts
async getByAppointment(appointment_id) {
  const res = await axiosInstance.get(`/doctor/examination/${appointment_id}`)
  return res.data.data  // null nếu chưa có
}
async save(payload) {
  // payload: { appointment_id, chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham, thuoc[] }
  // Backend xử lý: ket_qua_kham → ho_so_y_te → don_thuoc → nhac_nho
  const res = await axiosInstance.post('/doctor/examination', payload)
  return res.data.data
}
```

### Bước 5 — Backend API Endpoints

| Method | Endpoint | Ghi chú |
|--------|----------|---------|
| `GET` | `/api/doctor/appointments` | Filter: tab, status, loai_kham. Response: `DoctorAppointmentDetail[]` với `da_co_ket_qua` + `phong_kham` computed |
| `POST` | `/api/doctor/appointments/:id/confirm` | Guard: `status=pending`, `payment_status=paid` |
| `POST` | `/api/doctor/appointments/:id/reject` | Guard: `status=pending`. Body: `{ ly_do }`. Refund nếu paid |
| `POST` | `/api/doctor/appointments/:id/complete` | Guard: `status=confirmed` |
| `POST` | `/api/doctor/appointments/:id/cancel` | Guard: `status=confirmed`. Luôn refund 100% |
| `GET` | `/api/doctor/schedule` | Trả `slots[]` với `benh_nhan` joined + `phong_kham` |
| `POST` | `/api/doctor/schedule/slots` | Tạo slot mới, auto-fill `phong_kham = bac_si.phong_kham_mac_dinh` |
| `PATCH` | `/api/doctor/schedule/slots/:id/lock` | Guard: `status=active`, `benh_nhan_id=null` |
| `PATCH` | `/api/doctor/schedule/slots/:id/unlock` | Guard: `status=locked` |
| `DELETE` | `/api/doctor/schedule/slots/:id` | Guard: `benh_nhan_id=null` |
| `PATCH` | `/api/doctor/schedule/slots/:id/room` | 🆕 Đổi phòng → propagate sang `lich_hen.phong_kham` |
| `GET` | `/api/doctor/appointments/:id/examination` | Trả `ket_qua_kham` + `don_thuoc` joined |
| `POST` | `/api/doctor/appointments/:id/examination` | Chuỗi: `ket_qua_kham → ho_so_y_te → don_thuoc → nhac_nho` |

---

## Sơ đồ luồng B4

Luồng khi bác sĩ lưu kết quả khám và đơn thuốc (backend phải xử lý atomically):

```
POST /api/doctor/appointments/:id/examination
  │
  ├─► Validate: appointment.status === 'confirmed' hoặc 'completed'
  ├─► Validate: ket_qua_kham.co_the_sua === true (nếu đã có kết quả từ trước)
  │
  ├─► Upsert ket_qua_kham
  │     { appointment_id, chan_doan, huong_dan_dieu_tri, ghi_chu, ngay_tai_kham }
  │     co_the_sua: true (cron set false sau 24h)
  │
  ├─► Upsert ho_so_y_te (medical_record)
  │     { appointment_id, member_id, nguon: 'tu_kham', ngay_kham, ten_bac_si, chan_doan }
  │
  ├─► Upsert don_thuoc
  │     { medical_record_id, member_id, doctor_id, nguon: 'bac_si', items: [...] }
  │     items[]: { ten_thuoc, lieu_luong, tan_suat, gio_uong[], ngay_bat_dau, ngay_ket_thuc, ghi_chu }
  │
  ├─► Delete nhac_nho cũ của don_thuoc này
  │
  ├─► Create nhac_nho records
  │     Với mỗi item × mỗi gio_uong × mỗi ngày từ ngay_bat_dau → ngay_ket_thuc:
  │     { prescription_item_id, user_id, gio_nhac: DateTime, status: 'pending' }
  │
  └─► Response: { ket_qua_kham + don_thuoc.items } (joined)
```

---

## Ghi chú quan trọng

- **Mock data có thể xóa** toàn bộ `frontend/src/mock/doctor-*.ts` khi backend API sẵn sàng.
- **Service layer là điểm duy nhất chạm data** — UI không cần thay đổi nếu service trả đúng type.
- **Test suite (74 tests)** đã cập nhật đầy đủ sau khi sửa type — tiếp tục pass 74/74.
- `co_the_sua` lock sau 24h: xử lý ở BE. FE chỉ cần đọc và hiển thị trạng thái read-only khi `false`.
- `lich_su_lich_hen` (appointment history): insert một record mỗi khi status/payment_status đổi — backend hook.
- **GAP-12 và GAP-13** cần được thêm vào `docs/MODELS_DATABASE.md` và `docs/Đặc tả trang web và database/database.md` trước khi implement backend.
