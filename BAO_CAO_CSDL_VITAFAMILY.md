# CHƯƠNG 3. THIẾT KẾ CƠ SỞ DỮ LIỆU

## 3.1. Giới thiệu chung về cơ sở dữ liệu

Hệ thống VitaFamily sử dụng **MongoDB Atlas** là hệ quản trị cơ sở dữ liệu NoSQL. Dữ liệu được tổ chức dưới dạng các **Collection**, trong đó mỗi Collection chứa nhiều **Document**. Cấu trúc dữ liệu được định nghĩa và kiểm soát thông qua các **Schema** của thư viện **Mongoose** (Object Data Modeling). Khác với cơ sở dữ liệu quan hệ truyền thống, MongoDB không tổ chức dữ liệu theo các bảng có khóa ngoại mà sử dụng **ObjectId** và cơ chế **tham chiếu (ref)** hoặc **nhúng dữ liệu (Embedded Document)** để thể hiện mối quan hệ giữa các Collection.

Toàn bộ hệ thống bao gồm **20 Collection chính** được chia thành các phân hệ chức năng phục vụ nghiệp vụ đặt lịch khám, quản lý bệnh nhân, quản lý bác sĩ, thanh toán và hồ sơ y tế.

---

## 3.2. Mô tả chi tiết các Collection

### 3.2.1. Phân hệ Quản lý Tài khoản và Xác thực

**Bảng 3.1. Mô tả Collection nguoi_dung**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của tài liệu |
| 2 | email | String | required, unique (partial), lowercase, trim, maxlength: 255 | Địa chỉ email của người dùng |
| 3 | mat_khau | String | default: null, maxlength: 255, select: false | Mật khẩu đã được mã hóa; null khi đăng nhập bằng Google |
| 4 | ho_ten | String | required, trim, maxlength: 255 | Họ và tên người dùng |
| 5 | so_dien_thoai | String | default: null, maxlength: 20 | Số điện thoại liên hệ |
| 6 | anh_dai_dien | String | default: null, maxlength: 500 | Đường dẫn ảnh đại diện do người dùng tải lên |
| 7 | anh_dai_dien_google | String | default: null, maxlength: 500 | Đường dẫn ảnh đại diện từ tài khoản Google |
| 8 | google_id | String | default: null, sparse | Mã định danh Google OAuth 2.0 |
| 9 | providers | Array of String | enum: ['local', 'google'], default: ['local'] | Danh sách nhà cung cấp xác thực đã liên kết |
| 10 | email_verified | Boolean | default: false | Trạng thái xác minh email |
| 11 | last_login_at | Date | default: null | Thời điểm đăng nhập gần nhất |
| 12 | last_login_provider | String | default: null | Nhà cung cấp xác thực được sử dụng trong lần đăng nhập gần nhất |
| 13 | requires_onboarding | Boolean | default: false | Đánh dấu tài khoản cần hoàn tất thiết lập ban đầu |
| 14 | role | String | enum: ['user', 'patient', 'doctor', 'admin', 'receptionist'], default: 'user' | Vai trò của người dùng trong hệ thống |
| 15 | status | String | enum: ['active', 'locked'], default: 'active' | Trạng thái hoạt động của tài khoản |
| 16 | so_lan_huy_trong_thang | Number | default: 0, min: 0 | Số lần hủy lịch hẹn trong tháng hiện tại |
| 17 | thang_dem_huy | String | default: null | Tháng đang đếm số lần hủy (định dạng YYYY-MM) |
| 18 | bi_han_che_dat_lich | Boolean | default: false | Đánh dấu tài khoản bị hạn chế đặt lịch do hủy quá nhiều |
| 19 | han_che_den_ngay | Date | default: null | Thời điểm hết hạn bị hạn chế đặt lịch |
| 20 | tong_so_lan_huy_lich_su | Number | default: 0, min: 0 | Tổng số lần hủy lịch tích lũy toàn bộ lịch sử |
| 21 | ngay_xoa | Date | default: null | Thời điểm xóa mềm; null nghĩa là dữ liệu chưa bị xóa |
| 22 | reset_password_token | String | default: null | Token khôi phục mật khẩu |
| 23 | reset_password_expire | Date | default: null | Thời điểm hết hạn token khôi phục mật khẩu |
| 24 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo tài khoản |
| 25 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `nguoi_dung` là Collection trung tâm của hệ thống, lưu trữ toàn bộ thông tin tài khoản người dùng bao gồm quản trị viên, bác sĩ, lễ tân và bệnh nhân. Collection này hỗ trợ xác thực đa nhà cung cấp (local và Google OAuth 2.0) thông qua trường `providers`. Cơ chế xóa mềm được triển khai thông qua trường `ngay_xoa` nhằm bảo toàn dữ liệu liên quan. Trường `email` được đánh chỉ mục unique với điều kiện `ngay_xoa: null` để cho phép đăng ký lại email sau khi tài khoản cũ bị xóa mềm.

---

**Bảng 3.2. Mô tả Collection user_sessions**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của phiên đăng nhập |
| 2 | user_id | ObjectId | required, index, ref: NguoiDung | Mã tham chiếu đến tài khoản người dùng |
| 3 | refresh_token_hash | String | required, index | Giá trị băm của Refresh Token JWT |
| 4 | user_agent | String | default: null | Thông tin trình duyệt và thiết bị |
| 5 | ip_address | String | default: null | Địa chỉ IP của thiết bị đăng nhập |
| 6 | is_revoked | Boolean | default: false | Đánh dấu phiên đã bị thu hồi |
| 7 | expires_at | Date | required, TTL index | Thời điểm hết hạn phiên; Document tự động bị xóa khi hết hạn |
| 8 | createdAt | Date | Tự động tạo (timestamps) | Thời gian tạo phiên |
| 9 | updatedAt | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật phiên |

Collection `user_sessions` quản lý các phiên đăng nhập của người dùng dựa trên cơ chế JWT Refresh Token. Mỗi Document đại diện cho một phiên đăng nhập trên một thiết bị cụ thể. Trường `expires_at` được đánh chỉ mục TTL (Time-To-Live) để MongoDB tự động xóa phiên hết hạn. Collection này tham chiếu đến `nguoi_dung` thông qua trường `user_id`.

---

**Bảng 3.3. Mô tả Collection dat_lai_mat_khau**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất |
| 2 | user_id | ObjectId | required, ref: NguoiDung | Mã tham chiếu đến tài khoản người dùng yêu cầu đặt lại mật khẩu |
| 3 | ma_otp | String | required, length: 6 | Mã OTP gồm 6 chữ số |
| 4 | het_han | Date | required, TTL index (3600 giây) | Thời điểm hết hạn OTP; Document tự động xóa sau 1 giờ |
| 5 | da_su_dung | Boolean | default: false | Đánh dấu OTP đã được sử dụng |
| 6 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo yêu cầu |

