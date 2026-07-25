# Prompt triển khai Slot online và hàng đợi khám theo từng phase

## 1. Mục đích

Tài liệu này là prompt điều khiển việc triển khai luồng:

`LichHen -> Thanh toán phí khám -> Check-in -> HangDoi -> Vào phòng -> Thanh toán dịch vụ phát sinh -> Hoàn thành`

Đây là luồng nghiệp vụ quan trọng. Mỗi phase phải được triển khai, kiểm thử, báo cáo chứng cứ và **dừng hoàn toàn**. Chỉ được chuyển sang phase tiếp theo khi người dùng trả lời rõ ràng rằng đã đồng ý.

Không được tự động triển khai nhiều phase trong cùng một lượt. Không được coi việc build thành công là đủ để kết luận nghiệp vụ đã PASS.

## 2. Nguồn sự thật bắt buộc

Trước khi làm bất kỳ phase nào, phải đọc lại:

1. `docs/phuong-an-phan-bo-slot-online-va-hang-doi-thuc-te.md`.
2. Tài liệu này.
3. Model, service, controller, route, frontend service và UI hiện có liên quan trực tiếp đến phase.
4. Các test hiện có liên quan trực tiếp.

Khi tài liệu và code hiện tại không khớp nhau:

- Không tự chọn một bên rồi sửa.
- Phải nêu rõ điểm không khớp bằng file, dòng code và tác động.
- Nếu quy tắc đã được chốt trong mục 3 của tài liệu này thì lấy quy tắc đã chốt làm chuẩn.
- Nếu chưa có quy tắc đủ cụ thể để triển khai an toàn thì đánh dấu `BLOCKED`, không code phần đó và hỏi người dùng.

## 3. Sáu quyết định nghiệp vụ đã chốt

### 3.1. Thanh toán

- `phi_kham` phải được thanh toán trước khi tạo `HangDoi`.
- Check-in phải kiểm tra trạng thái thanh toán phí khám trong cùng transaction tạo `HangDoi`.
- Dịch vụ phát sinh trong buổi khám phải được thanh toán trước khi `HangDoi` chuyển sang `hoan_thanh`.
- Không được thu lại phí khám nếu lịch online đã thanh toán hợp lệ.

### 3.2. Grace period

- Mặc định toàn hệ thống là **10 phút**.
- Giá trị phải cấu hình được.
- Có thể ghi đè theo bác sĩ hoặc buổi khám.
- Không được lưu hoặc diễn giải thành khoảng `10-15 phút`.

### 3.3. Quyền của y tá

- Y tá chỉ được `skip/bo_luot`.
- Y tá không được `cancel` lịch hẹn.
- `skip` chỉ thay đổi `HangDoi`, không thay đổi `LichHen`.
- Lý do skip bắt buộc thuộc một trong các nhóm:
  - `khong_co_mat_khi_goi`
  - `tu_roi_di`
  - `yeu_cau_doi_gio`
- Lễ tân và Admin được skip.
- Chỉ Lễ tân và Admin được hủy `LichHen`.

### 3.4. Vượt capacity

- Lễ tân không được vượt tổng capacity.
- Lễ tân chỉ được sử dụng quota mềm chưa dùng, nhưng tổng số tiếp nhận không được vượt capacity.
- Bác sĩ không override trực tiếp trên hệ thống.
- Chỉ Admin được override tổng capacity.
- Giới hạn sau override là:

  `max_total = floor(capacity * 1.15)`

- Admin phải chọn một lý do cố định:
  - `bac_si_dong_y_nhan_them`
  - `cap_cuu_uu_tien_y_te`
  - `su_co_ky_thuat`
- Admin phải nhập thêm ghi chú tự do.
- Nhật ký phải lưu người thực hiện, thời điểm, capacity gốc, giới hạn mới, lý do và ghi chú.

### 3.5. Hoàn tác check-in

- Chỉ Lễ tân hoặc Admin được hoàn tác check-in.
- Chỉ được hoàn tác khi `HangDoi` vẫn ở trạng thái nghiệp vụ `cho_kham`, chưa vào phòng.
- Không được hoàn tác khi đã `trong_phong` hoặc `hoan_thanh`.
- Không xóa cứng `HangDoi`.
- `HangDoi` phải chuyển sang `huy_check_in`.
- `LichHen` phải quay lại đúng trạng thái trước check-in.
- Bắt buộc lưu lý do, người thực hiện, thời điểm, trạng thái cũ và trạng thái mới.

### 3.6. Dữ liệu `HangDoi` offline cũ

