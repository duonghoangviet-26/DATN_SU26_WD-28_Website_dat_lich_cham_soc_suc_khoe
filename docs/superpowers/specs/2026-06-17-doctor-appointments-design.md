# Spec: Quản lý Lịch hẹn của Bác sĩ — B3 + B4

> **Ngày:** 2026-06-17 (review lần 2 — đã sửa 12 lỗi)
> **Actor:** Bác sĩ đã đăng nhập (`trang_thai_duyet = 'approved'`)
> **Route:** `/doctor/appointments`
> **Chức năng:** B3 — Xác nhận & quản lý lịch hẹn · B4 — Ghi kết quả khám & kê đơn thuốc
> **Nguồn tham khảo:** HL7 FHIR Appointment Spec · QA Healthcare Testing Best Practices · VitaFamily features.md

---

## 1. Mục tiêu tính năng

Trang `/doctor/appointments` là nơi bác sĩ xử lý **toàn bộ vòng đời** của lịch hẹn từ khi bệnh nhân đặt đến khi kết thúc điều trị. Bác sĩ cần trả lời được 3 câu hỏi chính:

1. **Tôi cần xử lý lịch hẹn nào ngay hôm nay?** (pending cần confirm / từ chối)
2. **Trạng thái lịch hẹn sắp tới của tôi là gì?**
3. **Kết quả khám của bệnh nhân đã qua đã được ghi đầy đủ chưa?**

---

## 2. Điều kiện truy cập

> ⚠️ **Lưu ý implement:** Access control hiện **chưa được áp dụng** trong `DoctorAppointments.tsx`. Đây là hành vi mong đợi cần implement.

| `trang_thai_duyet` | Hành vi | Lý do |
|---|---|---|
| `approved` | Truy cập đầy đủ — xem, xác nhận, ghi kết quả | Bác sĩ chính thức hoạt động |
| `pending` | Redirect về `/doctor` với banner cảnh báo | Bác sĩ chưa được duyệt — bệnh nhân không thể đặt lịch với họ nên danh sách trống; không cần trang này |
| `rejected` | Redirect về `/doctor` với banner từ chối | Tương tự `pending` |
| `suspended` | Redirect về `/doctor` với banner bị khóa | Mọi hoạt động đình chỉ |

**Quy tắc đơn giản:** Chỉ `approved` mới truy cập được `/doctor/appointments`. Tất cả trạng thái khác → redirect `/doctor`.

---

## 3. State Machine — Trạng thái Lịch hẹn

### 3.1 Sơ đồ trạng thái

```
[Bệnh nhân đặt + thanh toán]
              │
              ▼
          PENDING ──── Doctor từ chối (kèm lý do) ────────────────────────┐
              │         → payment_status: paid → refunded                  │
              │                                                             ▼
         Doctor xác nhận ──────────────────────────────────────────► CANCELLED
              │                                                             ▲
              ▼                                                             │
          CONFIRMED ──── Doctor hủy (kèm lý do) [*gap*] ──────────────────┤
              │            → payment_status: paid → refunded               │
              │                                                             │
              │         Bệnh nhân hủy (qua app) ──────────────────────────┘
              │            → refund theo chính sách thời gian
              │
         Doctor hoàn thành
              │
              ▼
          COMPLETED
              │
              └──► Ghi kết quả khám (ExamModal)
                       │
                       ├── < 24h kể từ lần ghi đầu: co_the_sua = true → có thể sửa
                       └── ≥ 24h: cron job set co_the_sua = false → readonly vĩnh viễn
```

**Transition đặc biệt của hệ thống (cron job):**
- `pending` + `payment_status = 'unpaid'` quá **15 phút** → `cancelled` tự động
- *(Đề xuất — chưa trong đặc tả gốc):* `pending` bác sĩ không phản hồi quá **24h** → `cancelled`, hoàn tiền 100%

### 3.2 Bảng chuyển trạng thái

| Từ | Sang | Actor | Điều kiện bắt buộc | Hệ quả kèm theo |
|---|---|---|---|---|
| `pending` | `confirmed` | Bác sĩ | `payment_status = 'paid'` | Bệnh nhân nhận notification + email xác nhận |
| `pending` | `cancelled` | Bác sĩ | Nhập lý do từ chối (không được trống) | `payment_status: paid → refunded`; bệnh nhân nhận email kèm lý do |
| `pending` | `cancelled` | Bệnh nhân | Hủy qua app | `payment_status: paid → refunded` theo chính sách thời gian |
| `pending` | `cancelled` | Hệ thống (cron) | `payment_status = 'unpaid'` quá 15 phút | Slot trả về `active` |
| `confirmed` | `completed` | Bác sĩ | — | Cho phép ghi kết quả; slot chuyển `expired` |
| `confirmed` | `cancelled` | Bác sĩ | Nhập lý do hủy **[gap — chưa implement]** | `payment_status: paid → refunded` 100% bất kể thời điểm; thông báo bệnh nhân |

