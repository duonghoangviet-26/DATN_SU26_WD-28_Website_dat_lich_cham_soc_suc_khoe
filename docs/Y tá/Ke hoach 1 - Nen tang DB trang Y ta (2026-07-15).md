# Kế hoạch 1 — Nền tảng DB trang Y tá (Models)

> **Cho người thực thi:** Đây là plan đầu tiên trong chuỗi. Thực thi **tuần tự từng Task**, mỗi Task test xong mới sang Task sau. Dùng checkbox `- [ ]` để theo dõi.
> Nguồn thiết kế: `docs/Y tá/Chot thiet ke DB - Hang doi + Trang thai phong + WebSocket (2026-07-15).md`

**Mục tiêu:** Đặt nền tảng CSDL cho luồng Y tá điều phối realtime — 2 model mới (`HangDoi`, `TrangThaiPhongKham`) + 4 model sửa nhẹ (`LichHen`, `NhatKyThaoTac`, `KetQuaKham`, `DonThuoc`) — **không đụng dữ liệu cũ, chỉ thêm giá trị/field mới**.

**Kiến trúc:** Mongoose models (ESM) theo convention tiếng Việt của dự án. Model mới đăng ký qua barrel `src/models/index.js`. Enum chỉ **thêm** giá trị (không xoá) để dữ liệu cũ không vỡ. Test = file `node --test` kết nối `MONGODB_URI`, tự dọn dữ liệu.

**Tech Stack:** Node.js ESM · Mongoose 8 · `node:test` (native runner) · MongoDB Cloud.

## Ràng buộc toàn cục (áp dụng mọi Task)

- **KHÔNG tự chạy `git commit`/`git push`.** Nhóm tự commit (thầy cô xem git history). Mỗi "Checkpoint commit" dưới đây là việc **thành viên nhóm tự làm bằng tay**, không phải AI.
- Field/enum đặt tên **tiếng Việt, snake_case** khớp DB hiện có (`ho_ten`, `trang_thai`...).
- File model: `PascalCase.js`, `import mongoose from 'mongoose'`, `export default mongoose.model(...)`.
- Enum **chỉ thêm** giá trị mới — không đổi/xoá giá trị cũ (tránh vỡ bản ghi hiện có).
- Mọi test phải **tự dọn** (xoá doc vừa tạo) ở cuối, không để rác trong DB cloud.
- Response API (bước sau) theo chuẩn `{ success, message, data }` — không thuộc plan này.
- Test cần `.env` có `MONGODB_URI`. Chạy tại thư mục `backend/`.

---

## Cấu trúc file (toàn plan)

| File | Trách nhiệm | Loại |
|---|---|---|
| `backend/src/models/TrangThaiPhongKham.js` | Trạng thái phòng/bác sĩ realtime (4 trạng thái) + dự phòng | Tạo mới |
| `backend/src/models/HangDoi.js` | Hàng đợi động online+offline đồng nhất | Tạo mới |
| `backend/src/models/NghiPhepYTa.js` | Nghỉ phép y tá (y tá tự xin → admin duyệt) | Tạo mới |
| `backend/src/models/index.js` | Barrel — export 3 model mới | Sửa |
| `backend/src/models/LichHen.js` | +2 enum status `waiting_record`,`skipped` | Sửa |
| `backend/src/models/NhatKyThaoTac.js` | +enum `vai_tro` nurse/receptionist + doc hành động | Sửa |
| `backend/src/models/KetQuaKham.js` | `dich_vu_phat_sinh` Mixed → sub-schema có giá | Sửa |
| `backend/src/models/DonThuoc.js` | +enum `nguon='y_ta'` | Sửa |
| `backend/tests/nurse-db.models.test.js` | Test schema 6 model | Tạo mới |

---

## Task 1: Model `TrangThaiPhongKham`

**Files:**
- Create: `backend/src/models/TrangThaiPhongKham.js`
- Modify: `backend/src/models/index.js`
- Test: `backend/tests/nurse-db.models.test.js`

**Interfaces:**
- Produces: model `TrangThaiPhongKham`, collection `trang_thai_phong_kham`, enum `trang_thai ∈ {dang_kham, dang_don_phong, san_sang, tam_nghi}`, index unique `{doctor_id, ngay}`.

- [ ] **Step 1: Tạo file model**

Tạo `backend/src/models/TrangThaiPhongKham.js`:

