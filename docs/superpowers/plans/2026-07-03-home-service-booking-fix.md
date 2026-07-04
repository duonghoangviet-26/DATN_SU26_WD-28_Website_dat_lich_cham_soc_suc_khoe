# Hoàn thiện luồng đặt lịch Home Service (theo spec 2026-07-02) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa luồng đặt lịch + quản lý lịch hẹn `loai_kham='home'` (dịch vụ lấy mẫu xét nghiệm tại nhà) để khớp với quyết định thiết kế đã chốt trong `docs/superpowers/specs/2026-07-02-home-service-redesign.md`.

**Bối cảnh quan trọng (đã audit code hiện tại trước khi viết plan này):**
Phần lớn checklist trong spec 2026-07-02 đã được implement ở phiên làm việc trước (mục 1–3, 4–5 của checklist mục 5 trong spec): `BacSi.loai`, `LichHen.doctor_id` nullable + `ket_qua_url`, `DichVu` mặc định `status='inactive'`, `ket_qua_url` đã có trong `frontend/src/types/index.ts`. Frontend A5 (trang đặt lịch bệnh nhân) **chưa tồn tại** trong codebase (chỉ có `frontend/src/pages/client/Home.tsx`) nên các mục FE trong checklist spec (bỏ chọn BS, thêm chọn khu vực, section "Dịch vụ liên quan") **không áp dụng được** — không có gì để sửa. Plan này chỉ còn 3 việc thật sự chưa làm, đều ở backend:

1. `booking.controller.js → createBooking()` vẫn bắt buộc `doctor_id` cho CẢ home lẫn clinic — sai theo spec (home không chọn bác sĩ, CSKH gán nhân viên sau).
2. Không có action nào để CSKH/Admin gán nhân viên lấy mẫu (`assignHomeStaff`) cho lịch home.
3. Không có endpoint nào để CSKH điền `ket_qua_url` + gửi thông báo cho bệnh nhân khi có kết quả.

**Architecture:** Sửa trực tiếp 3 file backend hiện có (`booking.controller.js`, `admin/appointments.controller.js`, `admin/appointments.routes.js`). Không tạo file mới, không đổi schema (không thêm field `khu_vuc` vào `LichHen` — dùng để validate rồi bỏ, không persist, đúng như spec mục 2.4 chỉ liệt kê 2 thay đổi cho `LichHen`).

**Tech Stack:** Node.js + Express 4, Mongoose, JavaScript (ESM).

## Global Constraints

- Comment tiếng Việt cho logic phức tạp (CLAUDE.md).
- Không có test framework trong `backend/` (chỉ `node_modules` có test riêng của dependency) → verify bằng cách chạy dev server + gọi API thủ công (curl/Postman), không viết unit test.
- **KHÔNG tự ý `git commit`/`git push`** — theo yêu cầu người dùng (giáo viên xem git history, AI commit sẽ bị phát hiện). Sau khi implement xong từng task, dừng lại để user tự review và commit.
- Giữ nguyên convention response `{ success, message, data }` qua `utils/response.js` (`ok`, `created`, `fail`).
- Response format lỗi: `fail(res, statusCode, message)`.

---

## Task 1: Sửa `createBooking()` — home không còn bắt buộc chọn bác sĩ

**Files:**
- Modify: `backend/src/controllers/patient/booking.controller.js:156-269`

**Interfaces:**
- Consumes: `DichVu` (đã có field `khu_vuc: string[]`), `BacSi`, `LichHen`, `LichLamViec`, `GiaDinh`, `ThanhVien` — import sẵn ở đầu file, không đổi.
- Produces: `POST /api/patient/booking` — body cho `loai_kham='home'` giờ nhận thêm `khu_vuc: string` (bắt buộc), không còn nhận/dùng `doctor_id`. Response giữ nguyên shape cũ.

- [ ] **Step 1: Đọc lại đúng đoạn code cần sửa để xác nhận vị trí**

