# Kế hoạch xử lý lỗi nghiệp vụ actor Lễ tân

Ngày lập: 2026-08-02  
Phạm vi: lịch khám tại phòng khám; actor chính là **lễ tân**, phối hợp với khách hàng, bác sĩ và admin.

## 1. Kết luận ngắn

Các góp ý không phải là các nút chức năng rời rạc. Chúng cùng chỉ ra bốn thiếu hụt trong luồng lễ tân:

1. Chưa có cơ chế điều phối khi lịch bị gián đoạn: bác sĩ nghỉ đột xuất, khách đến trễ, bác sĩ khám kéo dài.
2. Chưa tách rõ **lịch hẹn đã đặt** với **lượt khám thực tế** và thứ tự trong hàng đợi.
3. Chưa khóa đúng các thời điểm nhạy cảm, đặc biệt khi bệnh nhân đã vào phòng khám.
4. Chưa có bằng chứng đầy đủ cho thao tác của lễ tân: thông báo khách hàng, lịch sử dời lịch và lịch sử sửa dữ liệu.

Hướng xử lý tối giản là giữ các thực thể hiện có:

```text
LichHen       = cam kết đặt chỗ trước khi đến
HangDoi       = lượt khám thực tế sau check-in
LichLamViec   = nguồn slot và năng lực phục vụ của bác sĩ
LichSuLichHen = lịch sử thay đổi của một lịch hẹn
NhatKyThaoTac = audit cho thao tác sửa dữ liệu/hồ sơ
ThongBao      = thông báo trong hệ thống và trạng thái gửi
```

Không tạo một “lịch chờ” hoặc “bảng điều phối” lớn riêng chỉ để giải quyết từng tình huống. Với bác sĩ nghỉ đột xuất, dùng `de_xuat_doi` đang có trên `LichHen`; với khám kéo dài, dùng dữ liệu hàng đợi và trạng thái vận hành của bác sĩ. Chỉ bổ sung trường nhỏ khi dữ liệu đó là bằng chứng không thể suy ra được, ví dụ số thứ tự check-in.

## 2. Workflow làm việc trước khi sửa code

Trước khi bắt tay vào từng task, phải đi theo một workflow phân tích cố định. Mục tiêu của bước này là tránh sửa một chức năng ở màn lễ tân nhưng lại làm sai luồng đặt lịch online, check-in, hàng đợi, bác sĩ khám, hóa đơn, bệnh án hoặc thông báo khách hàng.

### 2.1. Bước 1 - Chụp hiện trạng hệ thống đang có

Với mỗi lỗi nghiệp vụ, không bắt đầu bằng câu hỏi “thêm nút nào” mà bắt đầu bằng câu hỏi “hệ thống hiện đang lưu và đổi trạng thái như thế nào”.

Các điểm phải kiểm tra:

| Nhóm cần đọc | Cần làm rõ |
|---|---|
| Model dữ liệu | `LichHen`, `HangDoi`, `LichLamViec`, `LichSuLichHen`, hồ sơ bệnh nhân, bệnh án, thông báo |
| API backend | API nào đang tạo lịch, dời lịch, hủy lịch, check-in, gọi vào phòng, hoàn tất khám |
| Frontend lễ tân | Màn nào đang gọi API, nút nào đang cho thao tác, trạng thái nào đang ẩn/hiện |
| Actor liên quan | Khách hàng, bác sĩ, admin có đang dùng chung dữ liệu hoặc API với lễ tân không |
| Ràng buộc hiện tại | Có transaction chưa, có chống trùng slot chưa, có audit chưa, có gửi thông báo chưa |

Kết quả của bước này là một bảng “hiện trạng”. Ví dụ:

```text
Chức năng: hủy lịch
Hiện tại: đổi LichHen.status và trả slot LichLamViec
Thiếu: chưa chuẩn hóa audit lễ tân, chưa ràng buộc thông báo, chưa khóa nếu bệnh nhân đang khám
Luồng bị ảnh hưởng: khách đặt lại slot, lễ tân xem lịch, bác sĩ xem hàng đợi, báo cáo lịch sử
```

### 2.2. Bước 2 - Viết lại yêu cầu mong muốn theo nghiệp vụ

Sau khi biết hiện trạng, mới chuyển góp ý của thầy thành yêu cầu có thể kiểm thử được. Yêu cầu phải viết theo dạng actor + hành động + điều kiện + kết quả.

Ví dụ với khách đến muộn:

```text
Khi khách đã có lịch nhưng đến muộn,
lễ tân được chọn một trong ba phương án:
1. đưa khách xuống cuối lượt chờ trong cùng ca,
2. chuyển sang slot trống gần nhất,
3. dời sang ngày hôm sau.

Mỗi phương án phải ghi lịch sử và tạo thông báo cho khách.
Nếu khách đã vào phòng khám thì không được dời/hủy lịch nữa.
```

Viết như vậy giúp tránh yêu cầu mơ hồ như “sửa lại trạng thái” hoặc “đẩy lịch đi”, vì những câu đó chưa nói rõ dữ liệu nào đổi, ai được đổi, và đổi xong actor khác nhìn thấy gì.

### 2.3. Bước 3 - Vẽ luồng tương tác giữa các actor

Mỗi task phải có luồng tối thiểu gồm lễ tân, hệ thống và actor bị ảnh hưởng. Nếu chỉ phân tích trong màn lễ tân thì chưa đủ.

Mẫu luồng:

```text
Lễ tân thao tác
  -> backend kiểm tra trạng thái lịch/hàng đợi/slot
  -> backend ghi thay đổi trong transaction
  -> backend ghi lịch sử/audit
  -> backend tạo thông báo hoặc việc cần gọi thủ công
  -> khách hàng/bác sĩ/admin nhìn thấy trạng thái mới
```

Các câu hỏi bắt buộc:

1. Khách hàng có cần biết thay đổi này không?
2. Bác sĩ có đang dùng lịch hoặc hàng đợi này không?
3. Slot có được mở lại cho người khác đặt không?
4. Có cần chống hai lễ tân thao tác cùng lúc không?
5. Có cần khóa khi `LichHen.status='in_progress'` hoặc `HangDoi.trang_thai='trong_phong'` không?
6. Có cần lịch sử trước/sau để giải trình không?

### 2.4. Bước 4 - Kiểm tra xung đột chức năng trước khi chọn giải pháp

Mỗi phương án sửa phải được soi qua các chức năng liên quan. Nếu có xung đột, không code ngay mà phải điều chỉnh lại giải pháp.

| Chức năng định sửa | Có thể xung đột với | Rủi ro nếu không kiểm tra |
|---|---|---|
| Dời lịch | đặt lịch online, slot bác sĩ, thông báo, audit | trùng slot, khách không biết lịch mới, mất lịch sử |
| Hủy lịch | đặt lịch online, hàng đợi, hóa đơn nếu đã khám | người khác không đặt được slot, hoặc hủy nhầm lượt đang khám |
| Check-in | hàng đợi, số thứ tự, bác sĩ gọi bệnh nhân | trùng số thứ tự, tạo hai lượt khám cho một lịch |
| Khách đến muộn | thứ tự hàng đợi, slot trong ngày, notification | đẩy sai người đang chờ, khách bị đổi giờ không rõ lý do |
| Bác sĩ khám lâu | dashboard bác sĩ, hàng đợi, lịch chưa check-in | tự động đổi giờ hàng loạt, làm lệch cam kết đặt lịch |
| Chuyển bác sĩ | lịch làm việc bác sĩ mới, chuyên khoa, thông báo | chuyển sang bác sĩ không phù hợp hoặc không còn slot |
| Sửa thông tin bệnh nhân | hồ sơ khám, hóa đơn, bệnh án, audit | mất tính truy vết dữ liệu đã dùng trong khám |
| Sửa bệnh án | quyền bác sĩ/admin, pháp lý nghiệp vụ, lịch sử revision | lễ tân sửa dữ liệu chuyên môn không kiểm soát |

