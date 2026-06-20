# Phân tích lịch làm việc của bác sĩ trong hệ thống đặt lịch khám

## Bối cảnh hệ thống

Hệ thống phòng khám có đặc điểm:

- Chỉ có **1 cơ sở duy nhất**.
- Trong cơ sở có **nhiều tòa, nhiều tầng, nhiều phòng**.
- Dịch vụ chia thành 2 loại chính:
  - **Khám tại viện**
  - **Khám tại nhà**
- Bệnh nhân đặt lịch trên website và **thanh toán trước 100% phí dịch vụ**.
- Lịch làm việc của bác sĩ nên được tự động hóa, chỉ hiển thị các lịch hợp lệ cho bệnh nhân đặt.

Mục tiêu của phần này là phân tích cách thiết kế lịch làm việc bác sĩ sao cho:

- Không bị trùng phòng.
- Không bị trùng bác sĩ.
- Bệnh nhân biết chính xác phải đi đến đâu khi đến phòng khám.
- Bác sĩ có thể báo bận hoặc chỉnh sửa lịch trong phạm vi cho phép.
- Hệ thống có thể tự động sinh lịch trong 6 ngày làm việc gần nhất.

---

# 1. Tư duy tổng quan về lịch làm việc bác sĩ

Không nên để hệ thống mỗi ngày tạo lịch làm việc từ con số 0 một cách thủ công. Cách hợp lý hơn là tách lịch thành 2 lớp:

```text
Lịch mẫu của bác sĩ
        ↓
Hệ thống tự sinh lịch thực tế trong 6 ngày làm việc tới
        ↓
Admin/Bác sĩ chỉnh sửa nếu có ngoại lệ
        ↓
Bệnh nhân chỉ nhìn thấy các slot hợp lệ
```

Trong đó:

- **Lịch mẫu** là lịch lặp lại hằng tuần.
- **Lịch thực tế** là các slot cụ thể theo ngày, giờ, phòng để bệnh nhân đặt.

---

# 2. Lớp 1: Lịch mẫu của bác sĩ

Lịch mẫu là lịch cố định lặp lại theo tuần. Đây là dữ liệu dùng để hệ thống tự sinh lịch thật.

Ví dụ:

| Bác sĩ | Thứ | Giờ làm | Dịch vụ | Phòng mặc định |
|---|---|---|---|---|
| BS Nguyễn Văn A | Thứ 2 | 08:00–12:00 | Khám Tim mạch | Phòng 201 |
| BS Nguyễn Văn A | Thứ 4 | 08:00–12:00 | Khám Tim mạch | Phòng 201 |
| BS Nguyễn Văn A | Thứ 6 | 13:30–17:00 | Khám Tim mạch | Phòng 305 |

Lưu ý:

> Lịch mẫu không cho bệnh nhân đặt trực tiếp. Nó chỉ là khuôn để hệ thống sinh ra lịch làm việc thực tế.

---

# 3. Lớp 2: Lịch làm việc thực tế

Lịch làm việc thực tế là các slot cụ thể theo ngày thật.

Ví dụ:

| Bác sĩ | Ngày | Giờ | Phòng | Trạng thái |
|---|---|---|---|---|
| BS Nguyễn Văn A | 20/06/2026 | 08:00–08:30 | Phòng 201 | Còn trống |
| BS Nguyễn Văn A | 20/06/2026 | 08:30–09:00 | Phòng 201 | Còn trống |
| BS Nguyễn Văn A | 20/06/2026 | 09:00–09:30 | Phòng 201 | Đã đặt |
| BS Nguyễn Văn A | 20/06/2026 | 09:30–10:00 | Phòng 201 | Còn trống |

Bệnh nhân chỉ đặt lịch trên **lịch làm việc thực tế**, không đặt trên lịch mẫu.

---

# 4. Vì sao phải tách lịch mẫu và lịch thực tế?

Bác sĩ thường có lịch làm việc lặp lại, nhưng mỗi ngày vẫn có thể có ngoại lệ.

Ví dụ lịch mẫu:

```text
BS A khám Thứ 2, 08:00–12:00, Phòng 201
```

Nhưng riêng ngày 20/06 bác sĩ bận từ 10:00–11:00.

Nếu không tách lịch mẫu và lịch thực tế, việc xử lý ngoại lệ sẽ rất khó. Cách đúng là:

```text
Lịch mẫu vẫn giữ nguyên.
Riêng lịch thực tế ngày 20/06 thì khóa slot 10:00–11:00.
```

Như vậy:

- Tuần sau lịch mẫu vẫn tự chạy bình thường.
- Ngoại lệ chỉ ảnh hưởng đến đúng ngày cần chỉnh.
- Không làm hỏng lịch lặp lại lâu dài của bác sĩ.

---

# 5. Cách tự động hóa lịch trong 6 ngày làm việc

Hệ thống nên luôn hiển thị lịch trong **6 ngày làm việc gần nhất**, từ Thứ 2 đến Thứ 7.

Ví dụ hôm nay là Thứ 2, hệ thống hiển thị:

```text
Thứ 2
Thứ 3
Thứ 4
Thứ 5
Thứ 6
Thứ 7
```

Sang ngày Thứ 3, hệ thống ẩn lịch Thứ 2 cũ và thêm lịch Thứ 2 tuần sau:

```text
Thứ 3
Thứ 4
Thứ 5
Thứ 6
Thứ 7
Thứ 2 tuần sau
```

Lưu ý quan trọng:

> “Ẩn lịch cũ” không có nghĩa là xóa khỏi database.

Lịch cũ vẫn phải giữ lại để phục vụ:

- Xem lịch sử khám.
- Thống kê doanh thu.
- Kiểm tra lịch đã thanh toán.
- Xử lý hoàn tiền.
- Xử lý khiếu nại.

---

# 6. Cách xử lý lịch cũ

Khi lịch đã qua thời gian hiện tại, hệ thống nên xử lý như sau:

| Loại lịch | Cách xử lý |
|---|---|
| Lịch quá ngày, chưa ai đặt | Ẩn khỏi phía bệnh nhân |
| Lịch quá ngày, đã có bệnh nhân đặt | Giữ lại làm lịch sử |
| Lịch tương lai | Hiển thị nếu còn trống và hợp lệ |
| Lịch bị bác sĩ/admin khóa | Không hiển thị cho bệnh nhân |

Không nên xóa cứng lịch cũ vì sẽ làm mất dữ liệu lịch sử.

---

# 7. Bác sĩ có nên tự chỉnh lịch không?

Bác sĩ nên được quyền chỉnh lịch, nhưng phải giới hạn quyền.

| Hành động | Có nên cho bác sĩ làm? | Ghi chú |
|---|---:|---|
| Xem lịch cá nhân | Có | Bác sĩ xem lịch của mình |
| Khóa thời gian bận | Có | Ví dụ bận 10:00–11:00 |
| Mở thêm ca khám | Có thể | Chỉ khi còn phòng trống |
| Đổi phòng | Có thể | Bắt buộc kiểm tra trùng phòng |
| Xóa slot chưa ai đặt | Có | Có thể chuyển sang trạng thái “Bác sĩ bận” |
| Xóa slot đã có bệnh nhân đặt | Không nên | Vì bệnh nhân đã thanh toán 100% |
| Hủy lịch đã có bệnh nhân đặt | Cần quy trình riêng | Admin xử lý dời lịch/hoàn tiền |

Nguyên tắc quan trọng:

> Slot đã có bệnh nhân đặt và thanh toán không được xóa trực tiếp.

---

# 8. Khi tự tạo lịch thì có nên tự gán phòng không?

Có 3 cách xử lý.

## Cách 1: Không tự gán phòng, để bác sĩ hoặc admin tự chọn

Hệ thống sinh lịch như sau:

```text
BS A - 20/06 - 08:00–12:00 - Chưa gán phòng
```

Sau đó bác sĩ hoặc admin vào chọn phòng.

Ưu điểm:

| Ưu điểm | Giải thích |
|---|---|
| Linh hoạt | Bác sĩ/admin tự chọn phòng phù hợp |
| Ít lỗi tự động | Hệ thống không tự đoán sai |
| Dễ làm giai đoạn đầu | Logic đơn giản |

Nhược điểm:

| Nhược điểm | Giải thích |
|---|---|
| Tốn thao tác | Mỗi lần sinh lịch phải gán phòng |
| Dễ quên | Nếu quên gán phòng, bệnh nhân không biết đi đâu |
| Không nên mở cho đặt nếu thiếu phòng | Vì bệnh nhân cần thông tin rõ ràng |

Quy tắc nếu dùng cách này:

> Slot chưa có phòng thì không hiển thị cho bệnh nhân đặt lịch.

---

# 9. Cách 2: Tự động gán phòng hoàn toàn

Hệ thống tự tìm phòng trống rồi gán cho bác sĩ.

Ví dụ:

```text
BS A khám Tim mạch 08:00–12:00
Hệ thống tìm phòng Tim mạch còn trống
Tự gán Phòng 201
```

Ưu điểm:

| Ưu điểm | Giải thích |
|---|---|
| Tự động cao | Admin/bác sĩ ít phải thao tác |
| Bệnh nhân luôn thấy đủ thông tin | Có tòa, tầng, phòng rõ ràng |
| Phù hợp khi có quy tắc phòng ổn định | Ví dụ mỗi khoa có nhóm phòng riêng |

Nhược điểm:

| Nhược điểm | Giải thích |
|---|---|
| Logic phức tạp hơn | Phải kiểm tra phòng trống |
| Có thể gán chưa tối ưu | Bác sĩ quen phòng 201 nhưng hệ thống gán phòng 305 |
| Cần dữ liệu phòng tốt | Phòng thuộc khoa nào, loại phòng gì, đang bảo trì không |

---

# 10. Cách 3: Kết hợp tự động và cho phép chỉnh sửa

Đây là cách nên dùng nhất.

Cách hoạt động:

```text
Bước 1: Admin tạo lịch mẫu cho bác sĩ, có phòng mặc định.
Bước 2: Hệ thống tự sinh lịch 6 ngày tới.
Bước 3: Khi sinh lịch, hệ thống tự gán phòng theo phòng mặc định.
Bước 4: Nếu phòng bị trùng hoặc đang bảo trì, hệ thống tìm phòng thay thế.
Bước 5: Nếu không tìm được phòng, slot chuyển sang trạng thái "Chờ gán phòng".
Bước 6: Admin/bác sĩ có thể chỉnh lại phòng nếu cần.
```

Kết luận:

> Nên tự động gán phòng, nhưng phải cho phép chỉnh sửa và bắt buộc kiểm tra trùng phòng trước khi lưu.

---

# 11. Mô hình nên dùng cho phòng khám 1 cơ sở, nhiều tòa/tầng/phòng

Với phòng khám chỉ có 1 cơ sở nhưng nhiều tòa, tầng, phòng, mô hình đề xuất là:

```text
Bác sĩ có lịch mẫu.
Lịch mẫu có thể gắn phòng mặc định.
Hệ thống tự sinh lịch thực tế 6 ngày tới.
Hệ thống tự kiểm tra phòng trống.
Nếu phòng mặc định trống → gán phòng đó.
Nếu phòng mặc định bận → tìm phòng phù hợp khác.
Nếu không có phòng → để trạng thái "Chờ gán phòng".
Bệnh nhân chỉ thấy slot đã có phòng và còn trống.
```

Ngắn gọn:

> Nên tự động gán phòng theo lịch mẫu. Nếu không chắc chắn thì không cho bệnh nhân đặt slot đó.

---

# 12. Phòng trống được kiểm tra như thế nào?

Một phòng được coi là trống khi trong cùng khoảng thời gian đó:

```text
Không có bác sĩ khác dùng phòng đó.
Không có lịch hẹn khác trong phòng đó.
Phòng không bị khóa/bảo trì.
Phòng đúng loại dịch vụ cần khám.
Phòng đang hoạt động.
```

