# Thiet ke: Le tan tiep nhan khach den truc tiep tai quay

> Ngay cap nhat: 2026-07-28
> Rule bat buoc tuan thu: `.claude/rules/lich-lam-viec-bac-si.md`
> Tai lieu audit lien quan: `docs/lo-hong-dat-lich-offline-le-tan-2026-07-28.md`

## 1. Muc tieu nghiep vu

Tai lieu nay mo ta luong le tan tiep nhan khach den phong kham truc tiep, khong dat truoc online, trong boi canh hien tai phong kham chi co 1 chuyen khoa Tai Mui Hong.

Muc tieu cua luong:
- Le tan tim nhanh dung nguoi can kham.
- Neu chua co ho so thi tao ho so moi ngay tai quay.
- Dua nguoi benh vao hang cho hop ly dua tren cong suat slot kham thuc te trong ngay.
- Khong nhan vuot kha nang phuc vu cua bac si.
- Neu da het cho hien tai thi bao gio quay lai hop ly cho khach.
- Sau khi kham xong, neu co dich vu phat sinh thi dua vao hoa don de thu ngan thanh toan.

## 2. Nhung quyet dinh da chot

### 2.1 Khong dung khai niem "khach vang lai" nhu mot loai nghiep vu rieng

Ten `KhachVangLai` khong con phu hop voi huong nghiep vu mong muon.

Huong dung:
- Moi nguoi den kham deu duoc quan ly nhu mot `ho so benh nhan`.
- `NguoiDung` chi la tai khoan dang nhap hoac nguoi lien he, khong phai luc nao cung la nguoi duoc kham.
- Mot so dien thoai co the dai dien cho nhieu ho so benh nhan trong cung gia dinh.
- Online va offline cung phai quy ve mot kho du lieu ho so benh nhan thong nhat de sau nay truy xuat lich hen, hang doi, ket qua kham, lich su dich vu va thong tin cho bac si.

He qua thiet ke:
- Khong chia "loai khach" theo kieu moi den, vang lai, online.
- Nguoi moi den ma chua co trong he thong thi tao ho so benh nhan moi.
- Nguoi da co ho so thi tai su dung ho so do, bat ke truoc day den tu online hay offline.

### 2.2 Mot so dien thoai co the quan ly nhieu nguoi di kham

Day la tinh huong nghiep vu binh thuong va phai ho tro tot:
- Me dua 2 con di kham.
- Con dat lich cho ong ba.
- Nguoi giam ho dat cho chinh minh va nguoi than.

Luon hien thi danh sach tat ca ho so benh nhan gan voi so dien thoai vua nhap, thay vi mac dinh xem so dien thoai la 1 nguoi duy nhat.

### 2.3 Khong can phan loai "loai khach" trong luong tiep nhan

Nghiep vu quan tam la:
- Nguoi can kham la ai.
- Co ho so chua.
- Con cho trong khung kham nao.
- Dua vao hang cho duoc hay khong.

Vi vay, cac nhan nhu "khach moi", "khach vang lai", "khach online", "khach cu" khong tao gia tri van hanh tai buoc tiep nhan.

### 2.4 Hang doi dung de van hanh, slot dung de quan ly cong suat

Can tach ro 2 khai niem:

- `slot` la nang luc phuc vu du kien de mo cho dat lich va tiep nhan.
- `hang doi` la thu tu van hanh thuc te cua nguoi dang cho kham.

Vi du:
- Ca 8:00-8:30 duoc chia 2 slot vi trung binh 1 luot kham khoang 15 phut.
- Neu moi chi co 1 lich online o ca do, co the dua them 1 khach offline vao slot con trong.
- Neu kham thuc te nhanh hon thi co the goi som nguoi ke tiep trong hang doi.
- Neu kham cham hon thi phai dung nhan them khach moi du khoang slot ly thuyet chua dung het.

Ket luan:
- Khong duoc chi nhin so slot ly thuyet ma nhan vo han khach offline.
- Phai co logic du bao tre dua tren tinh hinh kham thuc te de dong/han che nhan them.

### 2.5 Thanh toan phai ho tro phat sinh sau kham

Sau khi bac si kham xong:
- Co the chi co phi kham co ban.
- Co the phat sinh them dich vu, thu thuat, can lam sang, thuoc hoac muc thu bo sung.