```js
import mongoose from 'mongoose'

// ============================================================
// TRANG THAI PHONG KHAM (DoctorRoomStatus) — trạng thái phòng/bác sĩ realtime
// 1 bản ghi / bác sĩ / ngày. Chỉ y tá (nurse_id) được đổi trạng thái.
// Phòng = phòng riêng cố định của bác sĩ, snapshot String từ LichLamViec (quyết định 4).
// Ràng buộc flow (enforce ở controller, KHÔNG ở schema):
//   dang_kham → dang_don_phong → san_sang ⇄ tam_nghi
//   - không cho dang_kham → san_sang trực tiếp
//   - không cho tam_nghi khi benh_nhan_hien_tai_id != null
// ============================================================

const roomStatusSchema = new mongoose.Schema(
  {
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', required: true },
    ngay: { type: Date, required: true },
    schedule_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichLamViec', default: null },
    phong_kham: { type: String, default: null },
    nurse_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    trang_thai: {
      type: String,
      enum: ['dang_kham', 'dang_don_phong', 'san_sang', 'tam_nghi'],
      default: 'san_sang',
    },
    benh_nhan_hien_tai_id: { type: mongoose.Schema.Types.ObjectId, ref: 'HangDoi', default: null },
    thoi_diem_doi: { type: Date, default: Date.now },
    thoi_gian_kham_tb_phut: { type: Number, default: 20, min: 0 },
    // ── Dự phòng khi y tá vắng (quyết định vòng 3) ──────────────────────────
    // nurse_id = y tá ĐƯỢC PHÂN CÔNG; nguoi_dieu_khien_id = người THỰC TẾ đang bấm nút
    // (có thể là lễ tân/admin dự phòng khi y tá chưa tới).
    nguoi_dieu_khien_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    nguoi_dieu_khien_vai_tro: { type: String, default: null }, // 'nurse' | 'receptionist' | 'admin'
    y_ta_co_mat: { type: Boolean, default: false },            // y tá phụ trách đã tiếp quản chưa (cảnh báo đến muộn)
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'trang_thai_phong_kham',
  }
)

roomStatusSchema.index({ doctor_id: 1, ngay: 1 }, { unique: true })
roomStatusSchema.index({ ngay: 1, trang_thai: 1 })

export default mongoose.model('TrangThaiPhongKham', roomStatusSchema)
```

- [ ] **Step 2: Đăng ký vào barrel**

Trong `backend/src/models/index.js`, thêm dòng (đặt sau nhóm `LichLamViec`/`PhongKham`):

```js
export { default as TrangThaiPhongKham } from './TrangThaiPhongKham.js'
```

- [ ] **Step 3: Viết test schema (tạo file test)**

Tạo `backend/tests/nurse-db.models.test.js`:

```js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

import {
  TrangThaiPhongKham,
} from '../src/models/index.js'

// ID rác dùng chung — không cần tồn tại thật, chỉ để thỏa required ObjectId
const FAKE_DOCTOR = new mongoose.Types.ObjectId()
const created = []

before(async () => {
  assert.ok(process.env.MONGODB_URI, 'Thiếu MONGODB_URI trong .env')
  await mongoose.connect(process.env.MONGODB_URI)
})

after(async () => {
  // Tự dọn mọi doc test đã tạo
  await Promise.all(created.map(({ model, id }) => model.deleteOne({ _id: id })))
  await mongoose.disconnect()
})

test('TrangThaiPhongKham: mặc định trang_thai = san_sang', async () => {
  const doc = await TrangThaiPhongKham.create({ doctor_id: FAKE_DOCTOR, ngay: new Date() })
  created.push({ model: TrangThaiPhongKham, id: doc._id })
  assert.equal(doc.trang_thai, 'san_sang')
  assert.equal(doc.thoi_gian_kham_tb_phut, 20)
})

test('TrangThaiPhongKham: từ chối trang_thai ngoài enum', async () => {
  await assert.rejects(
    TrangThaiPhongKham.create({ doctor_id: new mongoose.Types.ObjectId(), ngay: new Date(), trang_thai: 'xyz' }),
    /validation failed/i,
  )
})
```

- [ ] **Step 4: Chạy test — phải PASS**

Chạy tại `backend/`:
```
node --test tests/nurse-db.models.test.js
```
Mong đợi: 2 test PASS (`TrangThaiPhongKham: ...`). Nếu lỗi kết nối → kiểm tra `.env` có `MONGODB_URI`.

- [ ] **Step 5: Checkpoint commit (nhóm tự làm bằng tay)**

Thành viên nhóm commit thủ công (AI không tự commit):
```
git add backend/src/models/TrangThaiPhongKham.js backend/src/models/index.js backend/tests/nurse-db.models.test.js
git commit -m "feat(nurse): them model TrangThaiPhongKham"
```

---

