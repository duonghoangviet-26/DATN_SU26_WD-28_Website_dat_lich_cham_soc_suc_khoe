# Kiem thu toan dien trang Le tan - bo kich ban hoi dong

Ngay lap: 2026-08-12  
Pham vi: `/receptionist/*` frontend, `/api/receptionist/*` backend, cac service hang doi - lich hen - thanh toan - audit.

Tai lieu nay dung nhu "bo kich ban phong thu" khi hoi dong hoi nghiep vu. Moi tinh huong deu ghi ro:

- Hoi dong co the hoi gi.
- Le tan thao tac o man nao.
- He thong xu ly logic nhu the nao.
- Co the show bang chung nao tren UI hoac code/test.

## 1. Ket qua kiem tra nhanh

### Da chay test

| Lenh | Ket qua | Y nghia |
|---|---:|---|
| `node --test --test-concurrency=1 "tests/receptionist*.test.js"` trong `backend` | 71/71 pass | Bao phu cac rule le tan: nhan dien ho so, SDT dung chung, sua ho so hanh chinh, chuyen hang doi, hang doi offline trung tam, contact tasks, audit |
| `npm test -- --run src/__tests__/services/receptionist-patient-intake.service.test.ts` trong `frontend` | 3/3 pass | Bao phu logic frontend khi tai khoan online va ho so tai quay chua lien ket |
| `npm run typecheck` trong `frontend` | pass | Khong loi TypeScript |
| `npm run build` trong `frontend` | pass | Build production thanh cong |

### Cac man hinh le tan hien co

| Man hinh | Route | Muc dich demo |
|---|---|---|
| Tong quan le tan | `/receptionist` | Theo doi ca truc, bac si qua tai, lich cho tiep nhan, thong bao, viec can goi |
| Tiep nhan & lich hen | `/receptionist/patient-intake` | Tra cuu SDT, chon ho so, check-in lich online, tiep nhan khach vang lai, tao/sua ho so, in phieu |
| Hang doi vang lai | `/receptionist/offline-queue` | Quan ly khach offline trong hang doi trung tam, goi y dieu phoi, gan bac si, tra ve, huy cho |
| Dieu phoi bac si | `/receptionist/doctor-day-view` | Xem lich bac si trong ngay, slot bi khoa, bac si nghi, tin hieu hang doi vang lai |
| Lien he benh nhan | `/receptionist/contact-tasks` | Quan ly khach can goi thu cong, ghi ket qua cuoc goi |
| Nhat ky ca truc | `/receptionist/activity-log` | Truy vet ai da thao tac voi khach nao, luc nao |
| Vien phi & hoa don | `/receptionist/payments` | Thu tien sau kham, doi chieu tien mat/chuyen khoan, in hoa don |
| Tin suc khoe | `/receptionist/news` | Tao/sua tin suc khoe trong pham vi noi dung |

## 2. Bat bien nghiep vu can noi voi hoi dong

| Bat bien | Giai thich ngan de tra loi |
|---|---|
| `HoSoBenhNhan` la nguoi duoc kham | Tai khoan dat lich co the la nguoi than; he thong khong dong nhat tai khoan voi benh nhan |
| Khach online da dat lich tao `LichHen` | Khi den quay, le tan check-in lich hen va he thong tao `HangDoi` cho bac si |
| Khach vang lai khong tao lich hen gia | Offline vao `HangDoi` voi `nguon='offline'`; ban moi cho vao hang doi trung tam `cho_dieu_phoi` truoc |
| Bac si doc `HangDoi`, khong doc truc tiep man le tan | Le tan check-in/gan bac si xong thi bac si moi thay trong hang doi cua minh |
| Khach online dung gio duoc bao ve truoc offline | Offline chi duoc dieu phoi khi co khoang an toan, khong chen khach online sap den/dang cho |
| Le tan khong sua du lieu chuyen mon | Backend chan cac truong chan doan, don thuoc, sinh hieu, ket qua kham; le tan chi sua hanh chinh co ly do |
| Moi thao tac quan trong co audit | Check-in, tao/huy/doi lich, thu tien, lap hoa don, goi khach, dieu phoi offline duoc ghi nhat ky |

## 3. Bo kich ban kiem thu theo nhom nghiep vu

### A. Phan quyen va bao mat

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-A01 | Khong dang nhap vao trang le tan | Mo `/receptionist` | Bi chan boi `ProtectedRoute`, yeu cau login | Logout roi truy cap route |
| LT-A02 | Tai khoan benh nhan vao trang le tan | Dang nhap role `user/patient` | Khong duoc vao route le tan | Noi rule frontend va backend deu yeu cau `receptionist/admin` |
| LT-A03 | Goi API le tan khong token | Goi `/api/receptionist/...` | 401 | Noi backend mount `verifyToken` |
| LT-A04 | Role khong phai le tan/admin goi API | Goi API bang role doctor/user | 403 | Noi backend `requireRole('receptionist','admin')` |

