# Lỗi ghi nhận ngoài phạm vi — không sửa trong lượt audit C4/B2/B3

> Ngày ghi nhận: 2026-07-02
> Phát hiện khi audit tester 3 chức năng: Quản lý dịch vụ (C4), Lịch làm việc bác sĩ (B2), Lịch hẹn bác sĩ (B3).
> Các lỗi dưới đây nằm ở `backend/src/controllers/patient/booking.controller.js` (A5 — Đặt lịch bệnh nhân),
> KHÔNG thuộc 3 chức năng trên → chỉ ghi nhận, chưa sửa. Cần xử lý trong 1 lượt riêng cho A5/thanh toán.

---

## A. `createBooking()` bỏ qua toàn bộ luồng soft-lock/VNPay đã duyệt

**File:** `backend/src/controllers/patient/booking.controller.js` (hàm `createBooking`)

Đối chiếu spec đã duyệt `docs/superpowers/specs/2026-06-30-booking-payment-softlock-design.md`:

| Spec yêu cầu | Code thực tế |
|---|---|
| `POST /prepare` → atomic lock slot → `pending_payment` (TTL 15 phút) → trả `vnpay_url` | Endpoint `/prepare` không tồn tại |
| VNPay IPN callback SUCCESS → atomic lock `booked` + tạo `LichHen{status:'confirmed', payment_status:'paid'}` + tạo `ThanhToan` | `POST /api/patient/booking` lock thẳng `active→booked` và tạo `LichHen{payment_status:'paid'}` **ngay khi gọi API — không qua VNPay, không bước thanh toán nào** |
| `ThanhToan` model tự ghi chú: *"ThanhToan được tạo ĐỒNG THỜI với LichHen — cả 2 trong cùng 1 transaction sau gateway callback"* (`backend/src/models/ThanhToan.js:14`) | `createBooking()` không bao giờ gọi `ThanhToan.create()` |

**Hậu quả:** gọi `POST /api/patient/booking` với `loai_kham='clinic'` sẽ được ghi nhận "đã thanh toán" miễn phí; trang C8 (`Quản lý thanh toán`) sẽ không có giao dịch nào cho các lịch clinic dù `LichHen.payment_status='paid'` — 2 nguồn dữ liệu (`LichHen` và `ThanhToan`) mâu thuẫn nhau.

**Ghi chú giảm nhẹ:** chưa có `frontend/src/services/booking.service.ts` nào gọi endpoint này (frontend A5 vẫn dùng mock) nên chưa phải lỗi "sống". Nhưng **không được nối FE thẳng vào route hiện có** cho tới khi xây `/prepare` + IPN callback thật (hoặc tối thiểu dùng `phuong_thuc:'mock'` có sẵn trong `ThanhToan` schema để mô phỏng đúng state machine).

---

## B. Không có endpoint nào chuyển `payment_status` unpaid → paid cho HOME

Grep toàn backend: nơi duy nhất gán `payment_status:'paid'` là lúc tạo lịch clinic (mục A) và seed data. Không có `PATCH .../pay` hay action nào cho bệnh nhân thanh toán một lịch `home` sau khi bác sĩ confirm.

**Hậu quả:** kết hợp với việc thiếu cron auto-cancel (đã sửa riêng ở B3, xem task #17), một lịch `home` ở trạng thái `confirmed + unpaid` trước khi có cron sẽ kẹt vĩnh viễn vì không ai thanh toán được. Sau khi có cron 15 phút, ít nhất lịch sẽ tự hủy đúng hạn — nhưng bước "bệnh nhân thanh toán" (bước 4 trong `docs/Bác sĩ/B3 - Lịch hẹn.md` mục 1) vẫn chưa có code nào cả.

**Cần làm khi xử lý A5/thanh toán:** thêm `PATCH /api/patient/booking/:id/pay` (hoặc gộp vào flow VNPay thật) — tạo `ThanhToan`, set `LichHen.payment_status='paid'`, `payment_deadline=null`.

---

## #7. `ten_dich_vu` snapshot sai chuyên khoa khi bác sĩ có nhiều chuyên khoa

**File:** `backend/src/controllers/patient/booking.controller.js:209`

```js
ten_dich_vu = doc.specialties?.[0]?.ten ?? 'Khám tổng quát'
```

Luôn lấy chuyên khoa **đầu tiên** trong mảng `specialties[]`, bất kể bệnh nhân đặt lịch qua chuyên khoa nào (`createBooking` không nhận `specialty_id` trong body để phân biệt). Nếu bác sĩ có 2+ chuyên khoa, lịch hẹn sẽ hiển thị sai tên chuyên khoa trên B3/C5.

**Cần làm:** `createBooking` nên nhận thêm `specialty_id` (context bệnh nhân đã chọn khi tìm bác sĩ) và snapshot đúng chuyên khoa đó thay vì `specialties[0]`.
