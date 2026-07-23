# Phân tích Database — Lịch làm việc bác sĩ / Lịch hẹn (2026-07-23)

> **Mục tiêu:** Đánh giá DB hiện tại **có đủ** hoàn thành nghiệp vụ đã chốt ở `docs/Lịch làm việc bác sĩ.md` / `.claude/rules/lich-lam-viec-bac-si.md` hay **không** — nếu không, chỉ ra chính xác field/bảng cần thêm.
> **Phạm vi đọc code:** `backend/src/models/{LichLamViec,LichHen,HangDoi,ChuyenKhoa,CauHinhPhongKham,BacSi,PhongKham,ThongTinPhongKham,NghiPhepBacSi,TrangThaiPhongKham,KhachVangLai}.js`, `services/scheduleGenerator.service.js`, `controllers/admin/slots.controller.js`

---

## 0. Kết luận (Verdict)

> ❌ **KHÔNG thể hoàn thành đầy đủ nghiệp vụ nếu KHÔNG chỉnh sửa DB.**

Các trụ cột của nghiệp vụ 3 tầng **chưa được biểu diễn** trong schema hiện tại:
- Không có tầng **Khung giờ** (nhiều slot/khung) — mỗi slot đang = 1 khung 30′ = 1 bệnh nhân.
- Không có khái niệm **Ca** ở tầng dữ liệu → không thể "đăng ký theo ca", không thể ràng buộc phòng theo ca.
- `ChuyenKhoa` **không có** field cấu hình slot → capacity bị cố định 15/ngày.
- Slot **không phân** online/walk-in → không thể áp quota 70/30.
- **Không có bảng** đăng ký ca lặp theo tuần → generator buộc phải sinh full-day cho mọi bác sĩ.

**Phần ĐÃ ĐỦ (không cần đụng schema):** Hàng đợi (`HangDoi`), giữ slot & thanh toán (`LichHen` + `CauHinhPhongKham`), nghỉ phép (`NghiPhepBacSi` + `slot.bi_khoa_boi_nghi_phep`), khách vãng lai (`KhachVangLai`), trạng thái phòng realtime (`TrangThaiPhongKham`).

**Khối lượng sửa:** **4 collection thêm field** + **1 collection mới** + **2 thay đổi index** (chi tiết mục 2–3).

---

## 1. Ma trận hỗ trợ theo chức năng

| Mã | Chức năng nghiệp vụ | Field/bảng liên quan hiện có | Verdict | Thiếu gì |
|---|---|---|---|---|
| **F1** | 3 tầng Ca → Khung giờ → Slot | `LichLamViec.slots[]` phẳng (1 slot=1 khung) | ❌ Không đủ | Tầng khung (`khung_index`) + nhiều slot/khung |
| **F2** | Bác sĩ đăng ký **theo ca** (không full-time) | `LichLamViec` unique `(doctor_id, ngay)`; generator full-day | ❌ Không đủ | Field `ca` + **bảng mẫu đăng ký ca theo tuần** |
| **F3** | Slot/khung theo chuyên khoa | `ChuyenKhoa` (không field slot); generator hardcode 15 | ❌ Không đủ | 3 field cấu hình trong `ChuyenKhoa` |
| **F4** | Online vs walk-in + quota 70/30 | `slot.status` (không có `loai_slot`); `LichHen.hinh_thuc_dat_lich` | ❌ Không đủ | `slot.loai_slot`; quota ở `ChuyenKhoa` |
| **F5** | 1 phòng = 1 BS/ca; 1 BS = 1 phòng/ca | `phong_kham` chỉ là String snapshot; `PhongKham` không được ref | ❌ Không đủ | `phong_id` ref + unique `(phong_id, ngay, ca)` |
| **F6** | Trạng thái `cho_dich_vu` | `HangDoi.trang_thai`, `LichHen.status` (không có) | ❌ Không đủ | Thêm enum value (không cần bảng mới) |
| **F7** | `no_show` chỉ áp dụng online | `LichHen.status` có `no_show` cho mọi nguồn | ⚠️ Đủ schema | Chặn ở controller khi `nguon='tai_cho'` |
| **F8** | Hàng đợi tạo khi check-in, ưu tiên động | `HangDoi` (nguon, muc_uu_tien, tinhMucUuTien, ±30′) | ✅ Đủ | — |
| **F9** | Đặt online: giữ slot, thanh toán 100%, đổi ≤3 | `slot.status=pending_payment` + `lock_expires_at`; `CauHinhPhongKham` | ✅ Đủ | "1 lượt/BS/ngày" là rule query |
| **F10** | Nghỉ phép / khóa slot (nghỉ cả ca) | `NghiPhepBacSi` (có `gio_bat_dau/ket_thuc`); `slot.bi_khoa_boi_nghi_phep`, `nghi_phep_id` | ✅ Đủ | — |
| **F11** | Định danh khách vãng lai | `KhachVangLai`; `LichHen.khach_vang_lai_id`; `HangDoi.khach_vang_lai_id` | ✅ Đủ | — |
| **F12** | Trạng thái phòng realtime | `TrangThaiPhongKham` unique `(doctor_id, ngay)` | ⚠️ Đủ phần lớn | Nếu BS 2 ca khác phòng → cân nhắc thêm `ca` (P2) |

