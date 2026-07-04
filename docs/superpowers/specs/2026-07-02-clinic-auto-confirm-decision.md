# Quyết định — Bỏ bước "Admin xác nhận" cho lịch Clinic (Auto-confirm khi thanh toán)

> Ngày: 2026-07-02
> Trạng thái: Đã chốt
> Sửa đổi: `docs/superpowers/specs/2026-06-27-booking-flow-design.md` (mục 3 Bước 6, mục 4.1, mục 6.2, mục 6.3 Cron 1, mục 7, mục 8.3, mục 9.2)
> Sửa đổi: `docs/superpowers/specs/2026-06-30-booking-payment-softlock-design.md` (mục 4.2, bước 3a IPN)
> Sửa đổi: `docs/DB_CHANGES_BOOKING_FLOW.md` (mục 2 LichHen.js)
> Sửa đổi: `docs/Bác sĩ/B3 - Lịch hẹn.md` (phạm vi áp dụng — chỉ còn home)
> Bối cảnh: phát hiện khi audit 3 chức năng Quản lý dịch vụ / Lịch làm việc bác sĩ / Lịch hẹn — code hiện tại (BS tự confirm) và schema mới thêm (`confirmed_by`, `confirm_deadline`, `admin_missed` — hướng Admin confirm) đang mâu thuẫn, không luồng nào chạy hết được.

---

## 1. Vấn đề của thiết kế cũ (spec 2026-06-27, mục "Bước 6 — Admin xác nhận")

Spec cũ yêu cầu: sau khi BN thanh toán thành công (slot đã atomic-lock), lịch vẫn ở `status='pending'` chờ Admin xác nhận trước `ngay_kham + gio_kham − 30 phút`, cron auto-cancel nếu Admin trễ.

**Vấn đề:** slot **đã** được atomic-lock ngay lúc thanh toán thành công (đảm bảo không double-booking). Bước "Admin xác nhận" sau đó không kiểm tra thêm ràng buộc nghiệp vụ nào cả — nó chỉ là một cổng phê duyệt hình thức. Rủi ro thực tế: nếu Admin bận/quên trong khung SLA, cron sẽ tự hủy + hoàn tiền cho một bệnh nhân **đã làm đúng mọi bước và đã trả tiền hợp lệ** — chỉ vì vận hành nội bộ chậm. Đây là bottleneck nhân tạo, không bảo vệ thêm giá trị nghiệp vụ nào.

## 2. Quyết định

**Tách luồng xác nhận theo `loai_kham`:**

| | Clinic | Home |
|---|---|---|
| Ai tạo slot? | Hệ thống tự sinh sẵn (rolling window B2) | Không có slot cố định — BN chọn giờ tự do |
| Có quyết định nghiệp vụ thật cần con người không? | **Không** — slot đã tồn tại sẵn, atomic-lock lúc thanh toán là đủ | **Có** — BS cần xem địa chỉ/khoảng cách trước khi nhận đi khám tại nhà |
| Luồng xác nhận | **Auto-confirm** ngay khi IPN báo thanh toán thành công | **Giữ nguyên Luồng C cũ** — BS xác nhận thủ công (xem `docs/Bác sĩ/B3 - Lịch hẹn.md`) |

**Lý do giữ nguyên home:** BS xác nhận thủ công ở đây không phải hành chính vô nghĩa — đó là bước duyệt thật (đi được địa chỉ đó không, khung giờ có hợp lý không). Bản chất khác hẳn clinic.

## 3. Luồng Clinic mới (thay thế mục 3 Bước 6–7 và mục 4.1 của spec 2026-06-27)

```
BN chọn slot → điền form → redirect VNPay
  → Soft-lock slot 15 phút (giữ nguyên spec 2026-06-30, TTL không đổi)
  → IPN callback:
      SUCCESS → Atomic: slot.status='booked', benh_nhan_id=user_id
                Tạo LichHen { status: 'confirmed', payment_status: 'paid', ... }   ← ĐỔI: không còn 'pending'
                Tạo ThanhToan { status: 'paid', ... }
                Notify BS + Notify BN NGAY LẬP TỨC (không đợi ai duyệt)
      FAIL/HỦY → slot → active, không tạo LichHen, không tạo ThanhToan
  → BN đến khám → Admin mark 'completed' (giữ nguyên)
```

### 3.1 State machine `LichHen.status` (clinic) — thay thế mục 4.1

```
(chưa tồn tại) ──[IPN thanh toán thành công]──→ confirmed
confirmed ──── BN cancel (>24h trước giờ khám) ──→ cancelled
          ──── Admin cancel (bất kỳ lúc nào, lý do bắt buộc) ──→ cancelled
          ──── BS cancel khẩn cấp (lý do bắt buộc) ──→ cancelled
          ──── Admin mark ──→ completed
```

> Không còn trạng thái `pending` cho clinic. `pending` chỉ còn tồn tại cho **home** (chờ BS xác nhận thủ công).

### 3.2 Admin / BS làm gì sau auto-confirm?

