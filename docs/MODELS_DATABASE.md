# VitaFamily — Danh sách đầy đủ toàn bộ Bảng (Collection) trong Database

> Liệt kê **đầy đủ từng field** của **24 collection** thật trong MongoDB, đúng
> theo code hiện tại (đã patch). Đây là tài liệu tra cứu schema chi tiết —
> khác với `MO_TA_PHAN_TICH_MODELS.md` (bản tóm tắt + giải thích luồng nghiệp vụ).

**Quy ước đọc bảng:**
- Cột **Bắt buộc/Default**: `required` = bắt buộc nhập; nếu không required sẽ ghi giá trị default
- Cột **Ràng buộc**: min/max/enum/unique/maxlength/regex...
- 🆕 = field hoặc index mới thêm trong lần patch gần nhất

---

## Mục lục theo nhóm

| Nhóm | Collection (model) |
|---|---|
| Cấu hình hệ thống | `thong_tin_phong_kham` (ThongTinPhongKham), `cai_dat_thanh_toan` (CaiDatThanhToan), `chuyen_khoa` (ChuyenKhoa) |
| Người dùng | `nguoi_dung` (NguoiDung), `dat_lai_mat_khau` (DatLaiMatKhau) |
| Gia đình | `gia_dinh` (GiaDinh), `thanh_vien` (ThanhVien) |
| Bác sĩ | `bac_si` (BacSi), `lich_lam_viec` (LichLamViec) |
| Dịch vụ & Đặt lịch | `dich_vu` (DichVu), `lich_hen` (LichHen), `thanh_toan` (ThanhToan), `hoan_tien` (HoanTien) |
| Y tế | `ho_so_y_te` (HoSoYTe), `ket_qua_kham` (KetQuaKham), `don_thuoc` (DonThuoc), `nhac_nho` (NhacNho) |
| Đánh giá & Thông báo | `danh_gia` (DanhGia), `thong_bao` (ThongBao), `thong_bao_he_thong` (ThongBaoHeThong) |
| Chat AI | `phien_chat` (PhienChat), `tin_nhan_chat` (TinNhanChat) |
| Audit | `nhat_ky_thao_tac` (NhatKyThaoTac), `lich_su_lich_hen` (LichSuLichHen) |

---

## 1. `thong_tin_phong_kham` — Model: `ThongTinPhongKham`

Singleton (chỉ 1 document trong toàn collection).

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `ma` | String | default `'MAIN'` | `unique`, `immutable: true` |
| `ten` | String | required | `trim`, `maxlength: 255` |
| `dia_chi` | String | default `null` | |
| `so_dien_thoai` | String | default `null` | `maxlength: 20` |
| `email` | String | default `null` | `maxlength: 255`, `lowercase`, `trim` |
| `gio_lam_viec` | String | default `null` | `maxlength: 255` |
| `mo_ta` | String | default `null` | |
| `logo_url` | String | default `null` | `maxlength: 500` |
| `ban_do_url` | String | default `null` | `maxlength: 500` |
| `ngay_tao` | Date | auto (timestamps) | |
| `ngay_cap_nhat` | Date | auto (timestamps) | |

**Index:** không có index riêng ngoài `ma` (unique).
**Hook:** không có.

---

## 2. `cai_dat_thanh_toan` — Model: `CaiDatThanhToan`

Lưu key-value, admin cấu hình động.

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `ten_cai_dat` | String | required | `unique`, `trim`, `maxlength: 100` |
| `gia_tri` | String | required | `maxlength: 255` (convert sang Number khi dùng) |
| `mo_ta` | String | default `null` | `maxlength: 500` |
| `ngay_cap_nhat` | Date | auto (`updatedAt` only, không có `createdAt`) | |

**Index:** không có (chỉ unique trên `ten_cai_dat`).
**Hook:** không có.

**Các key hiện đang dùng (dữ liệu seed, không phải field cố định):**
`hoan_tien_tu_24h_tro_len`, `hoan_tien_12_24h`, `hoan_tien_6_12h`, `hoan_tien_duoi_6h`,
`hoan_tien_bac_si_huy`, `hoan_tien_admin_huy`, `thoi_gian_het_han_thanh_toan`.

**Mapping với chính sách hoàn tiền (features.md):**

| Key | Giá trị mặc định | Ý nghĩa |
|---|---|---|
| `hoan_tien_tu_24h_tro_len` | `"100"` | Hủy ≥ 24h trước lịch khám → hoàn 100% |
| `hoan_tien_12_24h` | `"80"` | Hủy 12–24h trước → hoàn 80% |
| `hoan_tien_6_12h` | `"50"` | Hủy 6–12h trước → hoàn 50% |
| `hoan_tien_duoi_6h` | `"0"` | Hủy < 6h trước → không hoàn |
| `hoan_tien_bac_si_huy` | `"100"` | Bác sĩ chủ động hủy → hoàn 100% bất kể thời gian |
| `hoan_tien_admin_huy` | `"100"` | Admin hủy khẩn cấp → hoàn 100% |
| `thoi_gian_het_han_thanh_toan` | `"15"` | Appointment unpaid quá N phút → cron tự hủy |

