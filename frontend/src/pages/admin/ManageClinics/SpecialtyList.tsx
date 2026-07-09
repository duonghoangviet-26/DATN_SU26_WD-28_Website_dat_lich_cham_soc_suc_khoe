import { useState } from 'react'
import type { SpecialtyItem } from '@/types'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import Icon from '@/components/admin/icons'
import { clinicService } from '@/services/clinic.service'
import SpecialtyDoctorsModal from './SpecialtyDoctorsModal'

interface Props {
  specialties: SpecialtyItem[]
  loading: boolean
  onAdd: () => void
  onEdit: (specialty: SpecialtyItem) => void
  onChange: (updated: SpecialtyItem) => void
  onViewLogs: (specialty: SpecialtyItem) => void
}

export default function SpecialtyList({
  specialties,
  loading,
  onAdd,
  onEdit,
  onChange,
  onViewLogs,
}: Props) {
  const [confirmItem, setConfirmItem] = useState<SpecialtyItem | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [viewingDoctorsSpec, setViewingDoctorsSpec] = useState<SpecialtyItem | null>(null)
  const [activeTab, setActiveTab] = useState<'active' | 'hidden'>('active')
  const [page, setPage] = useState(1)

  const itemsPerPage = 6
  const filteredItems = specialties.filter((specialty) => specialty.status === activeTab)
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage))
  const startIndex = (page - 1) * itemsPerPage
  const visibleSpecialties = filteredItems.slice(startIndex, startIndex + itemsPerPage)

  function handleTabChange(tab: 'active' | 'hidden') {
    setActiveTab(tab)
    setPage(1)
  }

  async function handleToggle() {
    if (!confirmItem) return

    const id = confirmItem._id
    setConfirmItem(null)
    setToggling(id)

    try {
      const updated = await clinicService.toggleSpecialtyStatus(id)
      onChange(updated)
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="font-semibold text-slate-800">Danh sách chuyên khoa ({specialties.length})</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            Toàn bộ chuyên khoa dưới đây đều thuộc cơ sở duy nhất của hệ thống.
          </p>
        </div>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Icon name="plus" className="h-4 w-4" />
          Thêm mới
        </button>
      </div>

      <div className="flex items-center gap-6 border-b border-slate-100 bg-slate-50/50 px-5 pt-3">
        <button
          onClick={() => handleTabChange('active')}
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'active'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
          }`}
        >
          Đang hoạt động ({specialties.filter((item) => item.status === 'active').length})
        </button>
        <button
          onClick={() => handleTabChange('hidden')}
          className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
            activeTab === 'hidden'
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
          }`}
        >
          Đã ẩn ({specialties.filter((item) => item.status === 'hidden').length})
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="w-16 px-5 py-3 text-center font-medium">STT</th>
              <th className="px-5 py-3 font-medium">Icon</th>
               <th className="px-5 py-3 font-medium">Tên chuyên khoa</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">Slug</th>
               <th className="hidden px-5 py-3 font-medium md:table-cell">Mô tả</th>
               <th className="hidden px-5 py-3 text-center font-medium md:table-cell">Số bác sĩ</th>
               <th className="px-5 py-3 font-medium">Trạng thái</th>
               <th className="px-5 py-3 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  Đang tải...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                  {activeTab === 'active'
                    ? 'Chưa có chuyên khoa nào đang hoạt động'
                    : 'Chưa có chuyên khoa nào bị ẩn'}
                </td>
              </tr>
            ) : (
              visibleSpecialties.map((specialty, index) => (
                <tr key={specialty._id} className={`hover:bg-slate-50 ${toggling === specialty._id ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 text-center font-medium text-slate-500">
                    {startIndex + index + 1}
                  </td>
                  <td className="px-5 py-3">
                    {specialty.icon_url ? (
                      <img
                        src={specialty.icon_url}
                        alt={specialty.ten}
                        className="h-8 w-8 rounded border border-slate-200 bg-white object-cover"
                      />
                    ) : (
                       <span className="text-xs italic text-slate-400">Không có</span>
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-800">{specialty.ten}</td>
                  <td className="hidden px-5 py-3 md:table-cell">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                      {specialty.slug}
                    </span>
                  </td>
                  <td className="hidden max-w-[200px] px-5 py-3 text-slate-500 md:table-cell">
                    <span className="line-clamp-2">
                       {specialty.mo_ta || <em className="text-slate-400">Chưa có</em>}
                    </span>
                  </td>
                  <td className="hidden px-5 py-3 text-center md:table-cell">
                    <button
                      onClick={() => setViewingDoctorsSpec(specialty)}
                      className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-blue-100 bg-blue-50 px-3 py-1 font-semibold text-blue-600 transition-colors hover:bg-blue-100"
                    >
                      <Icon name="users" className="h-3.5 w-3.5" />
                       {specialty.doctor_count || 0} Bác sĩ
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <Badge color={specialty.status === 'active' ? 'green' : 'gray'}>
                      {specialty.status === 'active' ? 'Hiển thị' : 'Đã ẩn'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(specialty)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-600"
                        title="Chỉnh sửa"
                      >
                        <Icon name="file-text" className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmItem(specialty)}
                        disabled={toggling === specialty._id}
                        className={`inline-flex items-center justify-center rounded-lg border p-2 transition-colors ${
                          specialty.status === 'active'
                            ? 'border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
                            : 'border-green-200 bg-green-50 text-green-600 hover:bg-green-100'
                        }`}
                        title={specialty.status === 'active' ? 'Ẩn chuyên khoa' : 'Khôi phục chuyên khoa'}
                      >
                        {specialty.status === 'active' ? (
                          <Icon name="eye-off" className="h-4 w-4" />
                        ) : (
                          <Icon name="refresh-cw" className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onViewLogs(specialty)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                        title="Lịch sử chỉnh sửa"
                      >
                        <Icon name="clock" className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredItems.length > itemsPerPage && (
        <div className="flex items-center justify-between border-t bg-slate-50/50 p-4">
          <span className="text-sm text-slate-500">
            Hiển thị <span className="font-medium text-slate-700">{startIndex + 1}</span> -{' '}
            <span className="font-medium text-slate-700">
              {Math.min(startIndex + itemsPerPage, filteredItems.length)}
            </span>{' '}
            / <span className="font-medium text-slate-700">{filteredItems.length}</span> chuyên khoa
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
            >
              Trước
            </button>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
            >
              Sau
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmItem}
        title={confirmItem?.status === 'active' ? 'Ẩn chuyên khoa' : 'Khôi phục chuyên khoa'}
        message={`Bạn có chắc muốn ${
          confirmItem?.status === 'active' ? 'ẩn' : 'khôi phục'
        } chuyên khoa "${confirmItem?.ten}"?`}
        confirmText={confirmItem?.status === 'active' ? 'Ẩn' : 'Khôi phục'}
        danger={confirmItem?.status === 'active'}
        onConfirm={handleToggle}
        onCancel={() => setConfirmItem(null)}
      />

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