### B. Tra cuu va nhan dien benh nhan

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-B01 | Nhap SDT sai dinh dang | Nhap so qua ngan/chu cai | UI/backend bao loi, khong search | Man Tiep nhan |
| LT-B02 | SDT co 1 ho so | Search SDT | Tu hien 1 ho so, hien thong tin hanh chinh va lich hen hom nay | Man Tiep nhan |
| LT-B03 | SDT dung chung nhieu ho so gia dinh | Search SDT nguoi giam ho | Hien nhieu ho so, co ngay sinh/gioi tinh/quan he/nhom gia dinh de chon dung | Man Tiep nhan/CheckInVerifyModal |
| LT-B04 | Lich dat ho khong duoc gan nham cho nguoi dat | Chon ho so khac voi lich dat ho | Backend 409: lich khong thuoc dung benh nhan | Test LT-07 pass |
| LT-B05 | Lich cu chi co SDT, nhieu ho so cung SDT | Search SDT | He thong khong tu doan; dua vao danh sach ambiguous can xac minh | Man Tiep nhan |
| LT-B06 | Tai khoan online co lich nhung ho so tai quay chua lien ket | Search SDT | Lich cua tai khoan online van hien la chua gan, khong bi an | Frontend test 3/3 pass |
| LT-B07 | Tao ho so moi cho khach vang lai | Nhap ho ten, SDT, ngay sinh, gioi tinh | Tao `HoSoBenhNhan` nguon `tai_quay`, khong tu dong gan tai khoan neu chi trung SDT | Man Tiep nhan |
| LT-B08 | Trung ho ten + SDT + ngay sinh | Tao ho so trung | 409, chan ho so trung thuc the | Man Tiep nhan |

### C. Sua ho so hanh chinh

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-C01 | Sua SDT/ho ten/ngay sinh | Mo "Chinh sua ho so" | Phai nhap ly do, hien preview truoc/sau | Man Tiep nhan |
| LT-C02 | Bam luu khi khong nhap ly do | De trong ly do | 400/disable: can nhap ly do | Modal sua ho so |
| LT-C03 | Sua truong chuyen mon | Gui payload co `chan_doan`, `don_thuoc` | 403, le tan khong duoc sua | Test LT-10/LT-11 pass |
| LT-C04 | Sua nhung khong co thay doi | Luu cung du lieu cu | Bao khong co thong tin thay doi | Modal sua ho so |
| LT-C05 | Xem lich su cap nhat ho so | Bam "Lich su dat lich"/timeline ho so | Hien nguoi sua, luc sua, truong thay doi | Timeline panel |

### D. Check-in lich hen online

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-D01 | Khach online da xac nhan den quay | Search SDT, chon ho so, chon lich, check-in | `LichHen.status='checked_in'`, tao `HangDoi`, cap so thu tu, in phieu | Man Tiep nhan hoac tab Lich hen hom nay |
| LT-D02 | Check-in nhanh tu danh sach lich | Mo tab lich hen hom nay, bam Check-in | Bat buoc modal xac minh ho so truoc khi PATCH arrived | CheckInVerifyModal |
| LT-D03 | Chon sai ho so cho lich dat ho | Chon ho so khong khop member/name/phone | Backend tra 409, khong tao hang doi | Test LT-07 |
| LT-D04 | Khach da co luot dang cho hom nay | Check-in lai cung ho so | Disable hoac backend 409, khong tao trung luot | Man Tiep nhan |
| LT-D05 | Lich chua thanh toan/chua confirm | Thu check-in | Chi hien action hop le theo `allowed_actions`; backend chan neu trang thai sai | Man Lich hen |
| LT-D06 | Check-in xong bac si co thay khong? | Mo hang doi bac si | Bac si thay theo `doctor_id`, realtime best-effort, DB la nguon dung | Noi `HangDoi` la cau noi |
| LT-D07 | May in loi | Sau check-in co floating "In lai phieu" | Khong check-in lai, chi in lai dung phieu vua cap | Floating print |

### E. Tiep nhan khach vang lai/offline trung tam

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-E01 | Khach khong co lich muon kham | Search/tao ho so, chon chuyen khoa | Goi capacity, neu an toan thi dua vao hang doi trung tam | Man Tiep nhan |
| LT-E02 | Con suc chua an toan | Capacity `co_the_nhan` | Cho tiep nhan, tao `HangDoi.nguon='offline', trang_thai='cho_dieu_phoi'` | Man Tiep nhan + Offline Queue |
| LT-E03 | Hang doi gan day | Capacity `canh_bao_day` | Bat tick "da bao khach co the cho lau" truoc khi tiep nhan | Man Tiep nhan |
| LT-E04 | Qua tai/khong co bac si an toan | Capacity `tam_dung_nhan` | Disable tiep nhan, neu goi API van 409 | Man Tiep nhan |
| LT-E05 | Cung ho so tiep nhan 2 may dong thoi | 2 le tan cung bam tiep nhan | Transaction/lock chi cho 1 request thanh cong, request sau 409 | Noi backend transaction |
| LT-E06 | Offline moi co vao man bac si ngay khong? | Sau tiep nhan `cho_dieu_phoi` | Chua vao hang doi bac si; chi hien o hang doi trung tam | Man Offline Queue |
| LT-E07 | Khach offline khong duoc hua gio co dinh | Xem phieu | Phieu ghi cho dieu phoi, thoi gian uoc tinh, khong cam ket bac si/gio co dinh | Phieu in |
| LT-E08 | Uu tien cap cuu/nguoi uu tien | Payload `muc_uu_tien_tiep_nhan` | Sap xep cap cuu/uu tien truoc FIFO binh thuong | Test offline-central-queue pass |