Do do hoa don khong nen dong bang o buoc tiep nhan.
Hoa don phai cho phep:
- Tao theo luot kham.
- Them dong dich vu phat sinh sau ket luan cua bac si.
- Thu ngan thanh toan 1 lan cuoi theo tong gia tri thuc te.

### 2.6 Khi het cho hien tai, can bao moc gio quay lai gan nhat

Do hien tai chi co 1 chuyen khoa, neu khung hien tai da kin:
- Khong nhan tran lan vao hang doi.
- Can tinh khung gio trong gan nhat phia sau.
- Bao ro cho khach "hien tai dang day, moi quay lai luc ...".

Luu y:
- Day la goi y thoi diem quay lai, khong phai dat cho giu cho.
- Khi khach quay lai van phai kiem tra lai cong suat thuc te tai thoi diem do.

## 3. Mo hinh nghiep vu de xuat

### 3.1 Thuc the trung tam

Nen chuan hoa theo huong sau:

- `NguoiDung`: tai khoan dang nhap, nguoi dat lich, nguoi lien he, nguoi giam ho.
- `HoSoBenhNhan`: nguoi thuc su duoc kham.
- `LichHen`: du lieu dat lich truoc.
- `HangDoi`: du lieu van hanh thuc te trong ngay.
- `LuotKham` hoac lien ket tuong duong: ban ghi neo cho toan bo kham, ket qua, hoa don, thanh toan.
- `HoaDon`: tong hop chi phi cua 1 luot kham.

Neu chua doi ten model ngay duoc thi trong giai doan chuyen tiep:
- Co the tam dung `KhachVangLai` nhu storage ky thuat.
- Nhung ve mat nghiep vu va tai lieu, phai hieu no dang dong vai tro `HoSoBenhNhan`, khong phai "mot loai khach dac biet".

### 3.2 Quan he so dien thoai

- 1 so dien thoai co the gan voi nhieu ho so benh nhan.
- 1 ho so benh nhan phai co thong tin nguoi lien he chinh.
- Khi tim theo so dien thoai, ket qua tra ve la danh sach ho so lien quan, khong phai 1 ban ghi duy nhat.

## 4. Luong van hanh tai quay

### 4.1 Buoc 1: nhap so dien thoai va tim ho so

Le tan nhap so dien thoai.

He thong can:
- Tim tai khoan nguoi dung neu co.
- Tim tat ca ho so benh nhan lien ket voi so dien thoai do.
- Hien thi danh sach de le tan chon dung nguoi can kham.

Neu chua co ai phu hop:
- Tao ho so benh nhan moi ngay tai quay.
- Van gan so dien thoai nguoi lien he do de lan sau co the tim lai.

Neu 1 nguoi dua 2 con den kham:
- Le tan chon lan luot tung ho so benh nhan.
- Moi nguoi se tao 1 luot tiep nhan rieng va 1 muc hang doi rieng.
- Khong gop 2 benh nhan thanh 1 muc hang doi.

### 4.2 Buoc 2: danh gia kha nang nhan khach

Sau khi xac dinh duoc nguoi can kham, he thong phai tinh:
- Cac slot con trong cua hien tai va cac khung gan nhat sap toi.
- So luong lich online da chiem.
- So nguoi dang cho offline.
- Nguoi dang o trong phong kham.
- Do tre thuc te so voi muc tieu trung binh.

He thong khong chi hien "bac si co ranh hay khong", ma phai tra loi cau hoi:
- Co nen nhan them khach nay ngay bay gio khong?
- Neu co, dua vao slot nao?
- Neu khong, moc gio quay lai hop ly nhat la may gio?

### 4.3 Buoc 3: dua vao hang doi

Neu con cong suat:
- He thong giu 1 slot phu hop cho benh nhan.
- Tao 1 ban ghi hang doi cho dung benh nhan do.
- Tra ve so thu tu uoc tinh va moc thoi gian du kien.

Neu khong con cong suat an toan:
- Khong cho vao hang doi chi de "xep tam".
- Tra ve thong bao het cho hien tai.
- Goi y khung gio sau con trong de le tan bao khach quay lai.

### 4.4 Buoc 4: kham va xu ly sau kham

