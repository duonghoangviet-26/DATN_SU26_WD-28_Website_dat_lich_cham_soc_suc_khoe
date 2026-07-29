import mongoose from 'mongoose'

import { LichHen } from '../../models/index.js'
import { ok, fail } from '../../utils/response.js'
import { guiThongBaoDeXuat, nhaChoDaGiu } from '../../services/appointmentReschedule.service.js'

// ============================================================
// DUYỆT PHƯƠNG ÁN DỜI LỊCH — phía Admin
// Routes: /api/admin/reschedule-approvals
// ============================================================
// Rule mục 15: khung đã có khách ĐÃ THANH TOÁN thì bác sĩ chỉ được TẠO YÊU CẦU, admin
// duyệt rồi mới thông báo khách. Tiền của khách không để một người tự định đoạt.

function fmt(appointment) {
  const dx = appointment.de_xuat_doi
  return {
    id: appointment._id,
    ma_lich_hen: appointment.ma_lich_hen,
    ten_khach: appointment.ten_khach,
    so_dien_thoai_khach: appointment.so_dien_thoai_khach,
    ngay_kham: appointment.ngay_kham,
    gio_kham: appointment.gio_kham,
    doctor_id: appointment.doctor_id,
    gia_kham: appointment.gia_kham,
    payment_status: appointment.payment_status,
    de_xuat: {
      trang_thai: dx?.trang_thai ?? null,
      han_phan_hoi: dx?.han_phan_hoi ?? null,
      ghi_chu: dx?.ghi_chu ?? null,
      phuong_an: (dx?.phuong_an ?? []).map((pa, index) => ({
        index,
        loai: pa.loai,
        mo_ta: pa.mo_ta,
        ngay: pa.ngay,
        gio_bat_dau: pa.gio_bat_dau,
        bac_si_ten: pa.bac_si_ten ?? null,
        da_giu_cho: Boolean(pa.da_giu_cho),
        // Lấn slot khách-tới-quầy là ngoại lệ duy nhất của mục 15 — admin phải thấy rõ
        // mình đang duyệt cái gì.
        lan_walk_in: Boolean(pa.lan_walk_in),
      })),
    },
  }
}

// ─── GET /api/admin/reschedule-approvals ────────────────────────────────────
export async function list(req, res) {
  try {
    const danhSach = await LichHen.find({ 'de_xuat_doi.trang_thai': 'cho_admin_duyet' })
      .sort({ ngay_kham: 1, gio_kham: 1 })
      .lean()

    return ok(res, danhSach.map(fmt))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/reschedule-approvals/:id/approve ──────────────────────
// Duyệt xong thì chuyển sang `cho_khach_chon` và báo khách — admin duyệt PHƯƠNG ÁN,
// không chọn thay khách. Khách vẫn giữ nguyên quyền chọn của mình (rule mục 15).
export async function approve(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, 'ID khong hop le')

    const appointment = await LichHen.findById(id)
    if (!appointment) return fail(res, 404, 'Khong tim thay lich hen')
    if (appointment.de_xuat_doi?.trang_thai !== 'cho_admin_duyet') {
      return fail(res, 409, 'De xuat nay khong o trang thai cho duyet')
    }
    if ((appointment.de_xuat_doi.phuong_an?.length ?? 0) === 0) {
      return fail(res, 409, 'De xuat khong co phuong an nao de duyet — phai lien he khach truc tiep')
    }

    appointment.de_xuat_doi.trang_thai = 'cho_khach_chon'
    appointment.de_xuat_doi.nguoi_duyet_id = req.user.id
    appointment.de_xuat_doi.thoi_diem_duyet = new Date()
    if (req.body.ghi_chu) appointment.de_xuat_doi.ghi_chu = String(req.body.ghi_chu).slice(0, 500)
    await appointment.save()

    await guiThongBaoDeXuat(appointment)

    return ok(res, fmt(appointment.toObject()), 'Da duyet phuong an va gui cho khach chon')
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

// ─── PATCH /api/admin/reschedule-approvals/:id/reject ───────────────────────
// Bác bỏ phương án tự sinh (vd admin đã gọi điện thoả thuận riêng với khách).
// Nhả hết chỗ đã giữ để không treo ghế trống, và ghi lại lý do.
export async function reject(req, res) {
  try {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, 'ID khong hop le')
    const { ly_do } = req.body
    if (!ly_do?.trim()) return fail(res, 400, 'Phai ghi ly do khong duyet')

    const appointment = await LichHen.findById(id)
    if (!appointment) return fail(res, 404, 'Khong tim thay lich hen')
    if (appointment.de_xuat_doi?.trang_thai !== 'cho_admin_duyet') {
      return fail(res, 409, 'De xuat nay khong o trang thai cho duyet')
    }

    for (const pa of appointment.de_xuat_doi.phuong_an ?? []) await nhaChoDaGiu(pa)

    appointment.de_xuat_doi.trang_thai = 'da_huy'
    appointment.de_xuat_doi.nguoi_duyet_id = req.user.id
    appointment.de_xuat_doi.thoi_diem_duyet = new Date()
    appointment.de_xuat_doi.ghi_chu = ly_do.trim().slice(0, 500)
    await appointment.save()

    return ok(
      res,
      fmt(appointment.toObject()),
      'Da bo phuong an tu sinh. Lich hen van con hieu luc va khach VAN GIU quyen doi — phai lien he khach de xep tay.',
    )
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
