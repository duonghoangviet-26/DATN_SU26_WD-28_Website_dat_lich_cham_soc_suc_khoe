# RULE (BẤT BIẾN) — Nghiệp vụ Lịch làm việc bác sĩ / Lịch hẹn

> ⛔ **KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI nghiệp vụ này.** Đây là quy tắc đã chốt của ViteFamily.
> Mọi phân tích, thiết kế DB, API, UI về lịch làm việc / lịch hẹn / hàng đợi PHẢI tuân thủ.
> Muốn đổi quy tắc → phải được người dùng yêu cầu rõ ràng, không tự suy diễn.
> Chi tiết đầy đủ: `docs/Lịch làm việc bác sĩ.md`.
> Phân tích lỗ hổng + căn cứ của mục 11–15: `docs/Phan tich lo hong luong dat lich Online-Offline (2026-07-25).md`.

## 1. Ba tầng thời gian — bắt buộc phân biệt
`CA → KHUNG GIỜ (30 phút) → SLOT (1 slot = 1 bệnh nhân)`
- Ca sáng 08:00–11:30 = **7 khung**; ca chiều 13:30–17:30 = **8 khung**. Nghỉ trưa 11:30–13:30.
- Khung giờ = đơn vị bệnh nhân chọn khi đặt online. Slot = đơn vị đặt nhỏ nhất.
- Mỗi khung chứa **NHIỀU slot** theo chuyên khoa. **Không** đánh đồng slot = khung.

## 2. Cấu hình theo chuyên khoa
- `Số slot/khung = floor(30 / thời gian khám TB)` — **luôn làm tròn XUỐNG** (an toàn, không lấy lạc quan).
- TMH (hiện tại): thời gian khám 10–15′ → **2 slot/khung**. Sáng 14 / chiều 16 / ngày 30.
- Thêm chuyên khoa mới = cấu hình 5 giá trị (tên, TG khám, slot/khung, %online, **giá khám**). **Không sửa code logic.**

## 3. Bác sĩ KHÔNG full-time
- Bác sĩ đăng ký **theo CA**, không theo ngày. Admin chưa tạo lịch ngày/ca nào → không hiển thị đặt online ngày/ca đó.
- **1 phòng = 1 bác sĩ / ca.** **1 bác sĩ = 1 phòng / ca.**
- Bác sĩ nghỉ đột xuất → admin đổi trạng thái → thông báo bệnh nhân đã đặt. Xử lý bệnh nhân **đã trả tiền**: thang 3 bước ở **mục 14**.

## 4. Online vs Walk-in — phân theo TỪNG KHUNG
- Mỗi khung tách slot **online** và **walk-in**. Quota mặc định **online 70% / walk-in 30%** capacity ca, phân **xen kẽ**.
- Walk-in (`nguon='tai_cho'`) **không chiếm** slot online; chỉ vào slot walk-in trống.
- Bệnh nhân đặt online **chỉ thấy slot online còn trống**.
- **Quota là chính sách giữ chỗ CÓ THỜI HẠN, không phải vách ngăn cứng** (chốt 2026-07-25). Hai chiều giải phóng:
  1. **Online → walk-in (tự động):** tới mốc `T-30'` của khung, slot online chưa bán **tự chuyển** thành walk-in. Thực thi **lazy lúc đọc lịch** + cron 5' quét bù; mỗi lần chuyển phải ghi nhật ký.
  2. **Walk-in KHÔNG bao giờ chảy ngược:** trước cutoff, khách tới quầy không được lấy slot online của khung hiện tại. Bù lại được xếp vào slot walk-in **khung kế tiếp**; mọi khung đã qua cutoff mở hết.
- **Trần overbook = 0.** Hết slot walk-in của mọi khung còn lại trong ca → từ chối rõ ràng kèm gợi ý khung trống gần nhất. Không có "nhận đại rồi tính sau".

## 5. Đặt online
- **1 lượt / CHUYÊN KHOA / ngày / người được khám** — tính theo `member_id` (người được khám), **KHÔNG** theo `user_id`, vì 1 tài khoản đặt cho cả gia đình. (Sửa 2026-07-25: giới hạn cũ theo *bác sĩ* vô nghĩa khi hệ thống tự gán bác sĩ — xem mục 12.)
- Tối đa **1 slot `pending_payment` đang hoạt động** / người được khám. Đặt mới → hủy giữ chỗ cũ ngay.
- Thanh toán **100%** khi đặt.
- ⛔ **KHÔNG HOÀN TIỀN trong mọi trường hợp** (chốt 2026-07-25 — thay thế quy định hoàn 100% trước đây). Tiền chỉ được bảo toàn dưới dạng **quyền dời lịch**:

  | Tình huống | Xử lý |
  |---|---|
  | Đến trong grace (`T` → `T+15'`) | Khám, giữ ưu tiên online |
  | Trễ > 15' nhưng còn trong ca | Khám, tụt xuống mức `offline`, **KHÔNG mất tiền** |
  | Đã check-in, hết ca chưa được gọi | Dời lịch, **KHÔNG mất tiền**, không tính hạn mức |
  | Hết ca không đến | `no_show`, **mất 100%** |
  | Khách chủ động hủy | **Mất 100%** |
  | Khách xin dời (phải trước `T-30'`) | Được **1 lần duy nhất** |
  | Lỗi phòng khám | Dời **tùy tình huống**, không tính hạn mức |

