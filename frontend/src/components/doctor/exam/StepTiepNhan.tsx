import { useMemo, useState } from 'react'
import type { PhienKham } from '@/services/doctor-exam-session.service'

interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
}

function bmiCua(canNang: string, chieuCao: string) {
  const kg = Number(canNang)
  const cm = Number(chieuCao)
  if (!kg || !cm) return null
  return Math.round((kg / (cm / 100) ** 2) * 10) / 10
}

export default function StepTiepNhan({ phien, saving, onNext }: Props) {
  const lyDoKhamDaDat = phien.queue.ly_do_kham?.trim() ?? ''
  const [trieuChung, setTrieuChung] = useState(phien.ho_so?.trieu_chung_ban_dau ?? lyDoKhamDaDat)
  const [canNang, setCanNang] = useState(String(phien.sinh_hieu?.can_nang ?? ''))
  const [chieuCao, setChieuCao] = useState(String(phien.sinh_hieu?.chieu_cao ?? ''))
  const [huyetAp, setHuyetAp] = useState(phien.sinh_hieu?.huyet_ap ?? '')
  const [nhietDo, setNhietDo] = useState(String(phien.sinh_hieu?.nhiet_do ?? ''))
  const [nhipTim, setNhipTim] = useState(String(phien.sinh_hieu?.nhip_tim ?? ''))

  const bmi = useMemo(() => bmiCua(canNang, chieuCao), [canNang, chieuCao])
  const thieuTheTrang = !canNang || !chieuCao

  const sinhHieuCu = phien.ho_so_cu?.sinh_hieu ?? null
  const coSinhHieuCu = sinhHieuCu && (
    sinhHieuCu.can_nang != null || sinhHieuCu.chieu_cao != null || sinhHieuCu.huyet_ap || sinhHieuCu.nhiet_do != null || sinhHieuCu.nhip_tim != null
  )

  function saoChepSinhHieuCu() {
    if (!sinhHieuCu) return
    if (sinhHieuCu.can_nang != null) setCanNang(String(sinhHieuCu.can_nang))
    if (sinhHieuCu.chieu_cao != null) setChieuCao(String(sinhHieuCu.chieu_cao))
    if (sinhHieuCu.huyet_ap) setHuyetAp(sinhHieuCu.huyet_ap)
    if (sinhHieuCu.nhiet_do != null) setNhietDo(String(sinhHieuCu.nhiet_do))
    if (sinhHieuCu.nhip_tim != null) setNhipTim(String(sinhHieuCu.nhip_tim))
  }

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Chỉ số thể trạng</h2>
          {coSinhHieuCu && (
            <button
              type="button"
              onClick={saoChepSinhHieuCu}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
            >
              📋 Sao chép sinh hiệu đợt trước
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { label: 'Cân nặng (kg)', value: canNang, set: setCanNang, type: 'number' },
            { label: 'Chiều cao (cm)', value: chieuCao, set: setChieuCao, type: 'number' },
            { label: 'Huyết áp', value: huyetAp, set: setHuyetAp, type: 'text' },
            { label: 'Nhiệt độ (°C)', value: nhietDo, set: setNhietDo, type: 'number' },
            { label: 'Nhịp tim', value: nhipTim, set: setNhipTim, type: 'number' },
          ].map((f) => (
            <label key={f.label} className="text-sm">
              <span className="mb-1 block font-medium text-slate-600">{f.label}</span>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
          ))}
        </div>
        {bmi !== null && (
          <p className="mt-2 text-sm text-slate-600">
            BMI: <span className="font-semibold text-slate-900">{bmi}</span>
          </p>
        )}
        {thieuTheTrang && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Chưa ghi cân nặng / chiều cao — hồ sơ sẽ thiếu chỉ số thể trạng. Vẫn tiếp tục được.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Triệu chứng ghi nhận ban đầu <span className="text-red-500">*</span>
        </h2>
        {lyDoKhamDaDat && !phien.ho_so?.trieu_chung_ban_dau && (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Đã tự điền từ lý do khám khi đặt lịch online. Bác sĩ hỏi lại và bổ sung thêm nếu cần trước khi lưu.
          </div>
        )}
        <textarea
          value={trieuChung}
          onChange={(e) => setTrieuChung(e.target.value)}
          rows={4}
          placeholder="Bệnh nhân cảm thấy thế nào, đau ở đâu, bao lâu rồi?"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving || !trieuChung.trim()}
          onClick={() =>
            onNext({
              trieu_chung_ban_dau: trieuChung,
              can_nang: canNang ? Number(canNang) : null,
              chieu_cao: chieuCao ? Number(chieuCao) : null,
              huyet_ap: huyetAp || null,
              nhiet_do: nhietDo ? Number(nhietDo) : null,
              nhip_tim: nhipTim ? Number(nhipTim) : null,
            })
          }
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Đang lưu...' : 'Tiếp tục → Chẩn đoán'}
        </button>
      </div>
    </div>
  )
}