> ⚠️ `cancelled` và `completed` là **trạng thái cuối** — không thể chuyển sang bất kỳ trạng thái nào khác.

> ⚠️ `payment_status` thay đổi **song song** với `status` khi hủy — backend phải update cả 2 trong 1 transaction.

### 3.3 Quy tắc bất biến (không bao giờ được vi phạm)

1. `cancelled` / `completed` → không thể chuyển về trạng thái khác.
2. `pending` có `payment_status = 'unpaid'` → **không** hiện nút "Xác nhận".
   > ⚠️ **Bug code hiện tại:** `DoctorAppointments.tsx` không kiểm tra `payment_status` — hiện cả 2 nút cho mọi `pending`. Cần fix trước khi gắn DB.
3. Bác sĩ **chỉ thấy** lịch của chính mình — filter `doctor_id` ở **backend**, không tin frontend.
4. `da_co_ket_qua` chỉ được set `true` khi `examinationService.save()` thành công — **không** set trong `complete()`.
   > ⚠️ **Bug mock hiện tại:** `doctorAppointmentService.complete()` đang tự set `da_co_ket_qua: true` — sai logic. Cần fix.

---

## 4. Business Rules chi tiết

### 4.1 Chính sách xác nhận

| Kịch bản | Quy tắc |
|---|---|
| Lịch `pending`, `payment_status = 'unpaid'` | Ẩn nút "Xác nhận" — đợi bệnh nhân thanh toán |
| Lịch `pending`, `ngay_kham < hôm nay` (đã qua ngày) | Coi như **hết hạn** — ẩn nút "Xác nhận", hiển thị badge "Hết hạn", chỉ còn nút "Từ chối" |
| *(Đề xuất)* Bác sĩ không phản hồi trong 24h | Hệ thống tự chuyển `pending → cancelled`, hoàn 100%, thông báo 2 bên *(chưa có trong đặc tả gốc — cần confirm với team)* |

### 4.2 Chính sách hoàn tiền (lấy từ bảng `payment_settings` — không hardcode)

| Thời gian hủy trước lịch khám | Bệnh nhân hủy | Bác sĩ hủy |
|---|---|---|
| ≥ 24 giờ | 100% | 100% |
| 12 – 24 giờ | 80% | 100% |
| 6 – 12 giờ | 50% | 100% |
| < 6 giờ | 0% | 100% |

**Nguyên tắc quan trọng:** Bác sĩ hủy → **luôn hoàn 100%** bất kể thời điểm nào — chính sách bảo vệ bệnh nhân. Không lấy từ bảng `payment_settings` mà hardcode `100%` cho trường hợp này.

### 4.3 Xử lý No-Show (Bệnh nhân không đến)

- Bác sĩ gặp trường hợp bệnh nhân không đến: click "Hoàn thành" như bình thường
- Trong kết quả khám: ghi chú "Bệnh nhân không đến" trong trường `chan_doan`
- VitaFamily **không có** trạng thái riêng `noshow` (đơn giản hóa so với HL7 FHIR)
- Tiền **không hoàn** — bệnh nhân không hủy trước = mất tiền theo chính sách `< 6h → 0%`

### 4.4 Cơ chế khóa kết quả khám (24h lock)

```
Thời điểm lưu kết quả lần đầu (examination_results.ngay_tao)
        │
        ├──── < 24h ──► co_the_sua = true  → bác sĩ có thể xem và sửa
        │
        └──── ≥ 24h ──► co_the_sua = false → readonly hoàn toàn (vĩnh viễn)
```

**Cron job (MongoDB — chạy mỗi giờ):**
```js
// node-cron, chạy mỗi 1 giờ
await ExaminationResult.updateMany(
  {
    co_the_sua: true,
    ngay_tao: { $lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  },
  { $set: { co_the_sua: false } }
)
```

**Frontend cũng phải check** `co_the_sua` để render readonly — đây là UX guard, không phải security guard. Backend vẫn phải validate độc lập.