- `ly_do_doi` là trường **bắt buộc** (`khach_yeu_cau` \| `phong_kham`) — đếm hạn mức riêng cho từng loại. Giá trị `phong_kham` phải kèm người duyệt + lý do, ghi nhật ký.
- Lịch dời **được ưu tiên hơn đặt mới** trên slot online, nhưng **không được lấn** slot walk-in.
- **Không có bằng chứng khách đồng ý điều khoản không hoàn tiền thì KHÔNG được thu tiền** — bắt buộc checkbox trước thanh toán, lưu `dieu_khoan_version` + thời điểm đồng ý vào `LichHen`.

## 6. Hàng đợi (HangDoi) — ĐÃ ĐÚNG, GIỮ NGUYÊN
- `HangDoi` **chỉ tạo khi check-in** (online + walk-in **chung 1 hàng đợi**). Chưa đến → không có trong hàng đợi.
- **Không lưu `thu_tu`** — tính động lúc query (`muc_uu_tien` → `checkin_time`).
- Ưu tiên: khẩn cấp > `online_uu_tien` > `online_thuong` > `offline`. Định nghĩa **chính xác** 3 bậc (chốt 2026-07-25 — thay cách tính cửa sổ `±30′` cũ):
  - `online_uu_tien` — online, **đã tới khung của mình** (`now ≥ T`) và check-in **≤ `T+15'`**.
  - `online_thuong` — online, đã check-in nhưng **chưa tới khung của mình** (đến sớm). Tới `T` thì **tự động lên** `online_uu_tien`. Đến sớm chỉ phải chờ tới lượt khung của mình, **không bị phạt**.
  - `offline` — walk-in, **hoặc** online check-in **sau `T+15'`**.
- Xong sớm → gọi bệnh nhân khung sau; xong muộn → khung sau chờ (đã có buffer).
- **Bậc ưu tiên tính ĐỘNG lúc query, không lưu cứng lúc check-in** (chốt 2026-07-25). `muc_uu_tien` lưu cứng là sai — nó phạt oan người đến sớm: check-in sớm hơn 30′ hiện bị tụt xuống `online_thuong`, xếp sau người check-in muộn hơn. **Đến sớm KHÔNG bị phạt.**
- Đến sớm vẫn **không được gọi trước đầu khung của mình**, trừ khi bác sĩ rảnh và không còn ai thuộc khung hiện tại.
- **Aging chống bỏ đói:** chờ quá **2 khung (60′)** → tự nâng **1 bậc** ưu tiên. Nếu không, khách vãng lai có thể chờ tới trưa vì khách online check-in liên tục chèn lên trên.
- **Overflow control theo độ trễ tích luỹ của ca** (ngưỡng là cấu hình, không hardcode):
  - Trễ ≥ **1 khung (30′)** → ngừng bán slot walk-in cho các khung còn lại của ca + cảnh báo lễ tân.
  - Trễ ≥ **2 khung (60′)** → chặn cả đặt online vào các khung còn lại của ca đó; khách mới điều sang bác sĩ khác / ngày khác.

## 7. Ràng buộc dữ liệu bất biến
- Mỗi slot ↔ tối đa **1** `LichHen`. Mỗi `LichHen` ↔ tối đa **1** `HangDoi` đang hoạt động.
- Kiểm tra capacity phải **nguyên tử** — 2 lễ tân thao tác đồng thời không được vượt trần.
- Check-in đi qua **duy nhất 1 service** — không mỗi vai trò một luồng.
- Hệ thống chỉ có **4 vai trò**: khách hàng · bác sĩ · lễ tân · admin.
  **KHÔNG có vai trò y tá.** Phần việc thường gán cho y tá (check-in, sinh hiệu)
  do lễ tân và bác sĩ đảm nhiệm.
- Mô hình hiện thực: **giữ `slots[]` embedded trong `LichLamViec`** (Lựa chọn A), thêm `khung_index` + `loai_slot`; KHÔNG đại phẫu tách collection trừ khi được yêu cầu.

## 8. Trạng thái bệnh nhân (canonical)
`chua_den → da_check_in → trong_phong → (cho_dich_vu) → hoan_thanh` | `no_show` (**chỉ online**) | `da_huy`.
- ⛔ `no_show` **CHỈ được đặt TỰ ĐỘNG** khi kết thúc ca **và** không tồn tại bản ghi `HangDoi` cho lịch hẹn đó. Lễ tân/bác sĩ **KHÔNG được set tay** — vì `no_show` đồng nghĩa mất 100% tiền (mục 5).
- Đã bước chân tới quầy (có `HangDoi`) thì **không bao giờ** thành `no_show`, dù trễ bao lâu.
- Lịch hẹn thuộc ca có bác sĩ nghỉ **không bao giờ** được tự động chuyển `no_show`.

