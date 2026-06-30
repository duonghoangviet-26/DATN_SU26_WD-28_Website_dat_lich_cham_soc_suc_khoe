import type { SpecialtyItem } from '@/types'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import { useState } from 'react'
import { hospitalService } from '@/services/hospital.service'
import CopySpecialtyModal from './CopySpecialtyModal'
import SpecialtyDoctorsModal from './SpecialtyDoctorsModal'

interface Props {
  specialties: SpecialtyItem[]
  loading: boolean
  onAdd: () => void
  onEdit: (s: SpecialtyItem) => void
  onChange: (updated: SpecialtyItem) => void
}

// Bảng danh sách chuyên khoa với các thao tác: Thêm, Sửa, Ẩn/Hiện.
export default function SpecialtyList({ specialties, loading, onAdd, onEdit, onChange }: Props) {
  const [confirmItem, setConfirmItem] = useState<SpecialtyItem | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [copyingSpecialty, setCopyingSpecialty] = useState<SpecialtyItem | null>(null)
  const [viewingDoctorsSpec, setViewingDoctorsSpec] = useState<SpecialtyItem | null>(null)

  async function handleToggle() {
    if (!confirmItem) return
    const id = confirmItem._id
    setConfirmItem(null)
    setToggling(id)
    try {
      const updated = await hospitalService.toggleSpecialtyStatus(id)
      onChange(updated)
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-slate-800">Danh sách chuyên khoa ({specialties.length})</h3>
          <p className="mt-0.5 text-xs text-slate-400">Bệnh nhân tìm kiếm bác sĩ theo chuyên khoa này</p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Icon name="plus" className="h-4 w-4" />
          Thêm mới
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium text-center w-16">STT</th>
              <th className="px-5 py-3 font-medium">Icon</th>
              <th className="px-5 py-3 font-medium">Tên chuyên khoa</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Slug</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Mô tả</th>
              <th className="hidden px-5 py-3 font-medium text-center md:table-cell">Số bác sĩ</th>
              <th className="px-5 py-3 font-medium">Trạng thái</th>
              <th className="px-5 py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">Đang tải...</td>
              </tr>
            ) : specialties.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">Chưa có chuyên khoa nào</td>
              </tr>
            ) : (
              specialties.map((s, index) => (
                <tr key={s._id} className={`hover:bg-slate-50 ${toggling === s._id ? 'opacity-50' : ''}`}>
                  {/* STT */}
                  <td className="px-5 py-3 text-center font-medium text-slate-500">{index + 1}</td>

                  {/* Icon */}
                  <td className="px-5 py-3">
                    {s.icon_url ? (
                      <img src={s.icon_url} alt={s.ten} className="h-8 w-8 rounded object-cover border border-slate-200 bg-white" />
                    ) : (
                      <span className="text-slate-400 text-xs italic">Không có</span>
                    )}
                  </td>

                  {/* Tên */}
                  <td className="px-5 py-3 font-medium text-slate-800">{s.ten}</td>

                  {/* Slug */}
                  <td className="hidden px-5 py-3 md:table-cell">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{s.slug}</span>
                  </td>

                  {/* Mô tả */}
                  <td className="hidden max-w-[200px] px-5 py-3 text-slate-500 md:table-cell">
                    <span className="line-clamp-2">{s.mo_ta || <em className="text-slate-400">Chưa có</em>}</span>
                  </td>

                  {/* Số bác sĩ */}
                  <td className="hidden px-5 py-3 text-center md:table-cell">
                    <button
                      onClick={() => setViewingDoctorsSpec(s)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-600 transition-colors hover:bg-blue-100 border border-blue-100 whitespace-nowrap"
                    >
                      <Icon name="users" className="h-3.5 w-3.5" />
                      {s.doctor_count || 0} Bác sĩ
                    </button>
                  </td>

                  {/* Trạng thái */}
                  <td className="px-5 py-3">
                    <Badge color={s.status === 'active' ? 'green' : 'gray'}>
                      {s.status === 'active' ? 'Hiển thị' : 'Đã ẩn'}
                    </Badge>
                  </td>

                  {/* Thao tác */}
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Nút Sao chép */}
                      <button
                        onClick={() => setCopyingSpecialty(s)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-amber-600 transition-colors hover:border-amber-200 hover:bg-amber-50"
                        title="Sao chép"
                      >
                      <Icon name="copy" className="h-3 w-3" /> Copy
                      </button>

                      {/* Nút Sửa */}
                      <button
                        onClick={() => onEdit(s)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
                        title="Chỉnh sửa"
                      >
                      <Icon name="file-text" className="h-3 w-3" /> Sửa
                      </button>

                      {/* Nút Ẩn/Hiện */}
                      <button
                        onClick={() => setConfirmItem(s)}
                        disabled={toggling === s._id}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          s.status === 'active'
                            ? 'border-slate-200 bg-slate-50 text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                            : 'border-brand-200 bg-brand-50 text-brand-600 hover:bg-brand-100'
                        }`}
                      >
                        {s.status === 'active'
                          ? <><Icon name="eye-off" className="h-3 w-3" /> Ẩn</>
                          : <><Icon name="eye" className="h-3 w-3" /> Hiện</>
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!confirmItem}
        title={confirmItem?.status === 'active' ? 'Ẩn chuyên khoa' : 'Hiện chuyên khoa'}
        message={`Bạn có chắc muốn ${confirmItem?.status === 'active' ? 'ẩn' : 'hiện'} chuyên khoa "${confirmItem?.ten}"?`}
        confirmText={confirmItem?.status === 'active' ? 'Ẩn' : 'Hiện'}
        danger={confirmItem?.status === 'active'}
        onConfirm={handleToggle}
        onCancel={() => setConfirmItem(null)}
      />

      {copyingSpecialty && (
        <CopySpecialtyModal
          specialty={copyingSpecialty}
          currentClinicId={copyingSpecialty.phong_kham_id}
          onClose={() => setCopyingSpecialty(null)}
          onSuccess={() => setCopyingSpecialty(null)}
        />
      )}

      {viewingDoctorsSpec && (
        <SpecialtyDoctorsModal
          specialtyId={viewingDoctorsSpec._id}
          specialtyName={viewingDoctorsSpec.ten}
          onClose={() => setViewingDoctorsSpec(null)}
        />
      )}
    </div>
  )
}