## Task 2: Model `HangDoi`

**Files:**
- Create: `backend/src/models/HangDoi.js`
- Modify: `backend/src/models/index.js`
- Test: `backend/tests/nurse-db.models.test.js` (thêm test)

**Interfaces:**
- Consumes: — (độc lập)
- Produces: model `HangDoi`, collection `hang_doi`, enum `nguon ∈ {online,offline}`, `muc_uu_tien ∈ {online_uu_tien,online_thuong,offline}`, `trang_thai ∈ {dang_cho,da_goi,trong_phong,skipped,cancelled,hoan_thanh}`. Hàm `tinhMucUuTien(nguon, checkinTime, gioHenGoc)` export kèm.

- [ ] **Step 1: Tạo file model**

Tạo `backend/src/models/HangDoi.js`:

```js
import mongoose from 'mongoose'

// ============================================================
// HANG DOI (QueueEntry) — hàng đợi động, online + offline ĐỒNG NHẤT.
// Chỉ khác nhau ở nhánh tính muc_uu_tien (online xét cửa sổ ±30' so giờ hẹn).
// Bảng riêng để chứa cả offline (chưa có LichHen) + audit gọi bệnh nhân + no-show.
// Actor-agnostic: nguoi_tiep_nhan_id + vai_tro_tiep_nhan (lễ tân làm sau, không đổi schema).
// ============================================================

const CUA_SO_UU_TIEN_PHUT = 30

// Tính mức ưu tiên tại thời điểm check-in (đặc tả TH1–TH6).
export function tinhMucUuTien(nguon, checkinTime, gioHenGoc) {
  if (nguon === 'offline' || !gioHenGoc) return 'offline'
  const lech = Math.abs(new Date(checkinTime) - new Date(gioHenGoc)) / 60000 // phút
  const treHon = (new Date(checkinTime) - new Date(gioHenGoc)) / 60000
  if (treHon > CUA_SO_UU_TIEN_PHUT) return 'offline' // đến trễ > 30' → mất ưu tiên
  if (lech <= CUA_SO_UU_TIEN_PHUT) return 'online_uu_tien' // trong cửa sổ ±30'
  return 'online_thuong'
}

const queueSchema = new mongoose.Schema(
  {
    // Nguồn & định danh bệnh nhân (đồng nhất 2 nguồn)
    nguon: { type: String, enum: ['online', 'offline'], required: true },
    appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LichHen', default: null },
    khach_vang_lai_id: { type: mongoose.Schema.Types.ObjectId, ref: 'KhachVangLai', default: null },
    member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ThanhVien', default: null },
    ten_benh_nhan: { type: String, required: true, trim: true, maxlength: 255 },
    so_dien_thoai: { type: String, default: null, maxlength: 20 },
    tuoi: { type: Number, default: null, min: 0 },
    gioi_tinh: { type: String, enum: ['nam', 'nu', 'khac'], default: null },

    // Điều phối — KHÔNG lưu thu_tu (thứ tự đổi liên tục, tính động lúc query)
    specialty_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChuyenKhoa', required: true },
    doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
    phong_kham: { type: String, default: null },

    // Ưu tiên
    muc_uu_tien: {
      type: String,
      enum: ['online_uu_tien', 'online_thuong', 'offline'],
      required: true,
    },
    gio_hen_goc: { type: Date, default: null },

    // Vòng đời
    trang_thai: {
      type: String,
      enum: ['dang_cho', 'da_goi', 'trong_phong', 'skipped', 'cancelled', 'hoan_thanh'],
      default: 'dang_cho',
    },
    checkin_time: { type: Date, required: true },
    so_lan_goi: { type: Number, default: 0, min: 0 },
    thoi_diem_goi: { type: Date, default: null },
    thoi_diem_vao_phong: { type: Date, default: null },
    thoi_diem_ket_thuc: { type: Date, default: null },
    thoi_gian_cho_uoc_tinh_phut: { type: Number, default: null, min: 0 },

    // Actor tiếp nhận (actor-agnostic)
    nguoi_tiep_nhan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    vai_tro_tiep_nhan: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'hang_doi',
  }
)

// Online phải có appointment_id; offline phải có SĐT (ten_benh_nhan đã required sẵn).
queueSchema.pre('validate', function () {
  if (this.nguon === 'online' && !this.appointment_id) {
    throw new Error('Hang doi online bat buoc co appointment_id')
  }
  if (this.nguon === 'offline' && !this.so_dien_thoai) {
    throw new Error('Hang doi offline bat buoc co so_dien_thoai')
  }
})

queueSchema.index({ doctor_id: 1, trang_thai: 1 })
queueSchema.index({ specialty_id: 1, trang_thai: 1 })
queueSchema.index({ appointment_id: 1 }, { unique: true, sparse: true })
queueSchema.index({ trang_thai: 1, thoi_diem_goi: 1 })

export default mongoose.model('HangDoi', queueSchema)
```