Nguyên tắc chọn giải pháp: ưu tiên thay đổi nhỏ trong luồng hiện có, thêm guard và audit trước khi thêm bảng/màn hình mới. Chỉ thêm dữ liệu mới khi không thể suy ra từ dữ liệu hiện có.

### 2.5. Bước 5 - Chốt contract trước khi code task

Một task chỉ được chuyển sang code khi đã trả lời đủ các mục sau:

| Contract cần chốt | Câu trả lời cần có |
|---|---|
| Trạng thái đầu vào | Lịch/hàng đợi/slot đang ở trạng thái nào thì được thao tác |
| Trạng thái đầu ra | Sau thao tác, `LichHen`, `HangDoi`, `LichLamViec` đổi ra sao |
| Quyền actor | Lễ tân/admin/bác sĩ/khách ai được làm, ai chỉ được xem |
| Audit | Ghi bảng nào, ghi trước/sau gì, ghi lý do gì |
| Thông báo | Có gửi cho khách không, gửi nội dung gì, gửi lỗi thì xử lý thế nào |
| Transaction | Các thay đổi nào phải commit cùng nhau |
| API/UI | API trả gì cho frontend, nút nào bật/tắt, lỗi nào hiển thị |
| Test liên chức năng | Cần test thêm luồng nào ngoài màn lễ tân |

Nếu thiếu một trong các contract này, task chưa đủ rõ để code.

### 2.6. Bước 6 - Thứ tự làm việc cho từng task

Workflow cho từng task sẽ là:

```text
1. Đọc code hiện tại của đúng luồng
2. Ghi lại hiện trạng và điểm thiếu
3. So sánh với yêu cầu mong muốn
4. Liệt kê chức năng liên quan có thể xung đột
5. Chọn phương án sửa tối giản
6. Chốt dữ liệu/API/UI/audit/notification/test
7. Sau đó mới code
8. Chạy test hoặc kiểm thử tay theo kịch bản liên actor
```

Vì vậy, task đầu tiên về mặt quản lý công việc không phải là sửa `LT-00` ngay, mà là chạy workflow phân tích cho `LT-00`. Sau khi `LT-00` được phân tích đủ rõ, mới bắt đầu sửa contract trạng thái và quyền lễ tân.

## 3. Quy ước nền tảng cần chốt trước

### 3.1. Phân tách ba lớp trạng thái

| Lớp | Dữ liệu | Ý nghĩa | Không dùng để |
|---|---|---|---|
| Lịch hẹn | `LichHen.status` | Chưa xác nhận, đã xác nhận, đã check-in, đang khám, hoàn tất, hủy, vắng mặt | Suy ra vị trí xếp hàng |
| Hàng đợi | `HangDoi.trang_thai` | Đang chờ, đã gọi, trong phòng, chờ dịch vụ, bỏ qua, hoàn thành | Giữ chỗ đặt lịch cho người khác |
| Bác sĩ/ca làm việc | trạng thái tác nghiệp của bác sĩ và `LichLamViec` | Có thể tiếp nhận, tạm gián đoạn, quá tải, nghỉ đột xuất | Thay thế trạng thái của từng lịch hẹn |

Không được dùng một trạng thái “đang khám” chung cho cả bác sĩ lẫn lịch hẹn. Bác sĩ có thể đang khám một người, trong khi các lịch khác của họ vẫn đang chờ. Tương tự, số thứ tự check-in là mã nhận diện lượt, còn vị trí gọi khám phải tính động từ hàng đợi; hai khái niệm này không được gộp làm một.

### 3.2. Quyền thao tác gọn và rõ

| Actor | Được làm | Không được làm |
|---|---|---|
| Lễ tân | check-in, tạo lượt tại quầy, dời/hủy lịch trước khi vào hàng đợi, đề xuất/chọn phương án điều phối, sửa thông tin hành chính có lý do | tự đổi kết quả khám, tự đổi chẩn đoán/đơn thuốc, sửa lịch đang trong phòng |
| Bác sĩ | gọi bệnh nhân, vào phòng, hoàn tất khám, cập nhật trạng thái năng lực phục vụ | tự check-in khách, tự dời các lịch khác của khách |
| Admin | duyệt trường hợp ngoại lệ, điều phối bác sĩ nghỉ, sửa dữ liệu theo quyền cao hơn | xóa lịch sử/audit, ghi đè dữ liệu không lý do |
| Khách hàng | nhận thông báo, chọn phương án dời khi được mời, tự hủy/dời trong điều kiện cho phép | tự chuyển bác sĩ hoặc sửa lịch đã vào khám |

### 3.3. Nguyên tắc chống rườm rà

- Không tự động đổi bác sĩ hoặc đổi ngày cho khách. Hệ thống chỉ gợi ý và giữ tạm phương án; lễ tân/khách xác nhận theo quy tắc từng tình huống.
- Không tự động đẩy tất cả `gio_kham` khi một ca khám kéo dài. Lịch đã đặt vẫn giữ cam kết; hệ thống cập nhật ước tính chờ và điều phối trên hàng đợi.
- Mỗi thao tác thay đổi phải có một lý do chuẩn hóa và ghi một audit; không cần tạo thêm nhiều màn hình nhật ký riêng.
- Thông báo là phần của giao dịch điều phối. Không trả kết quả “đã dời” khi chưa tạo bản ghi thông báo hoặc bản ghi “cần gọi thủ công”.

## 4. Backlog theo task độc lập

### LT-00 - Chuẩn hóa contract trạng thái và quyền lễ tân

**Mức ưu tiên:** P0. **Phụ thuộc:** không có. **Lý do phải làm trước:** các task sau sẽ mâu thuẫn nếu mỗi API tự kiểm tra trạng thái theo cách khác nhau.

**Tình trạng triển khai 2026-08-02:** đã code phần nền của LT-00. Backend đã có helper action/guard dùng chung, API danh sách lịch lễ tân trả `allowed_actions`, `lock_reason`, `queue_state`; frontend lễ tân đọc contract này để hiện nút thao tác; `LichSuLichHen.vai_tro` đã cho phép `receptionist`. Các nghiệp vụ thông báo khách, điều phối khách đến muộn, bác sĩ khám lâu và bác sĩ nghỉ đột xuất vẫn nằm ở các task sau.

**Lỗi/gap hiện tại:** enum trạng thái đã có `checked_in` và `in_progress`, nhưng nhiều nơi còn kiểm tra bằng danh sách tự viết. Nếu từng màn hình tự quyết “lịch nào được dời/hủy”, lễ tân có thể thao tác khác nhau trên cùng một lịch.

**Luồng thao tác:**

```text
Lễ tân mở lịch
  -> backend đọc LichHen + HangDoi liên quan
  -> trả action được phép: check-in / dời / hủy / chỉ xem
  -> giao diện chỉ hiện action đó
  -> backend vẫn kiểm tra lại trước khi ghi
```

**Giải pháp tối giản:** tạo một module hằng số/guard dùng chung cho các khả năng `coTheCheckIn`, `coTheDoiLich`, `coTheHuyLich`, `biKhoaDoDangKham`. Quy tắc khóa quan trọng là: lịch có `HangDoi.trang_thai='trong_phong'` hoặc `LichHen.status='in_progress'` chỉ được xem, không dời/hủy/sửa thời gian.

**Dữ liệu/API/UI cần tác động:**

