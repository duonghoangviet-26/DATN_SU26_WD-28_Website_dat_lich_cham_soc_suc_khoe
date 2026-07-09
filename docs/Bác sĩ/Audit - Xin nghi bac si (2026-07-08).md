# Audit — Bác sĩ xin nghỉ

> Ngày kiểm tra: 2026-07-08
> Phạm vi: chỉ phần bác sĩ gửi yêu cầu xin nghỉ. Không kiểm tra màn admin duyệt nghỉ, không sửa logic admin.
> Đây là **báo cáo hiện trạng — chưa sửa gì**.

---

## 1. Đã có trang xin nghỉ chưa

Chưa có — thiếu hoàn toàn ở mọi tầng, phía bác sĩ.

| Lớp | Kết quả rà soát |
|---|---|
| Route backend cho doctor | `backend/src/routes/doctor/index.js` chỉ mount `profile`, `schedule`, `appointments`, `stats` — không có `leave`/`nghi-phep` |
| Service frontend | Grep `NghiPhep\|leave` trong `frontend/src/services/*` → 0 kết quả |
| Page/route frontend | Grep tương tự trong `frontend/src/pages/doctor/*` → 0 kết quả; `AppRoutes.tsx` không có `/doctor/leave-requests` |
| Menu | `frontend/src/routes/doctorMenu.ts` không có mục "Xin nghỉ" |

API duy nhất liên quan `NghiPhepBacSi` hiện có là phía admin, `backend/src/routes/admin/doctor-leaves.routes.js`:
```js
router.use(verifyToken, requireRole('admin'))   // chỉ admin, doctor gọi sẽ bị 403
router.get('/', controller.listDoctorLeaves)
router.post('/', controller.createDoctorLeave)
router.patch('/:id/approve', controller.approveDoctorLeave)
router.patch('/:id/reject', controller.rejectDoctorLeave)
```
Bác sĩ không có quyền gọi endpoint nào trong này — đúng là route admin, không phải lỗi phân quyền, mà là thiếu hẳn route tương ứng phía doctor.

## 2. Form xin nghỉ có đủ ngày/ca/lý do không

Không đánh giá được vì không tồn tại form.

## 3. Danh sách yêu cầu nghỉ có trạng thái không

Không có danh sách để xem trạng thái (không có trang). Đáng chú ý ngay ở tầng model (`NghiPhepBacSi.js`):
```js
trang_thai: { type: String, enum: ['cho_duyet', 'da_duyet', 'tu_choi'], default: 'cho_duyet' }
```
Chỉ có 3 trạng thái: chờ duyệt / đã duyệt / từ chối — **thiếu trạng thái "đã hủy" (CANCELLED)**. Muốn hỗ trợ "Hủy yêu cầu nếu còn PENDING" thì phải sửa cả enum ở model trước, không chỉ thêm UI.

## 4. Có hành động nào vượt quyền bác sĩ không

Không có hành động nào cả (vì tính năng chưa tồn tại). Điều cần lưu ý: hành vi tương tự đang bị làm sai ở chỗ khác — nút "Tạm nghỉ"/"Mở lại" trong `DoctorSchedule.tsx` cho bác sĩ tự đổi `status` slot giữa `active`/`locked` ngay lập tức, không qua `NghiPhepBacSi`, không cần admin duyệt (đã báo cáo ở `Audit - Lich lam viec bac si`). Không có nút nào trong code hiện tại cho bác sĩ tự duyệt yêu cầu, tự đổi lịch sang DOCTOR_LEAVE, tự hủy lịch hẹn bệnh nhân qua đường "xin nghỉ", hay tự xóa ca — vì cả luồng chưa được xây.

## 5. Trạng thái thực hiện

Không sửa code nào ở bước này.

## 6. Đề xuất phần cần bổ sung (chỉ đề xuất — CHƯA áp dụng)

1. **[Cao]** Model: thêm trạng thái `da_huy` (CANCELLED) vào enum `trang_thai` của `NghiPhepBacSi` — bắt buộc trước khi làm nút "Hủy yêu cầu".
2. **[Cao]** Backend: thêm router mới `backend/src/routes/doctor/leave.routes.js`, mount tại `/api/doctor/leave-requests`, gate `verifyToken + requireRole('doctor')`, gồm:
   - `GET /` — danh sách yêu cầu nghỉ của chính bác sĩ đăng nhập (`bac_si_id` suy từ `BacSi.findOne({ user_id: req.user.id })`, không nhận từ query/body).
   - `POST /` — tạo yêu cầu mới (ngày/ca, lý do bắt buộc), mặc định `trang_thai: cho_duyet`.
   - `PATCH /:id/cancel` — chỉ cho hủy khi `trang_thai === 'cho_duyet'`, kiểm tra `bac_si_id` khớp bác sĩ đăng nhập trước khi cho hủy.
   - Không thêm approve/reject vào router này — giữ nguyên bên admin.
3. **[Trung bình]** Frontend: thêm `frontend/src/services/leave-request.service.ts`, page `frontend/src/pages/doctor/DoctorLeaveRequests.tsx`, route `/doctor/leave-requests`, mục menu trong `doctorMenu.ts`.
4. **[Trung bình]** Form gồm: chọn ngày, chọn ca/khung giờ, ô lý do (bắt buộc), validate không cho chọn ngày đã qua, validate không gửi trùng yêu cầu cùng ngày/ca nếu đã có bản ghi `cho_duyet`/`da_duyet`.
5. **[Thấp]** Sau khi có route này, cân nhắc thay 2 nút "Tạm nghỉ"/"Mở lại" ở `DoctorSchedule.tsx` bằng liên kết sang mục "Gửi yêu cầu xin nghỉ" mới.

---

## Liên quan

- `Audit - Ra soat trang bac si (2026-07-08).md` — audit tổng quát toàn bộ trang bác sĩ.
- `Audit - Route va phan quyen trang bac si (2026-07-08).md` — audit route & phân quyền.
- `Audit - Dashboard bac si (2026-07-08).md` — audit màn Dashboard.
- `Audit - Lich lam viec bac si (2026-07-08).md` — audit màn Lịch làm việc.
- `Audit - Danh sach lich hen bac si (2026-07-08).md` — audit danh sách lịch hẹn.
- `Audit - Chi tiet lich hen bac si (2026-07-08).md` — audit chi tiết lịch hẹn.
- `Audit - Ho so kham bac si (2026-07-08).md` — audit hồ sơ khám.