## 9. Trạng thái đồng bộ với code (2026-07-23, cập nhật 2026-07-26)
- ĐÃ ĐẠT (không đổi): `HangDoi`, giữ slot `pending_payment`.
- ✅ **4 lỗi P0 ĐÃ SỬA 2026-07-26** (chi tiết + kiểm chứng: `docs/Trien khai L14 + rang buoc slot (2026-07-26).md`):
  - ~~Nghiệp vụ 70/30 không chạy~~ → khôi phục 4 field cấu hình vào `models/ChuyenKhoa.js` + `utils/slotConfig.js` (nguồn duy nhất cho phép tính) + migration `010`. **Lưu ý: dữ liệu trong DB KHÔNG mất — chỉ model mất field.** Đã kiểm chứng lịch sinh ra đúng 2 slot/khung, sáng 14 (10 online) / chiều 16 (11 online) / ngày 30.
  - ~~Lệch múi giờ 7 tiếng~~ → `utils/clinicTime.js` dùng chung (đã xong 2026-07-25).
  - ~~Claim slot sai phần tử mảng~~ → gói vào **một `$elemMatch`** ở cả `patient/booking.controller.js` và `receptionist/booking.controller.js`.
  - ~~Không chặn trùng lượt~~ → `createBooking` nay nhả giữ chỗ cũ **trước**, rồi mới đếm 1 lượt/chuyên khoa/ngày/`member_id`.
  - Ràng buộc 1 slot ↔ 1 `LichHen` nay có **unique partial index** `uniq_lich_hen_theo_slot` ở tầng DB (`$type: 'objectId'` + `status $in`, cần MongoDB ≥ 5.3 — cluster đang chạy 8.0.28).
