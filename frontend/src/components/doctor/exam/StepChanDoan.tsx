import { useState } from 'react'
import type { PhienKham } from '@/services/doctor-exam-session.service'

interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
}

export default function StepChanDoan({ phien, saving, onNext }: Props) {
  const banDau = phien.ho_so?.chan_doan === '(đang khám)' ? '' : phien.ho_so?.chan_doan ?? ''
  const [chanDoan, setChanDoan] = useState(banDau)
  const [huongDan, setHuongDan] = useState(phien.ho_so?.huong_dan_dieu_tri ?? '')
  const [ghiChu, setGhiChu] = useState(phien.ho_so?.ghi_chu ?? '')
  const [ngayTaiKham, setNgayTaiKham] = useState(
    phien.ho_so?.ngay_tai_kham ? String(phien.ho_so.ngay_tai_kham).slice(0, 10) : '',
  )

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

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || !chanDoan.trim()}
          onClick={() =>
            onNext({
              chan_doan: chanDoan,
              huong_dan_dieu_tri: huongDan,
              ghi_chu: ghiChu,
              ngay_tai_kham: ngayTaiKham || null,
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
