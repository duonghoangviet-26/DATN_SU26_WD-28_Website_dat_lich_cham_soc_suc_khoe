# Spec: Quản lý Lịch hẹn của Bác sĩ — B3 + B4

> **Ngày tạo:** 2026-06-17
> **Cập nhật:** 2026-06-22 (v3 — sync với code hiện tại)
> **Actor:** Bác sĩ đã đăng nhập (`trang_thai_duyet = 'approved'`)
> **Route:** `/doctor/appointments`
> **Chức năng:** B3 — Xác nhận & quản lý lịch hẹn · B4 — Ghi kết quả khám & kê đơn thuốc
> **Trạng thái:** ✅ Implemented (mock data) — chờ gắn MongoDB

---

## 1. Mục tiêu tính năng

Trang `/doctor/appointments` là nơi bác sĩ xử lý **toàn bộ vòng đời** của lịch hẹn từ khi bệnh nhân đặt đến khi kết thúc điều trị. Bác sĩ cần trả lời được 3 câu hỏi chính:

1. **Lịch hẹn nào chưa xác nhận cần xử lý ngay?** (tab "Chưa xác nhận")
2. **Hôm nay tôi khám ai, ở phòng nào / địa chỉ nào?** (tab "Hôm nay")
3. **Kết quả khám đã ghi đầy đủ chưa?** (tab "Đã qua")

---

## 2. Điều kiện truy cập

| `trang_thai_duyet` | Hành vi |
|---|---|
| `approved` | Truy cập đầy đủ |
| `pending` / `rejected` / `suspended` | Redirect `/doctor` với banner cảnh báo |

---

## 3. State Machine — Trạng thái Lịch hẹn

### 3.1 Sơ đồ chuyển trạng thái

```
[Bệnh nhân đặt + thanh toán]
              │
              ▼
          PENDING ──── Bác sĩ từ chối (modal lý do) ─────────────────────────┐
              │         → payment_status: paid → refunded                      │
              │                                                                 ▼
         Bác sĩ xác nhận (chỉ khi paid) ──────────────────────────────► CANCELLED
              │                                                                 ▲
              ▼                                                                 │
          CONFIRMED ──── Bác sĩ hủy (modal lý do) ──────────────────────────┤
              │            → payment_status: paid → refunded 100%              │
              │                                                                 │
         Bác sĩ hoàn thành                                                     │
              │                                                                 │
              ▼                                                                 │
          COMPLETED                                                             │
              └──► ExamModal: ghi kết quả + kê đơn thuốc                      │
                       < 24h: co_the_sua=true → sửa được                      │
                       ≥ 24h: co_the_sua=false → readonly vĩnh viễn           │
```

### 3.2 Bảng chuyển trạng thái

| Từ | Sang | Điều kiện | Hệ quả |
|---|---|---|---|
| `pending` | `confirmed` | `payment_status='paid'` + bác sĩ confirm | Bệnh nhân nhận notification + email |
| `pending` | `cancelled` | Bác sĩ từ chối, nhập lý do | `payment_status: paid → refunded`; email bệnh nhân kèm lý do |
| `pending` | `cancelled` | Cron: `unpaid` quá 15 phút | Slot trả về `active` |
| `confirmed` | `completed` | Bác sĩ hoàn thành | Cho phép ghi kết quả |
| `confirmed` | `cancelled` | Bác sĩ hủy, nhập lý do | Hoàn 100% bất kể thời điểm |

> `cancelled` và `completed` là **trạng thái cuối** — không thể chuyển đổi thêm.

### 3.3 Quy tắc bất biến

1. `cancelled` / `completed` → không thể chuyển về trạng thái khác.
2. `pending` + `payment_status='unpaid'` → **không** hiện nút "Xác nhận".
3. Bác sĩ **chỉ thấy** lịch của chính mình — filter `doctor_id` ở **backend**.
4. `da_co_ket_qua` chỉ set `true` khi `examinationService.save()` thành công.

---

## 4. Business Rules chi tiết

### 4.1 Chính sách xác nhận

| Kịch bản | Quy tắc |
|---|---|
| `pending` + `payment_status='unpaid'` | Ẩn nút "Xác nhận" — chỉ có "Từ chối" |
| `pending` + `ngay_kham < hôm nay` (hết hạn) | Ẩn "Xác nhận", badge "Hết hạn", chỉ còn "Từ chối" |
| `pending` + `payment_status='paid'` + ngày hợp lệ | Hiện cả "Xác nhận" và "Từ chối" |

