# E. Phân tích chi tiết các phần cần nâng cấp có dẫn chứng

File này đào sâu các mục đã được note là **Một phần**, **Chưa có** hoặc **cần kiểm chứng** trong bộ câu hỏi A/B/C/D. Mục tiêu là khi trả lời hội đồng, nhóm không nói chung chung, mà có thể chỉ ra:

- Hệ thống hiện đã có gì.
- Bằng chứng nằm ở file/route/model/page nào.
- Khoảng trống nghiệp vụ còn lại là gì.
- Cần nâng cấp cụ thể phần nào.
- Câu trả lời bảo vệ nên nói thế nào cho chắc.

## 1. Tổng quan các mục cần nâng cấp

| Mã | Vấn đề | Kết luận sau phân tích |
|---|---|---|
| A14 | Bệnh nhân đã check-in nhưng xin về trước khi vào khám | Gần đạt: backend và UI đã có đóng/hủy lượt hàng đợi, nhưng cần chuẩn hóa nhãn nghiệp vụ “rời phòng khám trước khi khám”. |
| A18, D79 | Đặt sai/khám sai chuyên khoa | Có nền tảng reschedule/chuyển bác sĩ, nhưng thiếu luồng chuyển chuyên khoa rõ ràng khi đã vào phòng hoặc sau khi bác sĩ phát hiện. |
| A24 | Xóa/gộp hồ sơ bệnh nhân | Có sửa hành chính có audit, model có trạng thái `merged`, nhưng chưa có endpoint gộp/xóa chuẩn cho lễ tân. |
| A28 | Khôi phục lịch hủy do quá hạn thanh toán | Admin có restore; lễ tân không có restore. Cần quyết định nghiệp vụ: lễ tân tạo lịch mới từ lịch cũ hay cho khôi phục có điều kiện. |
| A30 | Mất mạng/offline recovery | Có DB source of truth khi realtime lỗi, nhưng chưa có quy trình offline fallback khi mất hệ thống hoàn toàn. |
| B47 | Cảnh báo dị ứng khi kê thuốc | Có hiển thị dị ứng, nhưng chưa có rule so khớp thuốc với dị ứng. |
| B50, C70 | Bệnh nhân từ chối/không trả tiền dịch vụ phát sinh | Có field và thanh toán pending/cancel, nhưng field `dich_vu_tu_choi` đang là Mixed và được comment là chưa có luồng dùng. |
| B54, B55 | Đính chính hồ sơ sau khi đã xác nhận/thanh toán | Có audit và chặn ở luồng cũ, nhưng luồng exam-session cần khóa/sửa theo cơ chế đính chính chính thức. |
| B57 | Bác sĩ đưa nhầm bệnh nhân vào phòng | Có trạng thái `trong_phong`, chưa có rollback “trả khỏi phòng do nhầm” nếu chưa nhập chuyên môn. |
| C62 | Lễ tân check-in/chuyển nhầm bác sĩ | Đã có chuyển bác sĩ khi lượt còn `dang_cho`; cần mở rộng/ghi rõ giới hạn với online/offline và trạng thái khác. |
| C69 | Bác sĩ gọi bệnh nhân quay lại phòng | Có queue/contact/notification nền tảng, nhưng thiếu trạng thái callback/re-call riêng. |
| C75 | Lễ tân chọn sai hồ sơ, bác sĩ phát hiện trước khám | Có hủy/chuyển lượt, nhưng chưa có luồng thay hồ sơ gắn với lượt chờ. |
| D78 | Cấp cứu tại quầy | Có mức ưu tiên `cap_cuu`, nhưng chưa có quy trình cấp cứu riêng, thông báo khẩn và báo cáo ca khẩn. |
| D80 | Chuyển viện/cấp cứu bên ngoài | Chưa có outcome chuyên môn loại chuyển viện/cấp cứu trong kết quả khám. |
| D81 | Bệnh nhân không có số điện thoại | Hiện luồng offline đang bắt buộc số điện thoại. Cần hồ sơ tạm/mã tạm. |
| D82 | Quyền riêng tư người đi cùng/người đặt hộ | Có quan hệ thành viên/người đặt hộ, nhưng chưa có consent chia sẻ thông tin y tế. |

## 2. A14 - Bệnh nhân đã check-in nhưng xin về trước khi vào khám

### Hiện hệ thống đã có

- Route lễ tân đã có thao tác hủy/đóng lượt hàng đợi: `backend/src/routes/receptionist/queue.routes.js:7` khai báo `PATCH /:id/cancel`.
- Controller chuyển request sang service hủy lượt: `backend/src/controllers/receptionist/queue.controller.js:20-25`.
- Service bắt lễ tân nhập lý do khi đóng lượt: `backend/src/services/queueCancel.service.js:27-35`.
- Service chỉ cho đóng lượt khi còn hiện diện trong hàng đợi; nếu đã `trong_phong` thì trả lỗi nghiệp vụ: `backend/src/services/queueCancel.service.js:42-45`.
- Service cập nhật `HangDoi` sang `cancelled`, đồng bộ `LichHen` nếu có, ghi lịch sử và audit: `backend/src/services/queueCancel.service.js:57-91`, `backend/src/services/queueCancel.service.js:107-116`.
- UI dashboard lễ tân có `cancelTarget` và nút mở modal hủy lượt: `frontend/src/pages/receptionist/Dashboard.tsx:101`, `frontend/src/pages/receptionist/Dashboard.tsx:385`, `frontend/src/pages/receptionist/Dashboard.tsx:514-519`.

