# Tester Scenarios: Hồ sơ Bác sĩ — B1

> **Ngày:** 2026-06-17
> **Phương pháp:** Scenario-based testing — Phân tích 35 tình huống thực tế
> **Mục tiêu:** Phát hiện gaps logic nghiệp vụ → đưa ra phương án tối ưu
> **Đọc cùng:** `2026-06-17-doctor-profile-design.md`

Quy ước:
- ✅ Phương án tối ưu được chọn
- ⚠️ Phương án cần thận trọng
- ❌ Phương án không nên dùng
- 🔴 Ảnh hưởng code ngay
- 🟡 Ảnh hưởng spec / UX
- 🟢 Nice-to-have, làm sau

---

## NHÓM 1 — Quy trình Nộp & Xét duyệt

---

### S01: Bác sĩ nộp hồ sơ khi thiếu thông tin bắt buộc

**Tình huống:** Bác sĩ vừa đăng ký tài khoản, `bang_cap` và `chuyen_khoa_id` đều rỗng. Bấm "Nộp hồ sơ xét duyệt" ngay.

**Vấn đề:** Admin nhận được hồ sơ rỗng → từ chối ngay → lãng phí 1 lượt trong 5 lần nộp của bác sĩ.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Cho nộp, Admin tự từ chối | Tự do cho bác sĩ | Lãng phí lượt nộp, mất thời gian Admin |
| ✅ Validate FE trước khi gửi | UX tốt, rõ lỗi | Cần list required fields |
| ✅ Validate BE chặn nếu thiếu | Bảo vệ data | Vẫn cần FE guide |

**✅ Phương án tối ưu:** Validate cả FE lẫn BE.

**Fields bắt buộc để nộp** (tối thiểu):
- `bang_cap` (không rỗng)
- `chuyen_khoa_id` (phải chọn từ list)
- `so_nam_kinh_nghiem` (≥ 0)

**Fields khuyến khích** (không bắt buộc nhưng completeness warning):
- `tieu_su`, `so_dien_thoai`, `anh_dai_dien`, `hospitals[]`, `services[]`

**Quy trình FE:**
```
Click "Nộp hồ sơ"
  → Kiểm tra required fields
  → Nếu thiếu: highlight field đỏ + scroll đến field đầu tiên sai
  → Nếu completeness < 60%: dialog xác nhận "Hồ sơ chưa đầy đủ. Tiếp tục?"
  → Nếu đủ: submit
```

**Quy tắc đặc biệt:** Lỗi validation FE KHÔNG tính vào `so_lan_nop`. Chỉ tính khi request thực sự gửi đến server thành công.

🔴 **Ảnh hưởng code:** Cần thêm validate step trước `submitForReview()`

---

### S02: Bác sĩ nộp hồ sơ → Admin bận 3 ngày chưa duyệt → bác sĩ muốn rút lại để sửa

**Tình huống:** Bác sĩ đang `pending`, phát hiện mình viết sai tên trường đại học trong `bang_cap`. Muốn sửa trước khi Admin đọc.

**Vấn đề:** Không có nút "Rút lại hồ sơ" — bác sĩ bị kẹt chờ bị từ chối để nộp lại.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Không cho rút — đợi từ chối | Đơn giản | Lãng phí 1 lượt nộp; Admin thấy hồ sơ sai |
| ✅ Cho phép "Rút lại" khi `pending` | Flexible, không lãng phí lượt | Cần thêm logic; Admin đang review thì sao? |
| ⚠️ Cho sửa nhưng không rút — Admin thấy bản mới nhất | Tiện | Admin có thể đang đọc bản cũ → confusing |

**✅ Phương án tối ưu: Cho phép "Rút lại hồ sơ" khi `pending`**

**Quy tắc:**
- `pending → rejected` (bởi bác sĩ tự rút) — KHÔNG tăng `so_lan_nop`
- `ly_do_tu_choi = null` (không có lý do từ Admin)
- Thêm field `tu_rut_lai: boolean` để phân biệt "bác sĩ tự rút" vs "Admin từ chối"
- Admin nhận notification hủy xét duyệt: "BS. Nguyễn A đã rút lại hồ sơ"
- Bác sĩ được edit và nộp lại bình thường (lần nộp tiếp theo mới tăng `so_lan_nop`)

**State update:**
```
pending --[bác sĩ rút]--> rejected (tu_rut_lai=true, so_lan_nop không đổi)
```

🟡 **Ảnh hưởng spec:** Thêm trạng thái phụ `tu_rut_lai` và nút "Rút lại" trong banner `pending`

---

### S03: Bác sĩ bị từ chối lần 5 — bị kẹt vĩnh viễn

**Tình huống:** Bác sĩ nộp 5 lần đều bị từ chối do chứng chỉ không hợp lệ. Giờ không thể nộp lại, không có cách nào tiếp tục.

**Vấn đề:** Không có lối thoát — bác sĩ bị stuck vĩnh viễn trong hệ thống.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Không làm gì — bác sĩ tự liên hệ ngoài | Đơn giản nhất | Trải nghiệm tệ; không có SLA |
| ✅ Admin có thể reset `so_lan_nop` | Flexible | Cần tính năng Admin |
| ✅ Link "Liên hệ hỗ trợ" với email/form support | UX tốt | Thêm email support |

**✅ Phương án tối ưu: Kết hợp 2 giải pháp**

