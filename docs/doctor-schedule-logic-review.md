# Kiểm tra logic chức năng Lịch làm việc bác sĩ (Prompt 5 — Review, KHÔNG sửa code)

> Ngày: **2026-07-14**. Chế độ: **CHỈ ĐỌC / phân tích**. Không sửa FE/BE/API/model, không seed,
> không migration, không fake dữ liệu.
> Nguồn: đọc trực tiếp source (frontend + backend + model) + tài liệu audit trước
> (`doctor-schedule-analysis-report.md`, `doctor-schedule-database-gap-analysis.md`,
> `doctor-schedule-implementation-plan.md`, `doctor-schedule-final-acceptance-report.md` — cả 4 **đều tồn tại**).
> Xem chi tiết đồng bộ với Xin nghỉ ở `doctor-schedule-leave-sync-review.md`; kế hoạch dọn ở
> `doctor-schedule-simplification-plan.md`.

## 0. Ghi chú về dữ liệu (trung thực)

- **Không kết nối trực tiếp MongoDB Cloud trong phiên này.** Các số liệu dữ liệu thật được trích từ
  audit trước (2026-07-13): 133 document `lich_lam_viec`, 21 cặp trùng ngày (GAP-8), y tá/phòng thật
  của bác sĩ Khang. Những kết luận về **hành vi runtime** (vd "duyệt nghỉ rồi bệnh nhân vẫn đặt được")
  được suy ra **từ đọc code luồng**, đánh dấu **[cần kiểm chứng động]** khi chưa chạy lại trên dữ liệu thật.
- Không mục nào dưới đây dùng mock/hardcode để "tạo cảm giác hoàn thiện".

---

## 1. Luồng hiện tại (thực tế trong code)

### 1.1 Nguồn dữ liệu
| Collection | Vai trò | Liên kết |
|---|---|---|
| `lich_lam_viec` (`LichLamViec`) | Trạng thái vận hành ca: `slots[].status`, `trang_thai_ngay`, y tá, phòng | 1 doc = 1 bác sĩ × 1 ngày |
| `nghi_phep_bac_si` (`NghiPhepBacSi`) | Quy trình xét duyệt đơn nghỉ | `bac_si_id` + `tu_ngay/den_ngay` + `gio_*`. **KHÔNG có `schedule_id`/`slot_id`** |
| `lich_hen` (`LichHen`) | Lịch hẹn bệnh nhân | `schedule_id` + `slot_id` (liên kết thật) |

> **Điểm mấu chốt:** Lịch làm việc và Đơn nghỉ là **hai nguồn độc lập**, chỉ khớp nhau theo
> **(bác sĩ + ngày + khung giờ)**, không có khóa ngoại. Đồng bộ trạng thái được thực hiện **ở frontend**,
> không ở backend.

### 1.2 Đường đi dữ liệu trang Lịch làm việc (`/doctor/schedule`)
```
DoctorSchedule.tsx
 ├─ scheduleService.getAll({from,to})  → GET /api/doctor/schedule  → flattenSchedules (slot phẳng)
 └─ doctorLeaveService.list()          → GET /api/doctor/leaves    → danh sách đơn nghỉ thật
        ↓ đối chiếu tại FE
   findCoveringLeave(slot, leaves)  (utils/scheduleWeek.ts) — CHỈ với slot.status === 'active'
        ↓
   Ẩn nút "Gửi yêu cầu nghỉ" + hiện nhãn trạng thái đơn (Chờ duyệt / Đã duyệt)
```

### 1.3 API bác sĩ (routes/doctor/schedule.routes.js + leaves)
| Method | Endpoint | Controller | Ghi |
|---|---|---|---|
| GET | `/doctor/schedule?from&to` | `getSchedules` | Trải slot phẳng, gắn y tá/phòng/trạng thái ngày |
| GET | `/doctor/schedule/:scheduleId` | `getScheduleDetail` | Chi tiết ca + lịch hẹn (join `schedule_id`) + thống kê |
| POST | `/doctor/schedule/:sid/slots/:slotId/request-cancel` | `requestCancelSlot` | Chỉ đặt cờ `cancel_requested`, KHÔNG đổi status |
| GET | `/doctor/leaves` | `listMyLeaveRequests` | Đơn nghỉ của chính bác sĩ |
| POST | `/doctor/leaves` | `createLeaveRequest` | Luôn tạo `cho_duyet`; chống trùng ở **mức NGÀY** |
| PATCH | `/doctor/leaves/:id/cancel` | `cancelLeaveRequest` | Chỉ khi `cho_duyet`; KHÔNG đụng `LichLamViec`/`LichHen` |

