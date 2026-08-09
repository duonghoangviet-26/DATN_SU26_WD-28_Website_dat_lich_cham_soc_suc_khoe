# Review cuối kỳ — WS-4: Nhật ký thao tác lễ tân (2026-08-08)

> Thi công bằng subagent-driven-development, 8 task riêng biệt + review từng task + 1 review toàn nhánh cuối kỳ.
> Plan: `docs/Ke hoach WS-4 - Nhat ky thao tac le tan (2026-08-08).md`
> Phạm vi review toàn nhánh: `a1c633a..b305318` (22 file, backend + frontend), sau đó thêm 1 fix nhỏ tại `cf0fc8a`.

## Kết quả

**Ready to merge: Có, kèm 2 lỗi đã sửa ngay + 4 việc theo dõi.**

Cơ chế lõi đúng: ghi audit không bao giờ làm hỏng nghiệp vụ (đã kiểm chứng `ghiNhatKyLeTan` không throw dưới mọi hình dạng gọi thực tế trong diff), không đụng schema, không đụng `.claude/rules/lich-lam-viec-bac-si.md`. Trang "Nhật ký ca trực" (mục tiêu chính — bàn giao ca giữa 2 lễ tân) hoạt động đúng đầu-cuối cho check-in và khách vãng lai.

## Đã sửa ngay trong review cuối kỳ (commit `cf0fc8a`)

1. **`FIELD_WHITELIST` thiếu `ngay_kham`** (`receptionistTimeline.service.js`) — đổi lịch sang NGÀY khác chỉ hiện đổi giờ trên timeline, không hiện đổi ngày. Đã thêm.
2. **`locMaTheoNhom` tra nhầm key kế thừa từ prototype** (`receptionistActivityLog.service.js`) — `?nhom=constructor` gây lỗi 500 (`N[nhom] is not iterable`). Đổi sang `Object.hasOwn`.

## Việc theo dõi (chưa sửa, không chặn merge)

### 1. Whitelist theo lịch hẹn của Task 8 chỉ khớp được 2/8 mã LT_* — QUAN TRỌNG

`layTimelineLichHen` lọc theo `loai_doi_tuong: 'appointment'`, nhưng Task 2/3 ghi các hành động check-in/thanh toán/hóa đơn với `loai_doi_tuong` khác (`queue_entry`, `payment`, `invoice`):

| Mã | `loai_doi_tuong` đã ghi | Khớp timeline theo lịch hẹn? |
|---|---|---|
| `LT_DOI_LICH`, `LT_HUY_LICH` | `appointment` | Có |
| `LT_CHECK_IN`, `LT_HUY_CHECK_IN` | `queue_entry` | Không |
| `LT_XAC_NHAN_THANH_TOAN` | `payment` | Không |
| `LT_LAP_HOA_DON` | `invoice` | Không |

Không phá gì (không lộ dữ liệu, không sai nghiệp vụ) — chỉ là tab "lịch sử theo khách" (backend của Task 8) trống với 6/8 hành động. Giao diện tab này vốn thuộc **WS-5**, nên chưa ai nhìn thấy hậu quả trực tiếp, nhưng phải sửa **trước khi làm WS-5** — nếu không WS-5 sẽ build trên một API trống.

Cách sửa gợi ý: `LT_CHECK_IN` đã có `appointment_id` trong `du_lieu_moi` — thêm `$or` theo `du_lieu_moi.appointment_id`, hoặc ghi thêm 1 dòng audit scoped theo `appointment`. KHÔNG đổi `loai_doi_tuong` thành `appointment` cho các dòng này — `doi_tuong_id` sẽ trỏ sai đối tượng.

### 2. 4/6 hành động không hiện tên khách ở trang Nhật ký ca trực

`ten_khach` chỉ đọc từ `du_lieu_moi.ten_benh_nhan` — chỉ `moTaCheckIn` (Task 2) điền field này. `LT_HUY_CHECK_IN`, `LT_XAC_NHAN_THANH_TOAN`, `LT_LAP_HOA_DON`, `LT_HUY_LICH`, `LT_DOI_LICH` đều thiếu → cột "Khách hàng" hiện "—". Đây là một nửa mục tiêu gốc của WS-4 ("ai thu tiền khách nào"). Cần thêm `ten_benh_nhan` vào `duLieuMoi` ở 4-5 điểm ghi còn lại (dữ liệu đã có sẵn trong scope hàm, ví dụ `payment.ho_so_benh_nhan_id`).