### F. Hang doi vang lai va dieu phoi bac si

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-F01 | Le tan xem tat ca offline trong ngay | Mo `/receptionist/offline-queue` | Hien so thu tu, benh nhan, chuyen khoa, trang thai, bac si/phong | Man Offline Queue |
| LT-F02 | He thong co goi y bac si an toan | Co bac si ranh, khong co online can bao ve | Hien de xuat tot nhat, cho bam "Gan bac si" | Man Offline Queue |
| LT-F03 | Khong co bac si an toan | Bac si dang kham/online sap den/phong khong san sang | Hien "Chua co bac si an toan", khong cho gan | Man Offline Queue |
| LT-F04 | Gan offline vao bac si | Bam Gan bac si | `HangDoi` doi `cho_dieu_phoi -> dang_cho`, gan `doctor_id`, emit realtime cho bac si | Man Offline Queue + bac si |
| LT-F05 | Trong luc confirm co online dung gio vua check-in | Backend check lai trong transaction | Assign fail 409, UI reload goi y | Noi rule transaction |
| LT-F06 | Da gan nhung bac si co rui ro tre online | Bam "Tra ve hang doi" | Chi cho khi `dang_cho`, clear doctor/phong, ve `cho_dieu_phoi` | Man Offline Queue |
| LT-F07 | Khach bo ve khi chua gan bac si | Bam Huy cho, nhap ly do | Chuyen `cancelled`, ghi audit | Man Offline Queue + Activity Log |
| LT-F08 | Khach da vao phong | Thu tra ve/huy trung tam | Backend chan vi khong con `cho_dieu_phoi/dang_cho` hop le | Noi rule trang thai |

### G. Dieu phoi ca qua tai va chuyen hang doi

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-G01 | Bac si kham keo dai/qua tai | Dashboard hien canh bao | Hien ca tre, nut "Dieu phoi ca qua tai" | Dashboard |
| LT-G02 | Lich chua check-in bi anh huong | Bac si qua tai | Dashboard hien danh sach can bao/doi | Dashboard |
| LT-G03 | Luot dang cho can chuyen bac si | Bam "Chuyen bac si" | Chi chuyen neu `trang_thai='dang_cho'`, bac si dich khac, cung chuyen khoa, dang trong ca | Dashboard/QueueTransferModal |
| LT-G04 | Chuyen sang bac si khong cung chuyen khoa | Chon bac si khong phu hop | Backend 409 | Test E-4 pass |
| LT-G05 | Chuyen hang doi khong nhap ly do | De trong ly do | Disable/400 | Modal chuyen bac si |
| LT-G06 | 2 le tan cung chuyen 1 luot | 2 request dong thoi | Chi 1 thanh cong, request sau 409 do filter doctor cu | Noi backend transaction |
| LT-G07 | Khach bo ve sau khi check-in | Bam "Dong luot", nhap ly do | Dong luot/huy check-in, ghi audit, bac si khong con goi | Dashboard |

### H. Quan ly lich hen

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-H01 | Xem lich hom nay/ngay mai/sap toi/da qua | Doi tab | Lay dung danh sach, an lich huy mac dinh | Man Appointments |
| LT-H02 | Loc theo bac si/ngay/trang thai/tu khoa | Nhap bo loc | Tra danh sach phu hop | Man Appointments |
| LT-H03 | Doi lich do khach yeu cau lan 1 | Chon lich pending/confirmed, ly do `khach_yeu_cau` | Cho doi neu con quyen, ghi lich su | Man Appointments |
| LT-H04 | Khach da het 1 lan doi | Bam doi lich | Hien lich su doi, chi con duong "loi phong kham" | Reschedule modal |
| LT-H05 | Doi lich do loi phong kham | Chon `phong_kham` | Khong tinh han muc khach, gui thong bao | Man Appointments |
| LT-H06 | Doi lich vao qua khu | Chon ngay/gio qua khu | UI/backend chan | Modal doi lich |
| LT-H07 | Huy lich chua check-in | Nhap ly do huy | `status='cancelled'`, giai phong slot, gui thong bao | Man Appointments |
| LT-H08 | Huy lich da vao phong/da check-in | Thu thao tac | `allowed_actions` an nut hoac backend 409 | Man Appointments |
| LT-H09 | Doi/huy hang loat khi bac si nghi/qua tai | Chon nhieu lich | Tao thao tac hang loat, doi slot, thong bao | Bulk modal |
| LT-H10 | Xem lich su thao tac lich | Bam "Xem day du" | Timeline hien ai doi/huy/check-in, luc nao, ly do | TimelinePanel |