Collection `dat_lai_mat_khau` lưu trữ mã OTP phục vụ chức năng khôi phục mật khẩu. Mỗi mã OTP có thời hạn 15 phút và chỉ được sử dụng một lần. Khi người dùng gửi yêu cầu mới, toàn bộ OTP cũ được đánh dấu `da_su_dung: true`. Chỉ mục TTL trên trường `het_han` đảm bảo Document hết hạn được MongoDB tự động dọn dẹp sau 1 giờ.

---

### 3.2.2. Phân hệ Quản lý Bác sĩ và Lịch làm việc

**Bảng 3.4. Mô tả Collection bac_si**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của bác sĩ |
| 2 | user_id | ObjectId | required, unique, ref: NguoiDung | Mã tham chiếu đến tài khoản người dùng tương ứng |
| 3 | chi_nhanh_id | ObjectId | default: null, ref: ThongTinPhongKham | Mã tham chiếu đến chi nhánh phòng khám |
| 4 | tieu_su | String | default: null | Tiểu sử chuyên môn của bác sĩ |
| 5 | bang_cap | String | default: null | Thông tin bằng cấp |
| 6 | kinh_nghiem | String | default: null | Mô tả kinh nghiệm làm việc |
| 7 | so_nam_kinh_nghiem | Number | default: 0, min: 0 | Số năm kinh nghiệm hành nghề |
| 8 | gia_kham | Number | default: 0, min: 0 | Giá khám tham khảo mỗi slot (đơn vị VNĐ) |
| 9 | phi_kham | Number | required, min: 0 | Phí khám cơ bản |
| 10 | tuoi_nhan_kham_tu | Number | default: 0, min: 0 | Giới hạn tuổi tối thiểu nhận khám; 0 nghĩa là không giới hạn |
| 11 | trang_thai_duyet | String | enum: ['pending', 'approved', 'rejected', 'suspended'], default: 'pending' | Trạng thái duyệt hồ sơ bác sĩ |
| 12 | trang_thai | String | enum: ['active', 'nghi_phep', 'nghi_viec'], default: 'active' | Trạng thái hoạt động hiện tại |
| 13 | ly_do_tu_choi | String | default: null | Lý do từ chối hồ sơ (do Admin ghi nhận) |
| 14 | so_lan_nop | Number | default: 1, min: 1, max: 5 | Số lần nộp hồ sơ xét duyệt |
| 15 | la_hien | Boolean | default: true | Hiển thị bác sĩ trên giao diện tìm kiếm |
| 16 | diem_danh_gia | Number | default: 0, min: 0, max: 5 | Điểm đánh giá trung bình (thang 0–5) |
| 17 | tong_danh_gia | Number | default: 0, min: 0 | Tổng số lượt đánh giá nhận được |
| 18 | phong_kham_mac_dinh | String | default: null | Tên phòng khám mặc định được gán |
| 19 | specialties | Array of ObjectId | ref: ChuyenKhoa | Danh sách chuyên khoa đảm nhận |
| 20 | services | Array of ObjectId | ref: DichVu | Danh sách dịch vụ y tế đảm nhận |
| 21 | bao_hiem | Embedded Document | | Thông tin bảo hiểm bác sĩ chấp nhận |
| 22 | bao_hiem.nha_nuoc | Boolean | default: false | Chấp nhận bảo hiểm y tế nhà nước |
| 23 | bao_hiem.bao_lanh | Boolean | default: false | Chấp nhận bảo hiểm bảo lãnh |
| 24 | related_services | Array of ObjectId | ref: DichVu | Danh sách dịch vụ liên quan bác sĩ có thể chỉ định |
| 25 | loai | String | enum: ['specialist', 'home_staff'], default: 'specialist' | Loại bác sĩ: chuyên khoa hoặc nhân viên lấy mẫu tại nhà |
| 26 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo hồ sơ bác sĩ |
| 27 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `bac_si` lưu trữ thông tin chuyên môn và nghiệp vụ của bác sĩ. Mỗi bác sĩ liên kết 1-1 với một tài khoản người dùng thông qua `user_id` (unique). Trường `specialties` và `services` sử dụng mảng ObjectId tham chiếu đến các Collection `chuyen_khoa` và `dich_vu`, cho phép một bác sĩ đảm nhận nhiều chuyên khoa và dịch vụ. Trường `bao_hiem` sử dụng cơ chế nhúng dữ liệu (Embedded Document).

---

**Bảng 3.5. Mô tả Collection lich_lam_viec**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của ca làm việc |
| 2 | doctor_id | ObjectId | required, ref: BacSi | Mã tham chiếu đến bác sĩ |
| 3 | chi_nhanh_id | ObjectId | default: null, ref: ThongTinPhongKham | Mã tham chiếu đến chi nhánh phòng khám |
| 4 | ngay | Date | required | Ngày làm việc |
| 5 | trang_thai_ngay | String | enum: ['lam_viec', 'nghi', 'nghi_phep'], default: 'lam_viec' | Trạng thái vận hành của ngày làm việc |
| 6 | ghi_chu_ngay | String | default: null | Ghi chú cho ngày làm việc |
| 7 | trang_thai_xac_nhan | String | enum: ['cho_xac_nhan', 'da_xac_nhan', 'tu_choi'], default: 'cho_xac_nhan' | Trạng thái xác nhận từ bác sĩ |
| 8 | ly_do_tu_choi_xac_nhan | String | default: null, maxlength: 500 | Lý do bác sĩ từ chối ca làm việc |
| 9 | thoi_diem_xac_nhan | Date | default: null | Thời điểm bác sĩ xác nhận |
| 10 | nguoi_xac_nhan_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người xác nhận |
| 11 | slots | Array of Embedded Document | default: [] | Danh sách các khung giờ khám trong ngày (xem Bảng 3.5a) |
| 12 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo ca làm việc |
| 13 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

