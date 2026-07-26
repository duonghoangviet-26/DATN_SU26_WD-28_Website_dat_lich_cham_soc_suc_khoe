# Kiểm thử đầu-cuối: đặt lịch → thanh toán → bác sĩ khám — 2026-07-26

Chạy như **một khách thật**: gọi API qua HTTP, không gọi hàm nội bộ. Trên DB riêng
`DATN_VITAFAMILY_CLAUDE_TEST` + backend cổng 5199 — không đụng DB nhóm.

Script: `backend/src/scripts/e2e-luong-dat-lich.js` (tự chặn nếu tên DB không chứa `TEST`).

**Kết quả cuối: 82/82 đạt.**

---

## 1. Lỗi thật tìm được: bác sĩ không cho bệnh nhân vào phòng được

`PATCH /doctor/queue/:id/into-room` trả **500** với thông báo vô nghĩa:

> `Lich khach (khong co member_id) phai co ten_khach`

Dữ liệu trong DB hoàn toàn hợp lệ — lịch hẹn **có** `ten_khach`.

### Nguyên nhân

```js
const appt = await LichHen.findById(entry.appointment_id).select('status')
appt.status = 'in_progress'
await appt.save()          // ← pre('validate') chạy ở đây
```

`.select('status')` dựng một Mongoose document **chỉ có mỗi trường `status`**. Khi `.save()`, hook `pre('validate')` của `LichHen` chạy trên document rỗng đó: `loai_kham`, `member_id`, `ten_khach` đều `undefined`, nên nó rơi xuống nhánh cuối và ném lỗi.

Thông báo lỗi càng gây lạc hướng vì nó **mô tả sai vấn đề** — người đọc sẽ đi kiểm tra dữ liệu khách hàng, trong khi lỗi nằm ở cách nạp document.

### Phạm vi

Cùng một mẫu ở **3 chỗ**, tức hỏng gần hết các thao tác khám:

| Hàm | Thao tác bị hỏng |
|---|---|
| `intoRoom` | Cho bệnh nhân vào phòng |
| `finish` | Kết thúc khám |
| `updateAppointmentStatus` | Bỏ lượt, huỷ lượt |

Bốn chỗ khác trong `admin/payments.controller.js` dùng cùng `.select('status')` nhưng có `.lean()` — chỉ đọc, không lưu, nên an toàn.

### Vì sao bộ test không bắt được

58 test hiện có không đi qua `into-room`. Lỗi chỉ lộ ra khi chạy trọn vòng đời khám — đúng thứ kiểm thử đầu-cuối sinh ra để làm.

### Cách sửa

Thay bằng `findByIdAndUpdate` — không chạy document middleware, và trả bản ghi cũ để biết trạng thái trước khi đổi (cần cho realtime dashboard):

```js
async function doiTrangThaiLichHen(appointmentId, nextStatus, session = null) {
  const truoc = await LichHen.findByIdAndUpdate(
    appointmentId, { $set: { status: nextStatus } },
    { new: false, ...(session ? { session } : {}) },
  ).select('status').lean()
  return truoc?.status ?? null
}
```

Đặt chú thích cảnh báo ngay tại hàm để lần sau không ai lặp lại.

---

## 2. Bác sĩ nhận được gì

Bác sĩ **nhận đủ**. `GET /doctor/appointments/:id` trả 22 trường:

```
id · ma_lich_hen · benh_nhan · benh_nhan_id · so_dien_thoai · ngay_kham · gio_kham
loai_kham · chuyen_khoa · status · payment_status · gia_kham · ly_do_kham
phong_kham · dia_chi_kham · ten_dich_vu · di_ung · benh_nen
da_co_ket_qua · ket_qua_status · ly_do_huy · payment_deadline
```

Đối chiếu với đơn khách đặt: **tên và số điện thoại khớp chính xác**.

⚠️ **API đổi tên trường khi trả về**: `ten_khach` → `benh_nhan`, `so_dien_thoai_khach` → `so_dien_thoai`. Không phải thiếu dữ liệu, nhưng ai đọc code phía FE cần biết để không tìm nhầm tên.

Ba màn đều nhận đúng:
- `GET /doctor/schedule` — thấy ngày làm việc, kèm khung giờ đã bán
- `GET /doctor/schedule/:id` — chi tiết ca **có** danh sách lịch hẹn
- `GET /doctor/appointments` + `/:id` — danh sách và chi tiết

