# Audit + Kế hoạch — Seed dữ liệu test cho trang Bác sĩ

> Ngày kiểm tra: 2026-07-10
> Phạm vi: chỉ dữ liệu test phục vụ trang bác sĩ (`/doctor/*`). Không sửa admin/patient/payment.
> Đây là **báo cáo hiện trạng + đề xuất — chưa seed/sửa gì**.
> Dựa trên & bổ sung cho: `docs/Bác sĩ/Audit - *.md`, `Ke hoach sua code trang bac si (2026-07-08).md` (đã có nhiều Phase được thực thi sau ngày đó — xem mục 1).

---

## 1. Hiện trạng — đã đối chiếu lại so với audit 2026-07-08

Audit ngày 2026-07-08 kết luận 4 service frontend chạy mock hoàn toàn và Phase 6/7/8/9 chưa làm. Kiểm tra lại **hôm nay (2026-07-10)** cho thấy phần lớn đã được thực thi:

| Hạng mục | Audit 07-08 nói gì | Thực tế hôm nay |
|---|---|---|
| `doctor-profile.service.ts`, `doctor-appointment.service.ts`, `schedule.service.ts` | Mock 100% | ✅ Đã gọi `axiosInstance` thật |
| `doctor-leave.service.ts` (Phase 8) | Chưa tồn tại | ✅ Đã có, có route `/doctor/leaves` thật |
| `KetQuaKham.status` (Phase 6) | Không tồn tại | ✅ Đã có enum `cho_xac_nhan/da_xac_nhan/yeu_cau_chinh_sua` |
| `confirmResult`, `requestResultRevision`, `listPendingResults` (Phase 7) | Không tồn tại | ✅ Đã có đủ 3 handler trong `appointments.controller.js` |
| `DoctorPendingRecords.tsx` (Phase 6 UI) | Không tồn tại | ✅ Đã có trang, gọi `listPendingResults()` thật |
| **`examination.service.ts`** | Mock | ⚠️ **VẪN CÒN MOCK** — đây là service duy nhất chưa nối API thật |
| `GET /doctor/stats/today` (Dashboard "hôm nay") | Chưa có | ✅ Đã có, trả `ca_lam_viec, phong_kham, y_ta_ho_tro, tong_lich_hen, cho_kham, dang_kham, hoan_thanh, lich_hen_gan_nhat` |
| Y tá hỗ trợ (`y_ta_ho_tro`) | Loại khỏi phạm vi | ⚠️ **Field đã tồn tại trong response nhưng luôn trả `null`** — có chỗ hiển thị nhưng không có dữ liệu |

**Kết luận quan trọng nhất:** vấn đề không còn là "thiếu API" như audit cũ — mà là:

1. **`examination.service.ts` mock cô lập với phần còn lại.** `DoctorPendingRecords.tsx` gọi API thật để lấy *danh sách* hồ sơ chờ xác nhận, nhưng bấm "Xem chi tiết" lại gọi `examinationService.getByAppointment()` — đọc từ mảng mock, **không phải** bản ghi thật vừa thấy trong danh sách. Tương tự, nút "Nhập kết quả" trong `DoctorAppointments.tsx` cũng ghi vào mock, không gọi `POST /doctor/appointments/:id/result` thật. **Nếu chỉ seed MongoDB mà không sửa file này, toàn bộ mục tiêu "Hồ sơ khám có nhiều tình huống" của bạn sẽ không hiển thị đúng trên UI** — đây là phát hiện cần bạn quyết định trước khi tôi seed (xem mục 12, Bước 0).
2. **Không có module y tá thật** — `y_ta_ho_tro` luôn `null` (comment thẳng trong `stats.controller.js`), `DoctorSchedule.tsx`/`DoctorAppointments.tsx` hiển thị **chuỗi tĩnh hard-code "Chưa phân công y tá"**, không đọc từ API nào. Seed dữ liệu y tá vào DB **sẽ không đổi được gì trên UI** cho tới khi có API/field thật trả về — khác hẳn giả định trong yêu cầu gốc của bạn (mục H, N).
3. **Không có `room_id`/FK phòng thật.** `phong_kham` trên `LichLamViec.slots[]` và `LichHen` là **String snapshot** lấy từ `PhongKham.full_name` tại thời điểm tạo — không phải ObjectId. Seed "room" nghĩa là chọn đúng chuỗi `PhongKham` có sẵn, không tạo quan hệ FK.
4. **`Appointment.status` không có `WAITING_RECORD`/`WAITING_DOCTOR_CONFIRM`.** Enum thật: `pending, confirmed, checked_in, in_progress, completed, cancelled, no_show`. Chỉ `pending→confirmed→completed`, `→cancelled` là có action API thật (`confirm`, `complete`, `cancel`). `checked_in`, `in_progress` **không có route nào set** — 2 giá trị "chết" trong enum. `no_show` được set qua `cancel` (nhánh riêng, không phải action riêng). Trạng thái "chờ xác nhận hồ sơ" nằm hoàn toàn ở `KetQuaKham.status`, **tách biệt** với `Appointment.status` — một `Appointment` có thể đã `completed` trong khi `KetQuaKham.status` vẫn `cho_xac_nhan` hoặc `yeu_cau_chinh_sua` (đây là **thiết kế thật hiện tại**, không phải bug — khác với workflow lý tưởng ở `docs/NURSE_DOCTOR_WORKFLOW.md` đã phân tích trước đó).
5. **Đã có sẵn seed script** `backend/src/scripts/seed-doctor-test-data.js` (untracked trong git — làm ở phiên trước), idempotent, an toàn, đã tạo 1 bác sĩ test + 8 appointment + 3 hồ sơ khám + 3 đơn nghỉ phép. Còn thiếu so với yêu cầu hiện tại của bạn: bác sĩ thứ 2 (test phân quyền), bệnh nhân tài khoản thật (`ThanhVien`/`GiaDinh`, hiện toàn bộ appointment test là khách vãng lai `ten_khach`), trạng thái `checked_in`/`in_progress` (tác giả cũ cố tình bỏ qua), đơn thuốc/sinh hiệu mẫu đầy đủ hơn, mã lịch hẹn theo prefix `TEST_APT_*` như bạn yêu cầu (hiện đang là `TESTAPT001`).

---

## 2. Danh sách model đã kiểm tra (field + enum thật)

| Model | Collection | Field chính | Enum |
|---|---|---|---|
| `NguoiDung` | `nguoi_dung` | `email, mat_khau, ho_ten, so_dien_thoai, role, status` | `role: user/patient/doctor/admin/receptionist/nurse`; `status: active/locked` |
| `BacSi` | `bac_si` | `user_id, specialties[], services[], gia_kham, phi_kham, trang_thai_duyet, trang_thai, phong_kham_mac_dinh` | `trang_thai_duyet: pending/approved/rejected/suspended`; `trang_thai: active/nghi_phep/nghi_viec` |
| `ChuyenKhoa` | `chuyen_khoa` | `phong_kham_id (ref ThongTinPhongKham), ten, slug, status` | `status: active/hidden` |
| `DichVu` | `dich_vu` | `ma_dich_vu, ten, loai, gia, specialty_id, status` | `loai: home/related`; `status: active/inactive` (default **inactive** — seed phải set `active` thủ công) |
| `PhongKham` | `phong_kham` | `ten, tang, toa, trang_thai`, virtual `full_name` | `trang_thai: active/inactive` |
| `ThongTinPhongKham` | `thong_tin_phong_kham` | singleton — thông tin 1 cơ sở duy nhất | `trang_thai: active/inactive` |
| `LichLamViec` | `lich_lam_viec` | `doctor_id, chi_nhanh_id, ngay, slots[]` (mỗi slot: `gio_bat_dau, gio_ket_thuc, benh_nhan_id, status`) | slot `status: active/pending_payment/booked/locked/cancelled/expired` |
| `LichHen` | `lich_hen` | `user_id, member_id, doctor_id, schedule_id, slot_id, service_id, ngay_kham, gio_kham, status, payment_status, gia_kham, ten_khach...` | `status: pending/confirmed/checked_in/in_progress/completed/cancelled/no_show`; `payment_status: unpaid/partial/paid/refunded` |
| `KetQuaKham` | `ket_qua_kham` | `appointment_id(unique), nguoi_nhap_id, bac_si_phu_trach_id, nguoi_xac_nhan_id, status, chan_doan, lich_su_sua[]` | `status: cho_xac_nhan/da_xac_nhan/yeu_cau_chinh_sua` |
| `DonThuoc` | `don_thuoc` | `ket_qua_kham_id, member_id, items[] {ten_thuoc, lieu_luong, tan_suat, ngay_bat_dau, ngay_ket_thuc}` | `nguon: bac_si/tu_nhap` |
| `SinhHieuKham` | `sinh_hieu_kham` | `appointment_id(unique), can_nang, chieu_cao, huyet_ap, nhiet_do, nhip_tim, nguoi_do_id` | — |
| `NghiPhepBacSi` | `nghi_phep_bac_si` | `bac_si_id, tu_ngay, den_ngay, gio_bat_dau, gio_ket_thuc, ly_do, trang_thai, nguoi_duyet_id` | `trang_thai: cho_duyet/da_duyet/tu_choi/da_huy` |
| `GiaDinh` | `gia_dinh` | `user_id(unique), ten_nhom` | — |
| `ThanhVien` | `thanh_vien` | `family_id, tai_khoan_id, ho_ten, ngay_sinh, gioi_tinh, quan_he, nhom_mau, di_ung, benh_nen` | `gioi_tinh: nam/nu/khac` |
| `HoSoYTe` | `ho_so_y_te` | `member_id, appointment_id, ten_benh_vien, chan_doan, nguon` | `nguon: tu_kham/thu_cong` |