**Logic tính % hoàn tại service layer (pseudo-code):**
```js
const diff = ngay_kham - Date.now()  // ms
if (diff >= 24 * 3600 * 1000) pct = hoan_tien_tu_24h_tro_len   // "100"
else if (diff >= 12 * 3600 * 1000) pct = hoan_tien_12_24h       // "80"
else if (diff >= 6  * 3600 * 1000) pct = hoan_tien_6_12h        // "50"
else                                pct = hoan_tien_duoi_6h      // "0"
```

---

## 3. `chuyen_khoa` — Model: `ChuyenKhoa`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `ten` | String | required | `trim`, `maxlength: 255` |
| `mo_ta` | String | default `null` | |
| `icon_url` | String | default `null` | `maxlength: 500` |
| `slug` | String | required (tự sinh nếu chưa có) | `unique`, `lowercase`, `trim`, `maxlength: 255` |
| `thu_tu` | Number | default `0` | |
| `status` | String | default `'active'` | enum: `active`, `hidden` |
| `ngay_tao` | Date | auto (chỉ `createdAt`, không có `updatedAt`) | |

**Index:** `status`, `thu_tu`

**Hook (`pre('validate')`):** nếu `slug` rỗng và có `ten` → tự sinh bằng hàm
`toSlug()` (bỏ dấu tiếng Việt, kebab-case). ⚠️ Hàm `toSlug()` dùng regex
`[̀-ͯ]` (ký tự tổ hợp Unicode thô, chưa đổi sang escape `\u0300-\u036f`).

---

## 4. `nguoi_dung` — Model: `NguoiDung`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `email` | String | required | `unique`, `lowercase`, `trim`, `maxlength: 255`, **`immutable: true`** 🆕 |
| `mat_khau` | String | required | `maxlength: 255`, `select: false` (không trả về query thường) |
| `ho_ten` | String | required | `trim`, `maxlength: 255` |
| `so_dien_thoai` | String | default `null` | `maxlength: 20` |
| `anh_dai_dien` | String | default `null` | `maxlength: 500` |
| `role` | String | default `'user'` | enum: `user`, `doctor`, `admin` |
| `status` | String | default `'active'` | enum: `active`, `locked` |
| `ngay_tao` | Date | auto | |
| `ngay_cap_nhat` | Date | auto | |

**Index:** `role`, `status`
**Hook:** không có.

---

## 5. `dat_lai_mat_khau` — Model: `DatLaiMatKhau`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `user_id` | ObjectId → `NguoiDung` | required | |
| `ma_otp` | String | required | `length: 6` |
| `het_han` | Date | required | now + 15 phút (tính ở service layer) |
| `da_su_dung` | Boolean | default `false` | |
| `ngay_tao` | Date | auto (chỉ `createdAt`) | |

**Index:** `user_id`, `ma_otp`, **TTL** trên `het_han` (`expireAfterSeconds: 3600`) → tự xóa sau 1 giờ.
**Hook:** không có (logic "đánh dấu OTP cũ `da_su_dung=true`" nằm ở service layer).

---

## 6. `gia_dinh` — Model: `GiaDinh`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `user_id` | ObjectId → `NguoiDung` | required | `unique` (1 tài khoản = 1 nhóm) |
| `ten_nhom` | String | required | `trim`, `maxlength: 255` |
| `ngay_tao` | Date | auto (chỉ `createdAt`) | |

**Index:** không có index riêng (ngoài unique `user_id`).
**Hook:** không có.

---

## 7. `thanh_vien` — Model: `ThanhVien`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `family_id` | ObjectId → `GiaDinh` | required | |
| `ho_ten` | String | required | `trim`, `maxlength: 255` |
| `ngay_sinh` | Date | required | phải là ngày trong quá khứ (custom validator) |
| `gioi_tinh` | String | required | enum: `nam`, `nu`, `khac` |
| `nhom_mau` | String | default `null` | enum: `A`, `B`, `AB`, `O`, `null` |
| `di_ung` | String | default `null` | |
| `benh_nen` | String | default `null` | |
| `la_chu_ho` | Boolean | default `false` | Không được xóa (chỉ enforce ở **service layer**) |
| `ngay_xoa` | Date | default `null` | Soft delete |
| `ngay_tao` | Date | auto | |
| `ngay_cap_nhat` | Date | auto | |

**Index:** `family_id`, `ngay_xoa`, `la_chu_ho`

**Hook (`pre('validate')`, async):** nếu tạo mới (`isNew`) và `ngay_xoa` rỗng →
đếm số thành viên còn sống (`ngay_xoa: null`) cùng `family_id`; nếu `>= 10` →
throw lỗi "tối đa 10 thành viên".

---

