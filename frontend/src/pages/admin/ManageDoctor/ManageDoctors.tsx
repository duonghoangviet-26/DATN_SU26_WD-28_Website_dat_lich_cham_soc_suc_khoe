import { useEffect, useState, useMemo } from 'react'
import { doctorService } from '@/services/doctor.service'
import type { DoctorProfileAPI, DoctorDetailAPI, DoctorApproval } from '@/types'
import { DOCTOR_APPROVAL_LABEL } from '@/utils/constants'
import { formatPrice, formatDate } from '@/utils/format'
import PageHeader from '@/components/common/PageHeader'
import Badge from '@/components/common/Badge'
import Icon from '@/components/admin/icons'
import DoctorDetailDrawer from './DoctorDetailDrawer'
import UpdateDoctor from './UpdateDoctor'
import DoctorActionModal, { ActionType } from './DoctorActionModal'

const APPROVAL_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  approved: 'green', pending: 'yellow', rejected: 'red', suspended: 'gray',
}

const STATUS_TABS: { value: DoctorApproval | ''; label: string; color: string }[] = [
  { value: '', label: 'Tất cả', color: 'text-slate-600' },
  { value: 'pending', label: 'Chờ duyệt', color: 'text-yellow-600' },
  { value: 'approved', label: 'Đã duyệt', color: 'text-green-600' },
  { value: 'rejected', label: 'Từ chối', color: 'text-red-600' },
  { value: 'suspended', label: 'Tạm ngưng', color: 'text-slate-500' },
]

// HARDCODED ADMIN ID FOR NOW (Dùng tạm cho tới khi có JWT auth hoàn chỉnh)
const CURRENT_ADMIN_ID = "000000000000000000000099"

