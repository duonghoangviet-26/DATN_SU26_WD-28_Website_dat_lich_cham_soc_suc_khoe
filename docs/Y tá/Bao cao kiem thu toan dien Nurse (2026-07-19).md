# PROMPT 30 — Báo cáo kiểm thử toàn diện trang Y tá

> Ngày: 2026-07-19 · Nhánh `Bac_si`. **Nguyên tắc: chỉ đánh dấu PASS cho test ĐÃ CHẠY THẬT.** Test cần server + DB ghi được → đánh dấu **NOT RUN (BLOCKED)**, không fake pass.

## Môi trường & giới hạn
- Cloud DB **read-only** (ràng buộc) → không chạy được test integration (chúng tạo fixture = ghi DB).
- Chưa có server chạy + chưa có local test DB (seed PROMPT 29 **chưa chạy** theo yêu cầu).
- Frontend **không có** harness component (RTL/jsdom) — chỉ có vitest cho service/util.
- ⇒ Chạy được thật: **unit thuần (BE, node:test)**, **service/mapping/filter (FE, vitest)**, **static (typecheck/build)**. Integration/E2E/component render: **chưa chạy**.

## Lệnh đã chạy (bằng chứng)
| Lệnh | Kết quả thật |
|---|---|
| `node --test tests/nurse-unit.test.js` (BE) | **9 pass / 0 fail** |
| `npx vitest run src/__tests__/services/nurse.service.test.ts` (FE) | **9 pass / 0 fail** |
| `npx vitest run` (toàn FE) | **51 pass / 3 fail** (3 fail ở `payment.service`+`service.service`, **không liên quan nurse**) |
| `npm run typecheck` | 110 lỗi/3 file = **baseline**, 0 lỗi nurse mới |
| `npm run build` | ✅ (7.19s) |

---

## LỚP 1 — UNIT TEST (ĐÃ CHẠY THẬT ✅)

### BE thuần — `backend/tests/nurse-unit.test.js` (node:test, không DB)
| Test case | Input | Expected | Actual | Pass/Fail | Lỗi |
|---|---|---|---|---|---|
| Validation ngày tái khám — cùng ngày | `('2026-07-19','2026-07-19')` | `false` | `false` | **PASS** | — |
| Validation — hôm sau | `('2026-07-20','2026-07-19')` | `true` | `true` | **PASS** | — |
| Validation — quá khứ | `('2026-07-18','2026-07-19')` | `false` | `false` | **PASS** | — |
| State/priority — offline | `('offline',now,now)` | `offline` | `offline` | **PASS** | — |
| State/priority — online thiếu giờ gốc | `('online',now,null)` | `offline` | `offline` | **PASS** | — |
| State/priority — đúng giờ | lệch 0 | `online_uu_tien` | `online_uu_tien` | **PASS** | — |
| State/priority — trong ±30' | trễ 20' | `online_uu_tien` | `online_uu_tien` | **PASS** | — |
| State/priority — trễ >30' | trễ 45' | `offline` (mất ưu tiên) | `offline` | **PASS** | — |
| State/priority — sớm >30' | sớm 45' | `online_thuong` | `online_thuong` | **PASS** | — |

### FE service/mapping/filter — `frontend/src/__tests__/services/nurse.service.test.ts` (vitest, mock axios)
| Test case | Input | Expected | Actual | Pass/Fail | Lỗi |
|---|---|---|---|---|---|
| getQueue lọc tham số | `{date,status:'',q,page:1,limit:20}` | gọi `/nurse/appointments` params **bỏ status rỗng**, page/limit dạng chuỗi | đúng | **PASS** | — |
| getQueue rỗng | `()` | params `{}` | `{}` | **PASS** | — |
| getPendingRecords | `{date}` | `/nurse/appointments/pending-records` | đúng | **PASS** | — |
| getSchedule | `{from,to}` | `/nurse/schedule` from/to | đúng | **PASS** | — |
| getAppointmentById | `'x1'` | `/nurse/appointments/x1`, unwrap data | đúng | **PASS** | — |
| createDraft (form logic) | payload | POST `/nurse/medical-records` | đúng | **PASS** | — |
| submit (gửi hồ sơ) | `'r1'` | PATCH `.../r1/submit` | đúng | **PASS** | — |
| resubmit (gửi lại) | `'r1'` | PATCH `.../r1/resubmit` | đúng | **PASS** | — |
| checkinQueue (mapping) | `{appointment_id}` | POST `/nurse/queue/checkin` | đúng | **PASS** | — |

