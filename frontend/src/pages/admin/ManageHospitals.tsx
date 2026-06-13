import { useEffect, useState } from 'react'
import { hospitalService } from '@/services/hospital.service'
import type { HospitalItem, SpecialtyItem } from '@/types'
import { formatDate } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'

type Tab = 'hospital' | 'specialty'

export default function ManageHospitals() {
  const [tab, setTab] = useState<Tab>('hospital')
  const [hospitals, setHospitals] = useState<HospitalItem[]>([])
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([])
  const [loading, setLoading] = useState(true)

  const [confirmHospital, setConfirmHospital] = useState<HospitalItem | null>(null)
  const [confirmSpecialty, setConfirmSpecialty] = useState<SpecialtyItem | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      hospitalService.getHospitals(),
      hospitalService.getSpecialties(),
    ]).then(([h, s]) => {
      setHospitals(h)
      setSpecialties(s)
    }).finally(() => setLoading(false))
  }, [])

  async function handleToggleHospital() {
    if (!confirmHospital) return
    const id = confirmHospital.id
    setConfirmHospital(null)
    const updated = await hospitalService.toggleHospital(id)
    setHospitals((prev) => prev.map((h) => (h.id === updated.id ? updated : h)))
  }

  async function handleToggleSpecialty() {
    if (!confirmSpecialty) return
    const id = confirmSpecialty.id
    setConfirmSpecialty(null)
    const updated = await hospitalService.toggleSpecialty(id)
    setSpecialties((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
  }

  return (
    <div>
      <PageHeader
        title="Bệnh viện & Chuyên khoa"
        description="Quản lý danh sách cơ sở y tế và các chuyên khoa trong hệ thống."
      />

      {/* Tab chuyển đổi */}
      <div className="card mb-4 flex gap-1 p-1.5">
        <button
          onClick={() => setTab('hospital')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'hospital' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="hospital" className="h-4 w-4" /> Bệnh viện ({hospitals.length})
        </button>
        <button
          onClick={() => setTab('specialty')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'specialty' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="service" className="h-4 w-4" /> Chuyên khoa ({specialties.length})
        </button>
      </div>

      {tab === 'hospital' ? (
        /* ---- Bảng Bệnh viện ---- */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Tên cơ sở</th>
                  <th className="px-4 py-3 font-medium">Địa chỉ</th>
                  <th className="px-4 py-3 font-medium">Số điện thoại</th>
                  <th className="px-4 py-3 font-medium">Giờ làm việc</th>
                  <th className="px-4 py-3 font-medium">Ngày tạo</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
                ) : hospitals.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{h.ten}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[200px]">{h.dia_chi}</td>
                    <td className="px-4 py-3 text-slate-600">{h.so_dien_thoai}</td>
                    <td className="px-4 py-3 text-slate-600">{h.gio_lam_viec}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(h.ngay_tao)}</td>
                    <td className="px-4 py-3">
                      <Badge color={h.status === 'active' ? 'green' : 'gray'}>
                        {h.status === 'active' ? 'Hoạt động' : 'Đã ẩn'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmHospital(h)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          h.status === 'active'
                            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                            : 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
                        }`}
                      >
                        {h.status === 'active'
                          ? <><Icon name="eye-off" className="h-3 w-3" /> Ẩn</>
                          : <><Icon name="eye" className="h-3 w-3" /> Hiện</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ---- Bảng Chuyên khoa ---- */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Icon</th>
                  <th className="px-4 py-3 font-medium">Tên chuyên khoa</th>
                  <th className="px-4 py-3 font-medium">Mô tả</th>
                  <th className="px-4 py-3 font-medium">Thứ tự</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 text-right font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
                ) : specialties.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-2xl">{s.icon}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{s.ten}</td>
                    <td className="px-4 py-3 text-slate-600">{s.mo_ta}</td>
                    <td className="px-4 py-3 text-slate-600">{s.thu_tu}</td>
                    <td className="px-4 py-3">
                      <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                        {s.status === 'active' ? 'Đang hiển thị' : 'Đã ẩn'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setConfirmSpecialty(s)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          s.status === 'active'
                            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                            : 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
                        }`}
                      >
                        {s.status === 'active'
                          ? <><Icon name="eye-off" className="h-3 w-3" /> Ẩn</>
                          : <><Icon name="eye" className="h-3 w-3" /> Hiện</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmHospital}
        title={confirmHospital?.status === 'active' ? 'Ẩn cơ sở y tế' : 'Hiện cơ sở y tế'}
        message={`Bạn có chắc muốn ${confirmHospital?.status === 'active' ? 'ẩn' : 'hiện'} "${confirmHospital?.ten}"?`}
        confirmText={confirmHospital?.status === 'active' ? 'Ẩn' : 'Hiện'}
        danger={confirmHospital?.status === 'active'}
        onConfirm={handleToggleHospital}
        onCancel={() => setConfirmHospital(null)}
      />

      <ConfirmDialog
        open={!!confirmSpecialty}
        title={confirmSpecialty?.status === 'active' ? 'Ẩn chuyên khoa' : 'Hiện chuyên khoa'}
        message={`Bạn có chắc muốn ${confirmSpecialty?.status === 'active' ? 'ẩn' : 'hiện'} chuyên khoa "${confirmSpecialty?.ten}"?`}
        confirmText={confirmSpecialty?.status === 'active' ? 'Ẩn' : 'Hiện'}
        danger={confirmSpecialty?.status === 'active'}
        onConfirm={handleToggleSpecialty}
        onCancel={() => setConfirmSpecialty(null)}
      />
    </div>
  )
}