Điều kiện kiểm tra trùng thời gian cơ bản:

```text
new_start < existing_end
AND
new_end > existing_start
```

Ví dụ:

| Lịch mới | Lịch cũ | Có trùng không? |
|---|---|---|
| 09:00–09:30 | 08:30–09:00 | Không trùng |
| 09:00–09:30 | 09:00–09:30 | Trùng |
| 09:00–09:30 | 09:15–09:45 | Trùng |
| 09:00–09:30 | 08:45–09:15 | Trùng |
| 09:00–09:30 | 09:30–10:00 | Không trùng |

---

# 13. Ví dụ kiểm tra phòng trống

Giả sử Phòng 201 đã có lịch:

| Phòng | Bác sĩ | Ngày | Giờ |
|---|---|---|---|
| 201 | BS B | 20/06/2026 | 08:00–09:00 |
| 201 | BS C | 20/06/2026 | 10:00–11:00 |

Hệ thống muốn gán:

```text
BS A
20/06/2026
09:00–09:30
Phòng 201
```

Kiểm tra:

```text
09:00–09:30 có đè lên 08:00–09:00 không? Không.
09:00–09:30 có đè lên 10:00–11:00 không? Không.
```

Vậy Phòng 201 trống.

Nếu hệ thống muốn gán:

```text
BS A
20/06/2026
08:30–09:30
Phòng 201
```

Kiểm tra:

```text
08:30–09:30 có đè lên 08:00–09:00 không? Có.
```

Vậy không được gán.

---

# 14. Thứ tự ưu tiên khi tự động gán phòng

Khi hệ thống sinh lịch, nên gán phòng theo thứ tự ưu tiên:

```text
1. Phòng mặc định của bác sĩ trong lịch mẫu.
2. Phòng thuộc đúng chuyên khoa.
3. Phòng đúng loại dịch vụ.
4. Phòng đang hoạt động.
5. Phòng trống trong khoảng thời gian đó.
6. Phòng gần/khu vực ưu tiên nếu có.
```

Ví dụ BS Nguyễn Văn A thuộc chuyên khoa Tim mạch, hệ thống nên ưu tiên:

```text
Phòng 201 - Tim mạch
Phòng 202 - Tim mạch
Phòng 203 - Nội tổng quát
```

Không nên tự gán bác sĩ Tim mạch vào phòng xét nghiệm, phòng siêu âm hoặc phòng thủ thuật nếu không phù hợp.

---

# 15. Quy tắc gán phòng đề xuất

Logic đề xuất:

```text
Nếu lịch mẫu có phòng mặc định:
    Kiểm tra phòng đó có trống không.
    Nếu trống:
        Gán phòng đó.
    Nếu không trống:
        Tìm phòng khác cùng khoa/cùng loại phòng.
        Nếu có:
            Gán phòng thay thế.
        Nếu không:
            Để trạng thái "Chờ gán phòng".

Nếu lịch mẫu không có phòng mặc định:
    Tìm phòng phù hợp còn trống.
    Nếu có:
        Gán phòng.
    Nếu không:
        Để trạng thái "Chờ gán phòng".
```

Slot chỉ được hiển thị cho bệnh nhân nếu:

```text
Có bác sĩ.
Có ngày giờ.
Có phòng.
Phòng không trùng.
Trạng thái = Còn trống.
```

---

# 16. Có nên để bác sĩ tự gán phòng không?

Không nên để bác sĩ toàn quyền tự gán phòng nếu hệ thống có nhiều phòng và nhiều bác sĩ.

Nên chia quyền như sau:

## Admin / Điều phối viên

Có quyền:

```text
Tạo lịch mẫu.
Gán phòng mặc định.
Duyệt lịch.
Đổi phòng.
Khóa phòng.
Xử lý trùng lịch.
```

## Bác sĩ

Có quyền:

```text
Xem lịch của mình.
Báo bận.
Khóa slot chưa có bệnh nhân.
Đề xuất đổi phòng.
Mở thêm ca nếu được cho phép.
```

