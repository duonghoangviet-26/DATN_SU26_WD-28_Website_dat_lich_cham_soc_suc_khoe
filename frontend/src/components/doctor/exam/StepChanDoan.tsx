import { useState } from 'react'
import type { KetCuc, PhienKham } from '@/services/doctor-exam-session.service'

interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
}

// D78/D80 — nhãn hiển thị, khớp enum backend KET_CUC (examStepRules.js).
const NHAN_KET_CUC: Record<KetCuc, string> = {
  dieu_tri_thuong: 'Điều trị thường',
  chuyen_chuyen_khoa: 'Chuyển chuyên khoa',
  chuyen_vien: 'Chuyển viện',
  cap_cuu_ngoai_vien: 'Cấp cứu ngoài viện',
}
const KET_CUC_CAN_THONG_TIN_CHUYEN: KetCuc[] = ['chuyen_vien', 'cap_cuu_ngoai_vien']

export default function StepChanDoan({ phien, saving, onNext }: Props) {
  const banDau = phien.ho_so?.chan_doan === '(đang khám)' ? '' : phien.ho_so?.chan_doan ?? ''
  const [chanDoan, setChanDoan] = useState(banDau)
  const [huongDan, setHuongDan] = useState(phien.ho_so?.huong_dan_dieu_tri ?? '')
  const [ghiChu, setGhiChu] = useState(phien.ho_so?.ghi_chu ?? '')
  const [ngayTaiKham, setNgayTaiKham] = useState(
    phien.ho_so?.ngay_tai_kham ? String(phien.ho_so.ngay_tai_kham).slice(0, 10) : '',
  )
  const [ketCuc, setKetCuc] = useState<KetCuc>(phien.ho_so?.ket_cuc ?? 'dieu_tri_thuong')
  const [noiChuyenDen, setNoiChuyenDen] = useState(phien.ho_so?.chuyen_vien_thong_tin?.noi_chuyen_den ?? '')
  const [lyDoChuyen, setLyDoChuyen] = useState(phien.ho_so?.chuyen_vien_thong_tin?.ly_do ?? '')
  const [tinhTrangChuyen, setTinhTrangChuyen] = useState(
    phien.ho_so?.chuyen_vien_thong_tin?.tinh_trang_luc_chuyen ?? '',
  )
  const [giayToKemTheo, setGiayToKemTheo] = useState(
    phien.ho_so?.chuyen_vien_thong_tin?.giay_to_kem_theo ?? '',
  )

  const canThongTinChuyen = KET_CUC_CAN_THONG_TIN_CHUYEN.includes(ketCuc)
  const thieuThongTinChuyen = canThongTinChuyen && (!noiChuyenDen.trim() || !lyDoChuyen.trim())

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="font-medium text-slate-500">Triệu chứng đã ghi:</span>{' '}
        {phien.ho_so?.trieu_chung_ban_dau ?? '—'}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-900">
          Chẩn đoán <span className="text-red-500">*</span>
        </span>
        <textarea
          value={chanDoan}
          onChange={(e) => setChanDoan(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-900">Giải pháp / hướng dẫn điều trị</span>
        <textarea
          value={huongDan}
          onChange={(e) => setHuongDan(e.target.value)}
          rows={3}
          placeholder="Bệnh nhân cần làm gì, kiêng gì, theo dõi ra sao"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-900">Lưu ý</span>
        <textarea
          value={ghiChu}
          onChange={(e) => setGhiChu(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-900">Ngày tái khám</span>
        <input
          type="date"
          value={ngayTaiKham}
          onChange={(e) => setNgayTaiKham(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-semibold text-slate-900">Kết cục ca khám</span>
        <select
          value={ketCuc}
          onChange={(e) => setKetCuc(e.target.value as KetCuc)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 lg:w-72"
        >
          {(Object.keys(NHAN_KET_CUC) as KetCuc[]).map((k) => (
            <option key={k} value={k}>{NHAN_KET_CUC[k]}</option>
          ))}
        </select>
      </label>

      {canThongTinChuyen && (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            Ghi rõ thông tin chuyển để lễ tân/hồ sơ y tế theo dõi được ca này.
          </p>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Nơi chuyển đến <span className="text-red-500">*</span>
            </span>
            <input
              value={noiChuyenDen}
              onChange={(e) => setNoiChuyenDen(e.target.value)}
              placeholder="vd: Bệnh viện Bạch Mai"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Lý do chuyển <span className="text-red-500">*</span>
            </span>
            <textarea
              value={lyDoChuyen}
              onChange={(e) => setLyDoChuyen(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Tình trạng lúc chuyển</span>
            <textarea
              value={tinhTrangChuyen}
              onChange={(e) => setTinhTrangChuyen(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Giấy tờ kèm theo</span>
            <input
              value={giayToKemTheo}
              onChange={(e) => setGiayToKemTheo(e.target.value)}
              placeholder="vd: kết quả xét nghiệm, phim X-quang"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || !chanDoan.trim() || thieuThongTinChuyen}
          onClick={() =>
            onNext({
              chan_doan: chanDoan,
              huong_dan_dieu_tri: huongDan,
              ghi_chu: ghiChu,
              ngay_tai_kham: ngayTaiKham || null,
              ket_cuc: ketCuc,
              chuyen_vien_thong_tin: canThongTinChuyen
                ? {
                    noi_chuyen_den: noiChuyenDen,
                    ly_do: lyDoChuyen,
                    tinh_trang_luc_chuyen: tinhTrangChuyen || null,
                    giay_to_kem_theo: giayToKemTheo || null,
                  }
                : null,
            })
          }
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Đang lưu...' : 'Tiếp tục → Dịch vụ'}
        </button>
      </div>
    </div>
  )
}