- Không xóa bất kỳ dữ liệu cũ nào.
- Bản ghi đủ bệnh nhân, bác sĩ, ngày và giờ được migrate một lần:
  - Tạo `LichHen` hồi tố.
  - Đặt `nguon = tai_cho`.
  - Đặt `nguon_du_lieu = migrated`.
  - Liên kết lại `HangDoi`.
- Bản ghi thiếu dữ liệu tối thiểu:
  - Không suy diễn dữ liệu.
  - Chuyển sang kho lưu trữ `HangDoi_Archive`.
  - Không hiển thị trong hàng đợi hoặc thống kê vận hành mới.
- Migration phải có chế độ dry-run, idempotent và có báo cáo trước/sau.

## 4. Quy tắc làm việc bắt buộc cho mọi phase

### 4.1. Trước khi sửa code

1. Đọc lại phạm vi phase hiện tại.
2. Kiểm tra `git status` và bảo toàn mọi thay đổi có sẵn của người dùng.
3. Tìm đầy đủ nơi đọc/ghi dữ liệu liên quan bằng `rg`.
4. Ghi ra hiện trạng có dẫn chứng file và dòng.
5. Liệt kê chính xác file dự kiến sửa và lý do.
6. Xác nhận không có quyết định nghiệp vụ chưa rõ.
7. Chỉ sau đó mới được sửa code trong phạm vi phase.

### 4.2. Trong khi sửa code

- Không sửa ngoài phạm vi phase.
- Không refactor diện rộng nếu không bắt buộc.
- Không đổi tên trạng thái hoặc field hàng loạt khi chưa có bảng ánh xạ được duyệt.
- Không xóa dữ liệu thật.
- Không chạy migration ghi dữ liệu thật trước khi dry-run PASS.
- Mọi thao tác nhiều collection ảnh hưởng tính nhất quán phải dùng transaction.
- Mọi kiểm tra capacity, quota và check-in trùng phải an toàn khi có request đồng thời.
- Mọi hành động có tác động tài chính hoặc thay đổi thứ tự phải có audit.
- Không che lỗi bằng fallback tạo dữ liệu giả.

### 4.3. Kiểm thử

Mỗi phase phải có đủ các lớp kiểm tra phù hợp:

1. Test tự động cho logic nghiệp vụ.
2. Test API/integration với database test cô lập.
3. Test transaction rollback.
4. Test đồng thời cho các invariant có nguy cơ race condition.
5. Test phân quyền cho từng vai trò liên quan.
6. Frontend phải chạy test, typecheck, lint và build nếu phase có sửa frontend.
7. Luồng giao diện phải được kiểm tra bằng trình duyệt ở vai trò liên quan nếu phase có UI.
8. Kiểm tra lại `git diff` để phát hiện thay đổi ngoài phạm vi.

Các lệnh nền của repo:

```powershell
cd backend
npm test
```

```powershell
cd frontend
npm test
npm run typecheck
npm run lint
npm run build
```

Không được dùng database production để chạy test. Không được in secret hoặc chuỗi kết nối database trong báo cáo.

### 4.4. Chứng cứ PASS hợp lệ

Chứng cứ phải bao gồm:

- Lệnh đã chạy.
- Exit code.
- Số test PASS/FAIL.
- Tên các test nghiệp vụ quan trọng.
- Kết quả trước/sau đối với migration hoặc dữ liệu.
- Request và response API mẫu đã loại bỏ dữ liệu nhạy cảm.
- Bằng chứng không phát sinh bản ghi trùng hoặc trạng thái lệch.
- Danh sách file đã thay đổi.
- `git diff --check` không có lỗi.
- Rủi ro còn lại và nội dung chưa làm.

Các câu như “logic có vẻ đúng”, “đã kiểm tra thủ công”, hoặc chỉ có ảnh giao diện không được coi là đủ chứng cứ PASS.

### 4.5. Điểm dừng bắt buộc

Sau khi báo cáo phase, phải kết thúc bằng đúng ý nghĩa sau:

> ĐÃ DỪNG SAU PHASE [tên phase]. Tôi chưa thực hiện phase tiếp theo. Chỉ tiếp tục khi người dùng xác nhận rõ: “Đồng ý tiếp tục Phase [tên phase tiếp theo]”.

Nếu có test FAIL:

- Kết luận phase là `FAIL`, không dùng từ PASS.
- Được sửa lỗi nằm trong phạm vi phase hiện tại và chạy lại test.
- Nếu lỗi yêu cầu mở rộng phạm vi hoặc thay đổi nghiệp vụ, phải dừng và xin quyết định.

## 5. Bảng ánh xạ trạng thái