**Lý do khóa:** Đảm bảo tính pháp lý của hồ sơ y tế — bệnh nhân đã nhận đơn thuốc, không cho phép sửa lén sau đó.

### 4.5 Cảnh báo y tế bệnh nhân trong expanded row

Bác sĩ **phải nhìn thấy** trước khi khám:

| Thông tin | Màu | Mức độ |
|---|---|---|
| `di_ung` (dị ứng) | 🔴 `text-red-600 font-medium` | CRITICAL — tránh phản ứng thuốc nguy hiểm |
| `benh_nen` (bệnh nền) | Xám thường | Quan trọng — ảnh hưởng chẩn đoán |
| `ly_do_kham` | Xám thường | Định hướng khám |
| `tuoi` + `gioi_tinh` | Xám thường | Thông tin cơ bản |

**Quy tắc hiển thị:** Chỉ render field khi có giá trị — không hiện field trống hay `null`.

### 4.6 Quyền thao tác theo trạng thái + payment_status

| Trạng thái | Điều kiện thêm | Xác nhận | Từ chối | Hoàn thành | Mở ExamModal | Nút ExamModal |
|---|---|---|---|---|---|---|
| `pending` | `payment_status = 'paid'` | ✅ | ✅ | ❌ | ❌ | — |
| `pending` | `payment_status = 'unpaid'` | ❌ | ✅ | ❌ | ❌ | — |
| `confirmed` | — | ❌ | ❌ | ✅ | ✅ | "Kết quả" (ghi/xem) |
| `completed` | `da_co_ket_qua = false` | ❌ | ❌ | ❌ | ✅ | "Nhập kết quả" (icon edit) |
| `completed` | `da_co_ket_qua = true, co_the_sua = true` | ❌ | ❌ | ❌ | ✅ | "Xem kết quả" (icon eye) |
| `completed` | `da_co_ket_qua = true, co_the_sua = false` | ❌ | ❌ | ❌ | ✅ | "Xem kết quả" (icon eye, readonly) |
| `cancelled` | — | ❌ | ❌ | ❌ | ❌ | — |

> ⚠️ **Cột "Xem kết quả" trong code hiện tại** chỉ phân biệt `da_co_ket_qua` (icon eye vs edit), không kiểm tra `payment_status`. Fix cần thiết cho cột "Xác nhận".

---

## 5. Data Model

### 5.1 `DoctorAppointmentDetail` — (`types/index.ts`)

```ts
export interface DoctorAppointmentDetail {
  id: number
  benh_nhan: string
  benh_nhan_id: number
  so_dien_thoai: string
  ngay_kham: string             // 'YYYY-MM-DD'
  gio_kham: string              // 'HH:MM'
  loai_kham: 'clinic' | 'home'
  status: AppointmentStatus     // 'pending' | 'confirmed' | 'completed' | 'cancelled'
  payment_status: PaymentStatus // 'unpaid' | 'paid' | 'refunded'
  gia_kham: number
  ly_do_kham?: string
  tuoi?: number
  gioi_tinh?: 'Nam' | 'Nữ' | 'Khác'
  di_ung?: string | null        // ⚠️ CRITICAL — hiển thị màu đỏ nổi bật
  benh_nen?: string | null
  da_co_ket_qua: boolean        // false = chưa ghi kết quả; true = đã ghi
  ly_do_huy?: string | null
}
```

### 5.2 `ExaminationResult` — (`types/index.ts`)

```ts
export interface ExaminationResult {
  id: number
  appointment_id: number
  chan_doan: string          // bắt buộc — không được để trống
  huong_dan_dieu_tri: string // cho phép empty string ''
  ngay_tai_kham: string      // cho phép empty string '' (không phải optional/nullable — là string)
  co_the_sua: boolean        // true: < 24h kể từ ngay_tao; false: đã khóa
  thuoc: PrescriptionDrug[]  // có thể là mảng rỗng [] nếu không kê đơn
  ngay_tao: string           // ISO datetime — dùng để tính 24h lock
}
```

> `ngay_tai_kham` là `string` (không phải `string | null` hay optional), nhưng form cho phép để trống (lưu là `''`). Backend không validate required.

### 5.3 `PrescriptionDrug` — (`types/index.ts`)

```ts
export interface PrescriptionDrug {
  id: number
  ten_thuoc: string   // bắt buộc — không được để trống
  lieu_dung: string   // VD: "1 viên/lần"
  tan_suat: string    // VD: "3 lần/ngày"
  so_ngay: number     // ≥ 1
  ghi_chu: string     // cho phép empty string ''
}
```

---

