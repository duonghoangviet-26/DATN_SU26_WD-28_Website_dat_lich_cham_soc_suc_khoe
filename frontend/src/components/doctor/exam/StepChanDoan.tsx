import { useState } from 'react'
import type { PhienKham } from '@/services/doctor-exam-session.service'

interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
}

export default function StepChanDoan({ phien, saving, onNext }: Props) {
  const banDau = phien.ho_so?.chan_doan === '(dang kham)' || phien.ho_so?.chan_doan === '(đang khám)'
    ? ''
    : phien.ho_so?.chan_doan ?? ''
  const [chanDoan, setChanDoan] = useState(banDau)
  const [huongDan, setHuongDan] = useState(phien.ho_so?.huong_dan_dieu_tri ?? '')
  const [ghiChu, setGhiChu] = useState(phien.ho_so?.ghi_chu ?? '')
  const [ngayTaiKham, setNgayTaiKham] = useState(
    phien.ho_so?.ngay_tai_kham ? String(phien.ho_so.ngay_tai_kham).slice(0, 10) : '',
  )
  const [chiDinhTaiKham, setChiDinhTaiKham] = useState(
    phien.ho_so?.chi_dinh_tai_kham ?? false
  )

  const hoSoCu = phien.ho_so_cu ?? null
  const coChanDoanCu = !!(hoSoCu?.chan_doan)

  function saoChepChanDoanCu() {
    if (!hoSoCu) return
    if (hoSoCu.chan_doan) setChanDoan(hoSoCu.chan_doan)
    if (hoSoCu.huong_dan_dieu_tri) setHuongDan(hoSoCu.huong_dan_dieu_tri)
    if (hoSoCu.ghi_chu) setGhiChu(hoSoCu.ghi_chu)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="font-medium text-slate-500">Triệu chứng đã ghi:</span>{' '}
        {phien.ho_so?.trieu_chung_ban_dau ?? '-'}
      </div>

      {/* Khung chẩn đoán cũ dạng tham chiếu — chỉ hiển thị khi là tái khám và có dữ liệu */}
      {coChanDoanCu && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-violet-600">
              📋 Chẩn đoán & hướng dẫn đợt trước (tham khảo)
            </p>
            <button
              type="button"
              onClick={saoChepChanDoanCu}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
            >
              Sao chép sang ô bên dưới
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-violet-500">Chẩn đoán cũ</p>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{hoSoCu!.chan_doan || '—'}</p>
            </div>
            {hoSoCu?.huong_dan_dieu_tri && (
              <div>
                <p className="mb-1 text-xs font-semibold text-violet-500">Hướng dẫn điều trị cũ</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{hoSoCu.huong_dan_dieu_tri}</p>
              </div>
            )}
          </div>
        </div>
      )}

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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={chiDinhTaiKham}
            onChange={(e) => setChiDinhTaiKham(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="font-semibold text-slate-900">Chỉ định tái khám</span>
        </label>
        
        {chiDinhTaiKham && (
          <div className="mt-4 border-l-2 border-brand-500 pl-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Thời hạn tái khám (Không bắt buộc)</span>
              <input
                type="date"
                value={ngayTaiKham}
                onChange={(e) => setNgayTaiKham(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 w-full sm:w-1/3"
              />
              <p className="mt-1 text-xs text-slate-500">
                Nếu không chọn ngày, bệnh nhân sẽ được tái khám miễn phí không thời hạn.
              </p>
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || !chanDoan.trim()}
          onClick={() =>
            onNext({
              chan_doan: chanDoan,
              huong_dan_dieu_tri: huongDan,
              ghi_chu: ghiChu,
              chi_dinh_tai_kham: chiDinhTaiKham,
              ngay_tai_kham: chiDinhTaiKham ? (ngayTaiKham || null) : null,
              ket_cuc: 'dieu_tri_thuong',
              chuyen_vien_thong_tin: null,
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
