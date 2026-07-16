# Phân tích toàn diện chức năng Xin nghỉ của bác sĩ

> Ngày: **2026-07-14**. Chế độ **CHỈ ĐỌC / PHÂN TÍCH** — chưa sửa bất kỳ file nào trong bước này.
> Bối cảnh quan trọng: **cùng ngày hôm nay**, 3 lỗi đồng bộ Critical/High đã được sửa ở backend
> (SYNC-01, SYNC-02, LEAVE-01 — xem `docs/superpowers/plans/2026-07-14-doctor-leave-sync-fix.md` và
> `docs/doctor-schedule-leave-sync-review.md`). Báo cáo này phân tích trạng thái **SAU** các sửa đó,
> đào sâu hơn vào chính chức năng Xin nghỉ và phát hiện thêm các khoảng trống **MỚI**, đặc biệt là
> **Admin không có giao diện nào để duyệt/từ chối đơn nghỉ** (xem Phần 1, Phần 14 NEW-01).
> Dữ liệu database dẫn chứng: đọc trực tiếp MongoDB Cloud (read-only) — chi tiết ở
> `docs/doctor-leave-database-gap-analysis.md`.

---

## PHẦN 1 — Tóm tắt chức năng Xin nghỉ hiện tại

**Trang hiện có:**
- Bác sĩ: `/doctor/leave-requests` (`frontend/src/pages/doctor/DoctorLeaveRequests.tsx`) — danh sách +
  bộ lọc (tìm kiếm, trạng thái, từ ngày, đến ngày) + modal tạo đơn + hủy đơn.
- Trang Lịch làm việc (`/doctor/schedule`, `DoctorSchedule.tsx`) có nút "Gửi yêu cầu nghỉ" gắn trực
  tiếp vào từng slot `active` — điều hướng nội tuyến (dialog trong cùng trang, không phải route riêng).
- **Admin: KHÔNG có trang nào.** Backend có đủ 4 API (`GET/POST /admin/doctor-leaves`,
  `PATCH /admin/doctor-leaves/:id/approve`, `PATCH .../reject` —
  `backend/src/controllers/admin/doctor-leaves.controller.js`) nhưng
  **`frontend/src/services/` không có file nào gọi các API này** (đã grep xác nhận —
  `doctor-leave.service.ts` chỉ có 3 hàm `list/create/cancel` gọi `/doctor/leaves`, không có
  service nào cho `/admin/doctor-leaves`). `ManageDoctorSchedules.tsx` (trang admin quản lý lịch) chỉ
  hiển thị **1 con số thống kê** "Nghỉ phép" (đếm `trang_thai_ngay==='nghi_phep'`), **không phải** màn
  duyệt đơn. Đây là khoảng trống chức năng lớn nhất phát hiện được (xem NEW-01, Phần 14).

**Trang đang hoạt động tới đâu (phía bác sĩ):**
- Tạo đơn nghỉ, xem danh sách, xem chi tiết (trong bảng, không có trang chi tiết riêng), hủy đơn khi
  `cho_duyet` — hoạt động thật trên dữ liệu thật.
- Sau khi Admin duyệt (qua API trực tiếp, vì không có UI) — **từ hôm nay** (SYNC-02), việc duyệt có tác
  dụng thật: khóa slot/ngày tương ứng trong `LichLamViec`, và bệnh nhân không đặt được ca đó
  (SYNC-01). **Trước hôm nay**, việc duyệt không có tác dụng gì lên `LichLamViec` — xác nhận bằng dữ
  liệu seed thật còn sót lại (xem `docs/doctor-leave-database-gap-analysis.md` mục B.1).

**Dữ liệu lấy từ đâu:** 100% MongoDB Cloud thật qua API — không còn file mock (`frontend/src/mock/
doctor-schedule.ts` đã bị xoá theo lịch sử git của repo). Không phát hiện chức năng nào đang dùng mock
trong phạm vi Xin nghỉ.

**Chức năng chỉ hiển thị nhưng chưa xử lý thật:**
- Cảnh báo "lịch hẹn bị ảnh hưởng" **chỉ hiện SAU khi gửi thành công** (trong thông báo toast), **không
  hiện TRƯỚC khi gửi** như yêu cầu ở Phần 11.2 (xem NEW-06).
- Không có thông báo (notification) nào được gửi thật cho Admin khi có đơn mới, hay cho bác sĩ khi đơn
  được xử lý — bác sĩ phải tự vào lại trang để biết (xem NEW-07).

---

## PHẦN 2 — Mục đích nghiệp vụ

| Đối tượng | Mục đích (đối chiếu code) |
|---|---|
| Bác sĩ | Thông báo không thể thực hiện 1 phần/toàn bộ lịch đã phân công — **không** tự sửa lịch (route `/doctor/leaves` chỉ có GET/POST/PATCH-cancel, không có route sửa `LichLamViec` — `backend/src/routes/doctor/leaves.routes.js:6-8`, và `backend/src/routes/doctor/schedule.routes.js` chỉ có GET + request-cancel). |
| Admin | Xét duyệt đơn — **về mặt backend đã sẵn sàng** (`admin/doctor-leaves.controller.js`) nhưng **chưa có công cụ giao diện** để thực hiện việc này trong thực tế (Phần 1). |
| Lịch làm việc | Nguồn sự thật cho trạng thái vận hành ca (`LichLamViec.slots[].status`, `trang_thai_ngay`) — từ hôm nay, `NghiPhepBacSi` khi `da_duyet` **ghi thật** vào đây qua `lockSlotsForLeave()` (`admin/doctor-leaves.controller.js:63-99`). |
| Lịch hẹn | Không bị đơn nghỉ tự động đụng vào — `lockSlotsForLeave` chỉ xét `slot.status==='active'`, bỏ qua `booked/pending_payment` (dòng 81: `if (!inRange || slot.status !== 'active') continue`); các lịch hẹn liên quan được **liệt kê** (không xử lý) qua `findAffectedAppointments` (dòng 103-117) trả trong field `lich_hen_can_xu_ly`. |

**Ranh giới quyền hạn** — đối chiếu route thật:
- Bác sĩ **không thể** tự duyệt: route `/doctor/leaves` không có endpoint approve/reject; endpoint đó
  chỉ tồn tại ở `/admin/doctor-leaves/:id/approve|reject`, được bảo vệ bởi
  `router.use(verifyToken, requireRole('admin'))` (`backend/src/routes/admin/doctor-leaves.routes.js:8`).
- Bác sĩ **không thể** xem đơn của bác sĩ khác: `listMyLeaveRequests` luôn filter
  `bac_si_id: docId` với `docId` lấy từ `BacSi.findOne({user_id: req.user.id})`
  (`doctor/leaves.controller.js:12-15,57`) — **không tin `bac_si_id` từ client** cho luồng bác sĩ.
- Admin **có thể** truyền `bac_si_id` tùy ý khi tạo hộ đơn (`createDoctorLeave`,
  `admin/doctor-leaves.controller.js:119-142`) — đúng vì đây là chức năng thay mặt, có `ensureDoctorExists`
  kiểm tra bác sĩ tồn tại thật trước khi tạo (dòng 127, gọi `ensureDoctorExists`).

---

## PHẦN 3 — Danh sách chức năng

| Chức năng | Hiện trạng | Đúng nghiệp vụ | Thiếu gì | Rủi ro |
|---|---|---|---|---|
| Danh sách đơn nghỉ (bác sĩ) | Hoạt động thật, có filter (search/status/from/to) client-side | Đúng | Không phân trang (dữ liệu ít nên chưa cần); không hiển thị "số lịch hẹn bị ảnh hưởng" trong bảng (chỉ có ở response tạo mới) | Low |
| Tạo đơn nghỉ (form riêng) | Hoạt động thật, validate lý do bắt buộc, chặn ngày quá khứ | **Một phần** — không ràng buộc giờ theo slot thật khi chọn "Khung giờ cụ thể" | Không kiểm tra giờ nhập có thuộc slot thật của bác sĩ; không cảnh báo trước khi gửi | **Medium (NEW-03, NEW-06)** |
| Gửi yêu cầu nghỉ từ Lịch làm việc | Hoạt động thật, tự điền đúng slot | Đúng, ràng buộc chặt hơn form riêng | Không cảnh báo số lịch hẹn ảnh hưởng TRƯỚC khi gửi | Medium (NEW-06) |
| Hủy đơn nghỉ | Hoạt động thật, chỉ khi `cho_duyet` (409 nếu không) | Đúng | — | — |
| Xem chi tiết đơn | **Không có trang/modal chi tiết riêng** — chỉ xem trong dòng bảng | Thiếu so với yêu cầu Phần 6.3 | Không xem được "kết quả đồng bộ sang lịch làm việc", "lịch sử thay đổi trạng thái" | Low (thông tin vẫn có ở API, chỉ chưa hiển thị) |
| Admin duyệt/từ chối | **API có, UI không có** | **Không đạt** | Toàn bộ giao diện Admin | **High (NEW-01)** |
| Khóa slot/ngày khi duyệt | Hoạt động thật (từ hôm nay) | Đúng | Admin API không biết đơn là cả ngày hay theo ca khi duyệt (thiếu field) | High (NEW-02) |
| Liệt kê lịch hẹn bị ảnh hưởng khi duyệt | Hoạt động thật (`lich_hen_can_xu_ly`) | Đúng, nhưng chưa có nơi hiển thị (không có Admin UI) | UI hiển thị + luồng Admin xử lý tiếp | High (phụ thuộc NEW-01) |
| Chống trùng/chồng lấn | Hoạt động thật, theo khung giờ giao nhau (sửa hôm nay) | Đúng | Race condition giữa 2 request đồng thời (không có unique index) | Low (NEW-11) |
| Thông báo (notification) | **Không có** | Thiếu | Toàn bộ | Medium (NEW-07) |
| Audit log / lịch sử | **Không có** | Thiếu | Toàn bộ | Low (NEW-08, NEW-09) |