## 8. `bac_si` — Model: `BacSi`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `user_id` | ObjectId → `NguoiDung` | required | `unique` |
| `tieu_su` | String | default `null` | |
| `bang_cap` | String | default `null` | |
| `kinh_nghiem` | String | default `null` | |
| `so_nam_kinh_nghiem` | Number | default `0` | `min: 0` |
| `phi_tu_van` | Number | default `0` | `min: 0` (chỉ hiển thị, không dùng tính tiền) |
| `trang_thai_duyet` | String | default `'pending'` | enum: `pending`, `approved`, `rejected`, **`rejected_final`** 🆕, `suspended` |
| `ly_do_tu_choi` | String | default `null` | Lý do của lần từ chối **gần nhất** |
| `lich_su_tu_choi` | [SubSchema] 🆕 | default `[]` | Xem subschema bên dưới |
| `so_lan_nop` | Number | default `1` | `min: 1`, `max: 5` |
| `la_hien` | Boolean | **default `false`** 🆕 (trước đây `true`) | |
| `diem_danh_gia` | Number | default `0` | `min: 0`, `max: 5` |
| `tong_danh_gia` | Number | default `0` | `min: 0` |
| `specialties` | [ObjectId → `ChuyenKhoa`] | default `[]` | |
| `services` | [ObjectId → `DichVu`] | default `[]` | |
| `ngay_tao` | Date | auto | |
| `ngay_cap_nhat` | Date | auto | |

**Subschema `lich_su_tu_choi[]` (🆕, `_id: false`):**

| Field | Type | Ràng buộc |
|---|---|---|
| `lan` | Number | required |
| `ly_do` | String | required |
| `ngay` | Date | default `Date.now` |

**Index:** `{trang_thai_duyet, la_hien, specialties}` (compound 🆕), `{la_hien, trang_thai_duyet, diem_danh_gia: -1}` (compound 🆕), `services`

**Hook (2× `pre('save')`):**
1. Nếu `trang_thai_duyet !== 'approved'` → ép `la_hien = false`
2. Nếu `trang_thai_duyet === 'rejected'` và `so_lan_nop >= 5` → tự đổi thành
   `rejected_final`; nếu đang chuyển sang `rejected`/`rejected_final` và có
   `ly_do_tu_choi` → push vào `lich_su_tu_choi`

---

## 9. `lich_lam_viec` — Model: `LichLamViec`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `doctor_id` | ObjectId → `BacSi` | required | |
| `ngay` | Date | required | 1 bác sĩ × 1 ngày = 1 doc |
| `slots` | [SlotSchema] | default `[]` | Xem subschema bên dưới |
| `ngay_tao` | Date | auto | |
| `ngay_cap_nhat` | Date | auto | |

**Subschema `slots[]` (`_id: true`):**

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `_id` | ObjectId | auto | Dùng làm `LichHen.slot_id` |
| `gio_bat_dau` | String | required | regex `HH:MM` |
| `gio_ket_thuc` | String | required | regex `HH:MM`, phải sau `gio_bat_dau` |
| `benh_nhan_id` | ObjectId → `NguoiDung` | default `null` | null = chưa có ai. Set khi `status='booked'`, reset khi `'active'` |
| `phong_kham` | String | default `null` | `maxlength: 255`. VD `"Phòng 201, Tầng 2, Tòa A"`. `null` = chưa phân phòng |
| `status` | String | default `'active'` | enum: `active`, `pending_payment`, `booked`, `locked`, `cancelled`, `expired` |
| `lock_expires_at` | Date | default `null` | Set = `now + 15 phút` khi `status → 'pending_payment'`. Reset = `null` khi `→ 'active'` hoặc `'booked'` |

> **Quy tắc thiết kế:** 1 slot = đúng 1 bệnh nhân. Không dùng cơ chế đếm (`count`) để
> quản lý sức chứa.

**Ý nghĩa các trạng thái slot:**

| Status | Hiển thị | BN thấy? | Ghi chú |
|---|---|---|---|
| `active` | Còn trống | **Có** (nếu có `phong_kham`) | Slot mở, BN có thể đặt |
| `pending_payment` | Đang được giữ | Không | BN khác đang thanh toán VNPay — ẩn khỏi lịch. Tự giải phóng sau 15 phút |
| `booked` | Đã có lịch | Không | Đã thanh toán và tạo LichHen — không đặt thêm |
| `locked` | Bác sĩ bận | Không | Bác sĩ tự đánh dấu bận |
| `cancelled` | Đã hủy | Không | Slot bị hủy |
| `expired` | Hết hạn | Không | Quá ngày (cron 00:05 đánh dấu) |

**Điều kiện BN thấy slot (API `/api/doctors/:id/available-slots`):**
```
status = 'active'          // pending_payment KHÔNG hiển thị
AND ngay + gio_bat_dau >= now + 3 giờ
```

**Soft-lock flow (POST /prepare → VNPay IPN):**
```
1. POST /prepare: atomic update slot: status='active' → 'pending_payment', lock_expires_at=now+15min
2. VNPay IPN SUCCESS: slot → 'booked', benh_nhan_id=user_id, lock_expires_at=null → tạo LichHen
3. VNPay IPN FAIL/HỦY: slot → 'active', lock_expires_at=null
4. Cron 5 phút: slot pending_payment đã hết hạn → 'active', lock_expires_at=null
5. Lazy reset: GET /available-slots dọn pending_payment hết hạn fire-and-forget
```

**Index:** `{doctor_id, ngay}` (unique), `ngay`

