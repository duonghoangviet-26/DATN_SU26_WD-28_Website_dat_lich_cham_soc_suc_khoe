import mongoose from 'mongoose'
import { KetQuaKham, LichHen, NhatKyThaoTac } from '../../models/index.js'
import { created, fail } from '../../utils/response.js'

const PROFESSIONAL_MEDICAL_FIELDS = [
  'chan_doan',
  'huong_dan_dieu_tri',
  'ghi_chu',
  'ngay_tai_kham',
  'thuoc',
  'don_thuoc',
  'sinh_hieu',
  'dich_vu_phat_sinh',
]

function requireReason(body = {}) {
  const ly_do = String(body.ly_do ?? body.ly_do_chinh_sua ?? '').trim()
  if (!ly_do) throw Object.assign(new Error('Can nhap ly do yeu cau chinh sua benh an'), { statusCode: 400 })
  return ly_do
}

export function detectReceptionistMedicalPatchViolation(body = {}) {
  return Object.keys(body).filter((field) => PROFESSIONAL_MEDICAL_FIELDS.includes(field))
}

export async function denyDirectMedicalRecordPatch(req, res) {
  const fields = detectReceptionistMedicalPatchViolation(req.body)
  const suffix = fields.length ? `: ${fields.join(', ')}` : ''
  return fail(res, 403, `Le tan khong duoc cap nhat truc tiep noi dung chuyen mon${suffix}`)
}

export async function createMedicalRecordRevisionRequest(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 400, 'Ma benh an khong hop le')
    }
    const ly_do = requireReason(req.body)

    const result = await KetQuaKham.findById(req.params.id)
    if (!result) return fail(res, 404, 'Khong tim thay benh an')
    if (result.status === 'ban_nhap') {
      return fail(res, 409, 'Ho so nhap chua gui bac si, khong can tao yeu cau chinh sua')
    }
    if (result.status === 'yeu_cau_chinh_sua') {
      return fail(res, 409, 'Benh an da co yeu cau chinh sua dang cho xu ly')
    }

    const before = {
      status: result.status,
      doctor_revision_note: result.doctor_revision_note ?? null,
    }
    result.status = 'yeu_cau_chinh_sua'
    result.doctor_revision_note = ly_do
    result.lich_su_sua.push({
      nguoi_sua_id: req.user?._id ?? req.user?.id ?? null,
      thoi_diem_sua: new Date(),
      noi_dung: `Le tan yeu cau chinh sua benh an: ${ly_do}`,
    })
    await result.save()

    if (result.appointment_id) {
      await LichHen.findOneAndUpdate(
        { _id: result.appointment_id, status: { $nin: ['cancelled', 'no_show'] } },
        { $set: { status: 'waiting_record' } },
      )
    }

    const audit = await NhatKyThaoTac.create({
      nguoi_thuc_hien_id: req.user?._id ?? req.user?.id ?? null,
      vai_tro: 'receptionist',
      hanh_dong: 'REQUEST_MEDICAL_RECORD_REVISION',
      loai_doi_tuong: 'examination_result',
      doi_tuong_id: result._id,
      ly_do,
      du_lieu_cu: before,
      du_lieu_moi: {
        status: result.status,
        doctor_revision_note: result.doctor_revision_note,
      },
    })

    return created(res, {
      id: result._id,
      status: result.status,
      audit_id: audit._id,
    }, 'Da tao yeu cau chinh sua benh an')
  } catch (error) {
    return fail(res, error.statusCode ?? 500, error.message)
  }
}
