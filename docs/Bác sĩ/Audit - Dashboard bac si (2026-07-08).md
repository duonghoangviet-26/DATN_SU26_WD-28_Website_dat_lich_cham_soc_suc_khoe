# Audit — Dashboard Bác sĩ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ Dashboard trang bác sĩ (`/doctor` index). Không kiểm tra dashboard admin, không sửa module khác.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1. Component/page xử lý Dashboard

| Vai trò | File |
|---|---|
| Page chính | `frontend/src/pages/doctor/DoctorDashboard.tsx` |
| Service | `frontend/src/services/doctor-profile.service.ts` → `getStats()`, `getReviews()` |
| Mock data | `frontend/src/mock/doctor-stats.ts` → `mockDoctorStats`, `mockDoctorReviews` |
| Backend (chưa nối) | `backend/src/controllers/doctor/stats.controller.js` → `GET /api/doctor/stats`, `GET /api/doctor/stats/reviews` |
| Tên bác sĩ (ngoài page, header dùng chung mọi trang `/doctor/*`) | `frontend/src/components/doctor/DoctorHeader.tsx` |

## 2. Mock vs API thật

100% mock. `doctor-profile.service.ts`: `getStats()`/`getReviews()` await `delay()` rồi trả thẳng `{...mockDoctorStats}` / `[...mockDoctorReviews]`. Đoạn gọi `axiosInstance.get('/doctor/stats')` đã viết sẵn nhưng đang comment, chưa bật — đúng giai đoạn frontend-first hiện tại, không phải lỗi.

## 3. Đối chiếu 9 yêu cầu nghiệp vụ

| # | Yêu cầu | Hiện trạng |
|---|---|---|
| 1 | Thông tin bác sĩ đăng nhập | ⚠️ Một phần — chỉ có tên (`user?.ho_ten`) ở `DoctorHeader.tsx` (header chung mọi trang, không riêng Dashboard). Không có chuyên khoa. Không có gì trong `DoctorDashboard.tsx`. |
| 2 | Ca làm việc hôm nay | ❌ Không có. |
| 3 | Phòng khám hôm nay | ❌ Không có. |
| 4 | Y tá hỗ trợ | ❌ Không có — model backend chưa có field nurse gắn vào lịch hẹn/lịch làm việc (đã ghi nhận ở audit tổng quát trước). |
| 5 | Tổng số lịch hẹn hôm nay | ❌ Không có. `DoctorStats` chỉ có `tong_luot_kham` (tích lũy) và `thang_nay` (trong tháng) — không có số liệu theo ngày. |
| 6 | Số bệnh nhân chờ khám | ❌ Không có. |
| 7 | Số bệnh nhân đang khám | ❌ Không có. |
| 8 | Số bệnh nhân đã hoàn thành | ❌ Không có dạng đếm theo hôm nay — chỉ có `ty_le_hoan_thanh` (% tích lũy). |
| 9 | Danh sách lịch hẹn gần nhất trong ngày | ❌ Không có — phải sang `/doctor/appointments` riêng. |

**Kết quả: 8/9 mục thiếu hoàn toàn, 1/9 có nhưng sai vị trí và thiếu dữ liệu.**

Nội dung Dashboard hiện tại thực chất là trang **"Thống kê hành nghề"**: tổng lượt khám tích lũy, lượt khám tháng này, điểm đánh giá, doanh thu tháng, tỉ lệ hoàn thành/hủy (progress bar), đánh giá gần đây — không phải "tổng quan công việc trong ngày" như spec yêu cầu.

Ghi chú `doanh_thu_thang`: query backend lọc theo `doctor_id` (`LichHen.aggregate({ doctor_id: doc._id, ... })`) nên chỉ là doanh thu cá nhân bác sĩ đó, không phải doanh thu toàn hệ thống — không vi phạm nguyên tắc "không hiển thị doanh thu toàn hệ thống" đã nêu trước, chỉ đơn giản không thuộc 9 mục yêu cầu lần này.

**Gap phụ**: `useEffect` gọi `Promise.all([getStats(), getReviews()])` không có `.catch` — nếu API lỗi, `stats` giữ `null`, `statCards` render mảng rỗng lặng lẽ, không báo lỗi cho bác sĩ.

## 4. Đề xuất việc cần sửa (ưu tiên giảm dần) — CHƯA áp dụng

1. **[Cao]** Thêm API backend "tổng quan hôm nay" (mở rộng `GET /api/doctor/stats` hoặc endpoint mới) — trả: ca làm việc hôm nay, phòng khám hôm nay, tổng lịch hẹn hôm nay, số đếm theo trạng thái hôm nay (chờ/đang khám/hoàn thành), danh sách lịch hẹn gần nhất trong ngày. Nguồn: `LichLamViec` (lọc `ngay` = hôm nay, `doctor_id` từ JWT) + `LichHen` (lọc `ngay_kham` = hôm nay, group theo `status`).
2. **[Cao]** Thêm block "Thông tin hôm nay" ngay trong `DoctorDashboard.tsx` (tên, chuyên khoa, ca, phòng) — không phụ thuộc `DoctorHeader.tsx` vì header không có chuyên khoa/ca/phòng và dùng chung mọi trang.
3. **[Trung bình]** Y tá hỗ trợ: cần bổ sung field liên kết y tá ở tầng model trước (`LichLamViec`/`LichHen`), sau đó mới hiển thị được — phụ thuộc việc này chưa tồn tại ở backend.
4. **[Trung bình]** Thêm danh sách lịch hẹn gần nhất trong ngày ngay trên Dashboard, tái dùng dữ liệu từ mục 1, tránh bắt bác sĩ sang trang Lịch hẹn chỉ để xem nhanh.
5. **[Thấp]** Sắp xếp lại bố cục: đặt phần "hôm nay" lên đầu trang, phần thống kê hành nghề hiện có (tổng lượt khám, doanh thu, đánh giá) đẩy xuống dưới hoặc tách section riêng.
6. **[Thấp]** Thêm xử lý lỗi (catch) cho `Promise.all` khi tải dashboard, và empty state riêng khi hôm nay không có ca/lịch hẹn nào.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ.
- `Audit - Route va phan quyen trang bac si (2026-07-08).md` — audit route & phân quyền.
