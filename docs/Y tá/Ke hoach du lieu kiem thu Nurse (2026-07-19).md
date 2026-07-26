# PROMPT 29 — Kế hoạch & dữ liệu kiểm thử an toàn trang Y tá

> Ngày: 2026-07-19 · Nhánh `Bac_si`. Đánh giá dữ liệu hiện tại + thiết kế seed cho **test DB riêng**. **KHÔNG chạy** (theo yêu cầu). Không chạm Cloud/production.

## 1. Đánh giá dữ liệu hiện tại (Cloud, read-only)
Từ khảo sát các prompt trước (chỉ đọc, không ghi):

| Thực thể | Hiện trạng Cloud | Đủ test nurse? |
|---|---|---|
| Y tá | 1 (`role='nurse'`) | ⚠️ Chỉ 1 — không test được "nhiều y tá / phân quyền chéo" |
| `LichLamViec.nurse_id` hôm nay | **0 ca hôm nay** cho y tá | ❌ Nurse scope = `getMyDoctorIdsOnDate` rỗng → **mọi trang trống** |
| KetQuaKham | 7 (đều appointment-only, dữ liệu cũ) | ⚠️ Không có `hang_doi_id`; thiếu `ban_nhap`, thiếu vòng revision "sống" |
| HangDoi | 28 (offline/skipped rác) | ❌ Không gắn đúng lịch hôm nay theo ca y tá |
| Ca nhiều bác sĩ / chưa đến / đang khám / chờ nhập | — | ❌ Không có tổ hợp sạch |

**Kết luận:** **KHÔNG đủ.** Thiếu mấu chốt `LichLamViec.nurse_id` hôm nay (điều kiện tiên quyết của toàn bộ scope y tá) và thiếu tổ hợp trạng thái sạch. → Cần seed trên **test DB riêng**, không đụng Cloud.

## 2. Nguyên tắc an toàn (đã cài trong script)
- **Chỉ chạy trên test DB:** yêu cầu biến môi trường **`NURSE_TEST_MONGODB_URI`** riêng; script **từ chối** nếu: bằng `MONGODB_URI` (prod), tên DB không chứa `test`/`local` (trừ `--force`), hoặc `NODE_ENV=production`.
- **Phải xác nhận rõ:** seed cần cờ `--confirm`; cleanup cần `--cleanup`. Không cờ → chỉ in hướng dẫn, không ghi gì.
- **Không dữ liệu thật/nhạy cảm:** email `@nursetest.local`, tên có tiền tố `(NURSETEST)`, mã lịch `NRT_...`, SĐT giả `0900000xxx`, mật khẩu test cố định (không log).
- **Đúng schema, không đoán field:** mọi field lấy từ model thật (`NguoiDung`, `BacSi`, `LichLamViec`, `LichHen`, `HangDoi`, `KetQuaKham`, `SinhHieuKham`, `GiaDinh`, `ThanhVien`). ChuyenKhoa **tái sử dụng** bản có sẵn (không tự dựng — cần base seed trước).
- **Cleanup:** `--cleanup` xóa theo marker (cascade users→doctor profiles→schedules→appointments→queue/record/vitals→family/member). Idempotent.
- **Không tự chạy** (theo yêu cầu) — chỉ bàn giao file.

## 3. Thực thể seed
| Mã | Loại | Vai trò test |
|---|---|---|
| N1 `nurse.one@nursetest.local` | y tá | Chính — nhiều ca, hôm nay phụ trách D1+D2 |
| N2 `nurse.two@nursetest.local` | y tá | Một ca (hôm nay D3) — phân quyền chéo |
| N3 `nurse.none@nursetest.local` | y tá | **Không ca** |
| D1/D2 `doctor.one/two@nursetest.local` | bác sĩ | Hôm nay chung y tá N1 → **ca nhiều bác sĩ** |
| D3 `doctor.three@nursetest.local` | bác sĩ | Của N2 — N1 không được thấy |
| P1 `patient.one@nursetest.local` (+GiaDinh+ThanhVien) | bệnh nhân | Lịch qua `member_id` |

Ca (`LichLamViec`, `nurse_id`): **T (hôm nay)** D1.nurse_id=N1, D2.nurse_id=N1, D3.nurse_id=N2 · **T+1** D1.nurse_id=N1.

