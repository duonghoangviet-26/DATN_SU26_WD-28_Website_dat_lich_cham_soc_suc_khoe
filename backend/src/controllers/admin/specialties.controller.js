import { ChuyenKhoa } from '../../models/index.js'
import { getSingletonClinicIdOrThrow } from '../../services/admin/singleton-clinic.service.js'
import { ok, created, fail } from '../../utils/response.js'

function fmt(specialty) {
  return { ...specialty, id: specialty._id }
}

export async function list(req, res) {
  try {
    const { status, search } = req.query
    const filter = { phong_kham_id: await getSingletonClinicIdOrThrow() }
    if (status) filter.status = status
    if (search) filter.ten = { $regex: search, $options: 'i' }

    const specialties = await ChuyenKhoa.find(filter)
      .sort({ thu_tu: 1, ten: 1 })
      .lean()

    return ok(res, specialties.map(fmt))
  } catch (err) {
    if (err.message === 'He thong chua co thong tin phong kham') {
      return ok(res, [])
    }
    return fail(res, 500, err.message)
  }
}

export async function getById(req, res) {
  try {
    const clinicId = await getSingletonClinicIdOrThrow()
    const specialty = await ChuyenKhoa.findOne({ _id: req.params.id, phong_kham_id: clinicId }).lean()
    if (!specialty) return fail(res, 404, 'Khong tim thay chuyen khoa')
    return ok(res, fmt(specialty))
  } catch (err) {
    return fail(res, 500, err.message)
  }
}

export async function create(req, res) {
  try {
    const { ten, mo_ta, icon_url, thu_tu } = req.body
    if (!ten?.trim()) return fail(res, 400, 'Ten chuyen khoa la bat buoc')

    const specialty = await ChuyenKhoa.create({
      phong_kham_id: await getSingletonClinicIdOrThrow(),
      ten: ten.trim(),
      mo_ta: mo_ta?.trim() || null,
      icon_url: icon_url?.trim() || null,
      thu_tu: thu_tu ?? 0,
    })

    return created(res, fmt(specialty.toObject()), 'Tao chuyen khoa thanh cong')
  } catch (err) {
    if (err.code === 11000) return fail(res, 409, 'Ten hoac slug da ton tai')
    return fail(res, 500, err.message)
  }
}

export async function update(req, res) {
  try {
    const clinicId = await getSingletonClinicIdOrThrow()
    const specialty = await ChuyenKhoa.findOne({ _id: req.params.id, phong_kham_id: clinicId })
    if (!specialty) return fail(res, 404, 'Khong tim thay chuyen khoa')

    const { ten, mo_ta, icon_url, thu_tu } = req.body
    if (ten !== undefined) specialty.ten = ten.trim()
    if (mo_ta !== undefined) specialty.mo_ta = mo_ta?.trim() || null
    if (icon_url !== undefined) specialty.icon_url = icon_url?.trim() || null
    if (thu_tu !== undefined) specialty.thu_tu = thu_tu

    await specialty.save()
    return ok(res, fmt(specialty.toObject()), 'Cap nhat chuyen khoa thanh cong')
  } catch (err) {
    if (err.code === 11000) return fail(res, 409, 'Ten da ton tai')
    return fail(res, 500, err.message)
  }
}

export async function toggle(req, res) {
  try {
    const clinicId = await getSingletonClinicIdOrThrow()
    const specialty = await ChuyenKhoa.findOne({ _id: req.params.id, phong_kham_id: clinicId })
    if (!specialty) return fail(res, 404, 'Khong tim thay chuyen khoa')

    specialty.status = specialty.status === 'active' ? 'hidden' : 'active'
    await specialty.save()

    return ok(
      res,
      fmt(specialty.toObject()),
      `Da ${specialty.status === 'hidden' ? 'an' : 'hien'} chuyen khoa`
    )
  } catch (err) {
    return fail(res, 500, err.message)
  }
}