---

## PHẦN 4 — Phân tích nghỉ cả ngày

**Luồng hiện tại:** bác sĩ chọn "Cả ngày" (form riêng) hoặc bấm "Gửi yêu cầu nghỉ" cho 1 slot cụ thể
trên Lịch làm việc (luồng này **luôn** gửi kèm `gio_bat_dau`/`gio_ket_thuc` của slot đó —
`DoctorSchedule.tsx:297` — nên **không thể** tạo đơn "cả ngày" từ nút trên Lịch làm việc, chỉ từ form
riêng). `gio_bat_dau`/`gio_ket_thuc` = `null` → nghỉ cả ngày.

**Điều kiện (đối chiếu code, trả lời 10 câu hỏi mục 7.1 đề bài):**

1. **Số ca/ngày**: không cố định — mặc định 15 slot (7 sáng + 8 chiều, nghỉ trưa 11:30–13:30, theo
   `DEFAULT_SLOT_TIMES` trong `scheduleGenerator.service.js`), nhưng Admin có thể tạo lịch thủ công với
   số slot khác (`admin/slots.controller.js:createSchedule`).
2. **Liên kết**: theo **(bác sĩ + khoảng ngày)**, KHÔNG liên kết `schedule_id` cụ thể nào — tại thời
   điểm **duyệt**, `lockSlotsForLeave` mới `LichLamViec.find({doctor_id, ngay: {$gte,$lt}})` để tìm
   document phù hợp (`admin/doctor-leaves.controller.js:67-70`).
3. **Bao phủ toàn bộ ca**: có — loop toàn bộ `schedule.slots`, khóa mọi slot `status==='active'`
   (dòng 77-88).
4 & 5. **Chồng với đơn theo ca/đã duyệt trước**: bị chặn — logic `LEAVE-01`
   (`doctor/leaves.controller.js:103-108`): nếu đơn MỚI là cả ngày (`newIsFullDay=true`) → **luôn** coi
   là trùng với BẤT KỲ đơn `cho_duyet/da_duyet` nào overlap khoảng ngày, bất kể đơn cũ là cả ngày hay
   theo ca. → **Đúng nghiệp vụ**: không cho gửi cả ngày nếu đã có đơn (bất kỳ loại) đang xử lý trùng
   ngày.
6. **Tất cả ca được cập nhật khi duyệt**: có, đã xác nhận ở mục 3.
7. **Admin tạo thêm ca mới sau khi đã duyệt cả ngày**: ⚠️ **CHƯA CÓ GUARD**. `admin/slots.controller.js:
   updateSlot` (dòng 406-468) cho phép đổi `status` của bất kỳ slot nào (kể cả slot đã bị khóa bởi nghỉ
   phép, `nghi_phep_id` đã set) về `'active'` mà **không kiểm tra** `nghi_phep_id` hiện tại hay
   `trang_thai_ngay==='nghi_phep'` — Admin có thể vô tình "mở lại" slot đã khóa hợp lệ. → **NEW-05**.
8. **Ngày không có lịch làm việc**: `createLeaveRequest` **không kiểm tra** có `LichLamViec` tồn tại
   hay không trước khi tạo đơn (chỉ check `startDate < today` và trùng lặp) — bác sĩ có thể "xin nghỉ"
   một ngày mà họ vốn không có ca nào; khi duyệt, `lockSlotsForLeave` chỉ đơn giản không tìm thấy
   `schedule` nào để khóa (`slotsLocked=0`), không lỗi nhưng cũng vô nghĩa.
9. **Chủ nhật / cơ sở không hoạt động**: không bị chặn ở tầng validate — tương tự mục 8, vô hại vì
   không có gì để khóa (hệ thống chỉ sinh lịch T2–T7 theo tài liệu cũ).
10. **Một số ca đã qua, một số chưa trong cùng ngày hôm nay**: `createLeaveRequest` chỉ so sánh **NGÀY**
    (`today.setHours(0,0,0,0)`), không so **GIỜ** — có thể tạo đơn "cả ngày" cho hôm nay dù nửa ngày đã
    trôi qua. Khi duyệt, slot đã trôi qua giờ nhưng còn `status==='active'` (vì hệ thống không có cơ
    chế tự chuyển slot quá khứ sang trạng thái khác) vẫn bị khóa — vô hại về nghiệp vụ (slot quá khứ
    vốn không đặt được, `isSlotInPast` đã chặn ở `booking.controller.js`) nhưng dữ liệu bị đánh dấu
    "khóa bởi nghỉ phép" không cần thiết. **Low risk.**

**Ảnh hưởng lịch làm việc**: đúng như thiết kế — `trang_thai_ngay` chuyển `'nghi_phep'` (chỉ khi
`schedule.trang_thai_ngay==='lam_viec'` lúc duyệt, dòng 90), khiến `getSlots` (đặt lịch bệnh nhân) loại
cả ngày qua điều kiện có sẵn `trang_thai_ngay:'lam_viec'` (`patient/booking.controller.js:225`).

**Ảnh hưởng lịch hẹn**: không tự đụng — chỉ liệt kê để Admin xử lý thủ công (hiện chưa có công cụ, xem
Phần 1).

**Đề xuất** (chỉ đề xuất, chưa làm): thêm guard ở `updateSlot` (NEW-05); cân nhắc kiểm tra tồn tại
`LichLamViec` trước khi cho tạo đơn (mức độ ưu tiên thấp vì không gây lỗi, chỉ cho phép hành động vô
nghĩa).

---

## PHẦN 5 — Phân tích nghỉ theo ca

**Luồng hiện tại — CÓ 2 ĐƯỜNG KHÁC NHAU, hành vi khác nhau:**

### 5.1 Từ trang Lịch làm việc (`DoctorSchedule.tsx:288-307`, đúng slot thật)
Nút gắn trực tiếp vào 1 slot cụ thể (`canRequestLeave = slot.status === 'active' && !isPastDay &&
!coveringLeave`, dòng 491) → gửi đúng `slot.gio_bat_dau`/`slot.gio_ket_thuc` thật (dòng 297).

### 5.2 Từ form "Xin nghỉ" riêng (`DoctorLeaveRequests.tsx:36-162`, **nhập tay**)
`CreateLeaveModal` cho chọn radio "Khung giờ cụ thể" → 2 ô `<input type="time">` mặc định `08:00`–
`12:00` (dòng 48-49), **không đọc dữ liệu lịch làm việc thật**, không giới hạn theo slot có sẵn của
bác sĩ. Validate duy nhất: `gioKetThuc > gioBatDau` (dòng 52) — không kiểm tra giờ đó có thuộc ca thật
nào không.

**Trả lời 10 câu hỏi mục 7.2 đề bài:**

1. **Chọn từ lịch thật hay nhập tay?** — **Cả hai**, tuỳ đường vào (5.1 vs 5.2 ở trên). → **NEW-03**.
2. **Cho nhập thời gian tùy ý giữa 1 ca?** — Có, qua đường 5.2.
3. **Cho nghỉ nửa ca?** — Về input thì có thể nhập giờ lẻ, nhưng backend không có khái niệm "nửa slot"
   — `lockSlotsForLeave` coi TOÀN BỘ slot bị khóa nếu **giao nhau bất kỳ phần nào**
   (`slot.gio_bat_dau < leave.gio_ket_thuc && slot.gio_ket_thuc > leave.gio_bat_dau`, dòng 78-80) — 1
   khoảng giờ cắt ngang 2 slot 30 phút sẽ khóa **cả 2 slot nguyên vẹn**, không phải "nửa slot" đúng
   nghĩa.
4. **"1 ca" là gì khi lịch gồm nhiều khung giờ nhỏ?** — Không có khái niệm "ca" tường minh trong model;
   chỉ có "slot" 30 phút cố định (`DEFAULT_SLOT_TIMES`). "Ca sáng"/"ca chiều" là khái niệm ngôn ngữ,
   không phải field dữ liệu.
5 & 6. **Nghỉ 2 khung giờ không liên tục trong 1 yêu cầu?** — Model chỉ hỗ trợ **1 khoảng liên tục**
   mỗi document (`tu_ngay/den_ngay/gio_bat_dau/gio_ket_thuc` đơn). Muốn nghỉ 2 khung giờ rời rạc (vd
   sáng và chiều nhưng không phải cả ngày) phải tạo **2 yêu cầu riêng** — nhưng **FE hiện không có UI**
   cho việc gửi nhiều khung giờ trong 1 lần thao tác (`CreateLeaveModal` chỉ nhận 1 khoảng/lần submit).
7. **Ca đã có bệnh nhân có được gửi yêu cầu?** — Đường 5.1: **KHÔNG** (nút chỉ hiện cho slot `active`,
   slot `booked` chỉ có nút "Yêu cầu hủy" — flow khác hẳn, dùng `requestCancelSlot`). Đường 5.2:
   **CÓ THỂ** — form nhập tay không kiểm tra slot có bệnh nhân hay không; backend cũng không chặn
   (chỉ đếm và cảnh báo qua `so_lich_hen_anh_huong`). → Không nhất quán giữa 2 đường vào.
