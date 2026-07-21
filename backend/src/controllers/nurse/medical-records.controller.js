import {
    LichHen,
    KetQuaKham,
    SinhHieuKham,
    ThanhVien,
} from "../../models/index.js";
import { ok, created, fail } from "../../utils/response.js";
import { isNgayTaiKhamHopLe } from "../../utils/validators.js";
import { emitDashboardAppointmentChanged } from "../../realtime/socket.js";

// ============================================================
// Hồ sơ khám do y tá nhập (Y tá)
// Routes: /api/nurse/medical-records
//
// Nguyên tắc bắt buộc (mục XV đặc tả):
//   - Mọi thao tác chỉ áp dụng cho appointment.nurse_id = req.user.id (không tin FE).
//   - Y tá KHÔNG được tự set status = 'da_xac_nhan' (CONFIRMED) — chỉ bác sĩ mới xác nhận
//     được (PATCH /doctor/appointments/:id/result/confirm — endpoint có sẵn, dùng chung,
//     không cần route riêng cho y tá vì đã lọc đúng theo doctor_id ở đó).
//   - Y tá KHÔNG được tự chuyển LichHen.status sang 'completed'.
// ============================================================

async function findNurseAppointment(appointmentId, nurseId) {
    return LichHen.findOne({ _id: appointmentId, nurse_id: nurseId });
}

async function upsertVitals(appointmentId, memberId, nurseId, sinhHieu) {
    if (!sinhHieu) return;
    const { can_nang, chieu_cao, huyet_ap, nhiet_do, nhip_tim } = sinhHieu;
    await SinhHieuKham.findOneAndUpdate(
        { appointment_id: appointmentId },
        {
            $set: {
                appointment_id: appointmentId,
                member_id: memberId ?? null,
                can_nang,
                chieu_cao,
                huyet_ap,
                nhiet_do,
                nhip_tim,
                nguoi_do_id: nurseId,
                thoi_diem_do: new Date(),
            },
        },
        { upsert: true },
    );
}

function formatResult(r) {
    return {
        id: r._id,
        appointment_id: r.appointment_id,
        status: r.status,
        chan_doan: r.chan_doan,
        huong_dan_dieu_tri: r.huong_dan_dieu_tri,
        ghi_chu: r.ghi_chu,
        trieu_chung_ban_dau: r.trieu_chung_ban_dau,
        ghi_chu_dieu_duong: r.ghi_chu_dieu_duong,
        ngay_tai_kham: r.ngay_tai_kham,
        doctor_revision_note: r.doctor_revision_note,
        submitted_at: r.submitted_at,
        ngay_tao: r.ngay_tao,
    };
}

// ─── GET /api/nurse/medical-records?date=&status= ───────────────────────────
// Hồ sơ do chính y tá đang đăng nhập nhập (nguoi_nhap_id) — không xem được hồ sơ y tá khác nhập.
export async function list(req, res) {
    try {
        const { status } = req.query;
        const filter = { nguoi_nhap_id: req.user.id };
        if (status) filter.status = status;

        const results = await KetQuaKham.find(filter)
            .populate({
                path: "appointment_id",
                select: "ngay_kham ten_dich_vu member_id ten_khach doctor_id",
                populate: [
                    { path: "member_id", select: "ho_ten" },
                    {
                        path: "doctor_id",
                        populate: { path: "user_id", select: "ho_ten" },
                    },
                ],
            })
            .sort({ ngay_tao: -1 })
            .lean();

        const data = results
            .filter((r) => r.appointment_id)
            .map((r) => {
                const a = r.appointment_id;
                return {
                    id: r._id,
                    appointment_id: a._id,
                    benh_nhan: a.member_id?.ho_ten ?? a.ten_khach ?? "Không rõ",
                    bac_si: a.doctor_id?.user_id?.ho_ten ?? null,
                    ngay_kham: a.ngay_kham,
                    ten_dich_vu: a.ten_dich_vu,
                    status: r.status,
                };
            });

        return ok(res, data);
    } catch (err) {
        return fail(res, 500, err.message);
    }
}