### 4.2 Chính sách hoàn tiền

| Thời gian hủy trước lịch khám | Bệnh nhân hủy | Bác sĩ hủy |
|---|---|---|
| ≥ 24 giờ | 100% | **100%** |
| 12 – 24 giờ | 80% | **100%** |
| 6 – 12 giờ | 50% | **100%** |
| < 6 giờ | 0% | **100%** |

Bác sĩ hủy → **luôn hoàn 100%** bất kể thời điểm — bảo vệ bệnh nhân.

### 4.3 Phòng khám / Địa điểm khám

| `loai_kham` | Hiển thị | Nguồn |
|---|---|---|
| `clinic` | **Phòng khám**: "Phòng 201, Tầng 2, Tòa A" | Snapshot từ `slots[].phong_kham` khi đặt lịch |
| `home` | **Địa chỉ bác sĩ đến**: "12 Nguyễn Trãi, Q. Thanh Xuân..." | `lich_hen.dia_chi_kham` — bệnh nhân nhập khi đặt |

Phòng mặc định của bác sĩ lưu trong `bac_si.phong_kham_mac_dinh` (xem DB_GAP_ANALYSIS.md GAP-12). Khi lịch làm việc thay đổi phòng, `lich_hen.phong_kham` tương ứng được cập nhật.

### 4.4 Cơ chế khóa kết quả khám (24h lock)

```
Thời điểm lưu kết quả (examination_results.ngay_tao)
        ├── < 24h → co_the_sua = true  → bác sĩ có thể sửa
        └── ≥ 24h → co_the_sua = false → readonly vĩnh viễn
```

Cron job (chạy mỗi giờ):

```js
await ExaminationResult.updateMany(
  { co_the_sua: true, ngay_tao: { $lte: new Date(Date.now() - 24*60*60*1000) } },
  { $set: { co_the_sua: false } }
)
```

### 4.5 Quyền thao tác theo trạng thái

| Trạng thái | Điều kiện thêm | Xác nhận | Từ chối | Hoàn thành | Hủy | ExamModal |
|---|---|---|---|---|---|---|
| `pending` | `payment='paid'`, chưa hết hạn | ✅ | ✅ | ❌ | ❌ | ❌ |
| `pending` | `payment='unpaid'` hoặc hết hạn | ❌ | ✅ | ❌ | ❌ | ❌ |
| `confirmed` | — | ❌ | ❌ | ✅ | ✅ | ✅ "Kết quả" |
| `completed` | `da_co_ket_qua=false` | ❌ | ❌ | ❌ | ❌ | ✅ "Nhập kết quả" |
| `completed` | `da_co_ket_qua=true, co_the_sua=true` | ❌ | ❌ | ❌ | ❌ | ✅ "Xem kết quả" (editable) |
| `completed` | `da_co_ket_qua=true, co_the_sua=false` | ❌ | ❌ | ❌ | ❌ | ✅ "Xem kết quả" (readonly) |
| `cancelled` | — | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 5. Data Model (trạng thái hiện tại — `types/index.ts`)

### 5.1 `DoctorAppointmentDetail`

```ts
export interface DoctorAppointmentDetail {
  id: number
  benh_nhan: string
  benh_nhan_id: number
  so_dien_thoai: string
  ngay_kham: string              // 'YYYY-MM-DD'
  gio_kham: string               // 'HH:MM'
  loai_kham: 'clinic' | 'home'  // video đã bỏ
  status: AppointmentStatus      // 'pending'|'confirmed'|'completed'|'cancelled'
  payment_status: PaymentStatus  // 'unpaid'|'paid'|'refunded'
  gia_kham: number
  ly_do_kham?: string
  phong_kham?: string | null     // clinic: snapshot từ slots[].phong_kham
  dia_chi_kham?: string | null   // home: địa chỉ bệnh nhân — BẮT BUỘC khi loai_kham='home'
  ten_dich_vu?: string | null    // joined từ dich_vu.ten
  tuoi?: number
  gioi_tinh?: 'Nam' | 'Nữ' | 'Khác'
  di_ung?: string | null         // ⚠️ CRITICAL — hiển thị màu đỏ nổi bật
  benh_nen?: string | null
  da_co_ket_qua: boolean         // computed bởi backend
  ly_do_huy?: string | null
}
```