---

## 2. Thay đổi field trên collection CÓ SẴN (không tạo bảng mới)

### 2.1 `chuyen_khoa` (ChuyenKhoa) — nền tảng, ưu tiên **P0**
```js
thoi_gian_kham_trung_binh_phut: { type: Number, default: 15, min: 1 },   // vd TMH 10–15 → 15
so_slot_moi_khung:              { type: Number, default: 2,  min: 1 },   // = floor(30/TG); admin override
ty_le_online_phan_tram:         { type: Number, default: 70, min: 0, max: 100 },
```
> Gốc rễ của F3/F4. Không đụng dữ liệu cũ (chỉ thêm field có default). Đây là bước **làm trước tiên**.

### 2.2 `lich_lam_viec` (LichLamViec) — trụ cột F1/F2/F5, ưu tiên **P1**
```js
// Cấp lịch làm việc
ca:       { type: String, enum: ['sang', 'chieu'], required: true },   // MỚI — mỗi bản ghi 1 ca
phong_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PhongKham', default: null }, // MỚI — ràng buộc phòng

// Cấp slot (slotSchema)
khung_index: { type: Number, required: true },                          // MỚI — 0..6 (sáng) / 0..7 (chiều)
loai_slot:   { type: String, enum: ['online', 'walk_in'], required: true }, // MỚI — quota
```
> `phong_kham` (String snapshot) **giữ lại** để tương thích lịch cũ; `phong_id` là ref chuẩn để enforce ràng buộc.
> Nhiều slot/khung: các slot cùng `khung_index` có cùng `gio_bat_dau/gio_ket_thuc` nhưng khác `_id` (tầng khung = nhóm logic, đúng "Lựa chọn A — embedded" trong doc).

### 2.3 `hang_doi` (HangDoi) — F6, ưu tiên **P2**
```js
trang_thai: { enum: [..., 'cho_dich_vu'] },   // THÊM value 'cho_dich_vu'
```

### 2.4 `lich_hen` (LichHen) — F4/F6, ưu tiên **P2**
```js
nguon:  { type: String, enum: ['online', 'tai_cho'], default: null },  // MỚI (rõ ràng hoá; hiện suy từ hinh_thuc_dat_lich)
status: { enum: [..., 'cho_dich_vu'] },                                 // THÊM value
```

---

## 3. Bảng MỚI cần thêm

### 3.1 `mau_lich_lam_viec` (MauLichLamViec) — **BẮT BUỘC** cho F2, ưu tiên **P1**

Mẫu đăng ký ca lặp theo tuần của bác sĩ. Là **nguồn** để cron sinh `LichLamViec` — thay cho việc sinh full-day cho mọi bác sĩ approved.

```js
{
  bac_si_id:      { type: ObjectId, ref: 'BacSi', required: true },
  thu_trong_tuan: { type: Number, min: 0, max: 6, required: true },       // 0=CN..6=T7
  ca:             { type: String, enum: ['sang', 'chieu'], required: true },
  phong_id:       { type: ObjectId, ref: 'PhongKham', required: true },
  chuyen_khoa_id: { type: ObjectId, ref: 'ChuyenKhoa', required: true },
  trang_thai:     { type: String, enum: ['hoat_dong', 'tam_dung'], default: 'hoat_dong' },
  hieu_luc_tu:    { type: Date, default: null },   // mẫu áp dụng từ ngày (null = ngay lập tức)
  hieu_luc_den:   { type: Date, default: null },   // null = vô thời hạn
}
// Index:
//   unique (bac_si_id, thu_trong_tuan, ca)      → 1 bác sĩ chỉ 1 phòng/ca/thứ
//   unique (phong_id, thu_trong_tuan, ca) [với trang_thai='hoat_dong'] → 1 phòng chỉ 1 bác sĩ/ca/thứ
```
> Nếu chưa muốn làm tính năng lặp tuần, admin có thể tạo `LichLamViec` từng ca thủ công (F2 vẫn đạt); nhưng **generator hiện tại phải sửa** để không auto full-day. Bảng mẫu là cách chuẩn & bền vững.