- Dùng lại `backend/src/utils/appointmentStatus.js`; không đổi tên enum hàng loạt.
- API lịch hẹn trả thêm `allowed_actions` và `lock_reason` để frontend không tự suy đoán.
- Màn lễ tân ẩn hoặc khóa nút, nhưng phải hiển thị lý do như “Bệnh nhân đang trong phòng khám”.

**Nghiệm thu:** cùng một lịch đang khám, mọi endpoint dời/hủy/sửa đều trả `409`; UI không còn nút thao tác gây hiểu nhầm; lịch `confirmed` chưa check-in vẫn có action đúng quyền.

#### Phân tích workflow LT-00 trước khi code

**1. Hiện trạng hệ thống đang có**

| Thành phần | Hiện trạng đã kiểm tra | Nhận xét |
|---|---|---|
| `LichHen.status` | Model đang có `pending`, `confirmed`, `checked_in`, `in_progress`, `waiting_record`, `waiting_doctor_confirm`, `completed`, `cancelled`, `no_show`, `skipped` tại `backend/src/models/LichHen.js`. | Enum khá đầy đủ, không cần đổi tên hàng loạt. Vấn đề là các nơi dùng enum chưa thống nhất. |
| `appointmentStatus.js` | Helper đang phân nhóm trạng thái, nhưng comment/list chưa khớp hoàn toàn với enum mới, đặc biệt `waiting_record` và `skipped`. | Nếu các task sau dựa vào helper thiếu trạng thái, thống kê hoặc guard sẽ lệch. |
| `HangDoi.trang_thai` | Hàng đợi đã có `dang_cho`, `da_goi`, `trong_phong`, `cho_dich_vu`, `skipped`, `cancelled`, `hoan_thanh`; có unique index theo `appointment_id`. | Đây là nguồn đáng tin để biết bệnh nhân đã vào hàng đợi/chưa và có đang trong phòng không. |
| Check-in lễ tân | `markAsArrived` gọi service chung `checkInLichHen`, service tạo `HangDoi` và đổi `LichHen.status='checked_in'`. | Luồng này đã đúng hướng, nên LT-00 không nên viết lại check-in. Chỉ cần đưa nó vào contract action chung. |
| Dời lịch lễ tân | Controller tự chặn `completed`, `cancelled`, `no_show`, nhưng chưa dùng guard chung; history dời lịch đang ghi `vai_tro='admin'`. | Có thể dời nhầm các trạng thái nhạy cảm như `checked_in`, `in_progress` nếu thiếu kiểm tra hàng đợi. |
| Hủy lịch lễ tân | Controller tự blacklist nhiều trạng thái và trả slot về `active`; chưa ghi lịch sử hủy trong `LichSuLichHen`, chưa kiểm trực tiếp `HangDoi.trang_thai='trong_phong'`. | Backend có chặn một phần, nhưng logic tản mạn và thiếu audit/thông báo. |
| Lịch sử lịch hẹn | `LichSuLichHen.vai_tro` chỉ cho `admin`, `doctor`, `user`, `system`. | Đây là lỗi trực tiếp của actor lễ tân: không truy vết đúng vai trò. |
| Route lễ tân | `/api/receptionist` đã có `verifyToken` và `requireRole('receptionist','admin')`. | Phân quyền route nền đã ổn, không cần mở rộng lớn. |
| Frontend lễ tân | Màn `Appointments.tsx` tự hiện nút bằng điều kiện `apt.status !== 'checked_in' && apt.status !== 'cancelled'`. | UI có thể hiện nút dời/hủy sai với `in_progress`, `completed`, `no_show`, `skipped`, hoặc khi `HangDoi` đã `trong_phong`. |

**2. Yêu cầu mong muốn sau LT-00**

LT-00 không nhằm thêm nghiệp vụ mới như khách đến muộn hay bác sĩ nghỉ. LT-00 chỉ tạo “luật nền” để các nghiệp vụ sau cùng hiểu một lịch đang được phép làm gì.

```text
Khi lễ tân mở danh sách lịch,
hệ thống phải trả kèm allowed_actions và lock_reason cho từng lịch.

Khi lễ tân bấm dời/hủy/check-in,
backend phải kiểm lại cùng một bộ luật,
không tin hoàn toàn vào frontend.

Khi thao tác được ghi lịch sử,
vai trò phải là receptionist nếu người thao tác là lễ tân.
```

Action tối thiểu cần chuẩn hóa:

| Action | Được phép khi | Bị khóa khi |
|---|---|---|
| `check_in` | `LichHen.status='confirmed'`, lịch hôm nay, chưa có `HangDoi` | đã có `HangDoi`, lịch không phải hôm nay, `pending`, `cancelled`, `completed`, `no_show`, `skipped` |
| `reschedule` | lịch chưa kết thúc, chưa vào phòng, không có đề xuất dời đang mở | `in_progress`, `completed`, `cancelled`, `no_show`, `skipped`, `HangDoi.trang_thai='trong_phong'` |
| `cancel` | thường chỉ `pending` hoặc `confirmed`, chưa vào hàng đợi khám thực tế | `checked_in`, `in_progress`, `waiting_record`, `waiting_doctor_confirm`, `completed`, `cancelled`, `no_show`, `skipped`, hoặc `HangDoi.trang_thai` không còn là trước khám |
| `view_only` | mọi trạng thái | dùng khi không còn action ghi nào hợp lệ |

**3. Luồng tương tác actor sau khi chuẩn hóa**

```text
Lễ tân mở danh sách lịch
  -> API /receptionist/appointments lấy LichHen
  -> backend gom HangDoi theo appointment_id
  -> helper tính allowed_actions + lock_reason
  -> frontend chỉ hiển thị nút theo allowed_actions

Lễ tân bấm một action
  -> backend đọc lại LichHen + HangDoi mới nhất
  -> helper kiểm tra lại quyền thao tác
  -> nếu bị khóa: trả 409 kèm lock_reason
  -> nếu hợp lệ: controller nghiệp vụ mới được ghi dữ liệu
  -> ghi LichSuLichHen với vai_tro đúng
```

Điểm quan trọng: `allowed_actions` là để UI không gây hiểu nhầm, nhưng guard backend mới là nguồn quyết định cuối cùng. Điều này tránh tình huống hai lễ tân cùng mở một lịch; người thứ nhất check-in trước, người thứ hai vẫn còn màn cũ và bấm hủy.

**4. Rủi ro xung đột nếu sửa LT-00 không cẩn thận**

| Khu vực bị ảnh hưởng | Rủi ro | Cách tránh |
|---|---|---|
| Check-in | Nếu đổi điều kiện check-in quá rộng, lịch `pending/unpaid` có thể vào hàng đợi. | Giữ service `checkInLichHen` hiện có; chỉ bọc thêm helper action, không nới trạng thái check-in. |
| Dời lịch | Nếu chỉ nhìn `LichHen.status`, có thể dời ca đã có `HangDoi.trong_phong`. | Guard phải đọc cả `HangDoi`. |
| Hủy lịch | Nếu trả slot về `active` khi lịch đã vào khám, người khác có thể đặt trùng slot đang dùng. | Chỉ cho hủy trước check-in; các trường hợp sau check-in chuyển sang luồng hàng đợi/bác sĩ/hóa đơn riêng. |
| Bác sĩ | Nếu lễ tân đổi lịch khi bác sĩ đang xem hàng đợi, dashboard bác sĩ lệch. | Khóa `trong_phong`, `in_progress`; emit realtime sau khi action hợp lệ. |
| Admin | Admin đang dùng `vai_tro='admin'`; thêm `receptionist` vào enum phải không làm hỏng dữ liệu cũ. | Chỉ mở rộng enum, không migrate lịch sử cũ ngay. Lịch sử cũ vẫn đọc được. |
| Frontend | Nếu frontend chỉ dựa vào status cũ, UI vẫn hiện sai. | API trả `allowed_actions`; frontend đổi từ tự suy status sang dùng contract backend. |
| Thống kê | Nếu helper trạng thái không cập nhật đủ enum, số liệu “đang khám/chờ hồ sơ/bỏ lượt” sai. | Cập nhật `appointmentStatus.js` làm nguồn dùng chung, có nhóm trạng thái rõ. |