**Bảng 3.5a. Mô tả Embedded Document slots (trong Collection lich_lam_viec)**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của slot |
| 2 | gio_bat_dau | String | required, validate: HH:MM | Giờ bắt đầu khung khám |
| 3 | gio_ket_thuc | String | required, validate: HH:MM | Giờ kết thúc khung khám |
| 4 | benh_nhan_id | ObjectId | default: null, ref: NguoiDung | Mã bệnh nhân đã đặt slot |
| 5 | benh_nhan_tam_giu_id | ObjectId | default: null, ref: NguoiDung | Mã bệnh nhân đang tạm giữ slot (chờ thanh toán) |
| 6 | specialty_id | ObjectId | default: null, ref: ChuyenKhoa | Mã chuyên khoa của slot |
| 7 | khung_index | Number | default: null, min: 0 | Vị trí khung 30 phút trong ngày (0-based) |
| 8 | loai_slot | String | enum: ['online', 'walk_in'], default: 'online' | Loại slot: đặt trực tuyến hoặc tại quầy |
| 9 | phong_kham | String | default: null | Tên phòng khám (snapshot) |
| 10 | phong_id | ObjectId | default: null, ref: PhongKham | Mã tham chiếu đến phòng khám vật lý |
| 11 | status | String | enum: ['active', 'pending_payment', 'booked', 'locked', 'cancelled', 'expired'], default: 'active' | Trạng thái của slot |
| 12 | lock_expires_at | Date | default: null | Thời điểm hết hạn khóa slot |
| 13 | pending_expired_at | Date | default: null | Thời điểm hết hạn chờ thanh toán |
| 14 | bi_khoa_boi_nghi_phep | Boolean | default: false | Đánh dấu slot bị khóa do bác sĩ nghỉ phép |
| 15 | nghi_phep_id | ObjectId | default: null, ref: NghiPhepBacSi | Mã tham chiếu đến đơn nghỉ phép |

Collection `lich_lam_viec` lưu trữ ca làm việc thực tế theo ngày của từng bác sĩ. Mỗi Document chứa một mảng `slots` được nhúng (Embedded Document), trong đó mỗi phần tử đại diện cho một khung giờ khám 30 phút. Chỉ mục unique trên cặp `(doctor_id, ngay)` đảm bảo mỗi bác sĩ chỉ có một ca làm việc trong một ngày. Collection này tham chiếu đến `bac_si` và `thong_tin_phong_kham`.

---

**Bảng 3.6. Mô tả Collection nghi_phep_bac_si**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất |
| 2 | bac_si_id | ObjectId | required, ref: BacSi | Mã tham chiếu đến bác sĩ xin nghỉ phép |
| 3 | tu_ngay | Date | required | Ngày bắt đầu nghỉ phép |
| 4 | den_ngay | Date | required | Ngày kết thúc nghỉ phép |
| 5 | gio_bat_dau | String | default: null, validate: HH:MM | Giờ bắt đầu nghỉ trong ngày; null nghĩa là nghỉ cả ngày |
| 6 | gio_ket_thuc | String | default: null, validate: HH:MM | Giờ kết thúc nghỉ trong ngày |
| 7 | ly_do | String | default: null, maxlength: 500 | Lý do xin nghỉ phép |
| 8 | trang_thai | String | enum: ['cho_duyet', 'da_duyet', 'tu_choi', 'da_huy'], default: 'cho_duyet' | Trạng thái phê duyệt |
| 9 | nguoi_duyet_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người phê duyệt |
| 10 | thoi_diem_duyet | Date | default: null | Thời điểm phê duyệt |
| 11 | ghi_chu | String | default: null, maxlength: 500 | Ghi chú xử lý của quản trị viên |
| 12 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo đơn nghỉ phép |
| 13 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `nghi_phep_bac_si` quản lý toàn bộ đơn xin nghỉ phép của bác sĩ. Mỗi đơn nghỉ phép được tạo ở trạng thái `cho_duyet` và chỉ quản trị viên mới có quyền phê duyệt hoặc từ chối. Bác sĩ có thể hủy đơn khi trạng thái còn đang chờ duyệt. Collection này tham chiếu đến `bac_si` và `nguoi_dung`.

---

### 3.2.3. Phân hệ Quản lý Bệnh nhân và Gia đình

**Bảng 3.7. Mô tả Collection gia_dinh**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của nhóm gia đình |
| 2 | user_id | ObjectId | required, unique, ref: NguoiDung | Mã tham chiếu đến tài khoản chủ hộ |
| 3 | ten_nhom | String | required, trim, maxlength: 255 | Tên nhóm gia đình |
| 4 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo nhóm gia đình |

Collection `gia_dinh` quản lý nhóm gia đình gắn liền với một tài khoản người dùng. Mỗi tài khoản chỉ có tối đa một nhóm gia đình (ràng buộc unique trên `user_id`). Collection này đóng vai trò là nút gốc để liên kết các thành viên trong gia đình phục vụ chức năng đặt lịch khám hộ.

---

**Bảng 3.8. Mô tả Collection thanh_vien**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của thành viên |
| 2 | family_id | ObjectId | required, ref: GiaDinh | Mã tham chiếu đến nhóm gia đình |
| 3 | tai_khoan_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến tài khoản người dùng (nếu có) |
| 4 | ho_so_benh_nhan_id | ObjectId | default: null, ref: HoSoBenhNhan | Mã tham chiếu đến hồ sơ bệnh nhân |
| 5 | ho_ten | String | required, trim, maxlength: 255 | Họ và tên thành viên |
| 6 | ngay_sinh | Date | required | Ngày sinh |
| 7 | gioi_tinh | String | required, enum: ['nam', 'nu', 'khac'] | Giới tính |
| 8 | quan_he | String | enum: ['ban_than', 'cha', 'me', 'con', 'vo', 'chong', 'anh_chi_em', 'khac'], default: null | Quan hệ với chủ hộ |
| 9 | nhom_mau | String | enum: ['A', 'B', 'AB', 'O', null], default: null | Nhóm máu |
| 10 | di_ung | String | default: null | Thông tin dị ứng |
| 11 | benh_nen | String | default: null | Thông tin bệnh nền |
| 12 | la_chu_ho | Boolean | default: false | Đánh dấu thành viên là chủ hộ |
| 13 | ngay_xoa | Date | default: null | Thời điểm xóa mềm; null nghĩa là dữ liệu chưa bị xóa |
| 14 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo thành viên |
| 15 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `thanh_vien` lưu trữ thông tin từng thành viên trong nhóm gia đình. Mỗi nhóm gia đình có tối đa 10 thành viên (ràng buộc ở tầng middleware). Trường `quan_he` ghi nhận mối quan hệ của thành viên với chủ hộ, phục vụ chức năng đặt lịch khám hộ cho người thân. Collection này tham chiếu đến `gia_dinh`, `nguoi_dung` và `ho_so_benh_nhan`.

---