**Hook:** `slotSchema.pre('validate')` — `gio_ket_thuc` phải sau `gio_bat_dau`.

---

## 10. `dich_vu` — Model: `DichVu`

> **Loại dịch vụ:**
> - `home` → bác sĩ đến nhà BN, đặt được trực tiếp, có `thoi_gian_phut` và `khu_vuc[]`.
> - `related` → dịch vụ liên quan theo chuyên khoa (siêu âm, MRI, xét nghiệm…). Chỉ hiển thị
>   thông tin tham khảo "Theo chỉ định bác sĩ" — **BN không đặt trực tiếp**. Bắt buộc có `specialty_id`.
> - ⚠️ **Không có loại `clinic`** — giá khám clinic lưu ở `BacSi.gia_kham`, không phải `DichVu`.

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `ma_dich_vu` | String | tự sinh "DV001"... | `unique`, `trim` |
| `ten` | String | required | `trim`, `maxlength: 255` |
| `loai` | String | required | enum: `home`, `related` |
| `mo_ta_ngan` | String | default `null` | `maxlength: 500` |
| `mo_ta` | String | default `null` | `maxlength: 5000` |
| `gia` | Number | required | `min: 1`, `max: 100_000_000`, phải là số nguyên VNĐ. `home`: snapshot vào `LichHen.gia_kham`. `related`: chỉ hiển thị tham khảo |
| `thoi_gian_phut` | Number | default `null` | `min: 10`, `max: 480`. Hook tự set: `related`=30ph, `home`=60ph |
| `gio_dat_truoc_toi_thieu` | Number | default `4` | `min: 1`, `max: 48`. Giờ. Chỉ dùng cho `home` |
| `ngay_ap_dung` | String | default `null` | `maxlength: 100`. Hook tự set `'T2–T7'` nếu chưa có |
| `gio_bat_dau` | String | default `null` | Hook tự set `'08:00'` nếu chưa có |
| `gio_ket_thuc` | String | default `null` | Hook tự set `'17:00'` nếu chưa có |
| `chuan_bi_truoc` | String | default `null` | `maxlength: 1000`. Chỉ dùng cho `related` (nhịn ăn, tháo trang sức…). `home` = null |
| `specialty_id` | ObjectId → `ChuyenKhoa` | default `null` | Bắt buộc khi `related` (validate ở controller) |
| `khu_vuc` | [String] | default `[]` | Chỉ dùng khi `home`. Hook tự reset `[]` khi `related` |
| `nguoi_tao_id` | ObjectId → `NguoiDung` | default `null` | Admin tạo dịch vụ |
| `status` | String | default `'active'` | enum: `active`, `inactive` |
| `ngay_tao` | Date | auto | |
| `ngay_cap_nhat` | Date | auto | |

**Index:** `{ten, specialty_id}` (unique), `{status, loai}`

**Hook (`pre('validate')`, async):** tự sinh `ma_dich_vu` bằng atomic counter (`Counter.nextSeq`);
đặt lịch cố định `T2–T7 08:00–17:00` nếu chưa có; nếu `loai='home'` → set `thoi_gian_phut=60`,
xóa `chuan_bi_truoc`; nếu `loai='related'` → set `thoi_gian_phut=30`, reset `khu_vuc=[]`.

---

## 11. `lich_hen` — Model: `LichHen` ⭐ (bảng trung tâm)

