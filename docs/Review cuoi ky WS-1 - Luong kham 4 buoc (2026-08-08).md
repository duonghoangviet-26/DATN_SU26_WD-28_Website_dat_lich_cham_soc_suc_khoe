# Review cuối kỳ — WS-1: Luồng khám 4 bước (2026-08-08)

> Thi công bằng subagent-driven-development, 9 task riêng biệt + review từng task + 1 review toàn nhánh cuối kỳ + 1 vòng sửa + 1 review lại phạm vi hẹp.
> Plan: `docs/Ke hoach WS-1 - Luong kham 4 buoc (2026-08-08).md`
> Phạm vi review toàn nhánh: `2803163..debb66b` (backend + frontend, 10 commit), sau đó 1 fix `4c37ffb` + review lại `debb66b..4c37ffb`.

## Kết quả

**Ready to merge: Có, sau 1 vòng sửa 2 lỗi xuyên-task nghiêm trọng.**

Kiến trúc lõi đúng như thiết kế: `KetQuaKham.buoc_hien_tai` làm máy trạng thái, `examSession.service.js` là nơi ghi duy nhất cho luồng mới, con trỏ chỉ tiến không lùi, bác sĩ không chạm tiền (Q2), bệnh nhân không rời phòng giữa chừng (Q1) — tất cả đã kiểm chứng độc lập nhiều lần qua các task và qua review cuối kỳ, không phát sinh vi phạm.

## Lỗi nghiêm trọng phát hiện ở review cuối kỳ, đã sửa (commit `4c37ffb`)

### 1. Bệnh nhân đặt online bị kẹt vĩnh viễn — KHÔNG có đường thoát (Critical)

`getOwnedOfflineQueue` lọc `nguon: 'offline'`, được luồng 4 bước mới kế thừa nguyên vẹn từ Task 3. Nhưng `DoctorExamQueue.tsx` (Task 9) lại đưa **mọi** bệnh nhân `trong_phong` — kể cả đặt online — vào thẳng luồng mới, không lọc theo `nguon`. Nút cũ còn dùng được cho ca online (`finishQueue`) đã bị gỡ trong cùng commit. Kết quả: bệnh nhân đặt online bấm "Vào phòng" → 404 "Khong tim thay luot kham offline" → không còn cách nào kết thúc ca khám.

**Nguyên nhân xuyên-task:** không task nào tự review ra được — Task 3 xác nhận đúng là trích nguyên văn, Task 9 xác nhận đúng là chỉ đổi nhánh `trong_phong`. Lỗi chỉ lộ ra ở chỗ nối giữa hai task.

**Cách sửa:** Điều tra xác nhận `nguon:'offline'` **vẫn cần thiết** ở 3 endpoint cũ (không phải ~10 như ước tính ban đầu) — vì `KetQuaKham` có 2 index unique độc lập (`appointment_id`, `hang_doi_id`) và không gì khác ngăn 1 lịch hẹn có 2 hồ sơ song song qua 2 đường cũ. Giữ nguyên `getOwnedOfflineQueue` + 3 call site cũ, thêm hàm dùng chung mới (cờ `chiOffline`) chỉ dùng cho `layPhienKham`/`luuBuoc`/`hoanTatPhienKham`. Kèm theo: `taoNhapNeuChua` nay gắn thêm `appointment_id` cho hồ sơ online (bắt buộc để bệnh nhân xem được kết quả và lễ tân lập được hóa đơn), có chặn 409 rõ ràng nếu lịch hẹn đã có hồ sơ từ luồng cũ.

### 2. Hoàn tất ca khám không nhả phòng (Important)

`hoanTatPhienKham` chỉ đổi `HangDoi` → `hoan_thanh`, không đụng `TrangThaiPhongKham` như `finish()` cũ vẫn làm. Phòng ở lại `dang_kham`, `benh_nhan_hien_tai_id` vẫn trỏ vào ca vừa xong → bệnh nhân kế tiếp "Vào phòng" sẽ bị 409 "Phòng chưa sẵn sàng".

**Cách sửa:** Thêm logic nhả phòng vào trong transaction có sẵn của `hoanTatPhienKham`, mô phỏng đúng `finish()`: `dang_don_phong`, xóa `benh_nhan_hien_tai_id`, cập nhật trung bình động `thoi_gian_kham_tb_phut`. 2 điểm khác biệt có chủ đích so với `finish()`, đã kiểm chứng hợp lý: (a) phòng lệch trạng thái thì **bỏ qua** bước nhả thay vì chặn cả việc hoàn tất (hồ sơ đã ghi xong, chặn sẽ kẹt bác sĩ); (b) dùng `updateOne` thay vì `.save()` — tránh đúng loại lỗi Mongoose mà `finish()` gốc đang mắc (retry trong `withTransaction` với giá trị gán y hệt không được đánh dấu "đã đổi", `.save()` sẽ bỏ qua).

**Kiểm chứng:** e2e mở rộng từ 36 lên 59 assertion (thêm nhóm 12 — luồng online chạy hết 4 bước, thêm kiểm nhả phòng ở nhóm 9/10). 59/59 đạt trên `DATN_VITAFAMILY_CLAUDE_TEST`. `npm test` 142/145, 3 lỗi giống hệt từ trước (không liên quan).

