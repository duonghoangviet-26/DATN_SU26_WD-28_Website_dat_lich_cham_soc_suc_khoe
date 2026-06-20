# Spec: Tổng quan Bác sĩ — `/doctor` Dashboard

> **Ngày:** 2026-06-17
> **Actor:** Bác sĩ đã đăng nhập
> **Route:** `/doctor`
> **Chức năng:** B5 — Xem thống kê cá nhân & đánh giá (nâng cấp toàn diện)
> **Trạng thái:** Đã duyệt — sẵn sàng triển khai

---

## 1. Mục tiêu

Trang tổng quan (`/doctor`) là màn hình đầu tiên bác sĩ thấy sau khi đăng nhập. Trang phải trả lời được 4 câu hỏi của bác sĩ trong vòng 5 giây:

1. **Hôm nay tôi có bao nhiêu ca?**
2. **Tháng này tôi khám được bao nhiêu và tỉ lệ thành công thế nào?**
3. **Bệnh nhân đánh giá tôi như thế nào?**
4. **Hồ sơ hành nghề của tôi đang ở trạng thái gì?**

---

## 2. Điều kiện truy cập & Hiển thị theo trạng thái hồ sơ

Trang render khác nhau tùy `doctors.trang_thai_duyet`:

| `trang_thai_duyet` | Giao diện |
|---|---|
| `approved` | Dashboard đầy đủ 5 section |
| `pending` | Banner vàng + 5 section bị mờ/disabled |
| `rejected` | Banner đỏ có lý do + nút "Nộp lại" + nội dung mờ |
| `suspended` | Banner đỏ + ẩn toàn bộ nội dung |

**Quy tắc nghiệp vụ quan trọng:**
- Bác sĩ `pending` / `rejected` / `suspended` **không** nhận lịch hẹn mới, **không** thao tác slot.
- Bác sĩ `rejected` có tối đa **5 lần** nộp lại (`so_lan_nop ≤ 5`).
- Khi `so_lan_nop >= 5` → ẩn nút "Nộp lại", hiển thị "Đã hết số lần nộp lại — liên hệ Admin".

**Nguồn dữ liệu `trang_thai_duyet` và `so_lan_nop`:**
Dashboard gọi `doctorProfileService.get()` khi mount để lấy `DoctorProfile` (đã có `trang_thai_duyet`).
Phải bổ sung `so_lan_nop` vào `DoctorProfile` interface và `mockDoctorProfile` (xem mục 4 và 7).

---

## 3. Layout tổng thể

```
┌─────────────────────────────────────────────────────────────┐
│  [Banner trạng thái hồ sơ — chỉ hiện khi ≠ approved]       │
├─────────────────────────────────────────────────────────────┤
│  Section 1: Stat Cards (4 cards + sparkline mini)           │
├─────────────────────────────────────────────────────────────┤
│  [Pill cảnh báo lịch hẹn chờ xác nhận — nếu có]            │
├─────────────────────────────────────────────────────────────┤
│  Section 2: Lịch hôm nay (danh sách tối đa 5)              │
├─────────────────────────────────────────────────────────────┤
│  Section 3: Biểu đồ hoạt động 6 tháng (BarChart)           │
├─────────────────────────────────────────────────────────────┤
│  Section 4: Tỉ lệ hoạt động (Donut chart)                  │
├─────────────────────────────────────────────────────────────┤
│  Section 5: Đánh giá đầy đủ                                 │
│    ├─ Xu hướng điểm 6 tháng (LineChart)                     │
│    ├─ Phân bố sao (Horizontal bars)                         │
│    └─ Danh sách reviews (5 gần nhất + xem thêm)            │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Data Model

> ⚠️ **Lưu ý khi implement:** Cập nhật types và mock data **trong cùng một bước** để tránh TypeScript báo lỗi missing required fields.

### 4.1 Các type mới — thêm vào `types/index.ts`

```ts
// Thêm 4 interface mới vào types/index.ts

export interface MonthlyPoint {
  thang:      string   // 'T1' ... 'T12' — label hiển thị trên trục X
  so_ca:      number   // tổng appointments mọi trạng thái trong tháng
  hoan_thanh: number   // completed
  bi_huy:     number   // cancelled
  doanh_thu:  number   // SUM(gia_kham) completed+paid trong tháng
}