**Bảng 3.9. Mô tả Collection ho_so_benh_nhan**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của hồ sơ bệnh nhân |
| 2 | ho_ten | String | required, trim, maxlength: 255 | Họ và tên bệnh nhân |
| 3 | so_dien_thoai | String | default: null, trim, maxlength: 20 | Số điện thoại |
| 4 | so_dien_thoai_tim_kiem | String | default: null, trim, maxlength: 20 | Số điện thoại chuẩn hóa phục vụ tìm kiếm |
| 5 | ngay_sinh | Date | default: null | Ngày sinh |
| 6 | gioi_tinh | String | enum: ['nam', 'nu', 'khac'], default: null | Giới tính |
| 7 | dia_chi | String | default: null, maxlength: 500 | Địa chỉ |
| 8 | ghi_chu | String | default: null, maxlength: 1000 | Ghi chú y tế |
| 9 | tai_khoan_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến tài khoản người dùng |
| 10 | nguoi_giam_ho_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người giám hộ |
| 11 | member_id | ObjectId | default: null, unique (sparse), ref: ThanhVien | Mã tham chiếu đến thành viên gia đình |
| 12 | khach_vang_lai_id | ObjectId | default: null, unique (sparse), ref: KhachVangLai | Mã tham chiếu đến khách vãng lai |
| 13 | nguon_tao | String | enum: ['online', 'tai_quay', 'backfill'], default: 'tai_quay' | Nguồn tạo hồ sơ |
| 14 | trang_thai | String | enum: ['active', 'merged', 'archived'], default: 'active' | Trạng thái hồ sơ |
| 15 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo hồ sơ |
| 16 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `ho_so_benh_nhan` là Collection thống nhất hồ sơ bệnh nhân từ nhiều nguồn: đăng ký trực tuyến, đăng ký tại quầy lễ tân, và khách vãng lai. Chỉ mục unique trên `member_id` và `khach_vang_lai_id` (kiểu sparse) đảm bảo mỗi thành viên hoặc khách vãng lai chỉ có một hồ sơ bệnh nhân duy nhất. Collection này tham chiếu đến `nguoi_dung`, `thanh_vien` và `khach_vang_lai`.

---

### 3.2.4. Phân hệ Phòng khám, Chuyên khoa và Dịch vụ

**Bảng 3.10. Mô tả Collection thong_tin_phong_kham**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất |
| 2 | ten | String | required, trim, maxlength: 255 | Tên chi nhánh phòng khám |
| 3 | trang_thai | String | enum: ['active', 'inactive'], default: 'active' | Trạng thái hoạt động |
| 4 | dia_chi | String | default: null | Địa chỉ phòng khám |
| 5 | so_dien_thoai | String | default: null, maxlength: 20 | Số điện thoại liên hệ |
| 6 | email | String | default: null, maxlength: 255, lowercase, trim | Địa chỉ email |
| 7 | gio_lam_viec | String | default: null, maxlength: 255 | Giờ làm việc |
| 8 | mo_ta | String | default: null | Mô tả giới thiệu |
| 9 | logo_url | String | default: null, maxlength: 500 | Đường dẫn logo phòng khám |
| 10 | ban_do_url | String | default: null, maxlength: 500 | Đường dẫn nhúng Google Maps |
| 11 | bao_hiem | Embedded Document | | Thông tin bảo hiểm phòng khám chấp nhận |
| 12 | bao_hiem.nha_nuoc | Boolean | default: false | Chấp nhận bảo hiểm y tế nhà nước |
| 13 | bao_hiem.bao_lanh | Boolean | default: false | Chấp nhận bảo hiểm bảo lãnh |
| 14 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo |
| 15 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật |

Collection `thong_tin_phong_kham` lưu trữ thông tin giới thiệu chung của cơ sở phòng khám VitaFamily. Đây là Collection singleton — chỉ tồn tại duy nhất một Document trong toàn bộ hệ thống, đại diện cho một cơ sở phòng khám duy nhất. Trường `bao_hiem` sử dụng cơ chế nhúng dữ liệu (Embedded Document) để lưu thông tin bảo hiểm.

---

**Bảng 3.11. Mô tả Collection chuyen_khoa**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của chuyên khoa |
| 2 | phong_kham_id | ObjectId | required, ref: ThongTinPhongKham | Mã tham chiếu đến phòng khám |
| 3 | ten | String | required, trim, maxlength: 255 | Tên chuyên khoa |
| 4 | mo_ta | String | default: null | Mô tả chuyên khoa |
| 5 | icon_url | String | default: null, maxlength: 500 | Đường dẫn biểu tượng chuyên khoa |
| 6 | slug | String | required, lowercase, trim, maxlength: 255 | Đường dẫn thân thiện URL (tự sinh từ tên) |
| 7 | thu_tu | Number | default: 0 | Thứ tự hiển thị trên giao diện |
| 8 | status | String | enum: ['active', 'hidden'], default: 'active' | Trạng thái hiển thị |
| 9 | thoi_gian_kham_trung_binh_phut | Number | default: 15, min: 5, max: 30 | Thời gian khám trung bình một bệnh nhân (phút) |
| 10 | so_slot_moi_khung | Number | default: null, min: 1 | Số slot tối đa mỗi khung 30 phút; null nghĩa là tự tính |
| 11 | ty_le_online_phan_tram | Number | default: 70, min: 0, max: 100 | Tỷ lệ phần trăm slot dành cho đặt trực tuyến |
| 12 | gia_kham | Number | default: 0, min: 0 | Giá khám thống nhất cho chuyên khoa (VNĐ) |
| 13 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo chuyên khoa |

Collection `chuyen_khoa` lưu trữ danh mục các chuyên khoa y tế (Tai, Mũi, Họng, Nội soi). Ngoài thông tin hiển thị, Collection này còn chứa các tham số cấu hình năng lực khám bao gồm thời gian khám trung bình, số slot mỗi khung giờ và tỷ lệ đặt trực tuyến — phục vụ việc tự động sinh lịch làm việc cho bác sĩ. Chỉ mục unique trên cặp `(slug, phong_kham_id)` ngăn trùng lặp chuyên khoa trong cùng một phòng khám.

---