### Khoảng trống

Hệ thống đã có hủy lượt kỹ thuật, nhưng chưa tách rõ lý do nghiệp vụ “bệnh nhân tự rời phòng khám trước khi vào khám” với các loại hủy khác. Nếu hội đồng hỏi báo cáo cuối ngày có phân biệt “hủy do lễ tân sai”, “bệnh nhân tự về”, “bác sĩ bận” hay không, hiện bằng chứng chưa đủ.

### Nâng cấp cần làm

- Thêm enum/loại lý do đóng lượt, ví dụ `benh_nhan_tu_ve`, `nhap_nham`, `bac_si_khong_tiep_nhan`, `khac`.
- UI modal hủy lượt cho lễ tân chọn lý do chuẩn và nhập ghi chú.
- Báo cáo dashboard/activity log lọc được theo loại lý do.

### Câu trả lời có dẫn chứng

“Hệ thống hiện đã chặn lễ tân can thiệp khi bệnh nhân đã vào phòng và bắt nhập lý do khi đóng lượt. Bằng chứng là `queueCancel.service.js` chỉ xử lý các lượt còn hiện diện và trả lỗi khi lượt ở `trong_phong`. Phần cần nâng cấp là chuẩn hóa loại lý do `bệnh nhân tự về` để báo cáo vận hành rõ hơn, thay vì chỉ lưu text tự do.”

## 3. A18 và D79 - Đặt sai/khám sai chuyên khoa

### Hiện hệ thống đã có

- Lễ tân có route đổi lịch: `backend/src/routes/receptionist/appointment.routes.js:16`.
- Controller reschedule của lễ tân lưu `specialty_cu_id` và `specialty_moi_id`: `backend/src/controllers/receptionist/appointment.controller.js:871`, `backend/src/controllers/receptionist/appointment.controller.js:912-917`.
- Admin reschedule cũng cập nhật specialty theo slot/bác sĩ mới: `backend/src/controllers/admin/appointment.controller.js:1095`, `backend/src/controllers/admin/appointment.controller.js:1117`, `backend/src/controllers/admin/appointment.controller.js:1131-1132`.
- Bulk reschedule của lễ tân đang có ràng buộc “bỏ qua nếu không đúng chuyên khoa”: `backend/src/controllers/receptionist/appointment.controller.js:1337-1340`.
- Queue transfer hiện chỉ chuyển bác sĩ khi lượt còn `dang_cho`: `backend/src/services/queueTransfer.service.js:42-43`, `backend/src/services/queueTransfer.service.js:77`.

### Khoảng trống

Reschedule có thể đổi specialty theo slot mới, nhưng chưa có một luồng nghiệp vụ riêng tên “đổi/chuyển chuyên khoa” khi bác sĩ phát hiện bệnh nhân vào nhầm chuyên khoa. Đặc biệt:

- Nếu đã `trong_phong`, `queueTransfer.service.js` không cho chuyển vì chỉ nhận `dang_cho`.
- Chưa thấy trạng thái kết quả khám kiểu `chuyen_chuyen_khoa`.
- Chưa thấy xử lý rõ phần phí khám/chênh lệch dịch vụ khi đổi chuyên khoa.

### Nâng cấp cần làm

- Thêm action `request-specialty-transfer` từ bác sĩ trong phiên khám.
- Thêm trạng thái kết quả hoặc outcome: `chuyen_chuyen_khoa`.
- Lễ tân nhận task chuyển chuyên khoa, chọn specialty/doctor/slot mới.
- Tính lại phí nếu chuyên khoa/dịch vụ có giá khác.
- Ghi audit gồm specialty cũ, specialty mới, người yêu cầu, người xử lý, lý do.

### Câu trả lời có dẫn chứng

“Hiện hệ thống đã có nền tảng đổi lịch và có lưu specialty cũ/mới khi reschedule. Tuy nhiên với tình huống bác sĩ phát hiện sai chuyên khoa sau khi bệnh nhân đã vào phòng, hệ thống mới có chuyển bác sĩ ở trạng thái `dang_cho`, chưa có outcome chuyển chuyên khoa trong phiên khám. Vì vậy nhóm ghi nhận nâng cấp một luồng chuyển chuyên khoa chính thức có xử lý phí và audit.”

## 4. A24 - Xóa/gộp hồ sơ bệnh nhân

### Hiện hệ thống đã có

