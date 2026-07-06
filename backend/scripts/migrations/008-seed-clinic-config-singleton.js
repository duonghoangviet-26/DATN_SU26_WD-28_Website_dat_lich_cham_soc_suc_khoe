import { runMigration } from './_migrationRunner.js'

const singletonKey = 'CAU_HINH_PHONG_KHAM'

const defaultClinicConfig = {
  singleton_key: singletonKey,
  thoi_gian_giu_slot_phut: 15,
  so_lan_doi_lich_toi_da: 2,
  thoi_gian_toi_thieu_truoc_kham_de_doi_lich_gio: 2,
  nguong_huy_lich_trong_thang: 5,
  chinh_sach_hoan_tien: [
    {
      thoi_gian_toi_thieu_gio: 24,
      ti_le_hoan: 100,
      phi_huy_co_dinh: 0,
    },
  ],
  chinh_sach_hoan_tien_chua_chot: true,
  cau_hinh_nhac_lich: {
    bat_cho_nhac: true,
    so_gio_truoc_kham: 24,
    kenh_gui_mac_dinh: ['in_app'],
  },
  cau_hinh_nhac_tai_kham: {
    bat_cho_nhac: true,
    so_ngay_nhac_truoc: 3,
  },
}

const result = await runMigration({
  name: '008-seed-clinic-config-singleton',
  rollbackable: true,
  async up({ connection }) {
    const existingCount = await connection.collection('cau_hinh_phong_kham').countDocuments()

    await connection.collection('cau_hinh_phong_kham').updateOne(
      { singleton_key: singletonKey },
      {
        $setOnInsert: {
          ...defaultClinicConfig,
          ngay_tao: new Date(),
          ngay_cap_nhat: new Date(),
        },
      },
      { upsert: true }
    )

    const finalCount = await connection.collection('cau_hinh_phong_kham').countDocuments()
    return finalCount > existingCount ? 1 : 0
  },
})

console.log(JSON.stringify(result))
