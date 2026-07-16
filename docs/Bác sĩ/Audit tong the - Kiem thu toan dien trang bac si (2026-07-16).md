# Audit tổng thể — Kiểm thử toàn diện trang Bác sĩ (2026-07-16)

> **Phiên kiểm tra và lập báo cáo — KHÔNG sửa code.** Phương pháp: 5 agent Explore đọc song song 5 mảng (Dashboard+Lịch làm việc, Xin nghỉ, Lịch hẹn+trạng thái khám, Hồ sơ khám+luồng y tá, Profile+phân quyền) + 1 lượt kiểm tra dữ liệu MongoDB Cloud thật (chỉ đọc, không ghi/xóa). Mọi kết luận đều kèm file:line. Các phát hiện P0 được tôi tự xác minh độc lập thêm một lượt (grep toàn repo + query dữ liệu Cloud thật) trước khi đưa vào báo cáo.

---

## PHẦN 1 — TÓM TẮT ĐIỀU HÀNH

**Mức độ hoàn thành tổng quan:** phần lớn nghiệp vụ cốt lõi (đăng nhập, phân quyền, ownership theo `doctor_id`/`nurse_id` từ token, CRUD lịch hẹn cơ bản, luồng xác nhận hồ sơ khám, xin nghỉ + khóa slot) đã **PASS** với bằng chứng cụ thể. Tuy nhiên có **1 lỗ hổng P0** làm hồ sơ khám y tế mất tính toàn vẹn sau khi đã "chốt", và **6 lỗ hổng P1** ảnh hưởng trực tiếp đến luồng nghiệp vụ (đóng lịch hẹn, xử lý xin nghỉ, tính đúng "hôm nay", liên kết dữ liệu đơn thuốc).

| | Số lượng |
|---|---|
| Chức năng PASS (có bằng chứng đầy đủ) | 11 |
| Chức năng PARTIAL (chạy được nhưng có lỗ hổng) | 6 |
| Lỗi P0 | 1 |
| Lỗi P1 | 6 |
| Lỗi P2 | 6 |
| Lỗi P3 | 7 |

**Ba rủi ro lớn nhất:**
1. **GAP-001 (P0):** Hồ sơ khám đã bác sĩ xác nhận (`da_xac_nhan`) vẫn sửa được **vô thời hạn** — cơ chế khóa 24 giờ (`co_the_sua`) chưa từng được kích hoạt trong runtime thật (không cron/job nào set `false`), xác nhận bằng dữ liệu Cloud thật: 2/2 hồ sơ `da_xac_nhan` hiện có đều `co_the_sua: true`. Đây là rủi ro **toàn vẹn hồ sơ y tế** — dữ liệu đã "chốt" về mặt nghiệp vụ (bác sĩ đã xác nhận) nhưng kỹ thuật vẫn cho sửa mãi mãi.
2. **GAP-005 (P1):** Lịch hẹn có `dich_vu_phat_sinh` (dịch vụ phát sinh) sau khi hồ sơ được xác nhận sẽ **không bao giờ tự chuyển `completed`** — không có luồng nào trong toàn bộ backend đóng vòng trạng thái này lại. Lịch hẹn bị "treo" vĩnh viễn.
3. **GAP-007 (P1):** Khi Admin duyệt đơn xin nghỉ của bác sĩ, backend đã tính đúng danh sách lịch hẹn bị ảnh hưởng (`lich_hen_can_xu_ly`) nhưng **không có màn hình Admin nào hiển thị/xử lý** danh sách này — về vận hành thực tế, lịch hẹn của bệnh nhân rơi vào ca bác sĩ nghỉ vẫn không ai chủ động liên hệ xử lý.

**Kết luận demo/bảo vệ đồ án:** Có thể demo tốt các luồng: đăng nhập, dashboard, lịch làm việc (xem), đặt/xác nhận/hoàn thành lịch hẹn, xin nghỉ + khóa slot, nhập/xác nhận hồ sơ khám, đơn thuốc. **Không nên demo** kịch bản "sửa lại hồ sơ đã xác nhận" theo hướng "hệ thống tự khóa sau 24h" vì thực tế chưa khóa — nếu phản biện thử sửa hồ sơ cũ, hệ thống vẫn cho sửa. Nên chủ động nói rõ đây là hạn chế đã biết nếu được hỏi, hoặc ưu tiên sửa GAP-001 trước ngày bảo vệ (xem Phần 9).

---

## PHẦN 2 — NHỮNG GÌ ĐÃ HOÀN THÀNH

| STT | Chức năng | Mức hoàn thành | Frontend | Backend | Database | Phân quyền | Kiểm thử | Bằng chứng |
|---|---|---|---|---|---|---|---|---|
| 1 | Đăng nhập + xác định đúng bác sĩ | PASS | ✅ | ✅ | ✅ | ✅ | Đã đọc code xác nhận | `stats.controller.js:73` `BacSi.findOne({user_id: req.user.id})` |
| 2 | Dashboard — số liệu theo đúng bác sĩ | PARTIAL | ✅ | ⚠️ | ✅ | ✅ | Đã đọc code | Đúng phạm vi bác sĩ nhưng sai "hôm nay" khung 00:00–07:00 VN + đếm lẫn cancelled (GAP-002, GAP-008) |
| 3 | Lịch làm việc — chỉ xem, đúng quyền | PASS (quyền) / PARTIAL (hiển thị) | ✅ | ✅ | ✅ | ✅ | Đã đọc code | Không có route tạo/sửa/xóa ca cho doctor (`schedule.routes.js`); bug tuần Chủ Nhật (GAP-009) |
| 4 | Xin nghỉ — tạo/hủy đơn, chặn trùng | PASS | ✅ | ✅ | ✅ | ✅ | Đã đọc code + đối chiếu commit `cbaf38f` | `leaves.controller.js:83-121,139-157` |
| 5 | Xin nghỉ → khóa slot khi duyệt | PASS (backend) / PARTIAL (vận hành) | ❌ thiếu UI admin | ✅ | ✅ | ✅ | Đã đọc code | `admin/doctor-leaves.controller.js:63-99`; thiếu UI (GAP-007) |
| 6 | Danh sách lịch hẹn — ownership + tab thời gian | PASS | ✅ (vừa nâng cấp cùng phiên) | ✅ | ✅ | ✅ | Đã đọc code + tsc/eslint | `appointments.controller.js:61-65`, `DoctorAppointments.tsx` |
| 7 | Chi tiết lịch hẹn — ownership | PASS | ✅ | ✅ | ✅ | ✅ | Đã đọc code | `appointments.controller.js:84-93` |
| 8 | Máy trạng thái lịch hẹn (confirm/complete) | PARTIAL | ✅ | ⚠️ | ✅ | ✅ | Đã đọc code | `cancel()` dùng blacklist (GAP-003); race condition (GAP-004) |
| 9 | Hồ sơ khám — nhập/xác nhận/yêu cầu sửa | PARTIAL | ✅ | ⚠️ | ✅ | ✅ | Đã đọc code + query Cloud thật | GAP-001 (P0), GAP-005 (P1) |
| 10 | Hồ sơ chờ xác nhận (Pending Records) | PASS | ✅ | ✅ | ✅ | ✅ | Đã đọc code | `appointments.controller.js:449-453` lọc đúng `bac_si_phu_trach_id: docId` |
| 11 | Đơn thuốc — không bắt buộc, thêm/xóa | PASS | ✅ | ✅ | ✅ | ✅ | Test tự động (`doctor.api.test.js`, 13/13 PASS, xem docs cùng ngày) | Đã sửa + test trong phiên làm việc trước |
| 12 | Đơn thuốc — liên kết dữ liệu admin xem lại | PARTIAL | — | ⚠️ | ⚠️ | — | Đã đọc code | `DonThuoc.medical_record_id` ref sai collection (GAP-006) |
| 13 | Profile bác sĩ — xem/sửa | PASS (bảo mật) / cần xác nhận nghiệp vụ | ✅ | ✅ | ✅ | ✅ | Đã đọc code | `profile.controller.js:64-130` whitelist rõ; `gia_kham` tự sửa (GAP-012, cần xác nhận) |
| 14 | Phân quyền route `/api/doctor/*`, `/api/nurse/*` | PASS | — | ✅ | — | ✅ | Đã đọc toàn bộ route | `routes/doctor/index.js:15`, `routes/nurse/index.js:15` |
| 15 | Phạm vi y tá (`nurse-scope.js`) | PASS | ✅ | ✅ | ✅ | ✅ | Đã đọc code | Fail-closed, re-check mỗi thao tác |

