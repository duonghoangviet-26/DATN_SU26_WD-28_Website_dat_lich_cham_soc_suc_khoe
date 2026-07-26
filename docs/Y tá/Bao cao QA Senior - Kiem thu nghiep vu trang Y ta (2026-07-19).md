# Báo cáo QA (Senior QA Lead) — Kiểm thử nghiệp vụ trang Y tá

> Ngày: 2026-07-19 · Nhánh `Bac_si` (sau merge `main` PR #24). Góc nhìn: **black-box theo Spec + nghiệp vụ**, KHÔNG đọc code để phán đúng/sai.

## ⚠️ Tuyên bố phạm vi thực thi (liêm chính QA)
Phiên này **không có môi trường chạy live** (Cloud read-only · không server · không local test DB replica-set). Do đó:
- **KHÔNG** test nào chưa thực thi được đánh dấu ✅ PASS.
- Phân tầng chứng thực:
  - **[V] Đã chứng thực thật** — có bằng chứng lệnh chạy (unit test, syntax, load runtime, merge).
  - **[D] Thiết kế/chưa chạy live** — test case đã soạn, cần server + DB test mới xác nhận.
  - **[R] Rủi ro phát hiện qua phân tích Spec** — cần tái hiện live để xác nhận là lỗi thật.

---

## Bước 1–2: Đối chiếu Spec ↔ chức năng thực tế

| Chức năng (Spec) | Có trong hệ thống? | Ghi chú |
|---|---|---|
| Dashboard Y tá (đếm hàng đợi / hồ sơ cần nhập / cần sửa) | Có | Wiring đã nối NurseRevisions |
| Danh sách lịch hẹn / Hàng đợi (ca-scope) | Có | Scope theo `LichLamViec.nurse_id → getMyDoctorIdsToday` |
| Chi tiết lịch hẹn + Tiếp nhận (check-in) | Có | Online + offline |
| Hồ sơ cần nhập (pending-records) | Có | |
| Form nhập/lưu hồ sơ khám (nháp) | Có | `ban_nhap` |
| Gửi hồ sơ cho bác sĩ / Gửi lại | Có | `submit`/`resubmit`, transaction |
| Hồ sơ cần sửa (revision) | Có | Doctor `requestRevision` → nurse resubmit |
| Ca làm việc (schedule) | Có | |
| Thanh toán | Chỉ đọc | Không có endpoint ghi cho y tá |

**Kết luận đối chiếu:** mọi chức năng trong Spec đều hiện diện. Không phát hiện chức năng "ghost" (có UI nhưng thiếu API) sau khi NurseRevisions được nối.

---

## Bước 3–4: Danh mục Test Case theo 10 nhóm

### 1) Business Logic
| ID | Test case | Expected (Spec) | Tầng | Kết quả |
|---|---|---|---|---|
| BL-01 | Ngày tái khám cùng ngày khám | Từ chối (false) | [V] | PASS (unit) |
| BL-02 | Ngày tái khám hôm sau | Chấp nhận | [V] | PASS (unit) |
| BL-03 | Ngày tái khám quá khứ | Từ chối | [V] | PASS (unit) |
| BL-04 | Ưu tiên online đúng giờ (±30') | `online_uu_tien` | [V] | PASS (unit) |
| BL-05 | Online trễ >30' | Mất ưu tiên → `offline` | [V] | PASS (unit) |
| BL-06 | Online sớm >30' | `online_thuong` | [V] | PASS (unit) |
| BL-07 | Online thiếu giờ gốc | `offline` | [V] | PASS (unit) |
| BL-08 | Y tá KHÔNG tự set `da_xac_nhan` | Chỉ bác sĩ xác nhận | [D] | Chưa chạy live |
| BL-09 | Y tá KHÔNG tự chuyển `completed` | Bị chặn | [D] | Chưa chạy live |
| BL-10 | Gửi hồ sơ thiếu chẩn đoán | 400 "Chẩn đoán bắt buộc" | [D] | Chưa chạy live |

### 2) Functional
| ID | Test case | Expected | Tầng | Kết quả |
|---|---|---|---|---|
| FN-01 | Check-in online → tạo lượt HangDoi + LichHen `confirmed` | 201 + entry | [D] | Chưa chạy live |
| FN-02 | Check-in offline (khách vãng lai) | 201, bắt buộc tên+SĐT | [D] | Chưa chạy live |
| FN-03 | Gọi vào phòng (into-room) | HangDoi `trong_phong` + LichHen `in_progress` | [D] | Chưa chạy live |
| FN-04 | Kết thúc khám (finish) | HangDoi `hoan_thanh` + LichHen `waiting_record` | [D] | Chưa chạy live |
| FN-05 | Tạo nháp hồ sơ | `ban_nhap` | [D] | Chưa chạy live |
| FN-06 | Gửi hồ sơ | `cho_xac_nhan` + LichHen `waiting_doctor_confirm` | [D] | Chưa chạy live |
| FN-07 | Bác sĩ yêu cầu sửa → y tá gửi lại | `yeu_cau_chinh_sua` → `cho_xac_nhan` | [D] | Chưa chạy live |
| FN-08 | Service mapping FE (filter/unwrap) | Đúng endpoint & params | [V] | PASS (9/9 vitest) |

### 3) Permission
| ID | Test case | Expected | Tầng | Kết quả |
|---|---|---|---|---|
| PM-01 | Không token gọi `/nurse/*` | 401 | [D] | Chưa chạy live |
| PM-02 | Role `user`/`doctor`/`admin` gọi `/nurse/*` | 403 | [D] | Chưa chạy live |
| PM-03 | Y tá xem lịch NGOÀI ca mình | Không thấy / 404 | [R][D] | Rủi ro — cần test |
| PM-04 | Y tá thao tác lượt của bác sĩ khác | 403 | [D] | Chưa chạy live |
| PM-05 | Y tá gọi endpoint thanh toán (ghi) | Không tồn tại endpoint | [V] | PASS (static: không có route) |

### 4) API
| ID | Test case | Expected | Tầng | Kết quả |
|---|---|---|---|---|
| API-01 | Envelope `{success,message,data}` | Đúng chuẩn | [V] | PASS (service test unwrap `data.data`) |
| API-02 | ID không tồn tại | 404 | [D] | Chưa chạy live |
| API-03 | Body sai kiểu (validation) | 400 | [D] | Chưa chạy live |
| API-04 | Sửa hồ sơ `da_xac_nhan` qua endpoint chung | 409 "đã xác nhận" | [D] | Chưa chạy live |

### 5) Database
| ID | Test case | Expected | Tầng | Kết quả |
|---|---|---|---|---|
| DB-01 | Unique `appointment_id` trong HangDoi | Chặn trùng | [R][D] | Rủi ro race (xem F-01) |
| DB-02 | Transaction rollback khi lỗi giữa chừng (checkin/into-room/finish/submit) | Không lệch trạng thái | [D] | Chưa chạy live (cần replica set) |
| DB-03 | Không đổi schema khi merge | Giữ nguyên | [V] | PASS (không sửa model) |

### 6) UI/UX
| ID | Test case | Expected | Tầng | Kết quả |
|---|---|---|---|---|
| UX-01 | Loading/Error/Empty ở 6 trang | Có đủ | [V] | PASS (static — báo cáo cuối) |
| UX-02 | Form read-only sau `da_xac_nhan` + banner người/lúc xác nhận | Hiển thị đúng | [D] | Chưa render test (thiếu RTL) |
| UX-03 | Ẩn nút Sửa/Gửi lại khi đã khóa | Ẩn | [D] | Chưa render test |
| UX-04 | Console runtime sạch | 0 error | [R] | Chỉ static sạch — runtime chưa kiểm |

### 7) Exception
| ID | Test case | Expected | Tầng | Kết quả |
|---|---|---|---|---|
| EX-01 | Check-in lịch đã `cancelled/completed/no_show/skipped` | 409 | [D] | Chưa chạy live |
| EX-02 | Check-in lịch không phải hôm nay | 409 | [D] | Chưa chạy live |
| EX-03 | Into-room khi phòng chưa `san_sang` | 409 | [D] | Chưa chạy live |
| EX-04 | Finish khi bệnh nhân không khớp người trong phòng | 409 | [D] | Chưa chạy live |
| EX-05 | Gửi lại hồ sơ đã `da_xac_nhan` | 409 "không thể gửi lại" | [D] | Chưa chạy live |

### 8) Boundary Value
| ID | Test case | Expected | Tầng | Kết quả |
|---|---|---|---|---|
| BV-01 | Ưu tiên tại đúng mốc ±30' (biên) | Đúng nhánh | [V] | PASS (unit lệch 20' & 45') |
| BV-02 | Ngày tái khám = đúng ngày kế tiếp (biên dưới) | Chấp nhận | [V] | PASS (unit) |
| BV-03 | Offline thiếu tên HOẶC SĐT (rỗng/space) | 400 | [D] | Chưa chạy live |
| BV-04 | Phân trang page/limit dạng chuỗi & rỗng | Lọc đúng | [V] | PASS (service test) |

### 9) Concurrency
| ID | Test case | Expected | Tầng | Kết quả |
|---|---|---|---|---|
| CC-01 | 2 request check-in cùng 1 `appointment_id` đồng thời | 1 thành công, 1 nhận **409 graceful** | [R][D] | **Rủi ro F-01** |
| CC-02 | 2 y tá cùng gọi into-room/finish 1 phòng | 1 thành công, 1 bị chặn | [R][D] | **Rủi ro F-03** |
| CC-03 | Bác sĩ xác nhận trong lúc y tá đang gửi lại | Không lệch trạng thái | [D] | Chưa chạy live |

### 10) Regression
| ID | Test case | Expected | Tầng | Kết quả |
|---|---|---|---|---|
| RG-01 | Sau merge, 2 controller nurse load được | Import/export OK | [V] | PASS (`import()` OK) |
| RG-02 | Unit test cũ vẫn xanh | 9/9 | [V] | PASS |
| RG-03 | Realtime của main còn hoạt động sau resolve | Emit khi đổi status | [D] | Chưa kiểm live |
| RG-04 | Tính nguyên tử P28 còn giữ sau resolve | Transaction bao LichHen | [D] | Chưa kiểm live |
| RG-05 | Build FE toàn dự án | Thành công | [V] | PASS (báo cáo cuối 6.61s) |

---

## Bước 6: Danh sách lỗi / rủi ro phát hiện (theo phân tích Spec — cần tái hiện live để xác nhận)

### F-01 — Chống trùng check-in không an toàn khi đồng thời — **[High]**
- **Mô tả:** Kiểm tra "lịch đã có trong hàng đợi" thực hiện **trước** khối transaction tạo lượt. Hai request song song có thể cùng vượt qua kiểm tra, request thứ hai vỡ ở unique index.
- **Điều kiện:** 2 thao tác check-in cùng `appointment_id` gần như đồng thời (2 tab / 2 thiết bị / double-click).
- **Nghiêm trọng:** High (trả **500** thay vì **409 thân thiện**; trải nghiệm xấu, khó chẩn đoán).
- **Bước tái hiện:** Bắn song song 2 `POST /nurse/queue/checkin` cùng `appointment_id`.
- **Ảnh hưởng:** Tiếp nhận hàng đợi.
- **Đề xuất (không tự sửa):** Bắt lỗi duplicate-key (E11000) → map sang 409 "đã có trong hàng đợi"; hoặc đưa kiểm tra tồn tại vào trong transaction.

### F-02 — skip/cancel cập nhật LichHen KHÔNG nguyên tử — **[Medium]**
- **Mô tả:** Chỉ check-in/into-room/finish/submit được bọc transaction; `skip`/`cancel` cập nhật `LichHen.status` ngoài transaction. Lỗi giữa chừng có thể lệch HangDoi ↔ LichHen.
- **Điều kiện:** Lỗi mạng/DB đúng thời điểm giữa 2 bước ghi.
- **Nghiêm trọng:** Medium (ít bước, xác suất thấp; nhưng vẫn là điểm lệch trạng thái).
- **Bước tái hiện:** Giả lập lỗi ghi LichHen sau khi đã đổi HangDoi trong skip/cancel.
- **Ảnh hưởng:** Bỏ qua / hủy lượt.
- **Đề xuất:** Bọc transaction đồng nhất như 3 hành động kia (nằm trong phạm vi nurse).

### F-03 — TOCTOU trạng thái phòng (into-room/finish) — **[Medium]**
- **Mô tả:** Kiểm tra trạng thái phòng (`san_sang` / bệnh nhân khớp) thực hiện **trước** transaction; giữa kiểm tra và ghi có khe thời gian.
- **Điều kiện:** 2 y tá điều khiển cùng 1 phòng đồng thời.
- **Nghiêm trọng:** Medium.
- **Ảnh hưởng:** Điều khiển phòng khám.
- **Đề xuất:** Kiểm tra + cập nhật có điều kiện (atomic conditional update) trong transaction.

### F-04 — Không realtime giữa hai trang (doctor ↔ nurse) — **[Medium/High tuỳ nghiệp vụ]**
- **Mô tả:** Dashboard admin nay có realtime (main), nhưng **dữ liệu chi tiết trang nurse/doctor không đẩy realtime**; hai bên thấy dữ liệu cũ tới khi reload.
- **Điều kiện:** Bác sĩ mở hồ sơ trong lúc y tá vừa gửi lại / khoá.
- **Nghiêm trọng:** Medium (chức năng vẫn đúng khi reload); có thể High về nghiệp vụ nếu bác sĩ thao tác trên bản cũ.
- **Ảnh hưởng:** Đồng bộ hồ sơ khám.
- **Đề xuất:** Refetch-on-focus tối thiểu; lâu dài WebSocket/polling (đã ghi ở Hướng phát triển).

### F-05 — Emit realtime best-effort sau commit — **[Low]**
- **Mô tả:** Emit đặt ngoài transaction (đúng để tránh emit lặp), nhưng nếu socket lỗi thì dashboard admin không được cập nhật, không rollback.
- **Nghiêm trọng:** Low (chấp nhận được; nên log để giám sát).

### F-06 — Enum `checked_in` không có producer — **[Low]**
- **Mô tả:** Trạng thái tồn tại trong schema nhưng không luồng nào tạo. Nợ kỹ thuật/nhầm lẫn tiềm ẩn.
- **Đề xuất:** Gỡ hoặc kích hoạt có chủ đích.

### F-07 — Offline lấy phòng/chuyên khoa từ slot đầu tiên — **[Low/Info]**
- **Mô tả:** Check-in offline suy ra `phong_kham`/`specialty` từ slot đầu của ca; nếu bác sĩ có nhiều slot/phòng trong ngày có thể gán chưa chính xác.
- **Đề xuất:** Cho phép chọn/khớp slot khi có >1.

---

## Bước 7: Phân loại & tỷ lệ hoàn thành

### Phân loại theo nhóm
| Nhóm | Trạng thái | Lý do |
|---|---|---|
| Business Logic | ⚠️ PASS WITH WARNING | Logic thuần PASS thật (unit); ràng buộc quyền set trạng thái chưa chạy live |
| Functional | ⚠️ PASS WITH WARNING | Service FE PASS; luồng ghi DB chưa chạy live |
| Permission | ⚠️ PASS WITH WARNING | Cưỡng chế ở code (route+FE); chưa xác thực 401/403/scope live |
| API | ⚠️ PASS WITH WARNING | Envelope/mapping PASS; mã lỗi 404/400/409 chưa chạy live |
| Database | ⚠️ PASS WITH WARNING | Schema giữ nguyên; transaction/unique **chưa chạy** + **F-01** |
| UI/UX | ⚠️ PASS WITH WARNING | Static đủ trạng thái; render/console runtime chưa kiểm |
| Exception | 🧪 CHƯA CHẠY | Toàn bộ cần server |
| Boundary | ✅ PASS (phần đã chạy) | Biên logic thuần đã unit-test; biên input DB chưa chạy |
| Concurrency | ❌ FAIL (rủi ro) | **F-01 High**, F-03 Medium — thiết kế hiện tại chưa an toàn đồng thời |
| Regression | ⚠️ PASS WITH WARNING | Load/unit/build PASS; realtime & nguyên tử sau resolve chưa kiểm live |

### Tỷ lệ hoàn thành (tách bạch để không phóng đại)
- **Độ phủ thiết kế test case:** ~**95%** (10 nhóm, ~45 case).
- **Đã chứng thực thực thi thật [V]:** ~**33%** số case (unit logic + service FE + static + merge/regression tĩnh).
- **Chưa chạy live [D] (blocked môi trường):** ~**60%**.
- **Rủi ro cần vá [R]:** F-01 (High), F-02/F-03/F-04 (Medium).

**Kết luận tổng:** ⚠️ **PASS WITH WARNING** về code & logic thuần; ❌ **chưa đạt** ở **Concurrency** (F-01) và **chưa xác thực live** ở phần lớn Functional/Permission/API/Exception. **Không tuyên bố "hệ thống hoàn hảo".**

---

## Khu vực rủi ro cao khi triển khai thực tế
1. **Đồng thời tiếp nhận hàng đợi (F-01)** — môi trường thật nhiều máy tiếp tân/y tá → race check-in dễ xảy ra → lỗi 500. **Ưu tiên vá số 1.**
2. **Đồng bộ chéo doctor↔nurse không realtime (F-04)** — nguy cơ thao tác trên dữ liệu cũ ở phòng khám bận. **Ưu tiên vá số 2** (tối thiểu refetch-on-focus).
3. **Nguyên tử skip/cancel (F-02) & TOCTOU phòng (F-03)** — lệch trạng thái hiếm nhưng khó truy vết trong vận hành.
4. **Chưa từng chạy integration/E2E/permission live** — mọi đảm bảo nghiệp vụ mới ở mức "cưỡng chế bởi code", **chưa có bằng chứng runtime**. Rủi ro tồn đọng cho tới khi dựng môi trường test.

## Điều kiện để nâng các [D]/🧪 lên PASS thật
Bật local MongoDB **replica set** → đặt `NURSE_TEST_MONGODB_URI` → chạy seed PROMPT 29 → `node --test tests/nurse-*.test.js` + E2E 10 kịch bản. Chỉ khi đó mới được đánh dấu PASS cho Functional/Permission/API/Exception/Concurrency.