export interface RatingPoint {
  thang:    string        // 'T1' ... 'T12'
  diem:     number | null // AVG visible reviews tháng đó; null nếu tháng không có review
  so_luot:  number        // số lượt review visible trong tháng
}

export interface StarDistribution {
  s5: number   // COUNT WHERE so_sao=5 AND status='visible'
  s4: number
  s3: number
  s2: number
  s1: number
  // Bất biến: s5+s4+s3+s2+s1 === DoctorStats.so_danh_gia — backend validate
}

export interface TodayAppointment {
  id:        number
  benh_nhan: string
  gio_kham:  string                                            // 'HH:MM'
  loai_kham: 'clinic' | 'home'
  status:    'pending' | 'confirmed' | 'completed' | 'cancelled'
}
```

### 4.2 Nâng cấp `DoctorStats` — sửa interface hiện có trong `types/index.ts`

```ts
// Thay thế DoctorStats hiện tại (7 fields) bằng version đầy đủ:
export interface DoctorStats {
  // ── Giữ nguyên 7 fields cũ ────────────────────────────────
  tong_luot_kham:   number
  thang_nay:        number
  ty_le_hoan_thanh: number
  ty_le_huy:        number
  diem_danh_gia:    number
  so_danh_gia:      number
  doanh_thu_thang:  number

  // ── Thêm mới ──────────────────────────────────────────────
  lich_hen_hom_nay: number         // COUNT appointments ngay_kham = today
  cho_xac_nhan:     number         // COUNT appointments status='pending' (mọi ngày)
  lich_hen_6_thang: MonthlyPoint[] // luôn đủ 6 phần tử, thứ tự cũ → mới
  xu_huong_diem:    RatingPoint[]  // luôn đủ 6 phần tử
  phan_bo_sao:      StarDistribution
}
```

### 4.3 Nâng cấp `DoctorReview` — sửa interface hiện có trong `types/index.ts`

```ts
// Thay thế DoctorReview hiện tại:
export interface DoctorReview {
  id:        number
  benh_nhan: string
  diem:      1 | 2 | 3 | 4 | 5  // thu hẹp từ number → union cho type-safety
  noi_dung:  string | null       // ⚠️ đổi từ string → string | null (bác sĩ có thể không nhận xét)
  ngay_tao:  string
  loai_kham: 'clinic' | 'home'  // ⚠️ field mới — cần thêm vào tất cả mock reviews
  // Lưu ý: status='hidden' KHÔNG bao giờ trả về frontend — backend lọc trước khi trả
}
```

### 4.4 Bổ sung `so_lan_nop` vào `DoctorProfile` — sửa interface hiện có trong `types/index.ts`

```ts
// Thêm so_lan_nop vào DoctorProfile (hiện đang thiếu):
export interface DoctorProfile {
  id: number
  user_id: number
  ho_ten: string
  email: string
  chuyen_khoa: string
  so_nam_kinh_nghiem: number
  phi_tu_van: number
  trang_thai_duyet: DoctorApproval
  diem_danh_gia: number
  so_danh_gia: number
  bang_cap: string
  ly_do_tu_choi?: string | null
  so_lan_nop: number             // ⚠️ field mới — dùng cho banner "Còn N lần nộp lại"
  ngay_tao: string
}
```

---

## 5. Business Rules tính toán (Backend phải đảm bảo)

### 5.1 Thống kê tổng hợp

| Trường | Công thức |
|---|---|
| `tong_luot_kham` | `COUNT(appointments)` WHERE `status='completed'` AND `doctor_id=me` |
| `thang_nay` | `tong_luot_kham` lọc thêm `ngay_kham` trong tháng hiện tại |
| `ty_le_hoan_thanh` | `completed / (completed + cancelled) * 100` — nếu mẫu = 0 → trả về `0` |
| `ty_le_huy` | `cancelled / (completed + cancelled) * 100` — nếu mẫu = 0 → trả về `0` |
| `diem_danh_gia` | `AVG(so_sao)` WHERE `reviews.status='visible'` AND `doctor_id=me` — nếu 0 review → trả về `0` |
| `so_danh_gia` | `COUNT(reviews)` WHERE `status='visible'` — **không đếm hidden** |
| `doanh_thu_thang` | `SUM(gia_kham)` WHERE `status='completed'` AND `payment_status='paid'` AND trong tháng |
| `cho_xac_nhan` | `COUNT(appointments)` WHERE `status='pending'` AND `doctor_id=me` — tất cả ngày |
| `lich_hen_hom_nay` | `COUNT(appointments)` WHERE `ngay_kham = today` AND `doctor_id=me` |

### 5.2 Phân bố sao

```
phan_bo_sao.s5 = COUNT(reviews) WHERE so_sao=5 AND status='visible' AND doctor_id=me
phan_bo_sao.s4 = COUNT ... so_sao=4
phan_bo_sao.s3 = COUNT ... so_sao=3
phan_bo_sao.s2 = COUNT ... so_sao=2
phan_bo_sao.s1 = COUNT ... so_sao=1
```

**Bất biến:** `s1+s2+s3+s4+s5 === so_danh_gia` — backend validate trước khi trả.

### 5.3 Dữ liệu 6 tháng (`lich_hen_6_thang` và `xu_huong_diem`)

- Luôn trả đủ **6 phần tử**, tháng nào không có data → `{ hoan_thanh:0, bi_huy:0, so_ca:0, doanh_thu:0 }`
- `xu_huong_diem` tháng không có review → `{ diem: null, so_luot: 0 }`
- Thứ tự: từ tháng cũ nhất → tháng hiện tại (index 0 = 5 tháng trước, index 5 = tháng này)
- **Giá trị `thang_nay` phải bằng `lich_hen_6_thang[5].hoan_thanh`** — backend đảm bảo nhất quán
- **Giá trị `doanh_thu_thang` phải bằng `lich_hen_6_thang[5].doanh_thu`** — backend đảm bảo nhất quán

---

## 6. Chi tiết từng Section

---

### Section 0 — Banner trạng thái hồ sơ

Chỉ render khi `trang_thai_duyet ≠ 'approved'`.

**`pending`** — Banner vàng:
```
🟡  Hồ sơ đang chờ duyệt
    Admin sẽ xem xét trong 1–3 ngày làm việc.
    Bạn chưa thể nhận lịch hẹn trong thời gian chờ.