### I. Bac si nghi dot xuat/nghi phep

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-I01 | Bac si bao nghi dot xuat | Man dieu phoi bac si, bam "Bao nghi dot xuat" | Tao don nghi da duyet nguon le tan, khoa slot, tao de xuat doi lich | DoctorDayView |
| LT-I02 | Bac si da co don nghi giao ngay/gio | Tao nghi trung | Backend 409, khong tao trung | Modal bao nghi |
| LT-I03 | Nghi mot phan khung gio | Nhap gio bat dau/ket thuc | Chi khoa slot giao gio, ngay van co the lam viec khung khac | DoctorDayView |
| LT-I04 | Lich da check-in khi bac si nghi | Khach dang cho | Khong doi lich nhu khach chua den; dua vao can dieu phoi tai quay/chuyen bac si | Dashboard |
| LT-I05 | Khach dang trong phong | Bac si nghi dot xuat | Khong cat ngang ca dang kham; he thong bo qua dieu phoi | Noi rule skipped `benh_nhan_dang_trong_phong` |
| LT-I06 | Duyet/tuy choi don nghi bac si | Co pending leave | Le tan xu ly trong DoctorDayView, slot bi khoa/mo theo ket qua | DoctorLeaveApprovalModal |

### J. Lien he benh nhan thu cong

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-J01 | Khach khong co app de nhan thong bao doi/huy | He thong tao contact task | Hien o "Lien he benh nhan" tab Chua lien he | ContactTasks |
| LT-J02 | Khach qua gio kham 10 phut chua check-in | Cron/service tao task tre hen | Le tan thay task "Tre hen", goi xac nhan co den khong | ContactTasks |
| LT-J03 | Le tan goi thanh cong | Chon ket qua, ghi chu | Task sang Da lien he, ghi audit `CUSTOMER_CONTACTED`/LT_GOI_KHACH | ContactTasks + ActivityLog |
| LT-J04 | 2 le tan cung danh dau da goi | 2 request gan nhau | Khong chan cuc doan; giu duoc thong tin nguoi goi dau/tinh trang da goi | Test E-3 pass |
| LT-J05 | Cuoc goi cu truoc task moi | Co `CUSTOMER_CONTACTED` cu | Khong tinh la da goi cho request moi | Test E-3 pass |

### K. Thanh toan va hoa don

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-K01 | Bac si chua xac nhan ket qua kham | Mo thu ngan cho ca do | Backend 409/chua hien ca cho thu | Man Payments |
| LT-K02 | Online da tra phi kham, co dich vu phat sinh | Chon ca trong Cho thu | Tong phai thu = phi kham + dich vu - da thu truoc | Man Payments |
| LT-K03 | Offline kham xong | Chon ca offline | Hoa don neo theo `hang_doi_id`, tinh phi chuyen khoa + dich vu phat sinh | Man Payments |
| LT-K04 | Thu tien mat | Chon tien mat, xac nhan | Tao/cap nhat hoa don, tao payment paid, tu xac nhan thu ngan neu du tien | Drawer thanh toan |
| LT-K05 | Chuyen khoan | Chon chuyen khoan | Tao payment pending, chua coi la da thu den khi bam xac nhan | Drawer thanh toan |
| LT-K06 | Xac nhan chuyen khoan 2 tab | Tab 1 confirm, tab 2 confirm lai | Tab 2 bi 409 vi payment khong con pending | Drawer thanh toan |
| LT-K07 | Huy yeu cau chuyen khoan | Bam huy | Payment `failed`, co the tao lai yeu cau moi | Drawer thanh toan |
| LT-K08 | In hoa don khi chua du tien/chua xac nhan | Bam in | Backend 409, khong cho in | Payments |
| LT-K09 | Dich vu phat sinh doi sau khi lap hoa don | Tong hien tai khac hoa don cu | Backend bat doi chieu/cap nhat lai truoc khi in | Payments |
| LT-K10 | Ca da thu xong | Doi sang tab Da thanh toan | Ca roi khoi Cho thu va hien o Da thanh toan | Payments |

### L. Nhat ky ca truc va truy vet

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-L01 | Ban giao ca can biet ai da lam gi | Mo Nhat ky ca truc | Hien gio, nguoi thuc hien, hanh dong, khach, chi tiet | ActivityLog |
| LT-L02 | Loc theo ngay | Chon ngay | Chi hien thao tac trong ngay do | ActivityLog |
| LT-L03 | Loc theo nhom tiep nhan/thanh toan/lich hen/lien he | Chon nhom | Hien dung nhom action | ActivityLog |
| LT-L04 | Loc theo nguoi truc | Chon nguoi | Hien thao tac cua nguoi do trong tap hien tai | ActivityLog |
| LT-L05 | Du lieu nhay cam | Xem detail audit | Timeline/activity chi hien field whitelisted, khong lo truong chuyen mon nhay cam | Test E-1 pass |
| LT-L06 | Action la ma la | Audit code moi chua co nhan | UI fallback khong crash | Test E-1/WS-4 pass |