## 6. Cấu trúc UI hiện tại (`DoctorAppointments.tsx`)

### 6.1 Layout tổng thể

```
┌──────────────────────────────────────────────────────────────────┐
│  PageHeader: "Lịch hẹn của tôi"                                  │
├──────────────────────────────────────────────────────────────────┤
│  [Hôm nay (3)] [Sắp tới (4)] [Đã qua (5)] [Tất cả (12)]        │  ← Tabs (React state — KHÔNG dùng URL param)
├──────────────────────────────────────────────────────────────────┤
│  Filter: [Tất cả trạng thái ▼]                                   │  ← Status dropdown
├──────────────────────────────────────────────────────────────────┤
│  Bệnh nhân  │  Ngày / Giờ  │  Hình thức  │  TT  │  Phí  │  ⚙   │
│  ──────────────────────────────────────────────────────────────  │
│  ▶ Nguyễn Văn An  │ 17/6 07:30 │ Phòng khám │ 🟡  │ 350k  │ [Xác nhận][Từ chối]  │
│  ▼ expanded: SĐT · tuổi/giới · dị ứng(🔴) · bệnh nền · lý do  │
│  ▶ Trần Thị Bình  │ 17/6 08:00 │ Phòng khám │ 🔵  │ 350k  │ [Hoàn thành][Kết quả] │
│  ▶ Đặng Văn Quân  │ 15/6 08:00 │ Tại nhà    │ 🟢  │ 350k  │ [Xem kết quả ▣]       │
└──────────────────────────────────────────────────────────────────┘
```

**Lưu ý:** Tab được quản lý bằng `useState<Tab>('today')` — **không** đọc URL query param. Link từ dashboard đến trang này không được thêm `?tab=today`.

### 6.2 Modals

**RejectModal** — Từ chối lịch hẹn:
- Textarea nhập lý do (bắt buộc, `trim()` validation)
- Nút "Xác nhận từ chối" disabled khi `ly_do.trim() === ''`
- Nút "Hủy" đóng modal, không thay đổi dữ liệu

**ExamModal** — Kết quả khám:
- Header: `{benh_nhan} · {formatDate(ngay_kham)} {gio_kham}`
- Chẩn đoán (required, `<textarea>`)
- Hướng dẫn điều trị (optional)
- Ngày tái khám (optional `<input type="date">`)
- Đơn thuốc: dynamic list, tối thiểu 1 row, nút xóa chỉ hiện khi ≥ 2 thuốc
- Banner vàng khi `co_the_sua = false`: "Kết quả đã được lưu trên 24 giờ — không thể chỉnh sửa"
- Khi `isReadOnly = true`: tất cả input `readOnly`, chỉ còn nút "Đóng"
- Khi `isReadOnly = false`: nút "Đóng" + "Lưu kết quả" (mới) / "Cập nhật" (đã có)

---

## 7. Service Layer

### 7.1 `doctorAppointmentService` (`services/doctor-appointment.service.ts`)

| Hàm | Method + Endpoint (MongoDB) | Mô tả | Trả về |
|---|---|---|---|
| `getAll({ tab, status })` | `GET /api/doctor/appointments?tab=&status=` | Lấy danh sách, lọc theo tab + status | `DoctorAppointmentDetail[]` |
| `confirm(id)` | `PATCH /api/doctor/appointments/:id/confirm` | `pending → confirmed`. Validate: `payment_status = 'paid'` | `DoctorAppointmentDetail` |
| `reject(id, ly_do)` | `PATCH /api/doctor/appointments/:id/reject` | `pending → cancelled`. Body: `{ ly_do }`. Update cả `payment_status → refunded` | `DoctorAppointmentDetail` |
| `complete(id)` | `PATCH /api/doctor/appointments/:id/complete` | `confirmed → completed`. **Không** set `da_co_ket_qua: true` ở đây | `DoctorAppointmentDetail` |
| `cancelConfirmed(id, ly_do)` **[gap]** | `PATCH /api/doctor/appointments/:id/cancel` | `confirmed → cancelled`. 100% refund. Cần thêm vào service | `DoctorAppointmentDetail` |

> ⚠️ **Bug mock cần fix:** `complete()` hiện đang set `da_co_ket_qua: true` — phải sửa lại thành không thay đổi `da_co_ket_qua` (giữ nguyên `false`).

### 7.2 `examinationService` (`services/examination.service.ts`)