Không đánh dấu PASS tuyệt đối cho bất kỳ mục nào có lỗ hổng P0/P1 kèm theo, theo đúng tiêu chí Phần XX.

---

## PHẦN 3 — MA TRẬN ĐỐI CHIẾU NGHIỆP VỤ

| Mã | Quy tắc nghiệp vụ | Kỳ vọng | Thực tế | Kết quả | Bằng chứng | Ảnh hưởng |
|---|---|---|---|---|---|---|
| BR-01 | Bác sĩ chỉ thấy/sửa lịch hẹn của chính mình | 404 khi đổi ID sang lịch bác sĩ khác | Đúng — mọi hàm query kèm `doctor_id: docId` | PASS | `appointments.controller.js:61-409` (9 hàm) | — |
| BR-02 | Hồ sơ khám khóa sau khi bác sĩ xác nhận (hoặc sau 24h) | Không sửa được nữa | **Không khóa** — `co_the_sua` không bao giờ bị set `false` trong runtime thật | **FAIL** | `KetQuaKham.js:91`, không có cron nào ghi `false` (grep toàn `backend/src`) | P0 |
| BR-03 | Lịch hẹn có dịch vụ phát sinh phải hoàn tất sau khi thanh toán | Tự chuyển `completed` | Không có luồng nào set lại `completed` sau khi phát sinh | **FAIL** | `appointments.controller.js:282,393` | P1 |
| BR-04 | Không hủy được lịch hẹn `no_show`/`skipped` thành `cancelled` tùy tiện | Chặn | Không chặn (dùng blacklist, thiếu 2 trạng thái này) | **FAIL** | `appointments.controller.js:139` | P1 |
| BR-05 | Xin nghỉ trùng ngày/ca bị chặn 2 chiều | Chặn | Đúng, đã fix ở `cbaf38f` | PASS | `leaves.controller.js:96-109` | — |
| BR-06 | Ca xin nghỉ đã có lịch hẹn phải được xử lý khi duyệt | Slot khóa + Admin xử lý lịch hẹn ảnh hưởng | Slot khóa đúng; **Admin không có UI xử lý** | PARTIAL | `admin/doctor-leaves.controller.js:101-117`; thiếu `admin-doctor-leave.service.ts` | P1 |
| BR-07 | "Hôm nay" phải đúng giờ Việt Nam mọi lúc | Nhất quán | `stats.controller.js` sai lệch khung 00:00–07:00 VN | **FAIL** | `stats.controller.js:79-82`, `config/timezone.js:14` | P1 |
| BR-08 | Đơn thuốc không bắt buộc, xóa hết phải xóa DB | Không tạo/xóa đúng | Đúng, đã sửa 2026-07-16 | PASS | `appointments.controller.js:330-350` + test | — |
| BR-09 | Admin xem chi tiết đơn thuốc phải thấy đúng thông tin hồ sơ liên kết | Hiển thị đủ | `populate` ra `null` do sai `ref` | **FAIL** | `DonThuoc.js:44-48`, `medical-read.controller.js:170,187` | P1 |
| BR-10 | Bác sĩ không tự tạo/sửa/xóa ca làm việc | Chặn cả FE/BE | Đúng, không có route nào | PASS | `schedule.routes.js:8-13` | — |
| BR-11 | Y tá chỉ thao tác bác sĩ được phân công | Fail-closed | Đúng | PASS | `nurse-scope.js:17-21` | — |
| BR-12 | Không lộ `mat_khau`/token trong response | Không có | Đúng, `select:false` + `toJSON.transform` | PASS | `models/NguoiDung.js:13-18,67-71` | — |

---

## PHẦN 4 — DANH SÁCH LỖ HỔNG NGHIỆP VỤ