### M. Gioi han chuyen mon cua le tan

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-M01 | Le tan sua chan doan | PATCH medical/profile field chuyen mon | 403 | Noi backend guard |
| LT-M02 | Le tan sua don thuoc | Payload `don_thuoc` | 403 | Test LT-10/LT-11 |
| LT-M03 | Le tan chi sua hanh chinh | Ho ten, SDT, ngay sinh, dia chi... | Cho sua neu co ly do va audit | Modal sua ho so |
| LT-M04 | Admin override medical field | Co route override rieng | Van bat ly do, khong cho sua lich su array | Test LT-11 |

### N. Tin suc khoe

| ID | Tinh huong | Thao tac/du lieu | Ky vong he thong | Cach show |
|---|---|---|---|---|
| LT-N01 | Le tan xem danh sach tin | Mo `/receptionist/news` | Hien danh sach tin | NewsList |
| LT-N02 | Tao tin moi | Nhap tieu de/noi dung/anh | Tao tin theo route receptionist news | NewsCreate |
| LT-N03 | Sua tin | Mo edit | Cap nhat noi dung, khong anh huong nghiep vu kham | NewsEdit |

## 4. Kich ban hy huu can chuan bi rieng

Day la nhom tinh huong hoi dong hay hoi tiep sau khi thay luong chinh. Nen tra loi theo 3 lop: trang thai hien tai cua benh nhan, thoi diem xay ra, va thao tac hop le cua le tan.

### 4.1 Bac si nghi dot xuat

| ID | Thoi diem/tinh huong | He thong dang lam gi | Le tan thao tac | Cach giai thich voi hoi dong |
|---|---|---|---|---|
| LT-X01 | Bac si nghi truoc khi benh nhan den, lich con `pending/confirmed` | Tao don nghi nguon le tan, khoa slot bi anh huong, tao de xuat doi lich cho lich chua check-in | Mo `/receptionist/doctor-day-view` -> "Bao nghi dot xuat"; sau do xu ly doi/huy/bao khach | "Khach chua den thi khong day vao hang doi; he thong doi/bao truoc de tranh den phong moi biet bac si nghi." |
| LT-X02 | Bac si nghi trong mot khoang gio, khong nghi ca ngay | Chi khoa slot giao voi khoang gio nghi; slot khac trong ngay van giu neu con hop le | Nhap gio bat dau/ket thuc trong modal nghi dot xuat | "He thong khong dong bang ca ngay neu bac si chi nghi mot khung; xu ly theo thoi gian." |
| LT-X03 | Khach da thanh toan online nhung chua check-in, bac si nghi | Lich bi dua vao nhom bi anh huong, tao de xuat doi; khong danh `no_show` neu ca bi nghi | Le tan lien he/doi lich/huy theo de xuat | "Loi thuoc phong kham nen khong phat khach la khong den; no-show service bo qua ca bi nghi." |
| LT-X04 | Khach da check-in, dang `dang_cho` | Khong doi lich nhu khach chua den; dua vao dieu phoi tai quay/chuyen bac si | Dashboard -> "Chuyen bac si" sang bac si cung chuyen khoa dang trong ca, phai nhap ly do | "Khach da co mat tai phong kham thi xu ly nhu hang doi van hanh, giu so thu tu/check-in time, khong bat dat lai tu dau." |
| LT-X05 | Khach da duoc goi nhung chua vao phong (`da_goi`) | Co the dong luot neu khach khong con o phong kham; chuyen bac si chi ap dung chac nhat cho `dang_cho` | Neu khach bo ve: "Dong luot" va nhap ly do | "Da goi nhung khach khong co mat thi dong luot co ly do; khong bien thanh no-show vi khach tung da check-in." |
| LT-X06 | Khach dang trong phong (`trong_phong`) | Backend chan dong luot/chuyen luot; khong cat ngang ca dang kham | Khong thao tac dong/chuyen tu le tan; can xu ly y te/noi bo voi bac si | "Da vao phong la vung chuyen mon, le tan khong cat ngang. Neu bac si gap su co that, can quy trinh noi bo ngoai he thong hoac bo sung workflow cap cuu." |
| LT-X07 | Bac si nghi sau khi da kham xong, benh nhan cho thanh toan | Ca kham da sang thu ngan neu ket qua da xac nhan | Le tan thu tien o `/receptionist/payments` binh thuong | "Nghi cua bac si khong lam mat ket qua/hoa don vi thanh toan neo theo lich/hang doi da kham." |

### 4.2 Thoi gian kham nhanh/cham va qua tai