**5. Phương án sửa đổi tối giản cho LT-00**

Không tạo bảng mới, không đổi tên trạng thái, không refactor lớn. Chỉ làm bốn việc nhỏ nhưng làm nền cho tất cả task sau:

1. Cập nhật `appointmentStatus.js` để khớp đầy đủ enum của `LichHen`.
2. Thêm helper action guard, ví dụ `buildReceptionistAppointmentActions(appointment, queueEntry)`.
3. API danh sách lịch lễ tân trả thêm:

```text
allowed_actions: ['check_in', 'reschedule', 'cancel']
lock_reason: null
queue_state: null | 'dang_cho' | 'da_goi' | 'trong_phong' | ...
```

4. Mở rộng `LichSuLichHen.vai_tro` thêm `receptionist`; các thao tác do lễ tân ghi đúng vai trò.

**6. Contract trước khi code LT-00**

| Contract | Quyết định đề xuất |
|---|---|
| Trạng thái đầu vào | `LichHen.status` kết hợp `HangDoi.trang_thai`, không dùng riêng một lớp. |
| Trạng thái đầu ra | LT-00 không đổi nghiệp vụ trạng thái, chỉ chuẩn hóa quyền action. |
| Quyền actor | Route vẫn cho `receptionist` và `admin`; audit ghi đúng `req.user.role`. |
| Audit | Mở enum `receptionist`; chưa bắt buộc mọi action phải có audit trong LT-00, nhưng không được ghi lễ tân thành admin nữa. |
| Thông báo | LT-00 chưa gửi thông báo; chỉ chuẩn bị nền cho LT-08. |
| Transaction | LT-00 chưa đổi transaction chính; các task sau sẽ áp dụng theo từng action. |
| API/UI | Backend trả `allowed_actions`, `lock_reason`; frontend đọc từ API để bật/tắt nút. |
| Test liên chức năng | Test lịch `confirmed`, `checked_in`, `in_progress`, `completed`, có/không có `HangDoi.trong_phong`. |

**7. Kịch bản kiểm thử riêng cho LT-00**

1. Lịch `confirmed`, chưa có `HangDoi`: API trả `check_in`, `reschedule`, `cancel`.
2. Lịch `checked_in`, có `HangDoi.dang_cho`: API không trả `cancel`; dời chỉ được phép nếu nhóm chốt cho phép đổi lượt chờ, còn mặc định LT-00 nên khóa để tránh lệch.
3. Lịch `in_progress` hoặc `HangDoi.trong_phong`: API trả `allowed_actions=[]`, `lock_reason='Bệnh nhân đang trong phòng khám'`; các endpoint ghi trả `409`.
4. Lịch `completed/cancelled/no_show/skipped`: chỉ xem, không check-in/dời/hủy.
5. Lễ tân dời lịch sau khi mở enum: `LichSuLichHen.vai_tro='receptionist'`, không còn ghi nhầm `admin`.

---

### LT-01 - Điều phối khi bác sĩ nghỉ đột xuất và chuyển bác sĩ

**Mức ưu tiên:** P0. **Phụ thuộc:** LT-00, LT-08, LT-09.

**Lỗi/gap hiện tại:** khi bác sĩ không thể khám, lịch đã đặt bị ảnh hưởng nhưng chưa có luồng lễ tân xử lý hàng loạt có kiểm soát. Nếu chỉ đổi thẳng `doctor_id`, khách có thể gặp bác sĩ khác khi chưa biết hoặc bị chuyển vào một slot không trống.

**Luồng nghiệp vụ đề xuất:**

```text
Admin/lễ tân xác nhận sự cố của bác sĩ
  -> hệ thống lấy các lịch chưa vào phòng bị ảnh hưởng
  -> tìm tối đa 3 phương án còn trống: cùng chuyên khoa, bác sĩ thay thế, khung gần nhất
  -> giữ tạm slot của phương án đầu tiên
  -> lễ tân kiểm tra và gửi thông báo cho từng khách
  -> khách chọn phương án hoặc lễ tân ghi nhận lựa chọn qua điện thoại
  -> áp dụng một phương án, cập nhật lịch và lưu audit
  -> giải phóng các phương án tạm còn lại
```

**Quy tắc xử lý:**

- Chỉ ảnh hưởng lịch chưa vào phòng: `pending`, `confirmed`, `checked_in` hoặc hàng đợi đang chờ. Lịch `in_progress`/`trong_phong` là ca đang thực hiện, không chuyển bác sĩ từ phía lễ tân.
- Ưu tiên cùng chuyên khoa, cùng ngày, thời gian gần nhất. Chỉ đưa bác sĩ có lịch làm việc và slot hợp lệ.
- Không chuyển tự động sang bác sĩ khác chỉ vì có chỗ trống. Nếu khách không phản hồi trong thời hạn đã định, áp dụng phương án đầu tiên đã giữ chỗ theo quy tắc phòng khám và lưu rõ cách liên hệ.
- Với khách đã check-in nhưng chưa được gọi, chuyển hoặc đưa vào trạng thái chờ điều phối; không tạo thêm `HangDoi` thứ hai.

**Giải pháp kỹ thuật đơn giản:** tận dụng `LichHen.de_xuat_doi.phuong_an[]` đang có thay vì tạo collection điều phối mới. Bổ sung endpoint theo lô chỉ để *tạo đề xuất*, còn việc áp dụng vẫn gọi chung `apDungPhuongAn()` cho từng lịch trong transaction. Không cho API nhận `doctor_id` tùy ý.

**Thông tin phải ghi:** bác sĩ cũ/mới, slot cũ/mới, loại `doi_bac_si`, lý do “bác sĩ nghỉ đột xuất”, người thao tác, lúc tạo/duyệt, phương thức khách phản hồi và trạng thái thông báo.

**Nghiệm thu:** chọn một bác sĩ nghỉ có 10 lịch tương lai: chỉ các lịch hợp lệ có đề xuất; hai lễ tân không thể cùng lấy một slot thay thế; khách nhận được thông báo/phiếu gọi; mỗi lịch truy ra được bác sĩ cũ và mới.

---

### LT-02 - Xử lý khách đến muộn

**Mức ưu tiên:** P0. **Phụ thuộc:** LT-00, LT-03, LT-06, LT-08, LT-09.

**Lỗi/gap hiện tại:** “đến muộn” dễ bị hiểu thành dời giờ hẹn. Thực tế, lịch đã check-in muộn vẫn là một lượt khám hôm nay; nếu đổi `gio_kham` một cách máy móc sẽ làm sai slot và lịch sử cam kết ban đầu.

**Luồng thao tác cho lễ tân:**

```text
Khách đến sau giờ hẹn
  -> lễ tân chọn Check-in và hệ thống tính số phút trễ
  -> nếu còn nhận trong ca: tạo HangDoi, gắn mức ưu tiên muộn
  -> lễ tân chọn một trong ba phương án được backend cho phép
       A. chờ cuối hàng đợi hiện tại
       B. đặt vào slot trống gần nhất trong ngày
       C. đề xuất dời sang ngày sau
  -> xác nhận với khách và gửi thông báo/xác nhận mới
```

**Quy tắc quyết định:**

