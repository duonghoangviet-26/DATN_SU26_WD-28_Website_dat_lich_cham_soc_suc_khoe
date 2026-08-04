# LT-07, LT-10, LT-11 - Backend da hoan thanh va UI can bo sung

Ngay tong hop: 2026-08-02

Nhanh: `Bac_si`

Trang thai task le tan:

- LT-07: da hoan thanh backend, commit `f16bf83`
- LT-10: da hoan thanh backend, commit `1761448`
- LT-11: da hoan thanh backend, commit `9b4a495`
- So task backend con lai trong nhom LT-07/LT-10/LT-11: 0

Tai thoi diem lap tai lieu nay, cac thay doi ben duoi moi bao gom backend API, validation, audit log va test. Frontend le tan chua co UI de thao tac truc tiep cac tinh nang moi.

## 1. LT-07 - Xu ly benh nhan dung khi trung so dien thoai

### Backend da hoan thanh

Muc tieu cua LT-07 la tranh viec le tan dat lich/check-in nham benh nhan khi nhieu thanh vien gia dinh hoac benh nhan walk-in dung chung mot so dien thoai.

Da bo sung logic:

- Dat lich tai quay uu tien dinh danh bang `member_id` khi nguoi dung chon thanh vien gia dinh.
- Walk-in cung so dien thoai nhung khac ho ten van duoc tach dung ho so.
- Check-in khong duoc ghep nham lich hen proxy chi dua vao tai khoan nguoi giam ho.
- Lich cu chi co so dien thoai se bi xem la mo ho neu ho so xac nhan khong khop ten.

Test lien quan:

- `backend/tests/receptionist.lt07-shared-phone.test.js`

Ket qua test muc tieu:

- 4/4 test LT-07 pass.

### UI le tan can bo sung/kiem tra

Man hinh dat lich tai quay:

- Khi tim bang so dien thoai co nhieu ho so/thanh vien, UI phai hien danh sach de le tan chon dung nguoi.
- Moi item nen hien it nhat: ho ten, ngay sinh/tuoi, gioi tinh, moi quan he neu la thanh vien gia dinh, so dien thoai.
- Khi le tan chon mot thanh vien gia dinh, payload dat lich phai gui dung `member_id`.
- Neu tao walk-in moi tren so dien thoai da ton tai, form phai giu ho ten benh nhan moi va khong tu dong gan vao ho so cu khi chua chon ro.

Man hinh check-in:

- Khi so dien thoai trung nhieu ho so, UI khong nen auto check-in theo tai khoan nguoi dat ho.
- Neu backend tra ve truong hop mo ho/khong khop ten, UI can hien trang thai can xac minh va yeu cau le tan chon dung benh nhan.

## 2. LT-10 - Le tan cap nhat thong tin hanh chinh ho so benh nhan co audit

### Backend da hoan thanh

Muc tieu cua LT-10 la cho le tan sua thong tin hanh chinh cua ho so benh nhan, nhung khong duoc sua truong chuyen mon va phai co ly do/audit.

File da thay doi:

- `backend/src/controllers/receptionist/patient-intake.controller.js`
- `backend/src/routes/receptionist/patient-intake.routes.js`
- `backend/tests/receptionist.lt10-patient-profile-update.test.js`

API da them:

- `PATCH /api/receptionist/patient-intake/profiles/:id`
- `GET /api/receptionist/patient-intake/profiles/:id/audit`

Truong hanh chinh le tan duoc sua:

- `ho_ten`
- `so_dien_thoai`
- `ngay_sinh`
- `gioi_tinh`
- `nhom_mau`
- `di_ung`
- `benh_nen`
- `dia_chi`
- `ghi_chu`

Rang buoc da them:

- Bat buoc co `ly_do` hoac `ly_do_cap_nhat`.
- Tu choi truong chuyen mon/khong hop le bang 403.
- Chuan hoa so dien thoai vao `so_dien_thoai` va `so_dien_thoai_tim_kiem`.
- Validate gioi tinh, nhom mau, ngay sinh.
- Tu choi request khong co thay doi thuc te.
- Ghi audit vao `NhatKyThaoTac` voi action `UPDATE_PATIENT_PROFILE_ADMINISTRATIVE`.
- Audit ghi before/after theo tung field thay doi.
- Khong sua snapshot lich su kham cu.