- Lễ tân có route tạo và sửa hồ sơ hành chính: `backend/src/routes/receptionist/patient-intake.routes.js:17-18`.
- Khi sửa hành chính, backend bắt buộc lý do: `backend/src/controllers/receptionist/patient-intake.controller.js:56`, `backend/src/controllers/receptionist/patient-intake.controller.js:72-78`.
- Các field được sửa có kiểm soát như họ tên, số điện thoại, ngày sinh, giới tính, nhóm máu, dị ứng, bệnh nền, địa chỉ, ghi chú: `backend/src/controllers/receptionist/patient-intake.controller.js:90-125`.
- Sửa xong ghi nhật ký `UPDATE_PATIENT_PROFILE_ADMINISTRATIVE`: `backend/src/controllers/receptionist/patient-intake.controller.js:595-614`.
- Model hồ sơ bệnh nhân có trạng thái `active`, `merged`, `archived`: `backend/src/models/HoSoBenhNhan.js:20`.

### Khoảng trống

Model đã dự trù trạng thái `merged`, nhưng route lễ tân chỉ có `GET search`, `POST profiles`, `PATCH profiles/:id`, `POST check-in`, `POST offline-queue/intake`. Không thấy endpoint `merge`, `archive`, `delete` cho hồ sơ bệnh nhân trong route lễ tân.

### Nâng cấp cần làm

- Không cho lễ tân xóa cứng hồ sơ.
- Thêm quy trình `merge-profile-request` hoặc `archive-profile` theo quyền admin/manager.
- Khi gộp phải chuyển liên kết `LichHen`, `HangDoi`, `KetQuaKham`, `HoaDon`, `DonThuoc` sang hồ sơ chính.
- Lưu audit đầy đủ: hồ sơ nguồn, hồ sơ đích, lý do, người duyệt.

### Câu trả lời có dẫn chứng

“Lễ tân hiện chỉ được sửa thông tin hành chính và phải nhập lý do; code đã ghi audit. Hệ thống chưa cho xóa/gộp trực tiếp ở route lễ tân dù model có trạng thái `merged`. Vì vậy câu trả lời đúng là không xóa hồ sơ tại quầy, nếu trùng hồ sơ thì chuyển sang quy trình gộp có duyệt để bảo toàn dữ liệu y tế.”

## 5. A28 - Khôi phục lịch bị hủy do quá hạn thanh toán

### Hiện hệ thống đã có

- Admin có route restore lịch hẹn: `backend/src/routes/admin/appointment.routes.js:22`.
- Admin restore chỉ áp dụng với lịch `cancelled`: `backend/src/controllers/admin/appointment.controller.js:919-942`.
- Admin restore kiểm tra slot cũ còn trống: `backend/src/controllers/admin/appointment.controller.js:952`.
- Restore ghi lịch sử với lý do `Admin khoi phuc lich hen da huy`: `backend/src/controllers/admin/appointment.controller.js:969-977`.
- Lễ tân có cancel/reschedule nhưng route lễ tân không có restore: `backend/src/routes/receptionist/appointment.routes.js:11-18`.

### Khoảng trống

Lễ tân không có chức năng khôi phục lịch đã hủy. Đây có thể là chủ ý nghiệp vụ đúng, nhưng nếu hội đồng hỏi “khách thanh toán trễ vài phút, lễ tân khôi phục được không?”, cần trả lời rõ: hiện chỉ admin có restore; lễ tân nên tạo lịch mới hoặc gửi yêu cầu.

### Nâng cấp cần làm

- Cách an toàn: thêm nút “Tạo lịch mới từ lịch đã hủy” cho lễ tân, không restore lịch cũ.
- Nếu muốn restore cho lễ tân: chỉ cho restore khi lý do hủy là quá hạn thanh toán, slot còn trống, chưa quá ngày khám, và bắt buộc lý do.
- Hiển thị rõ nguyên nhân hủy do payment timeout.

### Câu trả lời có dẫn chứng

“Hệ thống có restore nhưng chỉ ở admin, có kiểm tra lịch đã hủy và slot còn trống. Lễ tân hiện không có quyền restore, điều này tránh tự ý phá quy tắc giữ chỗ. Nâng cấp hợp lý là cho lễ tân tạo lịch mới từ lịch cũ hoặc gửi yêu cầu khôi phục có điều kiện.”

## 6. A30 - Mất mạng/offline recovery

### Hiện hệ thống đã có

- Luồng realtime chỉ là lớp cập nhật; nhiều route vẫn đọc DB khi refresh như queue, appointments, payments.
- Hệ thống có service realtime riêng cho queue: `backend/src/services/doctorQueueRealtime.service.js`.
- Hoàn tất khám transaction cập nhật DB trước, audit/realtime nằm sau: `backend/src/services/examSession.service.js:375-382`, `backend/src/services/examSession.service.js:497-504`.

### Khoảng trống

Chưa thấy module “offline intake” ở frontend kiểu lưu tạm local, in phiếu thủ công, rồi đồng bộ sau. Nếu mất hoàn toàn internet/API, lễ tân không có quy trình kỹ thuật trong hệ thống.

