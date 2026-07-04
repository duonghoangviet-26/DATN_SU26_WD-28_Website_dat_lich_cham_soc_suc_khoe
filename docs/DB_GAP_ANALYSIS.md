# VitaFamily — DB Gap Analysis (B2 · B3 · B4 · C1–C8)

> Tài liệu này ghi lại toàn bộ sự khác biệt giữa **frontend TypeScript types + mock data**
> và **MongoDB schema thực tế** (docs/database.md).
> Mục đích: checklist khi chuyển từ mock → gắn DB thật.
>
> Cập nhật: 2026-06-24 (v6) · Scope: B2 (lịch làm việc), B3 (lịch hẹn bác sĩ), B4 (kết quả khám),
>           C1–C8 (toàn bộ 26 backend models đã kiểm tra)
> Trạng thái legend: ✅ Đã sửa | 🔴 Nghiêm trọng — crash ngay | 🟡 Cần sửa — sai logic | 🟢 Xử lý ở BE | ❌ Chưa có — cần tạo mới

---

## Mục lục

1. [Nhóm 🔴 Nghiêm trọng](#nhóm--nghiêm-trọng)
2. [Nhóm 🟡 Cần sửa](#nhóm--cần-sửa)
3. [Nhóm 🟢 Xử lý ở tầng Backend](#nhóm--xử-lý-ở-backend)
4. [Nhóm 🆕 Gap mới phát hiện (phòng khám)](#nhóm--gap-mới-phát-hiện)
5. [Nhóm B2 — LichLamViec schema (2026-06-23)](#nhóm-b2--lichlam-viec-2026-06-23)
6. [Nhóm C1–C8 — Kiểm tra toàn diện (2026-06-23)](#nhóm-c1c8--kiểm-tra-toàn-diện-2026-06-23)
7. [Nhóm B2 v3 — Backend kết nối (2026-06-24)](#nhóm-b2-v3--backend-kết-nối-2026-06-24)
8. [Checklist sửa file](#checklist-sửa-file)
9. [Sơ đồ luồng ghi kết quả khám (B4)](#sơ-đồ-luồng-b4)

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

### ✅ GAP-12 · `bac_si.phong_kham_mac_dinh` — ĐÃ CÓ trong BacSi.js

**Đã kiểm tra (2026-06-23):** Field `phong_kham_mac_dinh` ĐÃ TỒN TẠI trong `backend/src/models/BacSi.js`:

```js
// bac_si — đã có sẵn (line 54 BacSi.js)
phong_kham_mac_dinh: { type: String, default: null },
// Admin gán khi duyệt hồ sơ (C2). null = chưa được gán phòng cố định.
```

**Không cần thêm vào schema.** Chỉ cần implement logic ở tầng service khi gắn DB:
- `POST /api/doctor/schedule/slots`: Tự lấy `bac_si.phong_kham_mac_dinh` khi không truyền `phong_kham`
- Admin gán qua `PATCH /api/admin/doctors/:id` (C2)

---

### ✅ GAP-13 · `lich_hen.phong_kham` — ĐÃ CÓ trong LichHen.js

**Đã kiểm tra (2026-06-23):** Field `phong_kham` ĐÃ TỒN TẠI trong `backend/src/models/LichHen.js`:

```js
// lich_hen — đã có sẵn (line 36 LichHen.js)
// clinic: snapshot từ slots[].phong_kham lúc đặt lịch — null khi home
phong_kham: { type: String, default: null },
```

Hook `pre('validate')` cũng đã có: khi `loai_kham='home'` → set `phong_kham = null`.

**Không cần thêm vào schema.** Chỉ cần implement ở service khi gắn DB:
- `POST /api/appointments`: snapshot `slot.phong_kham → lich_hen.phong_kham`
- `PATCH /api/doctor/schedule/slots/:id/room`: propagate sang tất cả `pending/confirmed` appointments

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

## Nhóm B2 — LichLamViec (2026-06-23)

> Phát hiện khi đối chiếu frontend `DoctorSlot` type vs backend `slotSchema` trong `LichLamViec.js`.
> Tất cả đã được sửa trong cùng session.

---

### ✅ GAP-15 · `so_benh_nhan_toi_da` + `so_benh_nhan_hien_tai` — ĐÃ XÓA khỏi slotSchema

**Vấn đề:** Quyết định kiến trúc "1 slot = 1 bệnh nhân" từ đầu dự án nhưng 2 field multi-patient vẫn còn trong model.

```js
// slotSchema — TRƯỚC (sai)
so_benh_nhan_toi_da: { type: Number, required: true, min: 1 },   // ❌ Không cần
so_benh_nhan_hien_tai: { type: Number, default: 0, min: 0 },    // ❌ Không cần
```

**Đã sửa trong `LichLamViec.js` (2026-06-23):**
- Xóa cả 2 field khỏi `slotSchema`
- Xóa validation hook `so_benh_nhan_hien_tai > so_benh_nhan_toi_da` (sẽ crash khi field không còn)
- Cập nhật comment header và comment `status`: `booked` = `benh_nhan_id != null`, không phải `hien_tai >= toi_da`

---

### ✅ GAP-16 · `benh_nhan_id` — ĐÃ THÊM vào slotSchema

**Vấn đề:** Frontend `DoctorSlot.benh_nhan_id` cần biết ai đặt slot. Backend không lưu thông tin này trong slot.

Ghi chú: GAP-02 trước đây đề xuất JOIN qua `lich_hen`. Sau phân tích kỹ hơn, lưu `benh_nhan_id` trực tiếp trong slot tốt hơn vì:
- Atomic booking pattern dễ implement hơn
- Không cần aggregate khi chỉ cần check slot có trống không
- Consistent với quyết định "1 slot = 1 bệnh nhân"

```js
// slotSchema — TRƯỚC
// (không có benh_nhan_id)

// slotSchema — SAU (2026-06-23)
benh_nhan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
// null = chưa có ai. Khi đặt: atomic set + status='booked'. Khi hủy: reset về null + 'active'.
```

**Atomic booking pattern (quan trọng — tránh race condition):**
```js
LichLamViec.findOneAndUpdate(
  { _id: schedule_id, 'slots._id': slot_id, 'slots.status': 'active', 'slots.benh_nhan_id': null },
  { $set: { 'slots.$.status': 'booked', 'slots.$.benh_nhan_id': user_id } },
  { new: true }
)
// Nếu null → slot đã bị đặt bởi người khác (race condition) → trả lỗi 409
```

**Cập nhật GAP-02:** `benh_nhan_id` giờ được lưu trực tiếp trong slot. `benh_nhan` (tên hiển thị) vẫn cần JOIN từ `NguoiDung.ho_ten` tại API layer khi serve response.

---

### ✅ GAP-17 · API flatten `ngay` từ parent doc — CẦN XỬ LÝ Ở BE

**Vấn đề thiết kế:** `ngay` nằm ở document cha (`LichLamViec`), không nằm trong `slotSchema`. Frontend `DoctorSlot` cần `ngay` trong từng slot.

```js
// API layer phải flatten khi serve GET /api/doctor/schedule
const schedules = await LichLamViec.find({ doctor_id }).populate('slots.benh_nhan_id', 'ho_ten')
const flatSlots = schedules.flatMap(sch =>
  sch.slots.map(slot => ({
    id: slot._id,
    ngay: sch.ngay.toISOString().slice(0, 10),  // Date → 'YYYY-MM-DD'
    gio_bat_dau:   slot.gio_bat_dau,
    gio_ket_thuc:  slot.gio_ket_thuc,
    phong_kham:    slot.phong_kham,
    benh_nhan_id:  slot.benh_nhan_id?._id ?? null,
    benh_nhan:     slot.benh_nhan_id?.ho_ten ?? null,  // populated
    status:        slot.status,
  }))
)
```

**Lưu ý timezone:** `sch.ngay` là `Date` object MongoDB lưu theo UTC. Khi convert sang `YYYY-MM-DD`, phải dùng timezone Việt Nam (UTC+7) để không bị lệch ngày.

```js
const toVNDate = (d) => new Date(d.getTime() + 7*3600000).toISOString().slice(0, 10)
```

---

## Nhóm C1–C8 — Kiểm tra toàn diện (2026-06-23)

> Đã đọc và đối chiếu toàn bộ 25 backend models vs 24 frontend TypeScript interfaces.
> Kết quả: 21 model khớp hoàn toàn, 4 gap mới phát hiện (GAP-18 đến GAP-21).

---

### ✅ GAP-18 · `SpecialtyItem.icon` ≠ `ChuyenKhoa.icon_url` — ĐÃ SỬA

**Vấn đề:** Frontend dùng `icon` nhưng backend schema dùng `icon_url` — API sẽ trả về `undefined` khi map.

```ts
// TRƯỚC (sai)
export interface SpecialtyItem { icon: string }

// SAU (đã sửa)
export interface SpecialtyItem { icon_url: string }   // khớp ChuyenKhoa.icon_url
```

**Đã sửa trong:** `frontend/src/types/index.ts` → đổi `icon` → `icon_url` trong `SpecialtyItem`.

---

### ✅ GAP-19 · `ReviewItem.diem` ≠ `DanhGia.so_sao` — ĐÃ SỬA

**Vấn đề:** `diem` (điểm số) không khớp với `so_sao` (số sao) trong `backend/src/models/DanhGia.js`.
Khi API trả `so_sao`, frontend render sẽ hiển thị `undefined`.

```ts
// TRƯỚC (sai)
export interface ReviewItem { diem: number }

// SAU (đã sửa)
export interface ReviewItem { so_sao: number }   // khớp DanhGia.so_sao (1-5 integer)
```

**Đã sửa trong:** `frontend/src/types/index.ts` → đổi `diem` → `so_sao` trong `ReviewItem`.

> **Lưu ý:** `DoctorReview.diem` (Doctor Panel — type riêng cho BS xem đánh giá của mình) cũng phải đổi khi implement. Chưa sửa vì trang B5 chưa có UI.

---

### ✅ GAP-20 · `NotificationTarget` enum sai ngôn ngữ — ĐÃ SỬA

**Vấn đề:** Frontend dùng tiếng Anh, backend `ThongBaoHeThong.doi_tuong` dùng tiếng Việt.
Admin gửi `{ doi_tuong: 'all' }` → backend validate fail vì không có trong enum.

```ts
// TRƯỚC (sai — tiếng Anh)
export type NotificationTarget = 'all' | 'user' | 'doctor'

// Backend ThongBaoHeThong.js
// doi_tuong: enum ['tat_ca', 'benh_nhan', 'bac_si']
```

```ts
// SAU (đã sửa — tiếng Việt, khớp backend)
export type NotificationTarget = 'tat_ca' | 'benh_nhan' | 'bac_si'
```

**Đã sửa trong:** `frontend/src/types/index.ts` → cập nhật `NotificationTarget` và comment.

---

### ✅ GAP-21 · `ThanhToan` thiếu `ma_giao_dich`, `phuong_thuc` không có enum — ĐÃ SỬA

**Vấn đề 1 — `ma_giao_dich` thiếu trong schema:**  
Frontend `PaymentItem.ma_giao_dich: string` là trường hiển thị bắt buộc (VD: "TXN0001") nhưng backend model hoàn toàn không có field này.

**Vấn đề 2 — `phuong_thuc` không có enum constraint:**  
Frontend `PaymentMethod = 'momo'|'vnpay'|'cash'|'bank'` nhưng backend `phuong_thuc: String default 'mock'` — không validate, có thể nhận bất kỳ string nào.

**Vấn đề 3 — `TransactionStatus` vs `PaymentStatus` bị nhầm lẫn:**  
`ThanhToan.status` có `'failed'` (giao dịch thất bại) nhưng frontend dùng `PaymentStatus` (`'unpaid'|'paid'|'refunded'`) — loại type sai, thiếu `'pending'` và `'failed'`.

**Đã sửa trong `backend/src/models/ThanhToan.js` (2026-06-23):**

```js
// Thêm field ma_giao_dich với auto-gen hook
ma_giao_dich: { type: String, unique: true, sparse: true, maxlength: 20 },

// Thêm enum constraint cho phuong_thuc
phuong_thuc: {
  type: String,
  enum: ['momo', 'vnpay', 'cash', 'bank', 'mock'],
  default: 'mock',
},

// pre-validate hook tự sinh "TXN0001", "TXN0002"...
```

**Đã sửa trong `frontend/src/types/index.ts` (2026-06-23):**

```ts
// Thêm type mới riêng cho transaction
export type TransactionStatus = 'pending' | 'paid' | 'failed' | 'refunded'

// Thêm 'mock' vào PaymentMethod
export type PaymentMethod = 'momo' | 'vnpay' | 'cash' | 'bank' | 'mock'

// PaymentItem.status dùng đúng type
export interface PaymentItem {
  ma_giao_dich: string       // "TXN0001"
  status: TransactionStatus  // (đổi từ PaymentStatus)
  phuong_thuc: PaymentMethod
  ...
}
```

**Lưu ý:** `PaymentStatus = 'unpaid'|'paid'|'refunded'` vẫn giữ nguyên — dùng cho `LichHen.payment_status`, KHÔNG dùng cho `ThanhToan.status`.

---

### ✅ Models đã kiểm tra — KHÔNG có gap

| Model | Scope | Kết quả |
|---|---|---|
| `NguoiDung.js` | C1 | ✅ Khớp hoàn toàn |
| `DatLaiMatKhau.js` | Auth | ✅ Internal, không expose FE |
| `BacSi.js` | C2 | ✅ Khớp (`phong_kham_mac_dinh` đã có) |
| `LichLamViec.js` | B2 | ✅ Đã sửa hôm nay (GAP-15,16,17) |
| `LichHen.js` | B3/C5 | ✅ Khớp (`payment_deadline`, `phong_kham` đã có) |
| `KetQuaKham.js` | B4 | ✅ Khớp (`co_the_sua`, `ghi_chu`, `ngay_tai_kham` có đủ) |
| `DonThuoc.js` | B4 | ✅ Khớp (`lieu_luong`, `gio_uong[]`, max 90 ngày) |
| `ThanhVien.js` | A3 | ✅ Khớp (soft delete `ngay_xoa`, max 10 thành viên) |
| `GiaDinh.js` | A3 | ✅ Khớp |
| `NhacNho.js` | A4 | ✅ Khớp (`prescription_id` + `prescription_item_id` đúng) |
| `HoSoYTe.js` | A2 | ✅ Khớp (`nguon: 'tu_kham'\|'thu_cong'`, hook validate) |
| `HoanTien.js` | C8 | ✅ Khớp (`phan_tram_hoan: enum[0,50,80,100]`) |
| `LichSuLichHen.js` | Audit | ✅ Khớp (`tu_trang_thai`, `den_trang_thai`, `vai_tro` enum) |
| `ThongBao.js` | Notify | ✅ Khớp (personal notif — khác `ThongBaoHeThong`) |
| `ThongBaoHeThong.js` | C7 | ✅ Đã sửa type (GAP-20) |
| `DichVu.js` | C4 | ✅ Khớp (không có `'video'` loai, `gia` snapshot đúng) |
| `ChuyenKhoa.js` | C3 | ✅ Khớp Specialty — SpecialtyItem đã sửa (GAP-18) |
| `ThongTinPhongKham.js` | C3 | ✅ Singleton `ma: 'MAIN'` immutable |
| `DanhGia.js` | B5/C6 | ✅ Đã sửa type (GAP-19) |
| `NhatKyThaoTac.js` | Audit | ✅ Backing ServiceChangeLog qua hanh_dong constants |
| `CaiDatThanhToan.js` | C8 | ✅ Key-value, không expose trực tiếp ra FE type |
| `PhienChat.js` | Chatbot | ✅ Không có FE type tương ứng (AI chatbot riêng) |
| `TinNhanChat.js` | Chatbot | ✅ Không có FE type tương ứng |

---

## Nhóm B2 v3 — Backend kết nối (2026-06-24)

> Audit sau khi redesign B2 (rolling window, 16 slot/ngày, doctor chỉ lock/unlock/request-cancel).
> Schema `LichLamViec.js` và `BacSi.js` đã đúng — gaps tập trung ở type FE, code API, và code chưa có.

---

### 🔴 GAP-B2-01 · `DoctorSlot.id: number` phải đổi thành `string`

**Vấn đề:** MongoDB ObjectId là chuỗi 24-ký-tự hex (`"6677a1b2c3d4e5f6a7b8c9d0"`), không phải `number`. Mọi service call (`lockSlot(id)`, `unlockSlot(id)`...) đang truyền `number` — sẽ crash khi query MongoDB.

**Cần sửa trong `frontend/src/types/index.ts`:**
```ts
// TRƯỚC (sai với MongoDB)
export interface DoctorSlot {
  id: number
  benh_nhan_id?: number | null
  ...
}

// SAU
export interface DoctorSlot {
  id: string            // MongoDB ObjectId là string
  benh_nhan_id?: string | null
  ...
}
```

**Lưu ý mock data:** Mock hiện dùng `id: 1, 2, 3...` (number) — hợp lệ cho mock vì test chạy với số. Khi gắn DB thật, service trả ObjectId string. Không cần sửa mock.

---

### 🔴 GAP-B2-02 · Timezone bug khi convert `ngay: Date` → `'YYYY-MM-DD'`

**Vấn đề:** `slotSchema` không có `ngay` — field này nằm ở parent doc `LichLamViec`. API phải flatten mỗi slot và thêm `ngay`. Nếu dùng `.toISOString().slice(0,10)` thẳng → lệch ngày vào ban đêm (MongoDB lưu UTC, Việt Nam UTC+7).

**Cần áp dụng trong controller khi trả response:**
```js
// SAI — có thể trả "2026-06-23" thay vì "2026-06-24" lúc 23:00 VN
const ngay = sch.ngay.toISOString().slice(0, 10)

// ĐÚNG — compensate UTC+7
const toVNDate = (d) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
const ngay = toVNDate(sch.ngay)
```

**Flatten pattern đầy đủ cho `GET /api/doctor/slots`:**
```js
const schedules = await LichLamViec.find({ doctor_id })
  .populate('slots.benh_nhan_id', 'ho_ten')

const flatSlots = schedules.flatMap(sch =>
  sch.slots.map(slot => ({
    id:           slot._id.toString(),          // ObjectId → string
    ngay:         toVNDate(sch.ngay),           // Date → 'YYYY-MM-DD' UTC+7
    gio_bat_dau:  slot.gio_bat_dau,
    gio_ket_thuc: slot.gio_ket_thuc,
    phong_kham:   slot.phong_kham ?? null,
    benh_nhan_id: slot.benh_nhan_id?._id?.toString() ?? null,
    benh_nhan:    slot.benh_nhan_id?.ho_ten ?? null,  // populated
    status:       slot.status,
  }))
)
```

---

### 🟡 GAP-B2-03 · `'expired'` trong `slotSchema.status` enum — mâu thuẫn với thiết kế v3

**Vấn đề:** Design doc B2 v3 quy định `expired` là **giá trị tính toán ở frontend** (slot active/locked qua ngày → hiển thị expired), **không lưu vào DB**. Nhưng `slotSchema.status.enum` vẫn có `'expired'` → backend có thể vô tình set status này.

**Cần quyết định một trong hai:**

| Phương án | Hành động | Ưu điểm |
|---|---|---|
| **A — Xóa khỏi enum** (khuyến nghị) | Bỏ `'expired'` khỏi enum. Frontend tính từ `ngay < today` | Sạch, nhất quán với design doc |
| **B — Giữ, cron update** | Cron 00:01 chạy `updateMany` set expired | Backend query expired dễ hơn |

**Sửa trong `LichLamViec.js` nếu chọn A:**
```js
status: {
  type: String,
  enum: ['active', 'booked', 'locked', 'cancelled'],  // bỏ 'expired'
  default: 'active',
},
```

**Và sửa `frontend/src/types/index.ts`:**
```ts
status: 'active' | 'booked' | 'locked' | 'cancelled'
// 'expired' chỉ dùng trong UI computation, không phải stored value
```

---

### 🟡 GAP-B2-04 · `doctor_id` trong JWT — chưa rõ có không

**Vấn đề:** `auth.controller.js` hiện tạo JWT với `{ id, email, role }`. Mọi request B2 cần `BacSi._id` để query `LichLamViec.find({ doctor_id })`. Nếu không có trong JWT → phải lookup `BacSi.findOne({ user_id })` mỗi request (tốn 1 query thêm).

**Khuyến nghị — thêm `doctor_id` vào JWT lúc login:**
```js
// auth.controller.js — login handler
const user = await NguoiDung.findOne({ email })
// ...
let doctor_id = null
if (user.role === 'doctor') {
  const bac_si = await BacSi.findOne({ user_id: user._id }, '_id')
  doctor_id = bac_si?._id?.toString() ?? null
}

const token = jwt.sign(
  { id: user._id, email: user.email, role: user.role, doctor_id },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
)
```

**Dùng trong schedule controller:**
```js
// Không cần lookup BacSi nữa
const doctor_id = req.user.doctor_id
const schedules = await LichLamViec.find({ doctor_id })
```

---

### 🟢 GAP-B2-05 · `benh_nhan` (tên hiển thị) — populate ở API layer

**Không cần thay đổi schema.** Khi trả response, populate `benh_nhan_id → NguoiDung.ho_ten` (xem flatten pattern ở GAP-B2-02). Đã ghi chú trong `LichLamViec.js`.

---

### ❌ GAP-B2-06 · Không có `YeuCauHuySlot` — cần cơ chế lưu yêu cầu hủy

**Vấn đề:** `requestCancelSlot(id, ly_do)` hiện chỉ `console.log`. Khi kết nối DB thật, cần lưu yêu cầu này để Admin xử lý.

**Quyết định một trong hai:**

**Phương án A — Dùng `ThongBao` model (đơn giản):**
```js
await ThongBao.create({
  nguoi_nhan_id: adminId,       // notify Admin
  loai: 'yeu_cau_huy_slot',
  tieu_de: 'Bác sĩ yêu cầu hủy ca',
  noi_dung: `BS ${req.user.ho_ten} yêu cầu hủy slot ${slot._id}: "${ly_do}"`,
  data: { slot_id: slot._id, doctor_id, ly_do },
})
```

**Phương án B — Collection riêng `yeu_cau_huy_slot`:**
```js
// Mới hơn, Admin quản lý trong C5
{
  slot_id:   ObjectId ref slot trong LichLamViec,
  doctor_id: ObjectId ref BacSi,
  ly_do:     String required,
  status:    enum ['pending', 'approved', 'rejected'],
  ghi_chu_admin: String default null,
  ngay_tao:  Date,
}
```

---

### ✅ GAP-B2-07 · `PhongKham` model — ĐÃ TẠO (2026-06-24)

**Đã tạo:** `backend/src/models/PhongKham.js` + export trong `models/index.js` (26 collections).

**Chiến lược String snapshot (không dùng ObjectId FK):**
- `LichLamViec.slots[].phong_kham` và `LichHen.phong_kham` vẫn là `String` lưu `full_name` tại thời điểm đặt.
- Lý do: lịch cũ không bị ảnh hưởng khi phòng đổi tên/bị xóa về sau.
- `BacSi.phong_kham_mac_dinh` cũng là `String` = `full_name` của phòng Admin gán khi duyệt.

**Schema:**
```js
{ ten: String, tang: Number, toa: String, loai: String, trang_thai: 'active'|'inactive' }
// virtual full_name: `${ten}, Tầng ${tang}, Tòa ${toa}` — khớp với DoctorSlot.phong_kham
```

**Seed 8 phòng ban đầu:** `backend/src/scripts/seed-all.js` (bước 4) — khớp 1-1 với `frontend/src/mock/rooms.ts`.

**Khi gắn DB:** Frontend đổi `mockRooms.ts` → gọi `GET /api/phong-kham` trả array `{_id, ten, tang, toa, loai, full_name}`.

**Conflict check phòng (cross-doctor):** API `GET /api/phong-kham/available?ngay=&gio_bat_dau=&gio_ket_thuc=`:
```js
const busyRooms = await LichLamViec.aggregate([
  { $match: { ngay: targetDate } },
  { $unwind: '$slots' },
  { $match: {
    'slots.status': { $in: ['active', 'booked', 'locked'] },
    'slots.phong_kham': { $ne: null },
    'slots.gio_bat_dau': { $lt: gio_ket_thuc },
    'slots.gio_ket_thuc': { $gt: gio_bat_dau },
  }},
  { $group: { _id: '$slots.phong_kham' } },
])
// Trả danh sách phòng = allRooms.filter(r => !busyRooms.includes(r.full_name))
```

---

### ❌ GAP-B2-08 · Toàn bộ backend code B2 chưa có

**Các file cần tạo mới:**

```
backend/src/
├── routes/
│   ├── index.js                    ← Thêm: router.use('/doctor', doctorRoutes)
│   └── doctor/
│       ├── index.js                ← Tạo mới
│       └── schedule.routes.js      ← Tạo mới
├── controllers/
│   └── doctor/
│       └── schedule.controller.js  ← Tạo mới
└── services/
    └── slot-generator.service.js   ← Tạo mới (logic sinh 16 slot + cron)
```

**Endpoints cần implement (theo thứ tự ưu tiên):**

| Priority | Method | Endpoint | Guard | Mô tả |
|---|---|---|---|---|
| P0 | `GET` | `/api/doctor/slots` | verifyToken + role=doctor | Rolling window T2–T7, flatten + populate |
| P0 | `PATCH` | `/api/doctor/slots/:slotId/lock` | verifyToken + role=doctor | Guard: status=active, benh_nhan_id=null |
| P0 | `PATCH` | `/api/doctor/slots/:slotId/unlock` | verifyToken + role=doctor | Guard: status=locked |
| P0 | `PATCH` | `/api/doctor/slots/:slotId/phong-kham` | verifyToken + role=doctor | Guard: benh_nhan_id=null, status active/locked |
| P1 | `POST` | `/api/doctor/slots/:slotId/request-cancel` | verifyToken + role=doctor | Guard: status=booked, ly_do required |
| P1 | `POST` | `/api/admin/slots/generate` | verifyToken + role=admin | Fallback khi cron fail |

**Cron job (`slot-generator.service.js`):**
```js
import cron from 'node-cron'
import BacSi from '../models/BacSi.js'
import LichLamViec from '../models/LichLamViec.js'

const SLOT_TIMES = [
  ['08:00','08:30'], ['08:30','09:00'], ['09:00','09:30'], ['09:30','10:00'],
  ['10:00','10:30'], ['10:30','11:00'], ['11:00','11:30'], ['11:30','12:00'],
  // nghỉ trưa 12:00–13:30
  ['13:30','14:00'], ['14:00','14:30'], ['14:30','15:00'], ['15:00','15:30'],
  ['15:30','16:00'], ['16:00','16:30'], ['16:30','17:00'], ['17:00','17:30'],
]

// Sinh slot cho 1 ngày + 1 bác sĩ (idempotent — skip nếu đã có)
export async function generateDaySlots(doctor_id, phong_kham_mac_dinh, date) {
  const existing = await LichLamViec.findOne({ doctor_id, ngay: date })
  if (existing) return  // đã có, không sinh lại

  const slots = SLOT_TIMES.map(([bat_dau, ket_thuc]) => ({
    gio_bat_dau:  bat_dau,
    gio_ket_thuc: ket_thuc,
    phong_kham:   phong_kham_mac_dinh ?? null,
    status:       'active',
    benh_nhan_id: null,
  }))

  await LichLamViec.create({ doctor_id, ngay: date, slots })
}

// Tính ngày T2–T7 cần sinh thêm (để luôn có 6 ngày phía trước)
export async function maintainRollingWindow(doctor_id) {
  const today = new Date(); today.setHours(0,0,0,0)
  // Lấy 6 ngày T2–T7 tiếp theo (bỏ CN)
  const targetDates = []
  const cur = new Date(today)
  while (targetDates.length < 6) {
    if (cur.getDay() !== 0) targetDates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  const doctor = await BacSi.findById(doctor_id, 'phong_kham_mac_dinh')
  for (const date of targetDates) {
    await generateDaySlots(doctor_id, doctor.phong_kham_mac_dinh, date)
  }
}

// Cron chạy 23:55 hàng ngày
export function startScheduleCron() {
  cron.schedule('55 23 * * *', async () => {
    console.log('[Cron] Sinh lịch làm việc mới...')
    const doctors = await BacSi.find({ trang_thai_duyet: 'approved' }, '_id phong_kham_mac_dinh')
    await Promise.all(doctors.map(d => maintainRollingWindow(d._id)))
    console.log(`[Cron] Done — ${doctors.length} bác sĩ`)
  })
}
```

---

### Thứ tự thực hiện khi gắn DB

```
Bước A — Sửa frontend types (không break test):
  ├── [ ] DoctorSlot.id: number → string
  └── [ ] DoctorSlot.benh_nhan_id: number|null → string|null

Bước B — Quyết định 2 điểm còn mở:
  ├── [ ] 'expired' enum: giữ (phương án B) hay xóa (phương án A)?
  └── [ ] YeuCauHuySlot: ThongBao (phương án A) hay collection riêng (phương án B)?

Bước C — Sửa backend models (nếu chọn xóa 'expired'):
  └── [ ] LichLamViec.js: bỏ 'expired' khỏi enum

Bước D — Backend code mới (theo thứ tự P0 trước):
  ├── [ ] slot-generator.service.js (generateDaySlots + startScheduleCron)
  ├── [ ] schedule.controller.js (5 endpoints P0)
  ├── [ ] schedule.routes.js + doctor/index.js
  ├── [ ] Mount routes/index.js: router.use('/doctor', ...)
  ├── [ ] Thêm doctor_id vào JWT (auth.controller.js — login)
  └── [ ] request-cancel + admin/generate (P1)

Bước E — Đăng ký cron:
  └── [ ] Import startScheduleCron() trong server.js / app.js

Bước F — Thay mock bằng axios (frontend/src/services/schedule.service.ts):
  ├── [ ] getAll() → GET /api/doctor/slots
  ├── [ ] lockSlot() → PATCH /api/doctor/slots/:id/lock
  ├── [ ] unlockSlot() → PATCH /api/doctor/slots/:id/unlock
  ├── [ ] updatePhongKham() → PATCH /api/doctor/slots/:id/phong-kham
  └── [ ] requestCancelSlot() → POST /api/doctor/slots/:id/request-cancel
```

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
- [x] `SpecialtyItem.icon` → `icon_url` *(GAP-18)*
- [x] `ReviewItem.diem` → `so_sao` *(GAP-19)*
- [x] `NotificationTarget` → tiếng Việt: `'tat_ca'|'benh_nhan'|'bac_si'` *(GAP-20)*
- [x] Thêm `TransactionStatus` type cho `ThanhToan.status` *(GAP-21)*
- [x] `PaymentItem.status: TransactionStatus` (đổi từ `PaymentStatus`) *(GAP-21)*
- [x] `PaymentMethod` thêm `'mock'` *(GAP-21)*

### Bước 2 — DB Schema

**Collection `lich_lam_viec` (slotSchema):** ✅ ĐÃ CẬP NHẬT (2026-06-23)
- [x] Xóa `so_benh_nhan_toi_da` và `so_benh_nhan_hien_tai` *(GAP-15)*
- [x] Thêm `benh_nhan_id: ObjectId ref NguoiDung, default null` *(GAP-16)*
- [x] Xóa validation hook check `hien_tai > toi_da` *(GAP-15)*
- [x] Cập nhật comment atomic booking pattern *(GAP-17)*

**Collection `bac_si`:** ✅ FIELD ĐÃ CÓ SẴN (kiểm tra 2026-06-23)
- [x] `phong_kham_mac_dinh: { type: String, default: null }` *(GAP-12)*

**Collection `lich_hen`:** ✅ FIELD ĐÃ CÓ SẴN (kiểm tra 2026-06-23)
- [x] `phong_kham: { type: String, default: null }` *(GAP-13)*
- [x] Hook pre-validate: `loai_kham='home'` → `phong_kham = null` *(GAP-13)*
- [x] `payment_deadline: { type: Date, default: null }` — Luồng C

**Collection `thanh_toan`:** ✅ ĐÃ CẬP NHẬT (2026-06-23)
- [x] Thêm `ma_giao_dich: String unique sparse` + pre-validate hook auto-gen "TXN0001" *(GAP-21)*
- [x] `phuong_thuc` thêm enum `['momo','vnpay','cash','bank','mock']` *(GAP-21)*

### Bước 3 — Backend Services (CẦN LÀM KHI GẮN MONGODB)

**Appointment booking flow:**
- [ ] `POST /api/appointments`: Snapshot `slot.phong_kham → lich_hen.phong_kham` khi tạo clinic appointment
- [ ] `PATCH /api/doctor/schedule/slots/:id` (đổi phòng): Propagate `phong_kham` sang tất cả pending/confirmed appointments

**Doctor schedule (B2 v3 — rolling window, cron job):**
- [ ] `GET /api/doctor/slots`: Response rolling window 6 ngày T2–T7, 16 slot/ngày (skip 12:00–13:30)
- [ ] `POST /api/doctor/slots/:id/request-cancel`: Tạo thông báo cho Admin, slot giữ `status=booked`
- [ ] `POST /api/admin/slots/generate`: Sinh slot cho T+7 của tất cả bác sĩ approved
- [ ] `node-cron 23:55`: Auto-trigger generate cho ngày mới
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
| `POST` | `/api/doctor/appointments/:id/confirm` | Guard: `status=pending` (Luồng C: không cần paid). Nếu unpaid → set `payment_deadline=now+2h` |
| `POST` | `/api/doctor/appointments/:id/reject` | Guard: `status=pending`. Body: `{ ly_do }`. Refund nếu paid |
| `POST` | `/api/doctor/appointments/:id/complete` | Guard: `status=confirmed` |
| `POST` | `/api/doctor/appointments/:id/cancel` | Guard: `status=confirmed`. Luôn refund 100% |
| `GET` | `/api/doctor/slots` | Rolling window T2–T7, `slots[]` với `benh_nhan` joined + `phong_kham` |
| `PATCH` | `/api/doctor/slots/:id/lock` | Guard: `status=active`, `benh_nhan_id=null` |
| `PATCH` | `/api/doctor/slots/:id/unlock` | Guard: `status=locked` |
| `PATCH` | `/api/doctor/slots/:id/phong-kham` | 🆕 Đổi phòng → propagate sang `lich_hen.phong_kham` |
| `POST` | `/api/doctor/slots/:id/request-cancel` | 🆕 Yêu cầu hủy slot booked → Admin xử lý |
| `POST` | `/api/admin/slots/generate` | 🆕 Admin sinh lịch thủ công (fallback nếu cron fail) |
| — | node-cron 23:55 | 🆕 Auto-sinh slot T+7 cho tất cả bác sĩ approved |
| ~~`POST`~~ | ~~`/api/doctor/slots` (tạo slot)~~ | ❌ **Đã xóa** — bác sĩ không tạo slot (B2 v3) |
| ~~`DELETE`~~ | ~~`/api/doctor/slots/:id`~~ | ❌ **Đã xóa** — bác sĩ không xóa slot (B2 v3) |
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
- **Test suite** đã cập nhật đầy đủ — pass 100% (2026-06-24). Schedule service: 50 tests sau B2 v3 redesign (bỏ addSlot/deleteSlot, thêm requestCancelSlot — 96 slot thay vì 15); Appointment service: 31 tests; Examination service: 19 tests.
- **B2 v3 backend gaps** đã audit 2026-06-24 — xem section "Nhóm B2 v3 — Backend kết nối": 2 lỗi 🔴 (id type `number→string`, timezone bug), 2 lỗi 🟡 (expired enum contradiction, doctor_id thiếu trong JWT), 3 mục ❌ chưa có (YeuCauHuySlot model, PhongKham model, toàn bộ routes/controllers/cron). Schema `LichLamViec.js` và `BacSi.js` đã đúng, không cần sửa.
- **Kiểm tra toàn diện 25 models** hoàn thành 2026-06-23: chỉ có 4 gaps mới (GAP-18 → 21), tất cả đã sửa. Models `PhienChat`, `TinNhanChat`, `DatLaiMatKhau` không có FE type tương ứng — bình thường.
- **`DoctorReview.diem`** (type riêng cho B5 — Doctor xem đánh giá) chưa sửa — trang B5 chưa implement. Sẽ đổi thành `so_sao` khi làm B5.
- `co_the_sua` lock sau 24h: xử lý ở BE. FE chỉ cần đọc và hiển thị trạng thái read-only khi `false`.
- `lich_su_lich_hen` (appointment history): insert một record mỗi khi status/payment_status đổi — backend hook.
- **GAP-12 và GAP-13** cần được thêm vào `docs/MODELS_DATABASE.md` và `docs/Đặc tả trang web và database/database.md` trước khi implement backend.
