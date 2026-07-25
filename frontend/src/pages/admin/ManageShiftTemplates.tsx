import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  scheduleTemplateService,
  type ScheduleTemplate,
  type ScheduleTemplateGrid,
} from '@/services/schedule-template.service'
import Icon from '@/components/admin/icons'

// Lịch trực tuần — nguồn để hệ thống sinh lịch làm việc.
// Nghiệp vụ bất biến (.claude/rules/lich-lam-viec-bac-si.md mục 3):
//   Bác sĩ đăng ký theo CA, không theo ngày.
//   1 phòng = 1 bác sĩ / ca.  1 bác sĩ = 1 phòng / ca.
// Ca không có ai trực thì ngày đó không mở đặt lịch online.

const CA: { key: 'sang' | 'chieu'; ten: string; gio: string }[] = [
  { key: 'sang', ten: 'Ca sáng', gio: '08:00 – 11:30' },
  { key: 'chieu', ten: 'Ca chiều', gio: '13:30 – 17:30' },
]

interface FormState {
  bac_si_id: string
  phong_id: string
  cac_thu: number[]
  ca: 'sang' | 'chieu'
}

const FORM_RONG: FormState = { bac_si_id: '', phong_id: '', cac_thu: [], ca: 'sang' }

export default function ManageShiftTemplates() {
  const [data, setData] = useState<ScheduleTemplateGrid | null>(null)
  const [dangTai, setDangTai] = useState(true)
  const [loi, setLoi] = useState<string | null>(null)
  const [thongBao, setThongBao] = useState<string | null>(null)
  const [moForm, setMoForm] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_RONG)
  const [dangLuu, setDangLuu] = useState(false)

  const tai = useCallback(async () => {
    try {
      setDangTai(true)
      setLoi(null)
      setData(await scheduleTemplateService.getGrid())
    } catch (err: unknown) {
      setLoi(layThongDiep(err, 'Không tải được lịch trực'))
    } finally {
      setDangTai(false)
    }
  }, [])

  useEffect(() => { void tai() }, [tai])

  const tongCa = useMemo(
    () => data?.luoi.reduce((tong, r) => tong + r.sang.length + r.chieu.length, 0) ?? 0,
    [data],
  )

  async function xepCa(e: React.FormEvent) {
    e.preventDefault()
    if (!form.bac_si_id) return setLoi('Chọn bác sĩ')
    if (!form.phong_id) return setLoi('Chọn phòng')
    if (form.cac_thu.length === 0) return setLoi('Chọn ít nhất một ngày trong tuần')

    try {
      setDangLuu(true)
      setLoi(null)
      const daTao = await scheduleTemplateService.createMany({
        bac_si_id: form.bac_si_id,
        phong_id: form.phong_id,
        cac_ca: form.cac_thu.map((thu) => ({ thu_trong_tuan: thu, ca: form.ca })),
      })
      setThongBao(`Đã xếp ${daTao.length} ca.`)
      setMoForm(false)
      setForm(FORM_RONG)
      await tai()
    } catch (err: unknown) {
      setLoi(layThongDiep(err, 'Không xếp được ca'))
    } finally {
      setDangLuu(false)
    }
  }

  async function boCa(mau: ScheduleTemplate) {
    try {
      setLoi(null)
      await scheduleTemplateService.remove(mau.id)
      setThongBao(`Đã bỏ ${mau.thu_ten} ${mau.ca_ten?.toLowerCase()} của ${mau.bac_si_ten ?? 'bác sĩ'}. Lịch đã sinh trước đó không bị xóa.`)
      await tai()
    } catch (err: unknown) {
      setLoi(layThongDiep(err, 'Không bỏ được ca'))
    }
  }

  if (dangTai) {
    return <div className="card p-8 text-center text-slate-500">Đang tải lịch trực...</div>
  }

  return (
    <div className="space-y-5">
      <div className="card px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800">Lịch trực tuần</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Bác sĩ được xếp theo ca, không theo ngày. Hệ thống chỉ sinh lịch làm việc cho những
              ca có người trực — ca trống thì bệnh nhân không thấy gì để đặt.
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Mỗi ca một phòng chỉ nhận một bác sĩ, và một bác sĩ chỉ trực một phòng.
            </p>
          </div>
          <button onClick={() => { setMoForm((v) => !v); setLoi(null) }} className="btn-primary shrink-0">
            {moForm ? 'Đóng' : 'Xếp ca'}
          </button>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <Chiso nhan="Ca đang trực" giaTri={String(tongCa)} />
          <Chiso nhan="Bác sĩ có lịch" giaTri={String((data?.bac_si.length ?? 0) - (data?.chua_xep_ca.length ?? 0))} />
          <Chiso
            nhan="Chưa xếp ca"
            giaTri={String(data?.chua_xep_ca.length ?? 0)}
            canhBao={(data?.chua_xep_ca.length ?? 0) > 0}
          />
        </dl>
      </div>

      {thongBao && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{thongBao}</span>
          <button onClick={() => setThongBao(null)} className="shrink-0 text-emerald-500 hover:text-emerald-700">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      )}

      {loi && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{loi}</div>
      )}

      {(data?.chua_xep_ca.length ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Chưa xếp ca cho {data!.chua_xep_ca.length} bác sĩ</p>
          <p className="mt-1 text-amber-700">
            {data!.chua_xep_ca.map((d) => d.ho_ten ?? 'Bác sĩ chưa rõ tên').join(', ')} — hệ thống
            sẽ không sinh lịch làm việc cho họ.
          </p>
        </div>
      )}

      {moForm && data && (
        <form onSubmit={xepCa} className="card space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Bác sĩ</span>
              <select
                value={form.bac_si_id}
                onChange={(e) => setForm((p) => ({ ...p, bac_si_id: e.target.value }))}
                className="input w-full"
              >
                <option value="">— Chọn bác sĩ —</option>
                {data.bac_si.map((d) => (
                  <option key={d.id} value={d.id}>{d.ho_ten ?? d.id}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Phòng</span>
              <select
                value={form.phong_id}
                onChange={(e) => setForm((p) => ({ ...p, phong_id: e.target.value }))}
                className="input w-full"
              >
                <option value="">— Chọn phòng —</option>
                {data.phong.map((p) => (
                  <option key={p.id} value={p.id}>{p.ten}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">Ca</span>
            <div className="flex flex-wrap gap-2">
              {CA.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, ca: c.key }))}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${
                    form.ca === c.key
                      ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {c.ten} <span className="text-xs opacity-70">{c.gio}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">Những ngày nào trong tuần</span>
            <div className="flex flex-wrap gap-2">
              {data.luoi.map((r) => {
                const daChon = form.cac_thu.includes(r.thu_trong_tuan)
                return (
                  <button
                    key={r.thu_trong_tuan}
                    type="button"
                    onClick={() => setForm((p) => ({
                      ...p,
                      cac_thu: daChon
                        ? p.cac_thu.filter((t) => t !== r.thu_trong_tuan)
                        : [...p.cac_thu, r.thu_trong_tuan],
                    }))}
                    className={`min-w-[5.5rem] rounded-lg border px-3 py-2 text-sm transition ${
                      daChon
                        ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {r.thu_ten}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setMoForm(false)} className="btn-secondary" disabled={dangLuu}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={dangLuu}>
              {dangLuu ? 'Đang xếp...' : `Xếp ${form.cac_thu.length || ''} ca`}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                <th className="w-32 px-5 py-3 font-semibold text-slate-600">Ngày</th>
                {CA.map((c) => (
                  <th key={c.key} className="px-5 py-3 font-semibold text-slate-600">
                    {c.ten}
                    <span className="ml-2 font-normal text-xs text-slate-400">{c.gio}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.luoi.map((r) => (
                <tr key={r.thu_trong_tuan} className="border-b border-slate-100 last:border-0 align-top">
                  <th scope="row" className="px-5 py-4 text-left font-medium text-slate-700">{r.thu_ten}</th>
                  {CA.map((c) => (
                    <td key={c.key} className="px-5 py-4">
                      <OCa danhSach={c.key === 'sang' ? r.sang : r.chieu} onBo={boCa} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function OCa({ danhSach, onBo }: { danhSach: ScheduleTemplate[]; onBo: (m: ScheduleTemplate) => void }) {
  if (danhSach.length === 0) {
    return <span className="text-sm text-slate-300">Không ai trực</span>
  }
  return (
    <ul className="space-y-2">
      {danhSach.map((m) => (
        <li
          key={m.id}
          className="group flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-800">{m.bac_si_ten ?? 'Bác sĩ chưa rõ tên'}</p>
            <p className="truncate text-xs text-slate-500">{m.phong_ten ?? 'Chưa gán phòng'}</p>
          </div>
          <button
            onClick={() => onBo(m)}
            title="Bỏ ca này khỏi lịch trực"
            className="shrink-0 rounded p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500 group-hover:text-slate-400"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  )
}

function Chiso({ nhan, giaTri, canhBao = false }: { nhan: string; giaTri: string; canhBao?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${canhBao ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50/70'}`}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{nhan}</dt>
      <dd className={`mt-1 text-2xl font-bold ${canhBao ? 'text-amber-700' : 'text-slate-800'}`}>{giaTri}</dd>
    </div>
  )
}

function layThongDiep(err: unknown, macDinh: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message || macDinh
}