### 3.2 (KHÔNG cần) bảng `KhungGio` / `Slot` riêng
Theo quyết định **Lựa chọn A (embedded)** trong `docs/Lịch làm việc bác sĩ.md` §7.2: giữ `slots[]` nhúng trong `LichLamViec`, khung giờ là nhóm logic theo `khung_index`. **Không tách collection** → tránh đại phẫu, giữ tính nguyên tử per-schedule. Chỉ cân nhắc tách khi lên đa chi nhánh / tải rất lớn.

---

## 4. Thay đổi INDEX & migration

| Collection | Index hiện tại | Đổi thành | Ghi chú migration |
|---|---|---|---|
| `lich_lam_viec` | unique `(doctor_id, ngay)` | unique `(doctor_id, ngay, ca)` | Backfill `ca` cho bản ghi cũ (tách slot sáng/chiều theo giờ → 2 bản ghi), hoặc gán `ca` tạm rồi migrate |
| `lich_lam_viec` | — | unique `(phong_id, ngay, ca)` (sparse) | Enforce F5; cần `phong_id` đã backfill từ `phong_kham` snapshot |
| `chuyen_khoa` | — | không đổi index | Chỉ thêm field, backfill `so_slot_moi_khung = floor(30/TG)` |

**Nguyên tắc migration (theo memory dự án — giữ mock/không phá demo):**
- **P0** (`ChuyenKhoa` +3 field): an toàn tuyệt đối, làm ngay — chỉ thêm field có default.
- **P1** (`LichLamViec` + `ca`/`khung_index`/`loai_slot`/`phong_id`, bảng `mau_lich_lam_viec`, sửa generator): làm **sau demo**, kèm script migration + backfill, test kỹ vì đổi unique index.
- **P2** (`cho_dich_vu`, `LichHen.nguon`, `TrangThaiPhongKham.ca`): bổ sung tăng dần, rủi ro thấp.
- **Không đụng** `HangDoi` (đã đúng).

---

## 5. Tổng hợp khối lượng

| Hạng mục | Số lượng | Chi tiết |
|---|---|---|
| Collection thêm field | **4** | `chuyen_khoa`, `lich_lam_viec`, `hang_doi`, `lich_hen` |
| Collection tạo mới | **1** | `mau_lich_lam_viec` |
| Thay đổi index | **2** | unique `(doctor_id,ngay,ca)`; unique `(phong_id,ngay,ca)` |
| Sửa service | **1** | `scheduleGenerator.service.js` sinh theo `mau_lich_lam_viec` + cấu hình chuyên khoa |
| Không đổi | — | `HangDoi`, `NghiPhepBacSi`, `KhachVangLai`, `CauHinhPhongKham`, `PhongKham` |

---

## 6. Liên quan
- `docs/Lịch làm việc bác sĩ.md` — đặc tả nghiệp vụ chuẩn (Gap G1–G7)
- `.claude/rules/lich-lam-viec-bac-si.md` — rule đóng băng (đã cập nhật §10 bảng/field bắt buộc)

---

## 7. Trạng thái triển khai (cập nhật 2026-07-23)

### ✅ P0 — ĐÃ TRIỂN KHAI
Thêm 3 field cấu hình vào `ChuyenKhoa` (`thoi_gian_kham_trung_binh_phut`, `so_slot_moi_khung`, `ty_le_online_phan_tram`), thuần bổ sung (additive), có default, không đổi index/unique, không phá dữ liệu cũ.