**Không tồn tại:** model `YTa`/`Nurse` riêng, field `nurse_id`/`room_id` ở bất kỳ model nào (đã Grep xác nhận toàn bộ `backend/src/models`).

---

## 3. Danh sách API doctor đã kiểm tra (endpoint thật, không phải suy đoán)

| Method + path | Controller | Điều kiện | Kết quả |
|---|---|---|---|
| `GET /doctor/profile`, `PUT /doctor/profile` | `profile.controller.js` | — | Cập nhật `NguoiDung` + `BacSi` + `HoSoChiTietBacSi` |
| `GET /doctor/stats`, `GET /doctor/stats/reviews`, `GET /doctor/stats/today` | `stats.controller.js` | — | `today` trả `y_ta_ho_tro` luôn `null` |
| `GET /doctor/schedule?from=&to=` | `schedule.controller.js` | — | Flatten slot từ `LichLamViec` |
| `POST /doctor/schedule/:scheduleId/slots/:slotId/request-cancel` | nt | slot `status='booked'` | `cancel_requested=true` (chờ Admin duyệt) |
| `GET /doctor/appointments`, `GET /doctor/appointments/:id` | `appointments.controller.js` | scope theo `docId` từ JWT | — |
| `PATCH /doctor/appointments/:id/confirm` | nt | `loai_kham='home'`, `status='pending'` | `→confirmed` |
| `PATCH /doctor/appointments/:id/cancel` | nt | body `ly_do` | `→cancelled` hoặc `no_show` |
| `PATCH /doctor/appointments/:id/complete` | nt | `status='confirmed'` | `→completed` |
| `GET/POST/PUT /doctor/appointments/:id/result` | nt | — | CRUD `KetQuaKham` + `DonThuoc` — **frontend chưa gọi (mock)** |
| `PATCH /doctor/appointments/:id/result/confirm` | nt | `KetQuaKham.status='cho_xac_nhan'` | `→da_xac_nhan` |
| `PATCH /doctor/appointments/:id/result/request-revision` | nt | body `ly_do` | `→yeu_cau_chinh_sua` |
| `GET /doctor/appointments/pending-results` | nt | lọc `bac_si_phu_trach_id` + `status='cho_xac_nhan'` | — |
| `GET/POST /doctor/leaves`, `PATCH /doctor/leaves/:id/cancel` | `leaves.controller.js` | chỉ hủy khi `cho_duyet` | — |

**Không tồn tại:** `PATCH /doctor/appointments/:id/start` (check-in→in_progress), `/finish-exam`. Không cần tạo mới trong phạm vi seed dữ liệu — chỉ cần biết để không seed appointment kỳ vọng nút này hoạt động.

---

## 4. Sơ đồ quan hệ dữ liệu đúng (thực tế, không phải lý tưởng)

```
NguoiDung(role=doctor) ──1:1── BacSi ──specialties[]──> ChuyenKhoa
                                 │                          │
                                 │                     phong_kham_id
                                 │                          ▼
                                 │                  ThongTinPhongKham (singleton)
                                 │
                                 ├──doctor_id──> LichLamViec (ngay, slots[])
                                 │                      │ slot._id
                                 │                      ▼
                                 └──doctor_id + schedule_id + slot_id──> LichHen
                                                          │
                                              (guest: ten_khach)  (tài khoản: user_id/member_id → ThanhVien → GiaDinh)
                                                          │
                                                 appointment_id (unique)
                                                          ▼
                                              KetQuaKham ──ket_qua_kham_id──> DonThuoc
                                                          appointment_id (unique) ──> SinhHieuKham

NguoiDung(role=nurse)  ── KHÔNG liên kết gì với LichLamViec/LichHen/KetQuaKham (không có field nurse_id ở đâu cả — chỉ có role suông)
PhongKham.full_name (String) ── copy snapshot vào LichLamViec.slots[].phong_kham và LichHen.phong_kham (KHÔNG phải FK)
```