- [ ] **Step 2: Đăng ký vào barrel**

Trong `backend/src/models/index.js`, thêm cạnh `TrangThaiPhongKham`:

```js
export { default as HangDoi } from './HangDoi.js'
```

- [ ] **Step 3: Thêm test vào `nurse-db.models.test.js`**

Thêm import `HangDoi` và `tinhMucUuTien` vào đầu file:

```js
import { TrangThaiPhongKham, HangDoi } from '../src/models/index.js'
import { tinhMucUuTien } from '../src/models/HangDoi.js'
```

Thêm các test (trước dòng `after`):

```js
test('HangDoi offline: tạo được, muc_uu_tien = offline', async () => {
  const doc = await HangDoi.create({
    nguon: 'offline', ten_benh_nhan: 'Khách Vãng Lai', so_dien_thoai: '0900000000',
    specialty_id: new mongoose.Types.ObjectId(),
    muc_uu_tien: 'offline', checkin_time: new Date(),
  })
  created.push({ model: HangDoi, id: doc._id })
  assert.equal(doc.trang_thai, 'dang_cho')
})

test('HangDoi online thiếu appointment_id → reject', async () => {
  await assert.rejects(
    HangDoi.create({
      nguon: 'online', ten_benh_nhan: 'A', specialty_id: new mongoose.Types.ObjectId(),
      muc_uu_tien: 'online_thuong', checkin_time: new Date(),
    }),
    /appointment_id/,
  )
})

test('tinhMucUuTien: đúng cửa sổ ±30 phút', () => {
  const hen = new Date('2026-07-15T09:00:00')
  assert.equal(tinhMucUuTien('offline', new Date(), hen), 'offline')
  assert.equal(tinhMucUuTien('online', new Date('2026-07-15T09:10:00'), hen), 'online_uu_tien') // lệch 10'
  assert.equal(tinhMucUuTien('online', new Date('2026-07-15T08:20:00'), hen), 'online_thuong')  // sớm 40'
  assert.equal(tinhMucUuTien('online', new Date('2026-07-15T09:45:00'), hen), 'offline')         // trễ 45'
})
```

- [ ] **Step 4: Chạy test — phải PASS**

```
node --test tests/nurse-db.models.test.js
```
Mong đợi: tất cả test (5) PASS.

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**

```
git add backend/src/models/HangDoi.js backend/src/models/index.js backend/tests/nurse-db.models.test.js
git commit -m "feat(nurse): them model HangDoi + tinhMucUuTien"
```

**Rủi ro:** thấp — model mới, không đụng model cũ. Index `appointment_id` sparse unique cần `sparse:true` (đã có) để nhiều doc offline `null` không vi phạm unique.

---

## Task 3: `LichHen.status` — thêm `waiting_record`, `skipped`

**Files:**
- Modify: `backend/src/models/LichHen.js:45-49` (enum `status`)
- Test: `backend/tests/nurse-db.models.test.js` (thêm test)

**Interfaces:**
- Produces: `LichHen.status` chấp nhận thêm 2 giá trị. Không đổi giá trị cũ.

- [ ] **Step 1: Sửa enum**

Trong `backend/src/models/LichHen.js`, đổi mảng enum `status` từ:
```js
enum: ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_doctor_confirm', 'completed', 'cancelled', 'no_show'],
```
thành:
```js
enum: ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm', 'completed', 'cancelled', 'no_show', 'skipped'],
```

- [ ] **Step 2: Thêm test**

Thêm vào `nurse-db.models.test.js` (import `LichHen` vào barrel import). Vì `LichHen` có nhiều required field + hook `pre('validate')` phức tạp, test ở mức **validate schema-only** (không lưu DB) để tránh phụ thuộc dữ liệu:

```js
import { TrangThaiPhongKham, HangDoi, LichHen } from '../src/models/index.js'

test('LichHen.status: chấp nhận waiting_record và skipped', () => {
  const path = LichHen.schema.path('status')
  assert.ok(path.enumValues.includes('waiting_record'))
  assert.ok(path.enumValues.includes('skipped'))
  // giá trị cũ vẫn còn (không vỡ dữ liệu cũ)
  assert.ok(path.enumValues.includes('completed'))
  assert.ok(path.enumValues.includes('no_show'))
})
```