Tên trong quyết định nghiệp vụ là trạng thái chuẩn về ý nghĩa. Code hiện tại có thể đang dùng tên khác như `pending`, `confirmed`, `dang_cho` hoặc `skipped`.

Phase 0 phải lập bảng ánh xạ tối thiểu:

| Khái niệm nghiệp vụ | Field hiện tại | Giá trị hiện tại | Giá trị đích | Có cần migration? |
|---|---|---|---|---|
| Lịch chờ khách đến | Chưa xác định | Chưa xác định | `cho_den` hoặc ánh xạ được duyệt | Chưa xác định |
| Lịch đã xác nhận | Chưa xác định | Chưa xác định | `da_xac_nhan` hoặc ánh xạ được duyệt | Chưa xác định |
| Đang chờ khám | Chưa xác định | Chưa xác định | `cho_kham` hoặc ánh xạ được duyệt | Chưa xác định |
| Bỏ lượt | Chưa xác định | Chưa xác định | `bo_luot` hoặc ánh xạ được duyệt | Chưa xác định |
| Hủy check-in | Chưa xác định | Chưa xác định | `huy_check_in` | Chưa xác định |
| Trong phòng | Chưa xác định | Chưa xác định | `trong_phong` | Chưa xác định |
| Hoàn thành | Chưa xác định | Chưa xác định | `hoan_thanh` | Chưa xác định |

Không được tự kết luận rằng bắt buộc đổi toàn bộ enum sang tiếng Việt. Có thể giữ giá trị kỹ thuật hiện tại nếu ánh xạ rõ ràng, không mâu thuẫn nghiệp vụ và được người dùng duyệt trong báo cáo Phase 0.

## 6. Thứ tự triển khai

Thứ tự bắt buộc:

1. Phase 0: Audit và hợp đồng triển khai, không sửa code.
2. Phase 1A: Nền dữ liệu `LichHen` và `HangDoi`.
3. Phase 1B: Check-in backend dùng chung, thanh toán và hoàn tác.
4. Phase 1C: Nối Lễ tân, Y tá và Bác sĩ vào cùng luồng.
5. Phase 2A: Capacity và quota backend.
6. Phase 2B: Admin, Người dùng và Lễ tân sử dụng capacity/quota.
7. Phase 3A: Chốt thuật toán grace period và ưu tiên động, không sửa code.
8. Phase 3B: Triển khai grace period, ưu tiên động và realtime.
9. Phase 4A: Chốt công thức ETA, waiting list và báo cáo, không sửa code.
10. Phase 4B: Triển khai ETA, waiting list và báo cáo.

Không được gộp hai phase để “tiện làm”.

---

## 7. Prompt Phase 0: Audit và hợp đồng triển khai

### Mục tiêu

Xác minh hiện trạng bằng chứng, lập hợp đồng dữ liệu/API/trạng thái và kế hoạch test. Phase này **không sửa code, schema hoặc dữ liệu**.

### Việc phải làm

1. Đọc toàn bộ hai tài liệu nguồn.
2. Kiểm tra model:
   - `LichHen`
   - `HangDoi`
   - `HoaDon`
   - `ThanhToan`
   - `LichLamViec`
   - `KetQuaKham`
   - model audit hiện có
3. Kiểm tra mọi controller/service có thể:
   - Tạo lịch online.
   - Tạo lịch tại quầy.
   - Check-in.
   - Skip.
   - Cancel.
   - Vào phòng.
   - Kết thúc khám.
   - Thanh toán.
4. Kiểm tra route và middleware phân quyền của Admin, Lễ tân, Y tá, Bác sĩ và Người dùng.
5. Kiểm tra frontend đang gọi endpoint nào cho cùng một hành động.
6. Lập bảng ánh xạ trạng thái theo mục 5.
7. Xác định chính xác field thanh toán hiện có tương ứng với:
   - Phí khám đã thanh toán.
   - Tổng hóa đơn đã thanh toán.
8. Xác định transaction boundary cho check-in và hoàn thành khám.
9. Kiểm tra index hiện có và nguy cơ tạo trùng `HangDoi`.
10. Nếu có quyền đọc database test/dev:
    - Đếm `HangDoi` không có `LichHen`.
    - Phân nhóm đủ/thiếu dữ liệu tối thiểu.
    - Đếm lịch có nhiều hơn một hàng đợi.
    - Không sửa bất kỳ bản ghi nào.
11. Đề xuất danh sách test cụ thể cho Phase 1A và 1B.

### Cấm làm

- Không sửa file.
- Không tạo migration.
- Không thay đổi database.
- Không tự đổi enum.
- Không bắt đầu Phase 1A.

### Điều kiện PASS

