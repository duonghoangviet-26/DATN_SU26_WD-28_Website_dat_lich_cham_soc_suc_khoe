# Agent Handoff - VitaFamily

## Muc dich

File nay la diem vao nhanh cho AI agent hoac nguoi tiep quan du an. Muc tieu la:

- biet tai lieu nao phai doc truoc
- biet phan nao da PASS that
- biet phan nao chi moi audit hoac moi dung nen
- biet pham vi nao tuyet doi khong duoc hieu nham la da xong
- tranh doc nham bao cao cu roi sua sai huong

## Doc theo thu tu nay

1. [frontend-skill-gate.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/frontend-skill-gate.md)
2. [admin-refactor-summary.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-refactor-summary.md)
3. [admin-refactor-fix-log.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-refactor-fix-log.md)
4. [admin-appointments-deep-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-appointments-deep-audit.md)
5. [specialty-service-family-update.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/specialty-service-family-update.md)
6. [admin-service-specialty-appointment-fix.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-service-specialty-appointment-fix.md)
7. [admin-id-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-id-audit.md)
8. [admin-routes-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-routes-audit.md)

Neu tiep tuc sua code, chi ket luan sau khi doi chieu lai code that trong repo.

## UI Skill Gate

Neu lam bat ky giao dien nao cua bat ky role nao, phai doc truoc:

- [.agents/skills/impeccable/SKILL.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/.agents/skills/impeccable/SKILL.md)
- [.agents/skills/design-taste-frontend/SKILL.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/.agents/skills/design-taste-frontend/SKILL.md)

Ap dung cho tat ca role:

- admin
- patient/client/user
- le tan
- y ta
- bac si
- role noi bo khac neu co

Quy uoc nay ap dung cho page, form, list, detail, dashboard, modal, empty state, error state, va moi luong UI.

## Su that hien tai

### 1. Nhanh admin refactor co ban da co nen

Da co tong hop va fix-log cho cac domain admin chinh:

- clinics
- specialties
- services
- appointments
- payments
- reviews
- notifications

### 2. Chuyen khoa hien tai chi con 3 active muc canonical

Day la su that hien tai phai bam theo:

- `Tai Mui Hong`
- `Nhi khoa`
- `Da lieu`

Khong duoc quay lai logic cu coi `Tai`, `Mui`, `Hong` la 3 chuyen khoa active rieng. Bao cao `admin-service-specialty-appointment-fix.md` co gia tri lich su audit, nhung da bi supersede ve mat du lieu boi [specialty-service-family-update.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/specialty-service-family-update.md).

### 3. Dich vu admin hien tai da tach ro "goi" va "dich vu le"

Model `DichVu` da co:

- `la_goi`
- `doi_tuong_ap_dung`

Admin services hien tai da di theo huong:

- trang landing theo chuyen khoa
- co tab/boc tach cho `Tat ca`, `Goi`, `Dich vu le`
- chi quan ly luong `related`
- badge `Goi` tren danh sach khi `la_goi=true`

### 4. Admin appointments chi duoc quan ly lich da co, khong duoc tao lich moi

Route `POST /api/admin/appointments` van ton tai de giu contract frontend/service, nhung backend da khoa nghiep vu:

- admin khong duoc tao lich hen moi
- chi nguoi dung hoac le tan duoc dat lich vi lien quan thanh toan

Do do:

- khong duoc dung route nay de mo lai UI dat lich cho admin
- khong duoc tu y them flow "admin tao lich" neu chua co xac nhan nghiep vu moi

### 5. Nen du lieu dat ho gia dinh da co o model/data/admin appointments

Da xac nhan:

- `GiaDinh`
- `ThanhVien`
- `LichHen.dat_ho`
- `LichHen.nguoi_dat_ho_id`
- snapshot thong tin nguoi dat ho

Admin appointments hien tai phai hien thi tach:

- nguoi duoc kham
- nguoi dat ho

Khong duoc gop nham 2 nguoi nay tren UI admin.

### 6. Admin doctor schedules da co route va man hinh rieng

Trang:

- `/admin/doctor-schedules`

Route backend:

- `GET /api/admin/slots/calendar`
- `POST /api/admin/slots/ensure-day`
- `PATCH /api/admin/slots/:id/workday`
- `GET /api/admin/slots/:id`
- `PATCH /api/admin/slots/:id/slots/:slotId`
- `POST /api/admin/slots/generate`

Nghiep vu hien tai:

- admin xem lich lam viec bac si theo khoang ngay
- ngay chua co document duoc hien thi `chua_tao`
- admin co the tao/ensure lich cho ngay trong
- admin co the chinh trang thai ngay: `lam_viec`, `nghi`, `nghi_phep`
- admin co the sua slot gio, phong kham, trang thai slot
- slot da `booked` hoac `pending_payment` khong duoc sua tuy tien nhu slot trong

## Nhung gi da PASS that

### PASS cua nhanh specialty/service/family

Theo [specialty-service-family-update.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/specialty-service-family-update.md):

- `backend npm test`: `89/89 PASS`
- `frontend npm run build`: PASS
- active specialties dung 3 muc:
  - `Tai Mui Hong`
  - `Nhi khoa`
  - `Da lieu`
- API admin services da ho tro `la_goi=true`
- seed 7 goi dich vu mau da co dung specialty
- admin UI da tao/sua goi dich vu dung `la_goi` va `doi_tuong_ap_dung`
- admin appointments da hien thi dung thong tin dat ho

### PASS cua nhanh appointments audit/fix

Theo [admin-appointments-deep-audit.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/admin-appointments-deep-audit.md):

- list appointments da doi sang filter/search/paginate o DB
- cancel bat buoc co ly do va ghi metadata huy
- restore chi duoc khi slot cu van con trong
- delete cung chi duoc voi lich da huy
- reschedule bat buoc co ly do va chan no-op / qua khu
- history da ghi before/after ro hon
- UI admin appointments da co quick filter, payment filter, summary, warning badge, detail/history ro hon

### PASS cua cap nhat frontend moi nhat

- [frontend/src/pages/admin/ManageServices.tsx](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/pages/admin/ManageServices.tsx) da duoc sua loi render `icon_url` thanh text
- fallback avatar specialty da an toan khi URL anh loi
- `frontend npm run build` da PASS sau khi sua loi giao dien nay

## Tai lieu cu de tham khao, khong duoc coi la "su that moi nhat"

### `admin-service-specialty-appointment-fix.md`

Tai lieu nay van huu ich de hieu dot audit/fix truoc, nhung khong con la nguon su that moi nhat cho specialty/service data vi:

- no ghi snapshot specialty active cu
- no thuoc dot truoc khi gom `Tai/Mui/Hong` thanh `Tai Mui Hong`

Neu co mau thuan giua file nay va `specialty-service-family-update.md`, uu tien file `specialty-service-family-update.md`, roi doi chieu code that.

### `admin-refactor-summary.md`

Dung de hieu tong quan lo trinh cu. Khong duoc dung mot minh de ket luan trang thai hien tai neu da co fix-log va bao cao moi hon.

## Pham vi ngoai scope hoac chua duoc phep hieu nham la da xong

- `backend/src/routes/doctor.routes.js`
- `backend/src/controllers/doctor.controller.js`
- `frontend/src/pages/admin/ManageDoctor*` cho domain ho so bac si
- patient/client booking UI thuc te cho dat ho gia dinh
- UI trong `ManageDoctors` de set `tuoi_nhan_kham_tu`
- user management toan bo
- y ta toan bo
- le tan toan bo, tru phan lien quan den quy tac dat lich da duoc nhac trong admin docs

Luu y:

- `BacSi.tuoi_nhan_kham_tu` moi chi duoc xac nhan ton tai o model/data
- khong co nghia flow CRUD bac si da duoc don dep xong
- khong co nghia client booking da xong

## 4 ton dong cu van con gia tri canh bao

Theo nhanh refactor truoc, 4 muc sau van phai coi la ton dong neu chua co bang chung moi cho thay da dong:

1. `doctor.routes.js` van la diem can review ky ve auth/guard
2. `doctor.controller.js` van la diem can review ky ve viec nhan `admin_id` tu request
3. `ManageDoctors` frontend chua duoc don dep theo chuan refactor hien tai
4. domain user / y ta / le tan chua nam trong pham vi da hoan tat