- [ ] **Step 3: Chạy test — PASS**
```
node --test tests/nurse-db.models.test.js
```

- [ ] **Step 4: Regression — chạy toàn bộ test hiện có (không vỡ enum cũ)**
```
node --test tests/doctor.schedule.test.js tests/doctor.api.test.js
```
> Cần backend đang chạy + seed doctor test (`node src/scripts/seed-doctor-test-data.js`) theo header các file test này. Nếu chưa seed/chưa chạy server: bỏ qua bước này, ghi chú lại để chạy khi có môi trường. Mong đợi: không có test nào **mới** fail so với trước khi sửa.

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/models/LichHen.js backend/tests/nurse-db.models.test.js
git commit -m "feat(nurse): them trang thai waiting_record va skipped cho LichHen"
```

**Rủi ro:** trung bình-thấp. Chỉ **thêm** enum → bản ghi cũ không vỡ. Không có migration cần thiết.

---

## Task 4: `NhatKyThaoTac` — mở rộng `vai_tro` + tài liệu hành động y tá

**Files:**
- Modify: `backend/src/models/NhatKyThaoTac.js:49-53` (enum `vai_tro`) + block comment danh sách `hanh_dong`
- Test: `backend/tests/nurse-db.models.test.js`

**Interfaces:**
- Produces: `vai_tro` chấp nhận `nurse`, `receptionist`. Hành động mới ghi qua field `hanh_dong` (String tự do — chỉ cần bổ sung comment tài liệu, không phải enum).

- [ ] **Step 1: Sửa enum `vai_tro`**

Trong `backend/src/models/NhatKyThaoTac.js`, đổi:
```js
enum: ['admin', 'doctor', 'user', 'system'],
```
thành:
```js
enum: ['admin', 'doctor', 'user', 'system', 'nurse', 'receptionist'],
```

- [ ] **Step 2: Bổ sung comment tài liệu hành động y tá**

Thêm vào block comment "DANH SÁCH hanh_dong" (trước dòng `[System – Cron]`):
```js
// [Nurse – Queue & Room]
//   CHANGE_DOCTOR_STATUS | CHECKIN_QUEUE | CALL_PATIENT | SKIP_PATIENT | ASSIGN_DOCTOR
//   loai_doi_tuong mới: queue_entry | room_status
```

- [ ] **Step 3: Thêm test**
```js
import { TrangThaiPhongKham, HangDoi, LichHen, NhatKyThaoTac } from '../src/models/index.js'

test('NhatKyThaoTac.vai_tro: chấp nhận nurse & receptionist', () => {
  const vals = NhatKyThaoTac.schema.path('vai_tro').enumValues
  assert.ok(vals.includes('nurse'))
  assert.ok(vals.includes('receptionist'))
  assert.ok(vals.includes('admin')) // cũ còn nguyên
})
```

- [ ] **Step 4: Chạy test — PASS**
```
node --test tests/nurse-db.models.test.js
```

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/models/NhatKyThaoTac.js backend/tests/nurse-db.models.test.js
git commit -m "feat(nurse): mo rong vai_tro nurse/receptionist trong NhatKyThaoTac"
```

**Rủi ro:** thấp — chỉ thêm enum + comment.

---

## Task 5: `KetQuaKham.dich_vu_phat_sinh` — Mixed → sub-schema có giá

**Files:**
- Modify: `backend/src/models/KetQuaKham.js:78-85` (2 field `dich_vu_phat_sinh`, `dich_vu_tu_choi`)
- Test: `backend/tests/nurse-db.models.test.js`

**Interfaces:**
- Produces: `dich_vu_phat_sinh[]` có kiểu `{ service_id, ten, so_luong, don_gia, thanh_tien, chi_dinh_boi_bac_si_id, them_boi_y_ta_id }`. Dùng để sinh `HoaDon.chi_tiet_thu_phi` ở plan sau.

- [ ] **Step 1: Định nghĩa sub-schema + thay 2 field**

Trong `backend/src/models/KetQuaKham.js`, **trước** `const examinationResultSchema`, thêm:

```js
const dichVuPhatSinhSchema = new mongoose.Schema(
  {
    service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'DichVu', default: null },
    ten: { type: String, required: true, maxlength: 255 },
    so_luong: { type: Number, default: 1, min: 1 },
    don_gia: { type: Number, required: true, min: 0 },
    thanh_tien: { type: Number, required: true, min: 0 },
    chi_dinh_boi_bac_si_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BacSi', default: null },
    them_boi_y_ta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
  },
  { _id: true }
)
```