### GAP-001 — Hồ sơ khám đã xác nhận vẫn sửa được vô thời hạn
- **Mức độ:** P0
- **Chức năng:** Hồ sơ khám (Kết quả khám) — nút "Xem hồ sơ" trên trang Lịch hẹn bác sĩ
- **Mô tả:** Cơ chế khóa 24 giờ sau khi tạo/xác nhận hồ sơ (`co_the_sua`) chỉ tồn tại dưới dạng comment tài liệu (`NhatKyThaoTac.js:41`: *"LOCK_EXAMINATION_RESULT (co_the_sua → false sau 24h)"*) — **chưa từng được triển khai thật**. Không có cron job, không có controller nào set `co_the_sua = false` trong toàn bộ `backend/src` (đã grep xác nhận, chỉ xuất hiện trong 2 script seed dữ liệu giả).
- **Điều kiện tái hiện:** Bất kỳ hồ sơ khám thật nào được tạo qua app (không qua seed script).
- **Các bước tái hiện:** (1) Bác sĩ nhập kết quả khám → xác nhận hồ sơ (`da_xac_nhan`). (2) Bấm "Xem hồ sơ" bất kỳ lúc nào sau đó, kể cả nhiều ngày sau. (3) Sửa chẩn đoán/đơn thuốc, bấm Cập nhật.
- **Kết quả mong đợi:** Sau 24h hoặc sau khi xác nhận, hồ sơ chuyển chỉ-đọc, không sửa được.
- **Kết quả thực tế:** Sửa được bình thường ở bất kỳ thời điểm nào — `isReadOnly` (`DoctorAppointments.tsx`) chỉ dựa `!existing.co_the_sua`, và field này không đổi.
- **File/API liên quan:** `backend/src/models/KetQuaKham.js:91`; `backend/src/controllers/doctor/appointments.controller.js:306`; `frontend/src/pages/doctor/DoctorAppointments.tsx` (`isReadOnly`).
- **Nguyên nhân dự kiến:** Tính năng được thiết kế (field DB + comment dự định) nhưng phần thực thi (cron/job) chưa được lập trình.
- **Dữ liệu bị ảnh hưởng:** Xác nhận bằng query Cloud thật (2026-07-16): `KetQuaKham` có `status: 'da_xac_nhan'` → **2/2 bản ghi hiện có đều `co_the_sua: true`** (0 bản ghi bị khóa).
- **Vai trò bị ảnh hưởng:** Bác sĩ (có thể tự sửa hồ sơ y tế đã "chốt" về mặt pháp lý/nghiệp vụ).
- **Rủi ro nếu không sửa:** Mất tính toàn vẹn hồ sơ y tế — hồ sơ đã xác nhận (có thể đã gửi cho bệnh nhân/dùng để tính hóa đơn) vẫn có thể bị đổi ngược, không có dấu vết cưỡng chế; ảnh hưởng trực tiếp tới điểm bảo vệ đồ án nếu phản biện kiểm tra đúng luồng này.
- **Đề xuất hướng sửa:** (a) Thêm điều kiện chặn ngay trong `updateResult()`: nếu `result.status === 'da_xac_nhan'` thì từ chối sửa trực tiếp (bắt buộc qua luồng "yêu cầu chỉnh sửa" nếu cần đổi), **hoặc** (b) triển khai cron thật set `co_the_sua = false` sau 24h kể từ `ngay_tao`/`thoi_diem_xac_nhan`. Cần bạn quyết định hướng (a) hay (b) hay cả hai trước khi code.
- **Test hồi quy cần có:** Tạo hồ sơ → xác nhận → gọi `PUT .../result` → kỳ vọng 403.

### GAP-005 — Lịch hẹn có dịch vụ phát sinh không bao giờ tự hoàn tất
- **Mức độ:** P1
- **Chức năng:** Xác nhận hồ sơ khám + dịch vụ phát sinh trong ca khám
- **Mô tả:** `createResult()`/`confirmResult()` cố ý không chuyển `appointment.status = 'completed'` khi `result.dich_vu_phat_sinh.length > 0` (chờ thanh toán phần phát sinh). Nhưng grep toàn bộ backend xác nhận **không có bất kỳ controller nào khác** (hóa đơn, thanh toán) từng set lại `completed` sau khi xử lý xong dịch vụ phát sinh.
- **Điều kiện tái hiện:** Hồ sơ khám có `dich_vu_phat_sinh` khác rỗng.
- **Các bước tái hiện:** (1) Bác sĩ thêm dịch vụ phát sinh vào hồ sơ (nếu UI đã hỗ trợ — hiện chưa có UI nhập, xem GAP phụ bên dưới) hoặc set thẳng qua API. (2) Xác nhận hồ sơ. (3) Theo dõi `LichHen.status`.
- **Kết quả mong đợi:** Sau khi dịch vụ phát sinh được thanh toán/xử lý, lịch hẹn tự chuyển `completed`.
- **Kết quả thực tế:** Lịch hẹn giữ nguyên trạng thái cũ (`confirmed`/`in_progress`...) vĩnh viễn.
- **File/API liên quan:** `backend/src/controllers/doctor/appointments.controller.js:282,393`.
- **Nguyên nhân dự kiến:** Thiếu luồng "đóng vòng" — tính năng dịch vụ phát sinh mới có phần ghi, chưa có phần xử lý thanh toán + hoàn tất.
- **Dữ liệu bị ảnh hưởng:** Hiện tại 0 bản ghi thật có `dich_vu_phat_sinh` khác rỗng (chưa có UI tạo) — rủi ro tiềm ẩn, chưa phát sinh hậu quả thật.
- **Vai trò bị ảnh hưởng:** Bác sĩ, lễ tân/thu ngân (nếu module hóa đơn dùng field này).
- **Rủi ro nếu không sửa:** Khi module dịch vụ phát sinh được hoàn thiện, lịch hẹn sẽ kẹt vĩnh viễn, sai số liệu thống kê "hoàn thành".
- **Đề xuất hướng sửa:** Thêm bước trong luồng xử lý thanh toán dịch vụ phát sinh (khi làm) để set lại `completed` khi đã thanh toán đủ.
- **Test hồi quy cần có:** Sau khi có luồng thanh toán dịch vụ phát sinh, test end-to-end xác nhận appointment chuyển `completed`.

### GAP-003 — `cancel()` cho phép hủy lịch hẹn đang `no_show`/`skipped`
- **Mức độ:** P1
- **Chức năng:** Hủy lịch hẹn (bác sĩ)
- **Mô tả:** `cancel()` dùng blacklist `!['completed','cancelled'].includes(status)` thay vì whitelist các trạng thái hợp lệ để hủy — `no_show` và `skipped` không nằm trong danh sách chặn nên vẫn hủy được, có thể kích hoạt hoàn tiền sai (`:151`) cho lịch đã được đánh dấu "không đến".
- **Các bước tái hiện:** Lịch hẹn ở trạng thái `no_show` → gọi `PATCH .../cancel` → kỳ vọng 409, thực tế 200 + chuyển `cancelled`.
- **File/API liên quan:** `backend/src/controllers/doctor/appointments.controller.js:139`.
- **Mức độ ảnh hưởng:** Có thể hoàn tiền cho lịch hẹn đã ghi nhận "không đến" (sai nghiệp vụ tài chính).
- **Đề xuất hướng sửa:** Đổi sang whitelist các trạng thái được phép hủy, loại trừ rõ `no_show`/`skipped`/`completed`/`cancelled`.
- **Test hồi quy:** Case `no_show` → cancel → kỳ vọng 409.