**Bảng 3.12. Mô tả Collection dich_vu**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của dịch vụ |
| 2 | ma_dich_vu | String | unique, trim | Mã dịch vụ tự động sinh (DV001, DV002...) |
| 3 | ten | String | required, trim, maxlength: 255 | Tên dịch vụ |
| 4 | hinh_anh | String | default: null, maxlength: 1000 | Đường dẫn hình ảnh minh họa |
| 5 | loai | String | required, enum: ['home', 'related'] | Loại dịch vụ: tại nhà hoặc liên quan chuyên khoa |
| 6 | mo_ta_ngan | String | default: null, maxlength: 500 | Mô tả ngắn |
| 7 | mo_ta | String | default: null, maxlength: 5000 | Mô tả chi tiết |
| 8 | gia | Number | required, min: 1, max: 100000000 | Giá dịch vụ (VNĐ) |
| 9 | thoi_gian_phut | Number | default: null, min: 10, max: 480 | Thời gian thực hiện dịch vụ (phút) |
| 10 | specialty_id | ObjectId | default: null, ref: ChuyenKhoa | Mã tham chiếu đến chuyên khoa (bắt buộc cho loại 'related') |
| 11 | la_goi | Boolean | default: false | Đánh dấu dịch vụ là gói dịch vụ |
| 12 | dich_vu_con | Array of ObjectId | ref: DichVu | Danh sách dịch vụ con trong gói |
| 13 | nguoi_tao_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người tạo dịch vụ |
| 14 | status | String | enum: ['active', 'inactive'], default: 'inactive' | Trạng thái dịch vụ |
| 15 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo dịch vụ |
| 16 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `dich_vu` lưu trữ danh mục dịch vụ y tế của hệ thống, phân thành hai loại: `home` (lấy mẫu xét nghiệm tại nhà) và `related` (dịch vụ liên quan theo chỉ định bác sĩ). Trường `ma_dich_vu` được hệ thống tự động sinh bằng bộ đếm nguyên tử (atomic counter) từ Collection `counters` nhằm tránh xung đột khi tạo đồng thời. Dịch vụ mới mặc định ở trạng thái `inactive` để quản trị viên kiểm duyệt trước khi công khai.

---

### 3.2.5. Phân hệ Đặt lịch hẹn và Thanh toán

**Bảng 3.13. Mô tả Collection lich_hen**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của lịch hẹn |
| 2 | user_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến tài khoản đặt lịch |
| 3 | member_id | ObjectId | default: null, ref: ThanhVien | Mã tham chiếu đến thành viên được khám |
| 4 | doctor_id | ObjectId | default: null, ref: BacSi | Mã tham chiếu đến bác sĩ khám |
| 5 | schedule_id | ObjectId | default: null, ref: LichLamViec | Mã tham chiếu đến ca làm việc |
| 6 | slot_id | ObjectId | default: null | Mã tham chiếu đến khung giờ khám |
| 7 | service_id | ObjectId | default: null, ref: DichVu | Mã tham chiếu đến dịch vụ (khám tại nhà) |
| 8 | chi_nhanh_id | ObjectId | default: null, ref: ThongTinPhongKham | Mã tham chiếu đến chi nhánh |
| 9 | specialty_id | ObjectId | default: null, ref: ChuyenKhoa | Mã tham chiếu đến chuyên khoa |
| 10 | ho_so_benh_nhan_id | ObjectId | default: null, ref: HoSoBenhNhan | Mã tham chiếu đến hồ sơ bệnh nhân |
| 11 | ma_lich_hen | String | unique, sparse, trim | Mã lịch hẹn (LHxxxx) |
| 12 | loai_kham | String | required, enum: ['clinic', 'home'] | Loại hình khám: tại phòng khám hoặc tại nhà |
| 13 | ngay_kham | Date | required | Ngày khám |
| 14 | gio_kham | String | required | Giờ bắt đầu khám |
| 15 | gio_ket_thuc | String | default: null | Giờ kết thúc khám |
| 16 | ly_do_kham | String | default: null, maxlength: 500 | Lý do khám bệnh |
| 17 | phong_kham | String | default: null | Tên phòng khám (snapshot) |
| 18 | dia_chi_kham | String | default: null | Địa chỉ khám tại nhà |
| 19 | status | String | enum: ['pending', 'confirmed', 'checked_in', 'in_progress', 'waiting_record', 'waiting_doctor_confirm', 'completed', 'cancelled', 'no_show', 'skipped'], default: 'pending' | Trạng thái lịch hẹn |
| 20 | payment_status | String | enum: ['unpaid', 'partial', 'paid', 'refunded'], default: 'unpaid' | Trạng thái thanh toán |
| 21 | gia_kham | Number | required, min: 0 | Giá khám (VNĐ) |
| 22 | dat_ho | Boolean | default: false | Đánh dấu đặt hộ cho người khác |
| 23 | ten_khach | String | default: null, maxlength: 255 | Tên khách hàng (khi không có member_id) |
| 24 | ly_do_huy | String | default: null | Lý do hủy lịch hẹn |
| 25 | nguoi_huy_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người hủy |
| 26 | thoi_diem_huy | Date | default: null | Thời điểm hủy lịch hẹn |
| 27 | so_lan_thay_doi | Number | default: 0, min: 0 | Tổng số lần dời lịch |
| 28 | de_xuat_doi | Embedded Document | default: null | Thông tin đề xuất dời lịch do phòng khám khởi xướng |
| 29 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo lịch hẹn |
| 30 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `lich_hen` là Collection nghiệp vụ trung tâm của hệ thống, lưu trữ toàn bộ thông tin lịch hẹn khám bệnh. Mỗi lịch hẹn tham chiếu đến nhiều Collection khác bao gồm người dùng, bác sĩ, ca làm việc, chuyên khoa và dịch vụ. Chỉ mục unique trên cặp `(schedule_id, slot_id)` đảm bảo ràng buộc bất biến: mỗi slot chỉ có tối đa một lịch hẹn còn hiệu lực. Trường `de_xuat_doi` sử dụng cơ chế nhúng dữ liệu (Embedded Document) cho thông tin đề xuất dời lịch khi bác sĩ nghỉ phép.

---

**Bảng 3.14. Mô tả Collection hoa_don**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của hóa đơn |
| 2 | appointment_id | ObjectId | unique (sparse), ref: LichHen | Mã tham chiếu đến lịch hẹn trực tuyến |
| 3 | hang_doi_id | ObjectId | unique (sparse), ref: HangDoi | Mã tham chiếu đến lượt khám tại quầy |
| 4 | ho_so_benh_nhan_id | ObjectId | default: null, ref: HoSoBenhNhan | Mã tham chiếu đến hồ sơ bệnh nhân |
| 5 | so_hoa_don | String | required, unique, trim | Số hóa đơn (HDxxxx) |
| 6 | chi_nhanh_id | ObjectId | default: null, ref: ThongTinPhongKham | Mã tham chiếu đến chi nhánh |
| 7 | specialty_id | ObjectId | default: null, ref: ChuyenKhoa | Mã tham chiếu đến chuyên khoa |
| 8 | tong_tien_kham | Number | default: 0, min: 0 | Tổng tiền khám cơ bản |
| 9 | chi_tiet_thu_phi | Array of Embedded Document | default: [] | Chi tiết các khoản thu phí (xem Bảng 3.14a) |
| 10 | tong_tien_phat_sinh | Number | default: 0, min: 0 | Tổng tiền phát sinh |
| 11 | tong_thanh_toan | Number | default: 0, min: 0 | Tổng số tiền cần thanh toán |
| 12 | trang_thai_hoa_don | String | enum: ['chua_thanh_toan', 'da_dat_coc', 'da_thanh_toan_du', 'qua_han'], default: 'chua_thanh_toan' | Trạng thái thanh toán hóa đơn |
| 13 | ghi_chu_ke_toan | String | default: null | Ghi chú của kế toán |
| 14 | created_at | Date | Tự động tạo (timestamps) | Thời gian tạo hóa đơn |
| 15 | updated_at | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