- Trễ nhưng vẫn còn khả năng phục vụ: check-in ngay, đưa về cuối hàng đợi theo thuật toán ưu tiên động. Đây là mặc định, ít thay đổi dữ liệu nhất.
- Khách muốn đổi sang slot trống trong ngày hoặc ngày sau: đây là `reschedule` có lý do `phong_kham` hoặc `khach_yeu_cau` đúng thực tế, gọi lại service dời lịch chung.
- Khi ca đã quá tải hoặc sắp hết giờ, không tạo lời hứa mơ hồ “chờ thêm”. Backend chỉ trả các slot thật sự còn chỗ/được phép chọn.
- Không tái sử dụng slot của người đã check-in. Slot thuộc lịch hủy mới có thể trở lại pool theo LT-04.

**Giải pháp kỹ thuật đơn giản:** giữ thuật toán ưu tiên hiện có: check-in sau grace sẽ có bậc `offline`; vị trí gọi tính động, không cần sửa lịch đặt. Thêm `trang_thai_den='den_tre'` hoặc ghi nhận `so_phut_tre` trong ghi chú tiếp nhận để UI và lịch sử diễn đạt đúng sự kiện. Không thêm một trạng thái lịch hẹn “trễ” mới nếu chỉ phục vụ hiển thị.

**Nghiệm thu:** khách trễ 20 phút được check-in một lần, có số thứ tự riêng và đứng sau các lượt đủ điều kiện; lễ tân chỉ thấy slot thật sự có thể dời; chọn ngày sau tạo lịch sử và thông báo; không có hai hàng đợi cho cùng một lịch.

---

### LT-03 - Xử lý bác sĩ khám kéo dài và slot chờ

**Mức ưu tiên:** P0. **Phụ thuộc:** LT-00, LT-06, LT-08, LT-09.

**Lỗi/gap hiện tại:** khi một lượt `trong_phong` kéo dài đến một giờ, lịch phía sau có nguy cơ bị “đẩy dây chuyền”. Nếu lễ tân tự sửa giờ của tất cả lịch, hệ thống tạo hàng loạt thay đổi sai cam kết và bùng nổ thông báo.

**Luồng nghiệp vụ đề xuất:**

```text
Bác sĩ đánh dấu/ hệ thống phát hiện lượt trong phòng vượt ngưỡng
  -> trạng thái năng lực bác sĩ = qua_tai_tam_thoi, ghi mốc dự kiến tiếp tục
  -> hàng đợi hiện tại vẫn giữ nguyên thứ tự động
  -> lễ tân thấy danh sách lịch bị ảnh hưởng cùng thời gian chờ ước tính
  -> khách chưa check-in: nhận cảnh báo trễ, có thể chọn dời
  -> khách đã check-in: ở slot chờ, không đổi lịch hẹn nếu chưa cần
  -> khi bác sĩ hoạt động lại: gọi theo thứ tự hàng đợi
```

**Quy tắc “slot chờ”:** đây không phải slot lịch làm việc mới. Nó là trạng thái hiển thị của `HangDoi`/danh sách chờ, có ước tính chờ; không chiếm thêm `LichLamViec.slots[]`. Lễ tân được chuyển lượt đã check-in sang chờ, nhưng không được tự ý đổi thứ tự trước sau. Khi khách đồng ý đổi lịch, mới gọi luồng dời lịch của LT-02/LT-01.

**Ngưỡng tối giản:** cảnh báo khi một lượt trong phòng vượt `thoi_luong_slot + 15 phút`; chuyển sang “quá tải cần điều phối” khi vượt 60 phút hoặc khi thời gian chờ dự báo của lịch tiếp theo vượt ngưỡng phòng khám đặt ra. Ngưỡng đưa vào cấu hình, không hard-code trong giao diện.

**Dữ liệu/API/UI cần tác động:**

- Bổ sung trạng thái tác nghiệp của bác sĩ theo ca: `san_sang`, `dang_kham`, `qua_tai_tam_thoi`, `tam_dung_tiep_nhan`, `nghi_dot_xuat`.
- Không ghi `qua_tai_tam_thoi` vào `BacSi.trang_thai` dài hạn; đặt ở ca hiện tại hoặc suy ra từ `HangDoi`.
- API dashboard lễ tân trả: ca đang quá tải, số lượt chờ, thời gian chờ ước tính và lịch chưa check-in bị ảnh hưởng.

**Nghiệm thu:** mô phỏng ca khám kéo dài 60 phút: lịch sau không tự bị đổi giờ; lễ tân thấy đúng người đang chờ và có thể gửi cảnh báo; khách dời lịch thì mới có thay đổi slot/audit; kết thúc ca kéo dài thì trạng thái năng lực trở về phù hợp.

---

### LT-04 - Hủy lịch và trả slot để người khác đặt ngay

**Mức ưu tiên:** P0. **Phụ thuộc:** LT-00, LT-08, LT-09.

**Lỗi/gap hiện tại:** về mặt schema, lịch `cancelled` đã được loại khỏi unique slot index; nhưng luồng hủy cần bảo đảm đồng thời cả lịch hẹn, slot và thông báo. Nếu chỉ đổi `status`, giao diện đặt lịch có thể vẫn đọc slot là kín.

**Luồng thao tác:**

```text
Khách/lễ tân yêu cầu hủy
  -> backend kiểm tra lịch chưa check-in/chưa trong phòng
  -> transaction: LichHen = cancelled + slot = active
  -> commit thành công
  -> tạo audit + thông báo hủy
  -> API tìm slot mới nhìn thấy slot ngay ở lần tải tiếp theo
```

**Quy tắc:**

- Hủy chỉ hợp lệ trước khi check-in. Sau check-in, lễ tân không hủy lịch; xử lý lượt trong hàng đợi bằng quyền/luồng riêng để tránh xóa dấu vết khách đã đến.
- Slot `walk_in` không bị biến thành slot đặt online sau khi hủy.
- Chỉ trả slot về `active` khi slot không bị khóa do bác sĩ nghỉ, không đang có lịch hợp lệ khác và không thuộc quá khứ.
- Nếu đã thanh toán, việc hoàn/không hoàn tiền dùng quy tắc thanh toán hiện có; không làm mất khả năng trả slot ngay.

**Giải pháp kỹ thuật:** giữ transaction hiện có ở controller/service, bổ sung kiểm tra trạng thái slot trước khi mở lại và dùng chung service hủy cho khách/lễ tân/admin. Sau commit phát sự kiện refresh slot; không phát sự kiện trước commit.

**Nghiệm thu:** hủy lịch `confirmed` làm slot xuất hiện ngay trong API availability và có thể được người khác claim; hủy hai lần trả `409`; lịch đã check-in không mở slot; audit và thông báo chỉ xuất hiện một lần.

---

### LT-05 - Khóa dời/sửa lịch khi bác sĩ đang khám

**Mức ưu tiên:** P0. **Phụ thuộc:** LT-00, LT-09.

**Lỗi/gap hiện tại:** nếu lễ tân có thể dời một lịch đang `in_progress`, bác sĩ, phòng khám, hàng đợi và hồ sơ khám sẽ cùng tham chiếu các dữ liệu không còn nhất quán.

**Quy tắc:**

- Khóa cứng ngay khi bác sĩ đưa `HangDoi` vào `trong_phong` và `LichHen` sang `in_progress`.
- Lễ tân chỉ được xem và bổ sung ghi chú tiếp nhận không làm thay đổi điều trị; không đổi bác sĩ, ngày, giờ, slot, bệnh nhân, dịch vụ hoặc trạng thái thanh toán.
- Admin cũng không “sửa lịch” trực tiếp trong giai đoạn này. Nếu sai dữ liệu hành chính nghiêm trọng, tạo yêu cầu chỉnh sửa hậu kiểm sau khi khám xong, có lý do và audit.
- Khi bác sĩ hoàn tất, lịch vẫn không được dời; mọi sai sót lịch sử phải được thể hiện bằng revision/audit, không ghi đè lịch cũ.

