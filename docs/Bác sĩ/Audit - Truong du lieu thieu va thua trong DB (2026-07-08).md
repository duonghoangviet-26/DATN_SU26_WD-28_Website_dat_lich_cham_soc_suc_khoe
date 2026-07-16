# Audit — Trường dữ liệu THIẾU và THỪA trong DB (MongoDB)

> Câu hỏi gốc: "hiện tại db có thiếu hay thừa trường nào để dự án có thể làm không".
> Phạm vi: các model dùng chung toàn hệ thống nhưng ảnh hưởng trực tiếp tới các phase sắp làm ở
> trang bác sĩ (Phase 6+7, Phase 8). Mọi kết luận "thừa" đều verify bằng grep toàn `backend/src`,
> không suy đoán từ tên field.
> Đọc kèm: [[DB Models - Truong du lieu phuc vu trang bac si (2026-07-08)]]

---

## 1. THIẾU — chặn nghiệp vụ đã thiết kế nhưng DB chưa có chỗ lưu

| Model | Thiếu gì | Ảnh hưởng |
|---|---|---|
| `KetQuaKham` | Không có field `status` (vd `cho_xac_nhan/da_xac_nhan`) | Không thể làm luồng "y tá nhập → bác sĩ xác nhận" (Phase 6+7) — không có nơi lưu trạng thái hồ sơ khám |
| `NghiPhepBacSi.trang_thai` | Enum chỉ có `cho_duyet/da_duyet/tu_choi`, thiếu trạng thái hủy | Bác sĩ không có cách hủy đơn xin nghỉ đang `cho_duyet` (Phase 8) |
| `LichHen` / `LichLamViec` | Không có field gán y tá cho ca khám/lịch hẹn (không có `y_ta_id`) | "Y tá hỗ trợ" ở Dashboard không có dữ liệu thật dù `NguoiDung.role` đã có giá trị `'nurse'` — role tồn tại nhưng chưa có chỗ gán y tá vào ca cụ thể |

Cả 3 việc trên đều **additive-safe** (chỉ thêm field/enum value mới, không đổi field cũ) — đúng
chiến lược sửa model dùng chung đã thống nhất trong kế hoạch trước đó.

---

## 2. THỪA — field/enum có sẵn trong schema nhưng không ai đọc/ghi (verify bằng grep)

| Model | Field/enum thừa | Bằng chứng (grep `backend/src`) |
|---|---|---|
| `KetQuaKham` | `nguoi_nhap_id`, `bac_si_phu_trach_id`, `nguoi_xac_nhan_id`, `thoi_diem_xac_nhan` | Chỉ xuất hiện ở chính model + `admin/medical-read.controller.js` dùng `result.field ?? null` (đọc, không ghi) — **không controller nào từng gán giá trị**, nên luôn `null` |
| `LichHen.status` | `checked_in`, `in_progress`, `no_show` (3/7 giá trị enum) | Không xuất hiện ở bất kỳ file nào ngoài định nghĩa model — chưa ai `set`, chưa ai `check` |
| `NguoiDung.role` | `patient`, `receptionist` | Không được gán lúc tạo tài khoản (grep `role: 'patient'` → 0 kết quả), không middleware nào check — chỉ `user`/`doctor`/`admin` thực sự hoạt động; route bệnh nhân dùng `requireRole('user')`, không dùng `'patient'` |
| `NguoiDung.role` | `nurse` | Có trong enum nhưng không route/controller/middleware nào check `role === 'nurse'` — module y tá chưa tồn tại |

---

## 3. Kết luận

- DB không thiếu field ở mức làm sập hệ thống hiện tại. Các gap "thiếu" chỉ chặn 2 chức năng
  chưa triển khai (xác nhận hồ sơ khám, hủy xin nghỉ) — đúng dự tính ở Phase 6+7 và Phase 8.
- Phần "thừa" cho thấy có một luồng y tá/lễ tân/trạng thái chi tiết hơn từng được thiết kế nhưng
  chưa triển khai xong. Không gây lỗi (luôn null/không dùng tới) nhưng gây nhiễu khi đọc code.
  Đưa vào Phase 10 (dọn code thừa): quyết định hoàn thiện luồng đó hay xóa field/enum value.
- Không có field nào cho phép client tự truyền `doctor_id`/`role` — không có lỗ hổng bảo mật liên
  quan tới phần này (khớp lại với [[Audit - Bao mat du lieu trang bac si (2026-07-08)]]).

## 4. Áp dụng khi làm các phase tiếp theo

- Khi làm Phase 6+7: thêm `status` vào `KetQuaKham` — cân nhắc tận dụng luôn `nguoi_nhap_id`/
  `bac_si_phu_trach_id`/`nguoi_xac_nhan_id`/`thoi_diem_xac_nhan` đã có sẵn thay vì thêm field mới,
  vì đúng là 4 field này được thiết kế cho chính luồng đang cần làm.
- Khi làm Phase 8: thêm 1 giá trị enum hủy vào `NghiPhepBacSi.trang_thai` — an toàn vì
  `formatDoctorLeave()` phía admin không switch-case cứng theo giá trị enum.
- "Y tá hỗ trợ" vẫn giữ nguyên là dữ liệu `null` + thông báo "Chưa phân công y tá" cho tới khi có
  quyết định chính thức làm module gán y tá — không tự thêm field mới nếu không được yêu cầu.