8. **Ca đang diễn ra có được xin nghỉ?** — Có, không kiểm tra giờ hiện tại so với slot (chỉ kiểm tra
   ngày, xem Phần 4 mục 10).
9. **Ca đã kết thúc (trong hôm nay) có được xin nghỉ?** — Có, cùng lý do — không có kiểm tra giờ ở cả
   FE (`isPastDay` chỉ so ngày) và BE (`createLeaveRequest` chỉ so ngày).
10. **Ca đã đóng/hủy/nghỉ có chọn tiếp được không?** — Đường 5.1: **KHÔNG** (đúng, `canRequestLeave`
    check `status==='active'`). Đường 5.2: **KHÔNG kiểm soát được** vì không biết status thật của slot
    khi nhập tay giờ.

**Ảnh hưởng lịch làm việc**: chỉ khóa slot giao khung giờ, các slot khác trong ngày giữ nguyên
`trang_thai_ngay='lam_viec'` (không đổi cấp ngày) — đúng thiết kế.

**Ảnh hưởng lịch hẹn**: tương tự Phần 4, chỉ liệt kê không tự xử lý.

**Đề xuất**: hạn chế form 5.2 chỉ cho chọn khung giờ từ danh sách slot thật của bác sĩ trong ngày đã
chọn (tương tự cách đường 5.1 đang làm), thay vì `<input type="time">` tự do — giảm rủi ro tạo đơn cho
khung giờ không tồn tại thực tế. **Chưa sửa trong bước phân tích này.**

---

## PHẦN 6 — So sánh nghỉ cả ngày và nghỉ theo ca

| Tiêu chí | Nghỉ cả ngày | Nghỉ theo ca | Đối chiếu code |
|---|---|---|---|
| Phạm vi ảnh hưởng | Toàn bộ slot `active` trong ngày + `trang_thai_ngay` | Chỉ slot giao khung giờ | `lockSlotsForLeave` dòng 77-93 |
| Dữ liệu lựa chọn | Chỉ ngày (`gio_bat_dau=null`) | Ngày + giờ bắt đầu/kết thúc | `NghiPhepBacSi.gio_bat_dau` |
| Số `LichLamViec` bị tác động | 1 (hoặc nhiều nếu `tu_ngay≠den_ngay`, hoặc bất thường nếu GAP-8 trùng) | 1 | `find({doctor_id, ngay:{$gte,$lt}})` |
| Chống trùng | Chặn với **mọi** đơn overlap ngày | Chặn theo **giao khung giờ** | `leaves.controller.js:103-108` |
| Đồng bộ Lịch làm việc | `trang_thai_ngay='nghi_phep'` + khóa mọi slot active | Chỉ khóa slot giao giờ, giữ `trang_thai_ngay` | Đã xác nhận bằng code + test tích hợp hôm nay |
| Tiếp tục làm ca khác trong ngày | Không | Có | Theo thiết kế |
| Nguồn chọn giờ | N/A (không cần giờ) | **2 nguồn khác nhau** (slot thật vs nhập tay) | NEW-03 |
| Dữ liệu seed thật | 4/5 đơn thật là cả ngày | **0/5** đơn thật là theo ca (46 "theo ca" trong DB hiện tại đều là artifact test hôm nay) | `docs/doctor-leave-database-gap-analysis.md` mục B |

**Kết luận:**
- **Dùng nghỉ cả ngày** khi bác sĩ nghỉ toàn bộ ngày làm việc (ốm, việc riêng dài).
- **Dùng nghỉ theo ca** khi chỉ vắng 1 khung giờ cụ thể trong ngày.
- **Không cần hỗ trợ "nghỉ một phần slot"** (vd nghỉ 15 phút giữa 1 slot 30 phút) — hệ thống vốn không
  có khái niệm slot nhỏ hơn 30 phút, và nghiệp vụ phòng khám không cần độ chính xác đó.
- **Phạm vi tối thiểu phù hợp đồ án**: giữ nguyên 2 loại hiện có (cả ngày / theo khung giờ liên tục),
  **không mở rộng** thành nhiều khung giờ rời rạc trong 1 đơn — nếu cần, hướng dẫn bác sĩ tạo nhiều đơn
  riêng (đã hoạt động được, chỉ thiếu UI thuận tiện).

---

## PHẦN 7 — Tương tác với Lịch làm việc