```

**`rejected`** — Banner đỏ:
```
🔴  Hồ sơ bị từ chối
    Lý do: [profile.ly_do_tu_choi]
    Còn [5 - profile.so_lan_nop] lần nộp lại.          [Nộp lại →]
```
- `profile.so_lan_nop >= 5` → ẩn nút "Nộp lại", hiển thị: "Đã hết số lần nộp lại — vui lòng liên hệ Admin"
- `ly_do_tu_choi` null/empty → hiển thị "Không có lý do được ghi nhận"

**`suspended`** — Banner đỏ đậm, ẩn toàn bộ nội dung dashboard:
```
🔴  Tài khoản bị tạm khóa
    Vui lòng liên hệ Admin để biết thêm chi tiết.
```

---

### Section 1 — Stat Cards (4 cards)

Mỗi card gồm: label · giá trị chính · sub-text · **sparkline mini (LineChart Recharts, ẩn trục)**.

| Card | Giá trị chính | Sub-text | Sparkline data |
|---|---|---|---|
| Tổng lượt khám | `tong_luot_kham` | "tích lũy" | `lich_hen_6_thang[].hoan_thanh` |
| Tháng này | `thang_nay` | `"hoàn thành " + ty_le_hoan_thanh.toFixed(1) + "%"` | `lich_hen_6_thang[].so_ca` |
| Đánh giá | `diem_danh_gia.toFixed(1) + " ★"` | `so_danh_gia + " lượt"` | `xu_huong_diem[].diem` (bỏ qua null) |
| Doanh thu tháng | `formatPrice(doanh_thu_thang)` | `"hủy " + ty_le_huy.toFixed(1) + "%"` | `lich_hen_6_thang[].doanh_thu` |

**Edge cases:**
- `so_danh_gia = 0` → giá trị card "—" · sub-text "Chưa có đánh giá"
- `doanh_thu_thang = 0` → hiển thị "0 ₫", không ẩn card
- Sparkline card "Đánh giá": lọc bỏ `diem = null` trước khi truyền vào Recharts, nếu < 2 điểm còn lại → ẩn sparkline

**Sparkline config (dùng ResponsiveContainer):**
```tsx
<ResponsiveContainer width="100%" height={32}>
  <LineChart data={sparkData}>
    <Line type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={1.5}
          dot={false} isAnimationActive={false} />
  </LineChart>