- Có bảng field/trạng thái hiện tại và đích.
- Có sơ đồ luồng API hiện tại cho từng vai trò.
- Có danh sách mâu thuẫn giữa code và nghiệp vụ kèm file/dòng.
- Có kế hoạch migration và rollback ở mức thiết kế.
- Có danh sách test cụ thể.
- Không còn câu hỏi P0 ảnh hưởng trực tiếp đến Phase 1A.

Sau khi báo cáo: **dừng và chờ duyệt Phase 1A**.

---

## 8. Prompt Phase 1A: Nền dữ liệu `LichHen` và `HangDoi`

### Mục tiêu

Thiết lập invariant dữ liệu:

- Khách tại chỗ luôn có `LichHen`.
- Lịch tại chỗ không chiếm slot online.
- Mọi `HangDoi` mới đều liên kết với `LichHen`.
- Dữ liệu cũ được migrate hoặc archive đúng quyết định.

### Việc phải làm

1. Bổ sung hoặc chuẩn hóa nguồn lịch:
   - `online`
   - `tai_cho`
   - `dien_thoai`
   - `dat_ho`
2. Bổ sung `nguon_du_lieu` nếu cần để phân biệt dữ liệu vận hành mới và `migrated`.
3. Điều chỉnh validation để lịch tại chỗ không bắt buộc `slot_id`.
4. Không nới validation cho lịch online: lịch online vẫn phải có slot hợp lệ.
5. Chuẩn hóa quan hệ `HangDoi -> LichHen`.
6. Bổ sung index/invariant ngăn nhiều hàng đợi cho cùng một lịch theo hợp đồng Phase 0.
7. Viết migration có:
   - Chế độ dry-run mặc định.
   - Chế độ apply tách biệt và yêu cầu xác nhận rõ.
   - Idempotency.
   - Báo cáo số lượng đủ dữ liệu, thiếu dữ liệu, migrate, archive, bỏ qua.
   - Không xóa dữ liệu.
8. Archive dữ liệu thiếu tối thiểu mà không làm nó xuất hiện trong truy vấn vận hành mới.
9. Thêm test model và migration.

### Test bắt buộc

1. Tạo lịch online thiếu slot phải thất bại.
2. Tạo lịch tại chỗ không có slot phải thành công.
3. Lịch tại chỗ không thay đổi trạng thái slot online.
4. Không tạo được `HangDoi` mới thiếu `LichHen`.
5. Không tạo được hai `HangDoi` trái invariant cho cùng lịch.
6. Migration dry-run không thay đổi dữ liệu.
7. Chạy migration apply hai lần không tạo dữ liệu trùng.
8. Bản ghi thiếu dữ liệu được archive, không bị xóa.
9. Số lượng trước/sau khớp phương trình kiểm kê đã công bố.

### Điều kiện PASS

- Toàn bộ test Phase 1A PASS.
- Migration dry-run có báo cáo.
- Chưa chạy apply trên dữ liệu thật nếu người dùng chưa phê duyệt riêng.
- Không sửa controller/UI ngoài phần tối thiểu để code compile.
- Không có thay đổi slot online khi tạo lịch tại chỗ.

Sau khi báo cáo: **dừng và chờ duyệt Phase 1B**.

---

## 9. Prompt Phase 1B: Check-in backend dùng chung

### Mục tiêu

Chỉ có một nghiệp vụ check-in backend cho Lễ tân và Y tá, đảm bảo thanh toán, transaction, phân quyền, chống trùng và hoàn tác.

### Việc phải làm

1. Tạo service/use-case check-in dùng chung, không đặt logic cốt lõi riêng trong controller từng vai trò.
2. Kiểm tra trong cùng transaction:
   - `LichHen` tồn tại và được phép check-in.
   - Lịch thuộc đúng ngày/ca/bác sĩ.
   - Phí khám cơ bản đã thanh toán.
   - Chưa có hàng đợi trái invariant.
3. Trong transaction:
   - Lưu thời điểm check-in.
   - Lưu người và vai trò tiếp nhận.
   - Cập nhật trạng thái đến của `LichHen`.
   - Tạo đúng một `HangDoi`.
   - Ghi audit check-in.
4. Xử lý request lặp hoặc đồng thời bằng kết quả nghiệp vụ rõ ràng; không để lỗi duplicate thô thành HTTP 500.
5. `skip`:
   - Cho phép Y tá, Lễ tân, Admin.
   - Bắt buộc lý do hợp lệ.
   - Chỉ đổi `HangDoi`.
   - Không đổi hoặc hủy `LichHen`.