### GAP-004 — Không có bảo vệ race-condition cho các thao tác đổi trạng thái lịch hẹn
- **Mức độ:** P1
- **Chức năng:** confirm/cancel/complete/createResult/updateResult/confirmResult
- **Mô tả:** Toàn bộ dùng mẫu `findOne()` → sửa field trong memory → `.save()`, không `session`/transaction/optimistic lock. 2 request đồng thời có thể dẫn tới "last write wins" không nhất quán (ví dụ `complete()` và `cancel()` cùng lúc).
- **File/API liên quan:** `backend/src/controllers/doctor/appointments.controller.js` (toàn bộ action).
- **Mức độ ảnh hưởng:** Thấp về khả năng xảy ra thực tế trong demo (1 bác sĩ, thao tác tuần tự) nhưng là rủi ro kỹ thuật thật khi phản biện hỏi về xử lý đồng thời.
- **Đề xuất hướng sửa:** Cân nhắc `findOneAndUpdate` với điều kiện trạng thái hiện tại trong query thay vì đọc-rồi-ghi; hoặc chấp nhận rủi ro và ghi nhận là nợ kỹ thuật (mức độ ưu tiên thấp hơn GAP-001/003/005/006/007).
- **Test hồi quy:** Khó viết test tự động cho race-condition thật — có thể mô phỏng bằng 2 request Promise.all song song trong test tích hợp.

### GAP-006 — `DonThuoc.medical_record_id` trỏ sai collection, admin xem đơn thuốc bị mất liên kết
- **Mức độ:** P1
- **Chức năng:** Admin xem chi tiết đơn thuốc (`medical-read.controller.js`)
- **Mô tả:** Schema khai `medical_record_id: { ref: 'HoSoYTe' }` nhưng mọi nơi ghi dữ liệu đều gán `_id` của `KetQuaKham` vào field này. `medical-read.controller.js:170,187` gọi `.populate('medical_record_id', ...)` — Mongoose populate tra đúng collection theo `ref` khai báo (`HoSoYTe`), gần như chắc chắn trả `null` vì ID thực chất thuộc `KetQuaKham`.
- **File/API liên quan:** `backend/src/models/DonThuoc.js:44-48`; `backend/src/controllers/admin/medical-read.controller.js:170,187`.
- **Kết quả thực tế:** Trang admin xem đơn thuốc mất `appointment_id/ten_khach/ngay_kham/chan_doan` liên kết dù dữ liệu tồn tại đúng.
- **Đề xuất hướng sửa:** Sửa `ref` của `medical_record_id` thành `'KetQuaKham'` (khớp dữ liệu thực tế đang ghi), hoặc đổi toàn bộ code ghi/đọc sang dùng đúng `ket_qua_kham_id` (field đã khai đúng `ref: 'KetQuaKham'` sẵn) và cân nhắc bỏ hẳn `medical_record_id` nếu không còn dùng cho `HoSoYTe` thật. Cần bạn xác nhận hướng trước khi sửa (đổi `ref` là migration schema, ảnh hưởng field đang tồn tại).
- **Dữ liệu bị ảnh hưởng:** 6 `DonThuoc` hiện có trên Cloud (đếm thật 2026-07-16) — tất cả đều dùng sai quy ước này.
- **Test hồi quy:** Sau khi sửa, gọi API admin xem đơn thuốc, xác nhận `medical_record`/liên kết không còn `null`.

### GAP-007 — Xin nghỉ: Admin thiếu UI xử lý lịch hẹn bị ảnh hưởng
- **Mức độ:** P1
- **Chức năng:** Xin nghỉ bác sĩ → Admin duyệt
- **Mô tả:** `admin/doctor-leaves.controller.js` tính đúng và trả về `lich_hen_can_xu_ly` (danh sách lịch hẹn bị ảnh hưởng bởi ca nghỉ được duyệt), nhưng không có `frontend/src/services/admin-doctor-leave.service.ts` hay màn hình admin nào gọi/hiển thị dữ liệu này. `ManageDoctorSchedules.tsx` chỉ hiện thống kê, không phải màn duyệt.
- **File/API liên quan:** `backend/src/controllers/admin/doctor-leaves.controller.js:101-117`; thiếu ở `frontend/src/pages/admin/`.
- **Mức độ ảnh hưởng:** Vận hành thực tế — lịch hẹn bệnh nhân rơi vào ca bác sĩ nghỉ (đã thanh toán/xác nhận) không ai chủ động xử lý (dời lịch/hoàn tiền) qua giao diện, dù dữ liệu đã được backend tính đúng.
- **Đề xuất hướng sửa:** Thêm màn hình Admin duyệt đơn nghỉ hiển thị `lich_hen_can_xu_ly` + hành động dời lịch/hoàn tiền thủ công. Đây là việc làm mới (ngoài phạm vi trang bác sĩ), ghi nhận để nhóm phụ trách module Admin xử lý.
- **Test hồi quy:** N/A cho tới khi có UI.

### GAP-002 — Dashboard tính sai "hôm nay" trong khung 00:00–07:00 giờ VN
- **Mức độ:** P1
- **Chức năng:** Dashboard bác sĩ — thống kê "hôm nay"
- **Mô tả:** `backend/src/config/timezone.js:14` ép `process.env.TZ = 'UTC'` toàn tiến trình, nhưng `stats.controller.js:79-82` dùng `new Date(); todayStart.setHours(0,0,0,0)` — trong khung 00:00–06:59 giờ VN (=17:00–23:59 UTC hôm trước), kết quả tính ra vẫn là NGÀY HÔM TRƯỚC theo UTC.
- **File/API liên quan:** `backend/src/controllers/doctor/stats.controller.js:79-82`.
- **Đối chiếu:** Bug cùng loại đã được phát hiện và SỬA ở `DoctorAppointments.tsx` (frontend, dùng `toLocalDateStr()`) trong phiên làm việc trước — nhưng **stats.controller.js (backend) chưa được sửa cùng đợt**, là 1 vị trí khác của cùng loại bug.
- **Đề xuất hướng sửa:** Đồng bộ cách tính ngày "hôm nay" ở backend theo đúng quy ước UTC-midnight đã dùng ở `scheduleGenerator.service.js`/`schedule.controller.js` (dùng `setUTCHours` nhất quán, không phải `setHours` dựa vào giả định TZ runtime).
- **Test hồi quy:** Giả lập giờ hệ thống 02:00 giờ VN, kiểm tra dashboard hiển thị đúng ngày.