### 5.2 `ExaminationResult`

```ts
export interface ExaminationResult {
  id: number
  appointment_id: number
  chan_doan: string           // bắt buộc
  huong_dan_dieu_tri: string
  ghi_chu?: string | null    // ghi chú bổ sung của bác sĩ
  ngay_tai_kham: string      // '' nếu không hẹn tái khám
  co_the_sua: boolean        // true < 24h; false ≥ 24h (readonly vĩnh viễn)
  thuoc: PrescriptionDrug[]
  ngay_tao: string           // ISO datetime
}
```

### 5.3 `PrescriptionDrug`

```ts
export interface PrescriptionDrug {
  id: number
  ten_thuoc: string
  lieu_luong: string    // "1 viên/lần" — khớp DB don_thuoc.items.lieu_luong
  tan_suat: string      // "3 lần/ngày" — mô tả hiển thị
  gio_uong: string[]    // ['07:00','12:00','19:00'] — cron tạo nhac_nho
  ngay_bat_dau: string  // 'YYYY-MM-DD'
  ngay_ket_thuc: string // 'YYYY-MM-DD' (max ngay_bat_dau + 90 ngày)
  ghi_chu?: string | null
}
```

---

## 6. Cấu trúc UI (`DoctorAppointments.tsx`)

### 6.1 Layout tổng thể