**Cách ly đúng**: bác sĩ khác truy vấn lịch hẹn này → 404, không lộ dữ liệu.

---

## 3. Luồng đặt lịch — validate

| Tình huống | Kết quả |
|---|---|
| Không tick điều khoản không hoàn tiền | **400** ✓ |
| Thiếu ngày khám | **400** ✓ |
| Ngày quá khứ | chặn ✓ |
| Không đăng nhập | **401** ✓ |
| Đặt hợp lệ | **201** ✓ |

Sau khi đặt:
- Hệ thống **tự gán bác sĩ** ✓ (rơi vào `doctor.bao`, không phải bác sĩ mặc định — đúng luật tự gán)
- Giá = **giá chuyên khoa** ✓
- `nguon = online` ✓
- Lưu `dieu_khoan_version` + thời điểm đồng ý ✓
- Slot → `pending_payment`, có hạn giữ chỗ ✓
- Sinh hoá đơn đúng số tiền ✓

---

## 4. Chặn trùng lượt — đúng cả hai chiều

| Tình huống | Hành vi | Đúng? |
|---|---|---|
| Đặt lại khi **chưa** thanh toán | Nhả giữ chỗ cũ, tạo lịch mới; lịch cũ tự huỷ | ✓ |
| Đặt lại khi **đã** thanh toán | **409** — 1 lượt/chuyên khoa/ngày | ✓ |

Đây chính là hành vi mà bản phân tích ngày 26/07 dự đoán, và là thứ đã sinh ra cặp lịch hẹn trùng slot trên DB nhóm trước khi vá.

---

## 5. Thanh toán

```
payment_status = paid ✓   status = confirmed ✓   xoá hạn thanh toán ✓
slot → booked, gắn bệnh nhân ✓
giao dịch = paid ✓   hoá đơn = da_thanh_toan_du ✓
```

---

## 6. Check-in và hàng đợi

| Tình huống | Kết quả |
|---|---|
| Check-in lịch của **ngày khác** | **409** ✓ |
| Check-in lịch hôm nay | **201** ✓ |
| Check-in **hai lần** | **409** ✓ |

Lịch hẹn được đánh dấu `da_den` + ghi giờ đến thực tế ✓

Hàng đợi trả đủ ba trường của mục 6: `muc_uu_tien` (**động**), `muc_uu_tien_luc_checkin` (snapshot), `da_toi_khung` ✓

⚠️ Endpoint hàng đợi là `GET /doctor/queue-entries`, không phải `/doctor/queue-actions` (tên trong bình luận code cũ gây nhầm).

---

## 7. Vòng đời khám

`gọi → vào phòng → tạo kết quả → đọc lại → kết thúc` — **tất cả 200** sau khi vá lỗi ở mục 1. Kết quả khám lưu đúng chẩn đoán.

---

## 8. Huỷ và dời lịch

**Huỷ lịch đã thanh toán** → bị chặn ✓

⚠️ Nhưng **thông điệp còn sai chính sách**:

> *"...vui lòng liên hệ hotline phòng khám để được hỗ trợ **hoàn tiền**"*

Rule mục 5 chốt **không hoàn tiền trong mọi trường hợp**. Câu này hứa điều phòng khám sẽ không làm. Cần sửa thành hướng dẫn **dời lịch**.

**Dời lịch** (mục 5 — 1 lần, trước `T-30'`):

```
GET phương án      → 200, báo rõ KHÔNG mất tiền, cho biết còn mấy lần   ✓
Phương án đề xuất  → không cái nào lấn slot khách-tới-quầy               ✓
Dời lần 1          → 200, đếm đúng 1 lần, ly_do_doi='khach_yeu_cau'      ✓
                     giá không đổi, vẫn là lịch đã thanh toán            ✓
Dời lần 2          → 409 "Bạn đã dùng hết 1 lần dời lịch"                ✓
```

---

## 9. Việc còn lại từ đợt kiểm thử

1. **Sửa thông điệp huỷ lịch** — đang hứa hoàn tiền, trái mục 5. Nên hướng khách sang dời lịch.
2. **Bổ sung test tự động cho vòng đời khám** — 58 test hiện có không đi qua `into-room`, nên một lỗi chặn đứng công việc hằng ngày của bác sĩ vẫn lọt. Script e2e này nên được đưa vào quy trình chạy định kỳ.
3. **Thống nhất tên trường** `ten_khach`/`benh_nhan` giữa model và API, hoặc ghi rõ vào tài liệu API.