| Hàm | Method + Endpoint (MongoDB) | Mô tả | Trả về |
|---|---|---|---|
| `getByAppointment(id)` | `GET /api/doctor/examination/:appointment_id` | Trả null nếu chưa có | `ExaminationResult \| null` |
| `save(payload)` | `POST /api/doctor/examination` | Upsert. Validate: `co_the_sua = true` nếu đã tồn tại. **Set `da_co_ket_qua = true`** trên `appointments` sau khi save thành công | `ExaminationResult` |

> `save()` phải: (1) upsert examination_result, (2) set `appointments.da_co_ket_qua = true`, (3) tạo `medical_record` + `prescriptions` + `reminders` — tất cả trong 1 MongoDB session/transaction.

---

## 8. Gaps hiện tại & Đề xuất nâng cấp

### 8.1 Đã có (implemented ✅)

- [x] 4 tabs: Hôm nay / Sắp tới / Đã qua / Tất cả với badge count
- [x] Filter theo status (`dropdown`)
- [x] Expandable row xem thông tin bệnh nhân
- [x] Xác nhận lịch hẹn (`pending → confirmed`)
- [x] Từ chối với lý do (`pending → cancelled`, modal validate)
- [x] Đánh dấu hoàn thành (`confirmed → completed`)
- [x] Nhập/chỉnh sửa kết quả khám (ExamModal)
- [x] 24h lock cho kết quả khám (`co_the_sua`)
- [x] Đơn thuốc (thêm/xóa dynamic)

### 8.2 Bugs cần fix trước khi gắn DB

| Bug | File | Mô tả |
|---|---|---|
| `confirm` không check `payment_status` | `DoctorAppointments.tsx` | Hiện nút Xác nhận cho cả `unpaid` appointments |
| `complete()` set `da_co_ket_qua: true` ngay | `doctor-appointment.service.ts` | Phải để `false`; chỉ set `true` khi save exam |

### 8.3 Chưa có (gap — cần thêm)

| Gap | Ưu tiên | Mô tả |
|---|---|---|
| Tìm kiếm theo tên bệnh nhân | 🔴 Cao | Search input realtime filter trên tất cả tabs |
| Badge "Hết hạn" + disable confirm khi `ngay_kham < today` | 🔴 Cao | Lịch pending đã qua ngày không thể confirm |
| Bác sĩ hủy lịch đã `confirmed` | 🟡 Trung | Nút "Hủy" + modal lý do + 100% refund |
| Pill cảnh báo urgent | 🟡 Trung | Banner "X lịch hôm nay chưa xác nhận" |
| Date range picker | 🟢 Thấp | Filter theo khoảng ngày tuỳ chỉnh |
| Export kết quả khám | 🟢 Thấp | In / tải PDF đơn thuốc |

---

## 9. Test Cases (Tester Perspective)

> **Môi trường:** Mock data mode (frontend-first)
> **Cách chạy:** Đăng nhập với role `doctor`, vào `/doctor/appointments`
> **Mức độ:** P0 = blocker · P1 = cao · P2 = trung · P3 = thấp

---

### 9.1 TC-VIEW — Hiển thị & Navigation

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-V01 | Tab "Hôm nay" active mặc định | Truy cập `/doctor/appointments` | Tab "Hôm nay" active, chỉ hiện lịch `ngay_kham = today` | P0 |
| TC-V02 | Badge count tab chính xác | Mock: 4 lịch hôm nay, 2 sắp tới, 3 đã qua | Badge khớp số thực tế từng tab (không bị ảnh hưởng bởi status filter) | P0 |
| TC-V03 | Tab "Sắp tới" đúng | Click "Sắp tới" | Chỉ hiện `ngay_kham > today`, sort ngày tăng dần | P0 |
| TC-V04 | Tab "Đã qua" đúng | Click "Đã qua" | Chỉ hiện `ngay_kham < today`, sort ngày giảm dần | P0 |
| TC-V05 | Tab "Tất cả" hiện toàn bộ | Click "Tất cả" | Tất cả lịch không phân loại ngày | P1 |
| TC-V06 | Filter status hoạt động | Chọn "Chờ xác nhận" | Chỉ hiện `status = 'pending'` trong tab hiện tại | P0 |
| TC-V07 | Tab + filter kết hợp | Tab "Hôm nay" + filter "Đã xác nhận" | Giao của 2 điều kiện: lịch hôm nay VÀ confirmed | P0 |
| TC-V08 | Expand row chi tiết | Click vào row | Sub-row mở với SĐT, tuổi/giới, dị ứng, bệnh nền, lý do khám | P0 |
| TC-V09 | Click lại row để collapse | Click row đang expand | Sub-row đóng | P1 |
| TC-V10 | Dị ứng màu đỏ nổi bật | Bệnh nhân `di_ung = 'Penicillin'` | Hiện `text-red-600 font-medium`, không dùng màu bình thường | P0 |
| TC-V11 | Field null không render | `di_ung = null`, `benh_nen = null` | Field "Dị ứng" và "Bệnh nền" không xuất hiện | P1 |
| TC-V12 | Empty state | Không có lịch trong tab/filter | Icon calendar + "Không có lịch hẹn nào" | P1 |
| TC-V13 | Loading state | Mock delay | Spinner/text "Đang tải..." thay vì table rỗng | P2 |
| TC-V14 | Lịch sort đúng thứ tự | Nhiều lịch cùng ngày khác giờ | Sort `ngay_kham ASC` rồi `gio_kham ASC` | P1 |