**Giải pháp kỹ thuật:** mọi endpoint `reschedule`, `cancel`, `update appointment` phải truy `HangDoi` có `appointment_id` trước khi ghi. Không tin trạng thái gửi từ client. Thông điệp lỗi dùng chung: “Không thể điều chỉnh vì bệnh nhân đã vào phòng khám.”

**Nghiệm thu:** cố gọi API dời/hủy/sửa từ hai tab sau khi bác sĩ vào phòng đều thất bại `409`; thông tin ca khám và hồ sơ vẫn gắn đúng appointment/queue ban đầu.

---

### LT-06 - Sinh số thứ tự khi check-in, không trùng và không tái sử dụng

**Mức ưu tiên:** P0. **Phụ thuộc:** LT-00.

**Lỗi/gap hiện tại:** `HangDoi` hiện cố ý chỉ sắp thứ tự động theo ưu tiên và thời điểm check-in, chưa lưu số thứ tự. Đây là đúng cho thứ tự gọi, nhưng thiếu mã để lễ tân đưa cho khách và đối chiếu tại quầy.

**Phân biệt bắt buộc:**

```text
Số thứ tự check-in (cố định)  : mã lượt khách nhận, ví dụ 17
Vị trí đang chờ (động)        : thứ hạng gọi hiện tại, có thể thay đổi theo ưu tiên
Slot đặt hẹn                  : giờ đã cam kết, không phải số thứ tự
```

**Luồng thao tác:**

```text
Lễ tân check-in thành công
  -> transaction giữ/tạo HangDoi
  -> atomic increment bộ đếm của ca/bác sĩ/ngày
  -> gán so_thu_tu_checkin cho HangDoi
  -> trả số cho màn hình/in phiếu
  -> API hàng đợi trả cả số cố định và vị trí động
```

**Giải pháp tối giản:** thêm `so_thu_tu_checkin` vào `HangDoi` và bộ đếm nguyên tử theo `doctor_id + ngày` trên bản ghi `LichLamViec` của ngày đó, thay vì tạo bảng số thứ tự mới. Tạo unique index theo phạm vi một bác sĩ/ngày/số. Số đã phát không dùng lại kể cả lượt bị hủy/no-show; điều này loại trừ mọi số đã check-in và giữ audit rõ ràng.

**Quy tắc khách trễ:** khách trễ vẫn giữ số check-in đã phát, nhưng vị trí gọi động sẽ ở cuối theo ưu tiên. Không cấp số mới chỉ để “đẩy cuối hàng”, vì sẽ làm sai audit và khách khó theo dõi.

**Nghiệm thu:** hai lễ tân check-in cùng lúc nhận hai số khác nhau; số không trùng trong cùng bác sĩ/ngày; check-in lại cùng lịch bị chặn; API hiển thị số `17` nhưng vị trí động có thể là `6`; số `17` không tái sử dụng sau khi hủy lượt.

---

### LT-07 - Một số điện thoại đặt cho nhiều người và nhiều slot trong ngày

**Mức ưu tiên:** P1. **Phụ thuộc:** LT-00.

**Lỗi/gap hiện tại:** nếu lấy số điện thoại làm khóa duy nhất, phụ huynh/người chăm sóc không thể đặt cho người thân. Nếu không kiểm tra gì, cùng một bệnh nhân lại có thể bị đặt trùng nhiều slot.

**Quy tắc nghiệp vụ chốt:**

- Một số điện thoại là thông tin liên hệ, có thể gắn với nhiều hồ sơ bệnh nhân.
- Cùng số điện thoại được đặt nhiều slot trong một ngày nếu đó là các **hồ sơ bệnh nhân khác nhau**, hoặc cùng người có nhiều dịch vụ không trùng thời điểm và được phòng khám cho phép.
- Chặn một hồ sơ bệnh nhân có hai lịch còn hiệu lực tại cùng thời điểm. Với cùng ngày, cảnh báo nếu đặt nhiều lịch để lễ tân kiểm tra, nhưng không chặn cứng trường hợp có căn cứ.
- Không dựa vào tên hoặc số điện thoại để nhận diện duy nhất; dùng `ho_so_benh_nhan_id`/`member_id`.

**Luồng thao tác tại quầy:** nhập số điện thoại -> hiển thị các hồ sơ liên hệ -> lễ tân bắt buộc chọn đúng người cần khám -> hệ thống kiểm tra xung đột của hồ sơ đó -> cho chọn slot. Khi chưa có hồ sơ, tạo hồ sơ trước, rồi mới đặt/check-in.

**Giải pháp kỹ thuật:** tái sử dụng luồng tra cứu hồ sơ đã thiết kế cho tiếp nhận tại quầy. Thêm validation xung đột theo `patient profile/member + khoảng thời gian`, không thêm unique index theo số điện thoại.

**Nghiệm thu:** một phụ huynh đặt hai slot cho hai con trong cùng ngày thành công; đặt hai slot trùng giờ cho cùng một hồ sơ bị từ chối; lịch sử vẫn hiển thị đúng người khám và người liên hệ.

---

### LT-08 - Bắt buộc thông báo khách khi hủy, dời hoặc chuyển bác sĩ

**Mức ưu tiên:** P0. **Phụ thuộc:** LT-00.

**Tình trạng triển khai 2026-08-02:** đã code nền thông báo bắt buộc cho các thao tác lễ tân hiện có. Khi lễ tân dời lịch hoặc hủy lịch, backend tạo `ThongBao` in-app nếu lịch có `user_id`; nếu khách không có tài khoản, hệ thống ghi `NhatKyThaoTac` với hành động `CUSTOMER_CONTACT_REQUIRED` để lễ tân gọi thủ công. Luồng đề xuất dời lịch do bác sĩ bận/nghỉ cũng không còn bỏ qua khách không có tài khoản; trường hợp đó được ghi audit cần liên hệ thủ công. Phần SMS/Zalo thật chưa triển khai trong phạm vi đồ án hiện tại.

**Lỗi/gap hiện tại:** giao dịch lịch hẹn có thể hoàn tất mà không có bằng chứng khách đã được biết. Điều này đặc biệt rủi ro khi phòng khám là bên khởi tạo thay đổi.

**Luồng nghiệp vụ chuẩn:**

```text
Thao tác thay đổi lịch được validate
  -> transaction cập nhật lịch + lịch sử nghiệp vụ
  -> tạo notification outbox trong cùng transaction
  -> commit
  -> worker/service gửi theo kênh khả dụng
  -> ghi sent / failed / can_goi_thu_cong
  -> lễ tân xem và xử lý các bản ghi chưa thông báo được
```

**Sự kiện bắt buộc:** khách hủy, lễ tân hủy, dời ngày/giờ, đổi bác sĩ, bác sĩ nghỉ đột xuất, ca khám kéo dài gây ảnh hưởng thực tế, thông báo không thể phục vụ trong ca. Check-in thành công và số thứ tự là thông báo nên có, không bắt buộc cho việc thay đổi lịch.

**Nội dung tối thiểu của thông báo:** mã lịch, người khám, sự kiện xảy ra, lịch/bác sĩ cũ và mới nếu có, lý do ngắn gọn, hành động khách cần làm, thời hạn phản hồi, kênh liên hệ.

**Giải pháp phù hợp hiện trạng:** dùng `ThongBao` làm bản ghi chính và tách `trang_thai_gui` thành `cho_gui`, `da_gui`, `that_bai`, `can_goi_thu_cong` nếu model chưa có. Không giả vờ đã SMS khi dự án chưa tích hợp SMS: khách có tài khoản nhận thông báo in-app/email; khách chỉ có số điện thoại tạo task “cần gọi thủ công” cho lễ tân, ghi người gọi và thời điểm xác nhận.