> **Luồng clinic (Phương án C + soft-lock):** Slot chỉ bị lock sau khi payment gateway xác nhận.
> LichHen được tạo với `payment_status='paid'` ngay lập tức (không qua `unpaid`).
> Admin xem danh sách `pending+paid` → xác nhận → `confirmed`. Cron tự cancel nếu qua `confirm_deadline`.
>
> **Luồng home:** Bác sĩ confirm trước → BN thanh toán → `payment_status='paid'`.
> `payment_status='unpaid'` chỉ có ở home.

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `user_id` | ObjectId → `NguoiDung` | required | Người đăng nhập đặt lịch |
| `member_id` | ObjectId → `ThanhVien` | default `null` | `null` = khách (đặt cho mình hoặc nhập tay) |
| `doctor_id` | ObjectId → `BacSi` | required | |
| `schedule_id` | ObjectId → `LichLamViec` | default `null` | required khi `clinic`; `null` khi `home` |
| `slot_id` | ObjectId | default `null` | `_id` của subdoc `slots[]`; required khi `clinic` |
| `service_id` | ObjectId → `DichVu` | default `null` | required khi `home` (ref `DichVu.loai='home'`); `null` khi `clinic` |
| `loai_kham` | String | required | enum: `clinic`, `home` |
| `ngay_kham` | Date | required | |
| `gio_kham` | String | required | VD `"08:30"` |
| `ly_do_kham` | String | default `null` | `maxlength: 500` |
| `phong_kham` | String | default `null` | Snapshot `slots[].phong_kham` lúc đặt clinic; `null` khi home |
| `dia_chi_kham` | String | default `null` | Bắt buộc khi `home` (địa chỉ home visit) |
| `status` | String | default `'pending'` | enum: `pending`, `confirmed`, `completed`, `cancelled` |
| `payment_status` | String | default `'unpaid'` | enum: `unpaid`, `paid`, `refunded`. Clinic luôn bắt đầu `paid` |
| `gia_kham` | Number | required | `min: 0`. Clinic: snapshot `BacSi.gia_kham`; Home: snapshot `DichVu.gia` |
| `ten_dich_vu` | String | default `null` | `maxlength: 255`. Clinic: tên chuyên khoa; Home: tên dịch vụ |
| `ten_khach` | String | default `null` | `maxlength: 255`. Bắt buộc khi `member_id=null` |
| `gioi_tinh_khach` | String | default `null` | enum: `male`, `female` |
| `so_dien_thoai_khach` | String | default `null` | `maxlength: 20` |
| `email_khach` | String | default `null` | `maxlength: 255`, lowercase, trim |
| `nam_sinh_khach` | Number | default `null` | |
| `tinh_thanh` | String | default `null` | `maxlength: 100`. Tỉnh/thành phố BN |
| `phuong_xa` | String | default `null` | `maxlength: 100`. Phường/xã BN |
| `dia_chi_chi_tiet` | String | default `null` | `maxlength: 255`. Số nhà, đường BN (≠ `dia_chi_kham` là địa chỉ home visit) |
| `nguoi_dat_ho_ten` | String | default `null` | `maxlength: 255`. Người đặt hộ (chỉ khi "Đặt cho người thân") |
| `nguoi_dat_sdt` | String | default `null` | `maxlength: 20`. SĐT người đặt hộ |
| `ly_do_huy` | String | default `null` | |
| `confirmed_by` | ObjectId → `NguoiDung` | default `null` | Admin._id đã confirm; `null` = chưa confirm |
| `confirm_deadline` | Date | default `null` | Auto-set = `ngay_kham + gio_kham − 30 phút` (clinic). Cron: pending clinic quá deadline → auto-cancel |
| `admin_missed` | Boolean | default `false` | `true` khi cron auto-cancel vì Admin không confirm kịp — audit SLA |
| `payment_deadline` | Date | default `null` | Home: BS confirm → BN phải thanh toán trước thời điểm này |
| `pending_booking_id` | String | default `null` | UUID token tạo tại `POST /prepare` — dùng để match IPN callback VNPay. Giữ lại sau khi LichHen tạo xong để audit dispute |
| `ngay_tao` | Date | auto | |
| `ngay_cap_nhat` | Date | auto | |

**Phân biệt 3 chế độ đặt lịch:**

| Chế độ | `member_id` | `nguoi_dat_ho_ten` | Thông tin BN |
|---|---|---|---|
| Đặt cho mình | `null` | `null` | `ten_khach`, `so_dien_thoai_khach`… |
| Đặt cho người thân (GĐ) | `ThanhVien._id` | điền | Lấy từ ThanhVien |
| Đặt cho người thân (nhập tay) | `null` | điền | `ten_khach`, `so_dien_thoai_khach`… |

**Index:** `user_id`, `member_id`, `status`, `payment_status`, `ngay_kham`,
`schedule_id`, `{doctor_id, status, ngay_kham}` (compound),
`{status, loai_kham, confirm_deadline}` (cron auto-cancel clinic),
`confirmed_by`, `admin_missed`

**Hooks:**
1. `pre('validate')`: `home` → bắt buộc `dia_chi_kham` + `service_id`; `clinic` → bắt buộc `schedule_id` + `slot_id`; tự xóa field trái loại
2. `pre('validate')`: `member_id=null` → bắt buộc `ten_khach`
3. `pre('save')` — auto-set `confirm_deadline` khi tạo mới clinic: `= ngay_kham + gio_kham − 30 phút`

---

## 12. `thanh_toan` — Model: `ThanhToan`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `appointment_id` | ObjectId → `LichHen` | required | `unique` |
| `benh_nhan_id` | ObjectId → `NguoiDung` | required | |
| `so_tien` | Number | required | `min: 0` |
| `status` | String | default `'pending'` | enum: `pending`, `paid`, `failed`, `refunded` |
| `phuong_thuc` | String | default `'mock'` | `maxlength: 50` |
| `ngay_thanh_toan` | Date | default `null` | Set khi `status → 'paid'` |
| `ngay_tao` | Date | auto | |
| `ngay_cap_nhat` | Date | auto | |

**Index:** `benh_nhan_id`, `status`
**Hook:** không có.

---

## 13. `hoan_tien` — Model: `HoanTien`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `payment_id` | ObjectId → `ThanhToan` | required | |
| `appointment_id` | ObjectId → `LichHen` | required | `unique` |
| `so_tien_hoan` | Number | required | `min: 0` |
| `phan_tram_hoan` | Number | required | **`min: 0`, `max: 100`** 🆕 (trước đây `enum: [0,50,80,100]`) |
| `ly_do` | String | default `null` | |
| `status` | String | default `'pending'` | enum: `pending`, `completed`, `rejected` |
| `ly_do_tu_choi` | String | default `null` | Bắt buộc khi `rejected` (tầng service) |
| `xu_ly_boi` | ObjectId → `NguoiDung` | default `null` | Admin xử lý |
| `ngay_yeu_cau` | Date | default `Date.now` | |
| `ngay_xu_ly` | Date | default `null` | |