6. Xóa quyền `cancel` lịch khỏi Y tá ở route, controller và UI contract.
7. Hoàn tác check-in:
   - Chỉ Lễ tân/Admin.
   - Chỉ khi còn `cho_kham`.
   - Chuyển `HangDoi` thành `huy_check_in`.
   - Khôi phục đúng trạng thái trước check-in của `LichHen`.
   - Ghi audit đầy đủ.
8. Khi hoàn thành khám:
   - Kiểm tra tổng hóa đơn đã thanh toán.
   - Nếu chưa thanh toán, không chuyển `HangDoi` sang `hoan_thanh`.
9. Giữ response và mã lỗi nhất quán giữa Lễ tân và Y tá.

### Test bắt buộc

1. Phí khám chưa thanh toán: check-in bị từ chối và không collection nào thay đổi.
2. Phí khám đã thanh toán: tạo đúng một `HangDoi`.
3. Hai request check-in đồng thời: chỉ một kết quả tạo mới, không có hai hàng đợi.
4. Lỗi khi tạo `HangDoi`: cập nhật `LichHen` và audit phải rollback.
5. Lễ tân và Y tá gọi hai route khác nhau nhưng đi qua cùng service.
6. Y tá gọi `cancel`: trả `403` hoặc không có route.
7. Y tá `skip`: `HangDoi` đổi trạng thái, `LichHen` giữ nguyên.
8. Skip thiếu hoặc sai lý do: bị từ chối.
9. Lễ tân/Admin hoàn tác ở `cho_kham`: thành công và có audit.
10. Hoàn tác ở `trong_phong` hoặc `hoan_thanh`: bị từ chối.
11. Y tá hoàn tác check-in: bị từ chối.
12. Dịch vụ phát sinh chưa thanh toán: không được hoàn thành.
13. Tổng hóa đơn đã thanh toán: được hoàn thành.
14. Test quyền truy cập chéo bác sĩ/ca/chi nhánh.

### Điều kiện PASS

- Tất cả invariant được chứng minh bằng integration test.
- Có test race condition và rollback thật, không chỉ mock service.
- Không còn controller check-in nào tự sửa `LichHen` mà không tạo `HangDoi`.
- Không còn quyền y tá hủy lịch.

Sau khi báo cáo: **dừng và chờ duyệt Phase 1C**.

---

## 10. Prompt Phase 1C: Nối Lễ tân, Y tá và Bác sĩ

### Mục tiêu

Ba vai trò nhìn cùng một nguồn hàng đợi và thực hiện đúng quyền.

### Thứ tự sửa bắt buộc

1. Lễ tân.
2. Y tá.
3. Bác sĩ.

### Lễ tân

- Tạo khách tại chỗ bằng `LichHen` nguồn `tai_cho`, không chiếm slot online.
- Thu/xác nhận phí khám trước check-in.
- Check-in qua API dùng chung.
- Hiển thị lỗi thanh toán, check-in trùng và sai ngày rõ ràng.
- Có thao tác hoàn tác check-in đúng quyền và bắt buộc lý do.
- Có thao tác cancel lịch tách biệt với skip.

### Y tá

- Màn hàng đợi đọc từ `HangDoi`, không đọc danh sách `LichHen` rồi sắp theo giờ hẹn.
- Có các thao tác đúng quyền: gọi, vào phòng, kết thúc, skip.
- Không có nút hoặc request cancel lịch.
- Không có quyền hoàn tác check-in.
- Hiển thị nguồn khách và trạng thái thanh toán cần thiết, không lộ dữ liệu tài chính ngoài phạm vi.

### Bác sĩ

- Đọc cùng nguồn `HangDoi`.
- Chỉ thấy hàng đợi thuộc bác sĩ hiện tại.
- Người tiếp theo phải khớp với thứ tự mà Y tá đang điều phối.
- Không có quyền override capacity, check-in, hoàn tác hoặc đổi thứ tự nếu chưa được nghiệp vụ cho phép.

### Test bắt buộc

1. Frontend unit/service test cho endpoint mới.
2. Typecheck, lint và build.
3. Kiểm tra trình duyệt theo ba tài khoản:
   - Lễ tân tạo khách tại chỗ và check-in.
   - Y tá thấy đúng bệnh nhân sau khi tải dữ liệu.
   - Bác sĩ thấy cùng bệnh nhân và trạng thái.
4. Y tá skip, Lễ tân và Bác sĩ nhìn thấy đúng trạng thái.
5. Y tá không thể cancel bằng UI lẫn gọi API trực tiếp.
6. Lễ tân hoàn tác check-in trước khi vào phòng thành công.
7. Sau khi vào phòng, Lễ tân không thể hoàn tác.
8. Khách tại chỗ không làm thay đổi slot online.