- ⚠️ **CHƯA CHẠY trên DB nhóm:** `dedupe-slot-appointments.js --apply` (gỡ 5 cặp trùng, bắt buộc trước khi index build được) và migration `010`.
- Còn lại P2: đánh giá bác sĩ tạo được khi chưa `completed` (chỉ cho review lịch `status='completed'`).
- Chính sách **hoàn tiền đã bị bãi bỏ** (mục 5) — mọi nhánh `HoanTien` trong luồng đặt lịch không còn hiệu lực. **Đổi lịch ≤3 → 1 lần** cho khách yêu cầu.
- ✅ **Mục 13 ĐÃ TRIỂN KHAI 2026-07-26**: `services/walkInWindow.service.js` — quầy chỉ nhận **hôm nay**, chỉ slot `walk_in`, chỉ khung đang diễn ra + kế tiếp **cùng ca** (ngoài giờ/nghỉ trưa → đúng khung sắp tới). Kiểm ở cả `getSlots` lẫn `createBooking`. `GET /receptionist/booking/availability` trả **mức độ** (còn nhiều/còn ít/đã đầy), không trả con số, có ghi nhật ký.
- ✅ **Mục 12 ĐÃ TRIỂN KHAI 2026-07-26**: `services/doctorAssignment.service.js` — `GET /patient/booking/specialties/:id/slots` (khung gộp toàn chuyên khoa + **giá hiển thị trước khi giữ chỗ**); `createBooking` nhận `specialty_id` + `gio_bat_dau` để tự gán, thứ tự **xác định** (tái khám → ít lịch nhất trong ca → `doctor_id` tăng dần). Đường chọn đích danh bác sĩ **giữ nguyên**. Giá lấy từ `ChuyenKhoa.gia_kham` ở **cả** luồng client lẫn lễ tân; `BacSi.gia_kham` không còn dùng để tính tiền.
- ✅ **Mục 14/15 ĐÃ TRIỂN KHAI 2026-07-26**: `services/appointmentReschedule.service.js` + `LichHen.de_xuat_doi` (nhúng, KHÔNG tạo bảng mới, KHÔNG đụng `NghiPhepBacSi`). Duyệt đơn nghỉ tự sinh phương án theo thang mục 14 và **giữ sẵn chỗ** phương án 1. Khách đã thanh toán → `cho_admin_duyet`; chưa thanh toán → báo khách ngay. Slot cũ `locked` không trả pool; lấn walk-in **chỉ khi lỗi phòng khám**, trần 1 slot/khung. Cron áp phương án giữ sẵn khi khách quá hạn phản hồi. `ly_do_doi='phong_kham'` không tính hạn mức; khách tự dời **1 lần**, chặn sau `T-30'`. Bắt buộc `dong_y_dieu_khoan` trước khi giữ chỗ.
- ✅ **Mục 15 NÂNG CẤP 2026-08-22** (chi tiết: `docs/superpowers/specs/2026-08-22-dieu-phoi-bac-si-nghi-dot-xuat-v2-design.md`, local-only): `sinhPhuongAnDoi()` gộp thành một vòng lặp duy nhất, sắp theo độ lệch phút tuyệt đối tăng dần (tie-break giữ bác sĩ cũ), thay cho thứ tự bước-1/bước-2 cứng cũ. Thêm `PHUT_DEM_DOI_LICH_TOI_THIEU=15` + `quaSatGioBatDau()` trong `utils/clinicTime.js` — loại mọi ứng viên bắt đầu trong 15' tới, kể cả loại giữ giờ. Route `/api/admin/reschedule-approvals` mở thêm `requireRole('receptionist')`, cùng router mount thêm dưới `/api/receptionist/reschedule-approvals` — trước đây chỉ admin duyệt được nhưng không có UI admin nào gọi, đề xuất bị kẹt tới khi cron tự áp sau `GIO_HAN_PHAN_HOI_ADMIN`. Thêm `chonPhuongAnTuDo()` + endpoint `PATCH .../:id/chon-tay` cho chọn tay tự do (tái dùng `apDungPhuongAn()`, không thêm field DB). UI: `DoctorDayView.tsx` (lễ tân) thêm bộ lọc theo bác sĩ; `DoctorUnavailableModal.tsx`/`DoctorLeaveApprovalModal.tsx` thêm nút "Duyệt"/"Chọn khác" cho case `cho_admin_duyet` (component `RescheduleNeedsApprovalList.tsx` + `ChonKhacPanel.tsx`).
- ✅ **Mục 6 ĐÃ TRIỂN KHAI 2026-07-26**: bậc ưu tiên tính **động** lúc query (`tinhBacUuTienDong` trong `models/HangDoi.js`) — `muc_uu_tien` trong DB nay chỉ là **snapshot lúc check-in**, đánh dấu deprecated, KHÔNG dùng để sắp xếp. Aging 60′ chỉ nâng `offline → online_thuong` (nâng `online_thuong` lên nữa sẽ cho người đến sớm được gọi trước đầu khung, trái ràng buộc cùng mục). Chặn gọi người đến sớm khi còn người đã tới lượt. Overflow control 2 nấc (`services/queueOverflow.service.js`): trễ ≥30′ ngừng bán walk-in, ≥60′ chặn cả đặt online; ngưỡng đọc từ env. CHƯA làm: bậc `khan_cap` (chưa có cơ chế đánh dấu).
- ✅ **Mục 11 ĐÃ TRIỂN KHAI 2026-07-26** (phần mốc thời gian): mọi mốc gom về `utils/clinicTime.js` (`cacMocCuaKhung`, `daQuaCutoffOnline`, `hanGiuChoCoGian`). Cutoff `T-30'` tự chuyển slot online chưa bán → walk-in, chạy **lazy lúc đọc lịch** (`donDepSlotTruocKhiDoc`) + **cron 5′** quét bù, có ghi nhật ký. Giữ chỗ **co giãn** `min(15', T-15' − now)`. `createBooking` chặn đặt sau cutoff bằng **mốc thời gian**, không dựa vào trạng thái dữ liệu. CHƯA làm: hạn chót xin dời lịch tại `T-30'` (luồng dời lịch chưa tồn tại).
- ✅ **Mục 3 ĐÃ TRIỂN KHAI 2026-07-26**: `MauLichLamViec` + generator đọc mẫu + API/UI admin "Lịch trực tuần" + `phong_id` ở cấp slot + migration `011` seed mẫu giữ nguyên hành vi cũ. Kiểm chứng: bác sĩ không có mẫu → không sinh lịch; bỏ ca chiều → chỉ sinh 14 slot ca sáng; xếp 2 bác sĩ cùng phòng/ca → 409.
- ✅ **Mục 7 (check-in dùng chung) + mục 8 (`no_show` tự động) ĐÃ TRIỂN KHAI 2026-07-26** (chi tiết: `docs/Hoan thien luong dat lich - tu khach den bac si tiep nhan (2026-07-26).md`):
  - ~~Lễ tân check-in KHÔNG tạo `HangDoi`~~ → `services/checkIn.service.js` là **service duy nhất**; cả `doctor/queue.controller.js` và `receptionist/appointment.controller.js` gọi nó. Trước đó `markAsArrived` chỉ đổi `LichHen.status` nên bệnh nhân đã thanh toán, đã tới quầy **không bao giờ** hiện trong hàng đợi bác sĩ — và cuối ca còn bị tính `no_show` (mất 100% tiền, trái mục 8).
  - Trạng thái sau check-in chuẩn hoá về **`checked_in`** (canonical `da_check_in`); nhánh bác sĩ trước đây để nguyên `confirmed`.
  - ~~Không có gì đặt `no_show`~~ → `services/noShowSweep.service.js` + cron 5′. **Chỉ tự động**, chỉ khi hết ca, chỉ khi không có `HangDoi`; **loại trừ** `checked_in`, lịch có `HangDoi`, ca bác sĩ nghỉ (cả ngày hoặc slot `bi_khoa_boi_nghi_phep`). Mặc định **chỉ quét hôm nay** (`soNgay=1`) — không quét ngược lịch sử. Có nhật ký `AUTO_MARK_NO_SHOW` + thông báo cho khách. Công tắc `NO_SHOW_SWEEP_ENABLED=false` để tắt khi demo.
  - Giao diện: bảng **"Chờ tiếp nhận"** ở `DoctorExamQueue.tsx` + hai endpoint `GET .../pending-checkin` (bác sĩ và lễ tân). Trước đó UI chỉ có nhánh check-in khách vãng lai, lượt online không có đường nào vào hàng đợi.
  - Kiểm chứng: `src/scripts/e2e-luong-tiep-nhan.js` — 36/36.