## 4. Ánh xạ 18 tình huống → dữ liệu
| # | Tình huống | Dữ liệu seed |
|---|---|---|
| 1 | Y tá có một ca | N2 → 1 `LichLamViec` (T, D3) |
| 2 | Y tá có nhiều ca | N1 → `LichLamViec` T (D1,D2) + T+1 (D1) |
| 3 | Y tá không có ca | N3 → 0 `LichLamViec` |
| 4 | Ca có nhiều bác sĩ | T: D1.nurse_id=N1 **và** D2.nurse_id=N1 → scope N1={D1,D2} |
| 5 | Lịch chưa đến | A1: `status=confirmed`, `trang_thai_den=null`, không HangDoi |
| 6 | Lịch đã đến | A2: `confirmed`, `trang_thai_den='da_den'` + HangDoi `dang_cho` |
| 7 | Lịch đang khám | A3: `in_progress` + HangDoi `trong_phong` |
| 8 | Lịch chờ nhập hồ sơ | A4: `waiting_record` + HangDoi `hoan_thanh`, **chưa** KetQuaKham |
| 9 | Hồ sơ nháp | A5: KetQuaKham `ban_nhap` (`hang_doi_id`+`appointment_id`) + SinhHieuKham |
| 10 | Hồ sơ đã gửi | A6: KetQuaKham `cho_xac_nhan`, LichHen `waiting_doctor_confirm` |
| 11 | Hồ sơ cần sửa | A7: KetQuaKham `yeu_cau_chinh_sua`+`doctor_revision_note`+`lich_su_sua`, LichHen `waiting_record` |
| 12 | Hồ sơ đã xác nhận | A8: KetQuaKham `da_xac_nhan`+`nguoi_xac_nhan_id`+`thoi_diem_xac_nhan`, LichHen `completed` (khóa) |
| 13 | Lịch hủy | A9: `cancelled`+`ly_do_huy`+`huy_boi` |
| 14 | Bệnh nhân không đến | A10: `no_show`+`trang_thai_den='khong_den'` |
| 15 | Dữ liệu quan hệ bị thiếu | A11: `member_id`=ObjectId **treo** (không có ThanhVien), `ten_khach=null` → kiểm null-guard hiện `'Không rõ'` |
| 16 | Y tá khác cố truy cập | A12 dưới D3 (của N2). Kỳ vọng: N1 **không** thấy A12; N2 không thấy A1–A11 |
| 17 | Hồ sơ trùng | A5/A6 đã có KetQuaKham → gọi `createDraft` lại ⇒ **409** (unique `appointment_id`/`hang_doi_id`). *Hành động test — seed tạo tiền đề* |
| 18 | Hai thao tác đồng thời | A5 `ban_nhap` sẵn sàng → 2 request `submit` song song ⇒ 1×200, 1×409. *Hành động test — seed tạo tiền đề* |

> #17, #18 là **kịch bản hành động** (không seed dữ liệu trùng vì unique index chặn) — seed dựng đúng tiền đề để chạy test đồng thời/lặp.

## 5. Cách dùng (khi được yêu cầu — hiện KHÔNG chạy)
```bash
# .env.test:  NURSE_TEST_MONGODB_URI=mongodb://127.0.0.1:27017/vitafamily_test
cd backend
# (tuỳ chọn) chạy base seed để có ChuyenKhoa/PhongKham nếu DB trắng
node src/scripts/seed-nurse-test-data.js --confirm     # tạo dữ liệu test
node src/scripts/seed-nurse-test-data.js --cleanup     # dọn sạch theo marker
```
Script: `backend/src/scripts/seed-nurse-test-data.js`.

## 6. Tài khoản test (mật khẩu chung, KHÔNG in log)
`nurse.one/two/none@nursetest.local`, `doctor.one/two/three@nursetest.local`, `patient.one@nursetest.local` — mật khẩu xem hằng số `*_PASSWORD` trong script.

## 7. Ghi nhận
- Test DB cần có sẵn `ChuyenKhoa` (base seed). Nếu trắng → script báo lỗi rõ, không tự đoán/tạo chuyên khoa.
- Seed KHÔNG dùng mock; toàn bộ ghi thật vào **test DB riêng**.
- Chạy live 10 kịch bản đồng bộ (PROMPT 28) dùng chính bộ dữ liệu này.