Đoạn hiện tại (dòng 156–269) có cấu trúc:
```js
export async function createBooking(req, res) {
  try {
    const {
      loai_kham, doctor_id,
      schedule_id, slot_id,
      service_id, dia_chi_kham, gio_kham,
      ngay_kham, ly_do_kham,
      member_id, ten_khach, so_dien_thoai_khach, nam_sinh_khach,
    } = req.body

    if (!loai_kham)  return fail(res, 400, 'Loại khám là bắt buộc')
    if (!doctor_id)  return fail(res, 400, 'Bác sĩ là bắt buộc')
    if (!ngay_kham)  return fail(res, 400, 'Ngày khám là bắt buộc')
    if (!member_id && !ten_khach) return fail(res, 400, 'Phải có member_id hoặc ten_khach')

    const doc = await BacSi.findOne({ _id: doctor_id, trang_thai_duyet: 'approved', la_hien: true })
      .populate('specialties', 'ten')
      .lean()
    if (!doc) return fail(res, 404, 'Bác sĩ không tồn tại hoặc chưa được duyệt')
    ...
```

**Vấn đề:** `doctor_id` bị validate + query bắt buộc trước khi biết `loai_kham` là gì. Với `home`, không có `doctor_id` gửi lên → luôn trả 400, không bao giờ tới được nhánh xử lý home phía dưới.

- [ ] **Step 2: Viết lại toàn bộ hàm `createBooking`**

Thay thế toàn bộ nội dung hàm (dòng 156–269) bằng:

```js
// ─── POST /api/patient/booking ───────────────────────────────────────────────
export async function createBooking(req, res) {
  try {
    const {
      loai_kham, doctor_id,
      schedule_id, slot_id,
      service_id, khu_vuc, dia_chi_kham, gio_kham,
      ngay_kham, ly_do_kham,
      member_id, ten_khach, so_dien_thoai_khach, nam_sinh_khach,
    } = req.body

    if (!loai_kham)  return fail(res, 400, 'Loại khám là bắt buộc')
    if (!['clinic', 'home'].includes(loai_kham)) return fail(res, 400, 'loai_kham phải là clinic hoặc home')
    if (!ngay_kham)  return fail(res, 400, 'Ngày khám là bắt buộc')
    if (!member_id && !ten_khach) return fail(res, 400, 'Phải có member_id hoặc ten_khach')

    // clinic: bắt buộc chọn bác sĩ cụ thể. home: KHÔNG chọn bác sĩ lúc đặt —
    // đây là dịch vụ lấy mẫu xét nghiệm tại nhà, CSKH gán nhân viên sau khi thanh toán
    // (xem docs/superpowers/specs/2026-07-02-home-service-redesign.md mục 2.5).
    let doc = null
    if (loai_kham === 'clinic') {
      if (!doctor_id) return fail(res, 400, 'Bác sĩ là bắt buộc')
      doc = await BacSi.findOne({ _id: doctor_id, trang_thai_duyet: 'approved', la_hien: true })
        .populate('specialties', 'ten')
        .lean()
      if (!doc) return fail(res, 404, 'Bác sĩ không tồn tại hoặc chưa được duyệt')
    }

    // Verify member thuộc family của user
    if (member_id) {
      const family = await GiaDinh.findOne({ user_id: req.user.id }).select('_id').lean()
      if (!family) return fail(res, 404, 'Chưa có nhóm gia đình')
      const member = await ThanhVien.findOne({ _id: member_id, family_id: family._id, ngay_xoa: null }).lean()
      if (!member) return fail(res, 404, 'Không tìm thấy thành viên trong gia đình')
    }

    let gia_kham, ten_dich_vu, phong_kham = null, gio_dat

    if (loai_kham === 'clinic') {
      if (!schedule_id || !slot_id) {
        return fail(res, 400, 'Khám tại phòng khám yêu cầu schedule_id và slot_id')
      }

      // Atomic claim slot để tránh double-booking
      const updated = await LichLamViec.findOneAndUpdate(
        {
          _id:                  schedule_id,
          doctor_id:            doc._id,
          'slots._id':          slot_id,
          'slots.status':       'active',
          'slots.benh_nhan_id': null,
        },
        { $set: { 'slots.$.status': 'booked', 'slots.$.benh_nhan_id': req.user.id } },
        { new: true },
      )
      if (!updated) return fail(res, 409, 'Slot đã được đặt, vui lòng chọn khung giờ khác')

      const claimedSlot = updated.slots.id(slot_id)
      phong_kham = claimedSlot.phong_kham
      gio_dat    = claimedSlot.gio_bat_dau
      gia_kham   = doc.gia_kham
      ten_dich_vu = doc.specialties?.[0]?.ten ?? 'Khám tổng quát'

    } else {
      // home — dịch vụ lấy mẫu xét nghiệm tại nhà, không chọn bác sĩ, chọn khu vực + giờ tự do
      if (!service_id)          return fail(res, 400, 'Khám tại nhà yêu cầu service_id')
      if (!khu_vuc?.trim())     return fail(res, 400, 'Khu vực là bắt buộc')
      if (!dia_chi_kham?.trim()) return fail(res, 400, 'Địa chỉ khám là bắt buộc')
      if (!gio_kham)             return fail(res, 400, 'Giờ khám là bắt buộc')

      const service = await DichVu.findOne({ _id: service_id, loai: 'home', status: 'active' }).lean()
      if (!service) return fail(res, 404, 'Dịch vụ không tồn tại')

      if (service.khu_vuc?.length && !service.khu_vuc.includes(khu_vuc.trim())) {
        return fail(res, 400, 'Dịch vụ này không hỗ trợ khu vực đã chọn')
      }

      gia_kham    = service.gia
      ten_dich_vu = service.ten
      gio_dat     = gio_kham
    }

    // Thanh toán ngay khi đặt cho cả 2 loại — clinic auto-confirm, home giá cố định nên
    // thanh toán trước an toàn (quyết định 2026-07-02, xem spec mục 2.1/2.5). doctor_id=null
    // cho home — CSKH gán nhân viên lấy mẫu sau qua PATCH /api/admin/appointments/:id/assign-home-staff.
    const appointment = await LichHen.create({
      user_id:      req.user.id,
      member_id:    member_id    || null,
      doctor_id:    loai_kham === 'clinic' ? doc._id : null,
      schedule_id:  loai_kham === 'clinic' ? schedule_id  : null,
      slot_id:      loai_kham === 'clinic' ? slot_id      : null,
      service_id:   loai_kham === 'home'   ? service_id   : null,
      loai_kham,
      ngay_kham:    new Date(ngay_kham),
      gio_kham:     gio_dat,
      ly_do_kham:   ly_do_kham?.trim() || null,
      phong_kham:   loai_kham === 'clinic' ? phong_kham   : null,
      dia_chi_kham: loai_kham === 'home'   ? dia_chi_kham.trim() : null,
      status:         loai_kham === 'clinic' ? 'confirmed' : 'pending',
      payment_status: 'paid',
      gia_kham,
      ten_dich_vu,
      ten_khach:           ten_khach           || null,
      so_dien_thoai_khach: so_dien_thoai_khach || null,
      nam_sinh_khach:      nam_sinh_khach       || null,
    })

    return created(res, {
      id:             appointment._id,
      status:         appointment.status,
      payment_status: appointment.payment_status,
      gia_kham:       appointment.gia_kham,
      ten_dich_vu:    appointment.ten_dich_vu,
      ngay_kham:      appointment.ngay_kham,
      gio_kham:       appointment.gio_kham,
    }, loai_kham === 'clinic'
      ? 'Đặt lịch thành công, lịch hẹn đã được xác nhận'
      : 'Đặt lịch và thanh toán thành công, chúng tôi sẽ liên hệ xác nhận lịch lấy mẫu')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
```

**Lưu ý khi áp dụng Edit:** đây là thay thế nguyên khối hàm `createBooking` — dùng `old_string` là toàn bộ thân hàm gốc (từ `// ─── POST /api/patient/booking ───` tới dấu `}` đóng hàm ở cuối, trước `// ─── PATCH /api/patient/booking/:id/cancel ───`).

- [ ] **Step 3: Verify thủ công — clinic flow không đổi hành vi**