Đổi 2 field trong `examinationResultSchema` từ:
```js
    dich_vu_phat_sinh: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    dich_vu_tu_choi: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
```
thành:
```js
    dich_vu_phat_sinh: {
      type: [dichVuPhatSinhSchema],
      default: [],
    },
    // Giữ Mixed cho dich_vu_tu_choi vì hiện chưa có luồng dùng — sẽ gõ kiểu khi có yêu cầu.
    dich_vu_tu_choi: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
```

- [ ] **Step 2: Thêm test**
```js
import { TrangThaiPhongKham, HangDoi, LichHen, NhatKyThaoTac, KetQuaKham } from '../src/models/index.js'

test('KetQuaKham.dich_vu_phat_sinh: sub-schema thiếu don_gia → reject', () => {
  const doc = new KetQuaKham({
    appointment_id: new mongoose.Types.ObjectId(),
    chan_doan: 'Test',
    dich_vu_phat_sinh: [{ ten: 'X-quang', so_luong: 1, thanh_tien: 100000 }], // thiếu don_gia
  })
  const err = doc.validateSync()
  assert.ok(err, 'phải có lỗi validate')
  assert.match(String(err.message), /don_gia/)
})

test('KetQuaKham.dich_vu_phat_sinh: hợp lệ khi đủ field', () => {
  const doc = new KetQuaKham({
    appointment_id: new mongoose.Types.ObjectId(),
    chan_doan: 'Test',
    dich_vu_phat_sinh: [{ ten: 'X-quang', so_luong: 1, don_gia: 100000, thanh_tien: 100000 }],
  })
  const err = doc.validateSync()
  assert.equal(err, undefined)
})
```

- [ ] **Step 3: Chạy test — PASS**
```
node --test tests/nurse-db.models.test.js
```

- [ ] **Step 4: Regression — test hồ sơ bác sĩ (nếu có môi trường)**
```
node --test tests/doctor.api.test.js
```
> Kiểm tra luồng bác sĩ tạo/đọc `KetQuaKham` không vỡ. Nếu bản ghi cũ có `dich_vu_phat_sinh` dạng Mixed lạ, Mongoose chỉ cast khi ghi lại — đọc cũ không lỗi. Ghi chú nếu bỏ qua vì thiếu môi trường.

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/models/KetQuaKham.js backend/tests/nurse-db.models.test.js
git commit -m "feat(nurse): go kieu dich_vu_phat_sinh trong KetQuaKham"
```

**Rủi ro:** trung bình. Bản ghi cũ có `dich_vu_phat_sinh` là Mixed rỗng `[]` → an toàn. Nếu đã có data phát sinh dạng cũ khác cấu trúc → chỉ ảnh hưởng khi **ghi lại**, không khi đọc. Kiểm tra dữ liệu thật trước khi deploy (hiện luồng này chưa dùng nên gần như chắc chắn rỗng).

---

## Task 6: `DonThuoc.nguon` — thêm `y_ta`

**Files:**
- Modify: `backend/src/models/DonThuoc.js:56-60` (enum `nguon`)
- Test: `backend/tests/nurse-db.models.test.js`

**Interfaces:**
- Produces: `DonThuoc.nguon` chấp nhận `y_ta`. Luồng y tá tạo `DonThuoc` sẽ làm ở plan controller (không thuộc plan này).

- [ ] **Step 1: Sửa enum**

Trong `backend/src/models/DonThuoc.js`, đổi:
```js
      enum: ['bac_si', 'tu_nhap'],
      default: 'tu_nhap',
```
thành:
```js
      enum: ['bac_si', 'tu_nhap', 'y_ta'],
      default: 'tu_nhap',
```

> Lưu ý: hook `pre('validate')` bắt buộc `member_id` khi `nguon='tu_nhap'`. Với `y_ta` **không** ép `member_id` (y tá nhập cho cả khách vãng lai) — hook hiện chỉ check `tu_nhap` nên `y_ta` tự do, đúng ý. Không cần sửa hook.

- [ ] **Step 2: Thêm test**
```js
import { TrangThaiPhongKham, HangDoi, LichHen, NhatKyThaoTac, KetQuaKham, DonThuoc } from '../src/models/index.js'

test('DonThuoc.nguon: chấp nhận y_ta, không ép member_id', () => {
  const vals = DonThuoc.schema.path('nguon').enumValues
  assert.ok(vals.includes('y_ta'))
  const doc = new DonThuoc({
    ket_qua_kham_id: new mongoose.Types.ObjectId(),
    nguon: 'y_ta',
    items: [{ ten_thuoc: 'Paracetamol', so_ngay: 3 }],
  })
  const err = doc.validateSync()
  assert.equal(err, undefined, 'y_ta không cần member_id')
})
```

- [ ] **Step 3: Chạy test — PASS**
```
node --test tests/nurse-db.models.test.js
```

- [ ] **Step 4: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/models/DonThuoc.js backend/tests/nurse-db.models.test.js
git commit -m "feat(nurse): them nguon y_ta cho DonThuoc"
```

