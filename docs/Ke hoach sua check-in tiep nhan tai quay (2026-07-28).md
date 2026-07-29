# Kế hoạch chỉnh sửa — Tiếp nhận tại quầy

Ngày: 2026-07-28

## Mục tiêu

Hoàn thiện nhánh check-in tại quầy mà không thay đổi các chức năng đã ổn định:

- Có lịch hẹn hợp lệ hôm nay: check-in online vào đúng bác sĩ đã đặt.
- Không có lịch hẹn hôm nay: xử lý walk-in theo slot và sức chứa thực tế.
- Lễ tân nhìn thấy được vì sao hệ thống chọn bác sĩ và căn cứ slot còn trống.
- Không nhận nhầm slot khi dữ liệu trên màn hình đã cũ.

## 1. Quy tắc nghiệp vụ giữ nguyên

### Khách online

Được xác định bằng `LichHen` hợp lệ trong ngày, không bị `cancelled`, `no_show` hoặc `skipped`.

Luồng:

```text
Tra số điện thoại → chọn đúng hồ sơ → chọn lịch hẹn → check-in đúng bác sĩ
```

Không kiểm tra slot walk-in đối với khách online.

### Khách walk-in

Là hồ sơ không có lịch hẹn hợp lệ hôm nay.

Chỉ được tiếp nhận khi thỏa mãn tất cả điều kiện:

- Bác sĩ có `trang_thai: active`.
- Bác sĩ có `trang_thai_duyet: approved` và `la_hien: true`.
- Lịch có `trang_thai_ngay: lam_viec`.
- Lịch không có `trang_thai_xac_nhan: tu_choi`.
- Slot có `status: active`, `loai_slot: walk_in`.
- Slot không bị khóa do nghỉ phép.
- Slot chưa có bệnh nhân, chưa bị giữ trong `HangDoi`.
- Bác sĩ chưa vượt ngưỡng trễ cho phép.

## 2. Cách tính sức chứa

Không tạo thêm slot vì bác sĩ khám nhanh. Công suất hợp lệ chỉ đến từ slot đã được lập lịch.

### Độ trễ của bác sĩ

Tính một giá trị duy nhất:

```text
Độ trễ ca = max(độ trễ hàng đợi, thời gian khám vượt chuẩn)
```

- Độ trễ hàng đợi: thời điểm hiện tại trừ giờ hẹn sớm nhất của người chưa được gọi.
- Thời gian khám vượt chuẩn: thời gian bệnh nhân ở `trong_phong` trừ thời lượng khám trung bình của chuyên khoa.
- Nếu chưa có người chờ và chưa có người khám quá chuẩn thì độ trễ bằng 0.

Ngưỡng hiện tại:

- Từ 30 phút: tạm dừng nhận walk-in của bác sĩ.
- Từ 60 phút: giữ nguyên quy tắc chặn đặt online hiện có; không mở rộng xử lý phần này.

## 3. Tiêu chí chọn bác sĩ/slot

Không tạo hệ thống chấm điểm phức tạp. Backend chỉ sắp xếp ứng viên theo thứ tự:

1. Bác sĩ đủ điều kiện.
2. Slot có giờ bắt đầu gần nhất.
3. Độ trễ thấp hơn.
4. Số người đang chờ ít hơn.
5. Tiêu chí ổn định để tránh phụ thuộc thứ tự Mongo trả về.

API chỉ cần trả thêm:

```text
slot_de_xuat
ly_do_de_xuat
```

Không cần trả đồng thời nhiều cấu trúc `bac_si_de_xuat`, `slot_de_xuat`, điểm số hoặc bảng xếp hạng.

## 4. Những file cần sửa

### A. `backend/src/services/queueOverflow.service.js`

1. Mở rộng truy vấn độ trễ cho các trạng thái `dang_cho`, `da_goi`, `trong_phong`, `cho_dich_vu`.
2. Với trạng thái `trong_phong`, dùng `thoi_diem_vao_phong` và thời lượng trung bình của chuyên khoa.
3. Trả về tối thiểu:

```text
doTrePhut
nguyenNhanDoTre: hang_doi | trong_phong | khong_tre
ngungBanWalkIn
chanDatOnline
canhBao
```

Không thay đổi thứ tự ưu tiên hàng đợi hoặc luồng check-in online.

### B. `backend/src/services/offlineIntake.service.js`

