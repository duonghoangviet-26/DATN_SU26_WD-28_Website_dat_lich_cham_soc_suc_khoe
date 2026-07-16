# Audit — Trang Y tá: Đối chiếu chức năng hiện tại & DB với luồng nghiệp vụ mong muốn

> Ngày: 2026-07-15 · Phạm vi: vai trò `nurse` (Y tá) · Người thực hiện: rà soát code + schema thực tế
> Nguồn yêu cầu: đặc tả luồng nghiệp vụ Y tá do nhóm cung cấp (8 mục: bối cảnh → hàng đợi động → trạng thái bác sĩ → gọi bệnh nhân → ghi hồ sơ → dịch vụ phát sinh → edge case → tóm tắt 6 nhóm chức năng).
> Legend: ✅ Đã có & đủ · ⚠️ Có nhưng thiếu/khác · ❌ Chưa có

---

## 0. Kết luận nhanh (đọc trước)

**Trang Y tá hiện tại được xây theo một MÔ HÌNH KHÁC với yêu cầu mới.**

| | Mô hình ĐANG CÓ trong code | Mô hình YÊU CẦU (đặc tả mới) |
|---|---|---|
| Quan hệ y tá–bác sĩ | 1 y tá gán cứng cho 1 bác sĩ / ngày (`LichLamViec.nurse_id`) | 1 y tá điều phối **cả chuyên khoa**, nhiều bác sĩ cùng lúc |
| Hàng đợi | Suy ra từ `LichHen` của bác sĩ đó, **sort theo giờ hẹn** | **Hàng đợi động realtime** theo chuyên khoa, có ưu tiên online/offline (TH1–TH6), thời gian chờ ước tính |
| Vai trò y tá | Nhập hồ sơ + gửi bác sĩ duyệt | Điều phối trung tâm: trạng thái phòng, gọi bệnh nhân, gán bác sĩ động, ghi hồ sơ, bàn giao |
| Trạng thái phòng/bác sĩ | ❌ Không tồn tại | 4 trạng thái (ĐANG KHÁM → DỌN PHÒNG → SẴN SÀNG ⇄ TẠM NGHỈ) + audit |
| Gọi bệnh nhân / lễ tân | ❌ Không có (không cả check-in) | Gợi ý next → gọi → thông báo lễ tân → no-show 5/10 phút |
| Realtime | ❌ Không (REST polling) | Bắt buộc (queue, trạng thái phòng, thông báo) |

→ Phần đang có (ghi hồ sơ + vòng duyệt bác sĩ) **đúng và tái dùng được**, nhưng chỉ đáp ứng **Nhóm 4** trong 6 nhóm chức năng yêu cầu. **Nhóm 1, 2, 3, 5, 6 gần như chưa có**. Cần bổ sung 2–3 bảng mới + nhiều trường + tầng realtime.

---

## 1. Hiện trạng code trang Y tá (những gì THẬT SỰ đang chạy)

### 1.1 Frontend — 3 màn hình
`frontend/src/routes/nurseMenu.ts`:
- `/nurse` — **Tổng quan** (`NurseDashboard`)
- `/nurse/queue` — **Hàng đợi bệnh nhân** (`NurseQueue`) — bảng lịch hẹn, sort theo `gio_kham`, lọc ngày + trạng thái, click xem chi tiết. **Không có nút hành động nào** (không check-in, không gọi bệnh nhân).
- `/nurse/revisions` — **Hồ sơ cần chỉnh sửa** (`NurseRevisions`)
- (+ `NurseAppointmentDetail` — chi tiết 1 lịch hẹn, form nhập hồ sơ)

### 1.2 Backend — endpoint đang có
`backend/src/routes/nurse/` (mount `/api/nurse`, chặn `requireRole('nurse')`):

