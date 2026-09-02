import { fail } from '../../utils/response.js'

// Le tan khong co chuyen mon de danh gia benh an/don thuoc, nen cung khong co
// tham quyen yeu cau bac si chinh sua no (LT-11 da bi go — chot 2026-08-02).
// File nay chi con lam hang rao chan lot cap nhat truc tiep truong chuyen mon.
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

export function detectReceptionistMedicalPatchViolation(body = {}) {
  return Object.keys(body).filter((field) => PROFESSIONAL_MEDICAL_FIELDS.includes(field))
}

export async function denyDirectMedicalRecordPatch(req, res) {
  const fields = detectReceptionistMedicalPatchViolation(req.body)
  const suffix = fields.length ? `: ${fields.join(', ')}` : ''
  return fail(res, 403, `Lễ tân không được cập nhật trực tiếp nội dung chuyên môn${suffix}`)
}