### Điều kiện PASS

- Ba vai trò đọc cùng nguồn sự thật.
- Không còn màn “hàng đợi” nào sắp trực tiếp từ `LichHen.gio_kham`.
- Phân quyền UI và backend cùng đúng.
- Test frontend và backend đều PASS.

Sau khi báo cáo: **dừng và chờ duyệt Phase 2A**.

---

## 11. Prompt Phase 2A: Capacity và quota backend

### Mục tiêu

Tách tổng capacity buổi khám khỏi slot/quota online và kiểm soát nguyên tử.

### Việc phải làm

1. Thiết kế capacity theo khóa:

   `Chi nhánh + Bác sĩ + Chuyên khoa + Ngày + Buổi khám`

2. Lưu:
   - Tổng capacity.
   - Quota online.
   - Số đã nhận online.
   - Số đã nhận tại chỗ/điện thoại.
   - Override hiện hành.
   - Lịch sử override.
3. Định nghĩa rõ lượt nào giữ capacity và thời điểm giải phóng.
4. Đặt online phải kiểm tra quota online và tổng capacity nguyên tử.
5. Tiếp nhận tại chỗ phải kiểm tra tổng capacity nguyên tử.
6. Lễ tân không được vượt tổng capacity.
7. Quota mềm chỉ được chuyển trong phạm vi tổng capacity.
8. Không tự phát minh thời điểm tự động mở quota mềm. Nếu code/tài liệu chưa có bằng chứng về thời điểm, phải báo `BLOCKED` cho riêng cơ chế tự động; có thể đề xuất thao tác chuyển thủ công nhưng phải chờ duyệt.
9. Admin override:
   - Không vượt `floor(capacity * 1.15)`.
   - Lý do thuộc danh sách đã chốt.
   - Có ghi chú.
   - Có audit.
10. Bác sĩ không có endpoint override.

### Test bắt buộc

1. Online chạm quota: request tiếp theo bị từ chối.
2. Tại chỗ còn tổng capacity: được nhận mà không chiếm slot online.
3. Hai request cùng tranh lượt cuối: chỉ một request thành công.
4. Lễ tân vượt tổng capacity: bị từ chối.
5. Bác sĩ override: bị từ chối.
6. Admin override thiếu lý do/ghi chú: bị từ chối.
7. Admin override trong +15%: thành công và có audit.
8. Admin override vượt +15%: bị từ chối.
9. Capacity 20 chỉ cho phép tối đa 23 sau override.
10. Transaction lỗi không làm sai bộ đếm.

### Điều kiện PASS

- Test boundary và concurrency PASS.
- Không dùng số slot làm tổng capacity.
- Không có đường API nào cho Lễ tân/Bác sĩ vượt tổng capacity.
- Audit override đầy đủ.

Sau khi báo cáo: **dừng và chờ duyệt Phase 2B**.

---

## 12. Prompt Phase 2B: Admin, Người dùng và Lễ tân

### Mục tiêu

Đưa capacity/quota đã PASS ở backend vào đúng giao diện.

### Thứ tự sửa bắt buộc

1. Admin.
2. Người dùng.
3. Lễ tân.

### Admin

- Cấu hình capacity và quota online.
- Xem tổng đã nhận, online, tại chỗ và phần còn lại.
- Override đúng giới hạn +15%.
- Bắt buộc lý do và ghi chú.
- Xem lịch sử override.

### Người dùng

- Chỉ thấy và đặt được slot còn quota online.
- Thông báo rõ giờ đặt là giờ đến dự kiến.
- Hai người tranh cùng slot/quota không được cùng thành công.
- Không nhìn thấy thao tác hoặc dữ liệu nội bộ về override.

### Lễ tân

- Xem capacity còn lại.
- Tạo lịch tại chỗ không chiếm slot online.
- Không có quyền vượt tổng capacity.
- Nếu hết capacity, không tự tạo `HangDoi`; hiển thị hướng xử lý chờ Phase 4.

### Test bắt buộc

- Unit/service test cho ba giao diện.
- Typecheck, lint, build.
- Test trình duyệt ở desktop và kích thước nhỏ.
- Test boundary quota/capacity từ UI tới database.
- Test ẩn/hiện đúng quyền.
- Kiểm tra refresh không làm mất hoặc nhân đôi trạng thái.

### Điều kiện PASS

- UI không thể vượt rào chắn backend.
- Dữ liệu hiển thị khớp database.
- Admin, Người dùng và Lễ tân nhìn đúng phạm vi.

Sau khi báo cáo: **dừng và chờ duyệt Phase 3A**.

---

## 13. Prompt Phase 3A: Chốt thuật toán ưu tiên, không sửa code