---

## 2. Danh sách chức năng thực tế trên trang Lịch làm việc

| Chức năng | Mục đích | Hoạt động? | Đúng quyền BS? | Cần thiết? | Gây rối? | Kết luận |
|---|---|---|---|---|---|---|
| Điều hướng Tuần trước / Hôm nay / Tuần sau | Xem lịch theo tuần T2–T7 | ✅ | ✅ | ✅ | Không | Giữ nguyên |
| Accordion mở/đóng từng ngày | Xem slot của ngày | ✅ | ✅ | ✅ | Không | Giữ nguyên |
| Badge "Hôm nay" / "Đã qua — chỉ xem" | Phân biệt mốc thời gian ngày | ✅ | ✅ | ✅ | Không | Giữ |
| Badge thời gian hôm nay (Sắp/Đang/Đã kết thúc) | `todayTimeStatus` | ✅ | ✅ | Nên có | Không | Giữ |
| Badge `trang_thai_ngay` (nghỉ/nghỉ_phép) | Trạng thái ngày | ✅ (nếu DB có set) | ✅ | ✅ | Không | Giữ — **nhưng hiếm khi được set** (xem §4) |
| DaySummary (đếm trống/đặt/nghỉ) | Tổng quan nhanh | ✅ | ✅ | ✅ | ⚠ Trùng DotBar | Gộp / đơn giản hóa |
| DotBar (chấm màu theo slot) | Trực quan trạng thái | ✅ | ✅ | Tùy | ⚠ Trùng DaySummary | Gộp / đơn giản hóa |
| Dòng y tá phụ trách | Hiển thị y tá thật (GAP-1) | ✅ | ✅ | ✅ | Không | Giữ |
| Badge cảnh báo ">N bản ghi trùng ngày" | Cảnh báo GAP-8 | ✅ | ✅ | ✅ (tạm) | Nặng nhưng cần | Giữ đến khi dọn GAP-8 |
| Nút "Chi tiết" ngày | Mở modal ca | ✅ | ✅ | ✅ | Không | Giữ |
| Danh sách slot (giờ, phòng, status, tên BN) | Xem ca trong ngày | ✅ | ✅ | ✅ | ⚠ Tên BN lộ trên overview | Giữ, cân nhắc §6 |
| Nút "Gửi yêu cầu nghỉ" / slot | Xin nghỉ theo ca | ⚠ Một phần | ✅ | ✅ | ⚠ Xung đột chống-trùng mức ngày | Xem §4, §XII |
| Nhãn "Chờ Admin duyệt/Đã duyệt nghỉ" / slot | Đồng bộ đơn nghỉ (FE) | ✅ (chỉ slot active) | ✅ | ✅ | Không | Giữ |
| Nút "Yêu cầu hủy" (slot booked) | F7 — hủy ca có BN | ✅ | ✅ | ✅ | Không | Giữ |
| Modal chi tiết ca: thống kê + danh sách lịch hẹn + nút sang "Lịch hẹn" | Xem sâu 1 ngày | ✅ | ✅ | Tùy | ⚠ Trùng trang Lịch hẹn | Xem §6 |

---

## 3. Chức năng đúng / thừa / thiếu (tóm tắt)

### 3.1 Đang ĐÚNG
- Phân quyền bác sĩ: **không** có nút tạo/sửa/xóa ca, đổi phòng/y tá, duyệt nghỉ (routes chỉ GET + request-cancel + leaves). ✅ Khớp spec "chống gian lận".
- Ownership: `findOne({_id, doctor_id})` → bác sĩ khác đổi URL nhận 404. ✅
- Chi tiết ca join lịch hẹn theo `schedule_id` thật (không suy luận theo giờ). ✅
- Xin nghỉ luôn tạo `cho_duyet`; chặn ngày quá khứ, thiếu lý do. ✅
- Yêu cầu nghỉ / yêu cầu hủy **không** tự hủy lịch hẹn bệnh nhân. ✅

### 3.2 THỪA / gây rối (chi tiết ở `doctor-schedule-simplification-plan.md`)
- DaySummary + DotBar hiển thị **cùng một thông tin** (đếm trạng thái slot) → dư thừa thị giác.
- Modal chi tiết ca liệt kê **toàn bộ lịch hẹn + trạng thái thanh toán** → **trùng vai trò trang Lịch hẹn**.
- Tên bệnh nhân hiển thị ngay trên danh sách slot của overview (thuộc phạm vi Lịch hẹn).