**Bảng 3.14a. Mô tả Embedded Document chi_tiet_thu_phi (trong Collection hoa_don)**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | loai | String | required, enum: ['phi_kham', 'dich_vu', 'thu_thuat', 'giam_tru_bao_hiem'] | Loại khoản thu |
| 2 | service_id | ObjectId | default: null, ref: DichVu | Mã tham chiếu đến dịch vụ |
| 3 | ten | String | default: null | Tên khoản thu |
| 4 | so_tien | Number | required, min: 0 | Đơn giá |
| 5 | so_luong | Number | default: 1, min: 0 | Số lượng |
| 6 | thanh_tien | Number | required, min: 0 | Thành tiền |
| 7 | ghi_chu | String | default: null | Ghi chú |

Collection `hoa_don` quản lý hóa đơn tài chính của hệ thống. Mỗi hóa đơn phải gắn với một lịch hẹn trực tuyến (`appointment_id`) hoặc một lượt khám tại quầy (`hang_doi_id`). Trường `chi_tiet_thu_phi` sử dụng mảng Embedded Document cho phép ghi nhận chi tiết từng khoản thu bao gồm phí khám, dịch vụ, thủ thuật và giảm trừ bảo hiểm.

---

**Bảng 3.15. Mô tả Collection thanh_toan**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của giao dịch |
| 2 | appointment_id | ObjectId | unique, sparse, ref: LichHen | Mã tham chiếu đến lịch hẹn |
| 3 | hoa_don_id | ObjectId | index, default: null, ref: HoaDon | Mã tham chiếu đến hóa đơn |
| 4 | hang_doi_id | ObjectId | default: null, ref: HangDoi | Mã tham chiếu đến lượt khám tại quầy |
| 5 | ho_so_benh_nhan_id | ObjectId | default: null, ref: HoSoBenhNhan | Mã tham chiếu đến hồ sơ bệnh nhân |
| 6 | benh_nhan_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến bệnh nhân |
| 7 | ma_giao_dich | String | unique, sparse, maxlength: 20 | Mã giao dịch tự động sinh (TXN0001) |
| 8 | so_tien | Number | required, min: 0 | Số tiền giao dịch (VNĐ) |
| 9 | loai_thanh_toan | String | required, enum: ['phi_dat_lich', 'dat_coc', 'thanh_toan_bo_sung'] | Loại thanh toán |
| 10 | phuong_thuc | String | required, enum: ['tien_mat', 'chuyen_khoan', 'vi_dien_tu', 'the_ngan_hang'] | Phương thức thanh toán |
| 11 | status | String | enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' | Trạng thái giao dịch |
| 12 | ngay_thanh_toan | Date | default: null | Ngày thanh toán |
| 13 | nguoi_thu_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người thu tiền (lễ tân) |
| 14 | gateway_transaction_id | String | default: null, maxlength: 100 | Mã giao dịch từ cổng thanh toán VNPay |
| 15 | gateway_response | Mixed | default: null | Dữ liệu phản hồi đầy đủ từ cổng thanh toán |
| 16 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo giao dịch |
| 17 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `thanh_toan` lưu trữ chi tiết lịch sử giao dịch thanh toán. Hệ thống hỗ trợ nhiều phương thức thanh toán bao gồm tiền mặt, chuyển khoản, ví điện tử và thẻ ngân hàng. Trường `gateway_response` sử dụng kiểu Mixed để lưu trữ toàn bộ phản hồi từ cổng thanh toán VNPay. Trường `ma_giao_dich` được tự động sinh duy nhất bằng middleware pre-validate.

---

### 3.2.6. Phân hệ Hồ sơ Y tế và Kết quả khám

**Bảng 3.16. Mô tả Collection ket_qua_kham**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất |
| 2 | appointment_id | ObjectId | unique (sparse), ref: LichHen | Mã tham chiếu đến lịch hẹn trực tuyến |
| 3 | hang_doi_id | ObjectId | unique (sparse), ref: HangDoi | Mã tham chiếu đến lượt khám tại quầy |
| 4 | ho_so_benh_nhan_id | ObjectId | default: null, ref: HoSoBenhNhan | Mã tham chiếu đến hồ sơ bệnh nhân |
| 5 | nguoi_nhap_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người nhập liệu |
| 6 | bac_si_phu_trach_id | ObjectId | default: null, ref: BacSi | Mã tham chiếu đến bác sĩ phụ trách |
| 7 | nguoi_xac_nhan_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người xác nhận hồ sơ |
| 8 | thoi_diem_xac_nhan | Date | default: null | Thời điểm xác nhận hồ sơ |
| 9 | status | String | enum: ['ban_nhap', 'cho_xac_nhan', 'da_xac_nhan', 'yeu_cau_chinh_sua'], default: 'cho_xac_nhan' | Trạng thái xác nhận hồ sơ khám |
| 10 | chan_doan | String | required, trim | Kết luận chẩn đoán của bác sĩ |
| 11 | huong_dan_dieu_tri | String | default: null | Hướng dẫn điều trị |
| 12 | ghi_chu | String | default: null | Ghi chú bổ sung |
| 13 | trieu_chung_ban_dau | String | default: null | Triệu chứng ghi nhận khi tiếp nhận ban đầu |
| 14 | ghi_chu_dieu_duong | String | default: null | Ghi chú của điều dưỡng |
| 15 | ngay_tai_kham | Date | default: null | Ngày hẹn tái khám |
| 16 | co_the_sua | Boolean | default: true | Cho phép chỉnh sửa hồ sơ |
| 17 | dich_vu_phat_sinh | Array of Embedded Document | default: [] | Danh sách dịch vụ phát sinh bác sĩ chỉ định |
| 18 | lich_su_sua | Array of Embedded Document | default: [] | Lịch sử chỉnh sửa hồ sơ |
| 19 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo kết quả khám |
| 20 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `ket_qua_kham` lưu trữ kết quả khám bệnh do bác sĩ ghi nhận sau mỗi buổi khám. Mỗi kết quả khám gắn với một lịch hẹn trực tuyến hoặc một lượt khám tại quầy (ràng buộc ở middleware). Trường `dich_vu_phat_sinh` sử dụng Embedded Document cho phép bác sĩ chỉ định thêm dịch vụ xét nghiệm, nội soi ngay trong ca khám. Luồng xác nhận hồ sơ tuân theo quy trình: `ban_nhap` → `cho_xac_nhan` → `da_xac_nhan`.