## Hệ thống

Có nhiệm vụ:

```text
Tự sinh lịch.
Tự gán phòng theo quy tắc.
Kiểm tra trùng phòng.
Không cho đặt slot lỗi.
Ẩn lịch cũ khỏi phía bệnh nhân.
```

Nếu hệ thống nhỏ, vẫn có thể cho bác sĩ đổi phòng, nhưng bắt buộc hệ thống phải kiểm tra trùng phòng trước khi lưu.

---

# 17. Khi bác sĩ bận thì xử lý thế nào?

Không nên cho bác sĩ xóa ca tự do trong mọi trường hợp. Cần chia thành 2 tình huống.

## Tình huống 1: Ca chưa có bệnh nhân đặt

Ví dụ:

```text
BS A có slot 10:00–10:30.
Chưa ai đặt.
Bác sĩ bận.
```

Cho phép:

```text
Khóa slot.
Xóa slot.
Đổi trạng thái thành "Bác sĩ bận".
```

Bệnh nhân sẽ không thấy slot đó nữa.

## Tình huống 2: Ca đã có bệnh nhân đặt

Ví dụ:

```text
BS A có slot 09:00–09:30.
Bệnh nhân đã đặt và đã thanh toán 100%.
Bác sĩ bận đột xuất.
```

Không nên cho bác sĩ xóa trực tiếp.

Quy trình đúng:

```text
Bác sĩ gửi yêu cầu hủy/dời lịch.
Admin xác nhận.
Hệ thống thông báo bệnh nhân.
Bệnh nhân chọn lịch khác hoặc được hoàn tiền.
Lịch hẹn chuyển trạng thái "Chờ xử lý" / "Đã hủy" / "Đã dời".
```

Lý do: bệnh nhân đã trả tiền, nếu bác sĩ tự xóa sẽ gây mất dữ liệu và khó xử lý khiếu nại.

---

# 18. Trạng thái lịch nên có

Nên thiết kế trạng thái cho slot như sau:

| Trạng thái | Ý nghĩa | Có hiển thị cho bệnh nhân không? |
|---|---|---:|
| Còn trống | Có thể đặt | Có |
| Đã đặt | Đã có bệnh nhân | Không |
| Đã khóa | Admin/bác sĩ khóa | Không |
| Bác sĩ bận | Bác sĩ không nhận khám | Không |
| Chờ gán phòng | Chưa có phòng hợp lệ | Không |
| Phòng bị trùng | Có lỗi gán phòng | Không |
| Đã hoàn thành | Đã khám xong | Không |
| Đã hủy | Lịch bị hủy | Không |
| Đã hết hạn | Slot đã qua thời gian đặt | Không |

Quy tắc quan trọng:

> Bệnh nhân chỉ thấy slot có trạng thái “Còn trống”.

---

# 19. Khi hệ thống tự sinh lịch, nên sinh theo ca hay theo slot nhỏ?

Có 2 cách.

## Cách A: Sinh theo ca làm việc

Ví dụ:

```text
BS A
08:00–12:00
Phòng 201
```

Khi bệnh nhân đặt, hệ thống tự chia slot 30 phút.

Ưu điểm:

```text
Ít dữ liệu.
Dễ quản lý ca làm việc.
```

Nhược điểm:

```text
Khi muốn khóa 09:00–09:30 thì phải xử lý thêm.
```

## Cách B: Sinh sẵn từng slot nhỏ

Ví dụ:

```text
08:00–08:30
08:30–09:00
09:00–09:30
09:30–10:00
...
```

Ưu điểm:

```text
Dễ hiển thị cho bệnh nhân.
Dễ khóa từng slot.
Dễ kiểm tra đã đặt/chưa đặt.
```

Nhược điểm:

```text
Nhiều dữ liệu hơn.
```

Với hệ thống đặt lịch khám, nên chọn:

> Sinh sẵn từng slot nhỏ.

Vì website đặt lịch cần hiển thị rõ từng giờ cho bệnh nhân chọn.