Admin/BS **không còn thao tác "duyệt"**. C5 (Admin) đổi vai trò từ "hàng chờ phê duyệt" sang "giám sát + xử lý ngoại lệ":
- Xem toàn bộ lịch hệ thống (mọi trạng thái), filter/search.
- Hủy lịch bất kỳ lúc nào kèm lý do bắt buộc (giữ nguyên — dùng cho trường hợp phòng khám có sự cố, cần dời lịch...).
- Mark `completed` sau khi BN khám xong (giữ nguyên).
- **Bỏ:** nút "Xác nhận", countdown SLA, badge "chờ xác nhận" cho clinic.

BS (B3) giữ nguyên như đã mô tả ở spec 2026-06-27 mục 12 (đã đúng từ trước, không đổi): chỉ xem confirmed+completed+cancelled, có quyền "Hủy khẩn cấp" (lý do bắt buộc, slot → `locked` chứ không về `active`).

## 4. Thay đổi Database — thay thế mục 5.2 (LichHen) của spec 2026-06-27 và mục 2 của `DB_CHANGES_BOOKING_FLOW.md`

```js
// BỎ hoàn toàn khỏi LichHen.js (không cần nữa vì clinic không còn ai "confirm"):
confirmed_by       // ❌ bỏ
confirm_deadline   // ❌ bỏ
admin_missed       // ❌ bỏ

// BỎ pre-save hook auto-set confirm_deadline (appointmentSchema.pre('save', ...))
// BỎ index { status: 1, loai_kham: 1, confirm_deadline: 1 }
// BỎ index { confirmed_by: 1 } và { admin_missed: 1 }

// GIỮ NGUYÊN (đã đúng, không đổi):
payment_deadline     // vẫn dùng cho HOME (BS confirm → BN thanh toán trong 2h)
pending_booking_id   // vẫn dùng để audit khớp IPN VNPay (spec 2026-06-30)
```

**Lý do bỏ thay vì giữ làm field tùy chọn:** 3 field này chỉ có ý nghĩa nếu có bước "Admin confirm" — nay bước đó không còn tồn tại cho clinic, và home không dùng field này (home dùng `payment_deadline`). Giữ lại sẽ là schema chết, gây nhầm lẫn cho người đọc sau.

## 5. Cron Jobs — thay thế mục 6.3 của spec 2026-06-27

```
❌ BỎ Cron "auto-cancel LichHen pending quá confirm_deadline" cho clinic — không còn trạng thái pending cần cron dọn nữa (auto-confirm ngay khi thanh toán, không có gì bị "treo" ở giữa).

✅ GIỮ NGUYÊN — Cron dọn slot pending_payment hết hạn (spec 2026-06-30, mỗi 5 phút).
✅ GIỮ NGUYÊN — Cron đánh dấu slot quá ngày → expired (mỗi ngày 00:05).
✅ GIỮ NGUYÊN — Cron auto-cancel HOME khi confirmed+unpaid quá payment_deadline (mỗi 15 phút, theo `docs/Bác sĩ/B3 - Lịch hẹn.md`).
✅ GIỮ NGUYÊN — Cron sinh slot rolling-window T2–T7 lúc 23:55 (B2).
```

## 6. API — thay thế mục 9.2 của spec 2026-06-27

```
❌ BỎ  PATCH /api/admin/appointments/:id/confirm   — không còn cần cho clinic
✅ GIỮ PATCH /api/admin/appointments/:id/cancel    — Admin hủy bất kỳ lúc nào, lý do bắt buộc
✅ THÊM PATCH /api/admin/appointments/:id/complete  — hiện tại route này còn thiếu ở backend, cần bổ sung
✅ GIỮ nguyên toàn bộ API Doctor (B3) — chỉ xem + emergency-cancel, không đổi
```

## 7. Việc cần sửa trong code hiện tại (ghi nhận, CHƯA thực hiện — chờ yêu cầu implement)

- `backend/src/models/LichHen.js` — bỏ 3 field + hook + index theo mục 4.
- `backend/src/controllers/doctor/appointments.controller.js` — bỏ action `confirm()` (đã sai theo quyết định này — chỉ dùng cho home, cần thêm điều kiện `loai_kham==='home'` hoặc tách route riêng).
- `backend/src/controllers/admin/appointments.controller.js` — thêm `complete()`; không cần thêm `confirm()`.
- `backend/src/routes/admin/appointments.routes.js` — thêm `PATCH /:id/complete`.
- `backend/src/controllers/patient/booking.controller.js` — chưa có luồng thanh toán/IPN nào cả (ghi nhận ở lần audit trước) — khi viết, tạo LichHen thẳng `status='confirmed'` cho clinic theo mục 3.1 ở trên.
- `frontend/src/pages/doctor/DoctorAppointments.tsx` — bỏ nút "Xác nhận"/"Từ chối" cho **clinic**; chỉ giữ cho **home** (hiện tại code không phân biệt `loai_kham` khi hiển thị 2 nút này — đây là lỗi cần sửa).
- `frontend/src/pages/admin/ManageAppointments.tsx` — thêm nút "Hoàn thành"; không cần thêm nút "Xác nhận".
- `frontend/src/types/index.ts` / mock liên quan — bỏ field `confirmed_by`/`confirm_deadline`/`admin_missed` nếu đã lỡ thêm, hoặc không thêm nữa nếu chưa có.