### 3. Bác sĩ hủy lượt hàng đợi cũng bị ghi vào nhật ký lễ tân, không gắn nhãn

`queueCancel.service.js`'s `huyLuotHangDoi` dùng chung cho cả bác sĩ (`doctor/queue.controller.js`) và lễ tân, nhưng ghi `LT_HUY_CHECK_IN` không điều kiện — trong khi Task 4's `apDungPhuongAn` lại chặn rõ theo `actorRole === 'receptionist' | 'admin'`. Hai task chọn 2 chính sách khác nhau cho cùng câu hỏi "vai trò khác ghi vào nhật ký lễ tân hay không". `dinhDangBanGhi` cũng không trả `vai_tro`, nên bác sĩ hiện ra giống hệt lễ tân trong bảng "Người thực hiện". Cần chốt 1 chính sách áp dụng cho cả 2 chỗ.

### 4. `bulkCancelAppointments` vẫn không có audit — và có thể bị dùng để né audit

Route hủy lịch hàng loạt (`POST /receptionist/bulk-cancel`, có UI thật ở `Appointments.tsx`) tự thực hiện logic hủy riêng, không qua `cancelAppointment` (hàm đã có `LT_HUY_LICH`). Một lễ tân chọn 1 lịch duy nhất và bấm "hủy hàng loạt" sẽ hủy mà không để lại dấu vết trong nhật ký ca trực (`LichSuLichHen` vẫn có nhưng gắn cứng `vai_tro: 'admin'`, không phản ánh người thực hiện thật). Việc theo dõi ưu tiên cao nhất — nên làm sớm hơn WS-5.

## Khác (Minor, không chặn)

- `du_lieu_cu` không bao giờ được trả qua API (`dinhDangBanGhi` chỉ map `du_lieu_moi`) — trạng thái trước khi thay đổi bị ghi nhưng không xem được từ trang.
- Giới hạn `.limit(500)` không phân trang, không cảnh báo khi bị cắt bớt.
- `nguoi_id` filter không validate ObjectId trước khi đưa vào query Mongo (rủi ro thấp vì người gọi đã xác thực, nhưng nên `mongoose.Types.ObjectId.isValid` trước).
- `HANH_DONG_NHAN.LT_*` (receptionistTimeline.service.js) lặp lại `HANH_DONG_LE_TAN.LT_*` (receptionistAudit.service.js) dưới dạng chuỗi copy tay — nên import từ 1 nguồn.
- Baseline test: `npm test` hiện có 3 fail pre-existing ở `tests/doctor.leave-sync.test.js` (404 thay vì 200), không liên quan WS-4 — cần xác nhận với nhóm đây có phải lỗi đã biết trên `Fix_demo` không.
- `frontend: npm run typecheck` có 2 lỗi pre-existing ở `Profile.tsx`, không liên quan WS-4.

## Đã kiểm chứng lại (không phải lỗi mới, không suy giảm)

- `ghiNhatKyLeTan` vẫn không throw dưới mọi cách gọi thực tế trong toàn diff (fix Task 1 vẫn còn nguyên).
- Audit tiền mặt (fix Task 3) vẫn đúng và được gate đúng (`isPaid`/`paid`), không ghi trùng với giao dịch chuyển khoản đang `pending`.
- Lỗi lệch múi giờ (Task 5/7, `startOfDayUtc` vs `startOfClinicDayUtc`) vẫn latent — đã dò lại toàn bộ điểm ghi `LT_*` trong cả 8 task, xác nhận không có task nào thêm điểm ghi ngoài giờ hành chính (08:00–17:30 VN).
- Không có PII (`so_dien_thoai`, `dia_chi`, `di_ung`, `benh_nen`) lọt vào bất kỳ `du_lieu_moi`/`du_lieu_cu` nào hiển thị công khai hơn — đã kiểm tất cả điểm ghi trong diff.