</ResponsiveContainer>
// sparkData = array of { v: number } — không có axis, không có tooltip
```

**Pill cảnh báo** (ngay dưới 4 cards, hiện khi `cho_xac_nhan > 0`):
```
⚠️  Bạn có [N] lịch hẹn đang chờ xác nhận        [Xem ngay →]
```
Link → `/doctor/appointments` (không dùng query param — xem lưu ý mục 9).

---

### Section 2 — Lịch hôm nay

Hiển thị tối đa 5 lịch hẹn `ngay_kham = hôm nay`, sort `gio_kham ASC`.

```
📅  Lịch hôm nay          [3 ca]          [Xem tất cả →]
────────────────────────────────────────────────────────
07:30   Nguyễn Văn An    Tại phòng khám   [Hoàn thành ✓]
08:00   Trần Thị Bình    Tại phòng khám   [Đã xác nhận]
08:30   Hoàng Văn Em     Tại nhà          [Chờ xác nhận]
```

**Màu badge status:**

| Status | Màu | Nhãn |
|---|---|---|
| `pending` | Vàng | Chờ xác nhận |
| `confirmed` | Xanh dương | Đã xác nhận |
| `completed` | Xanh lá | Hoàn thành |
| `cancelled` | Đỏ | Đã hủy |

**Edge cases:**
- `lich_hen_hom_nay = 0` → placeholder: icon lịch + "Không có lịch hẹn hôm nay"
- Hơn 5 lịch → hiển thị 5 + chú thích "và [lich_hen_hom_nay - 5] lịch khác"
- Link "Xem tất cả" → `/doctor/appointments` (trang mặc định tab "Hôm nay")

---

### Section 3 — Biểu đồ hoạt động 6 tháng

**Component:** `BarChart` (Recharts) — cột kép grouped.

```
  35 ┤                                    ██
  30 ┤                  ██                ██  ░░
  25 ┤   ██             ██   ██           ██  ░░
  20 ┤   ██   ██        ██   ██   ██      ██  ░░
  10 ┤   ░░   ░░        ░░   ░░   ░░      ░░  ░░
   0 └──────────────────────────────────────────
      T1    T2     T3    T4    T5    T6

   ■ Hoàn thành (xanh lá #22c55e)    ░ Bị hủy (đỏ nhạt #fca5a5)
```

**Cấu hình Recharts (dùng ResponsiveContainer — bắt buộc để responsive):**
```tsx
<ResponsiveContainer width="100%" height={260}>
  <BarChart data={stats.lich_hen_6_thang} margin={{ top:5, right:20, bottom:5, left:0 }}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="thang" tick={{ fontSize:12 }} />
    <YAxis allowDecimals={false} tick={{ fontSize:12 }} />
    <Tooltip
      formatter={(value: number, name: string) =>
        name === 'hoan_thanh' ? [`${value} ca`, 'Hoàn thành'] : [`${value} ca`, 'Bị hủy']
      }
    />
    <Legend />
    <Bar dataKey="hoan_thanh" name="hoan_thanh" fill="#22c55e" radius={[4,4,0,0]} />
    <Bar dataKey="bi_huy"     name="bi_huy"     fill="#fca5a5" radius={[4,4,0,0]} />
  </BarChart>
</ResponsiveContainer>
```

**Edge cases:**
- Tất cả `hoan_thanh = 0` và `bi_huy = 0` → placeholder "Chưa có dữ liệu trong 6 tháng qua"
- Y-axis `min = 0` — Recharts mặc định, không cần set thêm

---

### Section 4 — Biểu đồ Donut tỉ lệ hoạt động

**Component:** `PieChart` (Recharts) với `innerRadius`.

```
         ╭──────────╮
        ╱             ╲
       │   92.5%        │
       │  Hoàn thành    │
        ╲             ╱
         ╰──────────╯

  ● Hoàn thành  92.5%  (xanh lá)
  ● Bị hủy       4.2%  (đỏ)
  ● Khác          3.3%  (xám)
```

**Tính dữ liệu donut:**
```ts
const khac = Math.max(0, 100 - stats.ty_le_hoan_thanh - stats.ty_le_huy)
const donutData = [
  { name: 'Hoàn thành', value: stats.ty_le_hoan_thanh, fill: '#22c55e' },
  { name: 'Bị hủy',     value: stats.ty_le_huy,        fill: '#f87171' },
  { name: 'Khác',       value: khac,                   fill: '#e2e8f0' },
]
// Nếu tổng ty_le_hoan_thanh + ty_le_huy > 100 do làm tròn: khac = 0, donut vẫn render đúng
```

**Cấu hình Recharts (dùng ResponsiveContainer):**
```tsx
<div className="relative">
  <ResponsiveContainer width="100%" height={220}>
    <PieChart>
      <Pie
        data={donutData}
        cx="50%" cy="50%"
        innerRadius={65} outerRadius={95}
        dataKey="value"
        startAngle={90} endAngle={-270}
        isAnimationActive={false}
      >
        {donutData.map((entry) => (
          <Cell key={entry.name} fill={entry.fill} />
        ))}
      </Pie>
      <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
    </PieChart>
  </ResponsiveContainer>

  {/* Center label — absolute overlay */}
  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
    <span className="text-2xl font-bold text-slate-800">
      {stats.ty_le_hoan_thanh.toFixed(1)}%
    </span>
    <span className="text-xs text-slate-500">Hoàn thành</span>
  </div>
</div>
```

**Edge cases:**
- `tong_luot_kham = 0` → `ty_le_hoan_thanh = ty_le_huy = 0`, `khac = 100` → donut toàn xám
  Thêm center text "Chưa có dữ liệu" thay vì "0.0%"

---

### Section 5 — Đánh giá đầy đủ

---

#### 5a. Biểu đồ xu hướng điểm 6 tháng

**Component:** `LineChart` (Recharts, dùng ResponsiveContainer).

```tsx
// Lọc bỏ điểm null trước khi đánh dấu connectNulls
// Recharts KHÔNG vẽ đường tại điểm null khi connectNulls={false}
<ResponsiveContainer width="100%" height={200}>
  <LineChart data={stats.xu_huong_diem} margin={{ top:5, right:20, bottom:5, left:0 }}>
    <CartesianGrid strokeDasharray="3 3" vertical={false} />
    <XAxis dataKey="thang" tick={{ fontSize:12 }} />
    <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize:12 }} />
    <Tooltip
      formatter={(v: number) => [`${v.toFixed(1)} ★`, 'Điểm TB']}
      labelFormatter={(label: string) => `Tháng ${label}`}
    />
    <Line
      type="monotone"
      dataKey="diem"
      stroke="#f59e0b"
      strokeWidth={2}
      dot={{ fill: '#f59e0b', r: 4 }}
      activeDot={{ r: 6 }}
      connectNulls={false}
    />
  </LineChart>