---

**Bảng 3.17. Mô tả Collection don_thuoc**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của đơn thuốc |
| 2 | ket_qua_kham_id | ObjectId | required, ref: KetQuaKham | Mã tham chiếu đến kết quả khám |
| 3 | medical_record_id | ObjectId | default: null, ref: KetQuaKham | Mã tham chiếu đến hồ sơ khám (tương thích ngược) |
| 4 | member_id | ObjectId | default: null, ref: ThanhVien | Mã tham chiếu đến thành viên gia đình |
| 5 | ten_khach | String | default: null, maxlength: 255 | Tên bệnh nhân (khi không có member_id) |
| 6 | doctor_id | ObjectId | default: null, ref: BacSi | Mã tham chiếu đến bác sĩ kê đơn |
| 7 | nguon | String | enum: ['bac_si', 'tu_nhap', 'y_ta'], default: 'tu_nhap' | Nguồn tạo đơn thuốc |
| 8 | ghi_chu | String | default: null | Ghi chú của bác sĩ |
| 9 | items | Array of Embedded Document | validate: 1–10 phần tử | Danh sách thuốc trong đơn (xem Bảng 3.17a) |
| 10 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo đơn thuốc |

**Bảng 3.17a. Mô tả Embedded Document items (trong Collection don_thuoc)**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất của thuốc |
| 2 | ten_thuoc | String | required, trim, maxlength: 255 | Tên thuốc |
| 3 | lieu_luong | String | default: null, maxlength: 100 | Liều lượng sử dụng |
| 4 | tan_suat | String | default: null, maxlength: 100 | Tần suất uống thuốc |
| 5 | gio_uong | Array of String | default: [], validate: HH:MM | Danh sách giờ uống trong ngày |
| 6 | so_ngay | Number | required, min: 1, max: 90 | Số ngày uống thuốc |
| 7 | ghi_chu | String | default: null, maxlength: 500 | Ghi chú cho từng thuốc |

Collection `don_thuoc` lưu trữ đơn thuốc điện tử gắn liền với kết quả khám. Mỗi đơn thuốc chứa từ 1 đến 10 loại thuốc, được lưu dưới dạng mảng Embedded Document `items`. Trường `gio_uong` trong mỗi thuốc lưu danh sách giờ uống cụ thể (định dạng HH:MM), phục vụ tính năng nhắc nhở uống thuốc tự động thông qua Collection `nhac_nho`.

---

### 3.2.7. Phân hệ Tương tác và Đánh giá

**Bảng 3.18. Mô tả Collection danh_gia**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất |
| 2 | appointment_id | ObjectId | required, unique, ref: LichHen | Mã tham chiếu đến lịch hẹn đã hoàn thành |
| 3 | user_id | ObjectId | required, ref: NguoiDung | Mã tham chiếu đến bệnh nhân đánh giá |
| 4 | doctor_id | ObjectId | required, ref: BacSi | Mã tham chiếu đến bác sĩ được đánh giá |
| 5 | so_sao | Number | required, min: 1, max: 5 | Số sao đánh giá (số nguyên 1–5) |
| 6 | noi_dung | String | default: null, maxlength: 500 | Nội dung nhận xét |
| 7 | status | String | enum: ['visible', 'hidden'], default: 'visible' | Trạng thái hiển thị |
| 8 | ngay_xoa | Date | default: null | Thời điểm xóa mềm; null nghĩa là dữ liệu chưa bị xóa |
| 9 | nguoi_xoa | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người thực hiện xóa |
| 10 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo đánh giá |
| 11 | ngay_cap_nhat | Date | Tự động cập nhật (timestamps) | Thời gian cập nhật gần nhất |

Collection `danh_gia` lưu trữ phản hồi và đánh giá chất lượng khám bệnh của bệnh nhân. Mỗi lịch hẹn chỉ cho phép một đánh giá duy nhất (ràng buộc unique trên `appointment_id`). Khi quản trị viên thay đổi trạng thái hiển thị, tầng service tự động cập nhật lại điểm đánh giá trung bình (`diem_danh_gia`) và tổng số đánh giá (`tong_danh_gia`) trong Collection `bac_si`.

---

**Bảng 3.19. Mô tả Collection thong_bao**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất |
| 2 | user_id | ObjectId | required, ref: NguoiDung | Mã tham chiếu đến người nhận thông báo |
| 3 | tieu_de | String | required, maxlength: 255 | Tiêu đề thông báo |
| 4 | noi_dung | String | required | Nội dung thông báo |
| 5 | loai | String | required, enum: ['appointment', 'medicine', 'system', 'reminder', 'payment', 'refund'] | Loại thông báo |
| 6 | related_id | ObjectId | default: null | Mã tham chiếu đến đối tượng liên quan |
| 7 | related_type | String | default: null, maxlength: 50 | Loại đối tượng liên quan |
| 8 | da_doc | Boolean | default: false | Đánh dấu đã đọc |
| 9 | du_lieu_dinh_kem | Mixed | default: null | Dữ liệu bổ sung đính kèm thông báo |
| 10 | kenh_gui | String | enum: ['in_app', 'email', 'sms', 'zalo'], default: null | Kênh gửi thông báo |
| 11 | da_gui | Boolean | default: false | Đánh dấu đã gửi |
| 12 | thoi_diem_gui | Date | default: null | Thời điểm gửi thông báo |
| 13 | thoi_diem_doc | Date | default: null | Thời điểm người dùng đọc thông báo |
| 14 | ngay_gui_du_kien | Date | default: null | Thời điểm dự kiến gửi thông báo |
| 15 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian tạo thông báo |

Collection `thong_bao` lưu trữ các tin nhắn thông báo cá nhân gửi riêng cho từng người dùng. Hệ thống hỗ trợ nhiều loại thông báo bao gồm nhắc lịch hẹn, nhắc uống thuốc, thông báo thanh toán và hoàn tiền. Trường `du_lieu_dinh_kem` sử dụng kiểu Mixed cho phép đính kèm dữ liệu linh hoạt tùy theo loại thông báo. Collection này tham chiếu đến `nguoi_dung` qua trường `user_id`.

---

### 3.2.8. Phân hệ Giám sát và Nhật ký hệ thống

**Bảng 3.20. Mô tả Collection nhat_ky_thao_tac**