**File đã sửa:**
- `backend/src/models/ChuyenKhoa.js` — thêm 3 field + hàm `tinhSoSlotAnToan()` + `pre('validate')` tự tính/khóa trần `so_slot_moi_khung` (không cho vượt mức an toàn `floor(30/TG)`).
- `backend/src/controllers/admin/specialties.controller.js` — `create`/`update` nhận 3 field mới, bắt lỗi "vượt mức an toàn" trả 400.
- `backend/src/controllers/admin/clinic-info.controller.js` — đồng bộ cho route legacy `createSpecialtyForClinic`/`updateSpecialty` (đổi `findByIdAndUpdate` → `findById`+`save()` để kích hoạt `pre('validate')`).
- `backend/src/scripts/seed-all.js` — backfill giá trị cho 3 chuyên khoa demo (Nhi khoa, Da liễu, TMH) khớp bảng tham chiếu.
- `backend/src/scripts/backfill-chuyen-khoa-slot-config.js` **(mới)** — script idempotent backfill cho `ChuyenKhoa` đã tồn tại trong DB thật trước migration (chạy 1 lần: `node src/scripts/backfill-chuyen-khoa-slot-config.js`).
- `frontend/src/types/index.ts` — `SpecialtyItem` thêm 3 field (required, vì BE luôn trả về nhờ default).
- `frontend/src/pages/admin/ManageClinics/AddSpecialty.tsx`, `EditSpecialty.tsx` — thêm khối form "Cấu hình slot khám (Ca → Khung giờ → Slot)" với 3 input, validate client-side không vượt mức an toàn, tính preview `soSlotAnToan` real-time.

**Đã verify:** `node --check` toàn bộ file backend sửa/mới; `npm run typecheck` frontend — không phát sinh lỗi mới (các lỗi TS hiện có trong `ManageServices.tsx`, `ServiceViewModal.tsx`, `doctor-appointments.ts`, `Login.tsx`, `Profile.tsx` là nợ kỹ thuật có sẵn, không liên quan thay đổi này — xác nhận qua `git status` không có thay đổi ở các file đó).

**Việc còn lại để dùng được trên DB thật:** chạy `node src/scripts/backfill-chuyen-khoa-slot-config.js` một lần trên môi trường có dữ liệu `ChuyenKhoa` tạo trước migration này.

### ✅ Phase 1A — ĐÃ TRIỂN KHAI (2026-07-23)
`khung_index` + `loai_slot` trong `LichLamViec.slots`, generator sinh nhiều slot/khung theo `ChuyenKhoa` (P0), quota online/walk-in xen kẽ, bệnh nhân chỉ thấy slot online, `LichHen.hinh_thuc_dat_lich` được ghi đúng. Chi tiết: `docs/superpowers/plans/2026-07-23-khung-gio-slot-online-walkin.md`.

### ⏳ Phase 1B — CHƯA TRIỂN KHAI (rủi ro cao, cần plan riêng)
Thêm `ca` + `phong_id` vào `lich_lam_viec` (unique index đổi thành `(doctor_id,ngay,ca)`), bảng `mau_lich_lam_viec`. **Inventory 9 file bị ảnh hưởng bởi giả định "1 doc/ngày"** (khảo sát 2026-07-23):
`admin/appointment.controller.js` (getDoctorSchedules), `admin/doctor-leaves.controller.js` (lockSlotsForLeave — an toàn vì dùng `.find`), `receptionist/booking.controller.js` (getSlots — **vỡ trực tiếp**), `receptionist/appointment.controller.js` (rescheduleAppointment — an toàn có điều kiện nhờ filter `slots.gio_bat_dau`), `doctor/stats.controller.js` (getTodayOverview — **vỡ trực tiếp**), `nurse/dashboard.controller.js` (getDashboard — có thể trùng lặp bác sĩ), `nurse/queue.controller.js` (tinhCanhBaoQuaTai + checkin offline — **vỡ trực tiếp** cả 2 chỗ), `nurse/schedule.controller.js` (list — đếm `so_lich_hen` sai theo ca), `nurse/room-status.controller.js` (findOrCreateRoomStatus — **vỡ trực tiếp**, và `TrangThaiPhongKham` cũng có unique index `(doctor_id,ngay)` xung đột, cần đổi theo).

### ⏳ P2 — CHƯA TRIỂN KHAI
✅ `hang_doi.trang_thai` + `cho_dich_vu` (Task 2, Phase 1A); `lich_hen.nguon` + `cho_dich_vu`; chặn `no_show` cho `nguon='tai_cho'`.
