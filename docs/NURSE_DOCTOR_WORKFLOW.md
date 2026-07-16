# VitaFamily — Phân tích & Thiết kế luồng Y tá ↔ Bác sĩ

> Tài liệu phân tích nghiệp vụ + kiến trúc cho vai trò **Y tá (Nurse)**, mối quan hệ với **Bác sĩ**,
> lịch làm việc, lịch hẹn, hồ sơ khám, đơn thuốc, dịch vụ cộng thêm.
> **Đây là tài liệu THIẾT KẾ — chưa đụng code.** Phần 17–18 là checklist/kế hoạch cho bước sau.
>
> Cập nhật: 2026-07-10 · Phạm vi: vai trò `nurse` (đã có trong enum `NguoiDung.role` nhưng chưa triển khai)
> Trạng thái legend: ✅ Đã có trong code | ⚠️ Có nhưng chưa đủ | ❌ Chưa có — cần tạo mới

---

## Mục lục

1. [Tổng quan vai trò y tá](#1-tổng-quan-vai-trò-y-tá)
2. [Có nên làm trang y tá riêng?](#2-có-nên-làm-trang-y-tá-riêng)
3. [Quan hệ Y tá – Bác sĩ – Lịch làm việc – Lịch hẹn – Hồ sơ khám](#3-quan-hệ-đúng-giữa-các-entity)
4. [Luồng phân công y tá cho bác sĩ](#4-luồng-phân-công-y-tá-cho-bác-sĩ)
5. [Y tá có cần chia chuyên khoa?](#5-y-tá-có-cần-chia-chuyên-khoa)
6. [Luồng làm việc trong ngày của y tá](#6-luồng-làm-việc-trong-ngày-của-y-tá)
7. [Luồng làm việc của bác sĩ liên quan y tá](#7-luồng-làm-việc-của-bác-sĩ-liên-quan-y-tá)
8. [Trạng thái Appointment (LichHen)](#8-trạng-thái-appointment-lichhen)
9. [Trạng thái MedicalRecord (KetQuaKham)](#9-trạng-thái-medicalrecord-ketquakham)
10. [Database/model đề xuất](#10-databasemodel-đề-xuất)
11. [API cho Nurse Portal](#11-api-cho-nurse-portal)
12. [API cho Doctor Portal (phần liên quan y tá)](#12-api-cho-doctor-portal-phần-liên-quan-y-tá)
13. [Giao diện frontend cần có](#13-giao-diện-frontend-cần-có)
14. [Phân quyền chi tiết theo actor](#14-phân-quyền-chi-tiết-theo-actor)
15. [Validation backend bắt buộc](#15-validation-backend-bắt-buộc)
16. [Lỗi nghiệp vụ cần tránh](#16-lỗi-nghiệp-vụ-cần-tránh)
17. [Checklist đối chiếu với code hiện tại](#17-checklist-đối-chiếu-với-code-hiện-tại)
18. [Kế hoạch sửa code từng bước](#18-kế-hoạch-sửa-code-từng-bước)

---

## 1. Tổng quan vai trò y tá

Y tá là **người hỗ trợ vận hành**, không phải người ra quyết định chuyên môn:

- Check-in bệnh nhân khi đến phòng khám.
- Nhập liệu: sinh hiệu, triệu chứng, đơn thuốc, dịch vụ cộng thêm theo **chỉ định của bác sĩ**.
- Gửi hồ sơ cho bác sĩ xác nhận — không tự "chốt" hồ sơ.

Bác sĩ giữ vai trò **chịu trách nhiệm chuyên môn cuối cùng**: chẩn đoán, kết luận, xác nhận hoặc yêu cầu y tá chỉnh sửa. Hồ sơ **chỉ hoàn tất khi bác sĩ xác nhận** — đây là ràng buộc xuyên suốt toàn bộ thiết kế.

Quan trọng khi đối chiếu với code hiện tại: `NguoiDung.role` **đã có** giá trị `'nurse'` (và cả `'receptionist'`) trong enum (`backend/src/models/NguoiDung.js:29`), nhưng **chưa có bất kỳ model, controller, route nào dùng đến** vai trò này. Toàn bộ luồng nhập kết quả khám hiện tại (`backend/src/controllers/doctor/appointments.controller.js`) đang do **bác sĩ tự nhập trực tiếp** (`chan_doan`, `huong_dan_dieu_tri`, `ghi_chu`, `thuoc`) — chưa có bước "y tá nhập → bác sĩ xác nhận" nào tách rời. Đây là khoảng trống chính cần lấp.

---

## 2. Có nên làm trang y tá riêng?

**Có — bắt buộc.** Không dùng chung trang bác sĩ.

**Vì sao không dùng chung trang bác sĩ:**
- Bác sĩ cần thấy *chuyên môn* (chẩn đoán, kết luận, xác nhận). Y tá cần thấy *vận hành* (check-in, nhập liệu). Trộn hai luồng vào một UI sẽ khiến nút hành động hiển thị sai trạng thái, dễ bấm nhầm quyền.
- `requireRole('doctor')` hiện đang chặn cứng ở `backend/src/routes/doctor/index.js:15` — nếu để y tá dùng chung route bác sĩ thì phải nới lỏng middleware này, phá vỡ ranh giới phân quyền đang rất chặt của dự án.
- Nếu không tách: y tá sẽ có toàn quyền như bác sĩ trên UI (xác nhận hồ sơ, xem hồ sơ bác sĩ khác) → sai nghiêm trọng nghiệp vụ ở mục 16.

**Vì sao y tá cần tài khoản riêng:** để `verifyToken` lấy đúng `nurse_id` từ token, không tin `nurseId` gửi từ body/FE (xem mục 15). Không có tài khoản riêng thì không thể ghi nhận "ai nhập, ai sửa" — mất khả năng audit hồ sơ.

**Mức độ tối giản phù hợp đồ án:** Nurse Portal chỉ cần 4 màn hình (Dashboard, Schedules, Appointments, Medical Record Form) — xem mục 13. Không cần thêm nhắn tin nội bộ, không cần thống kê cá nhân, không cần quản lý ca của chính mình (đó là việc của admin).

**Bắt buộc có:**
- Dashboard xem ca hôm nay + số liệu nhanh.
- Danh sách lịch hẹn theo ca được gán.
- Check-in bệnh nhân.
- Form nhập/sửa hồ sơ khám gắn với `appointmentId`.
- Gửi hồ sơ cho bác sĩ xác nhận + xem hồ sơ bị yêu cầu sửa.

**Không nên làm (tránh phình phạm vi đồ án):**
- Y tá tự đăng ký/tự sửa hồ sơ cá nhân chuyên môn (đó là việc admin duyệt, giống bác sĩ).
- Y tá nhắn tin trực tiếp với bệnh nhân.
- Thống kê/báo cáo hiệu suất y tá.
- Y tá tự chọn ca làm hoặc tự đổi ca (chỉ admin gán).
- Y tá thao tác thanh toán/hoá đơn.

---

## 3. Quan hệ đúng giữa các entity

```
BacSi (Doctor)
  └─ LichLamViec (DoctorSchedule) 1 bản ghi / bác sĩ / ngày, chứa slots[]
        └─ nurse_id  ← Y TÁ ĐƯỢC GÁN Ở ĐÂY (theo ca/ngày), KHÔNG gán cố định vào BacSi
              └─ LichHen (Appointment) — tham chiếu slot_id + copy nurse_id để giữ lịch sử
                    └─ KetQuaKham (MedicalRecord) — do nurse_id của lịch hẹn đó nhập
```

Nguyên tắc cốt lõi:

- **Y tá không gắn cố định vào Doctor.** Không thêm `nurse_id` vào model `BacSi`. Nếu làm vậy, đổi y tá mỗi ngày sẽ phải sửa hồ sơ bác sĩ — sai bản chất (y tá là quan hệ theo *ca làm việc*, không phải quan hệ tĩnh).
- **Y tá gán theo ca của `LichLamViec`**, không phải theo bác sĩ nói chung. Một bác sĩ có thể làm với y tá A hôm nay, y tá B ngày mai.
- **Một y tá có thể hỗ trợ nhiều bác sĩ** ở các ca khác nhau, miễn không trùng thời gian (kiểm tra ở mục 4).
- **`LichHen` (Appointment) nên có thêm `nurse_id`** copy từ `LichLamViec.nurse_id` tại thời điểm đặt lịch — để giữ lịch sử đúng (nếu sau này đổi y tá của ca đó, các lịch hẹn *đã tạo trước* vẫn giữ nguyên y tá phụ trách ban đầu, tránh sai lệch truy vết ai đã nhập hồ sơ).

**Khoảng trống hiện tại:** `LichLamViec` (`backend/src/models/LichLamViec.js`) hiện có `doctor_id`, `chi_nhanh_id`, `ngay`, `slots[]` — **không có `nurse_id`** ở bất kỳ cấp nào. `LichHen` (`backend/src/models/LichHen.js`) cũng **không có `nurse_id`**. Đây là field bắt buộc phải thêm (mục 10, 17).

**Lưu ý về "phòng":** Model hiện tại **không có FK phòng** thật sự — `LichLamViec.slots[].phong_kham` và `LichHen.phong_kham` chỉ là `String` tự do, không tham chiếu model `PhongKham`. Nghĩa là hiện tại **không có cơ chế chống trùng phòng** ở tầng dữ liệu — đây là gap cần lưu ý riêng, không thuộc phạm vi y tá nhưng ảnh hưởng đến ràng buộc "không được 2 bác sĩ dùng chung phòng cùng giờ" ở mục 4 (xem mục 17, GAP-ROOM).

---

## 4. Luồng phân công y tá cho bác sĩ

```
Admin đăng nhập
→ Quản lý lịch làm việc bác sĩ (đã có: LichLamViec theo doctor_id + ngay)
→ Chọn bác sĩ → chọn ngày → (chọn ca nếu tách sáng/chiều) → chọn phòng
→ Chọn y tá hỗ trợ
→ Backend kiểm tra ràng buộc trùng lịch
→ Nếu hợp lệ → lưu nurse_id vào LichLamViec (và copy sang LichHen khi đặt lịch)
```

**Ràng buộc bắt buộc kiểm tra ở backend (không chỉ FE):**

| # | Ràng buộc | Cách kiểm tra |
|---|---|---|
| 1 | Y tá không bị gán 2 bác sĩ trùng thời gian | Query `LichLamViec` khác có cùng `nurse_id`, overlap khoảng `[ngay + slot time range]` |
| 2 | Bác sĩ không có 2 ca trùng giờ | Đã có index unique `{doctor_id, ngay}` (`LichLamViec.js:82`) — nhưng đây là unique theo **ngày**, không theo **ca giờ**; nếu tách ca sáng/chiều trong cùng 1 ngày cần bổ sung kiểm tra overlap theo giờ, không dựa vào unique index ngày. |
| 3 | Phòng không bị 2 bác sĩ dùng trùng giờ | Hiện **chưa có FK phòng** thật (mục 3) → cần thêm `phong_kham_id` ref `PhongKham` trước khi làm được kiểm tra này đúng nghĩa. |
| 4 | Y tá không được gán khi đang nghỉ phép/khóa | Có thể tái dùng cơ chế `NghiPhepBacSi` (đổi tên/tổng quát hoá) hoặc thêm bảng nghỉ phép riêng cho y tá — **không bắt buộc cho đồ án**, có thể bỏ qua nếu không có yêu cầu nghỉ phép y tá. |

**Đề xuất mức đơn giản cho đồ án:** `LichLamViec` giữ nguyên granularity theo **ngày** (đúng cấu trúc hiện tại: 1 bản ghi/bác sĩ/ngày chứa `slots[]`), thêm 1 field `nurse_id` **ở cấp document** (1 y tá phụ trách cả ngày làm việc của bác sĩ đó). Đây là phương án khớp nhất với schema hiện tại, không cần refactor `LichLamViec` thành theo-ca.

Nếu nhóm thực sự cần 1 y tá sáng / 1 y tá khác buổi chiều, phương án mở rộng là thêm mảng `ca_nurses: [{ ca: 'sang'|'chieu', nurse_id }]` — nhưng nên **để dành cho v2**, không làm ngay vì `slots[]` hiện không có field `ca` để nhóm theo buổi.

---

## 5. Y tá có cần chia chuyên khoa?

| | Phương án 1 — Hỗ trợ chung | Phương án 2 — `specialty_ids` |
|---|---|---|
| Ưu điểm | Đơn giản, không cần lọc, đủ cho đồ án | Sát thực tế bệnh viện lớn, lọc y tá phù hợp chuyên khoa |
| Nhược điểm | Không phân biệt y tá chuyên khoa sâu (vd. Nhi, Sản) | Tăng độ phức tạp UI chọn y tá + validate ở admin |
| Độ khó triển khai | Thấp — chỉ cần `nurse_id` đơn | Trung bình — thêm field mảng + lọc theo `ChuyenKhoa` khi admin gán |
| Phù hợp đồ án | ✅ Rất phù hợp | Không cần thiết ở giai đoạn này |

**Khuyến nghị: chọn Phương án 1** cho hiện tại. Model `NhanVienYTe`/`YTa` vẫn nên có field `specialty_ids: [ObjectId] (optional, default [])` **để dành chỗ** — không dùng để lọc bắt buộc, chỉ hiển thị tham khảo. Khi mở rộng thật (v2), thêm logic lọc dropdown y tá theo `specialty_id` của bác sĩ tại màn hình admin gán ca — không cần đổi schema, chỉ đổi query.

---

## 6. Luồng làm việc trong ngày của y tá

```
Đăng nhập → Dashboard
  → Ca hôm nay: bác sĩ nào, chuyên khoa, phòng, giờ bắt đầu/kết thúc
  → Số bệnh nhân trong ca / chờ check-in / chờ nhập hồ sơ / hồ sơ bị yêu cầu sửa
→ Danh sách lịch hẹn của ca (GET /nurse/appointments?scheduleId=...)
→ Bệnh nhân đến → bấm Check-in (CONFIRMED → CHECKED_IN)
→ (Bác sĩ khám — y tá không thao tác trong lúc này)
→ Bác sĩ kết thúc khám → lịch hẹn WAITING_RECORD
→ Y tá mở "Nhập hồ sơ" (form khoá theo appointmentId)
   → Nhập sinh hiệu, triệu chứng, đơn thuốc, dịch vụ cộng thêm theo chỉ định bác sĩ
   → Lưu nháp (tuỳ chọn) hoặc Gửi bác sĩ xác nhận
→ WAITING_DOCTOR_CONFIRM
→ Nếu bác sĩ yêu cầu sửa → NEED_REVISION → y tá sửa lại → gửi lại
→ Bác sĩ xác nhận → COMPLETED
```

**Dashboard y tá cần hiển thị đúng những gì đề bài yêu cầu** — không thêm, không bớt:

Tên y tá · ngày hiện tại · ca làm hôm nay · bác sĩ phụ trách từng ca · chuyên khoa bác sĩ · phòng khám · giờ bắt đầu/kết thúc ca · số bệnh nhân trong ca · số chờ check-in · số chờ nhập hồ sơ · số hồ sơ bị yêu cầu chỉnh sửa.

---

## 7. Luồng làm việc của bác sĩ liên quan y tá

```
Đăng nhập → Lịch làm việc hôm nay (biết y tá nào hỗ trợ ca này)
→ Danh sách bệnh nhân (đã check-in bởi y tá)
→ Bấm "Bắt đầu khám" (CHECKED_IN → IN_PROGRESS)
→ Bấm "Kết thúc khám" (IN_PROGRESS → WAITING_RECORD)
→ (Y tá nhập hồ sơ)
→ Bác sĩ xem hồ sơ y tá gửi (WAITING_DOCTOR_CONFIRM)
→ Xác nhận → COMPLETED  |  Yêu cầu sửa → NEED_REVISION (kèm doctor_revision_note)
```

**Bác sĩ tuyệt đối không được** (đối chiếu mục 16): tự gán/đổi y tá, tự sửa phòng, tự sửa dịch vụ/giá/thanh toán, tự nhập thay toàn bộ hồ sơ nếu quy định là y tá nhập, xem lịch/hồ sơ của bác sĩ khác. Middleware `requireRole('doctor')` + lọc `doctor_id` từ token (đã làm đúng ở `getDocId(req.user.id)` trong `appointments.controller.js:11`) là mẫu đúng cần lặp lại cho `nurse`.

---

## 8. Trạng thái Appointment (LichHen)

**Enum hiện tại** (`LichHen.js:44`): `pending, confirmed, checked_in, in_progress, completed, cancelled, no_show`.

**Enum cần có theo thiết kế y tá–bác sĩ:** thêm `waiting_record` và `waiting_doctor_confirm` xen giữa `in_progress` và `completed`:

```
pending → confirmed → checked_in → in_progress
        → waiting_record → waiting_doctor_confirm → completed
(nhánh phụ: cancelled, no_show — chỉ xem, không sửa tuỳ tiện)
```

| Chuyển trạng thái | Ai thực hiện |
|---|---|
| `confirmed → checked_in` | Y tá |
| `checked_in → in_progress` | Bác sĩ |
| `in_progress → waiting_record` | Bác sĩ (bấm "kết thúc khám") |
| `waiting_record → waiting_doctor_confirm` | Y tá (sau khi nhập hồ sơ, bấm "gửi bác sĩ") |
| `waiting_doctor_confirm → completed` | Bác sĩ (xác nhận hồ sơ) |
| `waiting_doctor_confirm → (hồ sơ) need_revision` | Bác sĩ (yêu cầu sửa — **không** lùi `Appointment.status`, chỉ đổi `KetQuaKham.status`, xem mục 9) |
| `completed / cancelled / no_show` | Chỉ xem |

Nút hành động trên UI **phải** ẩn/hiện theo đúng trạng thái hiện tại — không hiển thị tất cả nút cùng lúc (đối chiếu mục 16).

---

## 9. Trạng thái MedicalRecord (KetQuaKham)

Model `KetQuaKham` (`backend/src/models/KetQuaKham.js`) **đã tồn tại và đã rất gần** với thiết kế mong muốn:

- ✅ `status: enum ['cho_xac_nhan', 'da_xac_nhan', 'yeu_cau_chinh_sua']` — tương đương `WAITING_DOCTOR_CONFIRM / CONFIRMED / NEED_REVISION`.
- ✅ `lich_su_sua[]` (mảng lịch sử sửa, có `nguoi_sua_id`, `thoi_diem_sua`, `noi_dung`) — tương đương cơ chế lưu vết chỉnh sửa.
- ✅ `co_the_sua: Boolean` — cờ khoá sửa khi đã `da_xac_nhan`.
- ✅ `nguoi_nhap_id`, `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan`, `bac_si_phu_trach_id`.
- ✅ `dich_vu_phat_sinh[]`, `dich_vu_tu_choi[]` (dịch vụ cộng thêm / bị từ chối).

**Khoảng trống so với thiết kế:**

- ❌ **Không có state `DRAFT`** — comment trong code (`KetQuaKham.js:49-50`) nói rõ "mọi hồ sơ mới tạo đều `cho_xac_nhan`" — tức là hiện tại **không có bước lưu nháp**, tạo là gửi luôn. Thiết kế y tá cần bước `DRAFT` (lưu nháp) trước khi "Gửi bác sĩ xác nhận" — cần thêm giá trị `nhap_nhap`/`draft` vào enum + endpoint `submit` riêng.
- ⚠️ `nguoi_nhap_id` là `ref: 'NguoiDung'` chung chung — **không ép buộc** đây phải là y tá đúng ca. Cần thêm validation ở tầng controller (không phải schema): so khớp `nguoi_nhap_id` với `nurse_id` của `LichHen` tương ứng.
- ⚠️ `dich_vu_phat_sinh`/`dich_vu_tu_choi` là `Mixed` (không gõ kiểu) — thiết kế mong muốn mỗi dòng dịch vụ có `service_id, quantity, price, requested_by_doctor_id, added_by_nurse_id, status`. Nên định nghĩa sub-schema thay vì `Mixed` để tránh nhập sai kiểu dữ liệu.
- ❌ Hiện tại **bác sĩ là người tạo/sửa `chan_doan`, `huong_dan_dieu_tri`, `ghi_chu`, `thuoc` trực tiếp** (`doctor/appointments.controller.js:227,280`) — chưa có tách bạch "y tá nhập phần vận hành, bác sĩ nhập phần chẩn đoán/kết luận". Cần làm rõ trong bước triển khai: những field nào bác sĩ tự nhập (chẩn đoán, kết luận, chỉ định) và field nào y tá nhập hộ theo chỉ định (sinh hiệu, đơn thuốc do bác sĩ đọc, dịch vụ cộng thêm).

**Luồng chuẩn hoá đề xuất** (không đổi field, chỉ thêm state + tách quyền ghi theo field):

```
Y tá tạo hồ sơ (DRAFT, tự do sửa)
→ Gửi bác sĩ (WAITING_DOCTOR_CONFIRM) — khoá field y tá đã nhập, không cho sửa tự do nữa
→ Bác sĩ xem, bổ sung chẩn đoán/kết luận/chỉ định
→ Xác nhận (CONFIRMED) → Appointment.status = completed
→ Hoặc Yêu cầu sửa (NEED_REVISION) + doctor_revision_note (map field ghi_chu hiện có, hoặc thêm field riêng)
→ Y tá sửa (co_the_sua=true) → Gửi lại (WAITING_DOCTOR_CONFIRM)
```

---

## 10. Database/model đề xuất

### 10.1 Model mới: `YTa` (Nurse) — ❌ chưa có, cần tạo

Đặt tên theo convention tiếng Việt của dự án (khớp `BacSi.js`):

```js
// backend/src/models/YTa.js
{
  user_id:        ObjectId ref 'NguoiDung', required, unique   // bắt buộc, unique
  chi_nhanh_id:   ObjectId ref 'ThongTinPhongKham', default null
  specialty_ids:  [ObjectId] ref 'ChuyenKhoa', default []      // optional — xem mục 5
  trang_thai:     enum ['active', 'nghi_phep', 'nghi_viec'], default 'active'
  status:         enum ['active', 'locked'], default 'active'  // khớp pattern BacSi.trang_thai_duyet? Không cần duyệt như bác sĩ — y tá do admin tạo trực tiếp, không tự đăng ký
}
```
Index: `{ user_id: 1 }` unique, `{ trang_thai: 1 }`.

Khác biệt quan trọng với `BacSi`: **y tá không cần `trang_thai_duyet` (pending/approved/rejected)** vì y tá không tự đăng ký — admin tạo tài khoản trực tiếp (giống cách tạo admin), nên bỏ hẳn luồng duyệt hồ sơ khỏi model này để tránh copy thừa từ `BacSi`.

### 10.2 `LichLamViec` (DoctorSchedule) — ⚠️ cần bổ sung field

Thêm vào file hiện có (`backend/src/models/LichLamViec.js`):

```js
nurse_id: { type: ObjectId, ref: 'YTa', default: null }   // ở cấp document (mục 4)
```

Không cần đổi cấu trúc `slots[]`.

### 10.3 `LichHen` (Appointment) — ⚠️ cần bổ sung field

Thêm vào `backend/src/models/LichHen.js`:

```js
nurse_id: { type: ObjectId, ref: 'YTa', default: null }   // copy từ LichLamViec tại thời điểm đặt lịch — giữ lịch sử
```

Thêm 2 giá trị vào enum `status`: `'waiting_record'`, `'waiting_doctor_confirm'` (mục 8). Thêm index `{ nurse_id: 1, status: 1 }` để y tá query nhanh danh sách của mình.

### 10.4 `KetQuaKham` (MedicalRecord) — ⚠️ điều chỉnh nhỏ

- Thêm giá trị `'nhap_nhap'` (draft) vào đầu enum `status`.
- Thêm field `doctor_revision_note` tường minh (hiện đang dùng chung `ghi_chu` — nên tách để không lẫn ghi chú chuyên môn với ghi chú yêu cầu sửa).
- Đổi `dich_vu_phat_sinh`/`dich_vu_tu_choi` từ `Mixed` sang sub-schema có `service_id (ref DichVu), so_luong, gia, ghi_chu, chi_dinh_boi_bac_si_id, them_boi_y_ta_id, status`.
- `nguoi_nhap_id` giữ nguyên `ref NguoiDung` (đúng vì y tá là `NguoiDung` có `role='nurse'`) — validate ở controller, không ở schema.

### 10.5 Field bắt buộc / optional / index — tổng hợp

| Model | Field | Bắt buộc? | Index/Unique |
|---|---|---|---|
| `YTa` | `user_id` | ✅ required | unique |
| `LichLamViec` | `nurse_id` | optional (ca có thể chưa gán y tá) | `{doctor_id, ngay}` unique đã có; thêm `{nurse_id, ngay}` |
| `LichHen` | `nurse_id` | optional (giữ lịch sử) | `{nurse_id, status}` |
| `KetQuaKham` | `appointment_id` | ✅ required, đã unique | giữ nguyên |
| `KetQuaKham` | `nguoi_nhap_id` | ✅ required khi tạo (hiện `default: null` — nên siết `required` khi status ≠ draft) | — |

---

## 11. API cho Nurse Portal

Tất cả route dưới `verifyToken, requireRole('nurse')`, theo đúng pattern `backend/src/routes/doctor/index.js`.

| API | Mục đích | Điều kiện trước | Trạng thái sau | Backend phải kiểm tra | Lỗi |
|---|---|---|---|---|---|
| `GET /nurse/dashboard` | Số liệu tổng quan hôm nay | — | — | `nurse_id` lấy từ token | 401 |
| `GET /nurse/schedules?date=` | Ca làm của y tá | — | — | Lọc `LichLamViec.nurse_id = token` | 401 |
| `GET /nurse/appointments?date=&scheduleId=&status=` | DS lịch hẹn của ca | ca thuộc y tá này | — | `nurse_id` khớp | 403 nếu `scheduleId` không thuộc y tá |
| `GET /nurse/appointments/:id` | Chi tiết lịch hẹn | lịch hẹn có `nurse_id = token` | — | 404 nếu không tồn tại, 403 nếu không thuộc y tá | 403, 404 |
| `PATCH /nurse/appointments/:id/check-in` | Check-in bệnh nhân | `status = confirmed` | `status = checked_in` | đúng y tá phụ trách + đúng trạng thái | 403, 409 (sai trạng thái) |
| `POST /nurse/appointments/:id/medical-record` | Tạo hồ sơ (draft) | `status = waiting_record` hoặc hồ sơ đang `NEED_REVISION` | `KetQuaKham.status = draft` | không tạo 2 hồ sơ/1 appointment (409 nếu đã có) | 400, 403, 404, 409 |
| `PATCH /nurse/medical-records/:id` | Cập nhật hồ sơ (còn sửa được) | `co_the_sua = true` | giữ nguyên status | không cho sửa nếu `da_xac_nhan` | 403, 409 |
| `PATCH /nurse/medical-records/:id/submit` | Gửi bác sĩ xác nhận | có đủ field bắt buộc (chẩn đoán tối thiểu) | `status = cho_xac_nhan`, `Appointment.status = waiting_doctor_confirm` | validate field bắt buộc | 400, 409 |
| `GET /nurse/medical-records/revision` | DS hồ sơ bị yêu cầu sửa | — | — | lọc theo `nurse_id` + `status = yeu_cau_chinh_sua` | 401 |

**Response nên trả về** cho các API danh sách/chi tiết: thông tin bệnh nhân + bác sĩ + phòng + ca **đã join sẵn từ backend** (không để FE tự ghép) — đúng yêu cầu chống nhập sai ở mục 15.

---

## 12. API cho Doctor Portal (phần liên quan y tá)

Các endpoint dưới đã có khung sườn tương tự trong `backend/src/controllers/doctor/appointments.controller.js` (case `confirm` đã đúng pattern lấy `docId` từ token — tái dùng pattern này):

| API | Mục đích | Ghi chú đối chiếu code hiện tại |
|---|---|---|
| `PATCH /doctor/appointments/:id/start` | `checked_in → in_progress` | ❌ chưa có, cần thêm |
| `PATCH /doctor/appointments/:id/finish-exam` | `in_progress → waiting_record` | ❌ chưa có |
| `GET /doctor/medical-records/pending` | DS hồ sơ y tá gửi, chờ xác nhận | ❌ chưa có, nhưng `formatAppointment()` đã có sẵn `ket_qua_status` — tái dùng được |
| `GET /doctor/medical-records/:id` | Xem chi tiết hồ sơ | ⚠️ đã có đọc `KetQuaKham` rải rác, cần route riêng |
| `PATCH /doctor/medical-records/:id/confirm` | Xác nhận hồ sơ → `Appointment.status = completed` | ⚠️ hiện bác sĩ tự sửa hồ sơ trực tiếp (dòng 280) — cần tách thành 2 hành động: sửa nội dung chuyên môn vs. xác nhận |
| `PATCH /doctor/medical-records/:id/request-revision` | Yêu cầu sửa + `doctor_revision_note` | ❌ chưa có |

**Bắt buộc:** mọi endpoint đều lấy `doctor_id` qua `getDocId(req.user.id)` (đã có helper sẵn, dòng 11-14) — **không** nhận `doctorId` từ body/param. Nếu `appointmentId` không thuộc bác sĩ đang đăng nhập → 403 (pattern này **đã đúng** trong `getById`/`confirm` hiện tại, chỉ cần lặp lại cho các endpoint mới).

---

## 13. Giao diện frontend cần có

**Nurse Portal** (theo cấu trúc `frontend/src/pages/`, tương tự cách `pages/admin` tổ chức — nhưng **không dùng chung layout Admin**, cần `NurseLayout` riêng hoặc tái dùng `ClientLayout` với sidebar riêng):

1. `NurseDashboard` — ca hôm nay, bác sĩ hỗ trợ, phòng, số liệu (mục 6).
2. `NurseSchedules` — danh sách ca, lọc ngày/tuần, bấm vào ca → xem bệnh nhân.
3. `NurseAppointments` — bảng: mã lịch hẹn, giờ, bệnh nhân, tuổi, bác sĩ, chuyên khoa, phòng, dịch vụ, trạng thái, **nút hành động theo trạng thái** (không hiển thị tất cả nút).
4. `NurseAppointmentDetail` — thông tin bệnh nhân/bác sĩ/phòng/ca, lý do khám, trạng thái, hồ sơ nếu có, nút Check-in hoặc Nhập hồ sơ **chỉ hiện khi đúng trạng thái**.
5. `MedicalRecordForm` — **khung thông tin lịch hẹn cố định, chỉ đọc, ở đầu form** (mã lịch hẹn, tên bệnh nhân, ngày sinh/tuổi, SĐT, bác sĩ, chuyên khoa, phòng, giờ khám, dịch vụ, trạng thái) + các form con (sinh hiệu, triệu chứng, chẩn đoán/kết luận — chỉ đọc nếu là phần bác sĩ nhập, đơn thuốc, dịch vụ cộng thêm, tái khám) + nút Lưu nháp / Gửi bác sĩ xác nhận + hiển thị `doctor_revision_note` nếu đang `NEED_REVISION`.

**Doctor Portal (bổ sung phần liên quan y tá)** trong các trang đã có (`pages/doctor` hiện tại, chưa cần đọc chi tiết vì nằm ngoài phạm vi tạo mới — chỉ bổ sung):
- Dashboard: thêm khối "Y tá hỗ trợ ca này".
- Danh sách lịch hẹn: thêm cột tên y tá.
- Chi tiết lịch hẹn: hiển thị người nhập hồ sơ (`nguoi_nhap_id` → tên y tá).
- Trang "Hồ sơ chờ xác nhận" mới + nút Xác nhận / Yêu cầu chỉnh sửa.

---

## 14. Phân quyền chi tiết theo actor

| Hành động | Admin | Bác sĩ | Y tá | Bệnh nhân |
|---|---|---|---|---|
| Gán y tá vào `LichLamViec` | ✅ | ❌ | ❌ | ❌ |
| Check-in bệnh nhân | ❌ (không nên, việc của y tá) | ❌ | ✅ | ❌ |
| Bắt đầu/kết thúc khám | ❌ | ✅ | ❌ | ❌ |
| Tạo/sửa hồ sơ khám (nháp) | ❌ | ⚠️ chỉ phần chuyên môn | ✅ | ❌ |
| Xác nhận / yêu cầu sửa hồ sơ | ❌ | ✅ | ❌ | ❌ |
| Xem hồ sơ đã `completed` | ✅ (toàn hệ thống) | ✅ (của mình) | ✅ (ca mình nhập) | ✅ (của mình) |

---

## 15. Validation backend bắt buộc

**Frontend:**
- Form nhập hồ sơ luôn gắn `appointmentId` (route dạng `/nurse/appointments/:id/medical-record`), không có form nhập tự do.
- Không có input tự chọn `patient`, `doctor`, `nurse_id` bằng tay trong form — toàn bộ hiển thị read-only từ dữ liệu Appointment đã fetch.

**Backend (bắt buộc, không tin dữ liệu từ FE):**
1. `nurseId`/`doctorId` **luôn** lấy từ `req.user.id` → tra `YTa`/`BacSi` tương ứng — **không bao giờ** đọc từ `req.body`.
2. Kiểm tra `Appointment` tồn tại (404 nếu không).
3. Kiểm tra `Appointment.nurse_id` (hoặc `doctor_id`) khớp đúng người đang đăng nhập (403 nếu không khớp).
4. Kiểm tra `Appointment.status` đúng bước cho phép trước khi thao tác (409 nếu sai trạng thái) — vd. chỉ cho tạo hồ sơ khi `status = waiting_record` hoặc hồ sơ đang `yeu_cau_chinh_sua`.
5. Không cho sửa `KetQuaKham` khi `status = da_xac_nhan` (dùng đúng field `co_the_sua` đã có sẵn trong model — chỉ cần enforce ở controller).
6. Không cho tạo 2 `KetQuaKham` cho cùng `appointment_id` — **đã có sẵn** `unique: true` trên field này (`KetQuaKham.js:28`), chỉ cần bắt lỗi duplicate-key và trả 409 thay vì 500.
7. Mọi lần sửa phải ghi `updated_by`/`lich_su_sua` (đã có field, chỉ cần đảm bảo controller luôn push vào mảng này).

---

## 16. Lỗi nghiệp vụ cần tránh

- Bác sĩ tự gán/đổi y tá — chỉ admin làm qua `LichLamViec`.
- Y tá tự chọn bệnh nhân/bác sĩ/`nurse_id` bằng tay khi nhập hồ sơ.
- Y tá nhập hồ sơ cho lịch hẹn không thuộc ca mình (`Appointment.nurse_id` ≠ token).
- Sửa hồ sơ đã `da_xac_nhan`.
- Bác sĩ xác nhận hồ sơ không thuộc lịch hẹn của mình.
- Cho sửa hồ sơ khi `Appointment.status = completed`.
- Cho nhập hồ sơ khi chưa `waiting_record` (hoặc chưa `yeu_cau_chinh_sua`).
- Không kiểm tra trùng lịch y tá / trùng phòng khi admin gán ca.
- Không lưu người nhập/người xác nhận (model đã có field — đừng bỏ trống khi viết controller).
- Tin `doctorId`/`nurseId` do FE gửi lên.
- Hiển thị tất cả nút hành động bất kể trạng thái.
- Trộn chức năng admin vào trang bác sĩ/y tá (vd. không cho y tá vào màn hình quản lý người dùng).

---

## 17. Checklist đối chiếu với code hiện tại

| # | Hạng mục | Trạng thái | Ghi chú |
|---|---|---|---|
| 1 | `NguoiDung.role` có `'nurse'` | ✅ đã có | `NguoiDung.js:29`, chưa dùng ở đâu khác |
| 2 | Model `YTa` (Nurse) | ❌ chưa có | Cần tạo mới (mục 10.1) |
| 3 | `LichLamViec.nurse_id` | ❌ chưa có | Cần thêm field (mục 10.2) |
| 4 | `LichHen.nurse_id` | ❌ chưa có | Cần thêm field (mục 10.3) |
| 5 | `LichHen.status` có `waiting_record`/`waiting_doctor_confirm` | ❌ chưa có | Enum hiện tại thiếu 2 giá trị (mục 8) |
| 6 | `KetQuaKham.status` có `draft` | ❌ chưa có | Comment code xác nhận "mọi hồ sơ mới đều cho_xac_nhan" (mục 9) |
| 7 | `KetQuaKham` revision loop (`lich_su_sua`, `co_the_sua`) | ✅ đã có | Rất gần thiết kế mong muốn |
| 8 | Tách quyền ghi field (y tá nhập vận hành / bác sĩ nhập chuyên môn) | ❌ chưa có | Hiện bác sĩ tự nhập hết (`doctor/appointments.controller.js:227,280`) |
| 9 | `routes/nurse/*`, `controllers/nurse/*` | ❌ chưa có | Chưa có thư mục nào, cần tạo theo mẫu `routes/doctor/` |
| 10 | `PATCH /doctor/appointments/:id/start`, `/finish-exam` | ❌ chưa có | |
| 11 | `PATCH /doctor/medical-records/:id/confirm`, `/request-revision` | ❌ chưa có | |
| 12 | FK phòng thật (`phong_kham_id` ref `PhongKham`) | ❌ chưa có (GAP-ROOM) | `phong_kham` hiện là String tự do trên cả `LichLamViec.slots[]` và `LichHen` — ảnh hưởng ràng buộc "không trùng phòng" ở mục 4. Ngoài phạm vi y tá nhưng cần biết trước khi làm ràng buộc phòng. |
| 13 | `DonThuoc`, `SinhHieuKham` liên kết `ket_qua_kham_id`/`appointment_id` | ✅ đã có | Khớp tốt với nhóm dữ liệu "đơn thuốc" và "sinh hiệu" ở mục I của yêu cầu gốc |
| 14 | `dich_vu_phat_sinh`/`dich_vu_tu_choi` gõ kiểu rõ ràng | ⚠️ hiện là `Mixed` | Nên có sub-schema riêng (mục 10.4) |

> **Lưu ý:** mục 12 (FK phòng) nằm ngoài phạm vi "y tá–bác sĩ" thuần tuý — chỉ ghi nhận ở đây để không quên khi triển khai ràng buộc trùng phòng ở mục 4. Không tự ý sửa khi làm nhánh y tá nếu không được yêu cầu riêng.

---

## 18. Kế hoạch sửa code từng bước

> Nguyên tắc: mỗi bước làm 1 nhóm nhỏ, không đụng admin/payment/patient ngoài phạm vi.

**Bước 1 — Model nền tảng**
- File: `backend/src/models/YTa.js` (mới), `backend/src/models/index.js` (export thêm).
- Lý do: mọi API sau đều cần model này tồn tại trước.
- Rủi ro: thấp — model mới, không đụng model cũ.
- Test: unit test tạo/tìm `YTa` qua `user_id`.

**Bước 2 — Bổ sung field vào schema hiện có**
- File: `LichLamViec.js` (+`nurse_id`), `LichHen.js` (+`nurse_id`, +2 enum status), `KetQuaKham.js` (+`draft` enum, +`doctor_revision_note`).
- Lý do: nền tảng cho toàn bộ luồng trạng thái mới.
- Rủi ro: **trung bình** — đổi enum có thể ảnh hưởng data cũ nếu đã có bản ghi `status` không hợp enum mới (Mongoose không tự migrate). Cần kiểm tra dữ liệu hiện có trước khi deploy.
- Test: chạy lại toàn bộ test hiện có của `doctor/appointments.controller.js` để đảm bảo không vỡ enum cũ.

**Bước 3 — Nurse routes/controllers**
- File mới: `backend/src/routes/nurse/*.js`, `backend/src/controllers/nurse/*.js`, mount vào `backend/src/routes/index.js`.
- API cần test: toàn bộ bảng mục 11.
- Dữ liệu mẫu cần có: 1 `NguoiDung` role=`nurse`, 1 `YTa` liên kết, 1 `LichLamViec` có `nurse_id` này, 1-2 `LichHen` ở trạng thái `waiting_record`.

**Bước 4 — Doctor endpoints mới (start/finish-exam/confirm/request-revision)**
- File: `backend/src/controllers/doctor/appointments.controller.js` (thêm hàm), route tương ứng.
- Rủi ro: sửa file đang chạy — cần giữ nguyên các hàm `list/getById/confirm` hiện có, chỉ thêm hàm mới.
- Test: luồng end-to-end `checked_in → in_progress → waiting_record → (y tá nhập) → waiting_doctor_confirm → completed`.

**Bước 5 — Frontend Nurse Portal**
- File mới: `frontend/src/pages/nurse/*`, `frontend/src/layouts/NurseLayout.jsx`, `frontend/src/routes/` (thêm route + `ProtectedRoute` role=nurse).
- Dữ liệu mẫu: dùng cùng seed ở Bước 3.

**Bước 6 — Frontend Doctor Portal (bổ sung hiển thị y tá)**
- File: các trang `pages/doctor` hiện có — chỉ thêm cột/khối hiển thị, không đổi luồng đang chạy.

Mỗi bước khi thực thi thật sẽ được báo cáo riêng theo format: **File cần sửa / Lý do / Rủi ro / Cách test / API cần test / Dữ liệu mẫu** như quy định.