| STT | Tên trường | Kiểu dữ liệu MongoDB/Mongoose | Ràng buộc/Thuộc tính | Mô tả |
|:---:|:---|:---|:---|:---|
| 1 | _id | ObjectId | Tự động tạo | Mã định danh duy nhất |
| 2 | nguoi_thuc_hien_id | ObjectId | default: null, ref: NguoiDung | Mã tham chiếu đến người thực hiện; null khi hệ thống tự động |
| 3 | vai_tro | String | required, enum: ['admin', 'doctor', 'user', 'system', 'nurse', 'receptionist'] | Vai trò của người thực hiện |
| 4 | hanh_dong | String | required, maxlength: 100 | Mã hành động (LOCK_USER, APPROVE_DOCTOR, CREATE_SERVICE...) |
| 5 | loai_doi_tuong | String | required, maxlength: 50 | Loại đối tượng bị tác động (user, doctor, service, specialty...) |
| 6 | doi_tuong_id | ObjectId | required | Mã định danh đối tượng bị tác động |
| 7 | ly_do | String | default: null | Lý do thực hiện hành động |
| 8 | du_lieu_cu | Mixed | default: null | Dữ liệu trước khi thay đổi (JSON snapshot) |
| 9 | du_lieu_moi | Mixed | default: null | Dữ liệu sau khi thay đổi (JSON snapshot) |
| 10 | ngay_tao | Date | Tự động tạo (timestamps) | Thời gian ghi nhật ký |

Collection `nhat_ky_thao_tac` đóng vai trò là bản ghi kiểm toán (Audit Log) bất biến của toàn hệ thống. Collection này chỉ thực hiện thao tác thêm mới (INSERT), không cho phép cập nhật hay xóa dữ liệu nhằm đảm bảo tính toàn vẹn của nhật ký. Trường `du_lieu_cu` và `du_lieu_moi` sử dụng kiểu Mixed để lưu trữ trạng thái trước và sau thay đổi dưới dạng JSON, phục vụ việc truy vết và so sánh sự khác biệt khi cần kiểm toán.

---

## 3.3. Tổng kết mô hình cơ sở dữ liệu MongoDB

Hệ thống VitaFamily sử dụng 20 Collection chính được tổ chức theo mô hình cơ sở dữ liệu NoSQL với cơ chế tham chiếu dữ liệu (reference) kết hợp nhúng dữ liệu (embedding) khi phù hợp.

### 3.3.1. Danh sách Collection và chức năng

| STT | Tên Collection | Tên Model Mongoose | Chức năng |
|:---:|:---|:---|:---|
| 1 | nguoi_dung | NguoiDung | Quản lý tài khoản người dùng (Admin, Bác sĩ, Lễ tân, Bệnh nhân) |
| 2 | user_sessions | UserSession | Quản lý phiên đăng nhập JWT Refresh Token |
| 3 | dat_lai_mat_khau | DatLaiMatKhau | Lưu mã OTP khôi phục mật khẩu |
| 4 | bac_si | BacSi | Lưu thông tin chuyên môn và nghiệp vụ bác sĩ |
| 5 | lich_lam_viec | LichLamViec | Lưu ca làm việc và khung giờ khám theo ngày |
| 6 | nghi_phep_bac_si | NghiPhepBacSi | Quản lý đơn xin nghỉ phép bác sĩ |
| 7 | gia_dinh | GiaDinh | Quản lý nhóm gia đình |
| 8 | thanh_vien | ThanhVien | Lưu thành viên trong nhóm gia đình |
| 9 | ho_so_benh_nhan | HoSoBenhNhan | Thống nhất hồ sơ bệnh nhân đa nguồn |
| 10 | thong_tin_phong_kham | ThongTinPhongKham | Thông tin giới thiệu phòng khám |
| 11 | chuyen_khoa | ChuyenKhoa | Danh mục chuyên khoa y tế và cấu hình năng lực khám |
| 12 | dich_vu | DichVu | Danh mục dịch vụ y tế |
| 13 | lich_hen | LichHen | Quản lý lịch hẹn khám bệnh |
| 14 | hoa_don | HoaDon | Quản lý hóa đơn tài chính |
| 15 | thanh_toan | ThanhToan | Lưu lịch sử giao dịch thanh toán |
| 16 | ket_qua_kham | KetQuaKham | Lưu kết quả khám và chẩn đoán bác sĩ |
| 17 | don_thuoc | DonThuoc | Lưu đơn thuốc điện tử |
| 18 | danh_gia | DanhGia | Lưu đánh giá chất lượng khám bệnh |
| 19 | thong_bao | ThongBao | Lưu thông báo cá nhân cho người dùng |
| 20 | nhat_ky_thao_tac | NhatKyThaoTac | Nhật ký kiểm toán hệ thống (Audit Log) |

### 3.3.2. Quan hệ tham chiếu giữa các Collection

Các Collection trong hệ thống VitaFamily liên kết với nhau thông qua cơ chế tham chiếu ObjectId của MongoDB. Dưới đây là các mối quan hệ chính:

- **nguoi_dung** là Collection trung tâm, được tham chiếu bởi hầu hết các Collection khác thông qua các trường `user_id`, `benh_nhan_id`, `nguoi_thu_id`, `nguoi_thuc_hien_id`.
- **bac_si** tham chiếu đến `nguoi_dung` (quan hệ 1–1 qua `user_id`) và được tham chiếu bởi `lich_lam_viec`, `lich_hen`, `danh_gia`, `ket_qua_kham`.
- **gia_dinh** tham chiếu đến `nguoi_dung` (quan hệ 1–1) và là Collection cha của `thanh_vien` (quan hệ 1–nhiều).
- **thanh_vien** tham chiếu đến `gia_dinh` và được tham chiếu bởi `lich_hen`, `don_thuoc`, `ho_so_benh_nhan`.
- **lich_hen** tham chiếu đến `nguoi_dung`, `bac_si`, `lich_lam_viec`, `chuyen_khoa`, `dich_vu` và `thanh_vien` — là nút giao của hầu hết các luồng nghiệp vụ.
- **hoa_don** và **thanh_toan** tham chiếu đến `lich_hen`, tạo thành luồng nghiệp vụ: Đặt lịch → Hóa đơn → Thanh toán.
- **ket_qua_kham** tham chiếu đến `lich_hen` và được tham chiếu bởi `don_thuoc`, tạo thành luồng: Khám bệnh → Kết quả → Đơn thuốc.
- **nhat_ky_thao_tac** tham chiếu đến `nguoi_dung` và ghi vết mọi thao tác trên các Collection khác thông qua `doi_tuong_id`.