| Method | Route | Chức năng |
|---|---|---|
| GET | `/nurse/dashboard` | Số liệu hôm nay (bác sĩ hỗ trợ, số chờ khám, chờ nhập hồ sơ, hồ sơ theo trạng thái) |
| GET | `/nurse/appointments` | Hàng đợi hôm nay (lọc `nurse_id` + status, sort `gio_kham`) |
| GET | `/nurse/appointments/:id` | Chi tiết lịch hẹn + hồ sơ + sinh hiệu |
| GET | `/nurse/medical-records` | DS hồ sơ do y tá nhập |
| GET | `/nurse/medical-records/revisions` | Hồ sơ bị bác sĩ trả về |
| GET | `/nurse/medical-records/:id` | Chi tiết hồ sơ |
| POST | `/nurse/medical-records` | Tạo hồ sơ nháp (`ban_nhap`) + sinh hiệu |
| PATCH | `/nurse/medical-records/:id` | Sửa hồ sơ (khi `ban_nhap`/`yeu_cau_chinh_sua`) |
| PATCH | `/nurse/medical-records/:id/submit` | Gửi bác sĩ (`ban_nhap` → `cho_xac_nhan`) |
| PATCH | `/nurse/medical-records/:id/resubmit` | Gửi lại sau khi sửa |

**Điểm mạnh đã đúng chuẩn:**
- Mọi query lọc `nurse_id = req.user.id` từ token — không tin FE (đúng mục XV đặc tả cũ).
- Vòng duyệt hồ sơ `ban_nhap → cho_xac_nhan → da_xac_nhan | yeu_cau_chinh_sua → resubmit` **khớp hoàn hảo** với "vòng kiểm soát chất lượng 2 lớp" (mục 5 yêu cầu).
- `co_the_sua`, `lich_su_sua`, `doctor_revision_note` đã có — bác sĩ không tự sửa, chỉ duyệt/trả về (đúng ràng buộc "bác sĩ không được tự sửa hồ sơ").
- `SinhHieuKham` upsert theo `appointment_id` — y tá ghi sinh hiệu tốt.

---

## 2. Đối chiếu 6 nhóm chức năng yêu cầu ↔ hiện trạng

| Nhóm | Yêu cầu | Hiện có | Trạng thái |
|---|---|---|---|
| **1. Theo dõi hàng đợi** | Realtime theo chuyên khoa; phân biệt online/offline; ưu tiên TH1–TH6; **thời gian chờ ước tính** | Bảng lịch hẹn sort `gio_kham`, lọc theo `nurse_id`. Không phân biệt offline thực, không ưu tiên, không thời gian chờ, không realtime | ⚠️ Rất sơ khai |
| **2. Trạng thái phòng & bác sĩ** | 4 trạng thái + ràng buộc flow + audit log mỗi lần đổi | Không tồn tại ở bất kỳ đâu | ❌ Chưa có |
| **3. Điều phối gọi bệnh nhân** | Gợi ý next → gọi vào phòng → thông báo lễ tân (tên+phòng+bác sĩ) → no-show 5/10 phút → SKIPPED → chống 2 BN 1 phòng | Không có endpoint check-in, không có "gọi bệnh nhân", không có trạng thái phòng | ❌ Chưa có |
| **4. Ghi & quản lý hồ sơ** | Kết quả khám + đơn thuốc + dịch vụ phát sinh; vòng gửi–duyệt–sửa | ✅ Kết quả khám + vòng duyệt. ⚠️ **Y tá không nhập được đơn thuốc** (không tạo `DonThuoc`). ⚠️ Dịch vụ phát sinh là `Mixed`, chưa có UI/logic | ⚠️ Một phần lớn |
| **5. Bàn giao cuối ca** | Lễ tân nhận đủ thông tin hóa đơn; nhà thuốc nhận đơn thuốc | `HoaDon` model có sẵn nhưng không có luồng y tá→lễ tân/nhà thuốc. Cờ `da_gui_cho_benh_nhan` có nhưng không dùng cho bàn giao | ❌ Chưa có luồng |
| **6. Nhận thông báo realtime** | Realtime: check-in mới, hồ sơ bị trả, đổi trạng thái | `ThongBao` là in-app polling, không realtime (không WebSocket/SSE/FCM cho nurse) | ❌ Chưa có realtime |

**Diễn giải chi tiết các khoảng trống nghiệp vụ quan trọng:**