---

## 5. Bộ dữ liệu test cần tạo (đề xuất, dựa trên field/enum THẬT)

- **User:** 1 bác sĩ chính (giữ nguyên script cũ, hoặc đổi theo email bạn muốn `doctor.demo@...`), **1 bác sĩ khác** (mới — test phân quyền), 1 y tá (role suông, chỉ để gán `nguoi_nhap_id`, không có model Nurse), 1 admin (dùng để duyệt/từ chối nghỉ phép — có thể tái sử dụng admin có sẵn), **1 bệnh nhân có tài khoản thật** (mới — `GiaDinh` + `ThanhVien`, để test luồng `member_id` thay vì chỉ khách vãng lai).
- **BacSi:** giữ chuyên khoa có sẵn trong DB (không tự tạo `ChuyenKhoa` mới — đây là dữ liệu admin quản lý, script cũ đã làm đúng bằng cách tái sử dụng).
- **LichLamViec:** 6 ngày làm việc gần nhất (bỏ Chủ nhật) — script cũ đã làm đúng, giữ nguyên helper `next6WorkingDays`.
- **LichHen:** mở rộng plan hiện tại từ 8 lên ~12-14 bản ghi, thêm trạng thái `checked_in`, `in_progress` (chấp nhận đây là dữ liệu "tĩnh" không qua action API thật — chỉ để test hiển thị danh sách/badge trạng thái, ghi rõ trong comment code lý do), thêm 2 appointment thuộc bác sĩ khác.
- **KetQuaKham + DonThuoc + SinhHieuKham:** giữ 3 tình huống cũ (`cho_xac_nhan`, `da_xac_nhan`, `yeu_cau_chinh_sua`) + bổ sung `DonThuoc`/`SinhHieuKham` cho từng hồ sơ (script cũ chưa tạo 2 model này).
- **NghiPhepBacSi:** giữ 3 tình huống cũ (`cho_duyet`, `da_duyet`, `tu_choi`), có thể thêm 1 `da_huy` nếu muốn test đủ 4 trạng thái enum.

---

## 6. Trạng thái Appointment thực tế dùng để seed (map từ yêu cầu gốc sang enum thật)

| Yêu cầu gốc | Enum thật (`LichHen.status`) | Ghi chú |
|---|---|---|
| CONFIRMED | `confirmed` | ✅ có action thật |
| CHECKED_IN | `checked_in` | ⚠️ enum tồn tại, không có route set — seed trực tiếp bằng `create()`, không test được nút |
| IN_PROGRESS | `in_progress` | ⚠️ như trên |
| WAITING_RECORD | *(không tồn tại)* | Đề xuất: dùng `completed` + chưa có `KetQuaKham` (đúng thực tế: `complete` action không bắt buộc phải có hồ sơ trước) |
| WAITING_DOCTOR_CONFIRM | `completed` + `KetQuaKham.status='cho_xac_nhan'` | Trạng thái này nằm ở `KetQuaKham`, không phải `Appointment` |
| COMPLETED | `completed` + `KetQuaKham.status='da_xac_nhan'` | |
| CANCELLED | `cancelled` | ✅ |
| NO_SHOW | `no_show` | ✅ set qua nhánh riêng của `cancel` |

---

## 7. Trạng thái MedicalRecord thực tế dùng để seed

`KetQuaKham.status` chỉ có 3 giá trị thật: `cho_xac_nhan` (mặc định khi tạo), `da_xac_nhan`, `yeu_cau_chinh_sua`. **Không có `draft`** — mọi hồ sơ tạo ra qua `createResult` đều vào thẳng `cho_xac_nhan`. Không seed field `draft` vì sẽ không khớp enum thật (Mongoose sẽ ném lỗi validate).

---

## 8. File seed hiện tại