**Nghiệm thu:** thay đổi do phòng khám không thể trả `200` nếu không tạo được bản ghi thông báo; gửi thất bại không mất lịch thay đổi nhưng xuất hiện trong danh sách cần xử lý; khách nhận tối đa một thông báo cho một event idempotency key.

---

### LT-09 - Lịch sử dời lịch/chuyển bác sĩ do lễ tân thực hiện

**Mức ưu tiên:** P0. **Phụ thuộc:** LT-00.

**Tình trạng triển khai 2026-08-02:** đã code phần audit nền cho thao tác lễ tân. Dời lịch qua lễ tân đã ghi đầy đủ trạng thái, payment, bác sĩ, chuyên khoa, schedule, slot, ngày/giờ cũ mới và `nguoi_thuc_hien_id`; hủy lịch qua lễ tân cũng ghi history tương tự và lưu `thoi_diem_huy`; xác nhận thanh toán mock qua màn lễ tân không còn ghi nhầm role `admin`; nhật ký thao tác của service dời lịch nhận đúng `actorRole`. Phần chuyển bác sĩ hàng loạt do bác sĩ nghỉ đột xuất sẽ dùng lại nền này khi làm LT-01.

**Lỗi/gap hiện tại:** trước LT-00, `LichSuLichHen.vai_tro` chưa có `receptionist` và code có chỗ ghi hành động của lễ tân thành `admin`. LT-00 đã mở enum và sửa các thao tác nền; LT-09 vẫn cần chuẩn hóa sâu nội dung lịch sử trước/sau cho dời lịch, chuyển bác sĩ, hủy lịch và các tình huống điều phối mới.

**Quy tắc audit tối thiểu cho mỗi thay đổi:**

| Nhóm dữ liệu | Phải lưu |
|---|---|
| Actor | `nguoi_thuc_hien_id`, vai trò thật là `receptionist`, kênh web/quầy |
| Trước/sau | bác sĩ, ngày, giờ, schedule, slot, trạng thái và thanh toán nếu có thay đổi |
| Nguyên nhân | `khach_yeu_cau`, `phong_kham`, `bac_si_nghi_dot_xuat`, `khach_den_tre`, `qua_tai_ca` và mô tả tự do |
| Bằng chứng liên lạc | notification id, trạng thái gửi/gọi, lựa chọn của khách |
| Thời điểm | lúc tạo đề xuất, lúc khách chọn, lúc áp dụng |

**Giải pháp kỹ thuật:** thêm `'receptionist'` vào enum `LichSuLichHen.vai_tro`, dùng một hàm ghi history chung được gọi bởi dời lịch, đổi bác sĩ, hủy và áp dụng đề xuất. Không nhân bản lịch sử ra nhiều collection. Sửa dữ liệu cũ chỉ khi có căn cứ; không tự đoán các bản ghi trước đây là admin hay lễ tân.

**UI:** trong chi tiết lịch, hiển thị timeline đọc được: “10:15 - Lễ tân Nguyễn A chuyển từ BS B, 09:00 sang BS C, 10:00. Lý do: BS B nghỉ đột xuất. Thông báo: đã gọi xác nhận.”

**Nghiệm thu:** tất cả API thay đổi qua lễ tân tạo đúng một history record có role `receptionist`; lịch sử hiển thị trước/sau đúng; không còn mã ghi giả `admin` cho hành động mới.

---

### LT-10 - Cho phép cập nhật lại thông tin bệnh nhân đã khám, có revision rõ ràng

**Mức ưu tiên:** P1. **Phụ thuộc:** LT-00, LT-09.

**Lỗi/gap hiện tại:** bệnh nhân đã qua vẫn có thể cần sửa tên, ngày sinh, số điện thoại hoặc thông tin liên hệ. Nếu khóa tuyệt đối, dữ liệu sai không sửa được; nếu cho ghi đè tự do, không còn biết thông tin đã dùng ở lần khám cũ.

**Ranh giới quyền:** lễ tân được sửa dữ liệu hành chính của hồ sơ bệnh nhân: họ tên, ngày sinh, giới tính, địa chỉ, số điện thoại, người liên hệ và ghi chú tiếp nhận. Không được sửa chẩn đoán, chỉ định, sinh hiệu, đơn thuốc, kết quả khám hoặc dữ liệu chuyên môn.

**Luồng thao tác:**

```text
Lễ tân mở hồ sơ cũ
  -> chọn Chỉnh sửa thông tin hành chính
  -> backend yêu cầu lý do
  -> kiểm tra xung đột nhận diện cơ bản
  -> cập nhật hồ sơ hiện tại
  -> ghi NhatKyThaoTac: trước/sau, trường đổi, lý do, actor, thời điểm
  -> không sửa snapshot thông tin đã dùng trong hồ sơ khám cũ
```

**Giải pháp tối giản:** dùng `NhatKyThaoTac` hiện có với payload trước/sau đã lọc theo whitelist, không tạo một bảng revision bệnh nhân riêng. Các màn hình lịch sử chỉ đọc audit từ API, không nhét toàn bộ JSON nhạy cảm vào giao diện.

**Nghiệm thu:** lễ tân sửa số điện thoại của bệnh nhân đã khám được khi có lý do; audit hiển thị trường cũ/mới và người sửa; cố sửa trường chuyên môn bị `403`; kết quả khám cũ vẫn giữ snapshot đúng thời điểm khám.

---

### LT-11 - Cập nhật bệnh án bởi admin/lễ tân với lịch sử rõ ràng

**Mức ưu tiên:** P1. **Phụ thuộc:** LT-00, LT-10.

**Rủi ro nghiệp vụ:** “bệnh án” là dữ liệu chuyên môn. Cho lễ tân chỉnh sửa trực tiếp chẩn đoán/đơn thuốc vì lỗi nhập liệu là rủi ro lớn về trách nhiệm và an toàn dữ liệu.

**Quy tắc đề xuất đơn giản nhưng an toàn:**

- Lễ tân chỉ được tạo **yêu cầu chỉnh sửa** bệnh án, nêu rõ lỗi hành chính/thiếu thông tin và đính kèm lý do.
- Bác sĩ phụ trách là người sửa/xác nhận nội dung chuyên môn.
- Admin chỉ được sửa trực tiếp trong chế độ ngoại lệ: quyền riêng, lý do bắt buộc, ghi rõ “admin override”, không xóa revision cũ.
- Với thay đổi sau khi bệnh án đã xác nhận, tạo revision mới hoặc lưu snapshot trước/sau; không cập nhật im lặng vào bản ghi đã ký xác nhận.

**Luồng phối hợp:** lễ tân tạo yêu cầu -> bác sĩ nhận thông báo -> bác sĩ sửa/xác nhận hoặc từ chối -> hệ thống ghi kết quả yêu cầu. Admin chỉ can thiệp khi bác sĩ không thể xử lý hoặc có quyết định vận hành; mọi bước nằm trên timeline cùng `appointment_id`/`ket_qua_kham_id`.

**Giải pháp kỹ thuật:** tận dụng workflow yêu cầu chỉnh sửa hồ sơ đã có/đang thiết kế cho bác sĩ; thêm guard phân quyền và audit `medical_record_revision_requested`, `medical_record_revised`, `medical_record_override`. Không mở một form “sửa bệnh án” hoàn toàn mới cho lễ tân.

**Nghiệm thu:** lễ tân không thể PATCH chẩn đoán/đơn thuốc; tạo yêu cầu có lý do thành công; bác sĩ sửa tạo revision; admin override lưu actor, lý do, bản trước/sau và không thể xóa lịch sử.

---

