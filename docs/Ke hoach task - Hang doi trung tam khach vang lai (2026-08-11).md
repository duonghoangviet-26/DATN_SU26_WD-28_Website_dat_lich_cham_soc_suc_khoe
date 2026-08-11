# Ke hoach task: Hang doi trung tam cho khach vang lai va dieu phoi le tan

Ngay lap: 2026-08-11

Tai lieu nay chot backlog trien khai cho nghiep vu moi:

- Khach online van dat lich theo `LichHen`.
- Khach vang lai/offline khong gan bac si ngay khi tiep nhan.
- Khach offline vao hang doi trung tam co gioi han, trang thai `cho_dieu_phoi`.
- He thong chi dieu phoi offline sang bac si khi bac si that su co khoang trong an toan.
- Le tan khong duoc tiep nhan vo han; phai co nguong dung nhan neu du bao khach se cho qua lau.

## 0. Bat bien nghiep vu can giu

1. `HoSoBenhNhan` la nguoi duoc kham, khong phai tai khoan dat lich.
2. `LichHen` chi danh cho luong online/dat truoc.
3. `HangDoi` la su that van hanh trong ngay: ai da den, dang cho, da goi, dang kham, hoan thanh.
4. Khach offline khong tao `LichHen` gia.
5. Khach offline khong chiem slot online khi vua tiep nhan.
6. Khach online den dung gio phai duoc bao ve truoc offline.
7. Khach offline chi duoc nhan khi du bao thoi gian cho nam trong nguong chap nhan.
8. Khi da gan offline vao bac si nhung chua vao phong, van co the dua lai hang doi trung tam neu xuat hien rui ro tre lich online.
9. Khi offline da vao phong thi khong cat ngang.
10. Tat ca thao tac tiep nhan, dieu phoi, tra ve hang doi, huy luot phai co audit.

## 1. Trang thai de xuat cho `HangDoi`

Can mo rong enum `trang_thai`:

| Trang thai | Y nghia | Co `doctor_id`? | Ai thao tac |
|---|---|---:|---|
| `cho_dieu_phoi` | Khach offline da duoc tiep nhan vao hang doi trung tam, chua gan bac si | Khong | Le tan/he thong |
| `dang_cho` | Da gan bac si, dang cho bac si goi | Co | Le tan/he thong |
| `da_goi` | Bac si da goi | Co | Bac si |
| `trong_phong` | Dang kham | Co | Bac si |
| `cho_dich_vu` | Cho dich vu phat sinh | Co | Bac si/le tan |
| `hoan_thanh` | Kham xong | Co | Bac si |
| `skipped` | Bo luot sau khi goi khong co mat | Co/khong | Bac si/le tan |
| `cancelled` | Huy luot/rut khoi hang doi | Co/khong | Le tan/bac si |

## 2. Cau hinh nguong van hanh

De xuat dua vao `CauHinhPhongKham` hoac bien moi truong trong giai doan dau:

| Ten cau hinh | Gia tri goi y | Y nghia |
|---|---:|---|
| `MAX_OFFLINE_WAIT_MINUTES` | 90 | Thoi gian cho toi da du bao cho khach offline |
| `OFFLINE_WARNING_WAIT_MINUTES` | 60 | Qua moc nay van co the nhan nhung phai canh bao le tan |
| `MAX_CENTRAL_OFFLINE_QUEUE_SIZE` | 10 | So khach offline toi da dang `cho_dieu_phoi` |
| `MAX_OFFLINE_PER_SHIFT_PER_SPECIALTY` | 20 | Tran offline trong mot ca theo chuyen khoa |
| `MIN_ONLINE_PROTECTION_MINUTES` | 15 | Vung bao ve truoc lich online sap toi |
| `DISPATCH_BUFFER_MINUTES` | 5 | Buffer an toan khi chen offline vao khoang trong |
| `SHIFT_CLOSING_BUFFER_MINUTES` | 30 | Con duoi moc nay thi dung nhan offline moi |
| `OFFLINE_AGING_MINUTES` | 60 | Offline cho qua lau duoc nang uu tien, nhung khong pha online dung gio |
| `AUTO_DISPATCH_ENABLED` | false | Giai doan dau nen de le tan xac nhan thu cong |