### 3.3 THIẾU (bắt buộc / nên có)
| Thiếu | Mức | Ảnh hưởng |
|---|---|---|
| **Backend không phản ánh đơn nghỉ đã duyệt vào khả năng đặt lịch** | **Critical** | Bệnh nhân vẫn đặt được ca bác sĩ đã duyệt nghỉ [cần kiểm chứng động] |
| **Duyệt nghỉ không tự khóa/liên kết slot** (`bi_khoa_boi_nghi_phep`/`nghi_phep_id`/`trang_thai_ngay`) | **High** | Trạng thái nghỉ chỉ "trông thấy" ở FE, DB vẫn là ca hoạt động |
| Nhãn ngày nghỉ ở **cấp ngày** trên lịch bác sĩ | Medium | Ngày duyệt nghỉ vẫn hiện như ngày làm việc bình thường (chỉ có nhãn nhỏ per-slot) |
| Hỗ trợ **nhiều đơn nghỉ theo ca trong cùng 1 ngày** | Medium | Chống-trùng mức ngày chặn đơn ca thứ 2 cùng ngày (409) |
| Biểu diễn **nghỉ một phần ca** trên lịch/đặt lịch | Medium | Nghỉ khung giờ không có tác động thực tế nếu không khóa slot |
| Cập nhật khi Admin duyệt/từ chối lúc bác sĩ đang xem | Low | Phải rời trang & quay lại mới thấy (refetch-on-mount) |

---

## 4. Logic trạng thái — ma trận thực tế

`trang_thai_ngay` ∈ {lam_viec, nghi, nghi_phep}. `slot.status` ∈ {active, pending_payment, booked, locked, cancelled, expired}.
`đơn nghỉ.trang_thai` ∈ {cho_duyet, da_duyet, tu_choi, da_huy}.

| Ca (slot) | Đơn nghỉ | Thời điểm | Hiển thị lịch BS | Nút được phép | Nút KHÔNG được phép |
|---|---|---|---|---|---|
| active | (không) | tương lai | "Còn trống" | Gửi yêu cầu nghỉ | Yêu cầu hủy |
| active | cho_duyet phủ slot | tương lai | Nhãn "Chờ Admin duyệt" | (chỉ xem) | Gửi yêu cầu nghỉ (đã ẩn) |
| active | da_duyet phủ slot | tương lai | Nhãn "Đã duyệt nghỉ" **nhưng status vẫn active** | (chỉ xem) | Gửi yêu cầu nghỉ |
| active | tu_choi | tương lai | Như bình thường | Gửi yêu cầu nghỉ (hiện lại) | — |
| active | da_huy | tương lai | Như bình thường | Gửi yêu cầu nghỉ (hiện lại) | — |
| booked | bất kỳ | tương lai | "Đã đặt" + tên BN | Yêu cầu hủy (nếu chưa gửi) | Gửi yêu cầu nghỉ (findCoveringLeave chỉ chạy cho active) |
| booked | cancel_requested=true | tương lai | Nhãn "Chờ Admin duyệt" | (chỉ xem) | Yêu cầu hủy lại |
| bất kỳ | bất kỳ | quá khứ | "Đã qua — chỉ xem" | (không nút) | Mọi nút hành động |
| locked | — | — | "Tạm nghỉ" | (không) | Gửi yêu cầu nghỉ |

**Vấn đề trạng thái phát hiện:**
1. **`da_duyet` không hạ status slot** → dòng "active + Đã duyệt nghỉ" là trạng thái mâu thuẫn: FE nói đã duyệt nghỉ, DB nói ca còn trống → **bệnh nhân vẫn đặt được** (§ leave-sync review).
2. **`findCoveringLeave` chỉ chạy cho `slot.status === 'active'`** (DoctorSchedule.tsx:490) → đơn nghỉ phủ một slot **booked** không hiển thị nhãn nghỉ nào.
3. **Nhãn nghỉ là cấp SLOT, không cấp NGÀY** → nghỉ cả ngày đã duyệt vẫn hiện ngày đó như ngày làm việc (mỗi slot có nhãn nhỏ), không có dấu hiệu ngày-nghỉ rõ ràng trừ khi Admin set thủ công `trang_thai_ngay`.

---

## 5. Logic ngày nghỉ (giữ ca / bỏ ca) — kết luận theo màn hình