Sau khi vao kham:
- Bac si kham xong co the ket thuc ngay.
- Hoac chi dinh them dich vu phat sinh.

Neu co dich vu phat sinh:
- Cap nhat vao luot kham.
- Them vao hoa don.
- Neu can cho thuc hien tiep, co the chuyen trang thai hang doi sang `cho_dich_vu` hoac luong tuong duong.

Ket thuc:
- Thu ngan thu tong gia tri cuoi cung.
- Hoa don phan anh day du phi kham va cac dich vu phat sinh.

## 5. Nguyen tac dieu phoi slot va hang doi

### 5.1 Nguyen tac co ban

- Slot online la suc chua da duoc mo ban truoc.
- Slot offline chi duoc dung khi he thong xac nhan van con cong suat thuc te.
- Hang doi la danh sach nguoi dang doi xu ly thuc te, khong phai noi gom vo han khi da kin tai nguyen.

### 5.2 Truong hop kham nhanh

Neu benh nhan truoc kham nhanh:
- Co the goi som nguoi dang cho tiep theo.
- Co the mo kha nang nhan them 1 khach offline neu du bao tre van an toan.

Tuy nhien:
- Khong duoc vi 1 vai ca nhanh ma mac dinh tang vuot cong suat cho ca sau.

### 5.3 Truong hop kham cham

Neu benh nhan truoc kham cham:
- He thong phai tinh lai do tre.
- Neu do tre vuot nguong thi tam dung nhan khach offline moi.
- Co the van cho dat online cua cac slot sau neu chinh sach cho phep, nhung phai hien canh bao ro nguy co tre hen.

### 5.4 Muc tieu dieu phoi

Huong toi quy tac:
- Uu tien khong de bac si ngoi cho khi con khach dang co mat.
- Dong thoi khong nhan qua nhieu khach khien tre day chuyen va trai nghiem xau.

Noi cach khac:
- Co nhan them khi thay nang luc trong.
- Co tu choi khi thay sap qua tai.

## 6. Quy tac giao tiep voi khach khi da day

Neu khung hien tai da het cho:
- Khong noi chung chung "ngoi cho them".
- Can dua ra moc gio goi y cu the.

Vi du:
- "Hien tai khung 8:00-8:30 da day, khung trong gan nhat du kien la 9:00, anh chi co the quay lai luc do."

Thong diep nay phai dua tren:
- Slot chua dung o cac khung sau.
- Do tre thuc te hien tai.
- So nguoi dang cho va nguoi dang kham.

## 7. Thanh toan va hoa don

### 7.1 Nguyen tac

Khong nen ep luong offline phai tao `LichHen` gia chi de hop thuc hoa hoa don.

Thay vao do, hoa don phai bam vao 1 lan kham thuc te:
- Neu di tu online thi lien ket voi `appointment_id` hoac thuc the tuong duong.
- Neu di tu offline thi lien ket voi `hang_doi_id` hay tot hon la `luot_kham_id`.

### 7.2 Luong nghiep vu de xuat

1. Tiep nhan xong, tao luot kham.
2. Bac si kham va ghi ket qua.
3. Neu co dich vu phat sinh thi them vao hoa don.
4. Thu ngan thu 1 lan theo tong tien cuoi cung.

Neu phong kham muon thu phi kham truoc:
- Van can giu kha nang bo sung dich vu vao cung hoa don sau do.
- Nghia la he thong phai ho tro trang thai da thu tam, con phai thu them.

Mac dinh de xuat:
- Thu 1 lan sau kham de giam sai lech doi soat va don gian van hanh.

## 8. Tac dong den thiet ke ky thuat

### 8.1 Diem can sua trong backend

- Luong check-in offline khong duoc chi tao `HangDoi` thuong.
- Phai co buoc giu slot theo co che atomic de tranh 2 le tan cung lay cung 1 cho.
- `HangDoi` nen luu du thong tin slot da nhan nhu `schedule_id`, `slot_id`, `khung_index` hoac lien ket tuong duong.
- Logic qua tai phai tinh ca benh nhan dang `trong_phong`, thoi diem vao phong va do tre thuc te, khong chi dem nguoi dang cho.
- Hoa don phai ho tro luong offline ma khong ep `appointment_id` la bat buoc.

### 8.2 Diem can sua trong frontend