## Phase 1 - Nen tang du lieu va rule

### WQ-01 - Mo rong schema `HangDoi` cho hang doi trung tam

Muc tieu: cho phep tao luot offline chua gan bac si.

DB:

- Them enum `cho_dieu_phoi` vao `HangDoi.trang_thai`.
- Cho phep `doctor_id`, `schedule_id`, `slot_id`, `khung_index`, `gio_hen_goc`, `phong_kham` rong khi `nguon='offline'` va `trang_thai='cho_dieu_phoi'`.
- Them truong goi y neu can:
  - `bac_si_uu_tien_id`: khach/le tan co mong muon bac si cu the, khong phai cam ket.
  - `ly_do_uu_tien`: tre em, nguoi gia, cap nhe, khach quay lai...
  - `muc_uu_tien_tiep_nhan`: so nguyen, mac dinh 0.
  - `thoi_diem_vao_hang_doi_trung_tam`: Date.
  - `thoi_diem_duoc_dieu_phoi`: Date.
  - `so_lan_dieu_phoi`: Number.
  - `dieu_phoi_cuoi`: object snapshot `{doctor_id, phong_kham, ly_do, actor_id, thoi_diem}`.

Backend:

- Sua validate model: online bat buoc co `appointment_id`; offline bat buoc co SĐT va ho so, nhung khong bat buoc co `doctor_id` neu `cho_dieu_phoi`.
- Them index:
  - `{ nguon: 1, trang_thai: 1, specialty_id: 1, checkin_time: 1 }`
  - `{ doctor_id: 1, trang_thai: 1, checkin_time: 1 }`
  - `{ ho_so_benh_nhan_id: 1, checkin_time: 1, trang_thai: 1 }`

Tieu chi nghiem thu:

- Tao duoc `HangDoi` offline `cho_dieu_phoi` khong co `doctor_id`.
- Van chan online khong co `appointment_id`.
- Van chan offline khong co `ho_so_benh_nhan_id` hoac SĐT.
- Khong lam hong cac luot offline cu da co `doctor_id`.

### WQ-02 - Tao service cau hinh nguong offline

Muc tieu: tap trung cac nguong tiep nhan/dieu phoi vao mot noi.

Backend:

- Tao `offlineQueueConfig.service.js`.
- Ham can co:
  - `loadOfflineQueueConfig()`
  - `getOfflineWaitLimit()`
  - `getOnlineProtectionWindow()`
  - `getShiftClosingBuffer()`
- Gia tri uu tien doc tu DB neu co, fallback env, fallback default.

Frontend:

- Chua can man admin sua cau hinh o phase dau.
- Le tan chi can thay thong diep da duoc backend tinh san.

Tieu chi nghiem thu:

- Thay doi env/config thi API tinh suc chua offline doi theo.
- Test unit cover fallback default.

### WQ-03 - Chuan hoa khai niem "nang luc offline con lai"

Muc tieu: co mot cong thuc duy nhat de quyet dinh co nhan offline moi khong.

Backend:

- Tao service `centralOfflineCapacity.service.js`.
- Input:
  - `specialty_id`
  - `now`
  - optional `requested_profile_id`
- Output:
  - `trang_thai`: `co_the_nhan | canh_bao_day | tam_dung_nhan`
  - `thoi_gian_cho_uoc_tinh_phut`
  - `suc_chua_offline_con_lai`
  - `so_offline_cho_dieu_phoi`
  - `so_offline_da_gan_chua_kham`
  - `so_bac_si_co_the_nhan`
  - `ly_do[]`
  - `goi_y_quay_lai`
  - `minh_chung[]`

Logic tinh:

1. Lay bac si dang lam viec, cung chuyen khoa, active/approved.
2. Voi tung bac si, tinh cac khoang trong an toan:
   - phong san sang hoac sap san sang
   - khong co `trong_phong`
   - online tiep theo chua den vung bao ve
   - con du thoi gian truoc het ca
   - do tre cua bac si duoi nguong
3. Uoc tinh so luot offline co the chen:
   - `floor(khoang_trong / (thoi_gian_kham_tb + buffer))`
4. Tru so offline dang cho trung tam va offline da gan chua kham.
5. Neu `suc_chua_offline_con_lai <= 0` thi `tam_dung_nhan`.
6. Neu thoi gian cho du bao > `MAX_OFFLINE_WAIT_MINUTES` thi `tam_dung_nhan`.
7. Neu thoi gian cho du bao > `OFFLINE_WARNING_WAIT_MINUTES` thi `canh_bao_day`.
8. Nguoc lai `co_the_nhan`.

Tinh huong can cover:

- Tat ca bac si ban kham online lien tuc.
- Co bac si ranh nhung online sap toi trong 10 phut.
- Con 20 phut het ca.
- Offline dang cho qua nhieu.
- Bac si A tre, bac si B ranh.

Tieu chi nghiem thu:

- API khong dua ra "co the nhan" khi khong co bac si nao con khoang trong an toan.
- API tra ro ly do vi sao dung nhan.
- API tra thoi gian cho uoc tinh de le tan noi voi khach.

## Phase 2 - Backend tiep nhan va dieu phoi

### WQ-04 - API kiem tra kha nang tiep nhan offline trung tam

Endpoint:

`GET /api/receptionist/offline-queue/capacity?specialty_id=...`

Muc tieu: truoc khi le tan tao luot offline, he thong phai tra loi "co nen nhan khach nay khong".

Response de xuat:

```json
{
  "trang_thai": "co_the_nhan",
  "thoi_gian_cho_uoc_tinh_phut": 35,
  "suc_chua_offline_con_lai": 3,
  "goi_y_quay_lai": null,
  "ly_do": ["Con 2 bac si co khoang trong an toan"],
  "minh_chung": [
    {
      "doctor_id": "...",
      "bac_si": "BS A",
      "khoang_trong_an_toan_phut": 25,
      "online_tiep_theo_luc": "09:30",
      "co_the_nhan_them": 1
    }
  ]
}
```

Nghiep vu:

- `co_the_nhan`: cho le tan tiep nhan.
- `canh_bao_day`: le tan phai tick xac nhan "da bao khach co the cho lau".
- `tam_dung_nhan`: khong cho tao luot offline moi.

Tieu chi nghiem thu:

- Khong tra so slot chi tiet cho khach goi dien neu API duoc dung o che do phone inquiry.
- Man hinh noi bo cua le tan duoc xem minh chung chi tiet.

### WQ-05 - API tao luot offline vao hang doi trung tam

Endpoint:

`POST /api/receptionist/offline-queue/intake`

Payload:

```json
{
  "ho_so_benh_nhan_id": "...",
  "specialty_id": "...",
  "bac_si_uu_tien_id": null,
  "ly_do_uu_tien": null,
  "xac_nhan_cho_lau": false
}
```

Backend:

- Validate ho so active.
- Chan cung ho so co luot dang xu ly trong ngay:
  - `cho_dieu_phoi`
  - `dang_cho`
  - `da_goi`
  - `trong_phong`
  - `cho_dich_vu`
- Goi lai capacity trong transaction/gan transaction.
- Neu `tam_dung_nhan`: 409, khong tao.
- Neu `canh_bao_day` ma `xac_nhan_cho_lau=false`: 409 voi ma loi `NEED_LONG_WAIT_CONFIRMATION`.
- Tao `HangDoi`:
  - `nguon='offline'`
  - `trang_thai='cho_dieu_phoi'`
  - `doctor_id=null`
  - `schedule_id=null`
  - `slot_id=null`
  - `gio_hen_goc=null`
  - `thoi_gian_cho_uoc_tinh_phut` lay tu capacity
  - co `ma_so_thu_tu`