Chạy backend dev server (`cd backend && npm run dev` hoặc lệnh tương ứng trong `backend/package.json`), dùng token bệnh nhân hợp lệ, gọi:

```
POST /api/patient/booking
{
  "loai_kham": "clinic",
  "doctor_id": "<id bác sĩ approved>",
  "schedule_id": "<id lịch làm việc>",
  "slot_id": "<id slot active>",
  "ngay_kham": "2026-07-10",
  "member_id": null,
  "ten_khach": "Nguyễn Văn A"
}
```

Kỳ vọng: `201`, `data.status = "confirmed"`, `data.payment_status = "paid"` — giống hệt hành vi trước khi sửa (không có regression).

- [ ] **Step 4: Verify thủ công — home flow mới**

```
POST /api/patient/booking
{
  "loai_kham": "home",
  "service_id": "<id dịch vụ loai='home', status='active'>",
  "khu_vuc": "<1 giá trị nằm trong DichVu.khu_vuc của service trên>",
  "dia_chi_kham": "123 Đường ABC, Cầu Giấy, Hà Nội",
  "gio_kham": "09:00",
  "ngay_kham": "2026-07-10",
  "member_id": null,
  "ten_khach": "Nguyễn Văn B"
}
```

Kỳ vọng: `201`, KHÔNG cần gửi `doctor_id`, `data.status = "pending"`, `data.payment_status = "paid"`. Kiểm tra trong DB (`db.lich_hen.findOne(...)`): `doctor_id = null`.

Gọi lại với `khu_vuc` KHÔNG nằm trong `service.khu_vuc` → kỳ vọng `400 "Dịch vụ này không hỗ trợ khu vực đã chọn"`.

- [ ] **Step 5: Dừng lại, để user tự review diff và commit** (không tự `git commit` — xem Global Constraints)

---

## Task 2: Thêm `assignHomeStaff()` — CSKH gán nhân viên lấy mẫu

**Files:**
- Modify: `backend/src/controllers/admin/appointments.controller.js:1-2` (import) và cuối file (thêm hàm mới)
- Modify: `backend/src/routes/admin/appointments.routes.js`

**Interfaces:**
- Consumes: `LichHen`, `BacSi` — `BacSi` đã import sẵn ở dòng 1 của `appointments.controller.js`. Cần thêm `mongoose` để validate ObjectId.
- Produces: `PATCH /api/admin/appointments/:id/assign-home-staff` — body `{ staff_id: string }` → response `{ id, doctor_id, status }`.

- [ ] **Step 1: Thêm import `mongoose` vào đầu `admin/appointments.controller.js`**

Dòng 1 hiện tại:
```js
import { LichHen, NguoiDung, BacSi, LichLamViec } from '../../models/index.js'
```

Sửa thành:
```js
import mongoose from 'mongoose'
import { LichHen, NguoiDung, BacSi, LichLamViec, ThongBao } from '../../models/index.js'
```

(Thêm luôn `ThongBao` vì Task 3 cũng cần — tránh sửa import 2 lần.)

- [ ] **Step 2: Thêm hàm `assignHomeStaff` vào cuối file, sau hàm `complete()`**

Nội dung thêm vào cuối `backend/src/controllers/admin/appointments.controller.js` (sau dấu `}` đóng hàm `complete`, trước dòng cuối file):

```js

// ─── PATCH /api/admin/appointments/:id/assign-home-staff ───────────────────
// CSKH gán nhân viên lấy mẫu (BacSi.loai='home_staff') cho lịch home đang chờ xử lý.
// Chuyển status 'pending' → 'confirmed'. Không đổi payment_status (đã 'paid' từ lúc đặt,
// xem docs/superpowers/specs/2026-07-02-home-service-redesign.md mục 2.5).
export async function assignHomeStaff(req, res) {
  try {
    const { staff_id } = req.body
    if (!staff_id || !mongoose.Types.ObjectId.isValid(staff_id)) {
      return fail(res, 400, 'staff_id là bắt buộc và phải hợp lệ')
    }

    const a = await LichHen.findById(req.params.id)
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (a.loai_kham !== 'home') return fail(res, 409, 'Chỉ gán nhân viên cho lịch khám tại nhà')
    if (a.status !== 'pending') return fail(res, 409, 'Chỉ gán nhân viên cho lịch đang chờ xử lý')

    const staff = await BacSi.findOne({
      _id: staff_id, loai: 'home_staff', trang_thai_duyet: 'approved', la_hien: true,
    }).lean()
    if (!staff) return fail(res, 404, 'Không tìm thấy nhân viên lấy mẫu hợp lệ')

    a.doctor_id = staff._id
    a.status    = 'confirmed'
    await a.save()

    return ok(res, { id: a._id, doctor_id: a.doctor_id, status: a.status }, 'Đã gán nhân viên lấy mẫu')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
```

