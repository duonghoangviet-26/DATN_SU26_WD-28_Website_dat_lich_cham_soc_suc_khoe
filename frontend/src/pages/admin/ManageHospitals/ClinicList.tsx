import { useState } from 'react'
import type { HospitalItem } from '@/types'
import Icon from '@/components/admin/icons'

interface Props {
  clinics: HospitalItem[]
  loading: boolean
  onAdd: () => void
  onEdit: (clinic: HospitalItem) => void
  onDelete: (clinic: HospitalItem) => void
  onRestore: (clinic: HospitalItem) => void
  onViewSpecialties: (clinic: HospitalItem) => void
  onViewLogs: (clinic: HospitalItem) => void
}

export default function ClinicList({ clinics, loading, onAdd, onEdit, onDelete, onRestore, onViewSpecialties, onViewLogs }: Props) {
  const [page, setPage] = useState(1)
  const itemsPerPage = 6
  const totalPages = Math.ceil(clinics.length / itemsPerPage)
  const startIndex = (page - 1) * itemsPerPage
  const visibleClinics = clinics.slice(startIndex, startIndex + itemsPerPage)

  if (loading) {
    return (
      <div className="card flex items-center justify-center py-20 text-slate-400">
        Đang tải danh sách chi nhánh...
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b p-5">
        <h2 className="text-lg font-semibold text-slate-800">Danh sách Chi nhánh</h2>
        <button onClick={onAdd} className="btn-primary flex items-center gap-2">
          <Icon name="plus" className="h-4 w-4" />
          Thêm chi nhánh
        </button>
      </div>

      {clinics.length === 0 ? (
        <div className="py-20 text-center text-slate-500">
          Chưa có chi nhánh nào. Hãy thêm chi nhánh đầu tiên.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Tên chi nhánh</th>
                <th className="px-5 py-4 font-semibold">Liên hệ</th>
                <th className="px-5 py-4 font-semibold">Địa chỉ</th>
                <th className="px-5 py-4 font-semibold text-center">Trạng thái</th>
                <th className="px-5 py-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleClinics.map((c) => (
                <tr key={c._id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 font-medium text-slate-800">
                    <div className="flex items-center gap-3">
                      {c.logo_url ? (
                        <img src={c.logo_url} alt="logo" className="h-10 w-10 rounded-lg object-cover border" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-500">
                          <Icon name="hospital" className="h-5 w-5" />
                        </div>
                      )}
                      {c.ten}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1 text-xs">
                      {c.so_dien_thoai && <span className="flex items-center gap-1"><Icon name="phone" className="w-3 h-3"/> {c.so_dien_thoai}</span>}
                      {c.email && <span className="flex items-center gap-1"><Icon name="mail" className="w-3 h-3"/> {c.email}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 max-w-xs truncate" title={c.dia_chi ?? ''}>
                    {c.dia_chi || '--'}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        c.trang_thai === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {c.trang_thai === 'active' ? 'Hoạt động' : 'Ngừng HĐ'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => onViewSpecialties(c)}
                      className="inline-flex rounded-lg p-2 text-indigo-600 hover:bg-indigo-50 transition-colors mr-1"
                      title="Quản lý chuyên khoa"
                    >
                      <Icon name="service" className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onEdit(c)}
                      className="inline-flex rounded-lg p-2 text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Sửa"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    {c.trang_thai === 'active' ? (
                      <button
                        onClick={() => onDelete(c)}
                        className="inline-flex rounded-lg p-2 text-red-600 hover:bg-red-50 transition-colors ml-1"
                        title="Ngừng hoạt động"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onRestore(c)}
                        className="inline-flex rounded-lg p-2 text-green-600 hover:bg-green-50 transition-colors ml-1"
                        title="Khôi phục"
                      >
                        <Icon name="refresh-cw" className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onViewLogs(c)}
                      className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-slate-100 transition-colors ml-1"
                      title="Lịch sử chỉnh sửa"
                    >
                      <Icon name="clock" className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t p-4 bg-slate-50/50">
          <span className="text-sm text-slate-500">
            Hiển thị <span className="font-medium text-slate-700">{startIndex + 1}</span> - <span className="font-medium text-slate-700">{Math.min(startIndex + itemsPerPage, clinics.length)}</span> / <span className="font-medium text-slate-700">{clinics.length}</span> chi nhánh
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
            >
              Trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