### Mục tiêu

Chốt công thức đủ cụ thể trước khi triển khai grace period và thứ tự động.

### Quy tắc đã cố định

- Grace period mặc định 10 phút.
- Online đến trong grace period giữ ưu tiên.
- Online đến muộn vẫn được khám nhưng mất ưu tiên tuyệt đối.
- Khách chưa check-in không nằm trong `HangDoi`.
- Không tự động chuyển `no_show` ngay khi hết grace period.
- Y tá chỉ skip, không cancel.

### Các tham số phải có chứng cứ và được duyệt

1. Cửa sổ đến sớm tối đa để được check-in/giữ ưu tiên.
2. Công thức tăng ưu tiên theo thời gian chờ.
3. Thời gian hoặc điều kiện để khách tại chỗ không bị chờ vô hạn.
4. Nguồn và quyền xác nhận ưu tiên y tế/cấp cứu.
5. Cách xử lý bệnh nhân được gọi nhưng không có mặt.
6. Quy tắc bảo vệ lịch online sắp đến khi gọi khách tại chỗ.
7. Quy tắc điều chỉnh thứ tự thủ công và audit.

### Cấm làm

- Không code thuật toán.
- Không tự chọn trọng số.
- Không dùng lại cứng thuật toán “online luôn trước offline”.

### Điều kiện PASS

- Có bảng scenario đầu vào và thứ tự đầu ra dự kiến.
- Có công thức deterministic.
- Có tie-breaker cuối cùng.
- Có bộ test table-driven dự kiến.
- Người dùng duyệt công thức.

Sau khi báo cáo: **dừng và chờ duyệt Phase 3B**.

---

## 14. Prompt Phase 3B: Grace period, ưu tiên động và realtime

### Mục tiêu

Triển khai đúng thuật toán đã duyệt ở Phase 3A và đồng bộ trạng thái giữa các vai trò.

### Việc phải làm

1. Cấu hình grace mặc định 10 phút và cơ chế ghi đè.
2. Tính trạng thái đến đúng giờ/đến muộn/mất ưu tiên.
3. Tính thứ tự động theo công thức đã duyệt.
4. Không lưu số thứ tự như nguồn quyết định cố định nếu thứ tự cần thay đổi động.
5. Điều chỉnh thủ công phải có lý do và audit thứ tự cũ/mới.
6. Không tự động no-show khi vừa hết grace.
7. Realtime cho Lễ tân, Y tá và Bác sĩ từ cùng sự kiện nghiệp vụ.
8. Khi mất kết nối realtime, refresh phải lấy lại đúng trạng thái từ backend.

### Test bắt buộc

- Test table-driven toàn bộ scenario Phase 3A.
- Test mốc thời gian ngay trước, đúng và ngay sau 10 phút.
- Test timezone Asia/Saigon.
- Test khách chờ lâu không bị starvation.
- Test realtime ba vai trò.
- Test reconnect/refetch.
- Test điều chỉnh thủ công và audit.

### Điều kiện PASS

- Cùng dữ liệu đầu vào luôn cho cùng thứ tự.
- Không còn quy tắc “online luôn trước offline”.
- Không có no-show tự động sai quy định.
- Ba vai trò đồng bộ sau sự kiện.

Sau khi báo cáo: **dừng và chờ duyệt Phase 4A**.

---

## 15. Prompt Phase 4A: Chốt ETA, waiting list và báo cáo

### Mục tiêu

Chốt công thức và trạng thái trước khi code giai đoạn cuối.

### Phải chốt

1. Công thức ETA:
   - Người đang chờ trước.
   - Người đang trong phòng.
   - Thời gian khám trung bình.
   - Thời gian dọn phòng.
   - Bác sĩ tạm nghỉ.
   - Lịch online sắp đến.
2. Khoảng dữ liệu dùng tính thời gian khám trung bình.
3. Fallback khi chưa đủ dữ liệu.
4. Trạng thái waiting list.
5. Thời hạn phản hồi lời mời.
6. Quy tắc mời/chuyển sang bác sĩ hoặc buổi khác.
7. Chỉ số báo cáo và cách loại dữ liệu `migrated`/archive khỏi thống kê mới.

### Cấm làm

- Không code ETA gần đúng khi công thức chưa duyệt.
- Không dùng waiting list như `HangDoi`.
- Không đưa dữ liệu archive vào báo cáo vận hành.

### Điều kiện PASS

- Công thức ETA có ví dụ tính tay.
- State machine waiting list hoàn chỉnh.
- Định nghĩa từng chỉ số báo cáo.
- Bộ test dự kiến được duyệt.