export default function ManageDoctors() {
  const [doctors, setDoctors] = useState<DoctorProfileAPI[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<DoctorApproval | ''>('')
  
  // Search & Pagination
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)

  // Drawer & Actions
  const [targetDetailId, setTargetDetailId] = useState<string | null>(null)
  const [targetEdit, setTargetEdit] = useState<DoctorProfileAPI | DoctorDetailAPI | null>(null)
  const [target, setTarget] = useState<DoctorProfileAPI | DoctorDetailAPI | null>(null)
  const [action, setAction] = useState<ActionType>('approve')

  // Debounce search
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 500)
    return () => clearTimeout(timer)
  }, [keyword])

  // Load data
  const loadData = async (ignore = false) => {
    setLoading(true)
    try {
      const { doctors: data, pagination } = await doctorService.getAll({
        trang_thai: activeTab,
        keyword: debouncedKeyword,
        page,
        limit: 10
      })
      if (!ignore) {
        setDoctors(data)
        setTotalPages(pagination.totalPages)
        setTotalRecords(pagination.total)
      }
    } catch (err) {
      console.error('Lỗi tải danh sách bác sĩ:', err)
    } finally {
      if (!ignore) setLoading(false)
    }
  }

  useEffect(() => {
    let ignore = false
    loadData(ignore)
    return () => { ignore = true }
  }, [activeTab, debouncedKeyword, page])

  // Reset page when tab/keyword changes
  useEffect(() => { setPage(1) }, [activeTab, debouncedKeyword])

  function openAction(doc: DoctorProfileAPI | DoctorDetailAPI, act: ActionType) {
    setTarget(doc)
    setAction(act)
  }

  return (
    <div>
      <PageHeader
        title="Duyệt hồ sơ bác sĩ"
        description="Xét duyệt, tạm ngưng và quản lý tài khoản bác sĩ trong hệ thống."
      />

      {/* Tìm kiếm & Lọc */}
      <div className="card mb-4 p-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white shadow-sm rounded-xl">
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm theo tên, email..." 
            className="input w-full pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
      </div>

      {/* Bảng bác sĩ */}
      <div className="card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Bác sĩ</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Chuyên khoa</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Kinh nghiệm</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Phí tư vấn</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Trạng thái</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Ngày nộp</th>
                <th className="px-4 py-3 text-right font-medium whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Đang tải...</td></tr>
              ) : doctors.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">Không có hồ sơ nào.</td></tr>
              ) : doctors.map((doc) => (
                <tr key={doc._id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setTargetDetailId(doc._id)}>
                      <img 
                        src={doc.user_id.anh_dai_dien || 'https://ui-avatars.com/api/?name=' + doc.user_id.ho_ten} 
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 group-hover:border-brand-300 transition-colors"
                        alt="Avatar"
                      />
                      <div>
                        <p className="font-semibold text-slate-800 group-hover:text-brand-600 transition-colors">{doc.user_id.ho_ten}</p>
                        <p className="text-xs text-slate-400">{doc.user_id.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {doc.specialties.map(s => <span key={s._id} className="bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0.5 rounded border border-blue-100">{s.ten}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{doc.so_nam_kinh_nghiem} năm</td>
                  <td className="px-4 py-3 font-medium text-brand-600 whitespace-nowrap">{formatPrice(doc.phi_kham)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge color={APPROVAL_COLOR[doc.trang_thai_duyet]}>
                      {DOCTOR_APPROVAL_LABEL[doc.trang_thai_duyet]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(doc.ngay_tao)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button 
                        onClick={() => setTargetDetailId(doc._id)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                        title="Chi tiết"
                      >
                        <Icon name="eye" className="h-4 w-4" />
                      </button>

                      <button 
                        onClick={() => setTargetEdit(doc)}
                        className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 p-1.5 text-blue-600 transition-colors hover:bg-blue-100"
                        title="Sửa"
                      >
                        <Icon name="edit" className="h-4 w-4" />
                      </button>
                      
                      {doc.trang_thai_duyet === 'pending' && (
                        <>
                          <button
                            onClick={() => openAction(doc, 'approve')}
                            className="inline-flex items-center justify-center rounded-lg border border-green-200 bg-green-50 p-1.5 text-green-600 transition-colors hover:bg-green-100"
                            title="Duyệt"
                          >
                            <Icon name="check" className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openAction(doc, 'reject')}
                            className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100"
                            title="Từ chối"
                          >
                            <Icon name="x" className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      {doc.trang_thai_duyet === 'approved' && (
                        <button
                          onClick={() => openAction(doc, 'suspend')}
                          className="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-orange-50 p-1.5 text-orange-600 transition-colors hover:bg-orange-100"
                          title="Tạm ngưng"
                        >
                          <Icon name="ban" className="h-4 w-4" />
                        </button>
                      )}

                      {doc.trang_thai_duyet === 'suspended' && (
                        <button
                          onClick={() => openAction(doc, 'restore')}
                          className="inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 p-1.5 text-indigo-600 transition-colors hover:bg-indigo-100"
                          title="Khôi phục"
                        >
                          <Icon name="sync" className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        onClick={() => openAction(doc, 'delete')}
                        className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 transition-colors hover:bg-red-100"
                        title="Xóa vĩnh viễn"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phân trang */}
      {!loading && totalRecords > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between px-2 gap-4">
          <p className="text-sm text-slate-500">
            Hiển thị <span className="font-medium text-slate-800">{(page - 1) * 10 + 1}</span> - <span className="font-medium text-slate-800">{Math.min(page * 10, totalRecords)}</span> trong tổng số <span className="font-medium text-slate-800">{totalRecords}</span> kết quả
          </p>
          {totalPages > 1 && (
            <div className="flex gap-1">
              <button 
                disabled={page === 1} 
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-md text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                Trang trước
              </button>
              <button 
                disabled={page === totalPages} 
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 border border-slate-200 rounded-md text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50"
              >
                Trang sau
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dialog xác nhận */}
      {target && (
        <DoctorActionModal 
          target={target} 
          action={action} 
          onClose={() => setTarget(null)} 
          onSuccess={() => {
            setTarget(null)
            loadData()
          }}
        />
      )}

      {/* Drawer Chi tiết bác sĩ */}
      <DoctorDetailDrawer 
        doctorId={targetDetailId} 
        onClose={() => setTargetDetailId(null)} 
        onAction={openAction} 
      />

      {/* Modal Cập nhật bác sĩ */}
      {targetEdit && (
        <UpdateDoctor 
          doctor={targetEdit} 
          onClose={() => setTargetEdit(null)} 
          onSuccess={() => {
            setTargetEdit(null)
            loadData()
          }} 
        />
      )}
    </div>
  )
}