</ResponsiveContainer>
```

**Edge cases:**
- `diem = null` tháng nào → đường gián đoạn tại tháng đó (`connectNulls={false}`)
- Tất cả `diem = null` → render 6 điểm trống, không có đường
  Kiểm tra: `stats.xu_huong_diem.every(p => p.diem === null)` → hiển thị placeholder "Chưa có đánh giá trong 6 tháng qua" thay chart

---

#### 5b. Phân bố sao (Horizontal bars — CSS thuần)

```
5★  ████████████████████████  89  (71.8%)
4★  ████████░░░░░░░░░░░░░░░░  28  (22.6%)
3★  ███░░░░░░░░░░░░░░░░░░░░░   6  ( 4.8%)
2★  █░░░░░░░░░░░░░░░░░░░░░░░   1  ( 0.8%)
1★  ░░░░░░░░░░░░░░░░░░░░░░░░   0  ( 0.0%)
```

**Logic tính width — relative to max (không phải % tổng):**
```ts
const { s5, s4, s3, s2, s1 } = stats.phan_bo_sao
const maxCount = Math.max(s5, s4, s3, s2, s1, 1)  // tránh chia 0 khi chưa có review
const total    = s5 + s4 + s3 + s2 + s1            // = so_danh_gia

const rows = [
  { star: 5, count: s5, color: 'bg-amber-500' },
  { star: 4, count: s4, color: 'bg-amber-400' },
  { star: 3, count: s3, color: 'bg-yellow-400' },
  { star: 2, count: s2, color: 'bg-orange-400' },
  { star: 1, count: s1, color: 'bg-red-400' },
]

// width% của mỗi bar:
const barWidth = (count: number) => `${(count / maxCount) * 100}%`