### LT-12 - Đồng bộ trạng thái bác sĩ đang khám cho màn hình lễ tân

**Mức ưu tiên:** P1. **Phụ thuộc:** LT-00, LT-03, LT-06.

**Lỗi/gap hiện tại:** lễ tân cần biết bác sĩ có đang khám, đang quá tải hay tạm dừng tiếp nhận để chọn hành động phù hợp. Chỉ nhìn `BacSi.trang_thai='active'` không phản ánh được tình hình trong ca.

**Giải pháp:** trạng thái hiển thị được suy ra chủ yếu từ `HangDoi` và ca hiện tại:

| Hiển thị | Điều kiện | Tác động tại quầy |
|---|---|---|
| Sẵn sàng | không có lượt `trong_phong`, còn năng lực | nhận/check-in bình thường |
| Đang khám | có một lượt `trong_phong` | vẫn check-in, hiển thị thời gian chờ |
| Quá tải tạm thời | lượt đang khám vượt ngưỡng hoặc hàng đợi quá dài | cảnh báo khách, ưu tiên slot chờ/dời |
| Tạm dừng tiếp nhận | lễ tân/admin bật theo ca | không nhận lượt tại quầy mới, vẫn xử lý khách đã có lịch |
| Nghỉ đột xuất | sự cố đã xác nhận | chạy LT-01 |

Không dùng trạng thái này để tự hủy lịch hoặc tự chuyển người bệnh. Đây là tín hiệu điều phối cho lễ tân, không phải lệnh thay đổi lịch hẹn.

**Nghiệm thu:** bác sĩ bấm vào phòng thì dashboard lễ tân cập nhật “Đang khám”; khi vượt ngưỡng hiển thị cảnh báo; lễ tân không còn nhận lượt walk-in khi ca tạm dừng; lịch hiện có không bị thay đổi tự động.

## 5. Thứ tự triển khai đề xuất

| Thứ tự | Task | Mục tiêu bàn giao |
|---:|---|---|
| 1 | LT-00 | Contract trạng thái, quyền và action khả dụng |
| 2 | LT-09 | Audit đúng vai trò lễ tân và dữ liệu trước/sau |
| 3 | LT-08 | Notification outbox và danh sách cần gọi thủ công |
| 4 | LT-04 | Hủy lịch trả slot đúng và đồng bộ availability |
| 5 | LT-05 | Chặn toàn bộ chỉnh sửa khi bệnh nhân đang khám |
| 6 | LT-06 | Số thứ tự check-in cố định, không trùng |
| 7 | LT-12 | Trạng thái vận hành bác sĩ cho dashboard lễ tân |
| 8 | LT-02 | Xử lý khách đến muộn theo ba phương án rõ ràng |
| 9 | LT-03 | Quá tải do khám kéo dài và slot chờ |
| 10 | LT-01 | Điều phối bác sĩ nghỉ đột xuất/chuyển bác sĩ |
| 11 | LT-07 | Nhiều hồ sơ dùng chung số điện thoại |
| 12 | LT-10 | Sửa thông tin hành chính bệnh nhân có audit |
| 13 | LT-11 | Workflow yêu cầu/revision bệnh án |

Ba task đầu tạo nền kiểm soát. Sau đó mới mở rộng các tình huống điều phối; nếu làm đổi bác sĩ trước khi có audit và thông báo thì rủi ro tranh chấp vẫn còn nguyên.

## 6. Kịch bản kiểm thử liên vai trò bắt buộc

1. Bác sĩ nghỉ đột xuất: lễ tân tạo đề xuất cho 3 khách, khách A chọn bác sĩ khác, khách B chọn ngày sau, khách C chưa phản hồi; không có slot nào bị trùng và mỗi khách có thông báo tương ứng.
2. Khách trễ 25 phút: check-in thành công, nhận số thứ tự mới duy nhất, đứng ở cuối ưu tiên; lễ tân chuyển sang slot gần nhất thì có lịch sử và thông báo.
3. Bác sĩ khám kéo dài 60 phút: lịch chưa check-in được cảnh báo, lượt đã check-in nằm trong hàng chờ, không lịch nào bị tự đổi giờ; chỉ khách đồng ý dời mới đổi slot.
4. Hủy lịch đã xác nhận: slot hiện lại cho khách khác ngay sau commit; hủy lần hai, hủy lịch đã check-in và hủy lịch trong phòng đều bị chặn.
5. Hai lễ tân check-in đồng thời: không trùng `so_thu_tu_checkin`, không tạo hai `HangDoi` cho một lịch.
6. Một phụ huynh đặt cho hai con: cùng số điện thoại nhưng hai hồ sơ, hai slot hợp lệ; đặt trùng giờ cho cùng một hồ sơ bị từ chối.
7. Bác sĩ đã đưa bệnh nhân vào phòng: lễ tân thử dời/hủy/sửa lịch từ tab khác đều nhận `409`.
8. Lễ tân sửa số điện thoại hồ sơ cũ: audit có trước/sau/lý do; lễ tân thử sửa đơn thuốc bị `403`; admin override có revision riêng.
9. Notification bị lỗi gửi: lịch vẫn đổi đúng, bản ghi chuyển `can_goi_thu_cong`, lễ tân đánh dấu đã gọi được và history liên kết được với sự kiện đó.

## 7. Các quyết định cần nhóm/thầy chốt trước khi code

1. Khi bác sĩ nghỉ đột xuất, khách không phản hồi sau bao lâu thì phòng khám áp dụng phương án giữ chỗ đầu tiên?
2. Khách đến muộn bao nhiêu phút thì chỉ được cuối hàng, và từ thời điểm nào phải chuyển sang ngày khác?
3. Ngưỡng “khám kéo dài” là slot + 15 phút, 60 phút, hay cấu hình theo chuyên khoa?
4. Kênh thông báo có hiệu lực trong phạm vi đồ án là in-app/email hay có SMS thật? Nếu không có SMS, cần chấp nhận quy trình “lễ tân gọi thủ công” có audit.
5. Admin có được sửa nội dung chuyên môn bệnh án hay chỉ được mở khóa/yêu cầu bác sĩ chỉnh sửa? Khuyến nghị: chỉ override trong tình huống ngoại lệ có lý do bắt buộc.

## 8. Liên hệ hiện trạng mã nguồn

- `HangDoi` đã là nguồn sự thật cho lượt khám thực tế và đã có trạng thái `dang_cho`, `da_goi`, `trong_phong`, `cho_dich_vu`, `hoan_thanh`.
- Check-in lịch hẹn đã chạy theo transaction `LichHen + HangDoi`; đây là nền tốt cho LT-02 và LT-06.
- Dời lịch đã dùng chung `apDungPhuongAn()` và đã có `de_xuat_doi` trên lịch hẹn; LT-01 nên mở rộng đúng điểm này.
- Hủy lịch hiện đã trả slot về `active`, nhưng cần chuẩn hóa service/audit/notification theo LT-04.
- `LichSuLichHen` trước đây thiếu enum `receptionist`; phần enum nền đã được xử lý trong LT-00, còn LT-09 tiếp tục chuẩn hóa đầy đủ nội dung history trước/sau cho các thao tác dời lịch/chuyển bác sĩ/hủy lịch.
- Hệ thống chưa lưu số thứ tự check-in cố định; đây là phần bổ sung dữ liệu nhỏ nhưng cần transaction/index ở LT-06.

Tài liệu liên quan đã tham chiếu khi lập kế hoạch: `docs/Hoan thien luong dat lich - tu khach den bac si tiep nhan (2026-07-26).md`, `docs/Ke hoach hoan thien luong check-in-den-hoa-don (2026-07-29).md`, `docs/2026-07-28-le-tan-dat-lich-offline-design.md`.