**Index:** `status`, `payment_id`
**Lưu ý:** `timestamps: false` — không có `ngay_tao`/`ngay_cap_nhat` tự động (đã có `ngay_yeu_cau`/`ngay_xu_ly` thay thế).
**Hook:** không có.

---

## 14. `ho_so_y_te` — Model: `HoSoYTe`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `member_id` | ObjectId → `ThanhVien` | default `null` | |
| `appointment_id` | ObjectId → `LichHen` | default `null` | Bắt buộc khi `nguon='tu_kham'` |
| `ten_khach` | String | default `null` | `maxlength: 255` |
| `ngay_kham` | Date | required | Không được là tương lai (custom validator) |
| `ten_benh_vien` | String | default `null` | `maxlength: 255` (dùng cho `nguon='thu_cong'`) |
| `ten_bac_si` | String | default `null` | `maxlength: 255` (dùng cho `nguon='thu_cong'`) |
| `ly_do_kham` | String | default `null` | |
| `chan_doan` | String | default `null` | |
| `ghi_chu` | String | default `null` | |
| `nguon` | String | default `'tu_kham'` | enum: `tu_kham`, `thu_cong` |
| `ngay_tao` | Date | auto | |
| `ngay_cap_nhat` | Date | auto | |

**Index:** `member_id`, `{appointment_id}` (**unique, partial** 🆕 — chỉ áp dụng khi `nguon='tu_kham'`), `ngay_kham` (desc)

**Hook (`pre('validate')`):**
- `nguon='tu_kham'` → bắt buộc `appointment_id`
- Mọi hồ sơ → bắt buộc `member_id` HOẶC `ten_khach`

---

## 15. `ket_qua_kham` — Model: `KetQuaKham`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `appointment_id` | ObjectId → `LichHen` | required | `unique` |
| `chan_doan` | String | required | `trim` |
| `huong_dan_dieu_tri` | String | default `null` | |
| `ghi_chu` | String | default `null` | |
| `ngay_tai_kham` | Date | default `null` | |
| `co_the_sua` | Boolean | default `true` | Khóa sau 24h |
| `ngay_tao` | Date | auto | |
| `ngay_cap_nhat` | Date | auto | |

**Index:** chỉ unique trên `appointment_id`, không có index phụ.

**Hook (🆕 `pre` + `post('save')`):** mỗi khi tạo mới hoặc sửa `chan_doan`/`ghi_chu`
→ tự đồng bộ `$set` 2 field này sang `HoSoYTe` tương ứng (`appointment_id` + `nguon='tu_kham'`).

**Static method 🆕 — `lockExpired()`:** dùng cho cron — set `co_the_sua=false`
cho mọi doc `co_the_sua=true` và `ngay_tao` quá 24h.

---

## 16. `don_thuoc` — Model: `DonThuoc`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `medical_record_id` | ObjectId → `HoSoYTe` | default `null` | |
| `member_id` | ObjectId → `ThanhVien` | default `null` | `null` khi kê cho khách vãng lai |
| `ten_khach` | String | default `null` | `maxlength: 255` |
| `doctor_id` | ObjectId → `BacSi` | default `null` | `null` khi `nguon='tu_nhap'` |
| `nguon` | String | default `'tu_nhap'` | enum: `bac_si`, `tu_nhap` |
| `ghi_chu` | String | default `null` | |
| `items` | [ItemSchema] | required (1–10 phần tử) | Xem subschema dưới |
| `ngay_tao` | Date | auto (chỉ `createdAt`) | |

**Subschema `items[]` (`_id: true`):**

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `ten_thuoc` | String | required | `trim`, `maxlength: 255` |
| `lieu_luong` | String | default `null` | `maxlength: 100` |
| `tan_suat` | String | default `null` | `maxlength: 100` |
| `gio_uong` | [String] | default `[]` | mỗi phần tử phải đúng dạng `HH:MM` |
| `ngay_bat_dau` | Date | required | |
| `ngay_ket_thuc` | Date | required | phải `>= ngay_bat_dau`, tối đa 90 ngày sau |

**Index:** `member_id`, `medical_record_id`

**Hook (`pre('validate')` ở cả 2 schema):**
- *ItemSchema:* `ngay_ket_thuc >= ngay_bat_dau` và chênh lệch `<= 90` ngày
- *PrescriptionSchema (🆕 đã siết lại):*
  - `nguon='tu_nhap'` → bắt buộc `member_id`
  - `nguon='bac_si'` + không có `member_id` → **bắt buộc `ten_khach`** 🆕 (trước đây thiếu điều kiện này)
  - `nguon='bac_si'` + không có `member_id` → bắt buộc `medical_record_id`

---

## 17. `nhac_nho` — Model: `NhacNho`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `prescription_id` | ObjectId → `DonThuoc` | required | |
| `prescription_item_id` | ObjectId | required | `_id` của subdoc `items` trong `DonThuoc` |
| `user_id` | ObjectId → `NguoiDung` | required | |
| `gio_nhac` | Date | required | |
| `status` | String | default `'pending'` | enum: `pending`, `sent`, `taken`, `missed` |
| `ngay_gui` | Date | default `null` | |
| `ngay_tao` | Date | auto (chỉ `createdAt`) | |

