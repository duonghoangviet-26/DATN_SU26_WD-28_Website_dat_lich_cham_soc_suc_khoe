import CauHinhPhongKham from '../../models/CauHinhPhongKham.js'
import { ok, created, fail } from '../../utils/response.js'

const SINGLETON_KEY = 'CAU_HINH_PHONG_KHAM'

function formatConfig(config) {
  return {
    _id: config._id,
    singleton_key: config.singleton_key,
    thoi_gian_giu_slot_phut: config.thoi_gian_giu_slot_phut,
    so_lan_doi_lich_toi_da: config.so_lan_doi_lich_toi_da,
    thoi_gian_toi_thieu_truoc_kham_de_doi_lich_gio: config.thoi_gian_toi_thieu_truoc_kham_de_doi_lich_gio,
    nguong_huy_lich_trong_thang: config.nguong_huy_lich_trong_thang,
    chinh_sach_hoan_tien: config.chinh_sach_hoan_tien,
    cau_hinh_nhac_lich: config.cau_hinh_nhac_lich,
    cau_hinh_nhac_tai_kham: config.cau_hinh_nhac_tai_kham,
    ngay_tao: config.ngay_tao,
    ngay_cap_nhat: config.ngay_cap_nhat,
  }
}

async function ensureSingletonConfig() {
  let config = await CauHinhPhongKham.findOne({ singleton_key: SINGLETON_KEY })
  if (!config) {
    config = await CauHinhPhongKham.create({ singleton_key: SINGLETON_KEY })
  }
  return config
}

export async function getClinicConfig(req, res) {
  try {
    const config = await ensureSingletonConfig()
    return ok(res, formatConfig(config.toObject()))
  } catch (error) {
    return fail(res, 500, error.message)
  }
}

export async function createClinicConfig(req, res) {
  try {
    const existing = await CauHinhPhongKham.findOne({ singleton_key: SINGLETON_KEY }).lean()
    if (existing) {
      return fail(res, 409, 'Khong duoc tao config thu 2')
    }

    const config = await CauHinhPhongKham.create({
      singleton_key: SINGLETON_KEY,
      ...req.body,
    })

    return created(res, formatConfig(config.toObject()), 'Tao cau hinh phong kham thanh cong')
  } catch (error) {
    return fail(res, 400, error.message)
  }
}

export async function updateClinicConfig(req, res) {
  try {
    const updatePayload = { ...req.body, singleton_key: SINGLETON_KEY }
    const config = await CauHinhPhongKham.findOneAndUpdate(
      { singleton_key: SINGLETON_KEY },
      { $set: updatePayload },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    ).lean()

    return ok(res, formatConfig(config), 'Cap nhat cau hinh phong kham thanh cong')
  } catch (error) {
    return fail(res, 400, error.message)
  }
}
