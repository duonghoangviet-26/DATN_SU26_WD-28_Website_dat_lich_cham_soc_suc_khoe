# Agent Handoff - Admin Refactor VitaFamily

## Mục đích

File này là điểm vào nhanh cho người mới hoặc AI agent mới khi tiếp quản phần refactor admin của VitaFamily.

Mục tiêu của file:

- giúp nắm đúng phạm vi đã xử lý
- biết đọc tài liệu nào trước
- biết những gì đã PASS thật
- biết những gì cố ý chưa xử lý
- tránh làm lại các bước đã khóa bằng test

## Thứ tự nên đọc

Đọc theo đúng thứ tự này:

1. [admin-refactor-summary.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-refactor-summary.md)
2. [admin-refactor-fix-log.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-refactor-fix-log.md)
3. [admin-service-specialty-appointment-fix.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-service-specialty-appointment-fix.md)
4. [admin-id-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-id-audit.md)
5. [admin-routes-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-routes-audit.md)

Nếu cần làm tiếp code, sau khi đọc các file trên thì mới đối chiếu lại file code/test thật được nhắc tới trong từng tài liệu.

## Phạm vi đã khóa

Refactor hiện tại chỉ tính trong 7 domain admin:

- `admin/clinics`
- `admin/specialties`
- `admin/services`
- `admin/appointments`
- `admin/payments`
- `admin/reviews`
- `admin/notifications`

Các phần sau hiện được xem là ngoài phạm vi chính của roadmap này:

- `backend/src/routes/doctor.routes.js`
- `backend/src/controllers/doctor.controller.js`
- `frontend/src/pages/admin/ManageDoctor*`
- domain quản trị người dùng
- domain y tá
- domain lễ tân

Lưu ý:

- Bước 7 trước đây đã được mở rộng cục bộ để xử lý phần doctor/ManageDoctor liên quan tới `phi_tu_van` và typecheck.
- Việc mở rộng đó không có nghĩa là toàn bộ domain doctor đã được refactor xong.

## Trạng thái hiện tại

Tính đến lần cập nhật gần nhất:

- các bước 1-28 trong chuỗi admin refactor đã được đi qua và đã được log lại
- các bước 20-28 đã được cập nhật lại đúng theo kết quả test/runtime thật
- đã có thêm một đợt sửa riêng cho 3 luồng:
  - `admin/services`
  - `admin/specialties`
  - `admin/appointments`
- báo cáo của đợt sửa này nằm tại:
  - [admin-service-specialty-appointment-fix.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-service-specialty-appointment-fix.md)
- frontend admin route trong phạm vi đã được kiểm tra runtime HTTP
- dashboard admin đã dùng API thật
- summary cuối cùng đã được siết lại để phần tồn đọng chỉ còn đúng 4 ý

## Những gì đã PASS thật

Các điểm sau đã có bằng chứng test hoặc kiểm tra runtime thật:

- backend full suite pass: `88/88`
- frontend build pass
- các route admin sau trả `200` ở runtime check:
  - `/admin/clinics`
  - `/admin/services`
  - `/admin/appointments`
  - `/admin/reviews`
  - `/admin/notifications`
  - `/admin/payments`
- dashboard backend test pass
- auth matrix cho route admin trong phạm vi đã có test
- luồng bỏ `admin_id` từ body và lấy admin từ token đã có test khóa
- đợt sửa riêng `services/specialties/appointments` đã pass:
  - `GET /api/admin/specialties` trả đúng `4` chuyên khoa thật
  - `GET /api/admin/services?loai=related` trả đúng `3` dịch vụ liên quan thật
  - `GET /api/admin/appointments` trả đúng dữ liệu thật với đủ status:
    - `pending`
    - `confirmed`
    - `checked_in`
    - `in_progress`
    - `completed`
    - `cancelled`
    - `no_show`

## 4 tồn đọng còn lại

Đây là 4 mục còn lại đã được chốt ở cuối summary. Không tự ý diễn giải thành ít hơn hoặc nhiều hơn:

1. `doctor.routes.js` vẫn thiếu `verifyToken` và `requireRole('admin')`
2. `doctor.controller.js` vẫn nhận `admin_id` từ body
3. `ManageDoctors` frontend chưa được dọn theo chuẩn refactor hiện tại
4. domain quản trị người dùng/y tá/lễ tân chưa được xử lý trong lộ trình này

## Những điều không được hiểu sai

- Không được nói rằng toàn bộ admin của dự án đã refactor xong. Chỉ 7 domain ở trên là đã được khóa tương đối kỹ.
- Không được nói rằng domain doctor đã hoàn tất. Mới chỉ xử lý phần liên quan cần thiết để qua các bước trước.
- Không được bỏ qua `fix-log`. File này là nguồn đúng nhất để biết mỗi bước đã fail vì gì, sửa gì, và pass bằng test nào.
- Không được coi docs là chân lý tuyệt đối nếu code đã đổi tiếp sau thời điểm cập nhật. Khi làm tiếp, luôn phải đối chiếu lại code thật.

## Nếu AI agent khác làm tiếp

Nên làm theo trình tự:

1. Đọc `summary`
2. Đọc `fix-log`
3. Đọc `admin-service-specialty-appointment-fix.md` nếu công việc liên quan `services/specialties/appointments`
4. Xác nhận lại phạm vi hiện tại
5. Chọn đúng bước tiếp theo hoặc đúng tồn đọng cần xử lý
6. Test trước
7. Chỉ sửa đúng nguyên nhân gốc
8. Test lại và chỉ đánh PASS khi có output thật

## Quy ước làm tiếp

Nếu tiếp tục theo phong cách hiện tại, nên giữ nguyên kỷ luật này:

- `test -> sửa -> pass -> bước tiếp theo`
- không đánh PASS nếu chưa có output test/runtime thật
- nếu fail thì quay lại đúng nguyên nhân gốc
- không mở rộng phạm vi khi chưa ghi rõ
- cập nhật lại `docs/reviews` sau mỗi bước đủ lớn

## Nguồn sự thật gần nhất

Khi có mâu thuẫn giữa các nguồn, ưu tiên theo thứ tự:

1. code và test hiện tại trong repo
2. `admin-refactor-fix-log.md`
3. `admin-refactor-summary.md`
4. các suy luận miệng từ hội thoại cũ

## Gợi ý checkpoint trước khi làm tiếp

Nếu muốn tiếp tục ngay mà không mất ngữ cảnh, nên kiểm lại nhanh:

- `docs/reviews/admin-refactor-summary.md`
- `docs/reviews/admin-refactor-fix-log.md`
- `docs/reviews/admin-service-specialty-appointment-fix.md`
- `backend/tests/admin/`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/routes/adminMenu.ts`

Sau đó mới chọn nhánh tiếp theo để làm.