Test lien quan:

- `backend/tests/receptionist.lt10-patient-profile-update.test.js`

Ket qua test muc tieu:

- 4/4 test LT-10 pass.

### UI le tan can bo sung

Man hinh ho so benh nhan:

- Them nut/screen "Sua thong tin hanh chinh" tren chi tiet ho so benh nhan.
- Form chi hien/cho sua cac truong hanh chinh duoc backend cho phep.
- Khong hien cac truong chuyen mon trong form sua cua le tan, vi backend se chan.
- Bat buoc nhap ly do cap nhat truoc khi submit.
- Can hien preview thay doi truoc khi luu, vi backend se ghi audit before/after.
- Sau khi luu thanh cong, refresh lai thong tin ho so hien tai.

Man hinh audit ho so:

- Them tab/section "Lich su cap nhat" hoac icon lich su trong chi tiet ho so.
- Goi `GET /api/receptionist/patient-intake/profiles/:id/audit`.
- Hien actor, thoi gian, ly do, danh sach truong da thay doi, gia tri truoc/sau.
- Can phan biet audit le tan sua hanh chinh voi cac audit khac neu UI dung chung lich su thao tac.

Xu ly loi UI:

- 400: hien loi validate field/ly do.
- 403: hien thong bao le tan khong co quyen sua truong chuyen mon.
- 404: ho so khong ton tai/khong hoat dong.
- 409 hoac thong bao no-op neu backend bao khong co thay doi.

## 3. LT-11 - Le tan yeu cau sua benh an, chan sua truc tiep noi dung chuyen mon

### Backend da hoan thanh

Muc tieu cua LT-11 la le tan khong duoc sua truc tiep ket qua kham/benh an, nhung co the gui yeu cau cho bac si sua lai, co audit va trang thai ro rang.

File da them/thay doi:

- `backend/src/controllers/receptionist/medical-record.controller.js`
- `backend/src/routes/receptionist/medical-record.routes.js`
- `backend/src/routes/receptionist/index.js`
- `backend/src/controllers/admin/medical-read.controller.js`
- `backend/src/routes/admin/medical-read.routes.js`
- `backend/src/controllers/doctor/appointments.controller.js`
- `backend/tests/receptionist.lt11-medical-record-revision.test.js`

API le tan da them:

- `POST /api/receptionist/medical-records/:id/revision-requests`
- `PATCH /api/receptionist/medical-records/:id`

Trong do:

- `POST /revision-requests` dung de gui yeu cau bac si sua benh an.
- `PATCH /:id` cua le tan luon bi chan 403 neu muon sua truc tiep benh an.

Truong chuyen mon bi chan doi voi le tan:

- `chan_doan`
- `huong_dan_dieu_tri`
- `ghi_chu`
- `ngay_tai_kham`
- `thuoc`
- `don_thuoc`
- `sinh_hieu`
- `dich_vu_phat_sinh`

Rang buoc yeu cau sua benh an:

- Bat buoc co `ly_do` hoac `ly_do_chinh_sua`.
- Khong tao yeu cau cho ho so dang `ban_nhap`.
- Khong tao trung neu ho so da o trang thai `yeu_cau_chinh_sua`.
- Cap nhat `KetQuaKham.status = 'yeu_cau_chinh_sua'`.
- Ghi `doctor_revision_note`.
- Them entry vao `lich_su_sua`.
- Neu la lich online va lich chua bi huy/no-show, cap nhat `LichHen.status = 'waiting_record'`.
- Ghi audit `REQUEST_MEDICAL_RECORD_REVISION`.

Thay doi lien quan bac si:

- Khi bac si sua lai ho so sau yeu cau chinh sua, backend ghi audit `DOCTOR_REVISE_MEDICAL_RECORD`.
- Ho so trang thai `yeu_cau_chinh_sua` sau khi bac si sua se quay ve `cho_xac_nhan` theo luong hien co.

