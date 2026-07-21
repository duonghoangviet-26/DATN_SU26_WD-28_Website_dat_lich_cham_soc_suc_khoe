import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import { nurseService } from '@/services/nurse.service'
import type { NursePendingRecord, NursePendingStage } from '@/types'
import { formatDate } from '@/utils/format'

const TH = 'whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500'

const STAGE_LABEL: Record<NursePendingStage, string> = {
  chua_tao: 'Chưa tạo hồ sơ',
  ban_nhap: 'Đang nháp',
  cho_xac_nhan: 'Đã gửi bác sĩ',
  yeu_cau_chinh_sua: 'Bác sĩ yêu cầu sửa',
}
const STAGE_COLOR: Record<NursePendingStage, 'red' | 'gray' | 'yellow'> = {
  chua_tao: 'red', ban_nhap: 'gray', cho_xac_nhan: 'yellow', yeu_cau_chinh_sua: 'red',
}
// Nhãn nút hành động theo giai đoạn.
const ACTION_LABEL: Record<NursePendingStage, string> = {
  chua_tao: 'Nhập hồ sơ', ban_nhap: 'Tiếp tục nháp', cho_xac_nhan: 'Xem hồ sơ', yeu_cau_chinh_sua: 'Sửa hồ sơ',
}

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function NursePendingRecords() {
  const navigate = useNavigate()
  const todayStr = localToday()

  const [items, setItems] = useState<NursePendingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filterDate, setFilterDate] = useState(todayStr)
  const [filterStage, setFilterStage] = useState<'' | NursePendingStage>('')

  useEffect(() => {
    setLoading(true)
    setError(false)
    nurseService.getPendingRecords({ date: filterDate })
      .then(setItems)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [filterDate])

  const visible = filterStage ? items.filter((i) => i.giai_doan === filterStage) : items

  return (
    <div>
      <PageHeader
        title="Hồ sơ cần nhập"
        description="Lịch đã kết thúc khám trong ca của bạn — cần nhập / theo dõi hồ sơ khám. Ưu tiên hồ sơ chưa nhập."
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Ngày</label>
          <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="input w-auto" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Giai đoạn</label>
          <select
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value as '' | NursePendingStage)}
            className="input w-auto min-w-[180px]"
          >
            <option value="">Tất cả</option>
            <option value="chua_tao">Chưa tạo hồ sơ</option>
            <option value="ban_nhap">Đang nháp</option>
            <option value="cho_xac_nhan">Đã gửi bác sĩ</option>
            <option value="yeu_cau_chinh_sua">Bác sĩ yêu cầu sửa</option>
          </select>
        </div>
        <button onClick={() => { setFilterDate(todayStr); setFilterStage('') }} className="btn-secondary text-sm">Đặt lại</button>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-400">Đang tải...</div>
      ) : error ? (
        <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50">
          <Icon name="alert-circle" className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-600">Không tải được danh sách. Vui lòng thử lại sau.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <Icon name="check" className="h-10 w-10 text-slate-200" />
          <p className="text-base font-medium text-slate-500">Không có hồ sơ nào cần nhập theo bộ lọc.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left">
                <tr>
                  <th className={TH}>Giờ khám</th>
                  <th className={TH}>Bệnh nhân</th>
                  <th className={TH}>Tuổi/Giới tính</th>
                  <th className={TH}>Bác sĩ</th>
                  <th className={TH}>Giai đoạn</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/nurse/appointments/${r.id}`)}
                    className="cursor-pointer transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{r.gio_kham}</div>
                      <div className="text-xs text-slate-400">{formatDate(r.ngay_kham)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{r.benh_nhan}</p>
                      <p className="text-xs text-slate-400">{r.ma_lich_hen ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.tuoi !== undefined || r.gioi_tinh
                        ? [r.tuoi !== undefined ? `${r.tuoi} tuổi` : null, r.gioi_tinh ?? null].filter(Boolean).join(' · ')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.bac_si ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge color={STAGE_COLOR[r.giai_doan]}>{STAGE_LABEL[r.giai_doan]}</Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/nurse/appointments/${r.id}`)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        <Icon name="edit" className="h-3 w-3" /> {ACTION_LABEL[r.giai_doan]}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