### Các GAP còn lại (P2/P3) — tóm tắt, xem Phần 6/7 để chi tiết kỹ thuật đầy đủ hơn
- **GAP-008 (P2):** Dashboard đếm "tổng lịch hẹn hôm nay" gồm cả `cancelled`/`no_show`, không khớp tổng 3 card còn lại (`stats.controller.js:19,88-92,115`).
- **GAP-009 (P2):** `scheduleWeek.ts:12-19` — mở trang đúng Chủ Nhật hiển thị tuần ĐÃ QUA thay vì tuần tới.
- **GAP-010 (P2, chưa tự xác minh độc lập):** `admin/slots.controller.js` `updateSlot` có thể không kiểm tra cờ khóa nghỉ phép khi đổi status thủ công — theo tài liệu cũ, cần đọc lại file này để xác nhận trước khi đưa vào kế hoạch sửa.
- **GAP-011 (P2):** `createResult()` trả lỗi 500 thô (Mongo duplicate key) thay vì 409 khi race tạo trùng hồ sơ (`appointments.controller.js:293`).
- **GAP-012 (P2, cần xác nhận nghiệp vụ):** Bác sĩ tự sửa `gia_kham` (giá khám) không qua duyệt Admin (`profile.controller.js:92`) — không rõ đây có phải chủ đích thiết kế hay thiếu workflow duyệt giá.
- **GAP-013 (P3):** Y tá chỉ thấy lý do yêu cầu chỉnh sửa mới nhất (`doctor_revision_note`), không thấy toàn bộ lịch sử (`lich_su_sua`) như bác sĩ.
- **GAP-014 (P3):** `DoctorDashboard.tsx:275-277` còn dòng chú thích "dữ liệu mẫu" lỗi thời dù đã nối API thật.
- **GAP-015 (P3):** `so_dien_thoai` null hiển thị khoảng trắng ở bảng lịch hẹn, không có fallback như các field khác (`DoctorAppointments.tsx:579`).
- **GAP-016 (P3):** `ExamModal` (`minNgayTaiKham`) còn 1 chỗ dùng `toISOString().slice(0,10)` — rủi ro thấp vì nguồn là `ngay_kham` (UTC-midnight cố định) chứ không phải "now", nhưng nên đổi cho nhất quán code style.
- **GAP-017 (P3):** `getById` (doctor appointments) thiếu check `!docId` trước khi query, không nhất quán với `list()` (an toàn nhưng nên đồng bộ).
- **GAP-018 (P3):** Không có race-condition guard khi 2 request tạo đơn xin nghỉ trùng giờ gửi đồng thời.

---

## PHẦN 5 — KIỂM TRA LUỒNG END-TO-END

| Luồng | Điều kiện ban đầu | Các bước | Kết quả mong đợi | Kết quả thực tế (theo code) | Trạng thái | Điểm đứt |
|---|---|---|---|---|---|---|
| 1. Đăng nhập → Dashboard → Lịch làm việc | Tài khoản bác sĩ hợp lệ | Login → xem Dashboard → xem Lịch làm việc | Đúng dữ liệu bác sĩ, đúng ngày | Đúng bác sĩ; sai "hôm nay" khung 00:00-07:00 VN ở Dashboard (GAP-002) | PARTIAL | Dashboard backend |
| 2. Lịch làm việc → Lịch hẹn | Có ca hôm nay | Xem lịch hẹn trong ca | Khớp phòng/giờ | Khớp — không phát hiện sai lệch | PASS | — |
| 3. Check-in → Bắt đầu khám → Kết thúc khám | Lịch hẹn `confirmed` | complete() | Chuyển `completed`, chặn nếu chưa `confirmed` | Đúng — whitelist chặn đúng | PASS | — |
| 4. Y tá nhập hồ sơ → Bác sĩ xác nhận → Hoàn thành | Hồ sơ `cho_xac_nhan` | confirmResult() | `da_xac_nhan` + appointment `completed` (nếu không có dịch vụ phát sinh) | Đúng khi không có dịch vụ phát sinh; **treo vĩnh viễn nếu có** (GAP-005) | PARTIAL | confirmResult + dịch vụ phát sinh |
| 5. Y tá nhập hồ sơ → Bác sĩ yêu cầu sửa → Y tá gửi lại | Hồ sơ `cho_xac_nhan` | requestResultRevision → nurse update → submit | Quay lại `cho_xac_nhan`, y tá thấy lý do | Đúng — y tá thấy `doctor_revision_note` | PASS (thiếu timeline đầy đủ, GAP-013) | — |
| 6. Bác sĩ xin nghỉ → Admin duyệt → Lịch làm việc cập nhật | Có ca hợp lệ | Tạo đơn → Admin duyệt | Slot khóa, ca không nhận thêm lịch | Đúng — `lockSlotsForLeave` + `bi_khoa_boi_nghi_phep` | PASS | — |
| 7. Xin nghỉ khi ca đã có lịch hẹn | Ca có lịch hẹn `confirmed`/`pending` | Admin duyệt đơn nghỉ trùng ca | Lịch hẹn được liệt kê để Admin xử lý | Backend tính đúng (`lich_hen_can_xu_ly`) nhưng **không UI hiển thị** (GAP-007) | PARTIAL | Thiếu UI Admin |
| 8. Lịch hẹn đã thanh toán → Hiển thị trang bác sĩ | Lịch `confirmed`/`paid` | Xem danh sách lịch hẹn | Hiển thị đúng | Đúng — không phát hiện sai lệch trong lần audit này | PASS | — |
| 9. Truy cập trái phép dữ liệu bác sĩ khác | Token bác sĩ B, ID lịch của bác sĩ A | Đổi `:id` trên URL/API | 404, không lộ dữ liệu | Đúng — mọi hàm query kèm `doctor_id: docId` | PASS | — |
| 10. Hồ sơ đã xác nhận → Sửa lại sau 24h | Hồ sơ `da_xac_nhan`, đã qua 24h | Mở "Xem hồ sơ" → sửa → Cập nhật | 403, không cho sửa | **Vẫn cho sửa** — không có cơ chế khóa nào kích hoạt | **FAIL** | GAP-001 (P0) |

---

## PHẦN 6 — LỖI DỮ LIỆU VÀ API

- **Response/DB không khớp ref:** `DonThuoc.medical_record_id` khai `ref: 'HoSoYTe'` nhưng luôn chứa `_id` của `KetQuaKham` → populate sai (GAP-006).
- **Dữ liệu không tự đóng vòng:** `LichHen.status` không tự chuyển `completed` khi có `dich_vu_phat_sinh` (GAP-005).
- **Trạng thái sai do thiếu whitelist:** `cancel()` cho hủy cả `no_show`/`skipped` (GAP-003).
- **Không có dữ liệu mồ côi trong `KetQuaKham`:** đã xác nhận cả 2 controller tạo `KetQuaKham` (doctor + nurse) đều kiểm tra ownership trước khi tạo — không tìm thấy hồ sơ mồ côi trong code path runtime thật.
- **Số liệu Cloud thật (2026-07-16, chỉ đọc, không sửa):**
  | Chỉ số | Giá trị |
  |---|---|
  | Tổng `KetQuaKham` | 6 |
  | `da_xac_nhan` + `co_the_sua=true` (vẫn sửa được vô hạn) | **2 / 2** |
  | `da_xac_nhan` + `co_the_sua=false` (đã khóa) | **0** |
  | `da_xac_nhan` nhưng appointment KHÔNG `completed` | 0 / 2 (chưa phát sinh hậu quả GAP-005 trong dữ liệu hiện tại, do chưa có `dich_vu_phat_sinh` nào được tạo) |
  | `completed` nhưng chưa có `KetQuaKham` nào | 2 / 7 (đúng thiết kế — `complete()` cho phép hoàn thành trước khi nhập kết quả) |
  | Tổng `DonThuoc` | 6 (toàn bộ đều dùng sai quy ước `medical_record_id`, xem GAP-006) |