---

# 20. Quy trình tự động sinh lịch đề xuất

Mỗi ngày, hệ thống chạy một tác vụ tự động, ví dụ lúc 00:05.

## Bước 1: Ẩn slot cũ

```text
Nếu slot chưa đặt:
    Chuyển thành "Đã hết hạn".

Nếu slot đã đặt:
    Giữ làm lịch sử.
```

## Bước 2: Tính 6 ngày làm việc tiếp theo

Hệ thống lấy 6 ngày làm việc kế tiếp từ Thứ 2 đến Thứ 7.

Ví dụ hôm nay là Thứ 3:

```text
Thứ 3
Thứ 4
Thứ 5
Thứ 6
Thứ 7
Thứ 2 tuần sau
```

Chủ nhật không sinh lịch nếu phòng khám nghỉ.

## Bước 3: Đọc lịch mẫu của từng bác sĩ

Ví dụ lịch mẫu:

```text
BS A - Thứ 2 - 08:00–12:00 - Khám Tim mạch - Phòng 201
```

## Bước 4: Kiểm tra ngày đó đã có slot chưa

Việc này để tránh sinh trùng.

```text
Nếu slot ngày đó đã tồn tại:
    Không tạo lại.
Nếu chưa tồn tại:
    Tiến hành sinh slot mới.
```

## Bước 5: Chia ca thành slot nhỏ

Nếu ca là:

```text
08:00–12:00
```

Thời lượng dịch vụ là:

```text
30 phút
```

Thì sinh:

```text
08:00–08:30
08:30–09:00
09:00–09:30
09:30–10:00
10:00–10:30
10:30–11:00
11:00–11:30
11:30–12:00
```

## Bước 6: Gán phòng

Với mỗi slot:

```text
Kiểm tra phòng mặc định.
Nếu phòng trống → gán.
Nếu không → tìm phòng thay thế.
Nếu không có → Chờ gán phòng.
```

## Bước 7: Chỉ mở slot hợp lệ

Slot được mở cho bệnh nhân nếu đủ điều kiện:

```text
Có bác sĩ.
Có dịch vụ.
Có ngày giờ.
Có phòng.
Phòng không trùng.
Không bị khóa.
Trạng thái = Còn trống.
```

---

# 21. Database gợi ý

## Bảng `doctor_schedule_templates`

Đây là bảng lưu lịch mẫu.

```text
id
doctor_id
service_id
specialty_id
day_of_week
start_time
end_time
slot_duration_minutes
default_room_id
status
created_at
updated_at
```

Ví dụ:

| doctor_id | day_of_week | start_time | end_time | default_room_id |
|---|---|---|---|---|
| BS_A | Monday | 08:00 | 12:00 | P201 |

## Bảng `doctor_work_slots`

Đây là bảng lưu lịch thật cho bệnh nhân đặt.

```text
id
doctor_id
service_id
specialty_id
work_date
start_time
end_time
room_id
status
source
template_id
created_at
updated_at
```

Trong đó:

| Trường | Ý nghĩa |
|---|---|
| `room_id` | Phòng thực tế của slot |
| `status` | Còn trống, đã đặt, khóa, chờ gán phòng |
| `source` | Auto-generated / Manual |
| `template_id` | Sinh ra từ lịch mẫu nào |

## Bảng `rooms`

```text
id
building
floor
room_number
room_name
room_type
specialty_id
status
note
```

Ví dụ:

| building | floor | room_number | room_type | specialty |
|---|---|---|---|---|
| Tòa A | Tầng 2 | 201 | Phòng khám | Tim mạch |

## Bảng `room_blocks`

Dùng để khóa phòng khi bảo trì hoặc không sử dụng.

```text
id
room_id
block_date
start_time
end_time
reason
created_at
```

Ví dụ:

```text
Phòng 201
20/06/2026
08:00–12:00
Lý do: Bảo trì điều hòa
```

## Bảng `appointments`

Lưu lịch bệnh nhân đã đặt.