// % hiển thị bên phải:
const pct = (count: number) =>
  total === 0 ? '0.0%' : `${((count / total) * 100).toFixed(1)}%`
```

**Edge case:** `so_danh_gia = 0` → tất cả bar width = 0, hiển thị "—" thay số đếm.

---

#### 5c. Danh sách reviews

Hiển thị 5 reviews gần nhất (`status='visible'` only — backend lọc, sort `ngay_tao DESC`).

```
┌─────────────────────────────────────────────────────┐
│  [N]  Nguyễn Văn An          ★★★★★   14/06/2026   │
│       "Bác sĩ rất tận tâm, giải thích rõ ràng..."  │
│       [Tại phòng khám]                              │
├─────────────────────────────────────────────────────┤
│  [T]  Trần Thị Bình          ★★★★★   12/06/2026   │
│       "Rất hài lòng! Bác sĩ kiên nhẫn lắng nghe." │
│       [Tại nhà]                                     │
└─────────────────────────────────────────────────────┘
         [Xem thêm — hiện khi so_danh_gia > displayed]
```

**Logic:**
- Avatar = chữ cái đầu `benh_nhan`
- `noi_dung = null` → hiển thị italic *"Không có nhận xét"*
- `noi_dung` dài > 120 ký tự → truncate + "..."
- Badge `loai_kham`: "Tại phòng khám" (xanh nhạt `bg-blue-50 text-blue-600`) / "Tại nhà" (tím nhạt `bg-purple-50 text-purple-600`)
- Nút "Xem thêm" → load thêm 5 reviews (append vào list, không reset)
- `so_danh_gia = 0` → empty state: icon sao + "Chưa có đánh giá nào"
- Ẩn "Xem thêm" khi `displayed.length >= so_danh_gia`

---

## 7. Service Layer

### 7.1 Service: thêm vào `doctorProfileService` (file `services/doctor-profile.service.ts`)

> ⚠️ Dùng `doctorProfileService` — **không** tạo service mới `doctorDashboardService` để tránh xung đột tên.

```ts
// Thêm vào object doctorProfileService hiện có:

async getTodayAppointments(): Promise<TodayAppointment[]> {
  await delay()
  const todayStr = new Date().toISOString().slice(0, 10)
  // Tái sử dụng mockDoctorAppointments — không cần mock mới
  return mockDoctorAppointments
    .filter((a) => a.ngay_kham === todayStr)
    .sort((a, b) => a.gio_kham.localeCompare(b.gio_kham))
    .slice(0, 5)
    .map(({ id, benh_nhan, gio_kham, loai_kham, status }) => ({
      id, benh_nhan, gio_kham, loai_kham, status,
    }))
},
```

> `getStats()` và `getReviews()` đã có sẵn — chỉ cần cập nhật mock data để trả đủ fields mới.

### 7.2 Mock data — cập nhật `mock/doctor-stats.ts`

```ts
// mockDoctorProfile — thêm so_lan_nop:
export const mockDoctorProfile: DoctorProfile = {
  // ... giữ nguyên các field cũ ...
  so_lan_nop: 1,   // ⚠️ thêm mới
}

// mockDoctorStats — thêm 5 fields mới:
export const mockDoctorStats: DoctorStats = {
  // ── Giữ nguyên 7 fields cũ ──
  tong_luot_kham:   248,
  thang_nay:        32,          // ⚠️ sửa từ 34 → 32 để khớp lich_hen_6_thang[5].hoan_thanh
  ty_le_hoan_thanh: 92.5,
  ty_le_huy:        4.2,
  diem_danh_gia:    4.8,
  so_danh_gia:      124,
  doanh_thu_thang:  11200000,    // ⚠️ sửa từ 11900000 → 11200000 để khớp lich_hen_6_thang[5].doanh_thu

  // ── 5 fields mới ──
  lich_hen_hom_nay: 3,
  cho_xac_nhan:     2,
  lich_hen_6_thang: [
    { thang: 'T1', so_ca: 18, hoan_thanh: 16, bi_huy: 2, doanh_thu: 5600000 },
    { thang: 'T2', so_ca: 22, hoan_thanh: 20, bi_huy: 2, doanh_thu: 7000000 },
    { thang: 'T3', so_ca: 25, hoan_thanh: 23, bi_huy: 2, doanh_thu: 8050000 },
    { thang: 'T4', so_ca: 28, hoan_thanh: 26, bi_huy: 2, doanh_thu: 9100000 },
    { thang: 'T5', so_ca: 30, hoan_thanh: 28, bi_huy: 2, doanh_thu: 9800000 },
    { thang: 'T6', so_ca: 34, hoan_thanh: 32, bi_huy: 2, doanh_thu: 11200000 },
    // Bất biến: T6.hoan_thanh === thang_nay ✓  |  T6.doanh_thu === doanh_thu_thang ✓
  ],
  xu_huong_diem: [
    { thang: 'T1', diem: 4.5, so_luot: 12 },
    { thang: 'T2', diem: 4.6, so_luot: 18 },
    { thang: 'T3', diem: 4.7, so_luot: 22 },
    { thang: 'T4', diem: 4.7, so_luot: 24 },
    { thang: 'T5', diem: 4.8, so_luot: 26 },
    { thang: 'T6', diem: 4.8, so_luot: 22 },
    // Tổng so_luot: 12+18+22+24+26+22 = 124 === so_danh_gia ✓
  ],
  phan_bo_sao: { s5: 89, s4: 28, s3: 6, s2: 1, s1: 0 },
  // Tổng phan_bo_sao: 89+28+6+1+0 = 124 === so_danh_gia ✓
}