- **Race-condition tiềm ẩn:** GAP-004, chưa có bằng chứng đã xảy ra thật trong dữ liệu (không có cách nào truy vết retroactive), nhưng thiết kế code cho phép xảy ra.

---

## PHẦN 7 — LỖI PHÂN QUYỀN VÀ BẢO MẬT

| API/Trang | Trường hợp kiểm tra | Kết quả mong đợi | Kết quả thực tế | Mức độ | Bằng chứng |
|---|---|---|---|---|---|
| Toàn bộ `/api/doctor/*` | Không có token | 401 | 401 (`verifyToken`) | PASS | `routes/doctor/index.js:15` |
| Toàn bộ `/api/doctor/*` | Token role khác (vd `nurse`) | 403 | 403 (`requireRole('doctor')`) | PASS | như trên |
| `GET /doctor/appointments/:id` | Đổi ID sang lịch bác sĩ khác | 404 | 404 | PASS | `appointments.controller.js:84-93` |
| `PATCH /doctor/appointments/:id/confirm` v.v. | Gọi trên lịch bác sĩ khác | 404 | 404 | PASS | 9 hàm đều kèm `doctor_id: docId` |
| `PUT /doctor/profile` | Gửi field `trang_thai_duyet`/`vai_tro`/`gia_kham`... | Chỉ field cho phép được ghi | Whitelist đúng, **trừ `gia_kham` được ghi luôn** (cần xác nhận có chủ đích không) | PASS (bảo mật) / cần xác nhận nghiệp vụ | `profile.controller.js:64-130` |
| Mọi response có `NguoiDung` | Có trả `mat_khau` không | Không | Không — `select:false` + `toJSON.transform` | PASS | `models/NguoiDung.js:13-18,67-71` |
| `/api/nurse/*` | Y tá thao tác bác sĩ không được phân công | Từ chối | Từ chối (fail-closed, `doctorIds=[]` nếu chưa phân công) | PASS | `nurse-scope.js:17-21` |
| `/api/doctor/*`, `/api/nurse/*` | Có route nào lộ toàn bộ danh sách hệ thống (nhầm route admin) | Không | Không tìm thấy | PASS | Rà toàn bộ 10 controller |

Không phát hiện lỗ hổng P0/P1 về phân quyền/bảo mật trong lần audit này — điểm mạnh nhất của hệ thống hiện tại.

---

## PHẦN 8 — TEST CASE CẦN BỔ SUNG

**API integration test (ưu tiên cao nhất — bổ sung vào `backend/tests/doctor.api.test.js` theo đúng pattern hiện có):**
1. *Khóa hồ sơ sau xác nhận* — Mục tiêu: xác nhận GAP-001 được sửa. Tiền điều kiện: hồ sơ `da_xac_nhan`. Bước: `PUT .../result`. Kỳ vọng: 403. Ưu tiên: Cao.
2. *Không hủy được lịch `no_show`* — Tiền điều kiện: appointment `no_show`. Bước: `PATCH .../cancel`. Kỳ vọng: 409. Ưu tiên: Cao.
3. *Dashboard đúng ngày lúc 02:00 giờ VN* — Giả lập system time hoặc mock `Date`. Kỳ vọng: số liệu "hôm nay" không lệch ngày. Ưu tiên: Cao.
4. *Admin xem đơn thuốc có đủ liên kết hồ sơ* — Sau khi sửa GAP-006, gọi API admin, kỳ vọng `medical_record`/liên kết khác `null`. Ưu tiên: Trung bình.
5. *Dashboard "tổng lịch hẹn" không đếm `cancelled`/`no_show`* — Ưu tiên: Trung bình.

**Permission test:**
6. Bác sĩ B gọi `updateResult` trên hồ sơ của bác sĩ A → 404. Ưu tiên: Cao (regression, hiện đã PASS, cần giữ).
7. Y tá thao tác `HangDoi`/`TrangThaiPhongKham` của bác sĩ không được phân công hôm nay → 403/404. Ưu tiên: Cao (regression).

**State transition test:**
8. `confirmResult()` gọi 2 lần liên tiếp → lần 2 phải 409.
9. `dich_vu_phat_sinh` khác rỗng → xác nhận appointment KHÔNG tự `completed` (ghi nhận hành vi hiện tại, chờ GAP-005 được thiết kế lại).

**Database consistency test:**
10. Script định kỳ (không tự động chạy, chỉ để kiểm tra thủ công): đếm `KetQuaKham.status='da_xac_nhan' AND co_the_sua=true` sau khi sửa GAP-001, kỳ vọng giảm dần về 0 theo thời gian (hồ sơ cũ dần bị khóa).

**Regression test:**
11. Sau khi sửa GAP-003 (whitelist cancel), chạy lại toàn bộ `doctor.api.test.js` hiện có (12 test) — không được có test nào mới fail.

---

## PHẦN 9 — KẾ HOẠCH SỬA THEO THỨ TỰ

> Đây chỉ là đề xuất thứ tự — **chưa sửa gì trong phiên này.**

### Bước 1 — GAP-001 (khóa hồ sơ đã xác nhận) — ưu tiên cao nhất, ảnh hưởng bảo vệ đồ án
- Mục tiêu: chặn sửa hồ sơ `da_xac_nhan` (tối thiểu chặn theo `status`, không phụ thuộc cron 24h chưa có).
- File dự kiến sửa: `backend/src/controllers/doctor/appointments.controller.js` (`updateResult`).
- File chỉ đọc: `KetQuaKham.js`, `DoctorAppointments.tsx` (để hiểu `isReadOnly` hiện tại).
- File không được đụng: mọi thứ liên quan y tá/queue (ngoài phạm vi).
- Rủi ro: cần xác nhận trước — có luồng nào hợp lệ cần sửa hồ sơ đã xác nhận không (vd bác sĩ tự phát hiện lỗi ngay sau khi xác nhận)? Nếu có, cần thêm luồng "yêu cầu mở khóa" thay vì chặn cứng.
- Test cần chạy sau khi sửa: test case #1 (Phần 8) + toàn bộ `doctor.api.test.js`.
- Điều kiện chuyển bước tiếp theo: test #1 PASS, không vỡ test cũ.