- **Không có vai trò Lễ tân (receptionist) triển khai.** Enum `NguoiDung.role` có `'receptionist'` nhưng **không có route/controller nào**. Toàn bộ luồng "lễ tân check-in → xếp hàng đợi → y tá thấy realtime → gọi bệnh nhân → lễ tân dẫn đường" (mục 2, 3, 4 yêu cầu) **chưa có nền tảng nào**.
- **Không có `waiting_record`.** Yêu cầu: bác sĩ "kết thúc khám" → lịch hẹn chờ y tá nhập hồ sơ. Enum `LichHen.status` **thiếu `waiting_record`** (chỉ có `waiting_doctor_confirm`). Hiện y tá tự phán đoán khi nào nhập, không có tín hiệu "bác sĩ đã khám xong".
- **Không có trạng thái `skipped`** cho bệnh nhân không lên khi được gọi (mục 4 yêu cầu).
- **Thời gian chờ ước tính** — không có field nào lưu/tính. Ca khám 15–45 phút biến động, cần ước tính động (mục 1, mục 7 "ca kéo dài bất thường").

---

## 3. Phân tích DATABASE — Bảng THIẾU (cần tạo mới)

### 3.1 ❌ `TrangThaiPhongKham` / `DoctorRoomStatus` — **BẢNG THIẾU QUAN TRỌNG NHẤT**
Trạng thái phòng/bác sĩ realtime (mục 3 yêu cầu). Không nên nhét vào `LichLamViec` vì nó đổi liên tục trong ngày (mỗi ca khám đổi 3–4 lần) và cần audit riêng.

```js
// backend/src/models/TrangThaiPhongKham.js (đề xuất)
{
  doctor_id:        ObjectId ref 'BacSi', required,
  ngay:             Date, required,             // 1 bản ghi / bác sĩ / ngày làm việc
  phong_kham_id:    ObjectId ref 'PhongKham',   // phòng thực (xem GAP phòng mục 4)
  nurse_id:         ObjectId ref 'NguoiDung',   // y tá đang điều khiển
  trang_thai:       enum ['dang_kham','dang_don_phong','san_sang','tam_nghi'], default 'san_sang',
  benh_nhan_hien_tai_id: ObjectId ref 'LichHen', default null,  // ai đang trong phòng
  thoi_diem_doi:    Date,                        // lúc chuyển trạng thái gần nhất
  thoi_gian_kham_tb_phut: Number,                // TB động để ước tính thời gian chờ
}
```
Ràng buộc flow (enforce ở controller): không `dang_kham → san_sang` trực tiếp (phải qua `dang_don_phong`); không `tam_nghi` khi `benh_nhan_hien_tai_id != null`.

### 3.2 ❌ `HangDoi` / `QueueEntry` — **BẢNG THIẾU** (hàng đợi động)
Hiện hàng đợi được **suy ra on-the-fly** từ `LichHen` sort `gio_kham` — không đủ cho mô hình động, ưu tiên, gọi bệnh nhân, no-show. Cần collection hàng đợi thật:

```js
// backend/src/models/HangDoi.js (đề xuất)
{
  appointment_id:  ObjectId ref 'LichHen', default null,   // null nếu offline chưa tạo lịch
  khach_vang_lai_id: ObjectId ref 'KhachVangLai', default null,
  specialty_id:    ObjectId ref 'ChuyenKhoa', required,     // hàng đợi theo CHUYÊN KHOA
  doctor_id:       ObjectId ref 'BacSi', default null,      // bác sĩ được gán (động)
  phong_kham_id:   ObjectId ref 'PhongKham', default null,
  nguon:           enum ['online','offline'], required,
  muc_uu_tien:     enum ['online_uu_tien','online_thuong','offline'], // TH1–TH6
  checkin_time:    Date, required,                          // lễ tân check-in
  gio_hen_goc:     String, default null,                    // giờ đặt (online) để tính cửa sổ ±30'
  thu_tu:          Number,                                  // vị trí hàng đợi (1 = kế tiếp)
  trang_thai:      enum ['dang_cho','da_goi','trong_phong','skipped','cancelled','hoan_thanh'],
  so_lan_goi:      Number, default 0,
  thoi_diem_goi:   Date, default null,                      // để đếm 5'/10' no-show
  thoi_gian_cho_uoc_tinh_phut: Number, default null,        // cập nhật động
}
```
Index: `{ specialty_id, trang_thai, thu_tu }`, `{ doctor_id, trang_thai }`.

