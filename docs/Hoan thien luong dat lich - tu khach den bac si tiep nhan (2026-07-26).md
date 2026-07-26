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

## 6. Còn thiếu / cần nhóm quyết

1. **Route lễ tân không có xác thực.** `routes/receptionist/index.js` còn ghi *"Bọc middleware
   kiểm tra quyền lễ tân tại đây sau"* — hiện `PATCH .../cancel`, `.../arrived` gọi được **không
   cần token**. Không sửa trong đợt này vì thuộc phần thành viên khác và việc bọc `verifyToken`
   có thể làm vỡ giao diện của họ nếu chưa gửi token. Cần xử lý sớm.
2. **`receptionist/appointment.controller.js → rescheduleAppointment`** bỏ qua gần hết mục 5/11:
   không kiểm cutoff `T-30'`, lấy slot đầu tiên trùng giờ (có thể là slot walk-in hoặc slot
   người khác đang giữ), không ghi `ly_do_doi`, dùng `so_lan_thay_doi` thay vì
   `so_lan_doi_khach_yeu_cau`. Unique index `uniq_lich_hen_theo_slot` chặn được double-book
   nhưng trả 500 chứ không phải thông báo đọc được.
3. **Bậc `khan_cap`** của mục 6 vẫn chưa làm được — không có cơ chế đánh dấu ca khẩn cấp. Cần
   quyết định nghiệp vụ: ai đánh dấu, theo tiêu chí gì.
4. **Trạng thái `cho_dich_vu`** (mục 8/G6): enum đã mở, chưa có endpoint chuyển trạng thái.
5. **Giao diện còn thiếu**: trang admin duyệt phương án dời lịch (`/admin/reschedule-approvals`
   — API đã có); trang lễ tân tra mức độ còn trống (`/receptionist/booking/availability` — API
   đã có).