`backend/src/scripts/seed-doctor-test-data.js` — đã tồn tại (untracked), idempotent, an toàn (không `deleteMany`, dùng find-or-create theo khóa duy nhất, toàn bộ dữ liệu có prefix `(TEST)`/`TEST_`). Đây sẽ là file **sửa/mở rộng**, không tạo file mới, để tránh 2 script cùng seed doctor giẫm lên nhau.

---

## 9. File cần sửa (đề xuất — chưa sửa)

| File | Lý do |
|---|---|
| `backend/src/scripts/seed-doctor-test-data.js` | Mở rộng: thêm bác sĩ khác, bệnh nhân tài khoản thật (`GiaDinh`+`ThanhVien`), thêm trạng thái `checked_in`/`in_progress`, thêm `DonThuoc`/`SinhHieuKham` cho mỗi hồ sơ khám |
| `frontend/src/services/examination.service.ts` | **Cần bạn xác nhận riêng** — nối API thật (bỏ mock) để hồ sơ khám seed hiển thị được trong `ExamModal`/`DoctorPendingRecords`. Đây là thay đổi CODE, không phải chỉ seed data — nêu rõ để bạn quyết định có làm cùng lúc hay tách riêng |

## 10. File chỉ đọc để hiểu (đã đọc xong ở bước khảo sát)

`models/*.js` (14 model liệt kê ở mục 2), `controllers/doctor/*.js` (4 controller), `routes/doctor/*.js`, `middlewares/auth.middleware.js`, `services/doctor.service.js` (admin, để phân biệt không đụng nhầm), `pages/doctor/*.tsx` (6 trang), `services/doctor-*.service.ts`, `schedule.service.ts`, `types/index.ts` phần `Doctor*`.

---

## 11. Rủi ro khi seed dữ liệu

- `DichVu.status` mặc định `inactive` — nếu seed appointment gắn `service_id` tới 1 dịch vụ `inactive`, có thể gây lệch logic ở nơi khác lọc theo `status='active'`. Cần set `active` tường minh hoặc tiếp tục dùng `ten_dich_vu` tự do như script cũ (không gắn `service_id` thật) — **cần quyết định, xem mục 12**.
- Seed `checked_in`/`in_progress` trực tiếp bằng `create()` là **dữ liệu không thể tái tạo qua UI thật** (không route nào set được) — nếu ai đó sau này audit lại sẽ thấy dữ liệu "bất thường". Đã ghi rõ comment trong plan để không gây hiểu lầm là bug.
- `KetQuaKham.status` không có `draft` — nếu tôi lỡ seed `draft` sẽ bị Mongoose reject toàn bộ (enum validation) — đã loại khỏi kế hoạch.
- Thêm bác sĩ khác + appointment của họ: phải đảm bảo **không** vô tình dùng lại `ma_lich_hen` hoặc email trùng với dữ liệu thật/demo đã có — sẽ dùng prefix riêng biệt rõ ràng.
- Sửa `examination.service.ts` (nếu bạn đồng ý làm) là thay đổi hành vi runtime của modal đang chạy — rủi ro thấp (file chỉ dùng ở doctor page, đã xác nhận ở audit trước) nhưng vẫn là thay đổi CODE, khác bản chất với "chỉ seed data" — cần bạn xác nhận riêng, không tự ý làm kèm.

---

## 12. Kế hoạch từng bước (đề xuất, chờ xác nhận)

**Bước 0 (cần bạn quyết định trước):** Có muốn tôi sửa luôn `examination.service.ts` để nối API thật không? Nếu không, hồ sơ khám seed sẽ **không hiển thị được** trong `ExamModal`/`DoctorPendingRecords` detail — chỉ trang danh sách `DoctorPendingRecords` (dùng API thật) mới thấy đúng.

**Bước 1:** Mở rộng `seed-doctor-test-data.js` — thêm User+BacSi bác sĩ khác, 2 appointment cho bác sĩ khác (test phân quyền 403/không thấy dữ liệu).

**Bước 2:** Thêm `GiaDinh` + `ThanhVien` cho 1 bệnh nhân test thật, dùng `member_id` thay vì `ten_khach` cho ít nhất 2-3 appointment.

**Bước 3:** Mở rộng plan appointment: thêm `checked_in`, `in_progress` (kèm comment giải thích rõ đây là dữ liệu chỉ-để-hiển-thị, không qua action API).

**Bước 4:** Thêm `DonThuoc` + `SinhHieuKham` mẫu cho các hồ sơ khám đã có.