**Bao phủ lớp unit:** hàm lọc ✅ · validation ✅ · state transition/priority ✅ · mapping response ✅ · form logic (payload) ✅. *Permission helper* (`getMyDoctorIdsOnDate`) là hàm chạm DB → thuộc lớp integration (dưới).

---

## LỚP 2 — API / INTEGRATION (CHƯA CHẠY — BLOCKED)
> Cần server chạy + **DB ghi được** (test tạo fixture). Cloud read-only + chưa có local test DB ⇒ **KHÔNG chạy** ⇒ **không đánh dấu pass**. Các file test **đã tồn tại, sẵn sàng** chạy sau khi bật server + seed PROMPT 29.

| Test case | File test có sẵn | Expected | Actual | Pass/Fail |
|---|---|---|---|---|
| Auth/Role/Ownership | `nurse-*.test.js` (login + scope) | 401/403 khi sai quyền | **NOT RUN** | — chưa chạy |
| Danh sách lịch hẹn (ca-scope) | `nurse-doctor-status-sync.test.js` | chỉ thấy lịch trong ca | **NOT RUN** | — |
| Chi tiết lịch hẹn | (getById) | 404 nếu ngoài ca | **NOT RUN** | — |
| Check-in → bác sĩ thấy | `nurse-doctor-status-sync.test.js:98` | 201 + HangDoi | **NOT RUN** | — |
| Tạo hồ sơ / Lưu nháp | `nurse.createdraft-appointment.test.js` | 409 nếu chưa check-in; tạo `ban_nhap` | **NOT RUN** | — |
| Gửi hồ sơ (transaction) | (submit) | `cho_xac_nhan`+`waiting_doctor_confirm` | **NOT RUN** | — |
| Yêu cầu sửa | `doctor.confirm-result.test.js` (mới) | `yeu_cau_chinh_sua`+`waiting_record` | **NOT RUN** | — |
| Gửi lại | (resubmit) | về `cho_xac_nhan` | **NOT RUN** | — |
| Khóa sau xác nhận | (update/submit trên `da_xac_nhan`) | 409 | **NOT RUN** | — |
| Request lặp | (submit 2 lần) | lần 2 → 409 | **NOT RUN** | — |
| Dữ liệu không tồn tại | (id sai) | 404 | **NOT RUN** | — |

## LỚP 3 — FRONTEND (component render) — CHƯA CHẠY
> Repo **không có** RTL/jsdom ⇒ không render component để test Loading/Error/Empty/Modal/Responsive/Điều hướng. Logic gián tiếp được phủ qua service test + typecheck + build.

| Nhóm | Actual | Pass/Fail |
|---|---|---|
| Loading / Error / Empty / Filter UI / Search / Modal / Form validation / Disable / Điều hướng / Responsive | **NOT RUN** (thiếu harness component) | — chưa chạy |

## LỚP 4 — END-TO-END — CHƯA CHẠY
| Test case | Expected | Actual | Pass/Fail |
|---|---|---|---|
| Luồng nurse–bác sĩ: đặt lịch → check-in → khám → nhập → gửi → yêu cầu sửa → gửi lại → xác nhận → khóa | mỗi bước đồng bộ đúng | **NOT RUN** (cần server + seed) | — chưa chạy |

---

## Tổng kết trung thực
- **Đã chạy & PASS:** 9 (BE unit) + 9 (FE service) = **18/18**; static typecheck baseline + build ✅.
- **Regression FE:** 51/54 pass — 3 fail **có sẵn**, thuộc payment/service (không liên quan nurse).
- **CHƯA chạy (blocked):** toàn bộ integration (11 nhóm) + component FE (10 nhóm) + E2E — do thiếu server + local test DB ghi được (Cloud read-only). **Không nhóm nào bị đánh dấu pass.**

## Việc cần để hoàn tất kiểm thử (khi được phép)
1. Bật local test DB + đặt `NURSE_TEST_MONGODB_URI`, chạy seed PROMPT 29 (`--confirm`).
2. Chạy server test, rồi `node --test tests/nurse-*.test.js` + `doctor.confirm-result.test.js` (đã có test request-revision mới).
3. (Tùy) thêm RTL/jsdom để test render component; chạy E2E 10 kịch bản PROMPT 28.
