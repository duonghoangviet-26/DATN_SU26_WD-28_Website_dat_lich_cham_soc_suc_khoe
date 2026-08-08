# Hoàn thiện luồng đặt lịch — từ khách hàng đến bác sĩ tiếp nhận (2026-07-26)

Rà soát toàn chuỗi rồi vá phần bị đứt. Rule tham chiếu: `.claude/rules/lich-lam-viec-bac-si.md`.

---

## 1. Chuỗi lẽ ra phải liền

```
khách đặt lịch → thanh toán 100% → tới phòng khám → TIẾP NHẬN (check-in)
      → vào hàng đợi bác sĩ → gọi → vào phòng → khám → nhập hồ sơ
                                   ↘ không tới, hết ca → no_show (mất 100%)
```

Hai đầu đã có sẵn và đã kiểm ở các đợt trước: đặt + thanh toán (`e2e-luong-dat-lich.js`),
và gọi → vào phòng → kết thúc (`doctor/queue.controller.js`). **Mắt xích giữa thì đứt.**

---

## 2. Ba lỗ hổng tìm được

### G1 — Lễ tân check-in KHÔNG tạo hàng đợi (P0, làm đứt hẳn chuỗi)

`PATCH /api/receptionist/appointments/:id/arrived` chỉ làm hai việc:

```js
appointment.status = 'checked_in'
appointment.gio_den_thuc_te = new Date()
```

Không tạo `HangDoi`. Nhưng hàng đợi của bác sĩ (`GET /api/doctor/queue`) **neo trên
collection `HangDoi`**, không đọc `LichHen.status`. Hệ quả:

> Bệnh nhân đặt online, thanh toán đủ, tới quầy, lễ tân bấm "đã đến" — và **không bao giờ
> xuất hiện** trong hàng đợi của bác sĩ. Bác sĩ không có cách nào tiếp nhận họ.

Nặng hơn: rule mục 8 định nghĩa `no_show` = "hết ca mà **không có bản ghi `HangDoi`**". Người
đã bước chân tới quầy vẫn bị coi là không đến → **mất 100% tiền** (mục 5). Đúng điều rule cấm:
*"Đã bước chân tới quầy (có HangDoi) thì không bao giờ thành `no_show`."*

Đồng thời vi phạm mục 7: *"Lễ tân & y tá dùng **chung 1 service check-in** — không mỗi vai trò
một luồng."* Thực tế đang có hai luồng, và chỉ một luồng đúng.

### G2 — Bác sĩ không có đường tiếp nhận khách đã đặt (P0)

Backend `POST /api/doctor/queue/checkin` có sẵn nhánh `appointment_id`, nhưng giao diện
`DoctorExamQueue.tsx` chỉ gọi nhánh khách vãng lai (tên + SĐT). **Không có nút nào** gửi
`appointment_id`. Cộng với G1: lượt online **không có bất kỳ đường nào** vào hàng đợi qua UI.

### G3 — Không có gì đặt `no_show` (P0)

Model `LichHen` có `status: 'no_show'` và `no_show_confirmed_at`, nhưng **không một dòng code
nào ghi hai field đó**. Kết quả: lịch của khách không đến treo `confirmed` vĩnh viễn, lẫn vào
danh sách chờ khám ngày này qua ngày khác; thống kê "tỉ lệ không đến" luôn bằng 0.

Thứ tự sửa quan trọng: **phải vá G1 trước G3.** Làm G3 trước sẽ đánh `no_show` đúng những
người đã tới quầy nhưng chưa có `HangDoi` vì lỗi G1 — phạt oan tiền thật.

---

## 3. Đã làm

### `services/checkIn.service.js` (MỚI) — một service dùng chung

Toàn bộ nghiệp vụ tiếp nhận nằm ở đây; controller chỉ chuyển tham số và dịch lỗi. Vai trò nào
gọi chỉ khác **hai** chỗ:

| | Bác sĩ | Lễ tân |
|---|---|---|
| `vai_tro_tiep_nhan` | `doctor` | `receptionist` |
| `restrictToDoctorId` | có — chỉ bệnh nhân của mình | không — tiếp nhận cho cả phòng khám |

Ba hàm:

- `checkInLichHen()` — lịch đã đặt trước. Ghi `LichHen` + `HangDoi` trong **một transaction**.
- `checkInVangLai()` — khách đến trực tiếp, không tạo `LichHen` (mục 6: online + walk-in
  **chung một** hàng đợi, chỉ khác `nguon`).
- `layLichChoTiepNhan()` — lịch hôm nay **chưa** có trong hàng đợi, kèm ba mốc của mục 11
  (`da_toi_khung` / `con_trong_grace` / `tre_qua_grace`).

**Trạng thái sau check-in = `checked_in`** (mục 8: `da_check_in`). Nhánh bác sĩ trước đây để
nguyên `confirmed`, nên báo cáo không phân biệt được "đã tới quầy" với "đã xác nhận nhưng chưa
tới". Giá trị `checked_in` đã được 12 chỗ khác trong code dùng sẵn — không phải trạng thái mới.

Ba cải thiện chất lượng dữ liệu bác sĩ nhận được:

- **Tên bệnh nhân**: thêm nhánh dự phòng `NguoiDung.ho_ten`. Người tự đặt cho mình không có
  `member_id` lẫn `ten_khach` → trước đây hiện `'Không rõ'`.
- **Số điện thoại**: dự phòng từ tài khoản, trước chỉ đọc `so_dien_thoai_khach` (null với
  khách đăng nhập).
- **Phòng khám**: `LichHen.phong_kham` null với lịch đặt trước khi có `phong_id` ở slot
  (2026-07-26) → tra bù từ slot. Cả bác sĩ và lễ tân đều cần biết phòng để dẫn bệnh nhân.

**Cảnh báo, không chặn.** Trả về mảng `canh_bao`: chưa thanh toán, đến sớm, trễ quá grace,
ca đang quá tải. Đã có người đứng trước mặt thì không được từ chối tiếp nhận họ — thông tin
để xử lý tại quầy, không phải điều kiện.

### `services/noShowSweep.service.js` (MỚI) + cron 5′

`quetNoShowHetCa({ now, apply, soNgay })`. Bốn điều kiện loại trừ, tất cả đều là điều kiện
**an toàn** — thà bỏ sót một lịch còn hơn phạt oan một người đã tới:

1. Chỉ `pending` / `confirmed`. **Không** gồm `checked_in` — dữ liệu cũ có thể mang
   `checked_in` mà không có `HangDoi` (chính do lỗi G1). Những người đó đã tới quầy.
2. Có bản ghi `HangDoi` → miễn nhiễm vĩnh viễn (mục 8).
3. Ca chưa kết thúc → chờ. Giờ kết thúc lấy từ slot muộn nhất **cùng ca** của lịch làm việc
   thật, không dùng hằng số: bác sĩ chỉ đăng ký nửa ca thì chờ tới 17:30 là chờ vô ích.
4. Bác sĩ nghỉ (cả ngày `trang_thai_ngay != 'lam_viec'`, hoặc slot `bi_khoa_boi_nghi_phep`)
   → **không bao giờ** `no_show` (mục 8). Khách không đến vì phòng khám đã hủy ca.

`soNgay` mặc định **1 — chỉ hôm nay**. Cố ý không quét ngược lịch sử: dữ liệu tồn từ trước khi
có luồng check-in đúng sẽ bị đánh dấu hàng loạt, mỗi bản ghi là 100% tiền của một người thật.
Dọn dữ liệu cũ phải chạy tay với `soNgay` lớn hơn **sau khi đã đối chiếu**.

Mỗi lần đánh dấu ghi `NhatKyThaoTac` (`AUTO_MARK_NO_SHOW`, `vai_tro='system'`) kèm lý do, và
gửi `ThongBao` cho khách — mất tiền mà không được thông báo là cách nhanh nhất để có khiếu nại.

**Công tắc vận hành `NO_SHOW_SWEEP_ENABLED`** (mặc định `true`, thêm vào `.env.example`).
Đặt `false` trong buổi demo: lịch demo thường không ai check-in, không nên để cron âm thầm đổi
dữ liệu người khác đang trình bày. Chỉ tắt lượt quét định kỳ; gọi tay vẫn chạy.

### Hai endpoint mới