**Rủi ro:** thấp — chỉ thêm enum. Hook `tu_nhap` không đổi.

---

## Task 7: Model `NghiPhepYTa` (nghỉ phép y tá)

**Files:**
- Create: `backend/src/models/NghiPhepYTa.js`
- Modify: `backend/src/models/index.js`
- Test: `backend/tests/nurse-db.models.test.js`

**Interfaces:**
- Produces: model `NghiPhepYTa`, collection `nghi_phep_y_ta`, enum `trang_thai ∈ {cho_duyet,da_duyet,tu_choi,da_huy}`, field `y_ta_thay_id` (admin chọn lúc duyệt). Nhân bản pattern `NghiPhepBacSi` nhưng **không khóa ca** — chỉ phục vụ reassign.

- [ ] **Step 1: Tạo file model**

Tạo `backend/src/models/NghiPhepYTa.js`:

```js
import mongoose from 'mongoose'

const isHHMM = (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

// ============================================================
// NGHI PHEP Y TA — y tá tự xin nghỉ → admin duyệt.
// KHÁC NghiPhepBacSi: nghỉ y tá KHÔNG khóa ca (bác sĩ vẫn khám) mà admin
// gán y_ta_thay_id lúc duyệt → cập nhật LichLamViec.nurse_id (làm ở plan sau).
// y_ta_id ref 'NguoiDung' (role='nurse') — hệ thống không có model YTa riêng.
// ============================================================

const nghiPhepYTaSchema = new mongoose.Schema(
  {
    y_ta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', required: true },
    tu_ngay: { type: Date, required: true },
    den_ngay: { type: Date, required: true },
    gio_bat_dau: { type: String, default: null, validate: { validator: isHHMM, message: 'gio_bat_dau phai dang HH:MM' } },
    gio_ket_thuc: { type: String, default: null, validate: { validator: isHHMM, message: 'gio_ket_thuc phai dang HH:MM' } },
    ly_do: { type: String, default: null, maxlength: 500 },
    trang_thai: {
      type: String,
      enum: ['cho_duyet', 'da_duyet', 'tu_choi', 'da_huy'],
      default: 'cho_duyet',
    },
    nguoi_duyet_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
    thoi_diem_duyet: { type: Date, default: null },
    ghi_chu: { type: String, default: null, maxlength: 500 },
    y_ta_thay_id: { type: mongoose.Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
  },
  {
    timestamps: { createdAt: 'ngay_tao', updatedAt: 'ngay_cap_nhat' },
    collection: 'nghi_phep_y_ta',
  }
)

nghiPhepYTaSchema.pre('validate', function () {
  if (this.tu_ngay && this.den_ngay && this.den_ngay < this.tu_ngay) {
    throw new Error('den_ngay phai >= tu_ngay')
  }
})

nghiPhepYTaSchema.index({ y_ta_id: 1, tu_ngay: 1, den_ngay: 1 })
nghiPhepYTaSchema.index({ trang_thai: 1 })

export default mongoose.model('NghiPhepYTa', nghiPhepYTaSchema)
```

- [ ] **Step 2: Đăng ký vào barrel**

Trong `backend/src/models/index.js`, thêm cạnh `NghiPhepBacSi`:
```js
export { default as NghiPhepYTa } from './NghiPhepYTa.js'
```

- [ ] **Step 3: Thêm test**
```js
import { TrangThaiPhongKham, HangDoi, LichHen, NhatKyThaoTac, KetQuaKham, DonThuoc, NghiPhepYTa } from '../src/models/index.js'

test('NghiPhepYTa: mặc định cho_duyet', async () => {
  const doc = await NghiPhepYTa.create({
    y_ta_id: new mongoose.Types.ObjectId(),
    tu_ngay: new Date('2026-08-01'), den_ngay: new Date('2026-08-02'),
  })
  created.push({ model: NghiPhepYTa, id: doc._id })
  assert.equal(doc.trang_thai, 'cho_duyet')
})

test('NghiPhepYTa: den_ngay < tu_ngay → reject', async () => {
  await assert.rejects(
    NghiPhepYTa.create({ y_ta_id: new mongoose.Types.ObjectId(), tu_ngay: new Date('2026-08-05'), den_ngay: new Date('2026-08-01') }),
    /den_ngay phai >= tu_ngay/,
  )
})
```