| ID | Tinh huong | He thong co biet khong? | Le tan lam gi | Cach show |
|---|---|---|---|---|
| LT-X08 | Bac si kham lau hon thoi gian trung binh chuyen khoa | Co. Service `queueOverflow` tinh `thoiGianKhamVuotChuanPhut` dua tren `thoi_diem_vao_phong` va thoi gian kham trung binh | Theo doi Dashboard, xem `do_tre_ca_phut` va nguyen nhan `trong_phong` | `/receptionist` |
| LT-X09 | Benh nhan khung som nhat van dang cho qua gio | Co. Do tre ca tinh tu `gio_hen_goc` cua nguoi dang cho som nhat | Neu tre nhieu, dieu phoi ca qua tai/chuyen bac si/lien he khach sap toi | `/receptionist` |
| LT-X10 | Tre tu 30 phut tro len | He thong canh bao va ngung nhan walk-in theo nguong env `OVERFLOW_NGUNG_WALKIN_PHUT` mac dinh 30 | Tam dung nhan khach vang lai, dieu phoi lai hang doi | Dashboard + PatientIntake capacity |
| LT-X11 | Tre tu 60 phut tro len | He thong canh bao nang hon, co the chan dat online khung con lai theo `OVERFLOW_CHAN_ONLINE_PHUT` mac dinh 60 | Goi/doi lich khach chua check-in, chuyen bac si neu co kha nang | Dashboard nut "Dieu phoi ca qua tai" |
| LT-X12 | Bac si kham nhanh, co khoang trong an toan | Offline queue co the goi y dieu phoi khach vang lai | Gan khach offline tu hang doi trung tam sang bac si | `/receptionist/offline-queue` |
| LT-X13 | Co online sap den trong vung bao ve | He thong khong goi y offline cho bac si do/assign bi 409 neu tinh huong doi luc confirm | Khong gan offline; giu khach vang lai o hang doi trung tam | `/receptionist/offline-queue` |

Thong diep tra loi nhanh: "Le tan biet bac si cham qua Dashboard. He thong tinh do tre tu 2 nguon: nguoi dang trong phong qua thoi gian trung binh, va nguoi dang cho bi qua gio hen. Khi qua nguong, he thong canh bao, dung nhan walk-in, co the chan dat online con lai, va le tan co cac hanh dong: goi khach, doi lich, chuyen luot dang cho, hoac dong luot neu khach bo ve."

### 4.3 Benh nhan bo ve sau khi check-in

| ID | Trang thai benh nhan | Xu ly hien co | Le tan thao tac | Ket qua |
|---|---|---|---|---|
| LT-X14 | Da check-in, dang cho (`dang_cho`) | Co workflow dong luot hang doi | Dashboard -> "Dong luot", bat nhap ly do | `HangDoi.trang_thai='cancelled'`; neu co `LichHen` thi lich `cancelled`; ghi audit; khong thanh `no_show` |
| LT-X15 | Da duoc goi (`da_goi`) nhung khong co mat | Co workflow dong luot | Dashboard -> "Dong luot", ly do "goi nhieu lan khong co mat/khach bo ve" | Dong luot va ghi audit |
| LT-X16 | Dang trong phong (`trong_phong`) | Backend chan dong luot | Khong dong duoc tu le tan | "Dang kham la trang thai chuyen mon, khong cho le tan huy ngang." |
| LT-X17 | Da check-in roi bo ve, cuoi ca co bi mat 100% tien no-show khong? | Khong. `noShowSweep` loai tru moi lich da co ban ghi `HangDoi` | Khong can thao tac no-show | "Da den quay thi khong bao gio bi auto no-show; neu bo ve thi la cancelled/dong luot co ly do." |
| LT-X18 | Offline cho dieu phoi bo ve truoc khi gan bac si | Co workflow huy cho trung tam | `/receptionist/offline-queue` -> "Huy cho", nhap ly do | `cho_dieu_phoi -> cancelled`, audit `LT_OFFLINE_CANCEL_CENTRAL` |
| LT-X19 | Offline da gan bac si nhung chua vao phong bo ve | Co the tra ve/huy theo dung trang thai; hien tai man offline queue co "Tra ve hang doi" cho `dang_cho`, Dashboard co "Dong luot" cho hang doi bac si | Tra ve trung tam neu can dieu phoi lai, hoac dong luot neu khach bo ve | Khong mat dau vet, khong vao thu ngan |

### 4.4 Khach khong tra tien, bo ve sau kham

