// ============================================================
// CAU HINH SLOT THEO CHUYEN KHOA — nguon duy nhat
// Rule: .claude/rules/lich-lam-viec-bac-si.md muc 1, 2, 10.A, 10.D
// ============================================================
// Ba tang thoi gian: CA -> KHUNG GIO (30') -> SLOT (1 slot = 1 benh nhan).
// So slot trong mot khung phu thuoc thoi gian kham trung binh cua CHUYEN KHOA.
//
// ⚠️ Cac field nay tung duoc them 2026-07-23 roi MAT khi merge `main` (commit ca685dc),
// trong khi scheduleGenerator van .select() chung -> Mongoose tra undefined -> he thong
// am tham chay fallback 1 slot/khung + 100% online, tuc nghiep vu 70/30 KHONG chay.
// Tach ra file rieng de model, controller va generator dung CHUNG mot phep tinh —
// khong noi nao duoc tu suy dien lai.

// Do dai mot khung gio, tinh bang phut. Bat bien theo rule muc 1.
export const DO_DAI_KHUNG_PHUT = 30

// Mac dinh moi cua phong kham nho: lich online chi mo 1 benh nhan moi khung 30'.
// Thoi gian thuc te co the nhanh hon de le tan chen khach truc tiep qua hang doi.
export const MAC_DINH_THOI_GIAN_KHAM_PHUT = 30
export const MAC_DINH_TY_LE_ONLINE = 100

// Fallback khi bac si CHUA GAN CHUYEN KHOA nao: khong biet thoi gian kham thi khong duoc
// doan cao. Giu dung hanh vi cu (1 slot/khung, tat ca online) — sinh nhieu slot cho mot
// bac si cau hinh thieu se tao suc chua ao ma phong kham khong phuc vu noi.
export const FALLBACK_KHONG_CHUYEN_KHOA = {
  so_slot_moi_khung: 1,
  ty_le_online_phan_tram: 100,
}

// So slot toi da an toan trong 1 khung = floor(30 / thoi gian kham).
// LUON lam tron XUONG (rule muc 2) — lam tron len se hua hen nhieu cho hon nang luc that.
export function tinhSoSlotToiDa(thoiGianKhamPhut) {
  const phut = Number(thoiGianKhamPhut)
  const hopLe = Number.isFinite(phut) && phut > 0 ? phut : MAC_DINH_THOI_GIAN_KHAM_PHUT
  return Math.max(1, Math.floor(DO_DAI_KHUNG_PHUT / hopLe))
}

// Chot so slot/khung thuc dung: admin co the override, nhung CHI XUONG thap hon muc an toan.
// config = document/lean object cua ChuyenKhoa, hoac null.
export function chotSoSlotMoiKhung(config) {
  if (!config) return FALLBACK_KHONG_CHUYEN_KHOA.so_slot_moi_khung
  return 1
}

export function chotTyLeOnline(config) {
  if (!config) return FALLBACK_KHONG_CHUYEN_KHOA.ty_le_online_phan_tram
  return 100
}

// Kiem tra cau hinh admin nhap vao. Tra ve chuoi loi, hoac null neu hop le.
//
// ⚠️ Phai goi TAY o moi controller dung findByIdAndUpdate: query middleware KHONG chay
// pre('validate') cua document, nen hook trong model mot minh khong du de chan.
export function kiemTraCauHinhSlot({
  thoi_gian_kham_trung_binh_phut,
  so_slot_moi_khung,
  ty_le_online_phan_tram,
  gia_kham,
} = {}) {
  if (thoi_gian_kham_trung_binh_phut !== undefined && thoi_gian_kham_trung_binh_phut !== null) {
    const phut = Number(thoi_gian_kham_trung_binh_phut)
    if (!Number.isFinite(phut) || phut < 5 || phut > DO_DAI_KHUNG_PHUT) {
      return `Thoi gian kham trung binh phai tu 5 den ${DO_DAI_KHUNG_PHUT} phut`
    }
  }

  if (ty_le_online_phan_tram !== undefined && ty_le_online_phan_tram !== null) {
    const tyLe = Number(ty_le_online_phan_tram)
    if (!Number.isFinite(tyLe) || tyLe < 0 || tyLe > 100) {
      return 'Ty le slot online phai tu 0 den 100'
    }
  }

  if (gia_kham !== undefined && gia_kham !== null) {
    const gia = Number(gia_kham)
    if (!Number.isFinite(gia) || gia < 0) {
      return 'Gia kham khong duoc am'
    }
  }

  if (so_slot_moi_khung !== undefined && so_slot_moi_khung !== null) {
    const soSlot = Number(so_slot_moi_khung)
    if (!Number.isInteger(soSlot) || soSlot < 1) {
      return 'So slot moi khung phai la so nguyen tu 1 tro len'
    }
    if (soSlot > 1) {
      return `Phong kham chi nhan 1 lich online moi khung ${DO_DAI_KHUNG_PHUT} phut`
    }
  }

  return null
}