- [ ] **Step 3: Đăng ký route trong `backend/src/routes/admin/appointments.routes.js`**

File hiện tại:
```js
router.get('/',              appointments.list)
router.get('/:id',           appointments.getById)
router.patch('/:id/cancel',  appointments.cancel)
router.patch('/:id/complete', appointments.complete)

export default router
```

Thêm dòng route mới trước `export default router`:
```js
router.get('/',              appointments.list)
router.get('/:id',           appointments.getById)
router.patch('/:id/cancel',  appointments.cancel)
router.patch('/:id/complete', appointments.complete)
router.patch('/:id/assign-home-staff', appointments.assignHomeStaff)

export default router
```

- [ ] **Step 4: Verify thủ công**

Chuẩn bị 1 `BacSi` với `loai='home_staff'`, `trang_thai_duyet='approved'`, `la_hien=true` (tạo qua DB trực tiếp nếu chưa có màn hình tạo home_staff — ngoài phạm vi plan này). Dùng token admin gọi:

```
PATCH /api/admin/appointments/<id lịch home vừa tạo ở Task 1 Step 4>/assign-home-staff
{ "staff_id": "<id BacSi home_staff>" }
```

Kỳ vọng: `200`, `data.status = "confirmed"`, `data.doctor_id = "<staff_id>"`.

Gọi lại lần 2 với cùng `id` → kỳ vọng `409 "Chỉ gán nhân viên cho lịch đang chờ xử lý"` (vì đã chuyển sang `confirmed`).

Gọi với `id` của 1 lịch `loai_kham='clinic'` → kỳ vọng `409 "Chỉ gán nhân viên cho lịch khám tại nhà"`.

- [ ] **Step 5: Dừng lại, để user tự review diff và commit**

---

## Task 3: Endpoint CSKH điền kết quả xét nghiệm + thông báo bệnh nhân

**Files:**
- Modify: `backend/src/controllers/admin/appointments.controller.js` (thêm hàm cuối file)
- Modify: `backend/src/routes/admin/appointments.routes.js`

**Interfaces:**
- Consumes: `LichHen`, `ThongBao` (đã import ở Task 2 Step 1).
- Produces: `PATCH /api/admin/appointments/:id/result` — body `{ ket_qua_url: string }` → response `{ id, ket_qua_url, status }`.

- [ ] **Step 1: Thêm hàm `uploadHomeResult` vào cuối `admin/appointments.controller.js`**

Thêm sau hàm `assignHomeStaff` (Task 2):