| ID | Tinh huong | Xu ly hien co | Diem can noi ro | De xuat neu hoi dong bat be |
|---|---|---|---|---|
| LT-X20 | Bac si da xac nhan ket qua, khach chua thanh toan | Ca hien o `/receptionist/payments` tab "Cho thu" | He thong khong mat ca, khong coi la da thu | Show tab Cho thu voi `con_phai_thu` |
| LT-X21 | Khach noi se chuyen khoan sau roi ve | Le tan tao yeu cau chuyen khoan -> payment `pending`; ca van cho xac nhan | Chua duoc tinh la da thanh toan den khi bam xac nhan | Show pending transfer |
| LT-X22 | Khach bo ve khong tra tien mat/chuyen khoan | Hien tai ca van nam "Cho thu"; chua co nut rieng "ghi nhan khach no/bo ve sau kham" | Day la gioi han hien tai: co phat hien cong no nhung chua co workflow thu hoi no/contact task rieng | Nen bo sung task: tao contact task/cong no sau kham, ghi ly do, hen thanh toan, khoa in hoa don den khi thu du |
| LT-X23 | Le tan co in hoa don cho ca chua thu du khong? | Backend chan in/giao hoa don neu chua thanh toan du/chua xac nhan thu ngan | Khong the in hop le khi con no | Show backend message hoac noi guard |
| LT-X24 | Thu tien mat nhung quen xac nhan | Neu chua bam thu, ca van o "Cho thu" | He thong uu tien an toan: chua bam thi chua ghi paid | Show tab Cho thu |

Thong diep tra loi nhanh: "Neu khach kham xong ma chua tra tien, he thong khong cho ca bien mat. Ca nam o Vien phi & hoa don trong tab Cho thu voi so tien con phai thu. Neu chuyen khoan thi trang thai pending cho den khi le tan xac nhan. Diem co the nang cap them la nut 'ghi nhan khach bo ve/cong no' de tao viec goi thu hoi tien sau kham."

### 4.5 Khach khong den, den muon, va lien quan tien

| ID | Tinh huong | Xu ly hien co | Le tan thao tac |
|---|---|---|---|
| LT-X25 | Khach chua check-in va qua gio 10 phut | Tao viec can goi xac nhan den muon | `/receptionist/contact-tasks` -> goi khach, ghi ket qua |
| LT-X26 | Khach den muon nhung van trong ngay | Co luong `mark-late`: dua xuong cuoi ca/slot gan nhat/ngay mai tuy policy | Man Appointments -> Khach den muon |
| LT-X27 | Khach khong den het ca, bac si van lam viec | `noShowSweep` tu dong set `no_show` neu khong co `HangDoi` | Le tan khong set tay |
| LT-X28 | Khach khong den vi bac si nghi/slot bi khoa | `noShowSweep` bo qua `ca_bi_nghi`, khong phat khach | Le tan doi/huy/bao khach |
| LT-X29 | Khach da check-in roi ve | Khong auto no-show, xu ly dong luot/cancelled | Dashboard/OfflineQueue |

## 5. Bo cau hoi hoi dong va cau tra loi san

### "Neu mot so dien thoai co nhieu nguoi nha thi sao?"

Tra loi: He thong khong tu dong gan lich theo SDT. Le tan phai chon dung ho so; UI hien ho ten, ngay sinh, gioi tinh, quan he/nhom gia dinh. Backend kiem tra lich co thuoc dung ho so khong. Neu chon sai, API tra 409 va khong tao hang doi.

Show: `/receptionist/patient-intake` hoac modal `CheckInVerifyModal`. Bang chung test: LT-07 pass.

### "Khach online da thanh toan den quay thi bac si co thay khong?"

Tra loi: Co. Le tan check-in lich online thi backend goi service check-in chung, tao ban ghi `HangDoi` gan `doctor_id`. Bac si doc `HangDoi`, khong phu thuoc UI le tan. Socket chi de cap nhat nhanh; DB van la nguon dung.

Show: Check-in o `/receptionist/patient-intake`, sau do mo hang doi bac si.

### "Khach vang lai co chen mat khach dat lich online khong?"

Tra loi: Khong. Khach vang lai dau tien vao hang doi trung tam `cho_dieu_phoi`, chua vao hang doi bac si. He thong chi goi y gan bac si khi bac si co khoang an toan va khong co online sap den/dang cho trong vung bao ve. Neu dang co online can uu tien, assign bi chan 409.

Show: `/receptionist/offline-queue` va panel "Tin hieu hang doi vang lai" trong `/receptionist/doctor-day-view`. Bang chung test: offline central queue pass.

### "Neu phong kham qua tai thi le tan lam gi?"

Tra loi: Dashboard hien bac si qua tai, so dang cho, ca tre, danh sach luot bi anh huong. Le tan co the dieu phoi lich chua check-in, chuyen luot dang cho sang bac si khac cung chuyen khoa, hoac dong luot neu khach bo ve. Tat ca deu bat ly do va ghi audit.

Show: `/receptionist`, nut "Dieu phoi ca qua tai", modal "Chuyen bac si".

### "Neu bac si nghi dot xuat thi lich benh nhan xu ly the nao?"

Tra loi: Le tan ghi nhan bac si nghi dot xuat. Backend tao don nghi nguon le tan, khoa slot, tao de xuat doi lich cho khach chua check-in. Khach da check-in thi khong doi lich nhu khach chua den; he thong dua vao danh sach can dieu phoi tai quay. Khach dang trong phong khong bi cat ngang.

Show: `/receptionist/doctor-day-view`, nut "Bao nghi dot xuat".

### "Le tan co sua benh an hay don thuoc duoc khong?"