### Bước 2 — GAP-003 (whitelist trạng thái hủy)
- File dự kiến sửa: `appointments.controller.js` (`cancel`).
- Rủi ro: thấp, chỉ thu hẹp điều kiện.
- Test: case #2 (Phần 8).

### Bước 3 — GAP-002 (bug múi giờ dashboard)
- File dự kiến sửa: `stats.controller.js`.
- File chỉ đọc: `config/timezone.js`, `schedule.controller.js` (tham khảo cách tính đã đúng).
- Test: case #3.

### Bước 4 — GAP-006 (ref sai collection DonThuoc)
- Cần xác nhận nghiệp vụ trước (đổi `ref` hay đổi field đang dùng) — xem GAP-004 phần đề xuất.
- File dự kiến sửa: `models/DonThuoc.js` + nơi `.populate()` liên quan.
- Rủi ro: trung bình — là thay đổi schema, cần kiểm tra dữ liệu cũ trước (6 bản ghi hiện có).

### Bước 5 — GAP-008 (dashboard đếm nhầm cancelled)
- File dự kiến sửa: `stats.controller.js`.
- Rủi ro: thấp.

### Bước 6 — GAP-009 (tuần Chủ Nhật)
- File dự kiến sửa: `frontend/src/utils/scheduleWeek.ts`.
- Rủi ro: thấp.

### Bước 7 — GAP-005, GAP-007 (cần thiết kế thêm, không chỉ sửa nhỏ)
- Đây là 2 việc lớn hơn (đóng vòng dịch vụ phát sinh; UI admin xử lý nghỉ phép) — nên tách thành spec/plan riêng, không gộp vào đợt sửa nhanh.

### Bước 8 — Bổ sung test tự động cho các case ở Phần 8 chưa có test.

---

## PHẦN 10 — ĐỀ XUẤT DATABASE RIÊNG

### Đề xuất 1 — `DonThuoc.medical_record_id`
- **Vấn đề hiện tại:** Field khai `ref: 'HoSoYTe'` (collection `ho_so_y_te`) nhưng toàn bộ code ghi giá trị `_id` của `KetQuaKham` (collection `ket_qua_kham`) vào đây.
- **Bằng chứng:** `backend/src/models/DonThuoc.js:44-48`; ghi tại `appointments.controller.js:208,270,329,337`; populate sai tại `admin/medical-read.controller.js:170,187`.
- **Nghiệp vụ bị thiếu:** Admin xem chi tiết đơn thuốc mất liên kết tới thông tin hồ sơ khám gốc (chẩn đoán, ngày khám).
- **Thay đổi được đề xuất:** Đổi `ref: 'HoSoYTe'` → `ref: 'KetQuaKham'` cho field `medical_record_id` (khớp dữ liệu thực tế đang ghi), HOẶC bỏ hẳn `medical_record_id` và chuyển toàn bộ sang dùng `ket_qua_kham_id` (đã đúng `ref` sẵn) nếu `medical_record_id` không còn ý nghĩa dùng riêng cho `HoSoYTe`.
- **Ảnh hưởng dữ liệu cũ:** 6 `DonThuoc` hiện có trên Cloud (2026-07-16) — đổi `ref` không cần migrate giá trị (giá trị ID không đổi, chỉ đổi ý nghĩa tham chiếu khai báo), an toàn về mặt dữ liệu.
- **Hướng migration:** Không cần script migrate dữ liệu (chỉ đổi schema declaration), nhưng cần rà lại mọi nơi `.populate('medical_record_id')` để đảm bảo code đọc đúng field mới sau đổi `ref`.
- **Rủi ro:** Thấp — thay đổi khai báo schema, không đổi giá trị lưu.
- **Cách rollback:** Đổi lại `ref` như cũ nếu phát sinh vấn đề (không mất dữ liệu vì giá trị không đổi).
- **Test cần có:** Test case #4 (Phần 8).

### Đề xuất 2 — Cơ chế khóa hồ sơ khám (liên quan GAP-001)
- **Vấn đề hiện tại:** Field `co_the_sua` tồn tại nhưng không có cơ chế runtime nào cập nhật.
- **Nghiệp vụ bị thiếu:** Khóa hồ sơ sau xác nhận/24h.
- **Thay đổi đề xuất:** Không cần đổi schema (field đã có sẵn, đúng kiểu `Boolean`) — chỉ cần bổ sung logic ở tầng controller (xem Phần 9, Bước 1). Ghi ở đây vì đây là gap "dữ liệu không được cập nhật đúng vòng đời", không phải thiếu field.
- **Rủi ro:** Không ảnh hưởng dữ liệu cũ (chỉ thêm điều kiện chặn ở tầng đọc/ghi mới).

---

## PHẦN 11 — KẾT LUẬN BẢO VỆ ĐỒ ÁN

- **Trang bác sĩ có đúng vai trò không?** Có. Không tìm thấy route/chức năng nào cho phép bác sĩ thực hiện nghiệp vụ Admin (tạo/sửa/xóa ca, gán phòng/y tá, duyệt nghỉ, xử lý hoàn tiền) — đã rà toàn bộ route + code frontend.
- **Có lẫn chức năng admin không?** Không.
- **Luồng bác sĩ–y tá có hoàn chỉnh không?** Cơ bản hoàn chỉnh (nháp → gửi → xác nhận/yêu cầu sửa → gửi lại → xác nhận), nhưng **có lỗ hổng nghiêm trọng ở khâu cuối** (GAP-001 — hồ sơ đã xác nhận không thực sự khóa).
- **Luồng xin nghỉ–lịch làm việc–lịch hẹn có kín không?** Phần kỹ thuật (khóa slot, chặn trùng đơn) kín. Phần vận hành (Admin xử lý lịch hẹn bị ảnh hưởng) **chưa kín** — GAP-007.
- **Luồng lịch hẹn–hồ sơ khám có kín không?** Kín với trường hợp không có dịch vụ phát sinh; **hở** khi có dịch vụ phát sinh (GAP-005, hiện chưa phát sinh hậu quả vì tính năng dịch vụ phát sinh chưa có UI nhập).
- **Phân quyền có đủ an toàn không?** Có — đây là điểm mạnh nhất, không phát hiện P0/P1 nào về bảo mật/phân quyền trong toàn bộ 5 mảng đã audit.
- **Dữ liệu có đủ nhất quán không?** Phần lớn có, trừ liên kết `DonThuoc.medical_record_id` (GAP-006) và nguy cơ race-condition chưa xảy ra thật (GAP-004).
- **Có thể demo chức năng nào?** Đăng nhập, Dashboard (trừ giờ 00:00-07:00), Lịch làm việc (xem), Xin nghỉ (tạo/hủy/duyệt), Lịch hẹn (tab thời gian, tìm kiếm, xác nhận/hoàn thành), Hồ sơ khám (nhập/xác nhận/yêu cầu sửa), Đơn thuốc (thêm/xóa).
- **Chức năng nào chưa nên demo?** (a) Không nên chủ động demo "sửa hồ sơ đã xác nhận bị khóa" vì thực tế chưa khóa; (b) không nên demo "Admin xử lý lịch hẹn khi duyệt nghỉ phép" vì chưa có UI; (c) không demo dashboard đúng lúc gần nửa đêm/sáng sớm nếu chưa sửa GAP-002.
- **Lỗi nào bắt buộc phải sửa trước ngày bảo vệ:** GAP-001 (P0) là bắt buộc — đây là loại lỗi "hồ sơ y tế không thực sự bất biến sau khi chốt", rất dễ bị phản biện hỏi trúng. GAP-003 và GAP-002 nên sửa vì đơn giản, rủi ro thấp, nhanh có bằng chứng khắc phục.