- ✅ **Xác thực route lễ tân + dời lịch của lễ tân ĐÃ SỬA 2026-07-26**:
  - ~~Route lễ tân không cần token~~ → `verifyToken` + `requireRole('receptionist','admin')` ở `routes/receptionist/index.js`, khớp guard frontend. Trước đó ai biết URL cũng hủy được lịch, dời lịch, xác nhận thu tiền mặt, lấy danh sách bệnh nhân kèm SĐT.
  - ~~`rescheduleAppointment` không tuân mục 5/11~~ → dùng **chung `apDungPhuongAn()`** với luồng bệnh nhân. Vá 5 lỗi: không kiểm `T-30'`; lấy slot đầu tiên trùng giờ (khung nhiều slot → báo "đã kín" oan); nhận cả slot `walk_in`/đang giữ chỗ; đếm hạn mức bằng `so_lan_thay_doi` (làm lần dời do lỗi phòng khám ăn mất quyền của khách); không ghi `ly_do_doi`. `ly_do_doi='phong_kham'` bắt buộc kèm lý do cụ thể, không áp mốc `T-30'` (mục 15).
  - UI lễ tân: ô chọn "Dời theo yêu cầu của ai?", modal hết lượt có nút "Dời do lỗi phòng khám", chặn theo `so_lan_doi_khach_yeu_cau`.
- ⚠️ **Cron `no_show` mặc định CHỈ BẬT khi `NODE_ENV=production`** (đổi 2026-07-26 sau sự cố: cron chạy trên DB dùng chung đánh dấu 5 lịch demo đã thanh toán thành `no_show`). Rule mục 8 nói về hành vi hệ thống THẬT, không phải máy dev. Ghi đè bằng `NO_SHOW_SWEEP_ENABLED`. Hoàn tác bằng `src/scripts/hoan-tac-no-show.js`.
- CÒN THIẾU (theo Gap G1–G7 trong doc): trạng thái `cho_dich_vu`.
- ❓ **Cần chốt:** slot cũ khi **khách tự dời trước `T-30'`** nên `locked` (mục 15) hay trả về pool để bán lại (hàm ý của mục 11)? Hai mục nói về hai tình huống khác nhau; hiện thực đang theo mục 15 cho cả hai.
- Khi triển khai: ưu tiên **P0** (thêm field cấu hình `ChuyenKhoa`) → P1 → P2, có migration, **không phá dữ liệu/demo**.

## 10. Bảng & field DB BẮT BUỘC cho nghiệp vụ này
> Kết quả phân tích DB (2026-07-23): DB hiện tại **KHÔNG đủ** — cần các thay đổi dưới đây.
> Chi tiết + migration: `docs/Phan tich DB - Lich lam viec bac si (2026-07-23).md`.