Tra loi: Khong. Le tan chi sua thong tin hanh chinh co ly do. Cac truong chan doan, don thuoc, sinh hieu, ket qua kham bi backend chan 403.

Show: modal "Sua thong tin hanh chinh"; neu hoi sau hon thi noi test LT-10/LT-11 da pass.

### "Thu ngan co tinh dung tien phat sinh sau kham khong?"

Tra loi: Co. Man vien phi doc ket qua kham da duoc bac si xac nhan, tinh lai phi kham + dich vu phat sinh, tru tien da thu truoc. Neu chuyen khoan thi chi thanh toan sau khi le tan xac nhan giao dich; neu tien mat thi ghi paid ngay va audit nguoi thu.

Show: `/receptionist/payments`.

### "Neu hai le tan cung thao tac mot viec?"

Tra loi: Cac thao tac nhay cam co check trang thai luc commit: tiep nhan trung bi chan, assign offline bi chan neu trang thai da doi, chuyen bac si dung filter doctor cu, confirm chuyen khoan chi duoc khi payment con pending. Request sau se bi 409 va UI tai lai.

Show: Giai thich theo transaction/filter; bang chung test queue transfer/offline central/contact tasks.

### "Neu khach khong co app thi ai bao khach khi doi/huy lich?"

Tra loi: He thong tao viec can lien he thu cong. Le tan mo "Lien he benh nhan", goi khach, chon ket qua cuoc goi, ghi chu. Viec chuyen sang da lien he va vao nhat ky.

Show: `/receptionist/contact-tasks`.

### "Lam sao biet ai da thu tien/huy lich/doi lich?"

Tra loi: Trang "Nhat ky ca truc" gom theo ngay, nhom viec va nguoi thuc hien. Moi dong co gio, nguoi lam, hanh dong, khach va chi tiet. Dung de ban giao ca va truy vet tranh tranh cai.

Show: `/receptionist/activity-log`.

## 6. Goi y thu tu demo truoc hoi dong

1. Mo `/receptionist` de show tong quan: ca kham hom nay, bac si qua tai, lich cho tiep nhan, viec can goi.
2. Mo `/receptionist/patient-intake`, search SDT, show nhan dien ho so va lich online.
3. Check-in mot lich online, show modal xac minh, so thu tu va phieu in.
4. Search/tao mot ho so khach vang lai, chon chuyen khoa, show capacity `co_the_nhan/canh_bao/tam_dung`.
5. Dua khach vang lai vao hang doi trung tam, mo `/receptionist/offline-queue` de show chua gan bac si.
6. Gan bac si theo goi y, noi rule bao ve khach online.
7. Mo `/receptionist/payments`, show ca sau kham va cach thu tien mat/chuyen khoan.
8. Mo `/receptionist/contact-tasks`, show khach can goi.
9. Mo `/receptionist/activity-log`, show truy vet toan bo thao tac.

## 7. Diem can luu y khi demo

| Diem luu y | Cach noi de an toan |
|---|---|
| Realtime chi la best-effort | "Socket giup cap nhat nhanh, nhung DB/HangDoi moi la nguon du lieu dung; reload van thay dung." |
| Khach offline khong co gio cam ket chinh xac | "He thong chi hien thoi gian cho uoc tinh va trang thai cho dieu phoi, tranh hua sai voi khach." |
| Bulk cancel/reschedule co logic rieng | Nen demo thao tac don le truoc; bulk dung khi bac si nghi/qua tai nhieu lich |
| Build co warning chunk > 500KB | Khong anh huong chuc nang; day la canh bao toi uu bundle frontend |
| Playwright e2e cu co the chua theo luong offline trung tam moi | Khi can chay UI e2e day du, nen cap nhat mock tu `/patient-intake/availability` cu sang `/offline-queue/capacity` moi |
| Khach kham xong bo ve khong tra tien | Hien co phat hien bang tab "Cho thu", nhung chua co workflow cong no/contact task sau kham rieng; nen noi la backlog nang cap neu hoi dong muon nghiep vu nay that chat |

## 8. Ket luan tester

Trang le tan hien co du logic nghiep vu de tra loi cac tinh huong hoi dong hay hoi:

- Dung nguoi benh khi SDT dung chung.
- Check-in online tao hang doi that cho bac si.
- Offline vao hang doi trung tam, khong chen khach online.
- Co goi y dieu phoi va co chan xung dot.
- Co xu ly bac si qua tai/nghi dot xuat.
- Co thu ngan sau kham, tien mat/chuyen khoan, in hoa don.
- Co lien he thu cong voi khach khong nhan duoc thong bao app.
- Co nhat ky ca truc de truy vet.
- Co ranh gioi an toan: le tan khong sua du lieu chuyen mon.

Bo test tu dong da pass cho cac rule loi quan trong, frontend typecheck/build pass. Khi demo, nen di theo thu tu muc 5 de hoi dong thay duoc ca luong du lieu: le tan -> hang doi -> bac si -> thanh toan -> audit.