---

### 9.2 TC-CONFIRM — Xác nhận lịch hẹn

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-C01 | Xác nhận — happy path | `status='pending'`, `payment_status='paid'` | Badge → "Đã xác nhận" (xanh dương), nút đổi sang "Hoàn thành" + "Kết quả" | P0 |
| TC-C02 | Không confirm khi chưa thanh toán | `status='pending'`, `payment_status='unpaid'` | Nút "Xác nhận" không xuất hiện, chỉ có "Từ chối" *(fix bug hiện tại)* | P0 |
| TC-C03 | Confirmed không có nút Xác nhận | `status='confirmed'` | Không hiện nút "Xác nhận" | P0 |
| TC-C04 | Completed không có nút Xác nhận | `status='completed'` | Không hiện nút "Xác nhận" | P0 |
| TC-C05 | Cancelled không có nút nào | `status='cancelled'` | Không có nút thao tác | P0 |

---

### 9.3 TC-REJECT — Từ chối lịch hẹn

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-R01 | Từ chối — happy path | Click "Từ chối" → nhập lý do → Xác nhận | Modal đóng, badge → "Đã hủy" (đỏ), lý do hiện trong expanded row | P0 |
| TC-R02 | Submit khi lý do trống | Textarea rỗng → click Xác nhận | Nút disabled, không submit | P0 |
| TC-R03 | Lý do chỉ khoảng trắng | Nhập `"   "` | Nút disabled (trim validation) | P1 |
| TC-R04 | Đóng modal không lưu | Click "Hủy" | Modal đóng, lịch hẹn không đổi | P1 |
| TC-R05 | Confirmed không có nút Từ chối | `status='confirmed'` | Nút "Từ chối" không xuất hiện | P0 |
| TC-R06 | Lý do hủy chứa ký tự đặc biệt | `ly_do = '<script>alert(1)</script>'` | Hiện text thuần (XSS không thực thi) | P0 |

---

### 9.4 TC-COMPLETE — Hoàn thành lịch hẹn

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-CO01 | Hoàn thành — happy path | `status='confirmed'` → click "Hoàn thành" | Badge → "Hoàn thành" (xanh lá); nút đổi sang icon edit + "Nhập kết quả" *(sau khi fix bug `da_co_ket_qua`)* | P0 |
| TC-CO02 | Pending không có nút Hoàn thành | `status='pending'` | Không hiện nút "Hoàn thành" | P0 |
| TC-CO03 | `da_co_ket_qua` sau complete | Sau click Hoàn thành | `da_co_ket_qua = false` → nút hiện icon edit + "Nhập kết quả" *(hiện tại mock sai, cần fix)* | P1 |

---

### 9.5 TC-CANCEL-CONFIRMED — Bác sĩ hủy lịch đã confirmed *(gap feature)*

> Test cases này chỉ áp dụng sau khi implement gap "bác sĩ hủy confirmed"

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-CC01 | Hủy confirmed — happy path | `status='confirmed'` → click "Hủy" → nhập lý do | Modal đóng, badge → "Đã hủy", `payment_status → 'refunded'` | P0 |
| TC-CC02 | Bắt buộc nhập lý do | Textarea hủy rỗng | Nút Xác nhận disabled | P0 |
| TC-CC03 | Hoàn 100% bất kể thời điểm | Hủy lịch 30 phút trước giờ khám | `payment_status → 'refunded'` (100%, không theo bảng thời gian) | P0 |

---