**A. Thêm field vào collection có sẵn:**
- `chuyen_khoa` **(P0 — triển khai 2026-07-23 nhưng ⚠️ ĐÃ MẤT sau khi merge `main`, commit `ca685dc`; phải khôi phục — xem mục 9)**: `thoi_gian_kham_trung_binh_phut` (default 15), `so_slot_moi_khung` (default null = tự tính `floor(30/TG)`, admin chỉ được override XUỐNG thấp hơn mức an toàn — enforce ở `pre('validate')` trong `ChuyenKhoa.js`), `ty_le_online_phan_tram` (default 70). Đã cập nhật: model, `specialties.controller.js` (create/update), `clinic-info.controller.js` (legacy alias create/update), form admin `AddSpecialty.tsx`/`EditSpecialty.tsx`, `SpecialtyItem` type, seed `seed-all.js`, script backfill `backfill-chuyen-khoa-slot-config.js` cho dữ liệu cũ.
- `lich_lam_viec` **(Phase 1A — ✅ ĐÃ TRIỂN KHAI 2026-07-23)**: slot-level `khung_index` (Number, nhóm nhiều slot cùng khung 30') + `loai_slot` (enum `online|walk_in`, quota phân bổ xen kẽ qua `phanBoOnlineTheoKhung()`). **CHƯA làm**: `ca` + `phong_id` cấp lịch (Phase 1B — xem inventory 9 file phụ thuộc bên dưới, cần plan riêng).
- `hang_doi` **(P2)**: thêm enum `cho_dich_vu` vào `trang_thai`.
- `lich_hen` **(P2)**: thêm `cho_dich_vu` vào `status`. (`nguon` đã chuyển thành **bắt buộc** — xem mục D bên dưới.)

**B. Bảng MỚI:**
- `mau_lich_lam_viec` (MauLichLamViec) **(P1 — ✅ ĐÃ TRIỂN KHAI 2026-07-26)** — mẫu đăng ký ca theo tuần của bác sĩ (nguồn để generator sinh lịch, thay cho auto full-day). Fields: `bac_si_id, thu_trong_tuan(0-6), ca, phong_id, chuyen_khoa_id, trang_thai, hieu_luc_tu, hieu_luc_den`. Kèm API `/api/admin/schedule-templates` + trang admin "Lịch trực tuần".

**C. Index / migration:**
- **Ràng buộc `1 phòng = 1 BS/ca` và `1 BS = 1 phòng/ca` gác ở `mau_lich_lam_viec`, KHÔNG gác ở `lich_lam_viec`** (chốt 2026-07-26). Mẫu là **nguồn** đăng ký, lịch làm việc chỉ là **hệ quả** được sinh ra — chặn ở nguồn thì lịch sinh ra không bao giờ vi phạm. Gác ở lịch sẽ buộc phải tách mỗi bản ghi ngày thành 2 bản ghi ca, đại phẫu chạm ~9 chỗ đang giả định "1 lịch / bác sĩ / ngày" (`queue.controller`, `stats.controller`, `room-status.controller`, `slots.controller`, generator, seed…) — trái điều khoản "KHÔNG đại phẫu" ở mục 7. Vì vậy **GIỮ NGUYÊN** unique `(doctor_id, ngay)` trên `lich_lam_viec`; `phong_id` nằm ở cấp **SLOT** (phòng gắn với CA, không gắn với NGÀY — bác sĩ có thể sáng phòng 101, chiều phòng 102).
- Kiểm chồng lấn khoảng hiệu lực (`hieu_luc_tu`/`hieu_luc_den`) phải làm ở **service** — `partialFilterExpression` của unique index không diễn tả được khoảng thời gian. Dùng `timMauXungDot()` trong `models/MauLichLamViec.js`, cùng cách `NghiPhepBacSi` chặn trùng đơn.
- ✅ `scheduleGenerator.service.js`: sinh lịch theo `mau_lich_lam_viec` + số slot/khung theo `chuyen_khoa`, **KHÔNG** còn auto full-day. Bác sĩ chưa được xếp ca → không sinh lịch (`reason: 'khong_dang_ky_ca'`).

**D. Field BẮT BUỘC cho mục 11–15 (chốt 2026-07-25):**
- `chuyen_khoa`: `gia_kham` (giá niêm yết dùng cho luồng tự gán — mục 12).
- `lich_hen`: `nguon` (enum `online|tai_cho`); `ly_do_doi` (enum `khach_yeu_cau|phong_kham`, bắt buộc khi dời); `so_lan_doi_khach_yeu_cau` (đếm riêng, trần **1**); `dieu_khoan_version` + `dieu_khoan_dong_y_luc` (bằng chứng đồng ý điều khoản không hoàn tiền — không có thì KHÔNG được thu tiền).
- `bac_si`: `hang_bac_si` — **chỉ thêm khi mở rộng** phân hạng giá (mục 12). TMH hiện tại 1 giá, chưa cần.
- Index: unique **partial** `{schedule_id: 1, slot_id: 1}` với `status != 'cancelled'` — ràng buộc 1 slot ↔ 1 `LichHen` (mục 7) hiện chỉ tồn tại trong code.

**KHÔNG tách** collection `KhungGio`/`Slot` riêng — giữ `slots[]` embedded (Lựa chọn A), khung giờ = nhóm theo `khung_index`.
**KHÔNG đụng** `HangDoi` (đã đúng), `NghiPhepBacSi`, `KhachVangLai`, `CauHinhPhongKham`, `PhongKham`.

---

## 11. MỐC THỜI GIAN của một khung (chốt 2026-07-25) — BẤT BIẾN

Khung bắt đầu lúc `T`. Mọi mốc tính theo giờ `Asia/Ho_Chi_Minh`.

| Mốc | Sự kiện |
|---|---|
| `T-30'` | **Đóng đặt online.** Slot online chưa bán → chuyển walk-in. **Cũng là hạn chót xin dời lịch** |
| `T-15'` | Hạn chót mọi giữ chỗ chờ thanh toán của khung này |
| `T` → `T+15'` | **Grace.** Khách online giữ ưu tiên `online_uu_tien` |
| `T+15'` → hết ca | Trễ: vẫn khám, tụt xuống mức `offline`, **không mất tiền** |
| Hết ca chưa đến | `no_show`, mất 100% |

- **Giữ chỗ chờ thanh toán CO GIÃN:** `min(15', T-15' − now)`. Slot bỏ dở luôn được nhả **trước** cutoff — không bao giờ chết qua cutoff rồi mới nhả khi lễ tân đã hết quyền bán.
- **Nhả slot quá hạn phải LAZY** (ngay lúc có ai đọc lịch) + cron **5′** làm lưới an toàn. Cron 15′ ăn hết nửa cửa sổ bán lại → không chấp nhận.
- **Dời lịch chỉ được thực hiện trước `T-30'` của khung cũ.** Chặn chiêu né mất tiền: khách thấy sắp trễ bấm dời lúc `T-5'` → slot không kịp bán cho ai, phòng khám mất trắng chỗ.
- 15′ grace = **nửa khung**. Trễ hơn nửa khung thì bệnh nhân khung sau đã tới — giữ ưu tiên cho người trễ là bất công với họ.

## 12. Tự gán bác sĩ + giá khám (chốt 2026-07-25)

- **Mặc định: bệnh nhân chọn chuyên khoa + ngày + khung giờ, hệ thống TỰ GÁN bác sĩ.** Vẫn **giữ** đường "chọn đích danh bác sĩ" cho tái khám / khách có nguyện vọng riêng. Không bỏ luồng chọn bác sĩ đang có.
- **Thứ tự gán XÁC ĐỊNH (deterministic), KHÔNG random** — để kiểm thử lặp lại được:
  1. Bác sĩ đã khám cho bệnh nhân này gần nhất, nếu còn slot online cùng khung (giữ mạch tái khám).
  2. Bác sĩ có ít lịch nhất trong ca.
  3. Tie-break theo `doctor_id` tăng dần.
- **GIÁ KHÁM = 1 giá duy nhất theo CHUYÊN KHOA** (`ChuyenKhoa.gia_kham`). `BacSi.gia_kham` giữ lại như field kỹ thuật nhưng **KHÔNG dùng để tính tiền** — tự gán mà giá nhảy theo bác sĩ sẽ sinh khiếu nại "sao người kia khám rẻ hơn tôi".
- Giá phải hiển thị **TRƯỚC** khi giữ chỗ.
- **Khi mở rộng nhiều chuyên khoa / phân hạng bác sĩ:** thêm `hang_bac_si` (enum) + bảng giá **theo hạng công khai** (chuẩn ngành: BV Việt Đức 2 bậc, Bạch Mai 3 bậc, hợp pháp theo TT 13/2023/TT-BYT — phân theo *trình độ chuyên môn*, KHÔNG theo từng cá nhân tuỳ hứng). Kèm luật **NÂNG HẠNG MIỄN PHÍ**: nếu chỉ còn bác sĩ hạng cao hơn rảnh, khách được khám hạng cao với **giá đã báo**. Tự gán **không bao giờ** tính cao hơn giá khách đã thấy.

## 13. Lễ tân — KHÔNG nhận đặt hộ (chốt 2026-07-25)

- ⛔ **Không nhận đặt lịch qua điện thoại.** Khách gọi tới, lễ tân **chỉ tra cứu và báo MỨC ĐỘ** còn trống: "còn nhiều / còn ít / đã đầy", kèm cảnh báo **không giữ chỗ**. Không trả về con số chính xác — con số thành lời hứa, khách tới nơi hết chỗ sẽ khiếu nại. Ghi nhật ký cuộc tra cứu để đối chiếu.
- Lý do: khách đặt qua điện thoại không thanh toán trước → tỉ lệ không đến cao → giữ chỗ gần như công cốc.
- **Ràng buộc kỹ thuật để chính sách không bị lách** (hiện code đang hở, xem mục 9): lễ tân chỉ tạo được lượt cho **khung đang diễn ra hoặc khung kế tiếp trong cùng ca của HÔM NAY**, và **chỉ vào slot `loai_slot='walk_in'`**. Không được chạm slot online, không được chọn ngày tương lai.

## 14. Bác sĩ nghỉ đột xuất khi khách đã trả tiền — thang 3 bước

1. Tự tìm bác sĩ **cùng chuyên khoa còn slot online cùng khung** → chuyển, **giữ nguyên giá**, thông báo.
2. Không có → đề nghị khung/ngày gần nhất, tiền giữ nguyên.
3. Khách không đồng ý mốc nào → **giữ quyền dời mở**, KHÔNG hoàn tiền (mục 5).

Lần dời này mang `ly_do_doi='phong_kham'`, **KHÔNG tính** vào hạn mức 1 lần của khách.

## 15. Bác sĩ bận MỘT KHUNG (không nghỉ cả ca) — chốt 2026-07-25, sửa 2026-08-22

Khác với mục 14 (nghỉ cả ca/ngày). VD: bác sĩ bận 10:00, muốn đẩy khách sang 13:30.

**Phân quyền (sửa 2026-08-22):**
- Khung **chưa có ai đặt** → bác sĩ **tự khoá**, không cần duyệt.
- Khung **đã có khách đã thanh toán** → bác sĩ **tạo yêu cầu**, hệ thống tự đề xuất phương án, **lễ tân hoặc admin duyệt** rồi mới thông báo khách. Tiền của khách không để một người tự định đoạt. (Trước 2026-08-22 chỉ Admin duyệt được, nhưng không có giao diện Admin nào gọi tới bước duyệt này — đề xuất bị kẹt tới khi cron tự áp sau hạn `GIO_HAN_PHAN_HOI_ADMIN`. Mở thêm cho lễ tân vì phòng khám quy mô nhỏ, lễ tân là người trực tiếp xử lý toàn bộ luồng báo nghỉ/liên hệ khách — giữ một tầng duyệt riêng cho Admin mà không có UI tương ứng chỉ tạo độ trễ, không tăng thêm kiểm soát thực tế. Tiền lệ: quyết định 2026-08-14 đã gỡ "Biên bản ca khẩn" với cùng lý do.)

**Thứ tự đề xuất phương án (sửa 2026-08-22 — thay thế thứ tự bước-1/bước-2 cũ):**
Gộp MỘT danh sách ứng viên (mọi bác sĩ cùng chuyên khoa còn slot trống trong ngày × mọi khung giờ, kể cả chính bác sĩ cũ và kể cả giữ nguyên giờ gốc), sắp theo **độ lệch phút tuyệt đối** so với khung gốc — **tăng dần**. Lệch bằng nhau thì ưu tiên **giữ bác sĩ cũ** (khách quen bác sĩ). Không còn phân biệt cứng "đổi người trước, đổi giờ sau" — mục tiêu là giảm tối thiểu sai lệch khung giờ thực tế cho khách, để khách không phải chờ quá xa giờ đã hẹn.

Thêm **ngưỡng đệm tối thiểu 15 phút**: không đề xuất bất kỳ slot nào bắt đầu trong vòng 15 phút tới, kể cả loại "giữ nguyên giờ, đổi bác sĩ" — đây là ràng buộc vật lý "khách kịp tới nơi", áp dụng vô điều kiện cho mọi ứng viên (kể cả khi được lấn slot walk-in).

**Chọn tay tự do:** ngoài danh sách đề xuất tự động (tối đa 4 phương án), lễ tân/admin có thể **chọn tay tự do** bất kỳ bác sĩ/ngày/slot nào còn trống cùng chuyên khoa khi khách có yêu cầu riêng — vẫn phải qua cùng các ràng buộc (còn trống, cùng chuyên khoa, không quá khứ, không quá sát giờ).

**Quyền của khách:** luôn được **thông báo kèm ≥2 lựa chọn**, có hạn phản hồi. Quá hạn không phản hồi → **giữ chỗ mới đã đặt sẵn** cho khách, không để mất chỗ. Khách vẫn **giữ nguyên** quyền dời 1 lần của mình (lần này là `ly_do_doi='phong_kham'`).

**Slot:**
- Khung đích hết slot online → **được lấn slot walk-in**, trần **1 slot/khung**, bắt buộc ghi nhật ký. Đây là **ngoại lệ DUY NHẤT** của quy tắc "không lấn walk-in" ở mục 5 — vì lỗi thuộc phòng khám, khách không phải gánh. **Khách tự xin dời thì KHÔNG BAO GIỜ được lấn.**
- Slot 10:00 cũ phải chuyển `locked`, **KHÔNG** trả về pool — bác sĩ bận thật, không bán lại cho ai.
- Khung có nhiều slot (TMH 2 slot/khung) → dời **từng khách một**, mỗi người chọn phương án riêng.

**Thời điểm:** mốc `T-30'` ở mục 11 **KHÔNG áp** cho phòng khám dời — mốc đó chỉ để chặn khách né mất tiền. Bác sĩ báo bận lúc nào cũng phải dời được, kể cả sát giờ.

**Hiện thực — KHÔNG tạo bảng mới:**
- Tái dụng `NghiPhepBacSi`: `gio_bat_dau='10:00'` + `gio_ket_thuc='10:30'` (model đã hỗ trợ sẵn nghỉ theo khung, để trống = nghỉ cả ngày), kèm nguyên luồng duyệt có sẵn `cho_duyet → da_duyet` + `nguoi_duyet_id`.
- Khoá slot: dùng `bi_khoa_boi_nghi_phep` + `nghi_phep_id` đã có trong `slots[]`.
- Phần **duy nhất phải làm mới** là tầng điều phối: sinh phương án dời → khách chọn → admin duyệt khi có khách đã thanh toán. Không đụng schema `NghiPhepBacSi` (giữ đúng ràng buộc mục 10).