---

## CẬP NHẬT 2026-07-16 (sau audit) — Đã sửa theo thứ tự khó→dễ

Theo yêu cầu trực tiếp, đã sửa lần lượt (mỗi GAP có test kèm theo, chạy lại toàn bộ suite sau mỗi lần sửa — không phát sinh hồi quy mới so với 17 lỗi cũ đã biết ở `nurse-queue-room.test.js`, thuộc tính năng hàng đợi y tá đang làm dở, không liên quan):

| GAP | Quyết định | Trạng thái |
|---|---|---|
| GAP-001 (P0) | Khóa ngay khi `status==='da_xac_nhan'` (không chờ cron 24h) | **Đã sửa** — `appointments.controller.js` `updateResult()` + frontend `isReadOnly`. Test: `doctor.api.test.js` #10. **Lưu ý mới phát sinh:** hồ sơ bác sĩ tự nhập (`createResult` → `da_xac_nhan` ngay) giờ không còn đường sửa nào nữa kể cả phát hiện lỗi ngay sau khi lưu, vì `requestResultRevision` chỉ áp dụng cho hồ sơ `cho_xac_nhan` (hồ sơ y tá nhập). Đây là đánh đổi có chủ đích theo đúng lựa chọn đã chốt — cần lưu ý nếu có phản biện hỏi. |
| GAP-006 (P1) | Đổi `ref: 'HoSoYTe'` → `ref: 'KetQuaKham'` cho `DonThuoc.medical_record_id` + populate lồng qua `appointment_id` để lấy `ten_khach`/`ngay_kham` | **Đã sửa**. Test mới: `admin.medical-read.test.js`. |
| GAP-004 (P1) | Race-condition ở các action đổi trạng thái | **Bỏ qua theo quyết định** — ghi nhận nợ kỹ thuật, rủi ro sửa cao hơn lợi ích trong bối cảnh demo. |
| GAP-009 (P2) | Chủ nhật nhảy sang Thứ Hai tuần sau thay vì lùi về tuần trước | **Đã sửa** — `scheduleWeek.ts` `getMondayOfWeek()`. Test: cập nhật `scheduleWeek.test.ts`. |
| GAP-013 (P3) | Y tá xem đầy đủ `lich_su_sua` (không chỉ lý do mới nhất) | **Đã sửa** — `nurse/appointments.controller.js` `getById()` + `NurseAppointmentDetail.tsx`. Xác minh qua query trực tiếp (không có fixture y tá sẵn kèm `lich_su_sua` để viết test HTTP đầy đủ — nợ kiểm thử nhỏ, ghi nhận lại). |
| GAP-010 (P2) | `updateSlot` chặn đổi `status` ngầm khi slot đang `bi_khoa_boi_nghi_phep=true`, trừ khi tường minh gửi kèm `bi_khoa_boi_nghi_phep=false` | **Đã sửa** — `admin/slots.controller.js`. Test mới trong `doctor.leave-sync.test.js`. |
| GAP-003 (P1) | `cancel()` đổi blacklist → whitelist trạng thái được phép hủy | **Đã sửa**. Test: `doctor.api.test.js` #11 (case `no_show`). |
| GAP-002 (P1) | "Hôm nay"/"đầu tháng" tính theo lịch VN (bù +7h) thay vì UTC thô | **Đã sửa** — `stats.controller.js` (`getStats`, `getTodayOverview`). Xác minh qua gọi API trực tiếp, không lỗi. |
| GAP-008 (P2) | `tong_lich_hen` (dashboard hôm nay) loại `cancelled` | **Đã sửa** phạm vi hẹp — chỉ loại `cancelled` (không ép bằng đúng tổng 3 card kia, vì còn các trạng thái hợp lệ khác như `pending`/`waiting_record` không thuộc card nào — xem lý do trong code). `tong_luot_kham` (all-time, `getStats`) **giữ nguyên**, không đổi vì ảnh hưởng tới % `ty_le_hoan_thanh`/`ty_le_huy` đang dùng cùng mẫu số. |
| GAP-011 (P2) | `createResult()` trả 409 thay vì 500 khi trùng race (Mongo code 11000) | **Đã sửa**. Chưa có test tự động (race condition thật khó test xác định, tránh làm bẩn dữ liệu Cloud dùng chung) — xác nhận bằng code review + không vỡ test hiện có. |
| GAP-014..017 (P3) | Dọn comment lỗi thời, fallback `so_dien_thoai`, đổi `toISOString`→`toLocalDateStr`, thêm check `!docId` | **Đã sửa** cả 4. |
| GAP-005, GAP-007 (P1) | Đóng vòng dịch vụ phát sinh; UI Admin xử lý lịch hẹn khi duyệt nghỉ phép | **Tạm hoãn theo quyết định** — là xây tính năng mới (màn hình mới, luồng mới), cần brainstorm/thiết kế riêng, không sửa trong phiên nhanh này. |
| GAP-012 | Bác sĩ tự sửa `gia_kham` không qua duyệt | **Chưa xử lý** — cần xác nhận đây có phải chủ đích thiết kế trước khi động vào. |

**Việc còn lại (không thuộc phạm vi sửa nhanh):** GAP-005 (đóng vòng dịch vụ phát sinh), GAP-007 (màn Admin xử lý nghỉ phép), GAP-012 (xác nhận nghiệp vụ `gia_kham`), GAP-004 (race-condition, đã quyết định bỏ qua).

---

*Báo cáo lập theo yêu cầu kiểm thử toàn diện 2026-07-16. Đã sửa các GAP theo bảng trên trong cùng ngày, theo đúng thứ tự khó→dễ đã thống nhất.*