### Nâng cấp cần làm

- Thêm biểu mẫu offline fallback có mã tạm.
- Cho export/import danh sách tiếp nhận tạm sau khi hệ thống hoạt động lại.
- Khi đồng bộ phải chống trùng hồ sơ/lịch/hàng đợi.
- Audit các bản ghi được nhập bù sau sự cố.

### Câu trả lời có dẫn chứng

“Nếu chỉ mất realtime, hệ thống không tê liệt vì dữ liệu nằm ở DB và người dùng refresh được. Nhưng nếu mất kết nối hoàn toàn thì hiện chưa có chế độ offline recovery. Nhóm ghi nhận nâng cấp quy trình tiếp nhận tạm và đối soát nhập bù sau sự cố.”

## 7. B47 - Cảnh báo dị ứng khi kê thuốc

### Hiện hệ thống đã có

- Hồ sơ/hàng đợi có trường dị ứng: `backend/src/models/HangDoi.js:110`, `backend/src/models/HoSoBenhNhan.js:11`.
- Exam session trả dị ứng và bệnh nền cho frontend: `backend/src/services/examSession.service.js:183-184`.
- UI phiên khám hiển thị dị ứng/bệnh nền: `frontend/src/pages/doctor/ExamSessionPage.tsx:131-140`.
- Bước kê đơn lưu thuốc từ payload: `backend/src/services/examSession.service.js:319-323`.

### Khoảng trống

Trong `examSession.service.js`, dị ứng được đọc để hiển thị nhưng đoạn lưu thuốc chỉ lấy `payload.thuoc` và tạo `DonThuoc`; chưa thấy rule so khớp `ten_thuoc` với `di_ung`. Vì vậy hệ thống mới hỗ trợ bác sĩ nhìn thấy cảnh báo dạng thông tin, chưa cảnh báo tự động khi kê thuốc.

### Nâng cấp cần làm

- Thêm hàm `kiemTraDiUngThuoc({ diUng, thuoc })`.
- Nếu trùng/khả nghi, frontend hiển thị cảnh báo đỏ trước khi lưu bước kê đơn.
- Backend cũng kiểm tra lại để chống bỏ qua frontend.
- Cho phép bác sĩ override có lý do nếu chỉ là cảnh báo mềm.

### Câu trả lời có dẫn chứng

“Hiện bác sĩ đã nhìn thấy dị ứng trong phiên khám, nhưng hệ thống chưa tự đối chiếu dị ứng với thuốc kê. Bằng chứng là `ExamSessionPage` hiển thị `di_ung`, còn `examSession.service.js` phần kê đơn chỉ lưu `payload.thuoc`. Nâng cấp cần thêm rule cảnh báo dị ứng ở cả FE và BE.”

## 8. B50 và C70 - Từ chối/không thanh toán dịch vụ phát sinh

### Hiện hệ thống đã có

- Model `KetQuaKham` có `dich_vu_phat_sinh`: `backend/src/models/KetQuaKham.js:107`.
- Model có `dich_vu_tu_choi`, nhưng comment ghi rõ “hiện chưa có luồng dùng”: `backend/src/models/KetQuaKham.js:111-112`.
- Exam session validate và lưu dịch vụ phát sinh theo chuyên khoa: `backend/src/services/examSession.service.js:66-88`, `backend/src/services/examSession.service.js:313-315`.
- Billing lấy `dich_vu_phat_sinh` làm dịch vụ chỉ định: `backend/src/controllers/receptionist/billing.controller.js:247`.
- UI thanh toán có pending payment, confirm/cancel chuyển khoản: `frontend/src/pages/receptionist/Payments.tsx:203-214`, `frontend/src/pages/receptionist/Payments.tsx:548-568`.
- Backend billing có confirm/cancel transfer: `backend/src/routes/receptionist/billing.routes.js:9-10`, `backend/src/controllers/receptionist/billing.controller.js:423-452`.

### Khoảng trống

Hệ thống xử lý được “chưa thanh toán”/“hủy giao dịch chuyển khoản”, nhưng chưa xử lý nghiệp vụ “bệnh nhân từ chối dịch vụ bác sĩ chỉ định” hoặc “không đủ tiền nên không làm dịch vụ”. Field `dich_vu_tu_choi` tồn tại nhưng chưa có luồng dùng.

### Nâng cấp cần làm

- Gõ kiểu `dich_vu_tu_choi` bằng sub-schema: `service_id`, `ten`, `so_luong`, `gia`, `ly_do`, `nguoi_ghi_nhan_id`, `thoi_diem`.
- UI lễ tân trên màn thanh toán có nút “Bệnh nhân từ chối dịch vụ”.
- Nếu từ chối, billing loại dòng đó khỏi hóa đơn hoặc ghi dòng giảm trừ rõ ràng.
- Bác sĩ vẫn thấy lịch sử: đã chỉ định nhưng bệnh nhân từ chối.

### Câu trả lời có dẫn chứng