> **Lưu ý thiết kế:** Nếu nhóm muốn tối giản cho đồ án, có thể **KHÔNG tạo bảng riêng** mà bổ sung các trường queue trực tiếp vào `LichHen` (mục 4.1). Nhưng với **offline/khách vãng lai** (chưa có `LichHen` khi vào hàng đợi) và với **audit gọi bệnh nhân**, một bảng `HangDoi` riêng sạch hơn nhiều. **Khuyến nghị: tạo bảng riêng.**

### 3.3 ❌ `NhatKyTrangThaiBacSi` / DoctorStatusLog — audit đổi trạng thái
Yêu cầu (mục 3): "mỗi lần đổi trạng thái phải ghi log: ai, lúc mấy giờ, từ trạng thái nào sang trạng thái nào".
- Có thể **tái dùng `NhatKyThaoTac`** nếu mở rộng enum (mục 4.6) — **khuyến nghị dùng lại**, không tạo bảng mới, ghi `hanh_dong = 'CHANGE_DOCTOR_STATUS'`, `du_lieu_cu/du_lieu_moi = {trang_thai}`.

### 3.4 ✅ `HoaDon` — **ĐÃ CÓ, đủ dùng cho dịch vụ phát sinh**
`HoaDon.chi_tiet_thu_phi[]` (loai: `phi_kham|dich_vu|thu_thuat|giam_tru_bao_hiem`) + `tong_tien_phat_sinh` + `tong_tien_kham` **đã hỗ trợ đúng** yêu cầu "hóa đơn duy nhất gồm dịch vụ gốc + phát sinh" (mục 6). **Không cần bảng mới** — chỉ cần luồng: bác sĩ duyệt hồ sơ → tạo/cập nhật `HoaDon` từ `dich_vu_phat_sinh` → thông báo lễ tân.

---

## 4. Phân tích DATABASE — Trường THIẾU trên bảng đã có

### 4.1 `LichHen` (Appointment)
| Trường cần thêm | Lý do | Bắt buộc? |
|---|---|---|
| `status`: thêm `'waiting_record'` | Bác sĩ "kết thúc khám" → chờ y tá nhập hồ sơ (mục 4, 5 yêu cầu). Hiện enum thiếu | ✅ Nên thêm |
| `status`: thêm `'skipped'` | Bệnh nhân không lên khi gọi (mục 4) | ✅ Nên thêm |
| `phong_kham_id` ref `PhongKham` | Hiện `phong_kham` là **String tự do** → không chống trùng phòng (yêu cầu mục 4: "không bao giờ 2 BN vào cùng 1 phòng") | ⚠️ Cần cho ràng buộc phòng |
| `muc_uu_tien` / cờ online-offline rõ ràng | Có `loai_benh_nhan`, `khach_vang_lai_id` nhưng chưa có mức ưu tiên TH1–TH6 | Nếu KHÔNG tách bảng `HangDoi` thì bắt buộc |

> `gio_den_thuc_te` (Date) + `trang_thai_den` (String) + `ghi_chu_tiep_nhan` **đã có sẵn** → tái dùng được cho check-in. Không cần thêm `checkin_time` mới nếu dùng `gio_den_thuc_te`.

### 4.2 `LichLamViec` (DoctorSchedule)
- `nurse_id` ✅ đã có (document-level) — **nhưng ngữ nghĩa lệch yêu cầu**: hiện là "y tá của riêng bác sĩ này". Mô hình mới cần y tá theo **chuyên khoa**. Cân nhắc: giữ `nurse_id` để tương thích, nhưng logic điều phối dựa trên `specialty_id` + bảng `TrangThaiPhongKham`.
- `slots[].phong_kham` là **String** → GAP-ROOM: không ref `PhongKham`, không chống trùng phòng.

### 4.3 `KetQuaKham` (MedicalRecord)
| Vấn đề | Chi tiết |
|---|---|
| `dich_vu_phat_sinh` / `dich_vu_tu_choi` là `[Mixed]` | ⚠️ Cần **sub-schema có kiểu** để tổng hợp hóa đơn: `{ service_id ref DichVu, so_luong, don_gia, thanh_tien, chi_dinh_boi_bac_si_id, them_boi_y_ta_id, trang_thai }`. Hiện Mixed → dễ nhập sai, không join được giá |
| Thiếu cờ bàn giao | Yêu cầu mục 5: lễ tân đã nhận hóa đơn? nhà thuốc đã nhận đơn? Hiện chỉ có `da_gui_cho_benh_nhan`. Nên thêm `da_chuyen_le_tan`, `da_chuyen_nha_thuoc` (hoặc suy từ `HoaDon`/`DonThuoc`) |
| ✅ Vòng duyệt | `status` (ban_nhap/cho_xac_nhan/da_xac_nhan/yeu_cau_chinh_sua), `co_the_sua`, `lich_su_sua`, `doctor_revision_note` — **đủ, khớp yêu cầu** |