- Ghi audit `LT_OFFLINE_INTAKE_CENTRAL`.

Frontend:

- Sau khi tao thanh cong, in phieu:
  - So thu tu.
  - Ten benh nhan.
  - "Dang cho dieu phoi bac si".
  - Thoi gian cho du kien.
  - Luu y: thoi gian co the thay doi theo tinh hinh phong kham.

Tieu chi nghiem thu:

- Khach offline duoc tao ma chua xuat hien trong hang doi cua bac si.
- Luot xuat hien trong bang hang doi trung tam cua le tan.
- Tao dong thoi cung ho so tu 2 may chi thanh cong 1 lan.

### WQ-06 - Service goi y dieu phoi offline sang bac si

Muc tieu: khi co bac si ranh, he thong goi y khach offline phu hop nhat.

Backend:

- Tao `offlineDispatch.service.js`.
- Ham:
  - `findDispatchCandidates({ doctorId, specialtyId, now })`
  - `scoreOfflinePatient(entry, doctorContext, now)`
  - `buildDispatchSuggestion({ doctorId, now })`

Dieu kien bac si duoc nhan offline:

- Bac si dang trong ca.
- Bac si active/approved/la_hien.
- Phong `san_sang`.
- Khong co `trong_phong`.
- Khong co online da check-in va da toi khung dang cho.
- Online tiep theo ngoai vung bao ve.
- Khoang trong an toan >= thoi gian kham trung binh + buffer.
- Do tre tich luy duoi nguong dung walk-in.

Diem uu tien benh nhan:

1. Dung chuyen khoa.
2. Cho lau hon.
3. Co `bac_si_uu_tien_id` trung voi bac si nay.
4. Co muc uu tien tiep nhan cao.
5. It lan bi dieu phoi loi/bi tra ve.

Response:

```json
{
  "doctor_id": "...",
  "co_the_nhan": true,
  "slot_an_toan": {
    "gio_bat_dau_du_kien": "09:05",
    "han_phai_xong_truoc": "09:30",
    "khoang_trong_an_toan_phut": 25
  },
  "suggested_entry": {
    "id": "...",
    "ten_benh_nhan": "...",
    "ma_so_thu_tu": "A012",
    "thoi_gian_da_cho_phut": 28
  },
  "ly_do": ["Bac si con 25 phut truoc lich online tiep theo"]
}
```

Tieu chi nghiem thu:

- Khong goi y offline neu online dung gio dang cho.
- Khong goi y offline neu khoang trong nho hon thoi gian kham trung binh + buffer.
- Neu nhieu offline, chon nguoi cho lau nhat sau khi loc chuyen khoa.

### WQ-07 - API dieu phoi, tra ve hang doi trung tam, chuyen bac si

Endpoints:

- `GET /api/receptionist/offline-queue/dispatch-suggestions`
- `POST /api/receptionist/offline-queue/:id/assign`
- `POST /api/receptionist/offline-queue/:id/return-central`
- `PATCH /api/receptionist/offline-queue/:id/cancel`

Payload assign:

```json
{
  "doctor_id": "...",
  "ly_do": "Bac si con khoang trong an toan"
}
```

Backend assign:

- Transaction bat buoc.
- Lock `HangDoi` theo `_id`, `trang_thai='cho_dieu_phoi'`.
- Kiem tra lai bac si con du dieu kien nhan offline tai thoi diem commit.
- Set:
  - `doctor_id`
  - `phong_kham`
  - `schedule_id` neu suy ra duoc
  - `gio_hen_goc=now` hoac moc du kien gan nhat
  - `trang_thai='dang_cho'`
  - `thoi_diem_duoc_dieu_phoi`
  - tang `so_lan_dieu_phoi`
- Ghi audit `LT_OFFLINE_ASSIGN_DOCTOR`.
- Emit realtime cho bac si.