Sau khi báo cáo: **dừng và chờ duyệt Phase 4B**.

---

## 16. Prompt Phase 4B: ETA, waiting list và báo cáo

### Mục tiêu

Triển khai đúng hợp đồng Phase 4A.

### Việc phải làm

1. Tính ETA và ghi rõ đây là ước tính.
2. Tách waiting list khỏi `HangDoi`.
3. Không tạo `LichHen`/`HangDoi` chính thức khi khách mới chỉ ở waiting list, trừ khi state machine đã duyệt yêu cầu.
4. Lưu lịch sử mời, phản hồi, hết hạn và chuyển buổi/bác sĩ.
5. Báo cáo:
   - Online.
   - Tại chỗ.
   - No-show.
   - Đến muộn.
   - Thời gian chờ.
   - Thời gian khám.
   - Quá tải.
   - Override capacity.
6. Loại dữ liệu archive và xử lý dữ liệu `migrated` đúng định nghĩa Phase 4A.

### Test bắt buộc

- Test công thức ETA bằng ví dụ tính tay.
- Test ETA khi chưa đủ dữ liệu.
- Test bác sĩ tạm nghỉ và ca khám kéo dài.
- Test waiting list không xuất hiện trong hàng đợi.
- Test lời mời hết hạn và chuyển buổi/bác sĩ.
- Test báo cáo đối chiếu trực tiếp với dữ liệu fixture.
- Test phân quyền và xuất dữ liệu.
- Test frontend, typecheck, lint, build và trình duyệt.

### Điều kiện PASS

- ETA khớp công thức được duyệt.
- Waiting list và hàng đợi không bị trộn.
- Báo cáo khớp fixture.
- Không làm thay đổi invariant của các phase trước.

Sau khi báo cáo: **dừng và chờ nghiệm thu tổng thể riêng**.

## 17. Mẫu báo cáo bắt buộc sau mỗi phase

```markdown
# Báo cáo Phase [tên]

## Kết luận

PASS | FAIL | BLOCKED

## Phạm vi đã thực hiện

- ...

## Chứng cứ hiện trạng trước khi sửa

- File/dòng:
- Hành vi cũ:

## File đã thay đổi

| File | Lý do |
|---|---|
| ... | ... |

## Thay đổi dữ liệu/schema

- Migration:
- Dry-run:
- Rollback:
- Số lượng trước/sau:

## Kết quả test

| Lệnh/test | Kỳ vọng | Kết quả | Exit code |
|---|---|---|---:|
| ... | ... | PASS/FAIL | ... |

## Scenario nghiệp vụ trọng yếu

| Scenario | Kết quả | Chứng cứ |
|---|---|---|
| ... | PASS/FAIL | ... |

## Kiểm tra phân quyền

| Vai trò | Hành động | Kết quả |
|---|---|---|
| ... | ... | ... |

## Thay đổi ngoài phạm vi

Không có | Liệt kê rõ

## Rủi ro còn lại

- ...

## Nội dung chưa làm

- ...

ĐÃ DỪNG SAU PHASE [tên]. Tôi chưa thực hiện phase tiếp theo.
Chỉ tiếp tục khi người dùng xác nhận rõ: “Đồng ý tiếp tục Phase [tên phase tiếp theo]”.
```

## 18. Điều kiện nghiệm thu cuối cùng

Chỉ được đề nghị nghiệm thu tổng thể khi tất cả phase riêng đã được người dùng duyệt và các điều kiện sau đều có chứng cứ:

1. Khách tại chỗ có `LichHen`, hóa đơn và `HangDoi`.
2. Khách tại chỗ không chiếm slot online.
3. Phí khám chưa thanh toán không thể check-in.
4. Dịch vụ phát sinh chưa thanh toán không thể hoàn thành.
5. Một lịch không có hai hàng đợi trái invariant.
6. Y tá không thể cancel lịch.
7. Skip không thay đổi `LichHen`.
8. Hoàn tác check-in chỉ dành cho Lễ tân/Admin và chỉ khi còn chờ.
9. Online không vượt quota.
10. Tại chỗ không vượt capacity.
11. Chỉ Admin override, không vượt +15%, có audit.
12. Grace mặc định đúng 10 phút.
13. Khách đến muộn không chen đầu nhưng vẫn được phục vụ.
14. Khách chờ lâu không bị starvation.
15. Lễ tân, Y tá và Bác sĩ nhìn cùng trạng thái.
16. Waiting list không bị trộn với hàng đợi.
17. Dữ liệu cũ không bị xóa hoặc suy diễn.
18. Báo cáo không trộn dữ liệu archive vào vận hành mới.

