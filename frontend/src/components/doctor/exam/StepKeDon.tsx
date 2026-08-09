import { useState } from 'react'
import type { PhienKham } from '@/services/doctor-exam-session.service'

interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
}

const SO_DONG_TOI_DA = 10 // giới hạn cứng của DonThuoc ở backend

interface DongThuoc {
  ten_thuoc: string
  lieu_luong: string
  tan_suat: string
  so_ngay: string
  gio_uong: string[]
  ghi_chu: string
}

function dongRong(): DongThuoc {
  return { ten_thuoc: '', lieu_luong: '', tan_suat: '', so_ngay: '', gio_uong: [], ghi_chu: '' }
}

export default function StepKeDon({ phien, saving, onNext }: Props) {
  const [dsThuoc, setDsThuoc] = useState<DongThuoc[]>(() =>
    (phien.thuoc ?? []).map((t) => ({
      ten_thuoc: t.ten_thuoc,
      lieu_luong: t.lieu_luong ?? '',
      tan_suat: t.tan_suat ?? '',
      so_ngay: String(t.so_ngay ?? ''),
      gio_uong: t.gio_uong ?? [],
      ghi_chu: t.ghi_chu ?? '',
    })),
  )

  function suaDong(index: number, patch: Partial<DongThuoc>) {
    setDsThuoc((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  function themDong() {
    setDsThuoc((prev) => (prev.length >= SO_DONG_TOI_DA ? prev : [...prev, dongRong()]))
  }

  function xoaDong(index: number) {
    setDsThuoc((prev) => prev.filter((_, i) => i !== index))
  }

  function themGioUong(index: number) {
    suaDong(index, { gio_uong: [...dsThuoc[index].gio_uong, ''] })
  }

  function suaGioUong(index: number, gioIndex: number, value: string) {
    const gioMoi = dsThuoc[index].gio_uong.map((g, i) => (i === gioIndex ? value : g))
    suaDong(index, { gio_uong: gioMoi })
  }

  function xoaGioUong(index: number, gioIndex: number) {
    suaDong(index, { gio_uong: dsThuoc[index].gio_uong.filter((_, i) => i !== gioIndex) })
  }

  const dongThieuTen = dsThuoc.some((d) => !d.ten_thuoc.trim())
  const dongSaiSoNgay = dsThuoc.some((d) => {
    const n = Number(d.so_ngay)
    return !d.so_ngay || Number.isNaN(n) || n < 1 || n > 90
  })
  const coLoi = dongThieuTen || dongSaiSoNgay

  function buildPayload() {
    return {
      thuoc: dsThuoc.map((d) => ({
        ten_thuoc: d.ten_thuoc.trim(),
        lieu_luong: d.lieu_luong.trim() || null,
        tan_suat: d.tan_suat.trim() || null,
        so_ngay: Number(d.so_ngay),
        gio_uong: d.gio_uong.filter((g) => g.trim()),
        ghi_chu: d.ghi_chu.trim() || null,
      })),
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Đơn thuốc</h2>
          <span className="text-xs text-slate-400">{dsThuoc.length}/{SO_DONG_TOI_DA} dòng</span>
        </div>

        <div className="space-y-4">
          {dsThuoc.map((d, index) => (
            <div key={index} className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Thuốc #{index + 1}</span>
                <button
                  type="button"
                  onClick={() => xoaDong(index)}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Xóa dòng
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <label className="text-sm lg:col-span-2">
                  <span className="mb-1 block font-medium text-slate-600">
                    Tên thuốc <span className="text-red-500">*</span>
                  </span>
                  <input
                    value={d.ten_thuoc}
                    onChange={(e) => suaDong(index, { ten_thuoc: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Liều lượng</span>
                  <input
                    value={d.lieu_luong}
                    onChange={(e) => suaDong(index, { lieu_luong: e.target.value })}
                    placeholder="vd: 500mg"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">Tần suất</span>
                  <input
                    value={d.tan_suat}
                    onChange={(e) => suaDong(index, { tan_suat: e.target.value })}
                    placeholder="vd: 2 lần/ngày"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    Số ngày <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={d.so_ngay}
                    onChange={(e) => suaDong(index, { so_ngay: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="text-sm lg:col-span-3">
                  <span className="mb-1 block font-medium text-slate-600">Ghi chú</span>
                  <input
                    value={d.ghi_chu}
                    onChange={(e) => suaDong(index, { ghi_chu: e.target.value })}
                    placeholder="vd: uống sau ăn"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div className="mt-3">
                <span className="mb-1 block text-sm font-medium text-slate-600">Giờ uống</span>
                <div className="flex flex-wrap items-center gap-2">
                  {d.gio_uong.map((gio, gioIndex) => (
                    <div key={gioIndex} className="flex items-center gap-1">
                      <input
                        type="time"
                        value={gio}
                        onChange={(e) => suaGioUong(index, gioIndex, e.target.value)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => xoaGioUong(index, gioIndex)}
                        className="text-xs text-slate-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => themGioUong(index)}
                    className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-500 hover:border-brand-400 hover:text-brand-600"
                  >
                    + Giờ uống
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={dsThuoc.length >= SO_DONG_TOI_DA}
          onClick={themDong}
          className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + Thêm dòng thuốc
        </button>

        {coLoi && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {dongThieuTen && 'Có dòng thiếu tên thuốc. '}
            {dongSaiSoNgay && 'Số ngày dùng phải từ 1 đến 90.'}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => onNext({ thuoc: [] })}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40"
          >
            Không kê đơn
          </button>
          <button
            type="button"
            disabled={saving || coLoi}
            onClick={() => onNext(buildPayload())}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? 'Đang lưu...' : 'Tiếp tục → Xác nhận'}
          </button>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Chẩn đoán</h3>
          <p className="text-sm text-slate-700">{phien.ho_so?.chan_doan || '—'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Dịch vụ đã dùng</h3>
          {phien.ho_so?.dich_vu_phat_sinh?.length ? (
            <ul className="space-y-1 text-sm text-slate-700">
              {phien.ho_so.dich_vu_phat_sinh.map((dv) => (
                <li key={dv.service_id}>
                  {dv.ten} × {dv.so_luong}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Không có</p>
          )}
        </div>
      </aside>
    </div>
  )
}