### 5.1 Trang bác sĩ — **KHÔNG bỏ ngày nghỉ** ✅ (đúng nguyên tắc XX.1–3)
- Lịch render cứng T2–T7 từ `getMondayOfWeek` (`scheduleWeek.ts`) — ngày nghỉ vẫn nằm đúng vị trí, không bị thay bằng ngày khác, không đổi thứ tự. Dòng thời gian được giữ nguyên. ✅
- **Hạn chế:** ngày nghỉ đã duyệt hiện tại **không** được đánh dấu ở cấp ngày (xem §4.3) → đúng "không xóa" nhưng **chưa đủ rõ** "đây là ngày nghỉ".

### 5.2 Trang bệnh nhân — mô hình **chọn ngày đơn**, KHÔNG cửa sổ N ngày cố định
- `getSlots(doctorId, date)` truy vấn **một ngày cụ thể** do bệnh nhân chọn (patient-booking.service.ts:92).
- Vì vậy kịch bản "6 ngày cố định → tự bù ngày làm việc tiếp theo" trong đề bài **KHÔNG áp dụng** với thiết kế hiện tại. Không có (và không cần) logic auto-fill ngày; bệnh nhân tự chọn ngày khác, ngày không khả dụng trả `[]`.
- **KHÔNG sinh ngày giả**: getSlots chỉ trả slot từ document `LichLamViec` thật. ✅

### 5.3 Loại ca nghỉ khỏi khả năng đặt — ⚠ **CHƯA đảm bảo**
- getSlots lọc `trang_thai_ngay: 'lam_viec'` + `slot.status === 'active'`. **Không** đọc `NghiPhepBacSi`, **không** đọc `bi_khoa_boi_nghi_phep`.
- → Ca nghỉ **đã duyệt** chỉ bị loại nếu Admin **tự tay** đổi `trang_thai_ngay='nghi_phep'` (chặn CẢ ngày) hoặc đổi status slot. Không có đường tự động từ duyệt nghỉ. **[cần kiểm chứng động]**
- Cờ `bi_khoa_boi_nghi_phep` **không được getSlots kiểm tra** → đặt cờ mà giữ `status='active'` vẫn cho đặt → cờ hiện **vô tác dụng** với luồng đặt lịch.

### 5.4 Nghỉ một phần ca
- Model có hỗ trợ (`gio_bat_dau/gio_ket_thuc` ở `NghiPhepBacSi`; `demLichHenAnhHuong` lọc theo giờ).
- Nhưng khi duyệt: không có cơ chế khóa **chỉ** slot thuộc khung giờ. Đòn bẩy thủ công duy nhất của Admin là `trang_thai_ngay` (cấp NGÀY) → hoặc chặn cả ngày (quá tay) hoặc phải sửa từng slot. → **Nghỉ một phần ca chưa được biểu diễn đúng tự động.**

### 5.5 Yêu cầu đang chờ duyệt
- FE: slot có đơn `cho_duyet` → ẩn nút gửi, hiện "Chờ Admin duyệt" (không coi là đã nghỉ). ✅ đúng nguyên tắc "chờ ≠ đã nghỉ".
- Backend/đặt lịch: đơn `cho_duyet` **không** ảnh hưởng khả năng đặt (getSlots không đọc đơn nghỉ) → tức dự án đang **mặc nhiên theo Chính sách A** (vẫn nhận lịch khi đang chờ) — nhưng **do thiếu logic**, không phải do quyết định có chủ đích. Cần chốt chính sách (xem leave-sync review §Chính sách).

---

## 6. Độ rối giao diện & phân bổ thông tin

**Nguyên nhân rối (thực tế, không lý thuyết):**
- Trùng thông tin đếm: **DaySummary** (chữ) và **DotBar** (chấm) cùng biểu diễn phân bố status.
- **Modal chi tiết ca** lặp lại nội dung của **trang Lịch hẹn** (danh sách BN + trạng thái khám + trạng thái thanh toán).
- Tên bệnh nhân xuất hiện trên **overview** slot (thuộc phạm vi Lịch hẹn).
- Nhiều badge cạnh nhau (thời gian, trạng thái ngày, cảnh báo trùng) không có chú thích.

**Đề xuất phân bổ:**
| Nên hiện ngay trên thẻ ca | Nên đưa vào chi tiết ca | Nên chuyển sang Lịch hẹn | Nên chuyển sang Xin nghỉ |
|---|---|---|---|
| Ngày, giờ ca, phòng, trạng thái ca, y tá, cảnh báo trùng | Thống kê, ghi chú ngày | Danh sách bệnh nhân, trạng thái khám, trạng thái thanh toán | Lịch sử/ghi chú xử lý đơn nghỉ |
| 1 chỉ báo trạng thái gộp (bỏ trùng DaySummary/DotBar) | | | |

*(Đề xuất — chưa sửa. Chi tiết ở `doctor-schedule-simplification-plan.md`.)*