```
GET /api/doctor/queue/pending-checkin              (giới hạn theo bác sĩ đăng nhập)
GET /api/receptionist/appointments/pending-checkin (cả phòng khám)
```

Cả hai đặt **trước** `/:id` trong file route — nếu không `'pending-checkin'` sẽ khớp vào `:id`.

### Giao diện

- **`DoctorExamQueue.tsx`** — thêm bảng **"Chờ tiếp nhận"** phía trên hàng đợi: khung giờ,
  bệnh nhân, phòng, trạng thái thanh toán, tình trạng thời điểm, nút **Tiếp nhận**. Nhãn nói rõ
  người trễ *"vẫn khám, xếp sau"* — không phải "từ chối" (mục 5: trễ **không mất tiền**).
  Cảnh báo từ server hiện nguyên văn, toast để lâu hơn khi dài.
- **Lễ tân `Appointments.tsx` + `Dashboard.tsx`** — nút "đã đến" nay hiện phòng khám và các
  cảnh báo cần xử lý ngay tại quầy (trước đây gọi API rồi reload, không nói gì).

---

## 4. Một lỗi tiềm ẩn phát hiện nhờ kiểm thử

Bản đầu dùng `appt.save()`. Kiểm thử ném lỗi:

```
Lich khach (khong co member_id) phai co ten_khach
```

Dữ liệu kiểm thử của tôi thiếu `ten_khach` nên validator **đúng**. Nhưng nó phơi ra một rủi ro
thật: `LichHen.pre('validate')` kiểm cả những field mà check-in **không hề chạm**. Với một bản
ghi cũ thiếu field nào đó, `save()` ném lỗi về field **khác** → người tiếp nhận không ghi nhận
được bệnh nhân đang đứng trước mặt → cuối ca họ bị `no_show` và mất 100% tiền.

Đã đổi sang `updateOne` + `$set` bốn field trong transaction. Ghi nhận sự có mặt của một người
không được phụ thuộc vào chất lượng dữ liệu ở chỗ khác. Cùng lý do và cùng cách với
`doiTrangThaiLichHen` (đã vá 2026-07-26 cho lỗi không cho bệnh nhân vào phòng).

---

## 5. Kiểm chứng

Script thường trực: `backend/src/scripts/e2e-luong-tiep-nhan.js` — tự chặn nếu tên DB không
chứa `TEST`, tự dọn dữ liệu sau khi chạy.

```
MONGODB_URI=<db-test> TEST_API_BASE_URL=http://localhost:5199/api \
  node src/scripts/e2e-luong-tiep-nhan.js
```

**36 đạt / 0 không đạt** trên DB `DATN_VITAFAMILY_CLAUDE_TEST`:

| Nhóm | Nội dung |
|---|---|
| 1 | Trước tiếp nhận: không ở hàng đợi, CÓ ở danh sách chờ tiếp nhận, tên không phải "Không rõ" |
| 2 | Lễ tân tiếp nhận → **sinh `HangDoi`** + `checked_in` + `da_den` + `gio_den_thuc_te` |
| 3 | Bác sĩ thấy bệnh nhân trong hàng đợi, có bậc ưu tiên động, đã rời danh sách chờ |
| 4 | Tiếp nhận lần 2 → 409, vẫn 1 lượt; bác sĩ A lấy bệnh nhân bác sĩ B → 403; lịch tại nhà → 400 |
| 5 | Hết ca không tới → `no_show` + nhật ký + thông báo; **đã tới quầy → KHÔNG**; chưa hết ca → KHÔNG; slot khoá nghỉ phép → KHÔNG |
| 6 | Gọi → vào phòng (`in_progress`) → kết thúc (`waiting_record`) |
| 7 | Check-in khách vãng lai không hồi quy |

Kiểm riêng phạm vi loại trừ của nghỉ phép: ngày nghỉ chặn **cả** lịch trong ngày; ngày làm
việc mà chỉ **một** slot bị khoá thì slot đó được miễn còn slot bình thường cùng ngày **vẫn**
bị đánh dấu — chứng minh phép loại trừ đúng phạm vi, không loại trừ tất cả.

**Bộ test có sẵn: 60/64.** 4 lỗi còn lại đã xác nhận **có từ trước** khi thay đổi — chạy lại
đúng 4 lỗi đó trên code cũ (`git stash`) cho kết quả y hệt:

```
GET /doctor/appointments/pending-results -> chi tra ho so status cho_xac_nhan
PUT /doctor/appointments/:id/result -> sua so_ngay trong don thuoc phai duoc luu lai
PUT /doctor/appointments/:id/result voi thuoc=[] -> xoa het don thuoc
PATCH request-revision boi bac si KHAC -> 404
```

Frontend `tsc --noEmit`: **43 lỗi = đúng baseline**, không lỗi nào ở file mới/sửa.

Lưu ý khi chạy bộ test: fixture hardcode (`DOCTOR_ID`, `SPECIALTY_ID`) chỉ tồn tại trên **DB
chính**, nên chạy trên DB test sẽ có 21 lỗi hook — không phải hồi quy. Khi phải chạy trên DB
chính, dùng server **tắt cron** để lượt quét `no_show` không chạm lịch hẹn thật của cả nhóm.

---

## 6. Đợt bổ sung cùng ngày (sau sự cố cron)

### Sự cố: cron đánh dấu `no_show` trên DB dùng chung

Sau khi commit `c897dbf`, server dev khởi động lại và cron chạy trên **DB chính**. Hai lượt
quét (16:35 và 17:30) đánh dấu **5 lịch hẹn demo đã thanh toán** thành `no_show`.

Mã chạy **đúng rule mục 8** — hết ca, không ai check-in, bác sĩ vẫn làm việc, slot không khoá
nghỉ phép. Sai là ở **mặc định**: bật một cron ghi dữ liệu tiền theo mặc định `true` trong lúc
đang phát triển, trên DB cả nhóm đang dùng.

Hoàn tác một lần đầu **thất bại**: 5 phút sau cron đánh dấu lại, vì tiến trình đang chạy đã đọc
env lúc khởi động. Thứ tự đúng là **khởi động lại rồi mới hoàn tác** — đã làm, DB chính hiện
sạch (0 `no_show`, 0 thông báo).

**Đã sửa:**
- Mặc định đổi thành **BẬT theo `NODE_ENV=production`**, TẮT ở mọi nơi khác. Rule mục 8 nói về
  hành vi của hệ thống thật, không phải máy lập trình viên. `NO_SHOW_SWEEP_ENABLED` ghi đè cả
  hai chiều; nhận `false/0/off/no` và `true/1/on/yes`, không phân biệt chữ hoa (bản đầu chỉ so
  đúng chuỗi `'false'` nên `FALSE` vẫn **bật** — bẫy chết người với công tắc chặn mất tiền).
- `src/scripts/hoan-tac-no-show.js`: chỉ hoàn tác bản ghi **có nhật ký `AUTO_MARK_NO_SHOW`**,
  lấy trạng thái cũ từ `du_lieu_cu` (không đoán), mặc định chạy thử, luôn sao lưu JSON.

### Vá lỗ hổng xác thực route lễ tân

`routes/receptionist/index.js` trước đó chỉ có một dòng TODO. **Toàn bộ** route lễ tân gọi được
không cần token: bất kỳ ai biết URL đều hủy được lịch hẹn, dời lịch, check-in bệnh nhân, xác
nhận đã thu tiền mặt, hoặc lấy danh sách bệnh nhân kèm số điện thoại.

Nay `verifyToken` + `requireRole('receptionist', 'admin')` — khớp đúng guard của frontend
(`ProtectedRoute roles={['receptionist','admin']}`), và `axiosInstance` đã tự gắn token nên
giao diện đang có không vỡ.

### Dời lịch của lễ tân về đúng nghiệp vụ

`rescheduleAppointment` nay dùng **chung `apDungPhuongAn()`** với luồng bệnh nhân tự dời. Năm
lỗi đã vá:

| Lỗi cũ | Hậu quả | Nay |
|---|---|---|
| Không kiểm mốc `T-30'` | Khách sắp trễ nhờ lễ tân dời lúc `T-5'`, phòng khám mất trắng chỗ — đúng chiêu mục 11 dựng mốc để chặn | Chặn với `khach_yeu_cau`; `phong_kham` không bị chặn (mục 15) |
| `slots.find(gio_bat_dau === x)` lấy slot **đầu tiên** | Khung có 2 slot (TMH): slot đầu kín thì báo "đã kín" oan dù slot bên cạnh trống | Quét mọi slot trùng giờ |
| Nhận cả slot `walk_in` và slot đang giữ chỗ | Khách tự dời lấn chỗ khách tới quầy — mục 5 cấm | Loại `walk_in`, loại slot đã có lịch hẹn khác |
| Đếm hạn mức bằng `so_lan_thay_doi` | Một lần dời do **lỗi phòng khám** cũng ăn mất quyền dời của khách — trái mục 5 | Đếm `so_lan_doi_khach_yeu_cau` |
| Không ghi `ly_do_doi` | Không phân biệt được ai gây ra việc dời | Bắt buộc; `phong_kham` phải kèm lý do cụ thể |

Slot cũ chuyển `locked`, không trả pool — giữ đúng hành vi `apDungPhuongAn` đang dùng cho luồng
bệnh nhân. **Điểm cần nhóm chốt:** với lần dời do *khách yêu cầu trước `T-30'`*, mục 11 hàm ý
slot cũ **nên** được bán lại ("slot không kịp bán cho ai" là lý do dựng mốc đó), nhưng mục 15
lại nói `locked`. Hai mục nói về hai tình huống khác nhau; hiện thực đang theo mục 15 cho cả
hai. Không tự đổi vì rule đã đóng băng.

Giao diện lễ tân: thêm ô chọn **"Dời theo yêu cầu của ai?"** (khách yêu cầu / lỗi phòng khám)
kèm giải thích hệ quả; modal "hết lượt" nay có nút **"Dời do lỗi phòng khám"** thay vì chặn
cứng, và chặn theo `so_lan_doi_khach_yeu_cau` thay vì `so_lan_thay_doi`.

### Kiểm chứng đợt bổ sung

`e2e-luong-tiep-nhan.js` mở rộng lên **56/56**, thêm nhóm 0 (xác thực) và nhóm 7 (dời lịch):

```
0. khong token -> 401 | token bac si -> 403 | token le tan -> 200 | huy khong token -> 401
7. qua T-30' -> 409 | phong kham thieu ly do -> 400 | phong kham co ly do -> 200
   ly_do_doi dung | KHONG tinh han muc | slot cu -> locked
   khach yeu cau lan 1 -> 200, dem 1 lan | lan 2 -> 409
   doi vao dung khung hien tai -> 400 | khong lan walk-in -> 409 | bi chan thi lich KHONG doi
   lich su doi lich con ghi day du
```

Công tắc môi trường: 8/8 tổ hợp (`NODE_ENV` × giá trị biến, kể cả giá trị lạ → giữ mặc định).
`e2e-luong-dat-lich.js` **85/85**, bộ test có sẵn **60/64** (4 lỗi cũ), `tsc` 43 = baseline.

---

## 7. Còn thiếu / cần nhóm quyết

1. **Bậc `khan_cap`** của mục 6 vẫn chưa làm được — không có cơ chế đánh dấu ca khẩn cấp. Cần
   quyết định nghiệp vụ: ai đánh dấu, theo tiêu chí gì.
2. **Trạng thái `cho_dich_vu`** (mục 8/G6): enum đã mở, chưa có endpoint chuyển trạng thái.
3. **Giao diện còn thiếu**: trang admin duyệt phương án dời lịch (`/admin/reschedule-approvals`
   — API đã có); trang lễ tân tra mức độ còn trống (`/receptionist/booking/availability` — API
   đã có).
4. **Slot cũ khi khách tự dời**: `locked` hay trả về pool — xem phần dời lịch ở trên.
5. **`vai_tro` của `LichSuLichHen`** chưa có `'receptionist'`; hành động của lễ tân đang ghi
   `'admin'` như code cũ. Không đổi enum để tránh chạm schema của thành viên khác.
6. **Bảng "Chờ tiếp nhận" chưa được xem trên trình duyệt.** Đã kiểm hợp đồng API, kiểu
   TypeScript và đối chiếu từng trường component đọc với JSON thật, nhưng chưa render lần nào —
   vào trang bác sĩ cần đăng nhập.