Man hinh le tan nen di theo thu tu:
1. Tim so dien thoai.
2. Chon ho so benh nhan hoac tao moi.
3. Xem kha nang nhan khach ngay bay gio.
4. Xac nhan dua vao hang doi.
5. Neu het cho thi hien moc gio quay lai du kien.

Khong can UI phan loai khach.
Khong nen de le tan hieu nham rang cu dua vao hang doi la se duoc kham som, trong khi he thong da qua tai.

## 9. Nguyen tac du lieu can duoc bao toan

- 1 benh nhan phai co lich su xuyen suot du online hay offline.
- Bac si phai xem duoc lich su da kham cua dung nguoi.
- Thu ngan phai doi soat duoc hoa don theo tung luot kham.
- Le tan phai tra cuu lai duoc theo so dien thoai nguoi lien he.

Day la ly do can thong nhat mo hinh ho so benh nhan thay vi duy tri cach nghi "online la 1 kieu, vang lai la 1 kieu".

## 10. Nhung diem chua chot hoan toan

Tai thoi diem cap nhat tai lieu nay, con 1 quyet dinh nghiep vu nen duoc xac nhan ro truoc khi code phan thanh toan:

- Phi kham co ban se thu ngay luc tiep nhan, hay thu chung 1 lan sau khi bac si kham xong?

De xuat mac dinh:
- Thu 1 lan sau kham, vi don gian hon cho doi soat va phu hop voi truong hop co dich vu phat sinh.

## 11. Tieu chi dung de code dung nghiep vu

Implementation ve sau can dam bao it nhat cac dieu sau:
- Nhap 1 so dien thoai co the thay nhieu ho so benh nhan.
- Co the tiep nhan nhieu benh nhan khac nhau cung dung 1 so dien thoai lien he.
- Moi benh nhan di vao 1 muc hang doi rieng.
- Khong co khái niem nghiep vu "khach vang lai" trong UI tiep nhan.
- Khong nhan them offline neu du bao da qua tai.
- Khi day, phai tra ve gio quay lai goi y cu the.
- Hoa don sau kham phai them duoc dich vu phat sinh.
- Lich su kham cua 1 nguoi phai thong nhat giua online va offline.

## 12. Ket qua doi chieu MongoDB Cloud ngay 2026-07-28

Database `DATN_VITAFAMILY` da duoc kiem tra read-only truoc khi backfill. Nen tang hien co:
- 152 `lich_hen`, 63 `hang_doi`, 132 `hoa_don`, 132 `thanh_toan`.
- 9 `thanh_vien`, 3 `khach_vang_lai`, 37 `ket_qua_kham`, 2 `ho_so_y_te`.
- 1 `chuyen_khoa` Tai Mui Hong, 9 `dich_vu`, 462 `lich_lam_viec`.

Database thieu lop dinh danh benh nhan dung chung va thieu neo hoa don cho luot offline. Migration `013-backfill-ho-so-benh-nhan-offline` da bo sung theo huong tuong thich nguoc:
- Tao collection `ho_so_benh_nhan` voi 103 ho so, khong dung so dien thoai lam khoa duy nhat.
- Lien ket 9/9 thanh vien, 3/3 ban ghi `khach_vang_lai`, 152/152 lich hen va 63/63 hang doi.
- Lien ket 37 ket qua kham, 2 ho so y te, 90 hoa don va 90 thanh toan khi co du can cu.
- Lien ket them 29 ban ghi `sinh_hieu_kham`; 2 ban ghi con lai la du lieu tham chieu lich hen mo coi.
- Them `schedule_id`, `slot_id`, `khung_index` cho 31 hang doi online co the suy ra tu lich hen. Hang doi offline cu khong duoc tu doan slot vi du lieu lich su khong co thong tin giu slot.
- Hoa don da co the neo bang `appointment_id` hoac `hang_doi_id`; index dung partial filter de cho phep nhieu hoa don offline khong co `appointment_id`.
- `khach_vang_lai` van duoc giu lam collection tuong thich nguoc, khong con duoc xem la mot loai khach trong nghiep vu.

Migration khong xoa du lieu va da kiem tra idempotent: chay `dry-run` sau cung cho ket qua 0 ho so moi, 0 tai lieu can cap nhat.