1. Lọc bác sĩ bằng đúng các field hiện có trong `BacSi`.
2. Lọc slot theo điều kiện walk-in ở mục 1.
3. Sắp xếp ứng viên theo mục 3.
4. Trả `slot_de_xuat` và `ly_do_de_xuat`.
5. Giữ minh chứng hiện tại: khung gần nhất, online đã đặt, walk-in còn, hàng đợi, độ trễ và `checked_at`.
6. Khi xác nhận walk-in, kiểm tra lại bác sĩ, lịch, slot và độ trễ trước khi cập nhật atomic slot.
7. Nếu slot vừa bị giữ hoặc điều kiện vừa thay đổi, trả lỗi `409` để giao diện yêu cầu tải lại.

### C. `frontend/src/services/receptionist-patient-intake.service.ts`

1. Bổ sung type cho `slot_de_xuat`, `ly_do_de_xuat`, `nguyenNhanDoTre`.
2. Bổ sung type cho trạng thái `khong_co_khung_gan` nếu chưa có.
3. Không thay đổi API và type của nhánh check-in online ngoài phần xử lý lỗi 409.

### D. `frontend/src/pages/receptionist/PatientIntake.tsx`

1. Hiển thị một khu vực “Đề xuất tiếp nhận” gồm bác sĩ, phòng, slot và lý do.
2. Hiển thị ngắn gọn các căn cứ: walk-in còn, online đã đặt, đang chờ, độ trễ và thời điểm kiểm tra.
3. Phân biệt các kết luận nghiệp vụ:

| Trạng thái | Ý nghĩa | Hướng xử lý |
|---|---|---|
| `co_the_tiep_nhan` | Có slot hợp lệ | Cho xác nhận |
| `tam_dung_qua_tai` | Bác sĩ trễ từ 30 phút | Chọn bác sĩ/khung khác |
| `da_day_walk_in` | Có lịch nhưng slot walk-in đã hết | Báo hết slot |
| `khong_co_lich_bac_si` | Không có lịch làm việc | Báo không có lịch |
| `khong_co_khung_gan` | Chưa tới khung walk-in gần | Hiển thị giờ quay lại |

4. Lỗi API hoặc không tải được dữ liệu hiển thị là “Không thể kiểm tra, vui lòng thử lại”, không hiển thị là “hết slot”.
5. Không thêm cơ chế đổi bác sĩ bắt buộc nhập lý do ở phiên bản này.

## 5. Không sửa trong phạm vi này

- Không sửa tìm kiếm hồ sơ bằng số điện thoại.
- Không sửa form tạo hồ sơ mới đã dùng số điện thoại tra cứu.
- Không sửa thanh toán, hồ sơ khám, thứ tự ưu tiên hoặc màn hình bác sĩ.
- Không tự mở thêm slot khi khám nhanh.
- Không tạo hệ thống audit/log riêng.
- Không thay đổi ngưỡng hoặc luồng đặt online 60 phút.
- Không thay đổi service check-in online nếu test hiện tại vẫn đạt.

## 6. Bộ test nghiệm thu tối thiểu

Gom thành 6 nhóm, không tách thành 14 chức năng riêng:

1. **Nhận diện nguồn:** lịch hẹn hợp lệ đi online; lịch hẹn hủy đi walk-in; nhiều hồ sơ chung số điện thoại không bị gắn nhầm lịch.
2. **Chọn slot:** một bác sĩ còn slot; hai bác sĩ cùng giờ cho kết quả ổn định; slot đã giữ không còn được chọn.
3. **Lọc bác sĩ:** bác sĩ nghỉ, bị khóa, chưa duyệt hoặc ẩn không xuất hiện.
4. **Khám chậm:** người `dang_cho` quá 30 phút và người `trong_phong` vượt thời lượng chuẩn đều được tính đúng độ trễ.
5. **Khám nhanh:** không tự tăng số slot ngoài lịch đã lập.
6. **Tranh chấp:** hai lễ tân cùng nhận một slot hoặc cùng gửi một hồ sơ thì chỉ một lượt thành công; lượt còn lại nhận `409`.

## 7. Thứ tự thực hiện

1. Sửa tính độ trễ trong `queueOverflow.service.js`.
2. Sửa lọc và sắp xếp ứng viên trong `offlineIntake.service.js`.
3. Bổ sung kiểm tra lại trước khi giữ slot.
4. Cập nhật type và hiển thị đề xuất trong frontend.
5. Chạy 6 nhóm test nghiệm thu.
6. Chạy lại typecheck, build, unit test, E2E và backend regression.

## Tiêu chí hoàn thành

Trên màn hình tiếp nhận, lễ tân phải trả lời được:

1. Khách này là online hay walk-in?
2. Vì sao hệ thống chọn bác sĩ/slot này?
3. Căn cứ nào chứng minh slot còn trống tại thời điểm xác nhận?

Nếu chưa trả lời được cả ba câu, chưa nghiệm thu chức năng.