Backend return-central:

- Chi cho return neu `trang_thai='dang_cho'` hoac `da_goi` va chua `trong_phong`.
- Xoa/clear `doctor_id`, `phong_kham`, `schedule_id`, `slot_id`, `gio_hen_goc`.
- Set `trang_thai='cho_dieu_phoi'`.
- Ghi audit `LT_OFFLINE_RETURN_CENTRAL`.

Tieu chi nghiem thu:

- Hai le tan cung assign mot entry: chi 1 request thanh cong.
- Neu bac si vua co online check-in dung gio, assign bi chan.
- Entry assign xong moi xuat hien o man bac si.
- Return central xong bien mat khoi man bac si.

### WQ-08 - Bao ve online trong hang doi bac si

Muc tieu: offline da duoc assign khong duoc lam khach online dung gio bi day qua lau.

Backend:

- Cap nhat `soSanhThuTuHangDoi` neu can:
  - online da toi khung va check-in dung grace luon uu tien hon offline.
  - online den som chi len uu tien khi toi khung.
  - online den muon qua grace xep nhu offline.
  - offline aging chi nang len muc trung gian, khong vuot online dung gio.
- Cap nhat `lyDoChuaDuocPhucVu`:
  - chan bac si goi offline neu con online da toi khung dang cho.
  - cho goi offline neu khong co ai da toi khung va bac si dang ranh.

Frontend bac si:

- Hien nhan ro:
  - `Online dung gio`
  - `Online den som`
  - `Offline da dieu phoi`
  - `Offline cho lau`
- Neu bac si bam goi offline nhung bi chan, hien ly do de khong tuong la loi.

Tieu chi nghiem thu:

- Online 09:00 da check-in luc 08:55, offline assign luc 08:50: den 09:00 online len truoc.
- Online den muon 20 phut khong chen len offline dang cho qua lau.

## Phase 3 - Giao dien le tan

### WQ-09 - Sua man "Tiep nhan tai quay" theo luong moi

Muc tieu: le tan tiep nhan offline vao hang doi trung tam, khong chon bac si ngay.

UI:

1. Nhap so dien thoai.
2. Chon ho so hoac tao ho so moi.
3. Neu co lich online hom nay:
   - Hien "Check-in lich hen da dat".
   - Khong hien nut offline tru khi le tan chon "khach muon kham them luot khac" va co ly do.
4. Neu khong co lich:
   - Goi capacity.
   - Hien 3 trang thai:
     - Co the nhan: nut "Tiep nhan vao hang doi trung tam".
     - Canh bao day: hien canh bao thoi gian cho, bat tick xac nhan.
     - Tam dung nhan: disable nut, hien gio quay lai/dat online.

Noi dung man hinh:

- Khong ghi "Gan bac si".
- Ghi "Cho dieu phoi bac si".
- Hien thoi gian cho du kien.
- Hien thong diep cho le tan noi voi khach.

Tieu chi nghiem thu:

- Le tan khong the tiep nhan offline khi capacity `tam_dung_nhan`.
- Le tan phai tick xac nhan khi `canh_bao_day`.
- Sau tiep nhan, phieu in co trang thai "Cho dieu phoi".

### WQ-10 - Tao man "Hang doi trung tam"

Route de xuat:

`/receptionist/offline-queue`

Muc tieu: le tan xem tat ca khach offline da tiep nhan va trang thai hien tai.

Bang chinh:

| Cot | Noi dung |
|---|---|
| So thu tu | `ma_so_thu_tu` |
| Benh nhan | Ten, tuoi, SĐT |
| Chuyen khoa | Ten chuyen khoa |
| Da cho | So phut tu `checkin_time` |
| Trang thai | Cho dieu phoi / Da gan bac si / Dang kham / Hoan thanh |
| Bac si | Rong neu chua dieu phoi |
| Du kien cho | `thoi_gian_cho_uoc_tinh_phut` |
| Canh bao | Cho qua lau, sap het ca, sap qua nguong |
| Thao tac | Gan bac si, tra ve hang doi, huy luot, in lai phieu |

