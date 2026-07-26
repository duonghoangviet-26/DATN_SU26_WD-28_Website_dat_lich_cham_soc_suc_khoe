# Phương án phân bổ slot online và hàng đợi khám thực tế

## 1. Mục tiêu

Thiết kế lại luồng tiếp nhận để:

- Khách online vẫn chọn được giờ đến dự kiến.
- Khách đến trực tiếp vẫn được tiếp nhận mà không chiếm hoặc đẩy slot online.
- Bác sĩ khám theo người thực sự có mặt, không phụ thuộc cứng vào lưới 30 phút.
- Giảm lãng phí khi khách online không đến hoặc đến muộn.
- Kiểm soát số bệnh nhân theo năng lực thực tế của từng buổi khám.

## 2. Kết luận

Phương án này **đúng hướng và nên triển khai**. Nó phù hợp với vận hành phòng khám thực tế hơn mô hình “mỗi slot là một lượt khám cứng”.

Hệ thống hiện đã có một phần nền tảng `HangDoi`, check-in online/offline và hồ sơ cho khách vãng lai. Tuy nhiên, các luồng lễ tân, y tá và bác sĩ chưa thống nhất. Vì vậy đây là thay đổi mức **trung bình - lớn**, nhưng không phải xây lại toàn bộ.

## 3. Hiện trạng và vấn đề

| Nội dung | Hiện trạng | Vấn đề |
|---|---|---|
| Đặt lịch | Online và lễ tân đều phải chọn slot cụ thể | Slot đang vừa là giờ hiển thị, vừa là sức chứa cứng |
| Check-in lễ tân | Chỉ đổi trạng thái `LichHen` thành `checked_in` | Chưa chắc tạo lượt trong `HangDoi` |
| Check-in y tá | Tạo `HangDoi` bằng một luồng khác | Hai vai trò có thể tạo trạng thái không đồng nhất |
| Hàng đợi y tá | Chủ yếu đọc `LichHen`, sắp theo `gio_kham` | Chưa phải thứ tự người thực tế có mặt |
| Hàng đợi bác sĩ | Đọc dữ liệu từ `HangDoi` | Có thể khác dữ liệu y tá và lễ tân đang thấy |
| Khách vãng lai | Có thể tạo `HangDoi` offline | Chưa có `LichHen`, hóa đơn và báo cáo đầy đủ |
| Ưu tiên | Tính một lần khi check-in theo cửa sổ khoảng 30 phút | Chưa có grace period động, dễ để khách vãng lai chờ quá lâu |
| Capacity | Gần như bằng tổng số slot | Chưa tách quota online và sức chứa tổng của buổi |

Rủi ro rõ nhất hiện nay: lễ tân có thể đã check-in một bệnh nhân nhưng bệnh nhân chưa xuất hiện trong hàng đợi mà bác sĩ đang sử dụng.

## 4. Mô hình đề xuất

Phải tách ba khái niệm độc lập:

### 4.1. `LichHen` - lượt khám được tiếp nhận

- Khách online: có giờ hẹn và slot online.
- Khách tại chỗ: vẫn tạo `LichHen`, nhưng không bắt buộc chiếm slot online.
- Mỗi lịch phải có nguồn rõ ràng: `online`, `tai_cho`, `dien_thoai` hoặc `dat_ho`.
- Lưu đầy đủ bệnh nhân, bác sĩ, chuyên khoa, lý do khám, thanh toán và người tiếp nhận.

### 4.2. `HangDoi` - người đã có mặt

- Chỉ tạo tại thời điểm check-in.
- Người chưa đến không nằm trong hàng đợi thực tế.
- Online và tại chỗ cùng đi vào một hàng đợi chung.
- Y tá và bác sĩ làm việc theo hàng đợi này, không theo thứ tự slot.

### 4.3. Capacity - giới hạn vật lý của buổi khám

Nên xác định theo:

`Chi nhánh + Bác sĩ + Chuyên khoa + Ngày + Buổi khám`

Không nên chỉ cấu hình theo chuyên khoa vì hai bác sĩ cùng chuyên khoa có thể có thời gian làm việc và tốc độ khám khác nhau.

Ví dụ:

- Capacity tổng buổi sáng: 20 bệnh nhân.
- Quota online: 14 bệnh nhân, tương đương 70%.
- Phần dự kiến cho tại chỗ/điện thoại: 6 bệnh nhân.
- Online không được đặt quá 14 lượt.
- Lễ tân được thêm khách tại chỗ cho tới khi tổng số đã nhận chạm 20.

## 5. Luồng vận hành đề xuất

### 5.1. Khách đặt online

1. Khách chọn bác sĩ, ngày và giờ đến dự kiến.
2. Hệ thống kiểm tra slot và quota online của buổi.
3. Tạo `LichHen` nguồn `online` và giữ slot tương ứng.
4. Khi khách đến, lễ tân hoặc y tá thực hiện check-in chung.
5. Check-in tạo đúng một `HangDoi` liên kết với lịch hẹn.
6. Bác sĩ khám theo thứ tự hàng đợi thực tế.

### 5.2. Khách đến trực tiếp

1. Lễ tân nhập đầy đủ thông tin như form đặt lịch.
2. Hệ thống kiểm tra capacity tổng của buổi.
3. Tạo `LichHen` nguồn `tai_cho`, không chiếm slot online.
4. Check-in ngay và tạo `HangDoi`.
5. Trả số thứ tự và thời gian chờ dự kiến.
6. Nếu hết capacity, đưa vào waiting list hoặc đề xuất bác sĩ/buổi khác.

### 5.3. Quá trình khám

1. Y tá gọi bệnh nhân theo thứ tự hệ thống đề xuất.
2. Vào phòng: chuyển lượt sang `trong_phong`.
3. Kết thúc: chuyển sang `hoan_thanh` và lưu thời gian khám thực tế.
4. Dữ liệu thời gian thực tế được dùng để cải thiện ETA cho các lượt sau.

## 6. Quy tắc ưu tiên

Không nên dùng quy tắc đơn giản “online luôn trước, tại chỗ luôn sau”. Thứ tự nên kết hợp giờ hẹn, giờ check-in và thời gian đã chờ.

Thứ tự đề xuất:

1. Trường hợp ưu tiên y tế/cấp cứu, nếu phòng khám có nghiệp vụ phân loại.
2. Khách online đã check-in trong cửa sổ hợp lệ quanh giờ hẹn.
3. Khách tại chỗ và khách online đến muộn, xếp theo thời gian check-in.
4. Tăng dần ưu tiên cho người đã chờ lâu để tránh bị chờ vô thời hạn.

Nhân viên có thể điều chỉnh thủ công nhưng bắt buộc nhập lý do và lưu nhật ký người thực hiện, thứ tự cũ, thứ tự mới.

## 7. Khách online chưa đến

Người chưa check-in không thể có vị trí trong hàng đợi thực tế. Cần xử lý như sau:

- `LichHen` giữ capacity và giờ cam kết.
- `HangDoi` chỉ được tạo sau check-in.
- Trước khi gọi khách tại chỗ, hệ thống kiểm tra lịch online sắp đến.
- Chỉ gọi khách tại chỗ nếu thời gian khám dự kiến không làm trễ lượt online tiếp theo.
- Nếu không đủ khoảng trống an toàn, y tá tạm dừng gọi hoặc thông báo lại ETA.

## 8. Grace period và no-show

Grace period nên cấu hình được, mặc định có thể là 10-15 phút.

- Đến đúng giờ hoặc trong grace period: giữ ưu tiên online.
- Đến sau grace period: vẫn được khám nhưng mất ưu tiên tuyệt đối.
- Chưa đến sau grace period: giải phóng phần ưu tiên/capacity để phục vụ người đang chờ.
- Không tự động chuyển ngay thành `no_show` sau 15 phút.
- Chỉ xác nhận `no_show` khi hết buổi hoặc nhân viên xác nhận khách không đến.

Nên tách các trạng thái: `chua_den`, `da_check_in`, `den_muon`/`mat_uu_tien` và `no_show`.

## 9. Cấu hình quota online

Không nên cố định 20-30% cho mọi ngày. Nên cho phép cấu hình phân cấp:

1. Mặc định toàn phòng khám.
2. Ghi đè theo chuyên khoa.
3. Ghi đè theo bác sĩ.
4. Ghi đè theo ngày hoặc buổi cụ thể.

Ví dụ: ngày thường mở 80% online, thứ Bảy chỉ mở 60% vì thường đông khách tại chỗ.

Phần dành cho khách tại chỗ nên là quota mềm: nếu gần tới buổi khám mà chưa sử dụng, admin/lễ tân có thể mở thêm cho online. Tổng lượt vẫn không vượt capacity, trừ khi có quyền override và lý do rõ ràng.

## 10. ETA và waiting list

ETA cơ bản:

`Số người đang chờ trước x Thời gian khám trung bình`

Cần tính thêm người đang trong phòng, thời gian còn lại, thời gian dọn phòng, lịch online sắp đến và trạng thái tạm nghỉ của bác sĩ. ETA chỉ là ước tính, không phải cam kết chính xác.

Waiting list phải tách khỏi hàng đợi:

- Hàng đợi: khách đã được nhận khám trong buổi và đang có mặt.
- Waiting list: buổi đã hết capacity, khách chưa chắc được nhận khám.

Waiting list cần lưu bệnh nhân, thông tin liên hệ, bác sĩ/chuyên khoa mong muốn, buổi mong muốn, trạng thái, thời hạn phản hồi và lịch sử mời/chuyển.

## 11. Phạm vi thay đổi theo vai trò

| Vai trò | Mức độ | Nội dung chính |
|---|---:|---|
| Lễ tân | Lớn | Tạo lịch tại chỗ, check-in online, xem capacity/ETA, xử lý waiting list và chuyển buổi/bác sĩ |
| Y tá | Lớn | Dùng hàng đợi thực tế, gọi bệnh nhân, đưa vào phòng, kết thúc, bỏ lượt và cập nhật ưu tiên |
| Admin | Trung bình-lớn | Cấu hình capacity, quota, grace period; theo dõi quá tải và báo cáo |
| Bác sĩ | Trung bình | Xem đúng thứ tự, người tiếp theo, nguồn, giờ hẹn, đến muộn và trạng thái phòng |
| Bệnh nhân | Nhỏ-trung bình | Đặt theo quota online và được thông báo đây là giờ dự kiến |
| Backend/dữ liệu | Lớn nhất | Thống nhất lịch hẹn, hàng đợi, capacity, grace period, waiting list, thanh toán và thống kê |

Phân quyền nên rõ ràng:

- Lễ tân: đăng ký, thanh toán, check-in và waiting list.
- Y tá: phân loại, gọi bệnh nhân, vào phòng, kết thúc và bỏ lượt.
- Bác sĩ: xem thứ tự, khám và xác nhận kết quả.
- Admin: cấu hình, giám sát và override có kiểm soát.

## 12. Dữ liệu và kỹ thuật bắt buộc

### Dữ liệu

- Khách tại chỗ phải có `LichHen` đầy đủ và không bắt buộc có `slot_id` online.
- Mọi `HangDoi` nên liên kết với một `LichHen`, kể cả khách tại chỗ.
- Có nguồn đặt lịch, trạng thái đến muộn, thời điểm check-in và buổi/capacity liên quan.
- Có mô hình riêng cho capacity và waiting list.
- Có thể in số phiếu cố định, nhưng thứ tự gọi nên được tính động.

### Tính nhất quán

- Lễ tân và y tá phải dùng chung một nghiệp vụ check-in backend.
- Một lịch chỉ check-in một lần và chỉ có một lượt hàng đợi đang hoạt động.
- Cập nhật `LichHen`, tạo `HangDoi` và giữ capacity phải nằm trong transaction.
- Kiểm tra capacity phải nguyên tử để hai lễ tân thao tác cùng lúc không làm vượt trần.
- Thay đổi hàng đợi phải cập nhật realtime cho lễ tân, y tá và bác sĩ.

### Thanh toán và báo cáo

- Phải chốt khách tại chỗ thanh toán trước khi vào hàng đợi hay trước khi hoàn tất khám.
- Khách tại chỗ cần lịch hẹn và hóa đơn để doanh thu không bị thiếu.
- Báo cáo phải bao gồm online, tại chỗ, no-show, đến muộn, thời gian chờ và tình trạng quá tải.

