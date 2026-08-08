# Gỡ conflict merge nhánh `client` (PR #35) — 2026-07-26

Merge `0262d8d` (PR #35 từ `duonghoangviet-26/client`) vào `Bac_si` tại `5f41d78`.
Gốc chung: `6405e12`.

**Hai file conflict:** `backend/src/controllers/patient/booking.controller.js` (7 vùng) và
`frontend/src/pages/client/Booking.tsx` (10 vùng).

---

## 1. Nguyên nhân: hai người làm cùng một tính năng

Cả hai nhánh đều tự làm **tự gán bác sĩ**, theo hai cách khác nhau:

| | Nhánh `client` | Nhánh `Bac_si` |
|---|---|---|
| Tên | "Least Load Allocation" | rule mục 12 |
| API xem chỗ | `GET /doctors/all/slots` (gộp mọi bác sĩ, trả `available_count`) | `GET /specialties/:id/slots` (gộp theo chuyên khoa, trả `so_cho_trong` + **giá**) |
| API đặt | `doctor_id: 'auto'` + `gio_kham` | `specialty_id` + `gio_bat_dau` |
| Lọc chuyên khoa | **Không** | Có |
| Đếm tải | cả **ngày** | trong **ca** (rule mục 12) |
| Giữ mạch tái khám | Không | Có (rule mục 12 bước 1) |
| Tie-break xác định | **Không** | Có — `doctor_id` tăng dần |
| Giá theo chuyên khoa | Không | Có (rule mục 12) |
| Cutoff `T-30'` | Không | Có (rule mục 11) |
| Bắt buộc điều khoản | Không | Có (rule mục 5) |
| Chặn trùng lượt | Không | Có (rule mục 5) |
| Đường chọn bác sĩ đích danh | **Bỏ hẳn** (4 bước) | Giữ (rule mục 12 yêu cầu) |

Đây không phải "bên nào đúng bên nào sai" — hai bên làm song song, không biết nhau.

---

## 2. Ba lỗi trong bản nhánh `client` (đã vá khi hợp nhất)

**a. Không lọc chuyên khoa.** `getSlots` và `createBooking` gộp **mọi** bác sĩ đã duyệt, bất kể chuyên khoa. Khách chọn Tai Mũi Họng có thể bị xếp bác sĩ Nhi khoa. Đây là lỗi nghiêm trọng nhất.

**b. Thứ tự gán không xác định.** Chỉ sắp theo số lịch trong ngày; hai bác sĩ cùng tải thì thứ tự phụ thuộc thứ tự Mongo trả về. Rule mục 12 chốt *"thứ tự gán XÁC ĐỊNH, KHÔNG random — để kiểm thử lặp lại được"*.

**c. Hardcode tên phòng.** `phong_kham = ... || 'Phòng 102 - Tầng 1'` — in cho bệnh nhân một phòng có thể không tồn tại. Thà để `null` còn hơn để họ đi tìm không thấy.

---

## 3. Cách hợp nhất

### `booking.controller.js` — giữ cả hai hợp đồng API

Không chọn một bên. Backend nay **nhận cả ba cách gọi**:

```
GET /doctors/:id/slots            → đích danh một bác sĩ   (cả hai nhánh đều có)
GET /doctors/all|auto/slots       → gộp mọi bác sĩ         (nhánh client)
    + tuỳ chọn ?specialty_id=     → vá lỗi (a)
GET /specialties/:id/slots        → gộp theo chuyên khoa + giá (nhánh Bac_si)

POST /booking { doctor_id }                    → đích danh
POST /booking { doctor_id: 'auto', gio_kham }  → nhánh client
POST /booking { specialty_id, gio_bat_dau }    → nhánh Bac_si
```

Hai đường tự gán **cùng đi qua** `chonBacSiChoKhung()` nên đều có lọc chuyên khoa + thứ tự xác định + giữ mạch tái khám. FE của nhánh `client` chạy y nguyên mà không còn ba lỗi trên.

Khi gọi kiểu `'auto'` mà không truyền `specialty_id`, chuyên khoa được **suy từ chính slot khách đã chọn** (slot → `specialty_id`, hoặc bác sĩ của lịch đó). Không suy được thì trả 400 thay vì gán bừa.

### Đã tiếp nhận từ nhánh `client`

- **Gộp slot theo giờ + `available_count`** — ý hay: một khung có nhiều slot và nhiều bác sĩ trực, trả từng slot sẽ hiện cùng một giờ nhiều lần.
- **Fallback phòng mặc định của bác sĩ** khi slot chưa có phòng — giải quyết đúng điểm `phong_kham = null` mà kiểm thử đầu-cuối đã phát hiện. Chỉ bỏ phần hardcode tên phòng.
- **Thông báo lỗi có dấu tiếng Việt** — dễ đọc hơn bản không dấu.

### Đã giữ từ nhánh `Bac_si`

- `donDepSlotTruocKhiDoc()` — nhả giữ chỗ quá hạn + chuyển cutoff `T-30'` (mục 11)
- `daQuaCutoffOnline()` trong `getSlots` — không chào bán khung đã đóng
- Lọc `bi_khoa_boi_nghi_phep` — không chào bán slot bác sĩ đã nghỉ
- `$elemMatch` khi claim slot — bản nhánh `client` quay lại cách viết rời (`'slots._id'`, `'slots.status'`…), đúng lỗi P0 đã vá: Mongo cho phép mỗi điều kiện khớp một **phần tử khác nhau** của mảng nên có thể cướp slot người khác đang giữ
- Giữ chỗ co giãn, chặn trùng lượt, giá theo chuyên khoa, bắt buộc điều khoản

### `Booking.tsx` — lấy bản `Bac_si`

Đối chiếu **toàn bộ state** của hai bản: bản `Bac_si` là **siêu tập hợp**, không thiếu state nào của nhánh `client`.

```
state chỉ có ở nhánh client mà bản Bac_si thiếu: (không có)
```

Hai lý do buộc phải lấy bản `Bac_si`:

1. Bản nhánh `client` **không gửi `dong_y_dieu_khoan`** → backend trả 400 cho **mọi** lượt đặt (rule mục 5: không có bằng chứng đồng ý điều khoản thì không được thu tiền). Lấy bản đó là client vỡ hoàn toàn.
2. Bản nhánh `client` **bỏ hẳn** đường chọn bác sĩ đích danh, trái rule mục 12: *"Vẫn giữ đường 'chọn đích danh bác sĩ' cho tái khám… Không bỏ luồng chọn bác sĩ đang có."*

Tinh thần đơn giản hoá của họ **được giữ**: bản `Bac_si` mặc định chọn "Để phòng khám xếp bác sĩ", khách không phải so sánh từng bác sĩ — chỉ khác là vẫn có đường thứ hai cho ai cần.

### Tính năng chính của PR #35 KHÔNG bị mất

Commit của họ tên *"thêm phần thông tin cá nhân ở lịch hẹn ở client"*. Phần đó nằm ở `records.controller.js`, `patient-records.service.ts`, `Profile.tsx` — **merge tự động, không conflict**, còn nguyên 78 dòng thêm.

---

## 4. Kiểm chứng

Chạy thật trên DB test, xác nhận **cả ba** hợp đồng API cùng hoạt động:

```
A. Hợp đồng nhánh client (doctor_id = all/auto)
   GET /doctors/all/slots → 200, 15 khung, có available_count       ✓
   khung đầu: 08:00 — 4 chỗ — phòng: "Phòng 101, Tầng 1, Tòa A"     ✓ (fallback phòng chạy)
B. Lọc chuyên khoa (vá lỗi gán sai chuyên khoa)                     ✓
C. Đặt lịch kiểu doctor_id:'auto' + gio_kham → 201                  ✓
   được gán bác sĩ · giá = giá chuyên khoa · ĐÚNG chuyên khoa        ✓
D. Thiếu dong_y_dieu_khoan → 400                                    ✓
E. Đường chọn đích danh còn chạy; id sai → 400                       ✓
F. Đường /specialties/:id/slots còn chạy, trả kèm giá                ✓
```

E2E đầy đủ: **85/85**. Test suite: **58/58**. Frontend `tsc`: 43 lỗi = đúng baseline có sẵn.

---

## 5. Việc nên làm tiếp

**Thống nhất một hợp đồng API.** Hiện có ba đường cùng làm một việc — giữ cả ba chỉ là để merge không phá ai. Nên chốt với nhóm dùng đường nào rồi bỏ hai đường kia, kèm hạn chuyển đổi.

**Nói trước khi làm trùng.** Hai người viết cùng một thuật toán tự gán trong cùng một tuần. Rule đã ghi mục 12 từ 2026-07-25 — nếu đọc rule trước khi làm thì tránh được cả conflict này lẫn ba lỗi ở mục 2.