```text
id
patient_id
doctor_id
service_id
slot_id
room_id
appointment_date
start_time
end_time
payment_status
appointment_status
created_at
```

Lưu ý quan trọng:

> Khi bệnh nhân đặt thành công, nên lưu cả `slot_id` và `room_id` tại thời điểm đặt.

Lý do: sau này nếu lịch mẫu đổi phòng, lịch hẹn cũ của bệnh nhân vẫn không bị sai.

---

# 22. Kết luận mô hình đề xuất

Với hệ thống phòng khám có 1 cơ sở nhưng nhiều tòa, tầng, phòng, mô hình nên thiết kế như sau:

```text
1. Admin tạo lịch mẫu cho từng bác sĩ.
2. Lịch mẫu có thể gắn phòng mặc định.
3. Hệ thống tự sinh slot trong 6 ngày làm việc tiếp theo.
4. Khi sinh slot, hệ thống tự kiểm tra phòng trống.
5. Nếu phòng mặc định trống → tự gán.
6. Nếu phòng mặc định bận → tự tìm phòng cùng khoa/cùng loại.
7. Nếu không có phòng → trạng thái "Chờ gán phòng".
8. Slot chưa có phòng không được hiển thị cho bệnh nhân.
9. Bác sĩ có thể khóa thời gian bận nếu slot chưa có bệnh nhân.
10. Slot đã có bệnh nhân đặt thì không được xóa trực tiếp.
```

Câu trả lời ngắn gọn cho vấn đề gán phòng:

> Nên tự động gán phòng theo lịch mẫu, nhưng bắt buộc kiểm tra phòng trống trước khi lưu. Bác sĩ hoặc admin có thể chỉnh lại phòng, nhưng hệ thống phải kiểm tra trùng phòng. Nếu không tìm được phòng hợp lệ thì slot không được mở cho bệnh nhân đặt.

Mô hình này an toàn vì:

- Không bị trùng phòng.
- Không bị sai vị trí khám của bệnh nhân.
- Không làm mất lịch sử đặt lịch.
- Phù hợp với phòng khám 1 cơ sở nhưng nhiều tòa/tầng/phòng.
- Hỗ trợ tự động hóa mà vẫn cho phép xử lý ngoại lệ.

---

# Phụ lục: Pseudo-code kiểm tra phòng trống

```text
function isRoomAvailable(room_id, date, new_start, new_end):
    conflict = find slot where
        room_id = room_id
        date = date
        status in ['Còn trống', 'Đã đặt', 'Đã khóa']
        and new_start < existing_end
        and new_end > existing_start

    maintenance = find room_block where
        room_id = room_id
        date = date
        and new_start < block_end
        and new_end > block_start

    if conflict exists or maintenance exists:
        return false

    return true
```

---

# Phụ lục: Pseudo-code tìm phòng thay thế

```text
function findAvailableRoom(service, specialty, date, start, end):
    rooms = find rooms where
        status = 'Đang hoạt động'
        room_type = 'Phòng khám'
        specialty_id = specialty_id

    sort rooms by priority

    for room in rooms:
        if isRoomAvailable(room.id, date, start, end):
            return room

    return null
```

---

# Phụ lục: Thông tin bệnh nhân nhận sau khi đặt lịch

Ví dụ bệnh nhân đặt lịch thành công:

```text
✅ Lịch hẹn đã xác nhận

Dịch vụ: Khám Tim mạch tại viện
Bác sĩ: BS Nguyễn Văn A
Ngày giờ: 20/06/2026, 09:00–09:30
Vị trí: Tòa A, Tầng 2, Phòng 201
Thanh toán: Đã thanh toán 100%
Mã lịch hẹn: VF-2026-0089

Vui lòng đến trước 10–15 phút và báo mã lịch hẹn tại quầy lễ tân.
```

Nếu slot chưa có phòng:

```text
Không hiển thị slot đó cho bệnh nhân đặt.
```

Không nên để bệnh nhân đặt xong rồi mới báo “vui lòng hỏi lễ tân”, trừ khi đây là phương án dự phòng.