### 4.4 `DonThuoc` (Prescription) — **GAP nghiệp vụ**
- `nguon` enum `['bac_si','tu_nhap']` — **thiếu `'y_ta'`**. Yêu cầu: y tá ghi đơn thuốc theo chỉ định bác sĩ trong ca (mục 5).
- **Quan trọng hơn schema:** controller y tá (`nurse/medical-records.controller.js`) **không hề tạo `DonThuoc`**. Y tá hiện **không nhập được đơn thuốc** dù yêu cầu ghi rõ. → cần thêm endpoint + logic, không chỉ sửa enum.
- Thiếu trạng thái chuyển nhà thuốc (`da_chuyen_nha_thuoc` / `in_ra`).

### 4.5 `TrangThaiPhongKham` liên kết — xem mục 3.1 (bảng mới).

### 4.6 `NhatKyThaoTac` (Audit log)
| Trường | Vấn đề |
|---|---|
| `vai_tro` enum `['admin','doctor','user','system']` | ❌ **Thiếu `'nurse'`** và `'receptionist'` |
| `hanh_dong` | Thiếu: `CHANGE_DOCTOR_STATUS`, `CHECKIN_PATIENT`, `CALL_PATIENT`, `SKIP_PATIENT`, `NURSE_SUBMIT_RECORD`... |
| `loai_doi_tuong` | Thiếu: `queue_entry`, `room_status` |

### 4.7 `ThongBao` (Notification) — realtime
- Model đủ trường, nhưng `kenh_gui` không có `in_app_realtime`. **Vấn đề chính không phải schema mà là hạ tầng**: chưa có WebSocket/SSE/FCM đẩy realtime cho y tá & lễ tân (mục 6, mục 7 "nhắc lại sau X phút"). Cần tầng realtime + có thể thêm collection/cron nhắc.

---

## 5. Trường / cấu trúc THỪA hoặc rủi ro (cân nhắc bỏ hoặc gõ lại kiểu)

| Vị trí | Nhận xét |
|---|---|
| `KetQuaKham.dich_vu_tu_choi` (`[Mixed]`) | Chưa dùng ở đâu trong code. Nếu không có luồng "bác sĩ từ chối dịch vụ y tá đề xuất" thì **là trường thừa** — hoặc gộp trạng thái vào `dich_vu_phat_sinh[].trang_thai` thay vì mảng riêng |
| `KetQuaKham` có đồng thời `ghi_chu`, `ghi_chu_dieu_duong`, `trieu_chung_ban_dau`, `huong_dan_dieu_tri` | Không thừa nhưng **ranh giới mờ** giữa "phần y tá" và "phần bác sĩ". Nên tài liệu hoá rõ field nào y tá ghi / bác sĩ ghi để tránh lẫn (yêu cầu tách bạch trách nhiệm) |
| `LichHen` — cụm field khách vãng lai (`ten_khach`, `so_dien_thoai_khach`, `nam_sinh_khach`, `tinh_thanh`...) trùng `KhachVangLai` | Là snapshot có chủ đích — **không thừa**, nhưng cần nhất quán: offline nên dùng `khach_vang_lai_id` + snapshot, tránh nhập 2 nơi |
| `LichHen.ket_qua_url` | Chỉ dùng cho `home`, không liên quan y tá phòng khám — bỏ qua trong phạm vi này |

> Nhìn chung DB **không dư thừa nghiêm trọng**. Vấn đề lớn là **THIẾU**, không phải THỪA.

---

## 6. Bảng tổng hợp GAP DB (ưu tiên triển khai)