“Hệ thống đã tính phí dịch vụ phát sinh và có thanh toán pending/cancel. Tuy nhiên field `dich_vu_tu_choi` trong model đang được comment là chưa có luồng dùng. Vì vậy với tình huống bệnh nhân từ chối dịch vụ, nhóm cần nâng cấp thao tác ghi nhận từ chối để không nhầm với bác sĩ chưa chỉ định.”

## 9. B54 và B55 - Đính chính hồ sơ sau khi đã xác nhận/thanh toán

### Hiện hệ thống đã có

- `KetQuaKham.status` có các trạng thái `ban_nhap`, `cho_xac_nhan`, `da_xac_nhan`, `yeu_cau_chinh_sua`: `backend/src/models/KetQuaKham.js:76-78`.
- Model có `co_the_sua` và `lich_su_sua`: `backend/src/models/KetQuaKham.js:106`, `backend/src/models/KetQuaKham.js:128`.
- Luồng cũ `updateResult` chặn sửa trực tiếp nếu hồ sơ đã `da_xac_nhan`: `backend/src/controllers/doctor/appointments.controller.js:681-694`.
- Controller có audit revision: `backend/src/controllers/doctor/appointments.controller.js:414-441`, `backend/src/controllers/doctor/appointments.controller.js:712-723`.
- Có endpoint yêu cầu chỉnh sửa khi hồ sơ đang `cho_xac_nhan`: `backend/src/routes/doctor/appointments.routes.js:22`, `backend/src/controllers/doctor/appointments.controller.js:839-874`.

### Khoảng trống

Luồng exam-session 4 bước có chặn khi `hoSo.status === 'da_xac_nhan' && hoSo.co_the_sua === false`: `backend/src/services/examSession.service.js:269`. Nhưng `co_the_sua` mặc định `true` ở model, nên cần kiểm chứng/chuẩn hóa việc khóa sau khi hoàn tất phiên khám. Hoàn tất phiên khám set `status: 'da_xac_nhan'`: `backend/src/services/examSession.service.js:427-428`, nhưng không thấy set `co_the_sua: false` trong đoạn complete.

### Nâng cấp cần làm

- Khi complete exam-session, set `co_the_sua=false` hoặc chặn mọi `saveStep` nếu status đã `da_xac_nhan`.
- Thêm endpoint `medical-amendments` để bác sĩ tạo bản đính chính sau xác nhận.
- Bản đính chính không sửa âm thầm bản cũ; lưu version, lý do, trường thay đổi.
- Nếu thay đổi ảnh hưởng dịch vụ/chi phí, tạo task cho lễ tân xử lý lại hóa đơn.

### Câu trả lời có dẫn chứng

“Luồng cũ đã chặn sửa hồ sơ `da_xac_nhan`, nhưng luồng khám 4 bước cần chuẩn hóa khóa sửa sau complete. Cách trả lời chắc là: hiện hệ thống có audit và trạng thái xác nhận; phần nâng cấp là biến sửa sau xác nhận thành quy trình đính chính có version, lý do và liên kết thanh toán nếu phát sinh.”

## 10. B57 - Bác sĩ đưa nhầm bệnh nhân vào phòng

### Hiện hệ thống đã có

- Bác sĩ có nút đưa bệnh nhân vào phòng trên queue: `frontend/src/pages/doctor/DoctorExamQueue.tsx:359-374`.
- Khi ở `trong_phong`, UI chỉ cho mở phiên khám 4 bước: `frontend/src/pages/doctor/DoctorExamQueue.tsx:380-389`.
- Lễ tân bị chặn đóng lượt khi đã `trong_phong`: `backend/src/services/queueCancel.service.js:42-45`.
- Queue transfer cũng chỉ cho chuyển khi còn `dang_cho`: `backend/src/services/queueTransfer.service.js:42-43`.

### Khoảng trống

Nếu bác sĩ bấm nhầm “vào phòng” nhưng chưa nhập chuyên môn, hiện chưa thấy action rollback “trả khỏi phòng do nhầm”. Hệ thống đang bảo vệ dữ liệu bằng cách khóa lễ tân, nhưng thiếu đường sửa lỗi hợp lệ cho bác sĩ/admin.

### Nâng cấp cần làm

- Thêm action `return-from-room-before-exam`.
- Chỉ cho dùng khi chưa có `KetQuaKham` hoặc chưa lưu bước chuyên môn.
- Bắt buộc lý do và audit.
- Cập nhật room status nếu phòng không còn bệnh nhân.

### Câu trả lời có dẫn chứng

“Hệ thống hiện bảo vệ trạng thái `trong_phong`: lễ tân không hủy/chuyển được nữa. Nhưng nếu bác sĩ đưa nhầm bệnh nhân vào phòng trước khi nhập hồ sơ, cần thêm thao tác rollback có audit. Đây là nâng cấp để xử lý lỗi thao tác mà không mở khóa bừa cho lễ tân.”

## 11. C62 - Lễ tân check-in/chuyển nhầm bác sĩ