### 9.6 TC-EXAM — Ghi kết quả khám (B4)

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-E01 | Mở modal lần đầu (chưa có kết quả) | `completed`, `da_co_ket_qua=false` | Modal mở, form rỗng, editable | P0 |
| TC-E02 | Lưu kết quả — happy path | Nhập chẩn đoán → Lưu | Modal đóng; nút → icon eye + "Xem kết quả"; `da_co_ket_qua=true` | P0 |
| TC-E03 | Submit thiếu chẩn đoán | Form submit khi `chan_doan` trống | HTML5 `required` validation, không submit | P0 |
| TC-E04 | Mở modal đã có kết quả, < 24h | `co_the_sua=true` | Form có sẵn data, tất cả input editable, nút "Cập nhật" | P0 |
| TC-E05 | Cập nhật trong 24h | Sửa chẩn đoán → Cập nhật | Data mới được lưu | P0 |
| TC-E06 | Read-only sau 24h | `co_the_sua=false` | Banner vàng, tất cả input `readOnly`, chỉ nút "Đóng" | P0 |
| TC-E07 | Đóng modal không lưu | Click "Đóng" | Modal đóng, không thay đổi | P1 |
| TC-E08 | Thêm thuốc | Click "Thêm thuốc" | Row mới với default `tan_suat='2 lần/ngày'`, `so_ngay=7` | P1 |
| TC-E09 | Xóa thuốc | Click xóa khi ≥ 2 thuốc | Thuốc bị xóa khỏi list | P1 |
| TC-E10 | Không xóa khi chỉ còn 1 | Chỉ còn 1 thuốc | Nút xóa không xuất hiện (không phải disabled) | P1 |
| TC-E11 | Mở từ confirmed (chuẩn bị trước) | `status='confirmed'` → click "Kết quả" | Modal mở, form editable (không có exam result trước) | P1 |
| TC-E12 | Cancelled không mở được modal | `status='cancelled'` | Không có nút nào trigger modal | P0 |
| TC-E13 | Header modal đúng | Mở bất kỳ | Header hiện `{benh_nhan} · {formatDate(ngay_kham)} {gio_kham}` | P2 |
| TC-E14 | Ngày tái khám optional | Để trống `ngay_tai_kham` → Lưu | Lưu thành công, `ngay_tai_kham = ''` | P1 |
| TC-E15 | Thuốc mảng rỗng | Xóa tất cả thuốc (chỉ còn 1 tối thiểu) | Không thể xóa thuốc cuối cùng | P1 |

---

### 9.7 TC-EDGE — Edge Cases & Negative Tests

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-EDG01 | Không có lịch nào | Mock rỗng | Empty state toàn trang | P1 |
| TC-EDG02 | Tab hôm nay = 0 lịch | Không có lịch ngày hôm nay | Badge = 0, empty state | P1 |
| TC-EDG03 | Tên bệnh nhân rất dài | Tên ≥ 40 ký tự | Truncate, không vỡ layout table | P2 |
| TC-EDG04 | `gia_kham = 0` | Khám miễn phí | Hiện "0 ₫", cột không ẩn | P2 |
| TC-EDG05 | Click nhanh xác nhận 2 lần | Double-click "Xác nhận" | Chỉ 1 request gửi đi (disabled sau click) | P1 |
| TC-EDG06 | Bác sĩ xem lịch người khác | Gửi request với `id` không thuộc mình | Backend 403 Forbidden | P0 |
| TC-EDG07 | Race condition confirm/reject | 2 tab confirm + reject cùng appointment cùng lúc | Chỉ 1 thành công, 1 báo lỗi "Lịch hẹn đã thay đổi" | P1 |
| TC-EDG08 | Filter reset khi đổi tab | Chọn filter "Completed" → đổi sang tab "Sắp tới" | Filter giữ nguyên (không auto-reset) | P2 |
| TC-EDG09 | Lịch pending đã qua ngày | `ngay_kham < today`, `status='pending'` | Badge "Hết hạn" hiện; nút Xác nhận ẩn, chỉ còn Từ chối *(gap feature)* | P1 |

---

### 9.8 TC-INTEGRATION — Integration Tests (áp dụng khi gắn MongoDB)