Thay doi lien quan admin:

- Them API admin override co kiem soat:
  - `PATCH /api/admin/medical-read/exam-results/:id/override`
- Admin override bat buoc co ly do.
- Admin chi duoc override cac truong:
  - `chan_doan`
  - `huong_dan_dieu_tri`
  - `ghi_chu`
  - `ngay_tai_kham`
- Admin khong duoc sua/xoa `lich_su_sua`.
- Ghi audit `ADMIN_OVERRIDE_MEDICAL_RECORD`.

Test lien quan:

- `backend/tests/receptionist.lt11-medical-record-revision.test.js`

Ket qua test muc tieu:

- 4/4 test LT-11 pass.

### UI le tan can bo sung

Man hinh chi tiet ket qua kham/benh an:

- Khong cho le tan sua truc tiep cac truong chuyen mon.
- Neu UI dang co nut "Sua benh an" cho le tan, can doi thanh "Yeu cau bac si chinh sua".
- Them modal/form yeu cau chinh sua gom:
  - Ly do can chinh sua.
  - Ghi chu noi dung nghi ngo/sai sot neu can.
  - Nut gui yeu cau.
- Submit den `POST /api/receptionist/medical-records/:id/revision-requests`.

Trang thai ho so:

- Hien badge/trang thai `yeu_cau_chinh_sua` tren danh sach va chi tiet ho so.
- Hien thong bao ro rang rang ho so dang cho bac si chinh sua.
- Neu lich hen lien quan bi chuyen `waiting_record`, UI can hien trang thai cho ho so/cho ket qua.

Danh sach can theo doi:

- Them filter ho so/ket qua kham dang `yeu_cau_chinh_sua`.
- Them filter lich hen `waiting_record` neu danh sach le tan co hien trang thai nay.
- Them cot/tooltip hien ly do yeu cau chinh sua gan nhat neu backend response co tra ve.

Xu ly loi UI:

- 400: thieu ly do hoac payload khong hop le.
- 403: le tan dang co gang sua truc tiep noi dung chuyen mon.
- 404: khong tim thay ket qua kham.
- 409: ho so dang o trang thai khong the tao yeu cau hoac da co yeu cau chinh sua.

## 4. Checklist UI nen lam tiep

Do uu tien cao:

- Dat lich tai quay: danh sach chon dung benh nhan khi trung so dien thoai.
- Check-in: trang thai can xac minh khi so dien thoai/nguoi dat ho khong khop ho so.
- Ho so benh nhan: form sua thong tin hanh chinh co ly do.
- Ho so benh nhan: lich su audit cap nhat hanh chinh.
- Benh an/ket qua kham: nut "Yeu cau bac si chinh sua" thay vi cho le tan sua truc tiep.
- Danh sach ket qua kham: badge/filter `yeu_cau_chinh_sua`.

Do uu tien trung binh:

- Hien timeline thao tac gom audit hanh chinh, yeu cau chinh sua, bac si sua lai, admin override.
- Hien diff before/after trong audit bang table de de kiem tra.
- Toast/thong bao loi rieng cho 400/403/404/409.

Do uu tien thap:

- Them export audit theo ho so neu can cho nghiep vu.
- Them tooltip giai thich truong nao le tan khong co quyen sua.

## 5. Ket qua kiem thu hien tai

Da chay:

- Syntax check cac controller/routes lien quan: pass.
- Targeted test cho LT-07/LT-10/LT-11: 12/12 pass.

Lenh targeted test:

```bash
cd backend
node --test tests/receptionist.lt07-shared-phone.test.js tests/receptionist.lt10-patient-profile-update.test.js tests/receptionist.lt11-medical-record-revision.test.js
```

Ket qua full backend test:

- `npm test` hien fail 61/81 do nhieu integration test goi API bang `fetch` khi backend server `localhost:5000` khong chay.
- Trong cung full run do, cac test LT-07, LT-10, LT-11 deu pass.