- [ ] **Step 4: Chạy test — PASS**
```
node --test tests/nurse-db.models.test.js
```

- [ ] **Step 5: Checkpoint commit (nhóm tự làm)**
```
git add backend/src/models/NghiPhepYTa.js backend/src/models/index.js backend/tests/nurse-db.models.test.js
git commit -m "feat(nurse): them model NghiPhepYTa (nghi phep y ta)"
```

**Rủi ro:** thấp — model mới độc lập, nhân bản pattern đã kiểm chứng của `NghiPhepBacSi`.

---

## Kiểm thử tổng (sau cả 7 Task)

- [ ] Chạy toàn bộ file test model:
```
node --test tests/nurse-db.models.test.js
```
Mong đợi: tất cả PASS, và **kiểm tra DB cloud không còn doc rác** (test tự dọn qua `after`). Nếu treo test giữa chừng → xoá thủ công collection `trang_thai_phong_kham`, `hang_doi` các doc `ten_benh_nhan='Khách Vãng Lai'`.

- [ ] Dữ liệu mẫu cho plan sau (ghi chú, chưa tạo ở plan này): 1 `NguoiDung` role=`nurse`; 1 `LichLamViec` hôm nay có `nurse_id` này + `slots[].phong_kham`; 1 `TrangThaiPhongKham` cho bác sĩ đó; 2 `HangDoi` (1 online có `appointment_id`, 1 offline).

---

## Roadmap các plan tiếp theo (sẽ viết riêng khi Plan 1 xong)

Theo nguyên tắc mỗi plan chạy & test độc lập, phần còn lại tách thành:

| Plan | Nội dung | Phụ thuộc |
|---|---|---|
| **Plan 2 — Backend Trạng thái phòng** | Controller/route y tá đổi 4 trạng thái + ràng buộc flow + **tạo lười `TrangThaiPhongKham`** + **presence-gate** (chỉ bệnh nhân có mặt mới vào `dang_kham`) + ghi `NhatKyThaoTac`. Y tá lọc theo **tập bác sĩ mình phụ trách** (`LichLamViec.nurse_id`) | Plan 1 |
| **Plan 3 — Backend Hàng đợi + Gọi bệnh nhân** | Check-in (tạm y tá/admin) → `HangDoi` (sort động, không `thu_tu`), **ngưỡng nhận theo giờ kết thúc ca** (quá tải → hẹn đợt sau), ước tính thời gian chờ động, gợi ý next, gọi bệnh nhân, no-show 5'/10' (cron) | Plan 1, 2 |
| **Plan 4 — WebSocket (Socket.IO)** | Rooms `specialty:{id}`, `nurse:{id}`, `reception`, `doctor:{id}`; emit sau khi ghi DB | Plan 2, 3 |
| **Plan 5 — Đơn thuốc + Dịch vụ phát sinh + Hóa đơn** | Y tá nhập `DonThuoc`+`dich_vu_phat_sinh`; bác sĩ duyệt → sinh `HoaDon` | Plan 1 |
| **Plan 6 — Nghỉ phép & Dự phòng y tá** | Xin/duyệt/từ chối/hủy `NghiPhepYTa` + đổi y tá (reassign) + tiếp quản + cảnh báo đến muộn + phân quyền dự phòng (nurse/receptionist/admin). Kịch bản test: `Xu ly vang mat y ta...` | Plan 1, 2 |
| **Plan 7 — Frontend Nurse Portal** | Màn Hàng đợi realtime + bảng điều khiển trạng thái phòng + form hồ sơ mở rộng | Plan 2–6 |
| **Plan 8 — Module Lễ tân** | Nối vào `HangDoi` qua `nguoi_tiep_nhan_id` + dự phòng điều khiển phòng | Plan 3, 6 |

---

## Tự rà (self-review)

- **Phủ spec:** Plan 1 phủ toàn bộ mục "DB — bảng/trường thiếu" trong file chốt thiết kế (2 model mới + 4 sửa). Các mục controller/websocket/frontend nằm ở Plan 2–7 (đã liệt kê roadmap).
- **Không placeholder:** mọi Task có code thật + lệnh chạy + kết quả mong đợi.
- **Nhất quán kiểu:** `tinhMucUuTien` dùng thống nhất ở Task 2. Enum `trang_thai` HangDoi ↔ `TrangThaiPhongKham.benh_nhan_hien_tai_id` ref đúng `HangDoi`. `dich_vu_phat_sinh` field khớp giữa Task 5 và mô tả HoaDon ở Plan 5.