### Hiện hệ thống đã có

- Route chuyển bác sĩ cho queue: `backend/src/routes/receptionist/queue.routes.js:6`.
- Bắt buộc nhập lý do chuyển: `backend/src/services/queueTransfer.service.js:21-24`.
- Chỉ chuyển khi lượt còn `dang_cho`: `backend/src/services/queueTransfer.service.js:42-43`.
- Cập nhật lịch sử `queue_transfer` và audit: `backend/src/services/queueTransfer.service.js:92-95`, `backend/src/services/queueTransfer.service.js:114-129`.
- Emit realtime cho bác sĩ cũ và mới: `backend/src/services/queueTransfer.service.js:134-135`.
- UI dashboard có nút “Chuyển bác sĩ” khi lượt `dang_cho`: `frontend/src/pages/receptionist/Dashboard.tsx:366-380`.

### Khoảng trống

Đối với lượt đã `da_goi` hoặc `trong_phong`, hệ thống không cho chuyển. Điều này đúng để tránh xung đột, nhưng nếu check-in nhầm bác sĩ rồi đã gọi bệnh nhân, cần quy trình rollback/chuyển có kiểm soát.

### Nâng cấp cần làm

- Giữ rule hiện tại cho an toàn.
- Bổ sung action cho `da_goi`: chuyển về `dang_cho` rồi chuyển bác sĩ, bắt buộc lý do.
- Với `trong_phong`: chỉ bác sĩ/admin có quyền trả khỏi phòng nếu chưa nhập khám.

### Câu trả lời có dẫn chứng

“Hệ thống đã có chuyển bác sĩ cho lượt còn chờ và có audit/realtime. Khi đã gọi hoặc vào phòng thì hiện bị chặn để tránh rối phiên khám. Nâng cấp cần làm là thêm quy trình sửa nhầm có kiểm soát cho trạng thái `da_goi` và `trong_phong`.”

## 12. C69 - Gọi bệnh nhân quay lại phòng

### Hiện hệ thống đã có

- Hàng đợi có các trạng thái gọi/vào phòng/bỏ lượt/đã xong: `frontend/src/pages/doctor/DoctorExamQueue.tsx:56-63`.
- Bác sĩ có action gọi/vào phòng/bỏ lượt qua queue: `backend/src/routes/doctor/queue.routes.js`.
- Hệ thống có contact tasks cho lễ tân: `frontend/src/pages/receptionist/ContactTasks.tsx`, route `backend/src/routes/receptionist/contact-tasks.routes.js`.

### Khoảng trống

Chưa thấy trạng thái riêng kiểu `can_goi_lai`, `callback`, `recall_after_exam`. Contact task hiện thiên về lịch hẹn/báo khách, không phải yêu cầu bác sĩ gọi bệnh nhân quay lại phòng sau khi đã hoàn tất hoặc rời phòng.

### Nâng cấp cần làm

- Thêm action `request-patient-callback` trong exam session.
- Tạo notification/contact task cho lễ tân.
- Thêm trạng thái queue phụ hoặc task riêng: `can_goi_lai`.
- Lưu lý do gọi lại và deadline.

### Câu trả lời có dẫn chứng

“Hiện hệ thống có queue và contact task, nhưng chưa có trạng thái callback riêng. Vì vậy nếu bác sĩ cần gọi bệnh nhân quay lại, quy trình hiện tại phải xử lý thủ công qua lễ tân; nâng cấp đúng là tạo task callback có lý do và trạng thái theo dõi.”

## 13. C75 - Lễ tân chọn sai hồ sơ, bác sĩ phát hiện trước khám

### Hiện hệ thống đã có

- Lễ tân search theo số điện thoại và có thể có nhiều hồ sơ: `backend/src/controllers/receptionist/patient-intake.controller.js:312-338`.
- Khi tạo hồ sơ mới, code ghi chú không gộp tự động chỉ vì trùng số điện thoại: `backend/src/controllers/receptionist/patient-intake.controller.js:534-537`.
- Hàng đợi có cancel/transfer như các mục trên.

### Khoảng trống

Chưa thấy endpoint “đổi `ho_so_benh_nhan_id` của một lượt chờ” trước khi vào phòng. Nếu chọn sai hồ sơ, hiện cách an toàn là hủy lượt sai và tạo lại lượt đúng, nhưng thao tác này chưa được đóng gói thành một luồng rõ ràng.

### Nâng cấp cần làm

- Thêm action `replace-queue-patient-profile`.
- Chỉ cho khi lượt chưa `trong_phong` và chưa có kết quả khám.
- Backend kiểm tra hồ sơ mới có phù hợp số điện thoại/người bệnh.
- Audit hồ sơ cũ, hồ sơ mới, lý do, người sửa.

### Câu trả lời có dẫn chứng

“Hệ thống đã tránh tự gộp hồ sơ và có hủy/chuyển lượt có audit. Tuy nhiên chưa có action đổi hồ sơ gắn với lượt chờ. Cách xử lý hiện tại là hủy lượt sai, tạo lượt đúng; nâng cấp sẽ làm thành chức năng thay hồ sơ trước khi vào phòng.”

