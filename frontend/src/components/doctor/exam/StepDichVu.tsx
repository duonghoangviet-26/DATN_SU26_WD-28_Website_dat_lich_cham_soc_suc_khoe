import { useMemo, useState } from 'react'
import type { PhienKham } from '@/services/doctor-exam-session.service'
import { formatPrice } from '@/utils/format'

interface Props {
  phien: PhienKham
  saving: boolean
  onNext: (payload: Record<string, unknown>) => void
}

// Bác sĩ KHÔNG chạm tiền (quyết định Q2) — payload chỉ gửi service_id + so_luong,
// đơn giá/thành tiền hiển thị ở đây chỉ là ước tính để bác sĩ tham khảo, backend
// (taoChiDinhDichVu) tự tính lại từ DichVu.gia, KHÔNG tin số client gửi lên.
export default function StepDichVu({ phien, saving, onNext }: Props) {
  const [soLuong, setSoLuong] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const d of phien.ho_so?.dich_vu_phat_sinh ?? []) {
      map[d.service_id] = d.so_luong
    }
    return map
  })

  const dsKhaDung = phien.dich_vu_kha_dung

  function toggle(serviceId: string) {
    setSoLuong((prev) => {
      const next = { ...prev }
      if (serviceId in next) {
        delete next[serviceId]
      } else {
        next[serviceId] = 1
      }
      return next
    })
  }

  function setSoLuongDong(serviceId: string, value: string) {
    const n = Math.max(1, Number(value) || 1)
    setSoLuong((prev) => ({ ...prev, [serviceId]: n }))
  }

  const tongTien = useMemo(
    () =>
      dsKhaDung.reduce((sum, dv) => {
        const sl = soLuong[dv.service_id]
        return sl ? sum + sl * dv.gia : sum
      }, 0),
    [dsKhaDung, soLuong],
  )

  function buildPayload() {
    return {
      dich_vu_phat_sinh: Object.entries(soLuong).map(([service_id, so_luong]) => ({
        service_id,
        so_luong,
      })),
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">Chỉ định dịch vụ</h2>
        {dsKhaDung.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Chuyên khoa hiện chưa cấu hình dịch vụ liên quan. Có thể bỏ qua bước này.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left">
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 text-xs font-semibold text-slate-600">Dịch vụ</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-600">Đơn giá</th>
                  <th className="w-24 px-3 py-2 text-xs font-semibold text-slate-600">Số lượng</th>
                  <th className="px-3 py-2 text-xs font-semibold text-slate-600">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dsKhaDung.map((dv) => {
                  const daChon = dv.service_id in soLuong
                  const sl = soLuong[dv.service_id] ?? 1
                  return (
                    <tr key={dv.service_id} className={daChon ? 'bg-brand-50/40' : undefined}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={daChon}
                          onChange={() => toggle(dv.service_id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800">{dv.ten}</p>
                        {dv.ma_dich_vu && <p className="text-xs text-slate-400">{dv.ma_dich_vu}</p>}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatPrice(dv.gia)}</td>
                      <td className="px-3 py-2">
                        {daChon && (
                          <input
                            type="number"
                            min={1}
                            value={sl}
                            onChange={(e) => setSoLuongDong(dv.service_id, e.target.value)}
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1"
                          />
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-800">
                        {daChon ? formatPrice(sl * dv.gia) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-500">
          Bác sĩ không thu tiền. Lễ tân thu ở quầy khi bệnh nhân ra về.
        </p>
        <p className="text-sm font-semibold text-slate-900">Tổng (ước tính): {formatPrice(tongTien)}</p>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={() => onNext({ dich_vu_phat_sinh: [] })}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-40"
        >
          Bỏ qua bước này
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onNext(buildPayload())}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? 'Đang lưu...' : 'Đã thực hiện xong → Kê đơn'}
        </button>
      </div>
    </div>
  )
}