**Bước 5:** Chạy seed, sau đó viết/chạy 1 script kiểm tra API nhỏ (login → gọi từng endpoint mục 3 → in tóm tắt: status code, số bản ghi, có lẫn dữ liệu bác sĩ khác không).

Mỗi bước sẽ báo cáo riêng: file sửa, đoạn diff chính, cách chạy, kết quả mong đợi — không gộp nhiều bước vào 1 lần.

---

## 13. Kết quả thực thi (2026-07-10, sau khi được xác nhận cả 3 quyết định ở mục Bước 0 + câu hỏi)

**Quyết định đã chọn:** nối API thật cho `examination.service.ts`; seed tĩnh `checked_in`/`in_progress`; giữ `ten_dich_vu` tự do (không gắn `service_id`).

**File đã sửa:**
| File | Thay đổi |
|---|---|
| `frontend/src/services/examination.service.ts` | Bỏ mock, gọi API thật (`GET` + `POST`/`PUT` `.../result`, thử POST trước, fallback PUT khi 409) |
| `frontend/src/types/index.ts` | `ExaminationResult.id`, `PrescriptionDrug.id` đổi từ `number` → `string \| number` (khớp Mongo ObjectId thật) |
| `backend/src/controllers/doctor/appointments.controller.js` | **Bug fix phát hiện giữa chừng:** `createResult` gọi `DonThuoc.create()` thiếu field `ket_qua_kham_id` (bắt buộc theo schema) — mọi lần bác sĩ kê đơn thuốc thật qua API sẽ bị lỗi 500 (ValidationError). Đã thêm field này (giữ nguyên `medical_record_id` đang có, vì `getResult` và `patient/records.controller.js` đều tra cứu đơn thuốc qua field này theo quy ước thực tế của codebase — sửa thêm, không sửa/xóa field cũ). |
| `backend/src/scripts/seed-doctor-test-data.js` | Mở rộng: +1 bác sĩ khác (test phân quyền) + lịch/2 lịch hẹn riêng, +1 bệnh nhân tài khoản thật (`GiaDinh`+`ThanhVien`) dùng `member_id`, +2 lịch hẹn `checked_in`/`in_progress` hôm nay, +`SinhHieuKham`+`DonThuoc` mẫu cho 3 hồ sơ khám, +guard `NODE_ENV!=='production'` |
| `backend/src/scripts/test-doctor-page-api.js` *(mới)* | Script kiểm tra API sống — login 2 bác sĩ, gọi toàn bộ endpoint mục 3, kiểm tra populate + phân quyền + lỗi trạng thái |

**Đã chạy và xác nhận:**
- `npx tsc --noEmit` (frontend): không phát sinh lỗi mới liên quan doctor/examination (các lỗi có sẵn ở `Textarea.tsx`, `client/*` không liên quan, đã có từ trước).
- `node src/scripts/seed-doctor-test-data.js`: chạy 2 lần liên tiếp, idempotent — lần 2 không tạo trùng, chỉ vá `medical_record_id` còn thiếu cho `DonThuoc` đã tạo ở lần 1.
- `node src/scripts/test-doctor-page-api.js` (server thật đang chạy port 5000): **18/18 pass** — bao gồm 401 khi chưa đăng nhập, 404 khi bác sĩ khác cố xem/xác nhận hồ sơ của bác sĩ chính, 409 khi complete lịch đã completed, danh sách không lẫn dữ liệu 2 bác sĩ, đơn thuốc hiển thị đúng qua `GET .../result`.
- Đối chiếu `GET /doctor/stats/today`: `tong_lich_hen` đổi từ 4 (kỳ vọng ban đầu) xuống 3 — **không phải lỗi**: seed lần đầu chạy ngày 2026-07-09 nên 2 lịch hẹn `pending`/`confirmed` gắn ngày đó nay đã thành "hôm qua" khi ngày hệ thống sang 2026-07-10 — đúng đặc tính "dữ liệu động theo ngày chạy" đã yêu cầu.

**Chưa làm (nằm ngoài quyết định đã chọn, giữ nguyên hiện trạng):**
- `y_ta_ho_tro` vẫn `null` — không có module y tá thật (đúng như đã thống nhất, không tự tạo module y tá).
- `phong_kham` vẫn là String snapshot, không có `room_id` FK thật.
- Không tạo endpoint check-in/start-exam/finish-exam mới — 2 lịch hẹn `checked_in`/`in_progress` chỉ để hiển thị, không có nút hành động tương ứng trên UI.