**Index:** `{status, gio_nhac}`, `{status, ngay_gui}`, `user_id`, `prescription_id`, `prescription_item_id`
**Hook:** không có (toàn bộ luồng `pending→sent→taken/missed` do cron + tầng service xử lý).

---

## 18. `danh_gia` — Model: `DanhGia`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `appointment_id` | ObjectId → `LichHen` | required | `unique` |
| `user_id` | ObjectId → `NguoiDung` | required | |
| `doctor_id` | ObjectId → `BacSi` | required | |
| `so_sao` | Number | required | `min: 1`, `max: 5`, phải là số nguyên |
| `noi_dung` | String | default `null` | `maxlength: 500` |
| `status` | String | default `'visible'` | enum: `visible`, `hidden` |
| `ngay_tao` | Date | auto (chỉ `createdAt`) | |

**Index:** `{doctor_id, status, so_sao}`, `user_id`, `status`
**Hook:** không có (side effect cập nhật `BacSi.diem_danh_gia`/`tong_danh_gia` ở tầng service khi `status` đổi).

---

## 19. `thong_bao` — Model: `ThongBao`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `user_id` | ObjectId → `NguoiDung` | required | |
| `tieu_de` | String | required | `maxlength: 255` |
| `noi_dung` | String | required | |
| `loai` | String | required | enum: `appointment`, `medicine`, `system` |
| `related_id` | ObjectId | default `null` | |
| `related_type` | String | default `null` | `maxlength: 50` (`'appointment'`\|`'medical_record'`\|`'reminder'`) |
| `da_doc` | Boolean | default `false` | |
| `ngay_tao` | Date | auto (chỉ `createdAt`) | |

**Index:** `{user_id, da_doc}` (unread count), `ngay_tao` (cron cleanup — **KHÔNG** phải TTL).
**Hook:** không có.

---

## 20. `thong_bao_he_thong` — Model: `ThongBaoHeThong`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `tieu_de` | String | required | `maxlength: 60` |
| `noi_dung` | String | required | |
| `url` | String | default `null` | `maxlength: 500` |
| `doi_tuong` | String | required | enum: `tat_ca`, `benh_nhan`, `bac_si` |
| `tao_boi` | ObjectId → `NguoiDung` | required | Admin |
| `ngay_gui` | Date | default `null` | |
| `so_nguoi_nhan` | Number | default `0` | `min: 0` |
| `status` | String | default `'draft'` 🆕 | **enum: `draft`, `sending`, `sent`, `failed`** 🆕 (trước đây chỉ `['da_gui']`) |
| `loi_gui` | String 🆕 | default `null` | Ghi lỗi nếu `status='failed'` |
| `ngay_tao` | Date | auto (chỉ `createdAt`) | |

**Index:** `tao_boi`, `ngay_gui` (desc), `status` 🆕
**Hook:** không có.

---

## 21. `phien_chat` — Model: `PhienChat`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `user_id` | ObjectId → `NguoiDung` | required | |
| `ngay_bat_dau` | Date | default `Date.now` | |
| `ngay_ket_thuc` | Date | default `null` | `null` = đang mở |

**Index:** `user_id`. **Lưu ý:** `timestamps: false` — không có `ngay_tao`/`ngay_cap_nhat`.
**Hook:** không có.

---

## 22. `tin_nhan_chat` — Model: `TinNhanChat`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `session_id` | ObjectId → `PhienChat` | required | |
| `vai_tro` | String | required | enum: `user`, `ai` |
| `noi_dung` | String | required | `maxlength: 5000` |
| `thoi_diem` | Date | default `Date.now` | |

**Index:** `{session_id, thoi_diem}`. **Lưu ý:** `timestamps: false`.
**Hook:** không có.

---

## 23. `nhat_ky_thao_tac` — Model: `NhatKyThaoTac`

Chỉ INSERT, không update/delete (log bất biến).

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `nguoi_thuc_hien_id` | ObjectId → `NguoiDung` | default `null` | `null` khi `vai_tro='system'` |
| `vai_tro` | String | required | enum: `admin`, `doctor`, `user`, `system` |
| `hanh_dong` | String | required | `maxlength: 100` (xem danh sách đầy đủ trong comment đầu file) |
| `loai_doi_tuong` | String | required | `maxlength: 50` |
| `doi_tuong_id` | ObjectId | required | |
| `ly_do` | String | default `null` | |
| `du_lieu_cu` | Mixed | default `null` | JSON snapshot trước khi đổi |
| `du_lieu_moi` | Mixed | default `null` | JSON snapshot sau khi đổi |
| `ngay_tao` | Date | auto (chỉ `createdAt`) | |

**Index:** `nguoi_thuc_hien_id`, `vai_tro`, `hanh_dong`, `{loai_doi_tuong, doi_tuong_id}`, `ngay_tao` (desc)
**Hook:** không có.