| # | Hạng mục DB | Loại | Ưu tiên | Ghi chú |
|---|---|---|---|---|
| 1 | `TrangThaiPhongKham` (bảng mới) | Thiếu bảng | 🔴 Cao | Nền tảng mục 2, 3 yêu cầu |
| 2 | `HangDoi` (bảng mới) | Thiếu bảng | 🔴 Cao | Hàng đợi động + offline + no-show |
| 3 | `LichHen.status` +`waiting_record`,`skipped` | Thiếu enum | 🔴 Cao | Tín hiệu khám xong / no-show |
| 4 | `DonThuoc.nguon` +`y_ta` + luồng tạo đơn ở nurse controller | Thiếu enum + logic | 🔴 Cao | Y tá phải nhập được đơn thuốc |
| 5 | `KetQuaKham.dich_vu_phat_sinh` → sub-schema có giá | Sửa kiểu | 🟠 TB | Để tổng hợp `HoaDon` |
| 6 | `NhatKyThaoTac.vai_tro`+`nurse`, thêm `hanh_dong` | Thiếu enum | 🟠 TB | Audit đổi trạng thái |
| 7 | `phong_kham_id` ref `PhongKham` (LichHen + slots) | Thiếu FK | 🟠 TB | Chống trùng phòng |
| 8 | Vai trò + route/controller `receptionist` | Thiếu module | 🟠 TB | Check-in đầu vào hàng đợi |
| 9 | Cờ bàn giao `da_chuyen_le_tan` / `da_chuyen_nha_thuoc` | Thiếu trường | 🟢 Thấp | Có thể suy từ `HoaDon`/`DonThuoc` |
| 10 | Hạ tầng realtime (WebSocket/SSE) | Thiếu tầng | 🟢 Thấp* | *Thấp về DB, cao về công sức; đồ án có thể polling |
| 11 | `HoaDon` cho dịch vụ phát sinh | ✅ Đã đủ | — | Chỉ cần đấu luồng, không sửa schema |

---

## 7. Khuyến nghị phạm vi cho đồ án (tránh phình)

Mô hình yêu cầu là **hệ vận hành phòng khám realtime hoàn chỉnh** — rất lớn. Đề xuất 2 mức:

**Mức tối thiểu bám sát yêu cầu (nên làm):**
1. Bảng `TrangThaiPhongKham` + 4 trạng thái + ràng buộc flow + màn hình y tá điều khiển.
2. Bảng `HangDoi` (hoặc bổ sung field vào `LichHen`) + ưu tiên online/offline đơn giản + thời gian chờ ước tính TB tĩnh.
3. Endpoint check-in (lễ tân hoặc tạm thời y tá) → đẩy vào hàng đợi.
4. "Gọi bệnh nhân" → tạo `ThongBao` cho lễ tân + no-show 5/10 phút (cron hoặc thủ công).
5. Cho y tá nhập `DonThuoc` + `dich_vu_phat_sinh` có giá.
6. Đấu `HoaDon` khi bác sĩ duyệt hồ sơ.

**Có thể để v2 (không bắt buộc demo 2026-07-04 đã qua, nhưng ghi nhận):**
- Realtime thật (WebSocket) — đồ án chấp nhận polling 5–10s.
- Thuật toán phân phối bác sĩ tối ưu (mục TH6) — tạm gán bác sĩ rảnh sớm nhất đơn giản.
- Chuyển đơn thuốc tự động sang nhà thuốc trong hệ thống.

---

## 8. Việc cần xác nhận với nhóm trước khi code

1. **Có làm vai trò Lễ tân (`receptionist`) riêng không**, hay tạm để y tá kiêm check-in? (ảnh hưởng bảng `HangDoi` + phân quyền)
2. **Tách bảng `HangDoi` riêng** hay nhồi field vào `LichHen`? (khuyến nghị: bảng riêng vì có offline chưa có lịch hẹn)
3. Mức độ **realtime**: WebSocket thật hay polling? (ảnh hưởng công sức lớn)
4. Trạng thái phòng gắn `PhongKham` thật (ref) hay giữ String? (ảnh hưởng ràng buộc trùng phòng)

---

*File này là tài liệu audit tham chiếu — chưa đụng code. Bước tiếp theo (nếu nhóm duyệt): lập kế hoạch sửa từng bước theo thứ tự ưu tiên bảng mục 6.*