```js

// ─── PATCH /api/admin/appointments/:id/result ───────────────────────────────
// CSKH upload URL kết quả xét nghiệm (PDF) sau khi lab trả kết quả cho lịch home.
// Chuyển status 'confirmed' → 'completed' + gửi thông báo cho bệnh nhân
// (xem docs/superpowers/specs/2026-07-02-home-service-redesign.md mục 2.5 bước 7–8).
export async function uploadHomeResult(req, res) {
  try {
    const { ket_qua_url } = req.body
    if (!ket_qua_url?.trim()) return fail(res, 400, 'ket_qua_url là bắt buộc')

    const a = await LichHen.findById(req.params.id)
    if (!a) return fail(res, 404, 'Không tìm thấy lịch hẹn')
    if (a.loai_kham !== 'home') return fail(res, 409, 'Chỉ áp dụng cho lịch khám tại nhà')
    if (a.status !== 'confirmed') {
      return fail(res, 409, 'Chỉ điền kết quả cho lịch đã xác nhận (đã lấy mẫu)')
    }

    a.ket_qua_url = ket_qua_url.trim()
    a.status      = 'completed'
    await a.save()

    // Không throw nếu tạo thông báo lỗi — không chặn luồng chính (giống pattern audit log ở services.controller.js)
    try {
      await ThongBao.create({
        user_id:      a.user_id,
        tieu_de:      'Kết quả xét nghiệm đã có',
        noi_dung:     `Kết quả xét nghiệm "${a.ten_dich_vu}" của bạn đã có. Vào xem chi tiết trong lịch hẹn.`,
        loai:         'appointment',
        related_id:   a._id,
        related_type: 'appointment',
      })
    } catch (notifyErr) {
      console.error('[notification] Gửi thông báo kết quả xét nghiệm thất bại:', notifyErr.message)
    }

    return ok(res, { id: a._id, ket_qua_url: a.ket_qua_url, status: a.status }, 'Đã lưu kết quả xét nghiệm')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
```

- [ ] **Step 2: Đăng ký route**

Thêm vào `backend/src/routes/admin/appointments.routes.js` sau dòng `assign-home-staff`:

```js
router.patch('/:id/assign-home-staff', appointments.assignHomeStaff)
router.patch('/:id/result',            appointments.uploadHomeResult)

export default router
```

- [ ] **Step 3: Verify thủ công**

Dùng `id` lịch home đã `assign-home-staff` ở Task 2 (status hiện `confirmed`), gọi:

```
PATCH /api/admin/appointments/<id>/result
{ "ket_qua_url": "https://example.com/ket-qua-xn-001.pdf" }
```

Kỳ vọng: `200`, `data.status = "completed"`, `data.ket_qua_url` đúng URL gửi lên. Kiểm tra collection `thong_bao` có 1 document mới với `user_id` = bệnh nhân của lịch đó, `related_id` = id lịch hẹn.

Gọi lại khi lịch đang ở `status='pending'` (chưa assign staff) → kỳ vọng `409 "Chỉ điền kết quả cho lịch đã xác nhận (đã lấy mẫu)"`.

- [ ] **Step 4: Dừng lại, để user tự review diff và commit**

---

## Self-Review

**Spec coverage đối chiếu `docs/superpowers/specs/2026-07-02-home-service-redesign.md` mục 5 (checklist):**

| Checklist item trong spec | Trạng thái |
|---|---|
| `BacSi.js` — thêm field `loai` | Đã có sẵn trong code — không cần task |
| `LichHen.js` — `doctor_id` nullable + `ket_qua_url` | Đã có sẵn trong code — không cần task |
| `services.controller.js` — default `status='inactive'` | Đã có sẵn (default ở model `DichVu.js`) — không cần task |
| `service.service.ts` (FE mock) — default `status='inactive'` | Đã có sẵn (dòng 88) — không cần task |
| `types/index.ts` — thêm `ket_qua_url` | Đã có sẵn (dòng 86, 320) — không cần task |
| `booking.controller.js` — home flow upfront payment, `doctor_id=null` | **Task 1** |
| `appointments.controller.js` (admin) — action `assignHomeStaff()` | **Task 2** |
| FE booking page home — bỏ chọn BS, thêm chọn khu vực | Trang chưa tồn tại trong codebase — không áp dụng được, ghi nhận out-of-scope |
| FE trang booking clinic BS — thêm section "Dịch vụ liên quan" | Trang chưa tồn tại trong codebase — không áp dụng được, ghi nhận out-of-scope |
| Notification khi `ket_qua_url` được điền | **Task 3** (gộp chung với endpoint upload kết quả, vì 2 việc luôn xảy ra cùng lúc) |

**Placeholder scan:** không còn "TBD"/"implement later" — mọi step có code đầy đủ, executable.

**Type consistency:** `staff_id`, `ket_qua_url`, `khu_vuc` dùng tên nhất quán giữa các task và khớp field name thật trong model (`LichHen.ket_qua_url`, `LichHen.doctor_id`, `DichVu.khu_vuc`).