// mockDoctorReviews — thêm loai_kham vào tất cả 5 review:
export const mockDoctorReviews: DoctorReview[] = [
  { id: 1, benh_nhan: 'Nguyễn Văn An', diem: 5,
    noi_dung: 'Bác sĩ rất tận tâm, giải thích rõ ràng tình trạng bệnh và hướng điều trị. Tôi rất yên tâm sau buổi khám!',
    ngay_tao: '2026-06-14T10:20:00', loai_kham: 'clinic' },   // ⚠️ thêm loai_kham
  { id: 2, benh_nhan: 'Trần Thị Bình', diem: 5,
    noi_dung: 'Lần đầu khám tim mạch, rất hài lòng. Bác sĩ kiên nhẫn lắng nghe và giải đáp mọi thắc mắc.',
    ngay_tao: '2026-06-12T09:15:00', loai_kham: 'clinic' },
  { id: 3, benh_nhan: 'Đặng Văn Quân', diem: 4,
    noi_dung: 'Khám kỹ lưỡng, bác sĩ có chuyên môn cao. Đợi hơi lâu nhưng chất lượng tốt.',
    ngay_tao: '2026-06-10T14:30:00', loai_kham: 'home' },
  { id: 4, benh_nhan: 'Ngô Thị Tú', diem: 5,
    noi_dung: 'Rất hài lòng! Bác sĩ phát hiện sớm tình trạng tim của tôi, điều trị kịp thời.',
    ngay_tao: '2026-06-08T11:00:00', loai_kham: 'clinic' },
  { id: 5, benh_nhan: 'Phan Văn Hải', diem: 4,
    noi_dung: 'Chuyên môn tốt, tư vấn chi tiết. Sẽ quay lại tái khám theo lịch.',
    ngay_tao: '2026-06-05T16:00:00', loai_kham: 'clinic' },
]
```

### 7.3 Backend API Endpoints (khi gắn MongoDB)

| Hàm service | Method + Endpoint | Ghi chú |
|---|---|---|
| `getProfile()` | `GET /api/doctor/profile` | Cần trả thêm `so_lan_nop` |
| `getStats()` | `GET /api/doctor/stats` | Trả toàn bộ `DoctorStats` mới |
| `getReviews(page, limit)` | `GET /api/doctor/reviews?page=1&limit=5` | Chỉ trả `status='visible'` |
| `getTodayAppointments()` | `GET /api/doctor/appointments?date=today&limit=5` | Sort `gio_kham ASC` |

**Bảo mật backend:**
- `verifyToken` → lấy `user_id` → tìm `doctor_id` tương ứng
- Tất cả query đều filter `doctor_id = req.doctor._id`
- `reviews`: filter `status='visible'` tại backend trước khi trả — không bao giờ trả `hidden`

---

## 8. Lưu ý kỹ thuật quan trọng

### 8.1 Link điều hướng — không dùng query param tab

`DoctorAppointments.tsx` hiện quản lý tab bằng React state, **không đọc URL query params**.
- Tất cả link từ dashboard → `/doctor/appointments` (không thêm `?tab=today`)
- Trang appointments mặc định mở tab "Hôm nay" (`useState<Tab>('today')`) — đúng behavior mong muốn

> Nếu sau này muốn deep-link tab từ URL, cần sửa `DoctorAppointments.tsx` thêm `useSearchParams` — nằm ngoài scope spec này.

### 8.2 Recharts — bắt buộc dùng `ResponsiveContainer`

Tất cả chart đều phải bọc bằng `ResponsiveContainer width="100%"`:
- **Không** dùng `<BarChart width={600}>` hay `<PieChart width={220}>` hard-coded
- Ngoại lệ: Donut chart dùng `cx="50%" cy="50%"` thay vì pixels cố định

### 8.3 Thứ tự implement — tránh TypeScript lỗi

Phải thực hiện **đồng thời** trong 1 commit:
1. Sửa types (`DoctorStats`, `DoctorReview`, `DoctorProfile`) trong `types/index.ts`
2. Thêm 4 type mới (`MonthlyPoint`, `RatingPoint`, `StarDistribution`, `TodayAppointment`) vào `types/index.ts`
3. Cập nhật `mockDoctorStats`, `mockDoctorProfile`, `mockDoctorReviews` trong `mock/doctor-stats.ts`

Nếu làm tách rời, bước 1 sẽ khiến `mockDoctorStats` thiếu required fields → TypeScript build lỗi.

---

## 9. Dependency & Thư viện

| Thư viện | Mục đích | Lệnh cài |
|---|---|---|
| `recharts` | BarChart, LineChart, PieChart, Sparkline | `npm install recharts` |

**Không cần** thư viện khác — Recharts đủ cho toàn bộ spec này.

---

## 10. Tóm tắt biểu đồ

| Section | Loại biểu đồ | Recharts Component | Dữ liệu nguồn |
|---|---|---|---|
| Stat cards (mini) | Sparkline | `LineChart` trong `ResponsiveContainer` | `lich_hen_6_thang[].hoan_thanh` / `diem` |
| Section 3 | Cột kép 6 tháng | `BarChart` grouped | `lich_hen_6_thang` |
| Section 4 | Donut tỉ lệ | `PieChart + innerRadius` | `ty_le_hoan_thanh`, `ty_le_huy` |
| Section 5a | Line xu hướng điểm | `LineChart` | `xu_huong_diem` |
| Section 5b | Phân bố sao | Horizontal bars (CSS) | `phan_bo_sao` |

---

## 11. Checklist triển khai (theo đúng thứ tự)

- [ ] Cài `recharts`: `cd frontend && npm install recharts`
- [ ] **[Cùng 1 bước]** Sửa `types/index.ts`:
  - [ ] Thêm `MonthlyPoint`, `RatingPoint`, `StarDistribution`, `TodayAppointment`
  - [ ] Nâng cấp `DoctorStats` (7 → 12 fields)
  - [ ] Sửa `DoctorReview`: `noi_dung: string | null`, `diem: 1|2|3|4|5`, thêm `loai_kham`
  - [ ] Sửa `DoctorProfile`: thêm `so_lan_nop: number`
- [ ] **[Cùng 1 bước]** Cập nhật `mock/doctor-stats.ts`:
  - [ ] `mockDoctorProfile`: thêm `so_lan_nop: 1`
  - [ ] `mockDoctorStats`: sửa `thang_nay → 32`, `doanh_thu_thang → 11200000`, thêm 5 fields mới
  - [ ] `mockDoctorReviews`: thêm `loai_kham` vào cả 5 item
- [ ] Thêm `getTodayAppointments()` vào `doctorProfileService` trong `services/doctor-profile.service.ts`
- [ ] Refactor `DoctorDashboard.tsx`:
  - [ ] Banner trạng thái hồ sơ (Section 0)
  - [ ] Stat cards + sparkline + pill cảnh báo (Section 1)
  - [ ] Lịch hôm nay (Section 2)
  - [ ] BarChart 6 tháng (Section 3)
  - [ ] Donut chart (Section 4)
  - [ ] LineChart xu hướng + phân bố sao + danh sách reviews + xem thêm (Section 5)
- [ ] Kiểm tra edge cases: `so_danh_gia=0`, `tong_luot_kham=0`, `suspended`, `rejected` hết lần nộp
- [ ] Verify `DoctorReview.status='hidden'` không bao giờ render ở frontend