## 14. D78 - Cấp cứu tại quầy

### Hiện hệ thống đã có

- `HangDoi` có `muc_uu_tien_tiep_nhan` với enum `binh_thuong`, `uu_tien`, `cap_cuu`: `backend/src/models/HangDoi.js:120-122`.
- Khi đưa vào hàng đợi trung tâm có lưu mức ưu tiên: `backend/src/services/centralOfflineQueue.service.js:445`.
- Điều phối hàng đợi có sắp theo mức ưu tiên, trong đó `cap_cuu` ưu tiên cao nhất: `backend/src/services/centralOfflineQueue.service.js:490-491`.

### Khoảng trống

Mức ưu tiên `cap_cuu` mới là ưu tiên trong hàng đợi, chưa phải quy trình cấp cứu đầy đủ. Chưa thấy:

- nút khẩn cấp riêng ở UI,
- thông báo khẩn cho bác sĩ/lễ tân,
- biên bản ca cấp cứu,
- outcome cấp cứu trong hồ sơ khám.

### Nâng cấp cần làm

- UI lễ tân có nút “Cấp cứu/ưu tiên khẩn”.
- Khi chọn phải nhập lý do, dấu hiệu, người xác nhận.
- Gửi notification realtime tới bác sĩ/nhân sự phụ trách.
- Báo cáo ca khẩn cuối ngày.

### Câu trả lời có dẫn chứng

“Hệ thống đã có mức ưu tiên `cap_cuu` trong hàng đợi và sắp xếp ưu tiên cấp cứu lên trước. Nhưng đó chưa phải quy trình cấp cứu y tế hoàn chỉnh. Nâng cấp cần thêm nút khẩn, thông báo, biên bản và outcome cấp cứu.”

## 15. D80 - Chuyển viện/cấp cứu bên ngoài

### Hiện hệ thống đã có

- Phiên khám có các bước tiếp nhận, chẩn đoán, dịch vụ, kê đơn, xác nhận: `frontend/src/pages/doctor/ExamSessionPage.tsx:18-25`.
- Model kết quả khám có status hồ sơ và bước hiện tại: `backend/src/models/KetQuaKham.js:76-86`.

### Khoảng trống

Không thấy field outcome kiểu `chuyen_vien`, `cap_cuu_ngoai_vien`, `noi_chuyen_den`, `ly_do_chuyen_vien` trong `KetQuaKham`. Các search liên quan chủ yếu xuất hiện ở hàng đợi ưu tiên hoặc chatbot, không phải kết quả khám.

### Nâng cấp cần làm

- Thêm outcome khám: `dieu_tri_thuong`, `chuyen_chuyen_khoa`, `chuyen_vien`, `cap_cuu_ngoai_vien`.
- Nếu chọn chuyển viện: nhập nơi chuyển, lý do, tình trạng lúc chuyển, giấy tờ kèm theo.
- Lễ tân nhận task giấy tờ/thanh toán đặc biệt nếu có.

### Câu trả lời có dẫn chứng

“Hiện kết quả khám mới có trạng thái hồ sơ và bước khám, chưa có outcome chuyển viện. Vì vậy nếu ca khám cần chuyển viện, bác sĩ có thể ghi trong hướng dẫn/ghi chú, nhưng hệ thống chưa báo cáo được như một loại kết quả riêng. Đây là mục nâng cấp quan trọng cho tính thực tế y tế.”

## 16. D81 - Bệnh nhân không có số điện thoại

### Hiện hệ thống đã có

- Model `HoSoBenhNhan` cho phép `so_dien_thoai` null: `backend/src/models/HoSoBenhNhan.js:6`.
- Nhưng luồng tạo hồ sơ tại lễ tân bắt số điện thoại hợp lệ: `backend/src/controllers/receptionist/patient-intake.controller.js:502-506`.
- Luồng hàng đợi trung tâm chặn hồ sơ không có số điện thoại: `backend/src/services/centralOfflineQueue.service.js:386`.
- Model `HangDoi` bắt offline phải có số điện thoại: `backend/src/models/HangDoi.js:186-187`.
- UI tiếp nhận validate số điện thoại khi tìm/tạo: `frontend/src/pages/receptionist/PatientIntake.tsx:440-441`, `frontend/src/pages/receptionist/PatientIntake.tsx:496-505`.

### Khoảng trống

Đây là bằng chứng rõ: dù model hồ sơ cho phép null, luồng lễ tân và hàng đợi offline đang bắt buộc số điện thoại. Nếu bệnh nhân không có/không nhớ số, hệ thống hiện chưa tiếp nhận được theo luồng chuẩn.

### Nâng cấp cần làm