Bo loc:

- Tat ca
- Cho dieu phoi
- Da gan bac si
- Dang kham
- Da xong
- Da huy/bo luot
- Theo chuyen khoa
- Theo bac si

Chi tiet dong:

- Timeline thao tac.
- Minh chung vi sao chua duoc dieu phoi.
- Lich su dieu phoi/tra ve.

Tieu chi nghiem thu:

- Le tan tra loi duoc "hom nay da nhan bao nhieu khach vang lai, ai dang cho, ai dang kham".
- Khong can mo tung ho so moi xem duoc trang thai.

### WQ-11 - Tao panel "Goi y dieu phoi"

Vi tri:

- Trong man hang doi trung tam.
- Hoac trong "Lich bac si trong ngay".

UI:

- Cot trai: bac si/phong dang san sang.
- Cot phai: khach offline phu hop duoc goi y.
- Moi goi y co:
  - Bac si.
  - Khoang trong an toan.
  - Online tiep theo luc nao.
  - Benh nhan duoc goi y.
  - Ly do goi y.
  - Nut "Dieu phoi".

Logic thao tac:

- Le tan bam "Dieu phoi".
- Hien confirm:
  - "Dieu phoi so A012 - Nguyen Van A sang BS B?"
  - "He thong da kiem tra bac si con 25 phut truoc lich online tiep theo."
- Sau confirm goi API assign.

Tieu chi nghiem thu:

- Neu trong luc confirm bac si het kha nang nhan, backend tra 409 va UI refresh goi y.
- Le tan thay du ly do, khong dieu phoi mu.

### WQ-12 - Cap nhat man "Lich bac si trong ngay"

Muc tieu: le tan xem duoc online/offline theo thoi gian thuc.

Can hien:

- Lich online sap toi.
- Online da check-in.
- Offline da duoc assign.
- Bac si dang kham ai.
- Khoang trong an toan co the nhan offline.
- Canh bao bac si dang tre.

Thao tac:

- Tu bac si/phong ranh, bam "Nhan khach offline".
- Mo danh sach goi y offline phu hop.
- Dieu phoi 1 khach.

Tieu chi nghiem thu:

- Khong hien offline `cho_dieu_phoi` nhu da nam trong lich bac si.
- Chi offline `dang_cho` tro di moi hien trong bac si.

### WQ-13 - Chuan hoa thong diep giao tiep va phieu in

Muc tieu: le tan noi dung, tranh hua qua muc.

Thong diep:

- Co the nhan:
  - "Phong kham co the tiep nhan. Thoi gian cho du kien khoang X phut."
- Canh bao day:
  - "Hien khach co the phai cho khoang X phut. Anh/chi co muon tiep tuc cho kham trong hom nay khong?"
- Tam dung nhan:
  - "Hien tai phong kham da day, he thong chua the tiep nhan them khach vang lai. Anh/chi co the quay lai luc Y hoac dat lich online."

Phieu in:

- So thu tu.
- Ho ten.
- Trang thai: "Cho dieu phoi bac si".
- Thoi gian tiep nhan.
- Thoi gian cho du kien.
- Luu y: "So thu tu khong phai lich hen co dinh voi bac si cu the."

Tieu chi nghiem thu:

- Khong co cau nao hua "chac chan kham luc X".
- Khong hien so slot noi bo cho khach.

## Phase 4 - Bac si, thanh toan, lich su

### WQ-14 - Cap nhat man bac si cho offline duoc dieu phoi

Muc tieu: bac si chi thay offline khi da duoc gan vao bac si minh.

Backend:

- `GET /api/doctor/queue` chi lay:
  - `doctor_id = bac_si_hien_tai`
  - trang thai dang xu ly
- Khong lay `cho_dieu_phoi`.

Frontend:

- Badge:
  - Online
  - Offline da dieu phoi
- Hien so thu tu va thoi gian da cho.
- Neu offline bi chan goi vi online dung gio dang cho, hien message ro.

Tieu chi nghiem thu:

- Bac si khong thay hang doi trung tam chua assign.
- Bac si thao tac goi/vao phong/ket thuc offline nhu hien tai sau khi da assign.

### WQ-15 - Giu tuong thich hoa don va ket qua kham

Muc tieu: offline trung tam sau khi duoc kham van lap hoa don va ket qua binh thuong.

Backend:

- Hoa don offline van neo theo `hang_doi_id`.
- Ket qua kham offline van neo theo `hang_doi_id` va `ho_so_benh_nhan_id`.
- Chan lap hoa don neu `HangDoi.trang_thai` chua duoc kham xong hoac chua co ket qua theo rule hien tai.

Can kiem:

- Luot `cho_dieu_phoi` khong xuat hien o man thu ngan.
- Luot `dang_cho`/`trong_phong` chua thu cuoi neu chua xong.
- Luot `hoan_thanh` vao danh sach thu ngan.

Tieu chi nghiem thu:

- Offline moi sau khi hoan thanh co the lap hoa don.
- Offline bi huy khi chua kham khong sinh hoa don bat buoc.

### WQ-16 - Audit va realtime

Muc tieu: moi buoc deu truy vet duoc.

Audit actions:

- `LT_OFFLINE_INTAKE_CENTRAL`
- `LT_OFFLINE_ASSIGN_DOCTOR`
- `LT_OFFLINE_RETURN_CENTRAL`
- `LT_OFFLINE_CANCEL_CENTRAL`
- `SYSTEM_OFFLINE_ASSIGN_SUGGESTED` neu sau nay auto dispatch

Realtime:

- Khi tao `cho_dieu_phoi`: emit cho dashboard le tan.
- Khi assign: emit cho bac si duoc assign va dashboard le tan.
- Khi return: emit cho bac si cu va dashboard le tan.
- Khi cancel: emit dashboard le tan.

Tieu chi nghiem thu:

- Mo 2 man le tan, tiep nhan o may A thi may B thay cap nhat.
- Bac si chi nhan realtime sau khi luot duoc assign.

## Phase 5 - Gioi han, tinh huong eo le, rollback

### WQ-17 - Xu ly tinh huong eo le

Can code/test cac case:

1. Offline da cho 80 phut, online dung gio vua den.
   - Online van duoc bao ve neu dung khung.
   - Offline duoc canh bao cho qua lau, le tan can xu ly: uu tien khi co khoang trong tiep theo, hoac trao doi khach.

2. Bac si vua duoc goi y nhan offline, nhung online check-in trong luc le tan confirm.
   - Assign fail 409.
   - UI refresh goi y.

3. Khach offline yeu cau bac si A, nhung bac si A tre.
   - Hien canh bao: "Bac si yeu cau dang tre, co the chuyen bac si khac cung chuyen khoa".
   - Le tan duoc chon giu cho trung tam hoac bo yeu cau bac si.

4. Con duoi 30 phut het ca.
   - Khong nhan offline moi.
   - Chi dieu phoi offline da nhan neu du bao xong truoc het ca.

5. Khach offline roi phong kham.
   - Le tan huy luot, nhap ly do.
   - Neu da assign va chua vao phong thi giai phong bac si.

6. Bac si nghi dot xuat.
   - Offline da assign nhung chua vao phong duoc dua lai `cho_dieu_phoi`.
   - Online xu ly theo luong doi/huy lich hien co.

7. Mot so dien thoai co nhieu ho so.
   - Moi ho so tao mot luot rieng.
   - Khong gop anh em/nguoi than vao mot luot.

8. Offline da vao phong, online cua bac si den.
   - Khong cat ngang.
   - Ca co the bi tre; capacity se dung nhan offline moi.

### WQ-18 - Migration va tuong thich du lieu cu