## 13. Lợi ích

- Không phải chèn khách vãng lai vào slot online.
- Không làm mất chỗ của khách đã đặt.
- Bác sĩ khám theo người thực sự có mặt.
- Giảm thời gian bác sĩ rảnh vì no-show.
- Linh hoạt khi tỷ lệ online/tại chỗ thay đổi.
- Khách tại chỗ có đủ lịch sử khám, hóa đơn và hồ sơ.
- Đo được thời gian chờ và thời gian khám thực tế.
- Admin có dữ liệu để tối ưu quota theo ngày, bác sĩ và chuyên khoa.

## 14. Bất lợi và rủi ro

- Khách online có thể hiểu nhầm giờ đặt là giờ vào khám chính xác; cần thông báo rõ.
- Thuật toán ưu tiên phức tạp hơn và có thể phát sinh tranh cãi.
- Khách tại chỗ có thể chờ lâu nếu online luôn được ưu tiên.
- Giữ quota tại chỗ quá lớn có thể làm lãng phí khả năng đặt online.
- ETA có thể sai khi ca khám kéo dài hoặc bác sĩ tạm nghỉ.
- Nhiều trạng thái hơn làm tăng khối lượng kiểm thử và đào tạo nhân viên.
- Cần chống thao tác đồng thời làm vượt capacity hoặc tạo trùng hàng đợi.
- Dữ liệu offline cũ có thể cần chuyển đổi hoặc hỗ trợ tương thích.

## 15. Lộ trình triển khai

### Giai đoạn 1 - Thống nhất lịch hẹn và check-in

- Khách tại chỗ cũng tạo `LichHen`.
- Cho phép lịch tại chỗ không chiếm slot online.
- Lễ tân và y tá dùng chung check-in.
- Mỗi check-in tạo đúng một `HangDoi`.
- Y tá và bác sĩ cùng đọc một nguồn hàng đợi.

### Giai đoạn 2 - Capacity và quota

- Tạo khái niệm buổi khám.
- Cấu hình capacity tổng và quota online.
- Áp dụng quota vào đặt online.
- Thêm giao diện admin và cảnh báo vượt capacity.

### Giai đoạn 3 - Grace period và ưu tiên động

- Thêm đến muộn/mất ưu tiên.
- Tự giải phóng ưu tiên sau grace period.
- Tăng ưu tiên theo thời gian chờ.
- Đồng bộ realtime giữa các vai trò.

### Giai đoạn 4 - ETA, waiting list và báo cáo

- Tính ETA.
- Tạo waiting list và đề xuất buổi/bác sĩ thay thế.
- Báo cáo tỷ lệ online/tại chỗ, no-show, trễ hẹn, quá tải và thời gian chờ.

## 16. Tiêu chí nghiệm thu chính

1. Check-in một lần thì bệnh nhân xuất hiện ngay cho lễ tân, y tá và bác sĩ.
2. Khách tại chỗ có lịch hẹn, hóa đơn, hàng đợi và hồ sơ đầy đủ.
3. Khách tại chỗ không chiếm hoặc thay đổi slot online đã đặt.
4. Đặt online không vượt quota; tiếp nhận tại chỗ không vượt capacity tổng.
5. Khách đến trong grace period được giữ ưu tiên; đến muộn vẫn được khám nhưng không chen đầu.
6. Khách chờ lâu được tăng ưu tiên hợp lý.
7. Không thể tạo hai hàng đợi cho cùng một lịch hẹn.
8. Hai nhân viên thao tác đồng thời không làm vượt capacity.
9. Mọi vai trò nhìn thấy cùng một trạng thái nghiệp vụ.
10. Thống kê bao gồm đầy đủ cả online và tại chỗ.

## 17. Đề xuất chốt

Nên triển khai phương án này theo từng giai đoạn. Ưu tiên đầu tiên là thống nhất chuỗi:

`LichHen -> Check-in -> HangDoi`

Chỉ sau khi luồng này ổn định mới bổ sung capacity, grace period, ETA và waiting list. Cách làm này giảm nguy cơ lệch trạng thái giữa lịch hẹn, hàng đợi, thanh toán và hồ sơ khám.