// ─── GET /api/nurse/medical-records/revisions ───────────────────────────────
// Hồ sơ bị bác sĩ yêu cầu chỉnh sửa — CHỈ của chính y tá này (không xem được của y tá khác).
export async function listRevisions(req, res) {
    try {
        const results = await KetQuaKham.find({
            nguoi_nhap_id: req.user.id,
            status: "yeu_cau_chinh_sua",
        })
            .populate({
                path: "appointment_id",
                select: "ngay_kham ten_dich_vu ly_do_kham member_id ten_khach doctor_id",
                populate: [
                    { path: "member_id", select: "ho_ten" },
                    {
                        path: "doctor_id",
                        populate: { path: "user_id", select: "ho_ten" },
                    },
                ],
            })
            .sort({ ngay_cap_nhat: -1 })
            .lean();

        const data = results
            .filter((r) => r.appointment_id)
            .map((r) => {
                const a = r.appointment_id;
                return {
                    id: r._id,
                    appointment_id: a._id,
                    benh_nhan: a.member_id?.ho_ten ?? a.ten_khach ?? "Không rõ",
                    bac_si_yeu_cau: a.doctor_id?.user_id?.ho_ten ?? null,
                    ngay_kham: a.ngay_kham,
                    ly_do_kham: a.ly_do_kham,
                    doctor_revision_note: r.doctor_revision_note,
                    thoi_diem_yeu_cau: r.ngay_cap_nhat,
                };
            });

        return ok(res, data);
    } catch (err) {
        return fail(res, 500, err.message);
    }
}

// ─── GET /api/nurse/medical-records/:id ─────────────────────────────────────
export async function getById(req, res) {
    try {
        const result = await KetQuaKham.findOne({
            _id: req.params.id,
            nguoi_nhap_id: req.user.id,
        }).lean();
        if (!result)
            return fail(
                res,
                404,
                "Không tìm thấy hồ sơ khám hoặc không thuộc bạn",
            );
        return ok(res, formatResult(result));
    } catch (err) {
        return fail(res, 500, err.message);
    }
}

// ─── POST /api/nurse/medical-records ────────────────────────────────────────
// Tạo hồ sơ nháp (DRAFT) cho 1 appointment thuộc ca của y tá này.
export async function createDraft(req, res) {
    try {
        const {
            appointment_id,
            chan_doan,
            huong_dan_dieu_tri,
            ghi_chu,
            trieu_chung_ban_dau,
            ghi_chu_dieu_duong,
            ngay_tai_kham,
            sinh_hieu,
        } = req.body;
        if (!appointment_id) return fail(res, 400, "Thiếu appointment_id");

        const a = await findNurseAppointment(appointment_id, req.user.id);
        if (!a)
            return fail(
                res,
                404,
                "Không tìm thấy lịch hẹn hoặc không thuộc ca của bạn",
            );
        if (["cancelled", "no_show"].includes(a.status)) {
            return fail(
                res,
                409,
                "Không thể nhập hồ sơ cho lịch hẹn đã hủy hoặc không đến",
            );
        }

        const exists = await KetQuaKham.exists({ appointment_id: a._id });
        if (exists)
            return fail(res, 409, "Hồ sơ khám đã tồn tại cho lịch hẹn này");

        if (!chan_doan?.trim()) return fail(res, 400, "Chẩn đoán là bắt buộc");
        if (ngay_tai_kham && !isNgayTaiKhamHopLe(ngay_tai_kham, a.ngay_kham)) {
            return fail(
                res,
                400,
                "Ngày tái khám phải từ ngày tiếp theo sau ngày khám",
            );
        }

        const result = await KetQuaKham.create({
            appointment_id: a._id,
            nguoi_nhap_id: req.user.id,
            bac_si_phu_trach_id: a.doctor_id,
            status: "ban_nhap",
            chan_doan: chan_doan.trim(),
            huong_dan_dieu_tri: huong_dan_dieu_tri?.trim() || null,
            ghi_chu: ghi_chu?.trim() || null,
            trieu_chung_ban_dau: trieu_chung_ban_dau?.trim() || null,
            ghi_chu_dieu_duong: ghi_chu_dieu_duong?.trim() || null,
            ngay_tai_kham: ngay_tai_kham ? new Date(ngay_tai_kham) : null,
        });

        await upsertVitals(a._id, a.member_id, req.user.id, sinh_hieu);

        return created(res, formatResult(result), "Đã lưu nháp hồ sơ khám");
    } catch (err) {
        return fail(res, 500, err.message);
    }
}