**Từ Lịch làm việc → Xin nghỉ:** đã đúng theo yêu cầu — tự điền ngày/slot, không hiện nút với slot
không đủ điều kiện (`canRequestLeave`), không cho sửa sang ca khác sau khi mở dialog (dialog chỉ có 1
slot cố định, không có dropdown đổi slot) — **hạn chế nhẹ, không phải lỗi** (thiết kế "1 dialog = 1
slot" đơn giản, không phải bug).

**Từ Xin nghỉ → Lịch làm việc, theo từng trạng thái:**

| Trạng thái | Yêu cầu | Thực tế (sau fix hôm nay) |
|---|---|---|
| Tạo mới (`cho_duyet`) | Không xóa lịch, không coi là đã duyệt | ✅ Đúng — `NghiPhepBacSi` và `LichLamViec` là 2 write hoàn toàn tách biệt |
| Bị từ chối | Lịch giữ nguyên | ✅ Đúng — `rejectDoctorLeave` không đụng `LichLamViec` |
| Bị hủy | Lịch giữ nguyên | ✅ Đúng — `cancelLeaveRequest` không đụng `LichLamViec`/`LichHen` (comment dòng 136-138) |
| Được duyệt | Ca chuyển đúng enum, không xóa document, không mất phòng/y tá, không hiện như ca còn nhận lịch | ✅ Đúng — `slot.status='locked'` (enum có sẵn), document/phòng/y tá không đổi, `getSlots` loại slot `active===false` |

**Chờ duyệt có chặn đặt lịch mới không (mục 9.3 đề bài):**
- Hệ thống dùng **Phương án A cho `cho_duyet`** (không khóa — `getSlots` không đọc `NghiPhepBacSi`) +
  **khóa cứng khi `da_duyet`** (Phương án B chỉ áp dụng SAU khi duyệt). Đây là kết luận đã đưa ra và
  triển khai trong phiên làm việc trước (`docs/doctor-schedule-leave-sync-review.md` §7) — **đã xác
  nhận đúng bằng test tích hợp thật** hôm nay (`backend/tests/doctor.leave-sync.test.js`, test "Duyet
  nghi theo khung gio" — trước duyệt slot vẫn đặt được, sau duyệt thì không).
- **Lý do chọn**: giảm thiểu rủi ro lớn nhất (đã duyệt mà vẫn đặt được — Critical) trong khi không làm
  giảm năng lực đặt lịch một cách không cần thiết khi Admin chưa quyết định.

**Phát hiện thêm — hiển thị ở tầng danh sách tuần (`DoctorSlot`) thiếu field:**
`frontend/src/types/index.ts:652-680` (`DoctorSlot`, dùng cho `GET /doctor/schedule` — màn tuần) **không
có** `bi_khoa_boi_nghi_phep`/`nghi_phep_id`, trong khi `DoctorScheduleDetailSlot` (dòng 720-731, dùng
cho modal Chi tiết 1 ngày) **có**. Đối chiếu backend: `flattenSchedules()`
(`schedule.controller.js:37-58`) xác nhận **không trả** 2 field này ở API danh sách tuần. → Bác sĩ ở
màn tuần chỉ thấy badge "Tạm nghỉ" chung chung (từ `status==='locked'`), phải mở modal Chi tiết mới
biết rõ `bi_khoa_boi_nghi_phep`. **Không phải lỗi nghiêm trọng** (dữ liệu vẫn đúng, chỉ chưa hiển thị
đủ chi tiết ở view tổng quan) — **Low**, xem NEW-12.

---

## PHẦN 8 — Tương tác với Lịch hẹn

**8.1 Trước khi gửi yêu cầu:** `demLichHenAnhHuong` (`doctor/leaves.controller.js:37-51`) đếm lịch hẹn
`status ∈ AFFECTED_BY_LEAVE_STATUSES` (`pending, confirmed, checked_in, in_progress,
waiting_doctor_confirm` — `utils/appointmentStatus.js:13-19`) trong khoảng ngày (+ lọc giờ nếu có) —
**chỉ đếm SỐ LƯỢNG**, không trả chi tiết từng lịch hẹn ở bước tạo (đúng theo khuyến nghị đề bài "không
cần hiển thị quá nhiều thông tin bệnh nhân"). Nhưng **số này chỉ trả về SAU khi tạo thành công**
(`so_lich_hen_anh_huong` trong response `201`), **không** có endpoint "preview" để xem trước khi bấm
gửi — cả 2 luồng FE (5.1, 5.2) đều hiện cảnh báo tĩnh chung chung TRƯỚC, và số liệu thật CHỈ xuất hiện
trong toast SAU khi gửi. → **NEW-06**.

**8.2 Ca chưa có lịch hẹn:** đúng như yêu cầu — duyệt xong, ca chuyển nghỉ, không có bước chuyển lịch
hẹn nào (không có gì để chuyển).

**8.3 Ca đã có lịch hẹn:** đúng như yêu cầu — `findAffectedAppointments` liệt kê (không xử lý), backend
**không** tự hủy/hoàn tiền/đổi bác sĩ (đã xác nhận đọc toàn bộ `lockSlotsForLeave`/`findAffectedAppointments`
— chỉ có `LichLamViec.find`/`.save` và `LichHen.find` (đọc), không có `LichHen.updateOne`/`.save()`
nào). **Nhưng**: vì **không có Admin UI** (Phần 1), "Admin xử lý" hiện tại **chỉ có thể** thực hiện qua
trang Quản lý lịch hẹn (`ManageAppointments`, module riêng) một cách **thủ công, không liên kết** với
đơn nghỉ vừa duyệt — Admin phải tự nhớ/tự tra ngày+bác sĩ, **không có link trực tiếp** từ kết quả duyệt
đơn sang danh sách lịch hẹn đã lọc sẵn.

**8.4 Thứ tự duyệt nghỉ và xử lý lịch hẹn:** hệ thống hiện dùng **Cách 1** (duyệt nghỉ trước, xử lý
lịch hẹn sau, độc lập) — không có trạng thái trung gian nào trong `NghiPhepBacSi.trang_thai` (chỉ 4
giá trị enum sẵn có, không thêm). Đây là lựa chọn hợp lý cho phạm vi đồ án — **Cách 2** (chờ xử lý xong
lịch hẹn mới hoàn tất duyệt) đòi hỏi thêm trạng thái trung gian (schema change) và luồng phức tạp hơn
nhiều, không cần thiết khi khối lượng lịch hẹn bị ảnh hưởng thường nhỏ (xem dữ liệu thật: seed hiện tại
0 lịch hẹn thật rơi vào khoảng ngày của 2 đơn `da_duyet` seed — **chưa đủ căn cứ để đánh giá** có bao
nhiêu lịch hẹn thật từng bị ảnh hưởng trong lịch sử, vì không có dữ liệu lịch hẹn nào trùng khớp được
kiểm tra riêng trong phạm vi phân tích này).

**8.5 Đồng bộ sau khi duyệt** (đối chiếu từng điểm mục 10.5 đề bài):
- Lịch làm việc đổi trạng thái: ✅ (xác nhận bằng test).
- Booking API loại ca nghỉ: ✅ (xác nhận bằng test, cả `getSlots` và `createBooking`).
- Trang Lịch làm việc bác sĩ phản ánh: ✅ (đọc trực tiếp `LichLamViec`, không cache).
- Trang Lịch hẹn bác sĩ phản ánh kết quả xử lý: **⚠️ Không có gì để phản ánh** vì backend không tự xử
  lý lịch hẹn — trang Lịch hẹn chỉ hiện đúng trạng thái lịch hẹn hiện tại (không đổi trừ khi Admin tự
  vào sửa ở nơi khác).
- Dashboard tính ca nghỉ là ca làm: **chưa đủ căn cứ** — chưa kiểm tra code Dashboard trong phạm vi
  phân tích này (ngoài phạm vi 3 chức năng đề bài nêu: Xin nghỉ, Lịch làm việc, Lịch hẹn).
- Cache/state FE refetch: Lịch làm việc bác sĩ **có** refetch (`loadLeaves()` sau khi gửi/hủy,
  `DoctorSchedule.tsx:299,216-218`); trang Xin nghỉ **có** cập nhật state cục bộ sau tạo/hủy
  (`DoctorLeaveRequests.tsx:221,236`) — không cần reload thủ công cho chính thao tác vừa làm; **không**
  có cơ chế đẩy real-time nếu Admin xử lý ở nơi khác trong lúc bác sĩ đang mở trang (phải tự F5).

---

## PHẦN 9 — Phân tích quyền và bảo mật

| Hành động | Bác sĩ | Admin | Backend kiểm tra |
|---|---|---|---|
| Tạo đơn nghỉ cho chính mình | ✅ | ✅ (tạo hộ, truyền `bac_si_id`) | `getDocId(req.user.id)` (bác sĩ) / `ensureDoctorExists(bac_si_id)` (admin) |
| Tạo đơn nghỉ cho bác sĩ khác | ❌ | ✅ | Bác sĩ: docId luôn suy từ token, không nhận `bac_si_id` từ body |
| Xem danh sách đơn của mình | ✅ | ✅ (xem tất cả, lọc `bac_si_id`) | `listMyLeaveRequests` filter cứng `bac_si_id: docId` |
| Xem đơn của bác sĩ khác | ❌ (404 nếu cố truy cập — `findOne({_id, bac_si_id: docId})`) | ✅ | `cancelLeaveRequest`, `doctor/leaves.controller.js:144` |
| Hủy đơn của mình (còn `cho_duyet`) | ✅ | — (Admin không có endpoint hủy hộ) | `trang_thai !== 'cho_duyet'` → 409 |
| Hủy đơn của bác sĩ khác | ❌ (404) | N/A | `findOne({_id, bac_si_id: docId})` không match → 404, không lộ tồn tại |
| Duyệt/từ chối đơn | ❌ (không có endpoint) | ✅ | `router.use(requireRole('admin'))` toàn bộ `/admin/doctor-leaves` |
| Duyệt/từ chối đơn đã xử lý | ❌ | ❌ (409, kể cả Admin) | Guard `trang_thai !== 'cho_duyet'` áp dụng cho **cả admin** (sửa hôm nay, SYNC-02) |
| Truyền `id` tùy ý để thao tác đơn người khác | ❌ | ✅ (đúng vai trò) | Bác sĩ luôn bị chặn bởi filter `bac_si_id: docId`; không có cách "đoán ID" vượt qua vì query luôn kèm điều kiện sở hữu |

**Không phát hiện lỗ hổng vượt quyền nào** trong luồng bác sĩ (đã đọc toàn bộ 3 hàm
`doctor/leaves.controller.js` — mọi truy vấn đều kèm `bac_si_id: docId` suy từ token).

---

## PHẦN 10 — Phân tích frontend

| File | Vai trò | API sử dụng | Lỗi phát hiện | Đề xuất |
|---|---|---|---|---|
| `pages/doctor/DoctorLeaveRequests.tsx` | Trang chính: danh sách + filter + tạo + hủy | `doctor-leave.service.ts` (list/create/cancel) | Form nhập giờ tự do (NEW-03); không hiện cảnh báo trước gửi (NEW-06); không có view chi tiết riêng | Ràng buộc chọn giờ theo slot thật; hiện preview số lịch hẹn trước khi xác nhận |
| `pages/doctor/DoctorSchedule.tsx` | Nút "Gửi yêu cầu nghỉ" theo slot + hiển thị nhãn trạng thái đơn phủ slot | `schedule.service.ts`, `doctor-leave.service.ts` | Không cảnh báo số lịch hẹn trước gửi (NEW-06, chung với trên) | — |
| `services/doctor-leave.service.ts` | 3 hàm: `list/create/cancel` gọi `/doctor/leaves` | — | **Không có hàm nào cho `/admin/doctor-leaves`** | Cần tạo `admin-doctor-leave.service.ts` nếu làm Admin UI (NEW-01) |
| `types/index.ts` (`DoctorLeaveRequest`, dòng 682-697) | Type cho đơn nghỉ phía bác sĩ | — | Không có type `AdminDoctorLeave` (0 kết quả grep); thiếu `so_slot_da_khoa`/`lich_hen_can_xu_ly` (field mới thêm hôm nay ở response duyệt) | Bổ sung type nếu làm Admin UI |
| `types/index.ts` (`DoctorSlot`, dòng 652-680) | Type slot cho màn tuần | — | Thiếu `bi_khoa_boi_nghi_phep`/`nghi_phep_id` (NEW-12) | Bổ sung field nếu muốn hiển thị chi tiết hơn ở màn tuần |
| `utils/scheduleWeek.ts` (`findCoveringLeave`) | Đối chiếu đơn nghỉ ↔ slot (chỉ slot `active`) | — | Sau fix hôm nay, slot đã khóa chuyển `status='locked'` nên **không còn chạy qua hàm này** (guard `slot.status==='active'`) — hành vi vẫn đúng nhưng nhãn hiển thị đổi từ "Đã duyệt nghỉ" (cam) sang "Tạm nghỉ" (vàng, badge status chung) | Không bắt buộc sửa — chỉ là thay đổi nhãn, không sai dữ liệu |
| `utils/constants.ts` (`DOCTOR_LEAVE_STATUS_COLOR`, dòng 173-178) | Màu badge trạng thái đơn | — | Nhất quán 4 trạng thái, không có gì bất thường | — |
| **Admin — không có file nào** | — | — | Thiếu hoàn toàn (NEW-01) | Cần tạo mới nếu triển khai |

**UI/UX kiểm tra nhanh** (đối chiếu mục 14 đề bài, dựa trên code đã đọc — chưa chạy browser thật trong
bước này nên đánh dấu **[cần kiểm chứng động]** cho phần thị giác):
- Nghỉ cả ngày/theo ca phân biệt rõ bằng radio + ẩn/hiện ô giờ (`CreateLeaveModal:90-131`) — ✅ đúng code.
- Loading khóa nút gửi: có (`disabled={submitting}` xuyên suốt form) — ✅.
- Chống double-submit: có (`canSubmit` + `disabled` khi `submitting`) — ✅.
- Thông báo lỗi: dùng `(err as Error).message` từ backend, đủ rõ nếu backend trả message tiếng Việt cụ
  thể (đã xác nhận backend luôn trả message rõ ràng, vd "Đã có yêu cầu nghỉ đang xử lý trùng khung giờ
  này").
- Mobile/màn nhỏ: **[cần kiểm chứng động]** — chưa chạy Playwright trong bước phân tích này.

---

## PHẦN 11 — Phân tích backend

| File | Vai trò | Logic hiện tại | Lỗi nghiệp vụ | Rủi ro |
|---|---|---|---|---|
| `controllers/doctor/leaves.controller.js` | CRUD đơn nghỉ phía bác sĩ | list (ownership filter) / create (validate + chống trùng theo giờ + đếm ảnh hưởng) / cancel (guard `cho_duyet`) | Không kiểm tra giờ (chỉ ngày); không kiểm tra `LichLamViec` tồn tại trước khi tạo | Medium/Low (đã nêu Phần 4-5) |
| `controllers/admin/doctor-leaves.controller.js` | CRUD + duyệt/từ chối phía admin | create (tạo hộ) / list (không phân trang — trả toàn bộ, hiện 90 doc, sẽ chậm dần khi dữ liệu tăng) / approve (transaction, khóa slot, liệt kê lịch hẹn) / reject (guard `cho_duyet`) | `formatDoctorLeave` thiếu `gio_bat_dau/gio_ket_thuc` (NEW-02); `listDoctorLeaves` không phân trang | High (NEW-02); Low (phân trang) |
| `routes/doctor/leaves.routes.js` | 3 route, bảo vệ bởi `requireRole('doctor')` ở `routes/doctor/index.js` | — | — | — |
| `routes/admin/doctor-leaves.routes.js` | 4 route, bảo vệ bởi `requireRole('admin')` tại chính file | — | — | — |
| `models/NghiPhepBacSi.js` | Schema đơn nghỉ | Index không unique — không chống race condition tạo trùng đồng thời ở tầng DB | Race condition lý thuyết (2 request đồng thời cùng pass qua check "trùng" trước khi cả 2 insert) | Low (NEW-11) |
| `utils/appointmentStatus.js` | `AFFECTED_BY_LEAVE_STATUSES` dùng chung cho đếm + liệt kê ảnh hưởng | Nguồn 1 chỗ duy nhất, tránh lặp logic | — | — |

**Kiểm tra backend khi tạo (đối chiếu 12 câu hỏi mục 15 đề bài):**
1. Người gọi là bác sĩ? — `requireRole('doctor')` ở router. ✅
2. Bác sĩ từ token hay FE? — Token (`getDocId(req.user.id)`). ✅
3. Lịch làm việc thuộc bác sĩ? — **Không kiểm tra ở bước TẠO** (chỉ kiểm tra khi DUYỆT, lúc
   `lockSlotsForLeave` tự tìm theo `doctor_id`). ⚠️ (đã nêu Phần 4.8)
4. Ngày/ca còn hợp lệ? — Chỉ kiểm tra ngày (không kiểm tra giờ). ⚠️ (Phần 4.10, 5.8-5.9)
5. Trùng? — Có, theo khung giờ giao nhau (LEAVE-01). ✅
6. Chồng lấn? — Có, cùng logic câu 5. ✅
7. Ca đang diễn ra/đã kết thúc? — Không kiểm tra riêng giờ. ⚠️
8. Có lịch hẹn ảnh hưởng? — Có (`demLichHenAnhHuong`). ✅
9. Trả số lượng ảnh hưởng? — Có, nhưng chỉ trong response tạo (không có endpoint preview). ⚠️ (NEW-06)
10. Validate lý do? — Có (`ly_do?.trim()` bắt buộc, không giới hạn độ dài tối đa ở backend — model có
    `maxlength: 500` nên Mongoose sẽ tự chặn ở tầng validate nếu vượt). ✅
11. Chống tạo trùng do request đồng thời? — **Không** — không có transaction/unique index bao trùm
    bước "kiểm tra trùng" + "insert". ⚠️ (NEW-11)
12. Trả lỗi nghiệp vụ rõ ràng? — Có, message tiếng Việt cụ thể theo từng case (400/404/409). ✅

**Kiểm tra khi hủy:**
1. Thuộc bác sĩ đăng nhập? — `findOne({_id, bac_si_id: docId})`. ✅
2. Trạng thái cho phép hủy? — `trang_thai !== 'cho_duyet'` → 409. ✅
3. Race với admin đang duyệt? — **Có khả năng lý thuyết**: nếu Admin và bác sĩ cùng thao tác gần như
   đồng thời, ai `save()` sau sẽ thắng (Mongoose không có optimistic locking ở đây) — nhưng vì
   `approveDoctorLeave` dùng transaction còn `cancelLeaveRequest` không, và cả 2 đều check
   `trang_thai==='cho_duyet'` TRƯỚC KHI ghi, race hẹp nhất có thể xảy ra là: cả 2 đọc `cho_duyet` gần
   như cùng lúc → cả 2 đều pass check → 1 trong 2 ghi trước, cái sau ghi đè (mất tính nhất quán, nhưng
   **không mất dữ liệu nghiêm trọng** — vẫn có 1 kết quả cuối cùng hợp lệ). **[cần kiểm chứng động]**
   để xác nhận tần suất thực tế, nhưng về lý thuyết đây là race condition thật do thiếu
   optimistic-locking (`version key` hoặc `findOneAndUpdate` với điều kiện trạng thái).
4. Trạng thái cuối cùng ai quyết? — Không xác định (race), phụ thuộc thứ tự I/O thực tế.
5. Cập nhật `LichLamViec`? — Không (đúng thiết kế — hủy không mở lại slot vì hủy chỉ áp dụng cho
   `cho_duyet`, tức chưa từng bị khóa).
6. Lưu thời điểm hủy? — **Không** — model không có field `thoi_diem_huy` riêng (chỉ có
   `ngay_cap_nhat` tự động của Mongoose timestamps, không phải field nghiệp vụ tường minh).

**Kiểm tra khi admin duyệt (đối chiếu 10 câu hỏi):**
1. Còn `cho_duyet`? — Có kiểm tra (409 nếu không, sửa hôm nay). ✅
2. Lịch làm việc còn tồn tại? — Không bắt buộc phải tồn tại (`lockSlotsForLeave` xử lý `schedules=[]`
   một cách an toàn — vòng lặp rỗng, `slotsLocked=0`). ✅ (không lỗi, chỉ vô nghĩa nếu không có lịch)
3. Lịch có bị thay đổi từ lúc tạo đơn? — Không quan trọng vì `lockSlotsForLeave` đọc **tại thời điểm
   duyệt**, không dùng dữ liệu cũ từ lúc tạo. ✅
4. Lịch hẹn mới phát sinh? — Được tính lại tại thời điểm duyệt (`findAffectedAppointments` đọc live,
   không dùng số đã lưu lúc tạo). ✅
5. Cần kiểm tra lại số lịch hẹn? — Có, tự động (câu 4). ✅
6. Nghỉ cả ngày cập nhật đủ tất cả ca? — Có. ✅
7. Nghỉ theo ca cập nhật đúng 1 phạm vi giờ? — Có (không phải "đúng 1 ca" theo nghĩa 1 slot, mà đúng
   mọi slot giao khung giờ — có thể là nhiều slot nếu khung giờ dài hơn 1 slot). ✅
8. Booking API loại ca nghỉ? — Có (SYNC-01, cả `getSlots` và `createBooking`). ✅
9. Xử lý lỗi đồng bộ? — Có transaction bao trùm cả 2 write (`leave.save` + `schedule.save` nhiều
   lần) — nếu 1 bước lỗi, `abortTransaction()` rollback toàn bộ. ✅
10. Ghi nhận người duyệt + thời điểm? — Có (`nguoi_duyet_id`, `thoi_diem_duyet`). ✅

---

## PHẦN 12 — Phân tích database

Xem đầy đủ ở `docs/doctor-leave-database-gap-analysis.md`. Tóm tắt:

- **Model thực tế**: `NghiPhepBacSi` (collection `nghi_phep_bac_si`) — field đầy đủ liệt kê ở gap
  analysis mục A.1. Liên kết `bac_si_id` → `BacSi`; **KHÔNG** liên kết trực tiếp `schedule_id`/`slot_id`
  (liên kết chỉ hình thành **tại thời điểm duyệt**, ghi ngược lại vào `LichLamViec.slots[].nghi_phep_id`).
- **Dữ liệu đủ hay thiếu**: **đủ** để vận hành đúng chức năng hiện tại — không cần field mới bắt buộc.
  Các khoảng trống (lịch sử trạng thái, ranh giới với `BacSi.trang_thai`) là **"nên có"**, không chặn
  chức năng chính.
- **Dữ liệu không nhất quán phát hiện được (thật, đọc trực tiếp DB)**: 1 đơn `da_duyet` seed
  (`bac_si_id=...0c19`, 2026-07-16→18) có `nguoi_duyet_id` set nhưng **0 slot nào bị khóa thật** — vì
  được tạo bằng seed script set thẳng `trang_thai:'da_duyet'`, không qua luồng duyệt thật (trước hoặc
  không liên quan đến fix SYNC-02 hôm nay). Đây là dữ liệu demo, không phải lỗi code.
- **Index/validation**: index hiện có đủ cho truy vấn theo bác sĩ+ngày+trạng thái; **không có unique
  index** chống tạo trùng ở tầng DB (chỉ có logic tầng ứng dụng) — rủi ro race condition thấp (NEW-11).
- **Không tự giả định field**: mọi field liệt kê trong báo cáo này đều đọc trực tiếp từ
  `backend/src/models/NghiPhepBacSi.js` và xác nhận chéo bằng dữ liệu thật trong MongoDB Cloud.

---

## PHẦN 13 — State transition (chuyển trạng thái)

| Trạng thái hiện tại | Hành động | Người thực hiện | Trạng thái tiếp theo | Điều kiện | Endpoint |
|---|---|---|---|---|---|
| (chưa có) | Tạo đơn | Bác sĩ | `cho_duyet` | Ngày ≥ hôm nay; không trùng khung giờ; có lý do | `POST /doctor/leaves` |
| (chưa có) | Tạo hộ | Admin | `cho_duyet` | Bác sĩ tồn tại | `POST /admin/doctor-leaves` |
| `cho_duyet` | Duyệt | Admin | `da_duyet` | Đang `cho_duyet` (409 nếu không) | `PATCH /admin/doctor-leaves/:id/approve` |
| `cho_duyet` | Từ chối | Admin | `tu_choi` | Đang `cho_duyet` (409 nếu không) | `PATCH /admin/doctor-leaves/:id/reject` |
| `cho_duyet` | Hủy | Bác sĩ (chính chủ) | `da_huy` | Đang `cho_duyet` (409 nếu không); đúng `bac_si_id` (404 nếu không) | `PATCH /doctor/leaves/:id/cancel` |
| `da_duyet` | Hủy | — | **Không thể** (không có endpoint) | — | — |
| `da_duyet` | Từ chối | — | **Không thể** (409, guard mới thêm hôm nay) | — | — |
| `tu_choi` | Bất kỳ | — | **Không thể** đổi tiếp (cả duyệt lẫn hủy đều check `cho_duyet`) | — | — |
| `da_huy` | Bất kỳ | — | **Không thể** đổi tiếp | — | — |

**Không cho phép** (đối chiếu yêu cầu đề bài, xác nhận bằng code):
- Bác sĩ tự chuyển sang `da_duyet`: ✅ không có endpoint nào cho bác sĩ làm việc này.
- Bác sĩ tự chuyển từ `tu_choi` sang `da_duyet`: ✅ không thể (không có endpoint đổi trạng thái tùy ý
  — chỉ có 3 endpoint cố định logic: create/cancel).
- Bác sĩ tự hủy đơn đã `da_duyet`: ✅ bị chặn (409).
- Sửa nội dung yêu cầu sau khi admin xử lý: ✅ không có endpoint "update" nội dung đơn (chỉ có
  create/cancel cho bác sĩ, approve/reject cho admin — không có PATCH sửa `ly_do`/`tu_ngay` v.v.).
- FE truyền trạng thái tùy ý để BE cập nhật: ✅ không có endpoint nhận `trang_thai` trực tiếp từ body
  cho bác sĩ; admin approve/reject là 2 endpoint **riêng biệt cố định hành động**, không phải 1
  endpoint generic "set trạng thái" nhận giá trị tùy ý.

**Transaction/rollback khi duyệt** (mục cuối Phần 13 đề bài): có transaction Mongo bao trùm toàn bộ
(`session.startTransaction()` → nếu bất kỳ bước nào lỗi → `abortTransaction()`) — nếu duyệt cả ngày mà
1 trong nhiều `LichLamViec.save()` thất bại giữa chừng, **toàn bộ rollback**, `NghiPhepBacSi.trang_thai`
cũng KHÔNG bị đổi thành `da_duyet` (vì nằm trong cùng transaction) — **không xảy ra tình trạng dữ liệu
lệch nửa chừng** (đã đọc code xác nhận, `admin/doctor-leaves.controller.js:176-236`).

---

## PHẦN 14 — Danh sách lỗi

> Ghi chú: SYNC-01 (Critical), SYNC-02 (High), LEAVE-01 (Medium) đã được liệt kê và **sửa xong** trong
> phiên làm việc trước cùng ngày — không lặp lại ở đây, xem `docs/doctor-schedule-logic-review.md` §7.
> Danh sách dưới đây là phát hiện **MỚI** từ lần phân tích sâu này.

| Mã | Mức | Mô tả | Vị trí | Nguyên nhân | Ảnh hưởng | Cách tái hiện | Đề xuất sửa |
|---|---|---|---|---|---|---|---|
| **NEW-01** | **High** | Không có giao diện Admin nào để duyệt/từ chối đơn nghỉ | Toàn bộ `frontend/src/pages/admin/`, `frontend/src/services/` | Backend API đã làm xong nhưng chưa có FE tiêu thụ | Admin không có cách chuẩn (ngoài Postman/API trực tiếp) để xử lý đơn nghỉ trong thực tế vận hành | Đăng nhập admin, tìm trang duyệt đơn nghỉ → không có | Xây `frontend/src/pages/admin/ManageDoctorLeaves.tsx` + service tương ứng |
| **NEW-02** | **High** | `formatDoctorLeave` (admin) không trả `gio_bat_dau`/`gio_ket_thuc` | `admin/doctor-leaves.controller.js:11-33` | Thiếu 2 dòng field khi format | Nếu làm NEW-01, Admin không phân biệt được đơn cả ngày/theo ca khi duyệt — hành vi khóa khác nhau hoàn toàn | `GET /admin/doctor-leaves` → response thiếu field | Thêm `gio_bat_dau: leave.gio_bat_dau ?? null, gio_ket_thuc: ...` vào `formatDoctorLeave` |
| **NEW-03** | Medium | Form "Xin nghỉ" (trang riêng) cho nhập giờ tự do, không ràng buộc theo slot thật của bác sĩ | `DoctorLeaveRequests.tsx:36-131` (`CreateLeaveModal`) | Không gọi API lấy slot thật của ngày đã chọn để giới hạn lựa chọn | Có thể tạo đơn cho khung giờ không khớp slot thật nào — khi duyệt, `lockSlotsForLeave` chỉ khóa slot có giao nhau (không lỗi) nhưng có thể khóa nhầm nhiều/ít slot hơn ý định | Chọn "Khung giờ cụ thể", nhập 08:10–08:20 (không khớp slot 30 phút nào tròn) | Đổi UI sang chọn từ danh sách slot thật (tương tự đường vào từ Lịch làm việc) |
| **NEW-04** | Medium | Không kiểm tra giờ (chỉ kiểm tra ngày) khi tạo yêu cầu nghỉ | `doctor/leaves.controller.js:83-87`; `DoctorSchedule.tsx` (`isPastDay` chỉ so ngày) | Thiếu so sánh giờ hiện tại với slot | Có thể gửi yêu cầu nghỉ cho ca đang diễn ra hoặc đã trôi qua trong hôm nay mà không có cảnh báo riêng | Hôm nay, gửi đơn nghỉ khung giờ đã qua trong ngày | Thêm kiểm tra giờ khi `tu_ngay === today` |
| **NEW-05** | Medium | Admin `updateSlot` không kiểm tra `nghi_phep_id`/khóa nghỉ trước khi cho đổi `status` | `admin/slots.controller.js:406-468` | Không có guard chặn ghi đè slot đã bị khóa bởi nghỉ phép | Admin có thể vô tình "mở lại" slot đã khóa hợp lệ mà không cảnh báo, làm mất tác dụng của đơn nghỉ đã duyệt | Duyệt 1 đơn nghỉ theo ca → vào `updateSlot` đổi `status` slot đó về `active` | Cảnh báo hoặc chặn nếu `slot.nghi_phep_id` đang set và không đồng thời clear field đó |
| **NEW-06** | Medium | Không hiển thị số lịch hẹn bị ảnh hưởng TRƯỚC khi gửi yêu cầu (chỉ sau khi gửi thành công) | `DoctorLeaveRequests.tsx` (`CreateLeaveModal`), `DoctorSchedule.tsx:579-634` (leaveDialog) | Không có bước "preview" gọi API đếm trước khi xác nhận | Bác sĩ không biết trước hậu quả trước khi bấm gửi — không đúng yêu cầu "checklist trước khi gửi" | Mở form tạo đơn, quan sát: không có số liệu ảnh hưởng cho tới sau khi submit | Thêm bước xem trước (gọi lại `demLichHenAnhHuong` qua 1 endpoint preview, hoặc tính ở FE nếu đã có dữ liệu lịch hẹn sẵn) |
| **NEW-07** | Medium | Không có notification (ThongBao/FCM/email) cho đơn nghỉ | Toàn bộ `doctor/leaves.controller.js`, `admin/doctor-leaves.controller.js` | Không gọi `ThongBao.create`/FCM/email ở bất kỳ đâu (đã grep xác nhận 0 kết quả) | Admin không biết có đơn mới trừ khi tự vào kiểm tra định kỳ; bác sĩ không biết đơn đã được xử lý trừ khi tự vào lại trang | Tạo đơn nghỉ → không có thông báo nào phát sinh | Thêm `ThongBao.create` (đã có model, dùng ở module khác trong dự án) tại 4 điểm: tạo/duyệt/từ chối/hủy |
| **NEW-08** | Low | Không có audit log (`NhatKyThaoTac`) cho đơn nghỉ | Toàn bộ 2 controller liên quan | Không gọi `NhatKyThaoTac.create` | Không truy vết được lịch sử thao tác qua audit log chung của hệ thống | Grep `NhatKyThaoTac.create` trong 2 file → 0 kết quả | Thêm log ở 4 điểm, dùng `hanh_dong` tự do (không cần đổi schema) |
| **NEW-09** | Low | Không có lịch sử/timeline trạng thái đơn nghỉ | `models/NghiPhepBacSi.js` | Model chỉ lưu snapshot cuối (`nguoi_duyet_id`, `thoi_diem_duyet`) | Không xem được "ai đổi gì lúc nào" ngoài lần xử lý gần nhất | Xem chi tiết 1 đơn đã qua nhiều lần xử lý (không thể vì mỗi đơn chỉ xử lý 1 lần theo state machine hiện tại) — nhưng vẫn thiếu nếu sau này mở rộng | Dùng `NhatKyThaoTac` (giải pháp chung với NEW-08) thay vì thêm mảng vào model |
| **NEW-10** | Low | Trùng tên "nghỉ phép" giữa `BacSi.trang_thai` (cấp bác sĩ) và `LichLamViec.trang_thai_ngay` (cấp ngày) | `models/BacSi.js:38-42`, `models/LichLamViec.js:81-85` | 2 khái niệm độc lập dùng cùng từ tiếng Việt | Rủi ro nhầm lẫn khi maintain code sau này (dễ nhầm tưởng có liên kết) | Đọc code 2 model song song | Ghi chú rõ ràng trong code/tài liệu; cân nhắc đổi tên 1 trong 2 nếu có dịp refactor lớn (không cấp thiết) |
| **NEW-11** | Low | Không có unique index chống tạo trùng đồng thời | `models/NghiPhepBacSi.js:68-69` | Chỉ có index thường phục vụ query, không phải constraint | 2 request gần như đồng thời có thể cả 2 đều vượt qua check "trùng" trước khi insert | Gửi 2 request `POST /doctor/leaves` cùng payload gần như đồng thời (race hẹp) | Cân nhắc partial unique index hoặc lock tầng ứng dụng nếu ưu tiên cao; hiện tại rủi ro thấp vì hậu quả chỉ là 2 đơn hơi chồng, không mất dữ liệu |
| **NEW-12** | Low | `DoctorSlot` (màn tuần) thiếu `bi_khoa_boi_nghi_phep`/`nghi_phep_id` | `types/index.ts:652-680`, `schedule.controller.js:37-58` (`flattenSchedules`) | API danh sách tuần không trả 2 field này (chỉ API chi tiết ngày có) | Bác sĩ ở màn tuần chỉ thấy "Tạm nghỉ" chung, phải mở chi tiết mới rõ nguyên nhân | So sánh response `GET /doctor/schedule` vs `GET /doctor/schedule/:id` | Bổ sung 2 field vào `flattenSchedules()` nếu muốn hiển thị rõ hơn ở màn tuần |
| **LEGACY-DATA** | Thông tin (không phải lỗi code) | 2 đơn `da_duyet` trong seed data cũ chưa từng đồng bộ sang `LichLamViec` | Dữ liệu seed (`seed-all.js`, `seed-doctor-test-data.js`) | Được set thẳng `trang_thai:'da_duyet'` lúc seed, không qua luồng duyệt thật (trước fix SYNC-02) | Dữ liệu demo không nhất quán với logic mới — chỉ ảnh hưởng demo, không ảnh hưởng người dùng thật | Xem `docs/doctor-leave-database-gap-analysis.md` mục B.1 | Không bắt buộc sửa; nếu muốn demo nhất quán, có thể chạy lại logic khóa tương đương cho 2 đơn này (ngoài phạm vi phân tích) |

---

## PHẦN 15 — Test case

| Mã test | Tình huống | Dữ liệu chuẩn bị | Bước thực hiện | Kết quả mong đợi |
|---|---|---|---|---|
| TC-01 | Tạo đơn nghỉ theo ca hợp lệ từ Lịch làm việc | Bác sĩ có ít nhất 1 slot `active` tương lai | Mở Lịch làm việc → bấm "Gửi yêu cầu nghỉ" ở 1 slot → nhập lý do → gửi | `201`, đơn `cho_duyet`, nút gửi ẩn đi cho slot đó |
| TC-02 | Tạo đơn nghỉ cả ngày từ trang Xin nghỉ | Bác sĩ có lịch ngày tương lai | Mở form tạo → chọn "Cả ngày" → nhập lý do → gửi | `201`, `gio_bat_dau=null` |
| TC-03 | Chống trùng — 2 đơn cùng khung giờ | Đã có 1 đơn `cho_duyet` cho slot X | Gửi thêm đơn cho đúng slot X | `409` |
| TC-04 | Không chặn 2 đơn khác khung giờ cùng ngày | Đã có đơn `cho_duyet` cho ca sáng | Gửi thêm đơn cho ca chiều cùng ngày | `201` (LEAVE-01) |
| TC-05 | Cả ngày chặn khi đã có đơn theo ca | Đã có đơn `cho_duyet` cho 1 ca bất kỳ trong ngày | Gửi thêm đơn "Cả ngày" cùng ngày | `409` |
| TC-06 | Ngày quá khứ bị chặn | — | Gửi đơn cho ngày hôm qua | `400` |
| TC-07 | Thiếu lý do bị chặn | — | Gửi đơn không nhập lý do | `400` |
| TC-08 | Hủy đơn đang chờ | Có đơn `cho_duyet` của chính mình | Bấm "Hủy yêu cầu" | `200`, `trang_thai='da_huy'` |
| TC-09 | Không hủy được đơn đã hủy | Đơn đã `da_huy` | Gọi lại cancel | `409` |
| TC-10 | Không hủy được đơn của bác sĩ khác | Đơn thuộc bác sĩ B, đăng nhập bác sĩ A | Gọi cancel với ID đơn của B | `404` |
| TC-11 | Bác sĩ khác không thấy đơn của mình trong danh sách | 2 bác sĩ, mỗi người có đơn riêng | Đăng nhập bác sĩ A, gọi `GET /doctor/leaves` | Chỉ thấy đơn của A |
| TC-12 | Admin duyệt đơn theo ca → chỉ khóa đúng slot | Đơn `cho_duyet` theo ca cụ thể | Gọi `PATCH /admin/doctor-leaves/:id/approve` | `200`, `so_slot_da_khoa>=1`, slot đúng khung giờ chuyển `locked`, slot khác giữ `active` |
| TC-13 | Admin duyệt đơn cả ngày → toàn bộ ngày chuyển nghỉ | Đơn `cho_duyet` cả ngày | Gọi approve | `trang_thai_ngay='nghi_phep'`, `GET /patient/booking/.../slots` trả `[]` cho ngày đó |
| TC-14 | Không duyệt lại đơn đã duyệt | Đơn đã `da_duyet` | Gọi approve lần 2 | `409` |
| TC-15 | Không từ chối đơn đã duyệt | Đơn đã `da_duyet` | Gọi reject | `409` |
| TC-16 | Slot có bệnh nhân không bị khóa khi duyệt nghỉ trùng khung giờ | Slot `booked` trong khoảng nghỉ | Duyệt đơn nghỉ trùng khung giờ đó | Slot vẫn `booked` (không đổi), lịch hẹn xuất hiện trong `lich_hen_can_xu_ly` |
| TC-17 | Bệnh nhân không đặt được slot đã khóa bởi nghỉ phép | Slot đã khóa (từ TC-12) | Gọi `GET`/`POST /patient/booking` cho slot đó | Không xuất hiện ở `GET`; `POST` trả `409` |
| TC-18 | Race — 2 request tạo đơn gần như đồng thời (NEW-11) | — | Gửi 2 `POST /doctor/leaves` cùng payload gần như đồng thời | **[cần kiểm chứng động]** — dự đoán: có thể cả 2 đều `201` (race), cần xác nhận bằng test thật |
| TC-19 | Admin xem đơn không thấy `gio_bat_dau` (NEW-02) | Đơn theo ca | `GET /admin/doctor-leaves` | Response hiện tại **thiếu** field — test này PHẢI FAIL ở trạng thái hiện tại, dùng để xác nhận NEW-02 |
| TC-20 | `updateSlot` ghi đè slot đã khóa nghỉ phép (NEW-05) | Slot đã khóa bởi đơn `da_duyet` | Admin gọi `PATCH /admin/slots/:id/slots/:slotId` với `status:'active'` | Hiện tại: thành công không cảnh báo (xác nhận NEW-05 là gap thật) |

---

## PHẦN 16 — Kế hoạch sửa sau phân tích

> Chỉ liệt kê thứ tự đề xuất — **CHƯA THỰC HIỆN** trong bước phân tích này.

### Bước 1 — Bổ sung field response Admin API (NEW-02)
- **File dự kiến sửa**: `backend/src/controllers/admin/doctor-leaves.controller.js` (`formatDoctorLeave`).
- **File chỉ đọc**: `models/NghiPhepBacSi.js` (xác nhận field đã có sẵn).
- **File không đụng**: mọi file frontend (chưa có UI tiêu thụ nên không có rủi ro breaking change).
- **Mục tiêu**: Admin API trả đủ thông tin để phân biệt cả ngày/theo ca.
- **Rủi ro**: thấp — chỉ thêm field vào response JSON.
- **Kiểm tra sau sửa**: `GET /admin/doctor-leaves` trả `gio_bat_dau`/`gio_ket_thuc` đúng dữ liệu DB.

### Bước 2 — Xây dựng giao diện Admin duyệt/từ chối (NEW-01)
- **File dự kiến tạo**: `frontend/src/pages/admin/ManageDoctorLeaves.tsx`,
  `frontend/src/services/admin-doctor-leave.service.ts`, thêm route + menu admin.
- **File chỉ đọc**: `admin/doctor-leaves.controller.js` (API contract), `ManageDoctorSchedules.tsx`
  (tham khảo pattern UI hiện có cho trang admin lịch làm việc).
- **File không đụng**: toàn bộ code phía bác sĩ.
- **Mục tiêu**: Admin có công cụ thật để duyệt/từ chối, xem `lich_hen_can_xu_ly`.
- **Rủi ro**: trung bình — là trang mới hoàn toàn, cần thiết kế UI/UX riêng (không nằm trong yêu cầu
  chỉ-đọc của phân tích này, cần 1 vòng brainstorm/plan riêng trước khi code).
- **Kiểm tra sau sửa**: luồng duyệt/từ chối hoạt động qua UI thật, không qua Postman.

### Bước 3 — Ràng buộc form "Xin nghỉ" theo slot thật (NEW-03)
- **File dự kiến sửa**: `frontend/src/pages/doctor/DoctorLeaveRequests.tsx` (`CreateLeaveModal`).
- **File chỉ đọc**: `schedule.service.ts` (API lấy lịch thật theo ngày).
- **Mục tiêu**: giảm rủi ro tạo đơn cho khung giờ không khớp slot thật.
- **Rủi ro**: trung bình — đổi UX người dùng đang quen, cần cân nhắc kỹ trước khi làm.
- **Kiểm tra sau sửa**: không nhập được giờ tùy ý ngoài slot có sẵn.

### Bước 4 — Kiểm tra giờ khi tạo/gửi yêu cầu (NEW-04)
- **File dự kiến sửa**: `doctor/leaves.controller.js` (`createLeaveRequest`).
- **Mục tiêu**: chặn/gợi ý rõ khi gửi đơn cho ca đã trôi qua trong hôm nay.
- **Rủi ro**: thấp — chỉ thêm điều kiện validate.

### Bước 5 — Guard `updateSlot` không ghi đè slot đã khóa nghỉ phép (NEW-05)
- **File dự kiến sửa**: `backend/src/controllers/admin/slots.controller.js` (`updateSlot`).
- **Mục tiêu**: tránh Admin vô tình vô hiệu hóa đơn nghỉ đã duyệt.
- **Rủi ro**: trung bình — cần xác định rõ hành vi mong muốn (chặn hẳn hay chỉ cảnh báo) trước khi sửa.

### Bước 6 — Hiển thị cảnh báo trước khi gửi (NEW-06)
- **File dự kiến sửa**: cả 2 form tạo đơn (Bước 3 liên quan).
- **Mục tiêu**: đúng yêu cầu "checklist trước khi gửi" (Phần 11 đề bài).
- **Rủi ro**: thấp — chỉ thêm bước hiển thị, không đổi luồng ghi dữ liệu.

### Bước 7 — Notification (NEW-07)
- **File dự kiến sửa**: cả 4 điểm write (`create`/`approve`/`reject`/`cancel` ở cả 2 controller).
- **File chỉ đọc**: model `ThongBao` để hiểu đúng shape dữ liệu cần tạo.
- **Rủi ro**: trung bình — cần đảm bảo không làm chậm response (nên tạo notification bất đồng bộ hoặc
  trong cùng transaction có kiểm soát).

### Bước 8 — Audit log (NEW-08, NEW-09)
- **File dự kiến sửa**: cả 2 controller, thêm `NhatKyThaoTac.create` ở 4 điểm.
- **Rủi ro**: thấp — insert-only, không ảnh hưởng luồng hiện tại.

### Bước 9 — Viết test cho các case ở Phần 15
- **File dự kiến tạo**: bổ sung vào `backend/tests/doctor.leave-sync.test.js` hoặc file mới, theo
  pattern TDD đã dùng trong phiên trước (RED trước, GREEN sau mỗi bước sửa).

### Bước 10 — Kiểm tra hồi quy
- Chạy lại toàn bộ `npm test` (backend) sau mỗi bước, đảm bảo không phá vỡ 30 test hiện có
  (25 test cũ + 5 test `doctor.leave-sync.test.js` đã thêm hôm nay).

### Bước 11 — Cập nhật tài liệu
- Cập nhật `docs/doctor-schedule-leave-sync-review.md` và tài liệu này sau khi từng bước hoàn tất.

> **Ưu tiên đề xuất cho phạm vi đồ án**: Bước 1 (rẻ, giá trị cao) → Bước 2 (giá trị cao nhất nhưng tốn
> công sức nhất, cần brainstorm riêng) → Bước 6 → Bước 4/5 → còn lại tùy thời gian còn lại của đồ án.

---

## KẾT LUẬN BẮT BUỘC

**1. Chức năng Xin nghỉ hiện tại đã đủ dùng chưa?**
**Chưa đủ cho toàn bộ vòng đời nghiệp vụ** — phía bác sĩ (tạo/xem/hủy) đã đủ dùng và đúng, nhưng phía
Admin (duyệt/từ chối) **không có giao diện**, chỉ có API (NEW-01). Không có UI thì quy trình không thể
hoàn tất trong thực tế vận hành, dù backend đã sẵn sàng.

**2. Nghỉ cả ngày có hoạt động độc lập và đúng logic không?**
**Có**, đã xác nhận bằng code (`lockSlotsForLeave`, `admin/doctor-leaves.controller.js:63-99`) và test
tích hợp thật (`backend/tests/doctor.leave-sync.test.js`, test "Duyet nghi ca ngay").

**3. Nghỉ theo ca có xác định đúng ca không?**
**Đúng khi đi từ Lịch làm việc** (slot thật). **Không đảm bảo khi đi từ form Xin nghỉ riêng** (nhập giờ
tự do, NEW-03) — đây là điểm cần lưu ý nhất về tính chính xác của "ca".

**4. Hai loại nghỉ có bị chồng lấn hoặc tạo trùng không?**
**Không**, đã sửa và xác nhận bằng test (`doctor/leaves.controller.js:92-109`, LEAVE-01) — chống trùng
theo khung giờ giao nhau, cả ngày luôn coi là trùng với bất kỳ đơn nào khác cùng khoảng ngày.

**5. Yêu cầu nghỉ đã tương tác đúng với Lịch làm việc chưa?**
**Đúng, từ hôm nay** (SYNC-02) — trước đó (dữ liệu seed cũ, xem mục B.1 gap analysis) hoàn toàn không
đồng bộ. Hiện tại đã có test tích hợp thật xác nhận.

**6. Yêu cầu nghỉ đã tương tác đúng với Lịch hẹn chưa?**
**Đúng về nguyên tắc "không tự đụng"** — liệt kê chính xác lịch hẹn bị ảnh hưởng, không tự hủy/sửa. Tuy
nhiên **không có nơi nào ở Admin để thực sự xử lý tiếp** các lịch hẹn đó một cách có liên kết (phải tự
tra thủ công ở module Quản lý lịch hẹn riêng) — vì NEW-01.

**7. Có trường hợp được duyệt nghỉ nhưng bệnh nhân vẫn đặt lịch được không?**
**Không, từ hôm nay** — đã xác nhận bằng test tích hợp thật (cả `getSlots` và `createBooking`, kể cả
tình huống dữ liệu không nhất quán giả lập). **Có, đối với 2 đơn `da_duyet` cũ trong dữ liệu seed**
(trước fix) — đã ghi nhận cụ thể ở `docs/doctor-leave-database-gap-analysis.md` mục B.1, là dữ liệu
demo không phải người dùng thật.

**8. Có trường hợp lịch hẹn bị mất hoặc bị hủy âm thầm không?**
**Không** — đã đọc toàn bộ `lockSlotsForLeave`/`findAffectedAppointments`, xác nhận không có lệnh ghi
nào lên `LichHen` trong toàn bộ luồng nghỉ phép.

**9. Bác sĩ có thể thao tác vượt quyền không?**
**Không** — mọi truy vấn phía bác sĩ đều ràng buộc `bac_si_id` suy từ token, đã kiểm tra toàn bộ 3 hàm
trong `doctor/leaves.controller.js`, không phát hiện lỗ hổng.

**10. Database có đủ dữ liệu để hoàn thiện chức năng không?**
**Đủ cho chức năng cốt lõi** — không cần field mới bắt buộc. Các khoảng trống (lịch sử/audit,
notification) giải quyết được ở tầng backend/frontend, không cần đổi schema (xem gap analysis mục C).

**11. Phần nào cần sửa ngay?**
NEW-02 (rẻ, chặn khả năng làm đúng NEW-01 sau này) và NEW-01 (giá trị nghiệp vụ cao nhất — không có
UI Admin thì toàn bộ luồng duyệt/từ chối không dùng được trong thực tế).

**12. Phần nào có thể để sau?**
NEW-07, NEW-08, NEW-09 (notification/audit/lịch sử — "nên có", không chặn luồng chính); NEW-10, NEW-11
(rủi ro thấp, ít khi xảy ra trong quy mô đồ án).

**13. Phạm vi tối thiểu nào phù hợp để bảo vệ đồ án?**
Tối thiểu nên có: (a) Bước 1 (NEW-02, rẻ) + (b) Bước 2 (NEW-01, Admin UI cơ bản: danh sách + duyệt +
từ chối, không cần làm đẹp) để **chứng minh được toàn bộ vòng đời** "tạo → duyệt/từ chối → đồng bộ
lịch làm việc → chặn đặt lịch bệnh nhân" **qua giao diện thật**, không chỉ qua API — đây là phần giám
khảo dễ kiểm tra trực quan nhất và hiện là khoảng trống lớn nhất.

> **Xác nhận cuối cùng**: Chưa sửa frontend, backend, database, model trong bước phân tích này. Chưa
> chạy seed/migration. Chưa tạo dữ liệu giả — mọi số liệu dẫn chứng đọc trực tiếp từ MongoDB Cloud thật
> (đã minh bạch phân biệt dữ liệu seed thật với artifact do phiên làm việc hôm nay tạo ra). 2 tài liệu
> đầu ra: tài liệu này và `docs/doctor-leave-database-gap-analysis.md`.