**UI khi `so_lan_nop >= 5`:**
```
[Banner đỏ]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⛔ Đã vượt quá số lần nộp hồ sơ (5/5 lần)

Bạn không thể tự nộp lại. Để được hỗ trợ:
📧 Email: support@vitafamily.vn
📋 Tiêu đề: "Yêu cầu xét duyệt lại — [email bác sĩ]"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Admin panel (C2):** Nút "Reset lượt nộp" — Admin có thể reset `so_lan_nop = 0` sau khi bác sĩ liên hệ và giải trình. Có log audit.

🟡 **Ảnh hưởng spec:** Cần thêm UI hướng dẫn + tính năng reset từ Admin side

---

### S04: Admin duyệt nhưng `users.role` chưa đổi do transaction fail

**Tình huống:** MongoDB session timeout trong khi chạy: `doctors.trang_thai_duyet = 'approved'` + `users.role = 'doctor'`. Transaction fail partial.

**Hậu quả:** Bác sĩ `approved` nhưng JWT vẫn có `role='user'` → không vào được `/doctor/*`.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Retry manual | Đơn giản | Admin không biết có lỗi |
| ✅ MongoDB transaction + rollback | Atomic | Cần replica set |
| ✅ Compensation job: mỗi giờ check doctors.approved mà users.role≠doctor | Self-healing | Có độ trễ 1h |

**✅ Phương án tối ưu: MongoDB session transaction + monitoring alert**

```js
const session = await mongoose.startSession()
session.startTransaction()
try {
  await Doctor.updateOne({ _id }, { trang_thai_duyet: 'approved' }, { session })
  await User.updateOne({ _id: doctor.user_id }, { role: 'doctor' }, { session })
  await session.commitTransaction()
} catch (err) {
  await session.abortTransaction()
  // Alert: Slack/email to admin team
  throw err
}
```

**Compensation job (safety net):**
```js
// Chạy mỗi 1 giờ
const mismatches = await Doctor.aggregate([
  { $match: { trang_thai_duyet: 'approved' } },
  { $lookup: { from: 'users', localField: 'user_id', ... } },
  { $match: { 'user.role': { $ne: 'doctor' } } }
])
// Fix + alert nếu tìm thấy mismatch
```

🔴 **Ảnh hưởng code:** Critical — phải implement transaction trong approval endpoint

---

### S05: Bác sĩ nộp lại lần thứ 4 — vô tình bấm submit 2 lần (double-click)

**Tình huống:** Network chậm → bác sĩ bấm "Nộp lại" → không thấy phản hồi → bấm lại → 2 request gửi đến server.

**Vấn đề:** `so_lan_nop` tăng từ 4 → 6, vượt giới hạn 5.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Không làm gì | Đơn giản | Bác sĩ mất lượt nộp |
| ✅ FE: disable button sau click đầu | UX tốt | Cần implementation |
| ✅ BE: idempotency check — nếu đang `pending` thì không tăng `so_lan_nop` | Bulletproof | Logic rõ ràng |

**✅ Phương án tối ưu: Cả 2 lớp bảo vệ**

```
FE: button disabled + loading spinner sau click đầu tiên
BE: if (doctor.trang_thai_duyet === 'pending') return 409 "Hồ sơ đang xét duyệt"
```

Thêm: Request idempotency key (UUID gửi từ FE) để chặn duplicate request network-level.

🔴 **Ảnh hưởng code:** Disable button + BE guard

---

## NHÓM 2 — Trạng thái Approved & Hoạt động

---

### S06: Bác sĩ approved, tăng phi_tu_van từ 300k → 500k — bệnh nhân đang điền form đặt lịch

**Tình huống:** Bệnh nhân đang ở bước "xem slot" (thấy giá 300k), chưa thanh toán. Bác sĩ vừa đổi giá → 500k.

**Vấn đề:** Bệnh nhân trả 300k hay 500k?

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Lấy giá hiện tại lúc payment | Bác sĩ luôn đúng | Bệnh nhân bị bất ngờ |
| ✅ Snapshot giá lúc tạo `appointment` object | Consistent | Giá lúc đặt chính xác |
| ⚠️ Cảnh báo nếu giá thay đổi > X% trước payment | Transparent | Cần detect change |

**✅ Phương án tối ưu: Snapshot `gia_kham` lúc tạo appointment**

```
Bước đặt lịch:
1. Bệnh nhân chọn slot → hệ thống tạo appointment draft với gia_kham = doctor.phi_tu_van lúc đó
2. Trong 15 phút thanh toán → gia_kham KHÔNG thay đổi dù bác sĩ đổi phi_tu_van
3. Quá 15 phút unpaid → hủy, slot trả lại
4. Bệnh nhân đặt lại → snapshot giá mới
```

**Quy tắc bổ sung:** Trên trang tìm kiếm bác sĩ → hiện `phi_tu_van` hiện tại (có thể không nhất quán trong cùng session ngắn — chấp nhận được).

🟡 **Ảnh hưởng spec:** Ghi rõ thời điểm snapshot = lúc tạo appointment, không phải lúc payment

---

### S07: Bác sĩ approved + `la_hien=true` nhưng chưa tạo slot nào trong 30 ngày tới

**Tình huống:** Bệnh nhân tìm thấy bác sĩ trên trang tìm kiếm → vào trang bác sĩ → không có slot nào khả dụng → confused.

**Vấn đề:** UX tệ — bệnh nhân không hiểu tại sao tìm thấy mà không đặt được.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Auto ẩn khi không có slot | Simple | Bác sĩ không biết mình bị ẩn |
| ✅ Hiện với badge "Tạm không nhận khám" | Transparent | Bệnh nhân hiểu |
| ✅ Notify bác sĩ: "Bạn không có lịch 7 ngày tới — bệnh nhân không đặt được" | Proactive | Tốt cho bác sĩ |

**✅ Phương án tối ưu: Badge + notification**

**Logic hiển thị trên trang tìm kiếm:**
```
approved + la_hien=true + có slot active trong 7 ngày → Hiện bình thường
approved + la_hien=true + KHÔNG có slot trong 7 ngày → Hiện với badge "Tạm không nhận khám"
approved + la_hien=false → Ẩn hoàn toàn
```

**Notification cho bác sĩ** (gửi mỗi Thứ 2 sáng nếu không có slot tuần tới):
> "Bạn chưa có lịch khám tuần tới. Bệnh nhân hiện không thể đặt lịch. Thêm lịch ngay →"

🟡 **Ảnh hưởng spec:** Thêm logic badge + weekly notification cron

---

### S08: Admin suspend bác sĩ khi đang có 8 lịch hẹn confirmed

**Tình huống:** Bác sĩ vi phạm → Admin suspend. Bác sĩ đang có 8 lịch `confirmed` trong 2 tuần tới.

**Vấn đề:** 8 bệnh nhân này cần được thông báo. Lịch có bị hủy không? Ai hoàn tiền?

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Auto-hủy tất cả khi suspend | Nhanh | Bệnh nhân bị shock |
| ✅ Admin chọn: "Hủy tất cả + hoàn tiền" hoặc "Chuyển sang bác sĩ khác" | Flexible | Phức tạp hơn |
| ✅ Suspend trước, Admin xử lý lịch hẹn riêng | Phân tách trách nhiệm | Cần 2 bước |

**✅ Phương án tối ưu: Suspend hiển thị warning + Admin quyết định từng bước**

**Flow suspend:**
```
Admin click "Tạm ngưng BS. X"
  → Kiểm tra: BS. X có lịch hẹn confirmed/pending không?
  → Nếu có (8 lịch):
      Dialog: "BS. X đang có 8 lịch hẹn chưa hoàn thành.
               ⚠️ Tạm ngưng sẽ không tự hủy lịch hẹn.
               Bạn cần xử lý thủ công qua trang Quản lý Lịch hẹn (C5).
               [Xác nhận tạm ngưng] [Hủy]"
  → Confirm → suspend (la_hien=false, không touch appointments)
  → Admin vào C5 để xử lý từng lịch
```

**Quy tắc:** Suspend KHÔNG tự hủy lịch hẹn. Admin phải xử lý thủ công (hủy + hoàn tiền 100% như bác sĩ chủ động hủy).

**Notification bệnh nhân:** Chỉ gửi khi Admin hủy từng lịch — không gửi khi chỉ suspend.

🔴 **Ảnh hưởng code:** Admin C2 cần kiểm tra appointments trước khi suspend

---

### S09: Bác sĩ approved bị `la_hien=false` (do bị suspend) → Admin unsuspend → `la_hien` không tự bật

**Tình huống:** Bác sĩ bị suspend → `la_hien=false`. Admin unsuspend. Bác sĩ vào trang thấy mình đã được mở khóa nhưng vẫn không xuất hiện trên trang tìm kiếm. Bác sĩ không hiểu tại sao.

**Vấn đề:** UX confusing — bác sĩ không biết cần tự bật lại `la_hien`.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ⚠️ Tự động bật `la_hien=true` khi unsuspend | Dễ hiểu | Bác sĩ có thể muốn ẩn (đang dọn slot) |
| ✅ Giữ nguyên + thông báo rõ ràng | Respect intent | Cần explain trong UI |
| ✅ Dialog khi unsuspend: "Có muốn bật hiển thị lại?" | Explicit | Thêm step |

**✅ Phương án tối ưu: Dialog khi unsuspend**

```
Admin unsuspend BS. X
  → Dialog: "BS. X đã được khôi phục.
             Hiện tại profile đang ẩn (la_hien=false).
             Có muốn bật hiển thị trên trang tìm kiếm không?
             [Bật hiển thị] [Để ẩn]"
```

**Nếu Admin chọn "Để ẩn":** Bác sĩ vào `/doctor/profile` thấy thông báo:
> "Tài khoản đã được khôi phục. Profile đang ẩn — bật toggle 'Hiển thị' để bệnh nhân tìm thấy bạn."

🟡 **Ảnh hưởng spec:** Thêm step dialog vào flow Admin unsuspend; thêm notification cho bác sĩ

---

## NHÓM 3 — Rejection & Resubmission

---

### S10: Bác sĩ bị từ chối vì "thiếu công chứng" nhưng không có nơi upload chứng chỉ

**Tình huống:** Admin từ chối: "Bằng cấp chưa được công chứng đầy đủ." Bác sĩ muốn nộp lại với file bằng cấp đã công chứng nhưng chỉ có thể ghi text vào `bang_cap`.

**Vấn đề:** Không có field upload tài liệu đính kèm → Admin không thể verify.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Chỉ dùng text bang_cap | Đơn giản | Admin không xác minh được |
| ✅ Thêm `tai_lieu[]` — upload PDF/ảnh chứng chỉ | Chuẩn nhất | Phức tạp, cần cloud storage |
| ⚠️ Link Google Drive / URL tự điền | Interim solution | Không kiểm soát được |

**✅ Phương án tối ưu: `tai_lieu[]` field với upload giới hạn**

```ts
interface DoctorDocument {
  id: number
  ten_tai_lieu: string      // "Bằng Tiến sĩ — ĐH Y Hà Nội"
  loai: 'bang_cap' | 'chung_chi' | 'chung_minh_nhan_than' | 'khac'
  url: string               // cloud storage URL
  ngay_upload: string
}
```

**Giới hạn:**
- Tối đa 10 file
- Mỗi file ≤ 10MB
- Định dạng: PDF, JPG, PNG
- File được giữ lại qua các lần nộp (không xóa khi từ chối)

**Admin xem:** Trong trang C2 duyệt hồ sơ → tab "Tài liệu đính kèm" hiện danh sách file.

🟡 **Ảnh hưởng spec:** Thêm `tai_lieu[]` vào `doctors` collection; thêm UI upload trong form profile

---

### S11: Bác sĩ nộp lại lần 4 (lần cuối) — vô tình không đọc cảnh báo

**Tình huống:** Banner vàng "Đây là lần nộp cuối" hiện nhưng bác sĩ bấm luôn không đọc.

**Vấn đề:** Cảnh báo không đủ friction để bác sĩ dừng lại và kiểm tra.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Chỉ banner — không thêm | Minimal friction | Bác sĩ bỏ qua |
| ✅ Confirmation dialog bắt buộc | High friction đúng lúc | Thêm 1 click |
| ⚠️ Checklist bắt buộc tick trước khi submit | Maximum friction | Annoying nếu lạm dụng |

**✅ Phương án tối ưu: Confirmation dialog khi `so_lan_nop = 4`**

```
Dialog xuất hiện khi click "Nộp lại" lần 4:

⚠️ Đây là lần nộp cuối cùng của bạn

Sau lần nộp này, bạn sẽ không thể tự nộp lại nếu bị từ chối.
Hãy kiểm tra lại:
☐ Bằng cấp đã điền đúng và đủ
☐ Tài liệu đính kèm đã đầy đủ
☐ Lý do từ chối lần trước đã được giải quyết

[Quay lại kiểm tra]    [Xác nhận nộp lần cuối]
```

Nút "Xác nhận" chỉ active sau khi tick đủ 3 checkbox.

🟡 **Ảnh hưởng spec:** Thêm confirmation dialog logic cho lần nộp thứ 4

---

### S12: Admin ghi lý do từ chối không rõ ràng — bác sĩ không biết sửa gì

**Tình huống:** Admin từ chối với lý do: "Hồ sơ không đủ điều kiện." Bác sĩ không biết thiếu gì.

**Vấn đề:** Lý do mơ hồ → bác sĩ nộp lại y hệt → từ chối lần 2 → lãng phí lượt.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Không kiểm soát lý do Admin ghi | Tự do | Quality tệ |
| ✅ Lý do từ chối có cấu trúc: chọn loại + ghi thêm | Consistent | Cần design Admin UI |
| ✅ Minimum length validation (≥ 20 ký tự) | Simple guard | Vẫn có thể ghi nhảm |

**✅ Phương án tối ưu: Structured rejection reasons**

```
Admin chọn loại từ chối (checkbox, có thể chọn nhiều):
☐ Thiếu/sai thông tin bằng cấp
☐ Thiếu tài liệu đính kèm
☐ Chuyên khoa không phù hợp với bằng cấp
☐ Thông tin không đủ thuyết phục
☐ Khác (bắt buộc ghi chi tiết)

+ Textarea ghi thêm (bắt buộc nếu chọn "Khác", optional nếu chọn items trên)
```

**Hiển thị cho bác sĩ:**
```
[Banner đỏ]
Hồ sơ bị từ chối vì:
• Thiếu tài liệu đính kèm
• Thông tin không đủ thuyết phục

Ghi chú từ Admin: "Vui lòng upload bản công chứng bằng tiến sĩ"
```

🟡 **Ảnh hưởng spec:** Thêm `ly_do_tu_choi_loai[]` structured field; update Admin C2 UI

---

## NHÓM 4 — la_hien Toggle & Visibility

---

### S13: Bác sĩ tắt `la_hien` → bệnh nhân đang ở giữa flow đặt lịch (đã chọn slot, chưa trả tiền)

**Tình huống:** Bệnh nhân ở bước thanh toán. Đúng lúc đó bác sĩ tắt `la_hien`.

**Vấn đề:** Bệnh nhân có hoàn thành được không?

**Phân tích:**
`la_hien` chỉ ảnh hưởng đến **trang tìm kiếm** — không ảnh hưởng đến **flow đặt lịch đang diễn ra**.

**✅ Phương án tối ưu:** `la_hien=false` KHÔNG hủy appointment draft đang trong 15 phút chờ thanh toán.

```
la_hien=false ảnh hưởng:
  ✓ Ẩn khỏi trang tìm kiếm
  ✓ Ẩn khỏi trang profile public
  ✗ KHÔNG hủy appointment đang pending/confirmed
  ✗ KHÔNG hủy slot đang active
```

**Quy tắc implement:** `la_hien` chỉ được check ở bước **search/discovery**. Sau khi bệnh nhân đã vào flow (có `appointment_id`) → không check nữa.

🔴 **Ảnh hưởng code:** Search query thêm filter `la_hien=true`; appointment flow không check `la_hien`

---

### S14: Bệnh nhân có direct link đến profile bác sĩ đang ẩn (`la_hien=false`)

**Tình huống:** Bệnh nhân bookmark link `/bac-si/bs-le-hoang-cuong`. Bác sĩ sau đó tắt `la_hien`. Bệnh nhân vào link cũ.

**Vấn đề:** Hiện 404 (bad UX) hay hiện profile không cho đặt?

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ 404 Not Found | Cứng nhắc | Confusing — "BS có tồn tại không?" |
| ✅ Trang hiện nhưng "Bác sĩ hiện không nhận khám" | Friendly | Clear message |
| ⚠️ Hiện bình thường nhưng ẩn slot | Inconsistent | Bệnh nhân không hiểu |

**✅ Phương án tối ưu: Graceful degradation**

```
Profile public page:
  Nếu la_hien=false hoặc trang_thai_duyet≠approved:
    → Hiện tên + ảnh + chuyên khoa
    → Badge: "Hiện không nhận khám mới"
    → Ẩn toàn bộ slot/booking widget
    → Không redirect/404 → giữ nguyên URL
```

**Lợi ích:** Bệnh nhân lưu lại để quay lại sau; không mất SEO URL.

🟡 **Ảnh hưởng spec:** Logic render public profile page khi ẩn

---

### S15: Bác sĩ tắt `la_hien` → quên bật lại → bệnh nhân cũ hỏi "sao không tìm thấy bác sĩ"

**Tình huống:** Bác sĩ tắt profile để đi nghỉ 2 tuần. Quên bật lại. 1 tháng sau vẫn ẩn.

**Vấn đề:** Bác sĩ không nhận ra, doanh thu giảm.

**✅ Phương án tối ưu: Tự động nhắc nhở**

```
Cron job chạy mỗi sáng Thứ 2:
  Nếu la_hien=false VÀ đã ẩn > 14 ngày VÀ trang_thai_duyet='approved':
    → Gửi email: "Profile của bạn đang ẩn 14 ngày. Bật lại để nhận bệnh nhân?"
    → Notification trong app
  Nhắc lại mỗi 7 ngày nếu vẫn ẩn
```

🟢 **Ảnh hưởng spec:** Nice-to-have cron notification

---

## NHÓM 5 — phi_tu_van & Dịch vụ

---

### S16: Bác sĩ hủy liên kết dịch vụ "Khám tại nhà" khi đang có 3 lịch `confirmed` loại home

**Tình huống:** Bác sĩ quyết định ngừng khám tại nhà, bỏ liên kết service `home`. Nhưng đang có 3 lịch `confirmed` loại `home` trong tuần tới.

**Vấn đề:** 3 bệnh nhân đang expect được khám tại nhà.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Cho bỏ service tự do | Flexible | 3 bệnh nhân bị hủy bất ngờ |
| ✅ Block nếu còn lịch active dùng service đó | Bảo vệ bệnh nhân | Cần query check |
| ✅ Warn + confirm — bác sĩ tự quyết | Flexible + informed | Risk cao |

**✅ Phương án tối ưu: Hard block với thông báo rõ ràng**

```
Click ✕ dịch vụ "Khám tại nhà":
  → Query: appointments WHERE service_id=X AND status IN ('pending','confirmed')
  → Nếu có (3 lịch):
      Block với thông báo:
      "Bạn đang có 3 lịch hẹn active dùng dịch vụ này.
       Hãy xử lý xong các lịch trước khi bỏ liên kết.
       [Xem lịch hẹn →]"
  → Nếu không có: cho phép bỏ liên kết
```

**Lưu ý:** Sau khi bỏ liên kết → bệnh nhân không đặt được dịch vụ này với bác sĩ, nhưng lịch cũ `completed` vẫn giữ nguyên trong hồ sơ.

🔴 **Ảnh hưởng code:** Check active appointments trước khi unlink service

---

### S17: Admin ẩn (hidden) bệnh viện mà bác sĩ đang liên kết

**Tình huống:** "BV Bạch Mai" bị Admin ẩn (`status='hidden'`). 15 bác sĩ đang liên kết với BV này.

**Vấn đề:** Profile 15 bác sĩ bị broken link. Lịch hẹn `clinic` tại BV Bạch Mai cũng affected.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Cascade ẩn → tự xóa khỏi doctors.hospitals[] | Clean | Mất data, không thể rollback |
| ✅ Giữ liên kết nhưng đánh dấu "(đang ẩn)" trên UI bác sĩ | Non-destructive | Cần UI indicator |
| ✅ Không cho tìm kiếm bệnh viện đang ẩn nhưng giữ liên kết cũ | Balanced | Phức tạp |

**✅ Phương án tối ưu: Soft impact — giữ data, hiện trạng thái**

```
doctors.hospitals[] vẫn giữ ObjectId của BV đã hidden
UI profile bác sĩ:
  [BV Bạch Mai] (⚠️ Đang tạm ẩn) [✕]
  → Bác sĩ tự quyết có xóa liên kết không

Trang tìm kiếm bệnh nhân:
  → Không hiện BV Bạch Mai trong filter bệnh viện
  → Bác sĩ liên kết với BV đang ẩn vẫn hiện ở tìm kiếm (theo chuyên khoa)
  → Khi đặt lịch clinic: danh sách bệnh viện không bao gồm BV đã ẩn
```

**Admin alert khi ẩn BV:** "15 bác sĩ đang liên kết với BV này. Cần thông báo thủ công."

🟡 **Ảnh hưởng spec:** Logic hiển thị hospitals với trạng thái; alert Admin khi ẩn BV

---

### S18: Bác sĩ đăng ký service "Khám tại nhà" nhưng `khu_vuc` không bao phủ địa chỉ bệnh nhân

**Tình huống:** Service "Khám tại nhà" có `khu_vuc = ["Cầu Giấy", "Thanh Xuân"]`. Bệnh nhân ở Đống Đa vẫn thấy và đặt được.

**Vấn đề:** Bác sĩ từ chối với lý do "ngoài vùng" → bệnh nhân tức giận vì không có cảnh báo.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Không validate khu_vuc khi đặt | Đơn giản | Trải nghiệm tệ |
| ✅ Validate địa chỉ bệnh nhân vs khu_vuc trước khi cho đặt | Chính xác | Cần logic geo |
| ✅ Hiển thị khu_vuc rõ ràng trên trang bác sĩ + form đặt lịch | Transparent | Đơn giản hơn |

**✅ Phương án tối ưu: Hiển thị khu_vuc + soft check**

```
Trang profile bác sĩ (public):
  Dịch vụ: Khám tại nhà
  Khu vực phục vụ: Cầu Giấy, Thanh Xuân, Nam Từ Liêm

Form đặt lịch (step nhập địa chỉ):
  Bệnh nhân chọn quận → hiện warning nếu không match:
  "⚠️ Quận Đống Đa chưa trong vùng phục vụ của bác sĩ.
   Bạn vẫn có thể đặt — bác sĩ sẽ xác nhận khả năng đến."
  → Không HARD BLOCK, chỉ warn (vì bác sĩ có thể linh hoạt)
```

**Lý do không hard block:** Khu_vuc là thông tin tham khảo, bác sĩ có thể mở rộng linh hoạt. Hard block dẫn đến mất lịch hẹn tiềm năng.

🟡 **Ảnh hưởng spec:** Hiện khu_vuc rõ trên UI; soft warn khi đặt lịch home ngoài khu_vuc

---

## NHÓM 6 — Upload Ảnh & Tài liệu

---

### S19: Bác sĩ upload ảnh chân dung nhưng ảnh chứa thông tin nhạy cảm (chứng minh thư)

**Tình huống:** Bác sĩ nhầm upload ảnh CMND thay vì ảnh chân dung.

**Vấn đề:** Thông tin cá nhân nhạy cảm lưu trên cloud storage public URL.

**✅ Phương án tối ưu: 2 loại lưu trữ khác nhau**

```
anh_dai_dien (ảnh avatar):
  → Public cloud storage (CDN)
  → Hiện trực tiếp cho bệnh nhân
  → Validate: phải là ảnh người (face detection - optional)
  → Validate: kích thước tối thiểu 200x200

tai_lieu[] (chứng chỉ, bằng cấp):
  → Private cloud storage (không public URL)
  → Chỉ Admin xem được (signed URL expire 1h)
  → Bác sĩ xem được file của mình
  → KHÔNG expose cho bệnh nhân
```

**Quy tắc:** 2 upload endpoint khác nhau với access control khác nhau.

🔴 **Ảnh hưởng code:** Cần private storage config + signed URL generation

---

### S20: Bác sĩ upload ảnh .jpg nhưng thực ra là file .exe đổi tên

**Tình huống:** Kẻ tấn công tạo tài khoản bác sĩ, upload file độc hại.

**Vấn đề:** Server-side file validation chỉ check extension → bị bypass.

**✅ Phương án tối ưu: Multi-layer validation**

```
Layer 1 (FE): Check extension + file size trước khi upload
Layer 2 (BE): Check MIME type bằng magic bytes (không tin extension)
Layer 3 (BE): Max file size enforce ở server
Layer 4 (Storage): Virus scan nếu có budget (ClamAV hoặc cloud service)
```

**Code BE:**
```js
import { fileTypeFromBuffer } from 'file-type'

const buffer = req.file.buffer
const type = await fileTypeFromBuffer(buffer)
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
if (!type || !ALLOWED.includes(type.mime)) {
  return res.status(400).json({ success: false, message: 'Định dạng file không được phép' })
}
```

🔴 **Ảnh hưởng code:** BE upload middleware cần magic bytes check

---

### S21: Bác sĩ upload ảnh mặt nghiêng/ảnh nhóm → không rõ ai là bác sĩ

**Tình huống:** Ảnh đại diện chất lượng kém → bệnh nhân không nhận ra bác sĩ khi gặp trực tiếp.

**Vấn đề:** UX tệ, có thể gây mất tin tưởng.

**Phân tích:** Không thể force bác sĩ upload ảnh "đúng chuẩn" mà không có AI/manual review.

**✅ Phương án tối ưu: Guidelines + soft validation**

```
Trang upload ảnh:
  - Hiện template "ảnh chuẩn": mặt thẳng, nền trắng/trung tính, rõ mặt
  - Crop tool: bắt buộc crop 1:1 trước khi lưu
  - Minimum resolution: 300x300px
  - Nếu Admin phát hiện ảnh không phù hợp → có thể remove ảnh từ admin panel
```

🟢 **Ảnh hưởng spec:** UX guideline trong upload dialog

---

## NHÓM 7 — diem_danh_gia & Reviews

---

### S22: Admin ẩn 50 review của bác sĩ → diem_danh_gia thay đổi đột ngột

**Tình huống:** Bác sĩ có 124 review, diem=4.8. Admin ẩn 50 review vi phạm. diem thay đổi.

**Vấn đề:** Bác sĩ không được thông báo, thấy điểm thay đổi không rõ lý do.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Không thông báo | Simple | Bác sĩ confused |
| ✅ Notification: "Admin đã ẩn X đánh giá, điểm của bạn cập nhật thành Y" | Transparent | Hơi nhiều notification |
| ⚠️ Chỉ thông báo nếu thay đổi > 0.5 sao | Filtered | Có thể bỏ sót |

**✅ Phương án tối ưu: Thông báo luôn khi điểm thay đổi đáng kể**

```
Ngưỡng trigger notification:
  Thay đổi > 0.2 điểm (do Admin ẩn/hiện review)
  → Notification: "Điểm đánh giá của bạn: 4.8 → 4.3 (50 đánh giá bị ẩn)"

Không thông báo:
  Thay đổi ≤ 0.2 (thêm review mới, tự nhiên)
```

**Nội dung notification bác sĩ KHÔNG thấy:** Tên bệnh nhân có review bị ẩn (privacy).

🟡 **Ảnh hưởng spec:** Notification trigger trong Admin C6 khi ẩn review hàng loạt

---

### S23: Bác sĩ mới được duyệt — diem_danh_gia = 0, so_danh_gia = 0 → bệnh nhân e ngại

**Tình huống:** Bệnh nhân thấy "0.0 ⭐ (0 đánh giá)" → cảm giác bác sĩ kém/mới.

**Vấn đề:** UX prejudice cho bác sĩ mới.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Hiện 0.0 sao | Honest | Không công bằng cho bác sĩ mới |
| ✅ Không hiện sao nếu so_danh_gia = 0 | Clean | Không misleading |
| ⚠️ Hiện badge "Bác sĩ mới" thay thế | Friendly | Có thể không tốt |

**✅ Phương án tối ưu: Conditional display**

```
so_danh_gia = 0:
  → Không hiện sao rating
  → Không hiện diem_danh_gia
  → Hiện: "Chưa có đánh giá" (text nhỏ, không nổi bật)

so_danh_gia 1-4:
  → Hiện sao + điểm + "(X đánh giá)"
  → Badge "Bác sĩ mới" nhỏ (optional)

so_danh_gia >= 5:
  → Hiện đầy đủ bình thường
```

🟡 **Ảnh hưởng spec:** Conditional render logic cho rating display

---

## NHÓM 8 — Security & Data Integrity

---

### S24: Bác sĩ A gửi PATCH request với `doctor_id` của bác sĩ B (IDOR attack)

**Tình huống:** Bác sĩ A biết ID của bác sĩ B, thay vào URL và gửi PATCH.

**Vấn đề:** Bác sĩ A sửa được profile của bác sĩ B.

**✅ Phương án tối ưu: Luôn extract từ JWT, không từ request**

```js
// ❌ SAI
router.patch('/profile/:doctorId', async (req, res) => {
  await Doctor.updateOne({ _id: req.params.doctorId }, req.body)
})

// ✅ ĐÚNG
router.patch('/profile', verifyToken, async (req, res) => {
  // doctor_id lấy từ JWT, không từ URL/body
  const doctor = await Doctor.findOne({ user_id: req.user.id })
  if (!doctor) return res.status(404).json(...)
  await Doctor.updateOne({ _id: doctor._id }, req.body)
})
```

**Thêm:** Rate limiting cho upload endpoint (max 5 upload/phút/user).

🔴 **Ảnh hưởng code:** Kiểm tra lại tất cả doctor routes — không dùng `:doctorId` từ URL

---

### S25: Admin bị xóa tài khoản (edge case) → các log audit liên quan còn không?

**Tình huống:** Một Admin rời dự án, tài khoản bị xóa. Các action "duyệt hồ sơ bác sĩ X" của admin đó còn trong audit_log.

**Vấn đề:** `audit_logs.actor_id` bị broken reference.

**✅ Phương án tối ưu: Snapshot tên Admin trong audit log**

```js
// audit_logs
{
  actor_id: ObjectId | null,   // nullable nếu user bị xóa
  actor_name: String,          // snapshot tên lúc thực hiện action
  action: 'approve_doctor',
  target_id: ObjectId,
  ...
}
```

Khi hiển thị log: dùng `actor_name` (không join với users). Nếu `actor_id` null → vẫn hiện tên.

🟡 **Ảnh hưởng spec:** Thêm `actor_name` snapshot vào audit_logs schema

---

### S26: Bác sĩ thay đổi `chuyen_khoa` sau khi đã có reviews liên quan chuyên khoa cũ

**Tình huống:** Bác sĩ ban đầu là "Tim mạch", có 50 review. Sau đó đổi sang "Thần kinh". Bệnh nhân tìm kiếm "Bác sĩ Tim mạch" không thấy nữa.

**Vấn đề:** Reviews cũ liên quan chuyên khoa cũ nhưng profile hiện chuyên khoa mới.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Cho đổi tự do | Flexible | Mất context reviews cũ |
| ✅ Đổi OK nhưng reviews giữ nguyên (không có field chuyên khoa trong review) | Simple | Reviews không mention chuyên khoa |
| ⚠️ Chặn đổi chuyên khoa nếu có reviews | Strict | Không flexible |

**✅ Phương án tối ưu: Cho phép đổi — reviews không cần biết chuyên khoa**

Phân tích `reviews` schema: reviews chỉ lưu `doctor_id`, không lưu `chuyen_khoa`. Nên việc đổi chuyên khoa không ảnh hưởng đến reviews cũ.

**Tuy nhiên cần:** Khi bác sĩ đổi chuyên khoa → có thể cần duyệt lại (vì chuyên khoa mới có thể yêu cầu chứng chỉ khác).

```
Bác sĩ đổi chuyen_khoa:
  → Save ngay (không cần duyệt lại — chỉ thông tin profile)
  → Nhưng nếu "đổi chuyên khoa chính" (lần đầu) → notification Admin: "BS. X vừa đổi chuyên khoa"
```

🟢 **Ảnh hưởng spec:** Notification Admin khi đổi chuyên khoa (audit trail)

---

## NHÓM 9 — Notification & Email Flow

---

### S27: Email duyệt hồ sơ gửi thất bại (SMTP lỗi) — bác sĩ không biết được duyệt

**Tình huống:** Admin duyệt thành công trong DB nhưng Nodemailer timeout. Bác sĩ chờ email mãi không thấy.

**Vấn đề:** Bác sĩ không biết đã được duyệt → không hoạt động.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Email fail → rollback approve | Data-safe | Bác sĩ bị delay vô lý |
| ✅ Email là best-effort — approve trước, email sau | User-first | Email có thể không gửi được |
| ✅ Retry queue cho email | Reliable | Phức tạp hơn |

**✅ Phương án tối ưu: In-app notification là guaranteed; email là best-effort với retry**

```
Luồng approve:
1. DB update: trang_thai_duyet='approved', users.role='doctor' (transaction)
2. In-app notification: immediate, reliable
3. Email: async job, retry 3 lần (0s, 5min, 1h)
   → Nếu vẫn fail sau 3 lần: log error, admin alert

Bác sĩ khi login lần đầu sau approved:
  → Banner xanh: "🎉 Chúc mừng! Hồ sơ của bạn đã được duyệt"
  → Không phụ thuộc vào email
```

🟡 **Ảnh hưởng spec:** Email là async best-effort; in-app notification là primary

---

### S28: Bác sĩ submit hồ sơ lúc 23:55 → Admin đang ngủ → 8 giờ sáng mới duyệt

**Tình huống:** Bác sĩ chờ từ 23:55 đến 8:00 sáng. Không biết trạng thái ra sao.

**Vấn đề:** Bác sĩ không biết expected wait time.

**✅ Phương án tối ưu: Set expectation rõ ràng**

```
Sau khi submit:
  Toast/Banner: "Hồ sơ đã được gửi thành công ✓
                 Thời gian xét duyệt thông thường: 1-2 ngày làm việc
                 Bạn sẽ nhận thông báo qua email và ứng dụng"

Banner trạng thái pending (update thêm):
  "Hồ sơ đang chờ xét duyệt. Thời gian xử lý: 1-2 ngày làm việc.
   Nộp lúc: [ngày giờ nộp]"
```

**SLA cho Admin (internal):** Trong Admin panel, hồ sơ `pending > 48h` có badge "Quá hạn" đỏ để nhắc nhở.

🟡 **Ảnh hưởng spec:** UX copy sau submit; SLA indicator trong Admin C2

---

## NHÓM 10 — Completeness & UX

---

### S29: Bác sĩ điền profile không đầy đủ → bệnh nhân vào trang xem thấy thiếu thông tin

**Tình huống:** Bác sĩ chỉ có `bang_cap` + `chuyen_khoa` (minimum để submit). `tieu_su` = null, `anh_dai_dien` = null, `hospitals[]` = [], `kinh_nghiem` = null.

**Vấn đề:** Profile trống ngoài trang tìm kiếm → bệnh nhân không đặt lịch vì thiếu tin tưởng.

**✅ Phương án tối ưu: Progressive completion với reminder**

**Completeness Score calculation:**
```
Tổng = 100%

anh_dai_dien có ảnh:           20%  (quan trọng nhất — first impression)
tieu_su ≥ 100 ký tự:           20%  (quan trọng — bệnh nhân đọc)
kinh_nghiem ≥ 50 ký tự:        15%
so_dien_thoai có số:            15%
hospitals[] ≥ 1 bệnh viện:     15%
services[] ≥ 1 dịch vụ:        15%
```

**UI profile bác sĩ (internal):**
```
Hoàn thiện hồ sơ: ████████░░ 70%
Thêm tiểu sử để bệnh nhân tin tưởng hơn →
```

**Auto-reminder email:**
```
Sau 3 ngày approved mà completeness < 60%:
  "Hồ sơ của bạn còn thiếu [X, Y, Z]. Bổ sung ngay để tăng lượng bệnh nhân đặt lịch."
Sau 7 ngày nếu vẫn < 60%: nhắc lần 2
Sau 14 ngày: dừng nhắc
```

🟢 **Ảnh hưởng spec:** Completeness score logic; email reminder schedule

---

### S30: Bác sĩ có 2 chuyên khoa (Tim mạch + Nội tổng quát) nhưng schema chỉ có 1 `chuyen_khoa`

**Tình huống:** Bác sĩ thực tế có thể hành nghề nhiều chuyên khoa. Database có `specialties[]` (mảng) nhưng DoctorProfile type chỉ có 1 `chuyen_khoa` field.

**Vấn đề:** Mismatch giữa DB schema và type definition.

**Phân tích:**
DB: `doctors.specialties: [ObjectId]` — hỗ trợ nhiều chuyên khoa
Type: `DoctorProfile.chuyen_khoa: string` — chỉ 1

**✅ Phương án tối ưu: Hỗ trợ đa chuyên khoa nhưng có primary**

```ts
interface DoctorProfile {
  // Primary specialty (hiển thị chính, dùng trong tìm kiếm cơ bản)
  chuyen_khoa: string         // tên specialty chính (để display)
  chuyen_khoa_id: number      // ObjectId specialty chính

  // Additional specialties (optional)
  chuyen_khoa_phu?: {
    id: number
    ten: string
  }[]
}
```

**UI:**
- Dropdown chọn chuyên khoa chính (bắt buộc)
- Multi-select chuyên khoa phụ (optional, tối đa 3)
- Tìm kiếm: match với chuyên khoa chính VÀ phụ

🟡 **Ảnh hưởng spec:** Cập nhật type để hỗ trợ array; UI multi-select chuyên khoa

---

### S31: Bác sĩ đổi họ tên (sau khi kết hôn) — reviews cũ hiện tên gì?

**Tình huống:** BS. Nguyễn Thị Mai sau kết hôn đổi thành Trần Thị Mai. Update `ho_ten`. Reviews cũ của bệnh nhân ghi "rất hài lòng với BS. Mai" vẫn hiện đúng không?

**Phân tích:** `reviews` chỉ lưu `doctor_id` và `user_id`, không lưu `ho_ten` của bác sĩ. Khi join để hiển thị → lấy `ho_ten` từ `users` hiện tại → **tự động hiển thị tên mới**.

**✅ Phương án:** Không có vấn đề — reviews luôn hiện tên mới nhất. Đây là behavior mong muốn.

**Tuy nhiên:** Trên trang bệnh nhân xem lịch sử khám — hiện "BS. Trần Thị Mai" dù đặt lịch khi là "Nguyễn Thị Mai". Về mặt pháp lý điều này acceptable trong context app này.

🟢 **Không cần thay đổi**

---

### S32: Bác sĩ xem được thống kê chi tiết — có biết được bệnh nhân nào review?

**Tình huống:** Bác sĩ thấy review 2 sao, muốn biết ai viết để "trả thù".

**Vấn đề:** Privacy của bệnh nhân.

**Phân tích:**
| Phương án | Ưu | Nhược |
|---|---|---|
| ❌ Hiện tên bệnh nhân + số điện thoại | Transparency | Privacy violation |
| ✅ Ẩn danh tối đa: "Bệnh nhân ẩn danh" | Privacy | Bác sĩ không thể liên hệ |
| ✅ Partial info: "N.V.A — Khám ngày DD/MM" | Balance | Đủ identify nhưng không đủ để liên hệ |

**✅ Phương án tối ưu: Partial anonymization**

```
Trang thống kê bác sĩ (B5):
  Review hiển thị:
    - Tên viết tắt: "Nguyễn V. A." (không full name)
    - Ngày khám: "17/06/2026"
    - Loại khám: "Phòng khám"
    - Điểm: ⭐⭐⭐⭐
    - Nội dung: full text

  KHÔNG hiện:
    - Số điện thoại
    - Email
    - Địa chỉ
    - Tên đầy đủ
```

🟡 **Ảnh hưởng spec:** Anonymization rule cho review display

---

### S33: Session timeout khi đang điền form profile dài

**Tình huống:** JWT expire sau 7 ngày. Bác sĩ điền form rất lâu (30 phút). Submit → 401.

**Vấn đề:** Mất hết data đã điền.

**✅ Phương án tối ưu: Auto-save + token refresh**

```
Auto-save draft (localStorage):
  → Mỗi 30 giây, save form state vào localStorage
  → Key: `doctor_profile_draft_${userId}`
  → Khi load trang: nếu có draft → hiện "Bạn có bản nháp chưa lưu. Khôi phục?"

Token refresh:
  → Trước khi submit, check token exp
  → Nếu expire < 30 phút: silent refresh
  → Nếu expire: redirect login với return URL /doctor/profile + restore draft từ localStorage
```

🟡 **Ảnh hưởng spec:** Auto-save mechanism + token refresh logic

---

### S34: Admin C2 nhận nhiều hồ sơ cùng lúc — cần ưu tiên duyệt hồ sơ nào trước?

**Tình huống:** 20 hồ sơ đang `pending`. Admin không biết ưu tiên cái nào.

**Vấn đề:** Hồ sơ nộp sớm nhất nên được duyệt trước (FIFO) nhưng có thể cần ưu tiên hơn.

**✅ Phương án tối ưu: Sort + priority indicator**

```
Admin C2 danh sách pending:
  Default sort: ngay_nop ASC (nộp sớm nhất trước — FIFO)
  
  Priority badges:
    🔴 "Quá 48h" — nộp hơn 2 ngày chưa duyệt (SLA breach)
    🟡 "Nộp lại" — đây là lần nộp lại (bác sĩ đang chờ lâu)
    ⚪ Bình thường

  Filter: "Chỉ hiện quá hạn" / "Chỉ hiện nộp lại lần X"
```

🟡 **Ảnh hưởng spec:** Admin C2 UX — priority sorting

---

### S35: Bác sĩ xem profile của mình từ góc nhìn bệnh nhân — để kiểm tra trước

**Tình huống:** Bác sĩ muốn biết bệnh nhân thấy profile mình như thế nào trước khi bật `la_hien=true`.

**Vấn đề:** Không có "Preview as patient" button.

**✅ Phương án tối ưu: Preview mode**

```
Trong `/doctor/profile`:
  Nút: [👁 Xem như bệnh nhân]
  → Mở tab mới với `/bac-si/{slug}?preview=true`
  → Token-based: chỉ bác sĩ của profile đó mới xem được khi profile đang ẩn
  → Hiện banner vàng: "Chế độ xem trước — Bệnh nhân chưa thấy profile này"
```

🟢 **Ảnh hưởng spec:** Nice-to-have preview endpoint

---

## Tổng kết Quyết định Nghiệp vụ

> Bảng này là nguồn sự thật cuối cùng — ưu tiên cao nhất cần implement trước khi gắn DB.

### Bảng A — Quyết định ngay (🔴 Phải làm)

| # | Quyết định | Lý do | Thay đổi spec |
|---|---|---|---|
| D01 | Validate required fields FE + BE trước khi submit (S01) | Bảo vệ so_lan_nop | Thêm bước validate |
| D02 | Disable button submit sau click + idempotency BE (S05) | Tránh double submit | Guard ở BE |
| D03 | MongoDB transaction khi approve (users.role + doctors.trang_thai_duyet) (S04) | Atomicity | Critical |
| D04 | IDOR protection: doctor_id từ JWT, không từ request (S24) | Security | Mọi route |
| D05 | Backend MIME type check bằng magic bytes cho file upload (S20) | Security | Upload endpoint |
| D06 | Block unlink service nếu còn lịch active (S16) | Data integrity | Service unlink |
| D07 | Form readonly hoàn toàn khi suspended (hiện bug trong code) | Nghiệp vụ | `DoctorProfile.tsx` |
| D08 | chuyen_khoa là ObjectId từ specialties (không free text) | Data consistency | Type + UI |

### Bảng B — Quyết định quan trọng (🟡 Nên làm trước gắn DB)

| # | Quyết định | Lý do |
|---|---|---|
| D09 | Cho phép "Rút lại hồ sơ" khi đang `pending` (S02) | UX + bảo vệ so_lan_nop |
| D10 | Structured rejection reason từ Admin (S12) | Chất lượng từ chối |
| D11 | Confirmation dialog lần nộp thứ 4 với checklist (S11) | UX friction đúng lúc |
| D12 | Admin dialog khi suspend có lịch hẹn active (S08) | Bảo vệ bệnh nhân |
| D13 | Dialog la_hien khi Admin unsuspend (S09) | Explicit control |
| D14 | Graceful degradation public profile khi ẩn (S14) | SEO + UX |
| D15 | Partial anonymization tên bệnh nhân trong review (S32) | Privacy |
| D16 | In-app notification là primary; email là best-effort async (S27) | Reliability |
| D17 | Upload `tai_lieu[]` riêng — private storage (S10, S19) | Privacy + Admin verify |
| D18 | Badge bác sĩ "Tạm không nhận khám" khi không có slot (S07) | UX clarity |
| D19 | Soft warn khi đặt lịch home ngoài khu_vuc (S18) | UX |
| D20 | Hỗ trợ `chuyen_khoa_phu[]` array (S30) | Schema alignment |

### Bảng C — Nice-to-have (🟢 Sprint sau)

| # | Quyết định |
|---|---|
| D21 | Auto-save draft vào localStorage + token refresh (S33) |
| D22 | Preview profile "như bệnh nhân" (S35) |
| D23 | Completeness score + weekly reminder email (S29) |
| D24 | Admin SLA badge "Quá 48h" (S34) |
| D25 | Notification khi diem_danh_gia thay đổi > 0.2 (S22) |
| D26 | Weekly reminder nếu la_hien=false > 14 ngày (S15) |
| D27 | Admin có thể reset so_lan_nop + link support trong banner (S03) |
| D28 | `tu_rut_lai` field để phân biệt bác sĩ rút vs Admin từ chối (S02) |

---

## Cập nhật State Machine (Final Version)

```
[Đăng ký lần đầu]
        │
        ▼
    PENDING ─────────── Admin từ chối (structured reason) ─────────────┐
        │                  → so_lan_nop tăng 1                          │
        │                  → email kèm danh sách lý do                   │
        ├── Bác sĩ tự rút ─── (tu_rut_lai=true, so_lan_nop không đổi) ─┤
        │                                                                 ▼
   Admin duyệt                                           REJECTED
   (transaction)                                              │
        │                    so_lan_nop < 5: Bác sĩ nộp lại ─┘
        │                    (validation FE + confirmation dialog lần 4)
        ▼
    APPROVED ─────────────────────────────── Admin suspend ────► SUSPENDED
        │     la_hien: true/false (toggle)          │           (la_hien=false tự động)
        │     phi_tu_van: thay đổi tự do             │
        │     hospitals[]/services[]: chọn/bỏ        │      Admin unsuspend
        │                                             │      (dialog: bật la_hien?)
        └─────────────────────────────────────────────┘
                    ▲
                    │
              (quay về approved)
```

**Trạng thái cuối:** Không có — bác sĩ có thể bị suspend/unsuspend nhiều lần.

---

## Bổ sung Data Model

### Thêm vào `doctors` collection

```js
{
  // Trường mới cần thêm:
  tu_rut_lai: Boolean,     // default: false — bác sĩ tự rút hồ sơ (không tính so_lan_nop)

  tai_lieu: [{             // Chứng chỉ, bằng cấp đính kèm
    ten: String,
    loai: 'bang_cap' | 'chung_chi' | 'chung_minh' | 'khac',
    url: String,           // Private cloud URL
    ngay_upload: Date,
  }],

  chuyen_khoa_phu: [{ type: ObjectId, ref: 'Specialty' }],  // Chuyên khoa phụ

  completeness_score: Number,  // 0-100, tính lại mỗi khi update profile

  la_hien_tu_ngay: Date | null,  // Ngày bắt đầu ẩn (để tính cron 14 ngày)
}
```

### Thêm vào `audit_logs`

```js
{
  actor_name: String,  // Snapshot tên Actor tại thời điểm action (không bị null nếu user bị xóa)
}
```