Muc tieu: khong pha cac luot offline hien tai da gan bac si.

Migration:

- Khong doi du lieu offline cu sang `cho_dieu_phoi`.
- Chi them field/default neu can.
- Backfill `thoi_diem_vao_hang_doi_trung_tam = checkin_time` cho offline cu neu field bat buoc.
- Doi voi offline cu co `doctor_id`: giu `trang_thai` hien tai.

Compatibility:

- API cu `/patient-intake/check-in` co the:
  - Tam thoi giu nguyen trong giai doan transition.
  - Hoac redirect logic sang `/offline-queue/intake` bang feature flag.

Feature flag:

- `CENTRAL_OFFLINE_QUEUE_ENABLED=false` mac dinh neu muon rollout an toan.
- Bat true o moi truong test/staging truoc.

Tieu chi nghiem thu:

- Du lieu cu van hien trong man bac si/thu ngan.
- Khi flag off, luong cu van chay.
- Khi flag on, offline moi vao `cho_dieu_phoi`.

## Phase 6 - Kiem thu

### WQ-19 - Unit test backend cho capacity va dispatch

Can test:

- Suc chua con lai khi co 1 bac si ranh.
- Dung nhan khi offline queue vuot tran.
- Dung nhan khi cho du bao > max.
- Canh bao khi cho du bao > warning.
- Khong dispatch vao bac si co online trong vung bao ve.
- Dispatch chon benh nhan cho lau nhat.
- Dispatch ton trong `bac_si_uu_tien_id` neu van an toan.

### WQ-20 - API E2E cho luong offline trung tam

Script de xuat:

`backend/src/scripts/e2e-central-offline-queue.js`

Flow:

1. Tao 2 bac si cung chuyen khoa.
2. Tao lich online cho bac si A gan nhau.
3. Tao offline capacity.
4. Tiep nhan 2 offline vao `cho_dieu_phoi`.
5. Bac si B ranh, lay goi y.
6. Assign offline 1 sang B.
7. Bac si B goi, vao phong, ket thuc.
8. Lap ket qua kham, hoa don.
9. Offline 2 van cho trung tam.
10. Tao online check-in vao B trong luc assign offline 2, verify assign bi chan.
11. Huy offline 2, verify audit.

### WQ-21 - E2E frontend cho le tan

Can cover:

- Capacity `co_the_nhan`: le tan tiep nhan thanh cong.
- Capacity `canh_bao_day`: khong tick thi khong cho tiep nhan; tick thi cho.
- Capacity `tam_dung_nhan`: nut tiep nhan disabled.
- Bang hang doi trung tam hien luot moi.
- Dieu phoi tu panel goi y.
- Assign conflict thi UI refresh va hien thong bao.
- In lai phieu.

## Thu tu trien khai de xuat

1. WQ-01, WQ-02, WQ-03
2. WQ-04, WQ-05
3. WQ-06, WQ-07, WQ-08
4. WQ-09, WQ-10, WQ-11, WQ-12, WQ-13
5. WQ-14, WQ-15, WQ-16
6. WQ-17, WQ-18
7. WQ-19, WQ-20, WQ-21

## Dinh nghia hoan thanh tong the

Nghiep vu duoc xem la xong khi:

- Le tan tiep nhan offline moi ma khong gan bac si ngay.
- He thong chan tiep nhan offline khi du bao qua tai/cho qua lau.
- Le tan xem duoc tat ca offline trong hang doi trung tam.
- He thong goi y dieu phoi offline sang bac si co khoang trong an toan.
- Khach online dung gio khong bi offline chen qua.
- Bac si chi thay offline sau khi da duoc dieu phoi.
- Offline sau khi kham xong van tao ket qua, hoa don, thanh toan binh thuong.
- Tat ca thao tac co audit va realtime cap nhat.
- Co test cho cac tinh huong xung dot: 2 le tan assign dong thoi, online den dung luc, bac si het ca, offline cho qua lau.