- Thêm hồ sơ tạm `temporary_profile`.
- Cho phép tiếp nhận bằng họ tên + năm sinh + giới tính + ghi chú nhận diện.
- Sinh mã tạm, ví dụ `TEMP-YYYYMMDD-xxx`.
- Sau đó cho lễ tân cập nhật số điện thoại hoặc gộp vào hồ sơ chính.

### Câu trả lời có dẫn chứng

“Hiện hệ thống chưa hỗ trợ tốt bệnh nhân không có số điện thoại. Bằng chứng là backend tạo hồ sơ và hàng đợi offline đều bắt buộc số điện thoại. Nâng cấp cần làm là hồ sơ tạm có mã định danh tạm, sau đó bổ sung/gộp thông tin khi xác minh được.”

## 17. D82 - Quyền riêng tư người đi cùng/người đặt hộ

### Hiện hệ thống đã có

- Search lễ tân lấy được quan hệ thành viên gia đình: `backend/src/controllers/receptionist/patient-intake.controller.js:338`.
- Lịch hẹn lưu được người đặt hộ/số điện thoại người đặt: `backend/src/models/LichHen.js:74`, và thời điểm đồng ý điều khoản: `backend/src/models/LichHen.js:109`.
- UI và controller phân biệt người đặt và người bệnh thật trong luồng tiếp nhận.

### Khoảng trống

Chưa thấy field riêng cho:

- người đi cùng tại quầy,
- quan hệ người đi cùng với bệnh nhân trong lượt khám,
- bệnh nhân có đồng ý chia sẻ thông tin y tế hay không,
- phạm vi thông tin được chia sẻ.

### Nâng cấp cần làm

- Thêm `nguoi_di_cung` vào `HangDoi` hoặc một collection consent riêng.
- Các field: họ tên, số liên hệ, quan hệ, giấy tờ nếu cần, `dong_y_chia_se_thong_tin`, phạm vi chia sẻ.
- UI lễ tân chỉ hiển thị/tư vấn dữ liệu nhạy cảm theo consent.
- Audit khi lễ tân ghi nhận hoặc thay đổi consent.

### Câu trả lời có dẫn chứng

“Hệ thống hiện có mô hình người đặt hộ và quan hệ thành viên gia đình, nhưng chưa có consent riêng cho người đi cùng tại quầy. Vì dữ liệu y tế nhạy cảm, nâng cấp cần thêm xác nhận đồng ý chia sẻ thông tin và phạm vi chia sẻ.”

## 18. Ưu tiên triển khai đề xuất

| Ưu tiên | Mục | Lý do |
|---|---|---|
| Cao | B47 cảnh báo dị ứng thuốc | Liên quan trực tiếp an toàn bệnh nhân. |
| Cao | B54/B55 đính chính hồ sơ sau xác nhận | Liên quan pháp lý, audit và tính toàn vẹn hồ sơ y tế. |
| Cao | D81 hồ sơ tạm không có số điện thoại | Tình huống thực tế tại quầy, hiện backend đang chặn. |
| Cao | D78/D80 cấp cứu và chuyển viện | Tăng tính thực tế y tế khi bảo vệ. |
| Trung bình | B50/C70 từ chối dịch vụ phát sinh | Liên quan thanh toán và tránh tranh chấp. |
| Trung bình | A18/D79 chuyển chuyên khoa | Hay gặp khi bệnh nhân chọn sai chuyên khoa. |
| Trung bình | A24 gộp hồ sơ | Quan trọng khi dữ liệu gia đình/trùng số điện thoại nhiều. |
| Trung bình | B57/C62/C75 sửa nhầm queue/hồ sơ/bác sĩ | Giảm rủi ro thao tác sai trong vận hành. |
| Thấp-Trung bình | A30 offline recovery | Quan trọng về vận hành, nhưng có thể mô tả bằng quy trình thủ công trước khi code. |
| Thấp-Trung bình | C69 callback bệnh nhân | Hữu ích nhưng không phải luồng lõi. |
| Thấp | A28 lễ tân khôi phục lịch hủy | Có thể giữ quyền admin hoặc tạo lịch mới từ lịch cũ. |

## 19. Cách dùng tài liệu này khi bảo vệ

Khi hội đồng hỏi một mục chưa hoàn thiện, không nên trả lời “hệ thống có hết”. Cách trả lời chắc hơn:

1. Nêu phần đã có bằng chứng trong hệ thống.
2. Nêu giới hạn hiện tại.
3. Nêu phương án nâng cấp cụ thể.
4. Giải thích vì sao thiết kế hiện tại vẫn an toàn hơn việc mở quyền tùy tiện.

Ví dụ ngắn:

“Tình huống bệnh nhân không có số điện thoại hiện hệ thống chưa hỗ trợ đầy đủ. Bằng chứng là backend tiếp nhận offline đang bắt buộc `so_dien_thoai`. Nhóm không nói là đã có, mà đề xuất nâng cấp hồ sơ tạm có mã định danh, sau đó cập nhật hoặc gộp khi xác minh được. Như vậy vừa xử lý được ca thực tế, vừa tránh tạo hồ sơ rác hoặc trùng không kiểm soát.”

