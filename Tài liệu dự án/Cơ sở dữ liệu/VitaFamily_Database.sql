-- ============================================================
-- CO SO DU LIEU: VitaFamily - He Thong Quan Ly Cham Soc Suc Khoe
-- Phien ban: 1.0
-- Ngay tao: 06/06/2026
-- Mo ta: Schema day du khop voi 20 chuc nang da dac ta
-- Bo ma: UTF-8mb4 (ho tro tieng Viet)
-- ============================================================

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET time_zone = '+07:00';

CREATE DATABASE IF NOT EXISTS vitafamily
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vitafamily;

-- TAT CA BANG DUOC TAO THEO THU TU PHU THUOC KHOA NGOAI
-- (bang khong co FK truoc, bang co FK sau)


-- ============================================================
-- NHOM 1: TAI KHOAN & XAC THUC
-- ============================================================

-- BANG: users
-- Luu tru tai khoan nguoi dung: benh nhan, bac si, admin
-- Role chi doi sang 'doctor' sau khi Admin duyet ho so bac si (C2)
CREATE TABLE users (
  id              INT           NOT NULL AUTO_INCREMENT,
  email           VARCHAR(255)  NOT NULL COMMENT 'Email dang nhap - duy nhat trong he thong - khong doi sau khi dang ky',
  mat_khau        VARCHAR(255)  NOT NULL COMMENT 'Bcrypt hash 10 rounds - khong luu mat khau goc',
  ho_ten          VARCHAR(255)  NOT NULL COMMENT 'Ho va ten day du',
  so_dien_thoai   VARCHAR(20)   NULL     COMMENT 'So dien thoai - khong bat buoc - khong phai unique',
  anh_dai_dien    VARCHAR(500)  NULL     COMMENT 'URL anh dai dien (luu tren server hoac cloud)',
  role            ENUM('user','doctor','admin') NOT NULL DEFAULT 'user'
                                         COMMENT 'user=benh nhan, doctor=bac si da duyet, admin=quan tri',
  status          ENUM('active','locked') NOT NULL DEFAULT 'active'
                                         COMMENT 'active=hoat dong, locked=bi khoa boi Admin',
  ngay_tao        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  INDEX idx_users_role (role),
  INDEX idx_users_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tai khoan nguoi dung - benh nhan / bac si / admin';


-- BANG: password_resets
-- Luu ma OTP 6 chu so de dat lai mat khau qua email
-- Moi lan gui moi: OTP cu bi danh dau da_su_dung = TRUE truoc khi tao moi
CREATE TABLE password_resets (
  id            INT           NOT NULL AUTO_INCREMENT,
  user_id       INT           NOT NULL COMMENT 'Tai khoan yeu cau doi mat khau',
  ma_otp        VARCHAR(6)    NOT NULL COMMENT 'Ma OTP 6 chu so',
  het_han       DATETIME      NOT NULL COMMENT 'Thoi diem het han - 15 phut sau khi tao',
  da_su_dung    TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '0=chua dung, 1=da dung hoac bi invalidate',
  ngay_tao      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_pr_user_id (user_id),
  INDEX idx_pr_otp (ma_otp),
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='OTP quen mat khau - het han 15 phut - chi dung 1 lan';


-- ============================================================
-- NHOM 2: DU LIEU DANH MUC (khong co FK den nhom khac)
-- ============================================================

-- BANG: hospitals
-- Danh sach benh vien va phong kham lien ket
-- Ten benh vien phai duy nhat trong he thong
CREATE TABLE hospitals (
  id              INT           NOT NULL AUTO_INCREMENT,
  ten             VARCHAR(255)  NOT NULL COMMENT 'Ten benh vien / phong kham - duy nhat',
  dia_chi         TEXT          NULL     COMMENT 'Dia chi day du',
  so_dien_thoai   VARCHAR(20)   NULL     COMMENT 'So dien thoai lien he',
  email           VARCHAR(255)  NULL     COMMENT 'Email lien he',
  gio_lam_viec    VARCHAR(255)  NULL     COMMENT 'Vi du: 8:00-17:00 Thu2-Thu7',
  mo_ta           TEXT          NULL     COMMENT 'Gioi thieu chung ve co so y te',
  status          ENUM('active','hidden') NOT NULL DEFAULT 'active'
                                         COMMENT 'active=hien thi, hidden=an - an khong xoa lich hen cu',
  ngay_tao        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_hospitals_ten (ten),
  INDEX idx_hospitals_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Danh sach benh vien / phong kham lien ket voi he thong';


-- BANG: specialties
-- Danh sach chuyen khoa y te
-- Slug tu dong tao tu ten - xu ly trung bang cach them so phia sau
CREATE TABLE specialties (
  id        INT           NOT NULL AUTO_INCREMENT,
  ten       VARCHAR(255)  NOT NULL COMMENT 'Ten chuyen khoa - vi du: Tim mach, Nhi khoa',
  mo_ta     TEXT          NULL     COMMENT 'Mo ta chi tiet chuyen khoa',
  icon_url  VARCHAR(500)  NULL     COMMENT 'URL icon hien thi tren giao dien',
  slug      VARCHAR(255)  NOT NULL COMMENT 'URL-friendly - tu dong tao - vi du: tim-mach',
  thu_tu    INT           NOT NULL DEFAULT 0 COMMENT 'Thu tu hien thi tren trang tim kiem',
  status    ENUM('active','hidden') NOT NULL DEFAULT 'active'
                                   COMMENT 'active=hien thi, hidden=an khoi tim kiem',
  ngay_tao  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_specialties_slug (slug),
  INDEX idx_specialties_status (status),
  INDEX idx_specialties_thu_tu (thu_tu)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Chuyen khoa y te - bac si chon khi dang ky ho so';


-- BANG: services
-- Cac goi dich vu kham (dac biet la kham tai nha)
-- Gia dich vu duoc snapshot vao appointment khi dat lich - thay doi gia sau khong anh huong lich cu
CREATE TABLE services (
  id            INT             NOT NULL AUTO_INCREMENT,
  ten           VARCHAR(255)    NOT NULL COMMENT 'Ten goi dich vu',
  mo_ta         TEXT            NULL     COMMENT 'Mo ta chi tiet dich vu',
  gia           DECIMAL(10,2)   NOT NULL COMMENT 'Gia dich vu - phai lon hon 0',
  thoi_gian_phut INT            NULL     COMMENT 'Thoi gian thuc hien tinh bang phut',
  specialty_id  INT             NULL     COMMENT 'Chuyen khoa lien quan - tuy chon',
  status        ENUM('active','inactive') NOT NULL DEFAULT 'active'
                                          COMMENT 'inactive=an khoi trang dat lich - lich cu khong bi anh huong',
  ngay_tao      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_services_status (status),
  CONSTRAINT fk_services_specialty FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE SET NULL,
  CONSTRAINT chk_services_gia CHECK (gia > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Goi dich vu kham - tuy chon khi dat lich hinh thuc tai nha';


-- BANG: payment_settings
-- Cau hinh chinh sach hoan tien va phi hoa hong - khong hardcode trong code
CREATE TABLE payment_settings (
  id          INT           NOT NULL AUTO_INCREMENT,
  ten_cai_dat VARCHAR(100)  NOT NULL COMMENT 'Key cai dat - duy nhat',
  gia_tri     VARCHAR(255)  NOT NULL COMMENT 'Gia tri - luu dang string, convert khi dung',
  mo_ta       VARCHAR(500)  NULL     COMMENT 'Giai thich y nghia cai dat',
  ngay_cap_nhat TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_settings_key (ten_cai_dat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Cau hinh thanh toan - hoan tien - phi hoa hong';


-- ============================================================
-- NHOM 3: GIA DINH & THANH VIEN
-- ============================================================

-- BANG: families
-- Nhom gia dinh - 1 tai khoan chi co 1 nhom gia dinh
CREATE TABLE families (
  id        INT           NOT NULL AUTO_INCREMENT,
  user_id   INT           NOT NULL COMMENT 'Chu tai khoan - chu ho cua nhom',
  ten_nhom  VARCHAR(255)  NOT NULL COMMENT 'Ten nhom - vi du: Gia dinh Nguyen',
  ngay_tao  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_families_user_id (user_id)  COMMENT '1 tai khoan chi co 1 nhom gia dinh',
  CONSTRAINT fk_families_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Nhom gia dinh - 1 tai khoan 1 nhom';


-- BANG: members
-- Thanh vien trong nhom gia dinh
-- Chu ho (la_chu_ho=1) khong the xoa
-- Xoa thanh vien dung soft delete (ngay_xoa) - giu lai du lieu y te
-- Toi da 10 thanh vien moi nhom (kiem tra o tang ung dung)
CREATE TABLE members (
  id          INT             NOT NULL AUTO_INCREMENT,
  family_id   INT             NOT NULL COMMENT 'Thuoc nhom gia dinh nao',
  ho_ten      VARCHAR(255)    NOT NULL COMMENT 'Ho ten thanh vien',
  ngay_sinh   DATE            NOT NULL COMMENT 'Ngay sinh - phai la ngay trong qua khu',
  gioi_tinh   ENUM('nam','nu','khac') NOT NULL COMMENT 'Gioi tinh',
  nhom_mau    ENUM('A','B','AB','O') NULL COMMENT 'Nhom mau - tuy chon',
  di_ung      TEXT            NULL     COMMENT 'Thong tin di ung - bac si xem truoc khi kham',
  benh_nen    TEXT            NULL     COMMENT 'Benh nen / tien su benh - bac si xem truoc khi kham',
  la_chu_ho   TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1=chu ho - khong duoc xoa',
  ngay_xoa    DATETIME        NULL     COMMENT 'Soft delete - NULL=con ton tai, co gia tri=da xoa',
  ngay_tao    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_members_family_id (family_id),
  INDEX idx_members_ngay_xoa (ngay_xoa),
  INDEX idx_members_la_chu_ho (la_chu_ho),
  CONSTRAINT fk_members_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Thanh vien gia dinh - toi da 10/nhom - chu ho khong xoa duoc - xoa la soft delete';


-- ============================================================
-- NHOM 4: HO SO BAC SI
-- ============================================================

-- BANG: doctors
-- Ho so chuyen mon cua bac si
-- trang_thai_duyet: pending (moi nop) -> approved (Admin duyet) -> suspended (dinh chi)
--                   pending -> rejected (Admin tu choi, bac si co the nop lai toi da 5 lan)
-- users.role doi thanh 'doctor' cung 1 transaction khi Admin duyet (C2)
CREATE TABLE doctors (
  id                  INT             NOT NULL AUTO_INCREMENT,
  user_id             INT             NOT NULL COMMENT 'Lien ket den tai khoan - 1 tai khoan 1 ho so bac si',
  tieu_su             TEXT            NULL     COMMENT 'Gioi thieu ban than',
  bang_cap            TEXT            NULL     COMMENT 'Bang cap - chung chi hanh nghe',
  kinh_nghiem         TEXT            NULL     COMMENT 'Mo ta kinh nghiem lam viec',
  so_nam_kinh_nghiem  INT             NOT NULL DEFAULT 0 COMMENT 'So nam kinh nghiem',
  phi_tu_van          DECIMAL(10,2)   NOT NULL DEFAULT 0.00
                                               COMMENT 'Phi tu van tinh tren moi luot kham - 0 = mien phi',
  trang_thai_duyet    ENUM('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending'
                                               COMMENT 'pending=cho duyet, approved=da duyet, rejected=bi tu choi, suspended=dinh chi',
  ly_do_tu_choi       TEXT            NULL     COMMENT 'Ly do khi Admin tu choi hoac dinh chi ho so',
  so_lan_nop          INT             NOT NULL DEFAULT 1 COMMENT 'So lan nop / nop lai ho so - toi da 5 lan',
  la_hien             TINYINT(1)      NOT NULL DEFAULT 1 COMMENT '1=hien thi cong khai, 0=an - lich cu khong anh huong',
  diem_danh_gia       DECIMAL(3,2)    NOT NULL DEFAULT 0.00
                                               COMMENT 'Diem danh gia trung binh (1-5) - tu dong cap nhat khi review thay doi',
  tong_danh_gia       INT             NOT NULL DEFAULT 0 COMMENT 'Tong so danh gia visible',
  ngay_tao            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_doctors_user_id (user_id) COMMENT '1 tai khoan chi co 1 ho so bac si',
  INDEX idx_doctors_trang_thai_duyet (trang_thai_duyet),
  INDEX idx_doctors_la_hien (la_hien),
  CONSTRAINT fk_doctors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_doctors_phi CHECK (phi_tu_van >= 0),
  CONSTRAINT chk_doctors_so_lan_nop CHECK (so_lan_nop <= 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ho so chuyen mon bac si - phai duoc Admin duyet truoc khi nhan benh nhan';


-- BANG: doctor_specialties
-- Lien ket nhieu-nhieu: bac si - chuyen khoa
CREATE TABLE doctor_specialties (
  doctor_id     INT NOT NULL COMMENT 'Bac si',
  specialty_id  INT NOT NULL COMMENT 'Chuyen khoa',

  PRIMARY KEY (doctor_id, specialty_id),
  CONSTRAINT fk_ds_doctor    FOREIGN KEY (doctor_id)    REFERENCES doctors(id)     ON DELETE CASCADE,
  CONSTRAINT fk_ds_specialty FOREIGN KEY (specialty_id) REFERENCES specialties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lien ket bac si voi chuyen khoa (nhieu-nhieu)';


-- BANG: doctor_hospitals
-- Lien ket nhieu-nhieu: bac si - benh vien cong tac
CREATE TABLE doctor_hospitals (
  doctor_id   INT NOT NULL COMMENT 'Bac si',
  hospital_id INT NOT NULL COMMENT 'Benh vien cong tac',

  PRIMARY KEY (doctor_id, hospital_id),
  CONSTRAINT fk_dh_doctor   FOREIGN KEY (doctor_id)   REFERENCES doctors(id)   ON DELETE CASCADE,
  CONSTRAINT fk_dh_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lien ket bac si voi benh vien cong tac (nhieu-nhieu)';


-- BANG: doctor_schedules
-- Lich lam viec theo tung ngay cua bac si
-- Moi bac si moi ngay chi co 1 lich (UNIQUE: doctor_id + ngay)
-- Khong tao lich cho ngay trong qua khu (kiem tra o tang ung dung)
CREATE TABLE doctor_schedules (
  id          INT       NOT NULL AUTO_INCREMENT,
  doctor_id   INT       NOT NULL COMMENT 'Bac si so huu lich lam viec',
  ngay        DATE      NOT NULL COMMENT 'Ngay lam viec - phai tu hom nay tro di',
  ngay_tao    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_schedule_doctor_ngay (doctor_id, ngay) COMMENT 'Moi bac si moi ngay chi co 1 lich',
  INDEX idx_schedule_ngay (ngay),
  CONSTRAINT fk_schedule_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lich lam viec theo ngay - moi bac si moi ngay 1 lich';


-- BANG: slots
-- Khung gio kham trong mot ngay lam viec
-- Hai slot khong duoc giao nhau gio trong cung 1 ngay (kiem tra overlap o tang ung dung)
-- Dung SELECT FOR UPDATE khi tang so_benh_nhan_hien_tai de tranh race condition
CREATE TABLE slots (
  id                      INT       NOT NULL AUTO_INCREMENT,
  schedule_id             INT       NOT NULL COMMENT 'Thuoc lich ngay nao',
  gio_bat_dau             TIME      NOT NULL COMMENT 'Gio bat dau kham',
  gio_ket_thuc            TIME      NOT NULL COMMENT 'Gio ket thuc kham - phai lon hon gio_bat_dau',
  so_benh_nhan_toi_da     INT       NOT NULL COMMENT 'Toi da bao nhieu benh nhan - toi thieu 1',
  so_benh_nhan_hien_tai   INT       NOT NULL DEFAULT 0
                                             COMMENT 'Dang co bao nhieu benh nhan da dat - tu dong tang/giam',
  ngay_tao                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_slots_schedule_id (schedule_id),
  CONSTRAINT fk_slots_schedule FOREIGN KEY (schedule_id) REFERENCES doctor_schedules(id) ON DELETE CASCADE,
  CONSTRAINT chk_slots_gio CHECK (gio_ket_thuc > gio_bat_dau),
  CONSTRAINT chk_slots_so_toi_da CHECK (so_benh_nhan_toi_da >= 1),
  CONSTRAINT chk_slots_so_hien_tai CHECK (so_benh_nhan_hien_tai >= 0),
  CONSTRAINT chk_slots_khong_vuot_toi_da
    CHECK (so_benh_nhan_hien_tai <= so_benh_nhan_toi_da)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Khung gio kham - dung SELECT FOR UPDATE khi cap nhat so_benh_nhan_hien_tai';


-- ============================================================
-- NHOM 5: LICH HEN & THANH TOAN
-- ============================================================

-- BANG: appointments
-- Lich hen kham - bang trung tam cua he thong
-- member_id = NULL neu la khach (guest) - luu ten_khach, so_dien_thoai_khach, nam_sinh_khach thay the
-- gia_kham = snapshot phi_tu_van luc dat lich - thay doi gia bac si sau khong anh huong
-- payment_status: unpaid (moi tao) -> paid (sau thanh toan) -> refunded (sau hoan tien)
-- Luu y: appointment unpaid qua 15 phut se tu dong bi huy boi cron job
CREATE TABLE appointments (
  id                    INT             NOT NULL AUTO_INCREMENT,
  user_id               INT             NOT NULL COMMENT 'Benh nhan dat lich',
  member_id             INT             NULL     COMMENT 'Thanh vien duoc kham - NULL neu la khach',
  doctor_id             INT             NOT NULL COMMENT 'Bac si duoc dat',
  hospital_id           INT             NOT NULL COMMENT 'Benh vien dien ra',
  slot_id               INT             NOT NULL COMMENT 'Khung gio dat - de tang/giam so_benh_nhan_hien_tai',
  service_id            INT             NULL     COMMENT 'Goi dich vu su dung - tuy chon',
  loai_kham             ENUM('clinic','home','video') NOT NULL
                                                 COMMENT 'clinic=tai vien, home=tai nha, video=tu van video',
  ngay_kham             DATE            NOT NULL COMMENT 'Ngay hen kham',
  gio_kham              TIME            NOT NULL COMMENT 'Gio hen kham',
  ly_do_kham            TEXT            NULL     COMMENT 'Ly do / trieu chung - toi da 500 ky tu',
  status                ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending'
                                                 COMMENT 'pending=cho xac nhan, confirmed=da xac nhan, completed=da kham xong, cancelled=da huy',
  payment_status        ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid'
                                                 COMMENT 'unpaid=chua thanh toan, paid=da thanh toan, refunded=da hoan tien',
  gia_kham              DECIMAL(10,2)   NOT NULL DEFAULT 0.00
                                                 COMMENT 'Snapshot phi tu van luc dat lich - khong thay doi theo gia bac si',
  ly_do_huy             TEXT            NULL     COMMENT 'Ly do huy lich - bat buoc khi huy',
  -- Thong tin khach (chi dung khi member_id = NULL)
  ten_khach             VARCHAR(255)    NULL     COMMENT 'Ten nguoi kham neu la khach',
  so_dien_thoai_khach   VARCHAR(20)     NULL     COMMENT 'SĐT khach de lien he',
  nam_sinh_khach        YEAR            NULL     COMMENT 'Nam sinh khach',
  ngay_tao              TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_appt_user_id (user_id),
  INDEX idx_appt_doctor_id (doctor_id),
  INDEX idx_appt_status (status),
  INDEX idx_appt_payment_status (payment_status),
  INDEX idx_appt_ngay_kham (ngay_kham),
  INDEX idx_appt_slot_id (slot_id),
  -- Dieu huong nhanh cho man hinh bac si
  INDEX idx_appt_doctor_status_ngay (doctor_id, status, ngay_kham),
  CONSTRAINT fk_appt_user     FOREIGN KEY (user_id)     REFERENCES users(id)      ON DELETE RESTRICT,
  CONSTRAINT fk_appt_member   FOREIGN KEY (member_id)   REFERENCES members(id)    ON DELETE SET NULL,
  CONSTRAINT fk_appt_doctor   FOREIGN KEY (doctor_id)   REFERENCES doctors(id)    ON DELETE RESTRICT,
  CONSTRAINT fk_appt_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_appt_slot     FOREIGN KEY (slot_id)     REFERENCES slots(id)      ON DELETE RESTRICT,
  CONSTRAINT fk_appt_service  FOREIGN KEY (service_id)  REFERENCES services(id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lich hen kham - bang trung tam - unpaid qua 15 phut tu huy boi cron';


-- BANG: payments
-- Thanh toan mock (VitaPay) - 1 lich hen 1 thanh toan
-- Luu y: tao appointment truoc (unpaid) - sau do benh nhan thanh toan moi cap nhat
CREATE TABLE payments (
  id                INT             NOT NULL AUTO_INCREMENT,
  appointment_id    INT             NOT NULL COMMENT 'Lich hen lien quan - 1-1',
  benh_nhan_id      INT             NOT NULL COMMENT 'Benh nhan thanh toan',
  so_tien           DECIMAL(10,2)   NOT NULL COMMENT 'So tien thanh toan = gia_kham cua appointment',
  status            ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending'
                                            COMMENT 'pending=cho xu ly, paid=da thanh toan, failed=that bai, refunded=da hoan',
  phuong_thuc       VARCHAR(50)     NOT NULL DEFAULT 'mock' COMMENT 'Phuong thuc thanh toan - mac dinh: mock (VitaPay)',
  ngay_thanh_toan   DATETIME        NULL     COMMENT 'Thoi diem thanh toan thanh cong',
  ngay_tao          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_appointment_id (appointment_id) COMMENT '1 lich hen chi co 1 payment',
  INDEX idx_payments_benh_nhan_id (benh_nhan_id),
  INDEX idx_payments_status (status),
  CONSTRAINT fk_payments_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_benh_nhan   FOREIGN KEY (benh_nhan_id)   REFERENCES users(id)        ON DELETE RESTRICT,
  CONSTRAINT chk_payments_so_tien    CHECK (so_tien >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Thanh toan mock - 1 lich hen 1 payment';


-- BANG: refunds
-- Yeu cau hoan tien sau khi huy lich
-- Phan tram hoan tien tinh theo chinh sach thoi gian (lay tu payment_settings)
-- 1 lich hen chi co 1 refund - refund bi rejected khong the tao lai
CREATE TABLE refunds (
  id              INT             NOT NULL AUTO_INCREMENT,
  payment_id      INT             NOT NULL COMMENT 'Payment duoc hoan tien',
  appointment_id  INT             NOT NULL COMMENT 'Lich hen bi huy - 1-1',
  so_tien_hoan    DECIMAL(10,2)   NOT NULL COMMENT 'So tien thuc te duoc hoan',
  phan_tram_hoan  TINYINT         NOT NULL COMMENT 'Phan tram hoan tien: 0/50/80/100',
  ly_do           TEXT            NULL     COMMENT 'Ly do huy lich dan den viec hoan tien',
  status          ENUM('pending','completed','rejected') NOT NULL DEFAULT 'pending'
                                           COMMENT 'pending=cho Admin duyet, completed=da hoan, rejected=bi tu choi',
  ly_do_tu_choi   TEXT            NULL     COMMENT 'Ly do Admin tu choi hoan tien - bat buoc khi tu choi',
  xu_ly_boi       INT             NULL     COMMENT 'Admin xu ly yeu cau hoan tien',
  ngay_yeu_cau    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_xu_ly      DATETIME        NULL     COMMENT 'Khi Admin duyet hoac tu choi',

  PRIMARY KEY (id),
  UNIQUE KEY uq_refunds_appointment_id (appointment_id) COMMENT '1 lich hen chi co 1 refund',
  INDEX idx_refunds_status (status),
  INDEX idx_refunds_payment_id (payment_id),
  CONSTRAINT fk_refunds_payment     FOREIGN KEY (payment_id)     REFERENCES payments(id)     ON DELETE RESTRICT,
  CONSTRAINT fk_refunds_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE RESTRICT,
  CONSTRAINT fk_refunds_xu_ly_boi   FOREIGN KEY (xu_ly_boi)      REFERENCES users(id)        ON DELETE SET NULL,
  CONSTRAINT chk_refunds_phan_tram  CHECK (phan_tram_hoan IN (0, 50, 80, 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Hoan tien - 1 lich 1 refund - rejected thi khong tao lai duoc';


-- ============================================================
-- NHOM 6: HO SO Y TE
-- ============================================================

-- BANG: medical_records
-- Ho so kham benh theo tung thanh vien
-- nguon: 'tu_kham'=tu appointment (bac si ghi qua B4), 'thu_cong'=benh nhan tu nhap
-- member_id co the NULL neu la lich hen khach (guest) - luu ten_khach thay the
-- Ho so tu appointment KHONG the xoa/sua boi benh nhan
CREATE TABLE medical_records (
  id              INT           NOT NULL AUTO_INCREMENT,
  member_id       INT           NULL     COMMENT 'Thanh vien so huu ho so - NULL neu la lich hen khach',
  appointment_id  INT           NULL     COMMENT 'Lich hen tao ra ho so - NULL neu benh nhan tu nhap',
  ten_khach       VARCHAR(255)  NULL     COMMENT 'Ten nguoi kham neu member_id = NULL (lich khach)',
  ngay_kham       DATE          NOT NULL COMMENT 'Ngay kham - khong duoc la ngay tuong lai',
  ten_benh_vien   VARCHAR(255)  NULL     COMMENT 'Ten co so y te',
  ten_bac_si      VARCHAR(255)  NULL     COMMENT 'Ten bac si kham',
  ly_do_kham      TEXT          NULL     COMMENT 'Ly do den kham',
  chan_doan       TEXT          NULL     COMMENT 'Ket qua chan doan',
  ghi_chu         TEXT          NULL     COMMENT 'Ghi chu dieu tri them',
  nguon           ENUM('tu_kham','thu_cong') NOT NULL DEFAULT 'tu_kham'
                                         COMMENT 'tu_kham=tu appointment B4, thu_cong=benh nhan tu nhap',
  ngay_tao        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_mr_member_id (member_id),
  INDEX idx_mr_appointment_id (appointment_id),
  INDEX idx_mr_ngay_kham (ngay_kham),
  CONSTRAINT fk_mr_member      FOREIGN KEY (member_id)      REFERENCES members(id)      ON DELETE SET NULL,
  CONSTRAINT fk_mr_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ho so kham benh - nguon tu_kham khong cho benh nhan sua/xoa';


-- BANG: examination_results
-- Ket qua chi tiet sau khi bac si kham xong (B4)
-- 1 lich hen 1 ket qua - bac si co the sua trong 24h dau (co_the_sua = TRUE)
-- Sau 24h: co_the_sua = FALSE - ket qua bi khoa
CREATE TABLE examination_results (
  id                  INT         NOT NULL AUTO_INCREMENT,
  appointment_id      INT         NOT NULL COMMENT 'Lich hen lien quan - 1-1',
  chan_doan           TEXT        NOT NULL COMMENT 'Chan doan chinh - bat buoc khong de trong',
  huong_dan_dieu_tri  TEXT        NULL     COMMENT 'Huong dan dieu tri / ghi chu cho benh nhan',
  ghi_chu             TEXT        NULL     COMMENT 'Ghi chu them cua bac si',
  ngay_tai_kham       DATE        NULL     COMMENT 'Ngay tai kham - tuy chon',
  co_the_sua          TINYINT(1)  NOT NULL DEFAULT 1
                                           COMMENT '1=co the sua (trong 24h dau), 0=da bi khoa sau 24h',
  ngay_tao            TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_cap_nhat       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_er_appointment_id (appointment_id) COMMENT '1 lich hen 1 ket qua kham',
  CONSTRAINT fk_er_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Ket qua kham bac si ghi - co the sua trong 24h - sau do bi khoa';


-- ============================================================
-- NHOM 7: DON THUOC & NHAC NHO
-- ============================================================

-- BANG: prescriptions
-- Don thuoc - co the do bac si ke hoac benh nhan tu nhap
-- member_id bat buoc - moi don thuoc phai gan voi 1 thanh vien cu the
-- medical_record_id co the NULL neu la don tu nhap doc lap
-- nguon: 'bac_si'=khong xoa duoc boi benh nhan, 'tu_nhap'=benh nhan quan ly
CREATE TABLE prescriptions (
  id                  INT       NOT NULL AUTO_INCREMENT,
  medical_record_id   INT       NULL     COMMENT 'Ho so kham lien quan - NULL neu don tu nhap',
  member_id           INT       NOT NULL COMMENT 'Thanh vien uong thuoc - bat buoc',
  doctor_id           INT       NULL     COMMENT 'Bac si ke don - NULL neu tu nhap',
  nguon               ENUM('bac_si','tu_nhap') NOT NULL DEFAULT 'tu_nhap'
                                         COMMENT 'bac_si=bac si ke, tu_nhap=benh nhan tu nhap',
  ghi_chu             TEXT      NULL     COMMENT 'Ghi chu them ve don thuoc',
  ngay_tao            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_pres_member_id (member_id),
  INDEX idx_pres_medical_record_id (medical_record_id),
  CONSTRAINT fk_pres_medical_record FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE SET NULL,
  CONSTRAINT fk_pres_member         FOREIGN KEY (member_id)         REFERENCES members(id)         ON DELETE RESTRICT,
  CONSTRAINT fk_pres_doctor         FOREIGN KEY (doctor_id)         REFERENCES doctors(id)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Don thuoc - toi da 10 loai thuoc - nguon bac_si khong cho benh nhan xoa';


-- BANG: prescription_items
-- Chi tiet tung loai thuoc trong don
-- gio_uong luu dang JSON array - vi du: ["07:00", "12:00", "19:00"]
-- Gioi han: ngay_ket_thuc - ngay_bat_dau toi da 90 ngay
-- Toi da 10 dong trong 1 don thuoc (kiem tra o tang ung dung)
CREATE TABLE prescription_items (
  id              INT           NOT NULL AUTO_INCREMENT,
  prescription_id INT           NOT NULL COMMENT 'Don thuoc chua thuoc nay',
  ten_thuoc       VARCHAR(255)  NOT NULL COMMENT 'Ten thuoc',
  lieu_luong      VARCHAR(100)  NULL     COMMENT 'Lieu dung moi lan - vi du: 1 vien, 5ml',
  tan_suat        VARCHAR(100)  NULL     COMMENT 'Tan suat uong - vi du: 2 lan/ngay',
  gio_uong        JSON          NULL     COMMENT 'Mang gio uong - vi du: ["07:00","19:00"]',
  ngay_bat_dau    DATE          NOT NULL COMMENT 'Ngay bat dau uong thuoc',
  ngay_ket_thuc   DATE          NOT NULL COMMENT 'Ngay ket thuc - toi da 90 ngay sau ngay_bat_dau',

  PRIMARY KEY (id),
  INDEX idx_pi_prescription_id (prescription_id),
  CONSTRAINT fk_pi_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  CONSTRAINT chk_pi_ngay        CHECK (ngay_ket_thuc >= ngay_bat_dau),
  CONSTRAINT chk_pi_90_ngay     CHECK (DATEDIFF(ngay_ket_thuc, ngay_bat_dau) <= 90)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Chi tiet thuoc trong don - toi da 10 dong/don - toi da 90 ngay/don';


-- BANG: reminders
-- Moi dong = 1 lan nhac uong thuoc cu the (ngay + gio)
-- Cron job chay moi 5 phut: pending -> sent (gui email)
-- Cron job cung danh dau sent qua 2 tieng khong xac nhan -> missed
-- Benh nhan xac nhan uong: sent -> taken
CREATE TABLE reminders (
  id                    INT         NOT NULL AUTO_INCREMENT,
  prescription_item_id  INT         NOT NULL COMMENT 'Thuoc nao can nhac',
  user_id               INT         NOT NULL COMMENT 'Nguoi dung nhan nhac (gui email)',
  gio_nhac              DATETIME    NOT NULL COMMENT 'Thoi diem nhac chinh xac',
  status                ENUM('pending','sent','taken','missed') NOT NULL DEFAULT 'pending'
                                             COMMENT 'pending=chua gui, sent=da gui email, taken=da uong, missed=bo lo qua 2 tieng',
  ngay_gui              DATETIME    NULL     COMMENT 'Thoi diem gui email thanh cong',
  ngay_tao              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  -- Index quan trong cho cron job chay moi 5 phut
  INDEX idx_rem_cron_pending (status, gio_nhac),
  INDEX idx_rem_cron_missed  (status, ngay_gui),
  INDEX idx_rem_user_id (user_id),
  INDEX idx_rem_item_id (prescription_item_id),
  CONSTRAINT fk_rem_item FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_rem_user FOREIGN KEY (user_id)              REFERENCES users(id)               ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lich nhac uong thuoc - cron 5 phut: pending->sent va sent>2h->missed';


-- ============================================================
-- NHOM 8: DANH GIA
-- ============================================================

-- BANG: reviews
-- Danh gia cua benh nhan sau khi kham xong
-- 1 lich hen 1 danh gia - khong sua lai duoc
-- Khi Admin an/xoa: tu dong cap nhat diem_danh_gia va tong_danh_gia trong bang doctors
-- Bac si KHONG thay duoc danh gia co status = 'hidden'
CREATE TABLE reviews (
  id              INT         NOT NULL AUTO_INCREMENT,
  appointment_id  INT         NOT NULL COMMENT 'Lich hen duoc danh gia - 1-1',
  user_id         INT         NOT NULL COMMENT 'Benh nhan gui danh gia',
  doctor_id       INT         NOT NULL COMMENT 'Bac si duoc danh gia',
  so_sao          TINYINT     NOT NULL COMMENT 'So sao tu 1 den 5',
  noi_dung        TEXT        NULL     COMMENT 'Noi dung nhan xet - tuy chon - toi da 500 ky tu',
  status          ENUM('visible','hidden') NOT NULL DEFAULT 'visible'
                                           COMMENT 'visible=hien thi cong khai, hidden=Admin an - khong hien thi, khong tinh vao rating',
  ngay_tao        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_appointment_id (appointment_id) COMMENT '1 lich hen 1 danh gia',
  INDEX idx_reviews_doctor_id (doctor_id),
  INDEX idx_reviews_status (status),
  INDEX idx_reviews_so_sao (so_sao),
  CONSTRAINT fk_rev_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_user        FOREIGN KEY (user_id)        REFERENCES users(id)        ON DELETE CASCADE,
  CONSTRAINT fk_rev_doctor      FOREIGN KEY (doctor_id)      REFERENCES doctors(id)      ON DELETE CASCADE,
  CONSTRAINT chk_rev_so_sao     CHECK (so_sao BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Danh gia sau kham - 1 lich 1 danh gia - hidden thi khong tinh rating';


-- ============================================================
-- NHOM 9: THONG BAO
-- ============================================================

-- BANG: notifications
-- Thong bao ca nhan cua tung nguoi dung
-- related_id + related_type de dieu huong den dung trang khi click
-- Cleanup tu dong sau 90 ngay doi voi thong bao da doc (cron hang tuan)
CREATE TABLE notifications (
  id            INT           NOT NULL AUTO_INCREMENT,
  user_id       INT           NOT NULL COMMENT 'Nguoi nhan thong bao',
  tieu_de       VARCHAR(255)  NOT NULL COMMENT 'Tieu de hien thi trong danh sach',
  noi_dung      TEXT          NOT NULL COMMENT 'Noi dung day du',
  loai          ENUM('appointment','medicine','system') NOT NULL
                                         COMMENT 'appointment=lich hen, medicine=nhac thuoc, system=tu Admin',
  related_id    INT           NULL       COMMENT 'ID entity lien quan - vi du: appointment_id, reminder_id',
  related_type  VARCHAR(50)   NULL       COMMENT 'Loai entity - vi du: appointment, medical_record, reminder',
  da_doc        TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '0=chua doc, 1=da doc',
  ngay_tao      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_notif_user_id (user_id),
  INDEX idx_notif_da_doc (da_doc),
  -- Index cho cau truy van unread count
  INDEX idx_notif_user_chua_doc (user_id, da_doc),
  -- Index cho cleanup sau 90 ngay
  INDEX idx_notif_ngay_tao (ngay_tao),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Thong bao ca nhan - chua doc khong xoa - da doc xoa sau 90 ngay';


-- BANG: system_notifications
-- Thong bao he thong do Admin tao va gui hang loat (C7)
-- Su dung batch insert 100 records/lan de tranh qua tai
-- Trang thai chi co 'da_gui' vi khong ho tro len lich gui
CREATE TABLE system_notifications (
  id              INT           NOT NULL AUTO_INCREMENT,
  tieu_de         VARCHAR(60)   NOT NULL COMMENT 'Tieu de - toi da 60 ky tu',
  noi_dung        TEXT          NOT NULL COMMENT 'Noi dung thong bao',
  url             VARCHAR(500)  NULL     COMMENT 'Link dieu huong khi nguoi dung click - tuy chon',
  doi_tuong       ENUM('tat_ca','benh_nhan','bac_si') NOT NULL
                                         COMMENT 'tat_ca=moi nguoi, benh_nhan=chi role user, bac_si=chi role doctor',
  tao_boi         INT           NOT NULL COMMENT 'Admin tao thong bao',
  ngay_gui        DATETIME      NULL     COMMENT 'Thoi diem gui thanh cong',
  so_nguoi_nhan   INT           NOT NULL DEFAULT 0 COMMENT 'So luong nguoi da nhan thong bao',
  status          ENUM('da_gui') NOT NULL DEFAULT 'da_gui' COMMENT 'Chi co trang thai da_gui - gui ngay - khong thu hoi',
  ngay_tao        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_sn_tao_boi (tao_boi),
  INDEX idx_sn_ngay_gui (ngay_gui),
  CONSTRAINT fk_sn_admin FOREIGN KEY (tao_boi) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Thong bao he thong Admin gui hang loat - gui ngay - khong thu hoi';


-- ============================================================
-- NHOM 10: AI CHATBOT
-- ============================================================

-- BANG: chat_sessions
-- Moi phien hoi thoai AI la 1 session
-- Tu dong dong sau 24h khong co tin nhan moi (ngay_ket_thuc cap nhat boi ung dung)
CREATE TABLE chat_sessions (
  id              INT         NOT NULL AUTO_INCREMENT,
  user_id         INT         NOT NULL COMMENT 'Benh nhan tao phien chat',
  ngay_bat_dau    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ngay_ket_thuc   DATETIME    NULL     COMMENT 'Tu dong dong sau 24h khong hoat dong',

  PRIMARY KEY (id),
  INDEX idx_cs_user_id (user_id),
  CONSTRAINT fk_cs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Phien chat AI - tu dong dong sau 24h khong hoat dong';


-- BANG: chat_messages
-- Tung tin nhan trong phien chat
-- noi_dung toi da 1000 ky tu (kiem tra o tang ung dung)
-- vai_tro: 'user'=tin nhan benh nhan, 'ai'=phan hoi tu Gemini
CREATE TABLE chat_messages (
  id          INT         NOT NULL AUTO_INCREMENT,
  session_id  INT         NOT NULL COMMENT 'Thuoc phien chat nao',
  vai_tro     ENUM('user','ai') NOT NULL COMMENT 'user=benh nhan gui, ai=Gemini tra loi',
  noi_dung    TEXT        NOT NULL COMMENT 'Noi dung tin nhan - toi da 1000 ky tu',
  thoi_diem   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_cm_session_id (session_id),
  CONSTRAINT fk_cm_session FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Tin nhan trong phien chat AI - toi da 1000 ky tu/tin';


-- ============================================================
-- NHOM 11: NHAT KY ADMIN
-- ============================================================

-- BANG: audit_logs
-- Ghi lai moi thao tac quan trong cua Admin
-- hanh_dong: LOCK_USER, UNLOCK_USER, APPROVE_DOCTOR, REJECT_DOCTOR,
--            SUSPEND_DOCTOR, RESTORE_DOCTOR, CANCEL_APPOINTMENT,
--            HIDE_REVIEW, DELETE_REVIEW, APPROVE_REFUND, REJECT_REFUND
CREATE TABLE audit_logs (
  id              INT           NOT NULL AUTO_INCREMENT,
  admin_id        INT           NOT NULL COMMENT 'Admin thuc hien thao tac',
  hanh_dong       VARCHAR(100)  NOT NULL COMMENT 'Ten hanh dong - vi du: LOCK_USER, APPROVE_DOCTOR',
  loai_doi_tuong  VARCHAR(50)   NOT NULL COMMENT 'Loai doi tuong bi tac dong - vi du: user, doctor, appointment',
  doi_tuong_id    INT           NOT NULL COMMENT 'ID cua doi tuong bi tac dong',
  ly_do           TEXT          NULL     COMMENT 'Ly do thuc hien thao tac - bat buoc voi cac hanh dong quan trong',
  ngay_tao        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_al_admin_id (admin_id),
  INDEX idx_al_hanh_dong (hanh_dong),
  INDEX idx_al_doi_tuong (loai_doi_tuong, doi_tuong_id),
  INDEX idx_al_ngay_tao (ngay_tao),
  CONSTRAINT fk_al_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Nhat ky thao tac Admin - ghi tat ca hanh dong quan trong';


-- ============================================================
-- DU LIEU MAC DINH: payment_settings
-- Cau hinh chinh sach hoan tien va phi hoa hong
-- ============================================================
INSERT INTO payment_settings (ten_cai_dat, gia_tri, mo_ta) VALUES
  ('hoan_tien_tu_24h_tro_len',    '100', 'Huy lich tu 24 gio tro len truoc gio kham: hoan 100%'),
  ('hoan_tien_12_den_24h',         '80',  'Huy lich tu 12 den 24 gio truoc gio kham: hoan 80%'),
  ('hoan_tien_6_den_12h',          '50',  'Huy lich tu 6 den 12 gio truoc gio kham: hoan 50%'),
  ('hoan_tien_duoi_6h',            '0',   'Huy lich duoi 6 gio truoc gio kham: khong hoan'),
  ('hoan_tien_bac_si_tu_choi',     '100', 'Bac si tu choi lich: hoan 100% bat ke thoi gian'),
  ('hoan_tien_admin_huy_khan_cap', '100', 'Admin huy khan cap: hoan 100% bat ke thoi gian'),
  ('timeout_thanh_toan_phut',      '15',  'Lich unpaid qua bao nhieu phut thi tu dong huy - mac dinh 15 phut'),
  ('hoa_hong_phan_tram',           '15',  'Phi hoa hong VitaFamily giu lai truoc khi chuyen tien benh vien (%)');


-- ============================================================
-- TONG KET SCHEMA
-- ============================================================
-- Tong so bang: 27
--
-- NHOM 1 - TAI KHOAN:
--   users, password_resets
--
-- NHOM 2 - DANH MUC:
--   hospitals, specialties, services, payment_settings
--
-- NHOM 3 - GIA DINH:
--   families, members
--
-- NHOM 4 - BAC SI:
--   doctors, doctor_specialties, doctor_hospitals,
--   doctor_schedules, slots
--
-- NHOM 5 - LICH HEN & THANH TOAN:
--   appointments, payments, refunds
--
-- NHOM 6 - HO SO Y TE:
--   medical_records, examination_results
--
-- NHOM 7 - DON THUOC:
--   prescriptions, prescription_items, reminders
--
-- NHOM 8 - DANH GIA:
--   reviews
--
-- NHOM 9 - THONG BAO:
--   notifications, system_notifications
--
-- NHOM 10 - AI CHATBOT:
--   chat_sessions, chat_messages
--
-- NHOM 11 - NHAT KY:
--   audit_logs
--
-- CAC DIEM QUAN TRONG TRONG THIET KE:
--   1. appointments.slot_id: de cap nhat so_benh_nhan_hien_tai, dung SELECT FOR UPDATE
--   2. members.ngay_xoa: soft delete - giu lai du lieu y te
--   3. members.la_chu_ho: chu ho khong the xoa
--   4. doctors.diem_danh_gia: tu dong cap nhat khi review bi an/xoa
--   5. examination_results.co_the_sua: khoa sau 24h (xu ly o tang ung dung)
--   6. refunds: UNIQUE appointment_id - 1 lich 1 refund - rejected khong tao lai
--   7. reminders.status: 4 trang thai pending/sent/taken/missed
--   8. notifications.related_id + related_type: dieu huong khi click
--   9. payment_settings: tat ca ti le khong hardcode trong code
--  10. audit_logs: ghi lai moi hanh dong quan trong cua Admin
-- ============================================================