```
┌─────────────────────────────────────────────────────────────────────────┐
│  PageHeader: "Lịch hẹn của tôi"                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  [!] Banner amber: "X lịch hẹn chưa tiến hành xác nhận" [Xem ngay →]   │
│      → click → chuyển đến tab "Chưa xác nhận"                           │
├─────────────────────────────────────────────────────────────────────────┤
│  ROW 1 (Tabs):                                                           │
│  [Chưa xác nhận 🟡(3)] [Hôm nay (5)] [Sắp tới (4)] [Đã qua (6)] [Tất cả (15)] │
│  • Tab "Chưa xác nhận": amber khi active, count badge amber khi có data  │
│  • Các tab còn lại: brand-blue khi active                                │
├─────────────────────────────────────────────────────────────────────────┤
│  ROW 2 (Filters):                                                        │
│  [Tất cả trạng thái ▼]  [Tất cả hình thức ▼]  [🔍 Tìm tên / SĐT...]  │
│  • Dropdown trạng thái ẩn khi đang ở tab "Chưa xác nhận"               │
│  • Dropdown hình thức: "Tại phòng khám" / "Tại nhà"                    │
│  • Search debounce 300ms — tìm cả tên bệnh nhân VÀ số điện thoại       │
├─────────────────────────────────────────────────────────────────────────┤
│  Bệnh nhân  │  Ngày/Giờ + DV  │  Hình thức + Địa điểm  │  TT  │  Phí  │  ⚙ │
│  ─────────────────────────────────────────────────────────────────────  │
│  ▶ Nguyễn Văn An   │ 22/06 07:30   │ Tại phòng khám        │ 🔵  │ 350k │ [Hoàn thành][Kết quả]│
│    0901234567       │ Khám tim mạch │ 🏥 Phòng 201, Tầng 2  │     │      │                      │
│  ▶ Lê Thị Lan      │ 23/06 08:30   │ 🏠 Tại nhà            │ 🔵  │ 700k │ [Hoàn thành][Kết quả]│
│    0906789012       │ Khám tại nhà  │ 📍 12 Nguyễn Trãi...  │     │      │                      │
│  ▼ EXPANDED ROW ───────────────────────────────────────────────────────  │
│    [SĐT] [Thanh toán] [Dịch vụ] [Tuổi/Giới] [Dị ứng🔴] [Bệnh nền]    │
│    [Phòng khám 🟢] / [Địa chỉ bác sĩ đến 🟣] [Lý do khám] [Lý do hủy]│
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Tabs

| Tab | Logic lọc | Sort mặc định | Ghi chú |
|---|---|---|---|
| `unconfirmed` | `status='pending'` (mọi ngày) | Ngày tăng dần | Amber khi active; dropdown status ẩn |
| `today` | `ngay_kham = hôm nay` | Giờ tăng dần | |
| `upcoming` | `ngay_kham > hôm nay` | Ngày tăng dần | |
| `past` | `ngay_kham < hôm nay` | Ngày giảm dần | Mới nhất lên đầu |
| `all` | Tất cả | Ngày tăng dần | |

Badge count: **không bị ảnh hưởng** bởi status filter hay search.

### 6.3 Cột Hình thức + Địa điểm (trong row chính)

- **Clinic:** Text "Tại phòng khám" + dòng nhỏ xanh lá `🏥 Phòng 201, Tầng 2, Tòa A`
- **Home:** Badge tím `🏠 Tại nhà` + dòng nhỏ tím `📍 địa chỉ rút gọn`

### 6.4 Expanded Row

Mở khi click vào row. Hiển thị (chỉ khi có giá trị):

| Field | Style |
|---|---|
| Số điện thoại | Bình thường |
| Thanh toán | Badge màu |
| Dịch vụ | Bình thường |
| Tuổi / Giới tính | Bình thường |
| Dị ứng | 🔴 `text-red-600 font-medium` — CRITICAL |
| Bệnh nền | Bình thường |
| **Phòng khám** (clinic) | Block xanh lá border, icon hospital |
| **Địa chỉ bác sĩ đến** (home) | Block tím border, icon map-pin |
| Lý do khám | Bình thường |
| Lý do hủy | Đỏ — chỉ khi cancelled |

### 6.5 ExamModal — Kết quả khám (B4)

**Header:** `{benh_nhan} · {formatDate(ngay_kham)} {gio_kham}`

**Các field:**
- Chẩn đoán (required `<textarea>`)
- Hướng dẫn điều trị (optional)
- Ghi chú bổ sung (`ghi_chu` — optional, mức kết quả khám)
- Ngày tái khám (optional `<input type="date">`)
- Đơn thuốc: dynamic list, tối thiểu 1 row, nút xóa ẩn khi chỉ còn 1

**Mỗi dòng thuốc:**
- Tên thuốc (required)
- Liều lượng (`lieu_luong`) — "1 viên"
- Tần suất (`tan_suat`) — "3 lần/ngày"
- Giờ uống (`gio_uong`) — nhập chuỗi "07:00, 12:00, 19:00" → parse thành `string[]`
- Ngày bắt đầu (`ngay_bat_dau`) — default: hôm nay
- Ngày kết thúc (`ngay_ket_thuc`) — default: hôm nay + 30 ngày
- Ghi chú (optional, mức từng thuốc)

**Trạng thái:**
- `co_the_sua=false` → banner vàng "Đã khóa sau 24h", tất cả input `readOnly`, chỉ nút "Đóng"
- `co_the_sua=true` → editable, nút "Đóng" + "Lưu kết quả" (mới) / "Cập nhật" (đã có)

---

## 7. Service Layer

### 7.1 `doctorAppointmentService`

| Hàm | Endpoint (MongoDB) | Trả về |
|---|---|---|
| `getAll({ tab })` | `GET /api/doctor/appointments` | `DoctorAppointmentDetail[]` |
| `confirm(id)` | `POST /api/doctor/appointments/:id/confirm` | `DoctorAppointmentDetail` |
| `reject(id, ly_do)` | `POST /api/doctor/appointments/:id/reject` | `DoctorAppointmentDetail` |
| `complete(id)` | `POST /api/doctor/appointments/:id/complete` | `DoctorAppointmentDetail` |
| `cancelConfirmed(id, ly_do)` | `POST /api/doctor/appointments/:id/cancel` | `DoctorAppointmentDetail` |

### 7.2 `examinationService`

| Hàm | Endpoint | Ghi chú |
|---|---|---|
| `getByAppointment(id)` | `GET /api/doctor/examination/:id` | `null` nếu chưa có |
| `save(payload)` | `POST /api/doctor/examination` | Upsert. Throw nếu `co_the_sua=false` |

`save()` trigger chuỗi backend: `ket_qua_kham → ho_so_y_te → don_thuoc → nhac_nho`.

---

## 8. Trạng thái hiện tại

### 8.1 Đã implement ✅

- [x] 5 tabs: Chưa xác nhận / Hôm nay / Sắp tới / Đã qua / Tất cả
- [x] Tab "Chưa xác nhận": amber styling, lọc `status='pending'` mọi ngày
- [x] Banner cảnh báo "X lịch hẹn chưa tiến hành xác nhận" → click "Xem ngay" → tab Chưa xác nhận
- [x] Filter trạng thái (dropdown: Chờ xác nhận / Đã xác nhận / Đã hủy)
- [x] Filter hình thức (dropdown: Tại phòng khám / Tại nhà)
- [x] Filter status tự ẩn khi ở tab "Chưa xác nhận"
- [x] Search theo tên bệnh nhân VÀ số điện thoại (debounce 300ms)
- [x] Expandable row với đầy đủ thông tin bệnh nhân
- [x] Phòng khám (clinic) hiển thị trong row chính + expanded row (màu xanh lá)
- [x] Địa chỉ tại nhà (home) hiển thị trong row chính + expanded row (màu tím)
- [x] Tên dịch vụ `ten_dich_vu` trong row chính (dưới giờ khám)
- [x] Xác nhận lịch (`pending → confirmed`) — chỉ khi `payment='paid'` + chưa hết hạn
- [x] Từ chối với lý do (`pending → cancelled`, modal validate)
- [x] Hoàn thành (`confirmed → completed`)
- [x] Bác sĩ hủy lịch đã confirmed với lý do + hoàn 100%
- [x] Nhập/sửa kết quả khám (ExamModal) với `ghi_chu`
- [x] 24h lock — `co_the_sua=false` → readonly mode
- [x] Form kê đơn: `lieu_luong`, `gio_uong[]`, `ngay_bat_dau`, `ngay_ket_thuc`, `ghi_chu` per drug
- [x] Drug mới default: `ngay_bat_dau = hôm nay`, `ngay_ket_thuc = hôm nay + 30 ngày`
- [x] Badge "Hết hạn" + disable confirm cho pending đã qua ngày

### 8.2 Chưa có — cần làm sau

| Gap | Ưu tiên | Mô tả |
|---|---|---|
| Đổi phòng khám trong lịch hẹn | 🟡 Trung | Khi đổi `slots[].phong_kham` → propagate sang `lich_hen.phong_kham` — làm sau khi B2 xong |
| Bác sĩ xem lịch sử thay đổi phòng | 🟢 Thấp | `lich_su_lich_hen` track mỗi lần đổi phòng |
| Date range picker | 🟢 Thấp | Filter theo khoảng ngày tuỳ chỉnh |
| Export đơn thuốc | 🟢 Thấp | In / tải PDF đơn thuốc |

---

## 9. Test Cases

### 9.1 TC-TAB — Navigation & Tabs

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-TAB01 | Tab "Hôm nay" active mặc định | Vào `/doctor/appointments` | Tab "Hôm nay" active | P0 |
| TC-TAB02 | Tab "Chưa xác nhận" lọc đúng | Mock có 4 pending (mọi ngày) | Tab hiện đúng 4 lịch, không phân biệt ngày | P0 |
| TC-TAB03 | Tab "Chưa xác nhận" — amber khi có data | Count > 0 | Badge amber, nền amber khi active | P1 |
| TC-TAB04 | Banner → Tab "Chưa xác nhận" | Click "Xem ngay" trong banner | Switch sang tab Chưa xác nhận | P0 |
| TC-TAB05 | Banner text đúng | `urgentCount > 0` | "X lịch hẹn chưa tiến hành xác nhận" | P1 |
| TC-TAB06 | Badge count không bị filter ảnh hưởng | Đang filter "Đã xác nhận" | Badge count tab vẫn hiện tổng số, không chỉ confirmed | P0 |
| TC-TAB07 | Tab "Đã qua" sort giảm dần | Click tab Đã qua | Lịch mới nhất lên đầu | P1 |

### 9.2 TC-FILTER — Bộ lọc

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-F01 | Filter trạng thái — Chờ xác nhận | Chọn dropdown "Chờ xác nhận" | Chỉ hiện `status='pending'` | P0 |
| TC-F02 | Filter trạng thái — Đã xác nhận | Chọn "Đã xác nhận" | Chỉ hiện `status='confirmed'` | P0 |
| TC-F03 | Filter trạng thái — Đã hủy | Chọn "Đã hủy" | Chỉ hiện `status='cancelled'` | P0 |
| TC-F04 | Filter trạng thái ẩn trên tab Chưa xác nhận | Chuyển tab Chưa xác nhận | Dropdown trạng thái không còn hiển thị | P1 |
| TC-F05 | Filter hình thức — Tại nhà | Chọn "Tại nhà" | Chỉ hiện `loai_kham='home'` | P0 |
| TC-F06 | Filter hình thức — Tại phòng khám | Chọn "Tại phòng khám" | Chỉ hiện `loai_kham='clinic'` | P0 |
| TC-F07 | Kết hợp tab + filter | Tab "Hôm nay" + filter "Đã xác nhận" | Giao 2 điều kiện | P0 |
| TC-F08 | Tìm kiếm theo tên | Gõ "Nguyễn Văn An" | Chỉ hiện bệnh nhân khớp tên | P0 |
| TC-F09 | Tìm kiếm theo số điện thoại | Gõ "0901234567" | Hiện bệnh nhân có SĐT này | P0 |
| TC-F10 | Tìm kiếm case-insensitive | Gõ "nguyễn" | Tìm thấy "Nguyễn Văn An" | P1 |
| TC-F11 | Tìm kiếm không kết quả | Gõ "xyz999" | Empty state + nút "Xoá tìm kiếm" | P1 |
| TC-F12 | Debounce 300ms | Gõ nhanh nhiều ký tự | Chỉ filter sau khi dừng gõ 300ms | P2 |

### 9.3 TC-LOCATION — Hiển thị phòng khám / địa chỉ

| ID | Tên test case | Điều kiện đầu vào | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-LOC01 | Clinic hiện phòng khám trên row | `loai_kham='clinic'`, có `phong_kham` | Dưới "Tại phòng khám" có text xanh lá "🏥 Phòng 201..." | P0 |
| TC-LOC02 | Clinic expanded row | Mở row clinic | Block "Phòng khám" viền xanh lá, icon hospital | P0 |
| TC-LOC03 | Home hiện địa chỉ trên row | `loai_kham='home'`, có `dia_chi_kham` | Dưới badge tím "Tại nhà" có text tím "📍 địa chỉ rút gọn" | P0 |
| TC-LOC04 | Home expanded row | Mở row home | Block "Địa chỉ bác sĩ đến" viền tím, icon map-pin | P0 |
| TC-LOC05 | Clinic không có phòng | `phong_kham=null` | Không hiện block phòng khám — không crash | P1 |
| TC-LOC06 | Home không có địa chỉ | `dia_chi_kham=null` | Không hiện block địa chỉ — không crash | P1 |

### 9.4 TC-CONFIRM — Xác nhận / Từ chối / Hoàn thành

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-C01 | Xác nhận happy path | `pending`, `paid`, ngày hợp lệ | Badge → "Đã xác nhận" xanh, nút → [Hoàn thành][Hủy][Kết quả] | P0 |
| TC-C02 | Không confirm khi unpaid | `pending`, `unpaid` | Nút "Xác nhận" không xuất hiện | P0 |
| TC-C03 | Không confirm khi hết hạn | `pending`, `ngay_kham < today` | Nút "Xác nhận" ẩn, badge "Hết hạn" hiện | P0 |
| TC-R01 | Từ chối happy path | Click "Từ chối" → nhập lý do | Badge → "Đã hủy" đỏ, lý do trong expanded row | P0 |
| TC-R02 | Submit lý do trống | Textarea rỗng | Nút "Xác nhận từ chối" disabled | P0 |
| TC-CO01 | Hoàn thành happy path | `confirmed` → click "Hoàn thành" | Badge → "Hoàn thành" xanh lá; nút → "Nhập kết quả" | P0 |
| TC-CC01 | Bác sĩ hủy confirmed | `confirmed` → click "Hủy" → lý do | Badge → "Đã hủy", `payment_status='refunded'` | P0 |

### 9.5 TC-EXAM — Ghi kết quả khám (B4)

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-E01 | Mở modal lần đầu | `completed`, `da_co_ket_qua=false` | Form rỗng, editable, drug đầu có ngày mặc định | P0 |
| TC-E02 | Lưu kết quả | Nhập chẩn đoán → Lưu | Modal đóng; nút → "Xem kết quả" (eye); `da_co_ket_qua=true` | P0 |
| TC-E03 | Submit thiếu chẩn đoán | `chan_doan` trống | Không submit (required validation) | P0 |
| TC-E04 | Drug mới có ngày default | Click "Thêm thuốc" | `ngay_bat_dau = hôm nay`, `ngay_ket_thuc = hôm nay + 30 ngày` | P1 |
| TC-E05 | Parse giờ uống | Gõ "07:00, 12:00, 19:00" | Lưu `gio_uong: ['07:00','12:00','19:00']` | P1 |
| TC-E06 | Ghi chú kết quả | Nhập `ghi_chu` | Field được lưu cùng `chan_doan` | P1 |
| TC-E07 | Read-only sau 24h | `co_the_sua=false` | Banner vàng, inputs `readOnly`, chỉ nút "Đóng" | P0 |
| TC-E08 | Cập nhật trong 24h | `co_the_sua=true` → sửa → Cập nhật | Dữ liệu mới được lưu | P0 |

### 9.6 TC-EDGE — Edge Cases

| ID | Tên | Điều kiện | Kết quả mong đợi | Mức |
|---|---|---|---|---|
| TC-EDG01 | Empty state | Không có lịch | Icon calendar + "Không có lịch hẹn nào" | P1 |
| TC-EDG02 | Dị ứng màu đỏ | `di_ung='Penicillin'` | Text đỏ `font-medium` trong expanded row | P0 |
| TC-EDG03 | Field null không render | `di_ung=null` | Không hiện block "Dị ứng" | P1 |
| TC-EDG04 | Double-click nút | Click nhanh "Xác nhận" 2 lần | Chỉ 1 request (disabled sau click đầu) | P1 |
| TC-EDG05 | XSS lý do hủy | `ly_do='<script>alert(1)</script>'` | Hiện text thuần, script không chạy | P0 |

---

## 10. Tóm tắt Nghiệp vụ Không được Sai

| # | Quy tắc | Hậu quả |
|---|---|---|
| 1 | Bác sĩ chỉ thấy lịch `doctor_id = own` — filter ở backend | Lộ dữ liệu bệnh nhân người khác |
| 2 | Không confirm lịch `payment='unpaid'` | Bác sĩ khám không nhận được tiền |
| 3 | Bác sĩ hủy → hoàn 100% bất kể thời điểm | Bệnh nhân thiệt khi bác sĩ hủy giờ cuối |
| 4 | `co_the_sua` check cả FE lẫn BE | FE = UX guard; BE = security guard |
| 5 | `da_co_ket_qua` chỉ set `true` khi `save()` thành công | Set sớm = bệnh nhân thấy "có kết quả" nhưng DB trống |
| 6 | `payment_status → refunded` cùng transaction khi hủy | Mất tiền bệnh nhân nếu cancel nhưng payment không update |
| 7 | Dị ứng (`di_ung`) màu đỏ nổi bật — LUÔN LUÔN | Kê thuốc gây phản ứng = nguy hiểm tính mạng |
| 8 | `cancelled` / `completed` là trạng thái cuối | Đảo ngược = hồ sơ y tế sai |
| 9 | Phòng khám (clinic) phải đúng với lịch làm việc hiện tại | Bệnh nhân đến nhầm phòng |

---

## 11. Sơ đồ luồng người dùng

```
Bác sĩ vào /doctor/appointments
          │
          ├─ Banner: "X lịch chưa xác nhận" → [Xem ngay] → Tab Chưa xác nhận
          │
          ├─ Tab CHƯ XÁC NHẬN (tất cả ngày, status=pending)
          │     ├─ PENDING (paid, chưa hết hạn)
          │     │     ├─ [Xác nhận] ──────────────────────────────► CONFIRMED
          │     │     └─ [Từ chối] → modal lý do ──────────────► CANCELLED
          │     └─ PENDING (unpaid hoặc hết hạn)
          │           └─ [Từ chối] → modal lý do ──────────────► CANCELLED
          │
          ├─ Tab HÔM NAY / SẮP TỚI
          │     ├─ CONFIRMED
          │     │     ├─ Xem phòng khám / địa chỉ trong cột Hình thức
          │     │     ├─ [Hoàn thành] ─────────────────────────► COMPLETED
          │     │     ├─ [Hủy] → modal lý do ─────────────────► CANCELLED (hoàn 100%)
          │     │     └─ [Kết quả] → ExamModal (chuẩn bị trước)
          │     └─ PENDING → (tương tự Chưa xác nhận)
          │
          └─ Tab ĐÃ QUA
                ├─ COMPLETED, da_co_ket_qua=false ──► [Nhập kết quả] → ExamModal
                ├─ COMPLETED, da_co_ket_qua=true, co_the_sua=true  ──► [Xem kết quả] (editable)
                └─ COMPLETED, da_co_ket_qua=true, co_the_sua=false ──► [Xem kết quả] (readonly)
```