// ─── PATCH /api/nurse/medical-records/:id ───────────────────────────────────
// Chỉ sửa được khi đang DRAFT hoặc NEED_REVISION (đúng bảng mục XIII: WAITING_DOCTOR_CONFIRM/
// CONFIRMED là chỉ xem).
export async function update(req, res) {
    try {
        const result = await KetQuaKham.findOne({
            _id: req.params.id,
            nguoi_nhap_id: req.user.id,
        });
        if (!result)
            return fail(
                res,
                404,
                "Không tìm thấy hồ sơ khám hoặc không thuộc bạn",
            );
        if (!["ban_nhap", "yeu_cau_chinh_sua"].includes(result.status)) {
            return fail(
                res,
                409,
                "Chỉ sửa được hồ sơ đang nháp hoặc đang cần chỉnh sửa",
            );
        }

        const {
            chan_doan,
            huong_dan_dieu_tri,
            ghi_chu,
            trieu_chung_ban_dau,
            ghi_chu_dieu_duong,
            ngay_tai_kham,
            sinh_hieu,
        } = req.body;
        if (chan_doan) result.chan_doan = chan_doan.trim();
        if (huong_dan_dieu_tri !== undefined)
            result.huong_dan_dieu_tri = huong_dan_dieu_tri?.trim() || null;
        if (ghi_chu !== undefined) result.ghi_chu = ghi_chu?.trim() || null;
        if (trieu_chung_ban_dau !== undefined)
            result.trieu_chung_ban_dau = trieu_chung_ban_dau?.trim() || null;
        if (ghi_chu_dieu_duong !== undefined)
            result.ghi_chu_dieu_duong = ghi_chu_dieu_duong?.trim() || null;
        if (ngay_tai_kham !== undefined) {
            const a = await LichHen.findById(result.appointment_id)
                .select("ngay_kham member_id")
                .lean();
            if (
                ngay_tai_kham &&
                !isNgayTaiKhamHopLe(ngay_tai_kham, a.ngay_kham)
            ) {
                return fail(
                    res,
                    400,
                    "Ngày tái khám phải từ ngày tiếp theo sau ngày khám",
                );
            }
            result.ngay_tai_kham = ngay_tai_kham
                ? new Date(ngay_tai_kham)
                : null;
        }
        await result.save();

        if (sinh_hieu) {
            const a = await LichHen.findById(result.appointment_id)
                .select("member_id")
                .lean();
            await upsertVitals(
                result.appointment_id,
                a?.member_id,
                req.user.id,
                sinh_hieu,
            );
        }

        return ok(res, formatResult(result), "Đã cập nhật hồ sơ khám");
    } catch (err) {
        return fail(res, 500, err.message);
    }
}

// Chuyển DRAFT/NEED_REVISION -> WAITING_DOCTOR_CONFIRM. Đồng thời cập nhật LichHen.status =
// 'waiting_doctor_confirm' để bác sĩ biết có hồ sơ chờ xử lý (không đụng payment_status,
// không tự set 'completed' — việc đó do bác sĩ xác nhận qua endpoint đã có sẵn).
async function submitForDoctorConfirm(req, res, allowedFromStatuses) {
    try {
        const result = await KetQuaKham.findOne({
            _id: req.params.id,
            nguoi_nhap_id: req.user.id,
        });
        if (!result)
            return fail(
                res,
                404,
                "Không tìm thấy hồ sơ khám hoặc không thuộc bạn",
            );
        if (!allowedFromStatuses.includes(result.status)) {
            return fail(
                res,
                409,
                `Chỉ gửi được hồ sơ đang ở trạng thái: ${allowedFromStatuses.join(", ")}`,
            );
        }

        result.status = "cho_xac_nhan";
        result.submitted_at = new Date();
        await result.save();

        const a = await LichHen.findOne({
            _id: result.appointment_id,
            nurse_id: req.user.id,
        });
        if (a && !["completed", "cancelled", "no_show"].includes(a.status)) {
            const oldStatus = a.status;
            a.status = "waiting_doctor_confirm";
            await a.save();
            emitDashboardAppointmentChanged(oldStatus, a.status);
        }

        return ok(
            res,
            {
                id: result._id,
                status: result.status,
                appointment_status: a?.status ?? null,
            },
            "Đã gửi hồ sơ cho bác sĩ xác nhận",
        );
    } catch (err) {
        return fail(res, 500, err.message);
    }
}

// ─── PATCH /api/nurse/medical-records/:id/submit ────────────────────────────
export async function submit(req, res) {
    return submitForDoctorConfirm(req, res, ["ban_nhap"]);
}

// ─── PATCH /api/nurse/medical-records/:id/resubmit ──────────────────────────
// Gửi lại sau khi đã sửa theo yêu cầu bác sĩ.
export async function resubmit(req, res) {
    return submitForDoctorConfirm(req, res, ["yeu_cau_chinh_sua"]);
}