---

## 7. Rủi ro & phân loại lỗi

| Mã | Mức | Nội dung | Nguồn |
|---|---|---|---|
| SYNC-01 | ~~Critical~~ ✅ **Đã sửa 2026-07-14** | Đặt lịch bệnh nhân không loại ca nghỉ đã duyệt | `getSlots`/`createBooking` nay loại slot `bi_khoa_boi_nghi_phep=true` (cả tầng liệt kê lẫn tầng ghi giao dịch) — booking.controller.js |
| SYNC-02 | ~~High~~ ✅ **Đã sửa 2026-07-14** | `approveDoctorLeave` không khóa/liên kết slot | Nay khóa slot giao khung giờ (`status='locked'`, `bi_khoa_boi_nghi_phep`, `nghi_phep_id`) hoặc `trang_thai_ngay='nghi_phep'` nếu cả ngày, trong transaction — admin/doctor-leaves.controller.js |
| SYNC-03 | Medium | `da_duyet`/`cho_duyet` chỉ đồng bộ ở FE và chỉ cho slot `active`; slot `booked` bị phủ nghỉ không có chỉ báo | DoctorSchedule.tsx:490 (chưa sửa — ngoài phạm vi "chỉ backend") |
| LEAVE-01 | ~~Medium~~ ✅ **Đã sửa 2026-07-14** | Chống-trùng đơn nghỉ ở **mức ngày** chặn nhiều đơn theo ca cùng ngày | Nay chống trùng theo **khung giờ giao nhau** — leaves.controller.js |
| TZ-01 | Medium | Trộn quy ước ngày: generator/booking/leaves dùng **UTC**, schedule.controller dùng **local (`setHours`)**; chỉ khớp nhờ `TZ=UTC` pin | schedule.controller.js:21–32 vs booking.controller.js:18–24 |
| DOC-01 | Low | Tài liệu gap-analysis mô tả `toScheduleDayUTC` nhưng bản merge từ main đổi tên thành `startOfDateUTC` (+ dùng bắt lỗi E11000 thay `$setOnInsert`) | scheduleGenerator.service.js |
| GAP-8 | High (DB) | 21 document trùng ngày cũ vẫn tồn tại; FE cảnh báo trung thực; chờ dọn Lớp D | gap-analysis §GAP-8 |
| UI-01 | Low | DaySummary/DotBar trùng; modal chi tiết trùng trang Lịch hẹn | DoctorSchedule.tsx |

---

## 8. Kết luận

- **Logic đã ổn ở tầng "trang bác sĩ tự đọc":** phân quyền đúng, ownership chặt, giữ nguyên dòng thời gian, không tự hủy lịch hẹn, hiển thị dữ liệu thật. Nghiệm thu Prompt 4 vẫn giữ giá trị **trong phạm vi trang bác sĩ**.
- ~~**Chưa ổn ở tầng ĐỒNG BỘ liên màn hình / liên collection**~~ **✅ Đã sửa 2026-07-14** (backend): duyệt nghỉ nay tác động thật lên `LichLamViec`, đặt lịch bệnh nhân loại slot bị khóa. Xem `docs/superpowers/plans/2026-07-14-doctor-leave-sync-fix.md` và `docs/doctor-schedule-leave-sync-review.md` §9. Còn lại SYNC-03 (đồng bộ hiển thị FE) chưa sửa — ngoài phạm vi "chỉ backend" đã chốt.
- **Trang không "rối" về mặt kiến trúc điều hướng** (một view accordion, không nhân đôi calendar/list), nhưng có **trùng lặp thông tin** (DaySummary/DotBar) và **trộn trách nhiệm với Lịch hẹn** (chi tiết ca) — chưa sửa, ngoài phạm vi.
- **Nâng cấp bắt buộc SYNC-01, SYNC-02: đã hoàn thành.** Còn lại là "nên có" / "phát triển sau" (SYNC-03, đơn giản hóa UI, luồng hủy-duyệt).

> **Xác nhận (cập nhật 2026-07-14):** Đã sửa backend cho SYNC-01, SYNC-02, LEAVE-01 (phạm vi đã chốt với người dùng). Chưa sửa frontend. Không đổi schema/model. Không seed, không migration, không fake dữ liệu — verify bằng 30/30 integration test PASS (25 test cũ + 5 test mới) trên MongoDB Cloud thật.
> Các mục còn lại trong tài liệu này dựa trên đọc code + audit trước; suy luận runtime CHƯA sửa vẫn giữ nhãn **[cần kiểm chứng động]** nếu có.