Mot so loi legacy van ton tai va khong duoc tu dong sua vi thieu can cu an toan: mot so hoa don tham chieu lich hen da bi xoa, ket qua kham/sinh hieu co tham chieu mo coi, thong tin chi nhanh/chuyen khoa cua mot so lich cu con thieu. Day la nhom can audit va xu ly rieng, khong duoc gan bua vao ho so benh nhan moi.

## 13. Tien do code theo tung phase

### Phase 1 - Nhan dien va tao ho so

Da trien khai:
- Tao API `GET /api/receptionist/patient-intake/search?phone=...` de tra ve tat ca ho so dang hoat dong co cung so dien thoai da chuan hoa.
- Tao API `POST /api/receptionist/patient-intake/profiles` de tao ho so moi tai quay.
- Khong dat unique theo so dien thoai; khong tu dong gop hai nguoi chi vi dung chung so lien he.
- Them man hinh le tan `patient-intake`, tach khoi man hinh `booking` tao lich hen online.

Phan nay duoc tiep tuc o cac phase sau:
- Xu ly kham nhanh/kham cham theo du lieu thoi gian thuc o muc chi tiet hon.
- Hoa don, dich vu phat sinh va thanh toan offline.

### Phase 2 - Suc chua va tiep nhan vao hang doi

Da trien khai:
- API `GET /api/receptionist/patient-intake/availability` tra ve slot `walk_in` dang con trong khung hien tai/ke tiep.
- API `POST /api/receptionist/patient-intake/check-in` nhan `ho_so_benh_nhan_id`, claim slot bang update atomic, sau do tao `HangDoi` co `schedule_id`, `slot_id`, `khung_index` va `ho_so_benh_nhan_id` trong cung transaction.
- Khi ca tre tu 30 phut, tam dung nhan them offline; khi khong con slot, tra ve gio slot gan nhat de le tan bao khach quay lai.
- Neu luot offline bi bo/huy truoc khi vao phong, slot duoc tra lai pool; luot da vao phong khong duoc tra lai.
- Giao dien le tan da cho phep xem slot, chon slot va xac nhan dua dung ho so vao hang doi.

Da bo sung sau review:
- Chan trung ho so dang co luot trong ngay va kiem tra lai trong transaction.
- Hien thi luot offline trong hang doi bac si, cho phep nhap ket qua va sinh hieu.
- Tao hoa don offline va them dich vu phat sinh.

### Phase 3 - Ho so kham va lich su bac si

Da trien khai:
- Response hang doi bac si tra `ho_so_benh_nhan_id`, khong chi tra snapshot ten va so dien thoai.
- Ket qua online moi ghi them `ho_so_benh_nhan_id`; ket qua offline dung `hang_doi_id` va ho so chung.
- API `GET /api/doctor/appointments/patient-profiles/:id/history` gom lich su online/offline cua dung ho so trong pham vi bac si dang phu trach.

Da bo sung:
- Man hinh bac si tao ket qua moi truc tiep cho luot offline.
- Endpoint gan ket qua voi `hang_doi_id` va luu lich su dung ho so.

### Phase 4 - Hoa don va thanh toan offline

Da trien khai backend:
- API `GET/POST /api/receptionist/payments/offline/:queueId/invoice` dung `hang_doi_id`, khong tai su dung `loadPaymentBundle` dang bat buoc `appointment_id`.
- Hoa don gom phi kham co ban + dich vu `related` hop le theo chuyen khoa.
- Ho tro lap lai hoa don khi phat sinh them dich vu, bao toan so tien da thu va chi thu phan con thieu.
- Ho tro thu tien mat ngay tai quay hoac tao giao dich chuyen khoan cho phan con phai thu.

Da bo sung frontend:
- Man hinh thu ngan hien thi chi tiet hoa don offline va chon dich vu phat sinh.
- Luong tao ket qua kham offline day du cho bac si.

### Quy tac chuyen phase

Chi duoc xem ho so la da tiep nhan khi co mot API tao `HangDoi` kem `ho_so_benh_nhan_id`, cung thong tin slot/schedule neu co. Khong su dung lai ham tao lich hen online de gia lap luong tai quay, vi se lam sai lich hen va doi soat thanh toan.

## 14. Quy trinh kiem thu tu dong

Bo test phai duoc chay theo 3 lop:

1. Unit/frontend: `cd frontend && npm test`.
2. Browser smoke: `cd frontend && npm run test:e2e:receptionist`.
3. API E2E day du: `cd backend && MONGODB_URI=<uri-db-test> npm run test:e2e:offline`.

API E2E tu tao du lieu co tien to `E2E-OFFLINE-`, kiem tra thieu token, tao hai ho so dung chung mot so dien thoai, chan trung ho so, tim slot, claim slot atomic, ngan claim lan hai, dua vao hang doi bac si, xem lich su, goi/vào phong/ket thuc, lap hoa don co dich vu phat sinh va thu tien mat. Script luon don dep profile, hang doi, hoa don, thanh toan, dich vu mau, room snapshot va tra slot ve `active` trong `finally`.

Script API E2E tu choi chay neu ten database khong chua `TEST` hoac `E2E`. Khong duoc doi hang rao nay de chay tren `DATN_VITAFAMILY`; can tao/chon mot database test rieng trong MongoDB Cloud va truyen URI qua `MONGODB_URI`.

Ket qua kiem thu ngay 2026-07-28:
- Frontend unit: 51/51 pass.
- Browser E2E: 4/4 pass, bao gom tiep nhan/check-in, lap hoa don/thu tien dich vu phat sinh, xac nhan chuyen khoan pending va bac si nhap ket qua kham offline.
- Frontend build: pass; da tach chunk theo route, khong con chunk nao vuot 500 kB.
- API E2E: da kiem tra hang rao an toan va dung lai truoc DB production; chua ghi du lieu vi `.env` dang tro vao `DATN_VITAFAMILY`.
- Backend regression: 64/64 pass; fixture idempotent, tai khoan bac si phu dung seed va test admin co retry khi server vua khoi dong.
- Frontend typecheck: pass.

## 15. Cap nhat review chuc nang ngay 2026-07-28

Da sua cac rui ro phat hien khi review:
- Khong cho cung mot ho so co hai luot offline dang giu cho trong cung ngay; co kiem tra lai trong transaction de xu ly hai le tan thao tac dong thoi.
- Hoa don offline giu lai cac dich vu da them, chi cong dich vu moi; them `service_id` vao dong thu phi de tranh cong trung khi lap lai.
- Chan lap lai hoa don khi dang co giao dich chuyen khoan pending, tranh thu trung tien neu giao dich cu ve sau thanh cong.
- Bac si co the mo form nhap ket qua cho luot offline, luu chan doan, sinh hieu va don thuoc; ket qua gan voi `hang_doi_id` va lich su ho so dung chung.
- Thu ngan co danh sach luot offline da kham, xem hoa don, chon dich vu phat sinh va thu tien mat/chuyen khoan.
- Thu ngan co the xac nhan hoac huy giao dich chuyen khoan pending qua API rieng, cap nhat lai tong da thu va trang thai hoa don.

Da hoan tat cac viec uu tien cua dot review:
- Thu ngan co the xac nhan hoac huy giao dich chuyen khoan offline pending; he thong van chan thao tac lap trung khi giao dich dang cho.
- Frontend da tach chunk theo route de giam tai lan dau.
- Test fixture backend va typecheck frontend da duoc sua de san sang bat CI strict.

Da kiem tra va hoan thien viec day du lieu sang man hinh bac si:
- Sau check-in online, offline va khach den truc tiep, `HangDoi` duoc tao trong transaction voi `doctor_id`, nen API `GET /api/doctor/queue` doc duoc dung luot cua bac si.
- Truoc khi sua, backend chua phat su kien cho bac si va `DoctorExamQueue` chi tai mot lan khi mo trang; bac si dang mo man hinh se chi thay ca moi sau khi refresh hoac thao tac khac.
- Da them room socket rieng theo `NguoiDung._id` cua bac si va event `doctor:queue_updated`. Event duoc phat sau khi transaction commit, khong chua du lieu nhay cam va khong duoc xem la nguon du lieu.
- `DoctorExamQueue` tai lai ngay khi nhan event va polling lai moi 15 giay lam fallback khi WebSocket mat ket noi.
- Realtime chi la best-effort; neu khong tim thay tai khoan bac si hoac socket loi thi check-in van thanh cong vi MongoDB moi la nguon su that.