**Review lại phạm vi hẹp:** đã kiểm độc lập từng khẳng định trong báo cáo implementer (không tin lời báo cáo) bằng cách đọc trực tiếp `appointments.controller.js`, `patient/records.controller.js`, `billing.controller.js`, `room-status.controller.js`, `queue.controller.js`'s `finish()`, và model `KetQuaKham`/`SinhHieuKham`/`TrangThaiPhongKham`/`LichHen` — mọi khẳng định đều đúng, không phát sinh lỗi Critical/Important mới.

## Việc theo dõi (chưa sửa, không chặn merge)

1. **Audit `CHANGE_DOCTOR_STATUS` có thể ghi sai nếu phòng lệch đúng lúc write** — gate theo snapshot đọc trước transaction, không theo `matchedCount` thực tế của `updateOne`. Cửa sổ rất hẹp, phòng chỉ 1 bác sĩ dùng.
2. **Nhánh bỏ-qua-nhả-phòng hoàn toàn im lặng** — không audit, không `console.warn`. Nên thêm 1 dòng cảnh báo để có manh mối nếu phòng từng bị kẹt.
3. **Vệt audit hàng đợi mỏng hơn `finish()`** — luồng mới không còn ghi dòng kiểu `ghiAuditQueue('CALL_PATIENT', ...)` mà `finish()` cũ có, dù đã có `DOCTOR_COMPLETE_EXAM` + `CHANGE_DOCTOR_STATUS`.
4. **3 endpoint flat-form cũ vẫn "không thân thiện" với ca online** (đúng theo thiết kế hiện tại) — nếu sau này có tính năng mới trên trang hàng đợi chạm vào các endpoint này cho ca online, sẽ gặp lại đúng loại lỗi C1.
5. **`taoNhapNeuChua`'s 409 mới không có đường khắc phục trong app** nếu dữ liệu cũ (lịch hẹn online đã có hồ sơ từ luồng flat-form cũ) còn tồn tại — nút "Kết thúc khám" cũ đã bị gỡ. Nên đếm thử số bản ghi kiểu này trên DB demo trước khi trình bày.
6. **`dang_don_phong` vẫn cần bác sĩ bấm tay "Sẵn sàng"** trước khi nhận bệnh nhân kế tiếp — giống hệt hành vi `finish()` cũ, không phải lỗi mới, nhưng màn xác nhận của luồng mới là chỗ hợp lý để nhắc thao tác này vì bác sĩ không còn đi qua trang hàng đợi giữa 2 ca.
7. Vài mục Minor khác (M3–M5 từ review đầu, cộng 7 mục nhỏ từ review sửa lỗi — xem `progress.md` trong workspace SDD để có danh sách đầy đủ với file:line).

## Đã kiểm chứng lại (không phải lỗi mới, không suy giảm)

- Chuỗi interface xuyên suốt 9 task (`CAC_BUOC`, enum schema, route param, type FE, tên field `huong_dan_dieu_tri`) khớp byte-identical ở mọi điểm.
- Ranh giới tiền (Q2): không có đường nào để giá do client gửi lọt vào — đã dò lại toàn bộ chuỗi `StepDichVu` → `luuBuoc` → `taoChiDinhDichVu` → `StepXacNhan` → `hoanTatPhienKham`.
- Ranh giới phòng/hàng đợi (Q1): không có điểm ghi `HangDoi.trang_thai` nào ngoài đúng 1 chỗ trong `hoanTatPhienKham`.
- Audit `DOCTOR_COMPLETE_EXAM` (gap tự phát hiện trong self-review của plan) đã triển khai đúng, không trùng lặp.
- Hai luồng ghi `KetQuaKham` (cũ + mới) không thể tạo hồ sơ trùng cho cùng 1 lịch hẹn theo cả 2 chiều, sau khi thêm chặn 409 ở `taoNhapNeuChua`.
- Không circular import khi gắn logic nhả phòng vào `examSession.service.js`.
- Không đụng `.claude/rules/lich-lam-viec-bac-si.md` hay bất kỳ quy tắc đặt lịch/hàng đợi đông cứng nào trong toàn bộ 11 commit của workstream.

## Bài học cho các workstream sau

Cả 2 lỗi nghiêm trọng đều là loại mà **review từng task không thể bắt được** — chúng nằm ở đường nối giữa một luồng ghi mới và cỗ máy trạng thái phòng/hàng đợi có sẵn mà nó âm thầm thay thế. Bước "kiểm bằng mắt toàn luồng" (Task 9 Step 7) đáng lẽ sẽ bắt được cả hai ngay lập tức, nhưng không thực hiện được do rủi ro DB dùng chung (đã ghi nhận, không phải lỗi thi công). Khuyến nghị: với các workstream sau này thay thế một luồng nghiệp vụ có sẵn (không chỉ thêm luồng mới), ưu tiên chuẩn bị 1 DB TEST cô lập sẵn từ đầu để bước kiểm bằng mắt không bị chặn bởi rủi ro DB chia sẻ.