**Danh sách `hanh_dong` hợp lệ (quy ước, không phải enum cứng trong schema):**
`LOCK_USER`, `UNLOCK_USER`, `APPROVE_DOCTOR`, `REJECT_DOCTOR`, `SUSPEND_DOCTOR`,
`RESTORE_DOCTOR`, `CREATE_SERVICE`, `UPDATE_SERVICE`, `ACTIVATE_SERVICE`,
`DEACTIVATE_SERVICE`, `CREATE_SPECIALTY`, `UPDATE_SPECIALTY`, `HIDE_SPECIALTY`,
`RESTORE_SPECIALTY`, `UPDATE_CLINIC_INFO`, `UPDATE_PAYMENT_SETTING`,
`HIDE_REVIEW`, `RESTORE_REVIEW`, `DELETE_REVIEW`, `APPROVE_REFUND`,
`REJECT_REFUND`, `UPDATE_DOCTOR_PROFILE`, `CREATE_SCHEDULE`, `CANCEL_SLOT`,
`UPDATE_SLOT`, `UPDATE_EXAMINATION_RESULT`, `AUTO_CANCEL_APPOINTMENT`,
`LOCK_EXAMINATION_RESULT`, `MARK_REMINDER_MISSED`.

---

## 24. `lich_su_lich_hen` — Model: `LichSuLichHen`

| Field | Type | Bắt buộc/Default | Ràng buộc |
|---|---|---|---|
| `appointment_id` | ObjectId → `LichHen` | required | |
| `tu_trang_thai` | String | default `null` | `null` khi mới tạo lịch |
| `den_trang_thai` | String | required | |
| `tu_payment_status` | String | default `null` | |
| `den_payment_status` | String | default `null` | |
| `nguoi_thuc_hien_id` | ObjectId → `NguoiDung` | default `null` | `null` khi `vai_tro='system'` |
| `vai_tro` | String | required | enum: `admin`, `doctor`, `user`, `system` |
| `ly_do` | String | default `null` | |
| `thoi_diem` | Date | default `Date.now` | |

**Index:** `{appointment_id, thoi_diem}`, `nguoi_thuc_hien_id`, `{vai_tro, thoi_diem}` (desc)
**Lưu ý:** `timestamps: false` (dùng `thoi_diem` thay thế).
**Hook:** không có.

---

## Phụ lục A — Bảng tổng hợp toàn bộ ref (quan hệ giữa các collection)

| Field tham chiếu | Model nguồn | Trỏ tới model |
|---|---|---|
| `user_id` | DatLaiMatKhau, GiaDinh, BacSi, LichHen, ThanhToan, PhienChat, NhatKyThaoTac (`nguoi_thuc_hien_id`), LichSuLichHen (`nguoi_thuc_hien_id`), DanhGia, ThongBao, ThongBaoHeThong (`tao_boi`), NhacNho | `NguoiDung` |
| `family_id` | ThanhVien | `GiaDinh` |
| `member_id` | LichHen, HoSoYTe, DonThuoc | `ThanhVien` |
| `doctor_id` | LichLamViec, LichHen, DonThuoc, DanhGia | `BacSi` |
| `specialty_id` | DichVu | `ChuyenKhoa` |
| `specialties[]` | BacSi | `ChuyenKhoa` |
| `services[]` | BacSi | `DichVu` |
| `service_id` | LichHen | `DichVu` |
| `schedule_id` | LichHen | `LichLamViec` |
| `appointment_id` | ThanhToan, HoanTien, HoSoYTe, KetQuaKham, DanhGia, LichSuLichHen | `LichHen` |
| `payment_id` | HoanTien | `ThanhToan` |
| `medical_record_id` | DonThuoc | `HoSoYTe` |
| `prescription_id` | NhacNho | `DonThuoc` |
| `session_id` | TinNhanChat | `PhienChat` |
| `xu_ly_boi` | HoanTien | `NguoiDung` |

## Phụ lục B — Bảng nào KHÔNG có index ngoài unique mặc định

`thong_tin_phong_kham`, `cai_dat_thanh_toan`, `gia_dinh` — cả 3 đều là bảng nhỏ
(singleton hoặc 1-1 với user), tần suất truy vấn thấp, không cần thêm index phụ.

## Phụ lục C — Bảng nào tắt `timestamps` mặc định hoặc tùy biến

| Collection | Tùy biến |
|---|---|
| `hoan_tien` | `timestamps: false` (dùng `ngay_yeu_cau`/`ngay_xu_ly` riêng) |
| `phien_chat` | `timestamps: false` |
| `tin_nhan_chat` | `timestamps: false` (dùng `thoi_diem`) |
| `lich_su_lich_hen` | `timestamps: false` (dùng `thoi_diem`) |
| `cai_dat_thanh_toan` | chỉ `updatedAt`, không có `createdAt` |
| `chuyen_khoa`, `gia_dinh`, `don_thuoc`, `nhac_nho`, `danh_gia`, `thong_bao`, `thong_bao_he_thong`, `dat_lai_mat_khau`, `nhat_ky_thao_tac` | chỉ `createdAt` (`ngay_tao`), không có `updatedAt` |
| Các collection còn lại | đầy đủ `ngay_tao` + `ngay_cap_nhat` |