Neu muon dong 1 muc nao o tren, phai co code change + test/runtime evidence moi.

## File code hot spot nen mo truoc khi sua

### Specialty / Service

- [backend/src/models/DichVu.js](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/backend/src/models/DichVu.js)
- [backend/src/controllers/admin/services.controller.js](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/backend/src/controllers/admin/services.controller.js)
- [frontend/src/pages/admin/ManageServices.tsx](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/pages/admin/ManageServices.tsx)
- [frontend/src/pages/admin/ManageServiceSpecialtyDetail.tsx](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/pages/admin/ManageServiceSpecialtyDetail.tsx)
- [frontend/src/components/admin/services/ServiceFormModal.tsx](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/components/admin/services/ServiceFormModal.tsx)
- [frontend/src/services/service.service.ts](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/services/service.service.ts)

### Appointments

- [backend/src/controllers/admin/appointment.controller.js](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/backend/src/controllers/admin/appointment.controller.js)
- [backend/src/routes/admin/appointment.routes.js](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/backend/src/routes/admin/appointment.routes.js)
- [frontend/src/pages/admin/ManageAppointments/ManageAppointments.tsx](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/pages/admin/ManageAppointments/ManageAppointments.tsx)
- [frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx)
- [frontend/src/pages/admin/ManageAppointments/AppointmentDetail.tsx](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/pages/admin/ManageAppointments/AppointmentDetail.tsx)
- [frontend/src/services/appointment.service.ts](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/services/appointment.service.ts)

### Doctor schedules

- [backend/src/controllers/admin/slots.controller.js](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/backend/src/controllers/admin/slots.controller.js)
- [backend/src/routes/admin/slots.routes.js](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/backend/src/routes/admin/slots.routes.js)
- [frontend/src/pages/admin/ManageDoctorSchedules.tsx](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/pages/admin/ManageDoctorSchedules.tsx)
- [frontend/src/services/admin-doctor-schedule.service.ts](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/frontend/src/services/admin-doctor-schedule.service.ts)

## Quy uoc lam tiep

- chi danh PASS khi co output test/runtime that
- neu FAIL thi quay lai nguyen nhan goc, khong nhay tiep
- khong nhay coc buoc
- khong mo rong scope neu chua co xac nhan ro
- sau moi dot sua lon, cap nhat `docs/reviews`
- neu dong vao giao dien cua bat ky role nao, doc `frontend-skill-gate.md` va 2 skill bat buoc truoc

## Thu tu uu tien khi co mau thuan thong tin

1. code va test hien tai trong repo
2. `docs/reviews/frontend-skill-gate.md` neu dang lam UI
3. `docs/reviews/admin-refactor-fix-log.md`
4. `docs/reviews/specialty-service-family-update.md`
5. `docs/reviews/admin-appointments-deep-audit.md`
6. `docs/reviews/admin-refactor-summary.md`
7. hoi thoai cu

## Checklist cho agent moi

1. Doc file handoff nay.
2. Neu lam UI, doc `frontend-skill-gate.md` va 2 skill bat buoc.
3. Xac dinh dang tiep quan nhanh nao:
   - specialties/services
   - appointments
   - doctor schedules
   - doctor domain
   - role khac
4. Doi chieu lai code that o cac file hot spot truoc khi sua.
5. Chay dung test/build lien quan truoc khi danh dau PASS.
6. Neu thay docs cu mau thuan voi code moi, uu tien code + bao cao moi hon.

## Trang thai repo lien quan den handoff nay

Tai thoi diem viet lai file nay:

- `.agents/` da duoc bo ignore khoi `.gitignore` de co the commit/push skill xuong may khac
- [docs/reviews/frontend-skill-gate.md](/E:/DATN/DATN_SU26_WD-28_Website_dat_lich_cham_soc_suc_khoe/docs/reviews/frontend-skill-gate.md) da duoc them de khoa quy trinh doc skill truoc khi lam UI

Neu may khac pull code moi va `.agents/` da duoc commit, thi co the doc skill ngay trong repo ma khong can cai lai tu dau.