> Các test này không chạy được với mock data — chỉ áp dụng sau khi kết nối backend thật.

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-INT01 | Confirm → notification bệnh nhân | Bác sĩ xác nhận | `notifications` record tạo cho `user_id` bệnh nhân | P0 |
| TC-INT02 | Reject → email kèm lý do | Bác sĩ từ chối | Nodemailer gửi email, `subject` có tên bác sĩ, `body` có `ly_do` | P0 |
| TC-INT03 | Reject → payment refunded | `payment_status = 'paid'` → reject | `payments.status = 'refunded'` trong DB | P0 |
| TC-INT04 | Complete → DB status | Click Hoàn thành | `appointments.status = 'completed'` trong DB; `da_co_ket_qua` vẫn `false` | P0 |
| TC-INT05 | Save exam → `da_co_ket_qua = true` | `examinationService.save()` | `appointments.da_co_ket_qua = true` trong DB | P0 |
| TC-INT06 | Save exam → `medical_record` tự tạo | Lưu kết quả khám | `medical_records` row mới cho `member_id` bệnh nhân (loại `tu_kham`) | P0 |
| TC-INT07 | Save exam → reminders | Kê đơn có thuốc uống 3 lần/ngày | `reminders` rows tạo đủ theo `so_ngay × 3` | P0 |
| TC-INT08 | Cron 24h lock | Exam tạo lúc T, chạy cron T+24h | `examination_results.co_the_sua = false` trong DB | P1 |
| TC-INT09 | Doctor isolation | Bác sĩ A và B đăng nhập riêng | Mỗi người chỉ thấy lịch của `doctor_id = own_id` | P0 |
| TC-INT10 | Race condition confirm | 2 request confirm cùng appointment | Chỉ 1 thành công (HTTP 200), 1 trả HTTP 409 Conflict | P1 |
| TC-INT11 | Slot expire sau complete | Lịch confirmed → complete | `slots.status = 'expired'` trong DB | P1 |

---

## 10. Tóm tắt Nghiệp vụ Không được Sai

> Sai một quy tắc nào dưới đây = **critical bug**, phải fix ngay.

| # | Quy tắc | Hậu quả nếu sai |
|---|---|---|
| 1 | Bác sĩ chỉ thấy lịch của chính mình — filter `doctor_id` ở backend | Lộ dữ liệu bệnh nhân người khác |
| 2 | Không confirm lịch `payment_status = 'unpaid'` | Bác sĩ khám mà không nhận được tiền |
| 3 | Bác sĩ hủy → hoàn 100% bất kể thời điểm | Bệnh nhân bị thiệt khi bác sĩ hủy giờ cuối |
| 4 | `co_the_sua` check ở cả frontend VÀ backend | Frontend check = UX; backend check = security. Thiếu backend = hack được |
| 5 | `da_co_ket_qua` chỉ set `true` khi `save()` exam thành công | Set sớm → bệnh nhân thấy "có kết quả" nhưng DB trống |
| 6 | `payment_status → refunded` khi hủy, trong cùng transaction | Mất tiền bệnh nhân nếu appointment cancel nhưng payment không update |
| 7 | Dị ứng màu đỏ nổi bật | Bác sĩ bỏ sót → kê thuốc gây phản ứng nguy hiểm |
| 8 | `cancelled` / `completed` là trạng thái cuối | Đảo ngược = hồ sơ y tế sai, kế toán sai |
| 9 | XSS escape lý do từ chối + ghi chú thuốc | Script injection qua text input |
| 10 | Race condition confirm/reject phải có lock | 2 bác sĩ (edge case admin system) confirm cùng 1 lịch |

---

## 11. Sơ đồ luồng người dùng (User Journey)

```
Bác sĩ vào /doctor/appointments
          │
          ├─ Tab mặc định: HÔM NAY
          │     │
          │     ├─ Lịch PENDING (paid)
          │     │     ├──► [Xác nhận] ──────────────────────────► CONFIRMED
          │     │     └──► [Từ chối] → modal lý do ────────────► CANCELLED
          │     │
          │     ├─ Lịch PENDING (unpaid)
          │     │     └──► [Từ chối] → modal lý do ────────────► CANCELLED
          │     │
          │     └─ Lịch CONFIRMED
          │           ├──► [Hoàn thành] ────────────────────────► COMPLETED
          │           │         └─── mở ExamModal để nhập kết quả
          │           └──► [Kết quả] → ExamModal (chuẩn bị trước khi khám)
          │
          ├─ Tab SẮP TỚI ──► xem danh sách, chuẩn bị trước
          │
          └─ Tab ĐÃ QUA
                ├─ COMPLETED, da_co_ket_qua=false ──► [Nhập kết quả] → ExamModal
                ├─ COMPLETED, da_co_ket_qua=true, co_the_sua=true  ──► [Xem kết quả] (editable)
                └─ COMPLETED, da_co_ket_qua=true, co_the_sua=false ──► [Xem kết quả] (readonly)
```
