import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Badge from '@/components/common/Badge'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'
import { AdminAutoStagger } from '@/components/admin/motion/AdminMotion'
import { USER_STATUS_LABEL } from '@/utils/constants'
import { formatDate, formatDateTime } from '@/utils/format'
import {
  adminPatientService,
  type AdminPatient,
  type AdminPatientAuditLog,
  type AdminPatientExamHistory,
  type AdminPatientUpdatePayload,
} from '@/services/admin-patient.service'

type DetailTab = 'info' | 'history' | 'audit'

const EMPTY_STATS = { total: 0, active: 0, locked: 0, deleted: 0 }

const GENDER_LABEL: Record<string, string> = {
  nam: 'Nam',
  nu: 'Nữ',
  khac: 'Khác',
}

const FIELD_LABEL: Record<string, string> = {
  ho_ten: 'Họ tên',
  so_dien_thoai: 'Số điện thoại',
  anh_dai_dien: 'Ảnh đại diện',
  status: 'Trạng thái',
  'primary_member.ngay_sinh': 'Ngày sinh',
  'primary_member.gioi_tinh': 'Giới tính',
  'primary_member.nhom_mau': 'Nhóm máu',
  'primary_member.di_ung': 'Dị ứng',
  'primary_member.benh_nen': 'Bệnh nền',
}

function toDateInput(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

const OBJECT_LABEL: Record<string, string> = {
  patient: 'Hồ sơ bệnh nhân',
  user: 'Tài khoản người dùng',
  doctor: 'Hồ sơ bác sĩ',
}

function valueText(field: string, value: unknown) {
  if (value === null || value === undefined || value === '') return 'Trống'
  if (field === 'status') {
    if (value === 'active') return 'Hoạt động (Hiển thị)'
    if (value === 'locked') return 'Đã khóa (Ẩn)'
    return USER_STATUS_LABEL[value as keyof typeof USER_STATUS_LABEL] || String(value)
  }
  if (field.endsWith('gioi_tinh')) return GENDER_LABEL[String(value)] || String(value)
  if (field.endsWith('ngay_sinh')) return formatDate(String(value))
  if (field === 'anh_dai_dien') return value ? 'Có ảnh' : 'Không có ảnh'
  return String(value)
}

function changedFields(log: AdminPatientAuditLog) {
  const oldData = log.du_lieu_cu || {}
  const newData = log.du_lieu_moi || {}
  return Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]))
    .filter((field) => JSON.stringify(oldData[field] ?? null) !== JSON.stringify(newData[field] ?? null))
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    UPDATE_PATIENT: 'Admin cập nhật thông tin bệnh nhân',
    CLIENT_UPDATE_PROFILE: 'Bệnh nhân tự cập nhật thông tin cá nhân',
    LOCK_PATIENT: 'Khóa tài khoản bệnh nhân (Ẩn)',
    UNLOCK_PATIENT: 'Mở khóa tài khoản bệnh nhân (Hiển thị)',
    UPDATE_USER: 'Cập nhật tài khoản',
    CREATE_USER: 'Tạo tài khoản',
    LOCK_USER: 'Khóa tài khoản (Ẩn)',
    UNLOCK_USER: 'Mở khóa tài khoản (Hiển thị)',
  }
  return map[action] || action
}

function PatientAvatar({ patient }: { patient: AdminPatient }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-bold text-brand-700">
      {patient.anh_dai_dien ? (
        <img src={patient.anh_dai_dien} alt={patient.ho_ten} className="h-full w-full object-cover" />
      ) : (
        patient.ho_ten.charAt(0).toUpperCase()
      )}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '—'}</p>
    </div>
  )
}

export default function ManagePatients() {
  const [patients, setPatients] = useState<AdminPatient[]>([])
  const [stats, setStats] = useState(EMPTY_STATS)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedPatient, setSelectedPatient] = useState<AdminPatient | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('info')
  const [examHistory, setExamHistory] = useState<AdminPatientExamHistory[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminPatientAuditLog[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [editingPatient, setEditingPatient] = useState<AdminPatient | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ type: 'lock' | 'unlock'; patient: AdminPatient } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const loadPatients = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, nextStats] = await Promise.all([
        adminPatientService.getAll({
          keyword,
          status,
          page,
          limit: 10,
          isDeleted: 'false',
        }),
        adminPatientService.getStatistics(),
      ])
      setPatients(list.data)
      setPagination({ total: list.pagination.total, totalPages: list.pagination.totalPages })
      setStats(nextStats)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải danh sách bệnh nhân')
    } finally {
      setLoading(false)
    }
  }, [keyword, page, status])

  useEffect(() => {
    loadPatients()
  }, [loadPatients])

  async function openPatient(patient: AdminPatient, tab: DetailTab = 'info') {
    setSelectedPatient(patient)
    setActiveTab(tab)
    setDetailLoading(true)
    try {
      const [detail, history, logs] = await Promise.all([
        adminPatientService.getById(patient.id),
        adminPatientService.getExamHistory(patient.id),
        adminPatientService.getAuditLogs(patient.id),
      ])
      setSelectedPatient(detail)
      setExamHistory(history)
      setAuditLogs(logs)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải chi tiết bệnh nhân')
    } finally {
      setDetailLoading(false)
    }
  }

  function startEdit(patient: AdminPatient) {
    setEditingPatient(patient)
    setFormError('')
  }

  async function submitEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingPatient) return

    const primaryMember = editingPatient.primary_member
    const payload: AdminPatientUpdatePayload = {
      ho_ten: editingPatient.ho_ten.trim(),
      so_dien_thoai: editingPatient.so_dien_thoai || null,
      anh_dai_dien: editingPatient.anh_dai_dien || null,
      status: editingPatient.status,
      ngay_sinh: primaryMember?.ngay_sinh ? toDateInput(primaryMember.ngay_sinh) : null,
      gioi_tinh: primaryMember?.gioi_tinh || null,
      nhom_mau: primaryMember?.nhom_mau || null,
      di_ung: primaryMember?.di_ung || null,
      benh_nen: primaryMember?.benh_nen || null,
    }

    if (!payload.ho_ten) {
      setFormError('Họ tên bệnh nhân là bắt buộc')
      return
    }

    if (payload.so_dien_thoai) {
      const phoneTrimmed = payload.so_dien_thoai.trim()
      const phoneRegex = /^(0|\+84)[3|5|7|8|9][0-9]{8}$/
      if (!phoneRegex.test(phoneTrimmed)) {
        setFormError('Số điện thoại không hợp lệ (Phải bao gồm 10 chữ số chuẩn Việt Nam, ví dụ: 0912345678)')
        return
      }
      payload.so_dien_thoai = phoneTrimmed
    }

    if (payload.ngay_sinh) {
      const birth = new Date(payload.ngay_sinh)
      if (Number.isNaN(birth.getTime()) || birth.getTime() >= Date.now()) {
        setFormError('Ngày sinh không hợp lệ (Không được ở tương lai)')
        return
      }
    }

    setSubmitting(true)
    setFormError('')
    try {
      const updated = await adminPatientService.update(editingPatient.id, payload)
      setEditingPatient(null)
      setSelectedPatient(updated)
      await Promise.all([loadPatients(), openPatient(updated, activeTab)])
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Cập nhật bệnh nhân thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmedAction() {
    if (!confirmAction) return

    const { type, patient } = confirmAction
    setSubmitting(true)
    try {
      if (type === 'lock') {
        const locked = await adminPatientService.lock(patient.id)
        if (selectedPatient?.id === patient.id) {
          await openPatient(locked, activeTab)
        }
      } else {
        const unlocked = await adminPatientService.unlock(patient.id)
        if (selectedPatient?.id === patient.id) {
          await openPatient(unlocked, activeTab)
        }
      }
      setConfirmAction(null)
      await loadPatients()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Thao tác với bệnh nhân thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  function updatePrimaryMember(field: string, value: string) {
    setEditingPatient((current) => {
      if (!current) return current
      return {
        ...current,
        primary_member: {
          id: current.primary_member?.id || '',
          ho_ten: current.primary_member?.ho_ten || current.ho_ten,
          la_chu_ho: current.primary_member?.la_chu_ho ?? true,
          ...current.primary_member,
          [field]: value || null,
        },
      }
    })
  }

  const summaryCards = useMemo(() => [
    { label: 'Tổng bệnh nhân', value: stats.total, icon: 'users', color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Đang hoạt động', value: stats.active, icon: 'check', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Đã khóa (Ẩn)', value: stats.locked, icon: 'lock', color: 'text-amber-600', bg: 'bg-amber-50' },
  ], [stats])

  return (
    <AdminAutoStagger className="space-y-6">
      <PageHeader
        title="Quản lý bệnh nhân"
        description="Theo dõi hồ sơ bệnh nhân, lịch sử khám bệnh, đơn thuốc và lịch sử chỉnh sửa."
      />

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {summaryCards.map((item) => (
          <div key={item.label} className="card flex items-center justify-between p-5">
            <div>
              <p className="text-sm font-semibold text-slate-500">{item.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{item.value}</p>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
              <Icon name={item.icon} className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Ô tìm kiếm ở bên TÁI kéo dài & Bộ lọc trạng thái ở bên PHẢI */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Ô tìm kiếm kéo dài ở bên trái */}
          <div className="relative w-full sm:w-[420px] md:w-[480px]">
            <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="input w-full pl-10 pr-4 bg-slate-50 border-slate-200 focus:bg-white focus:border-brand-500 transition-all text-sm rounded-xl py-2.5"
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value)
                setPage(1)
              }}
            />
          </div>

          {/* Bộ lọc trạng thái ở bên phải */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-start sm:justify-end">
            <span className="text-xs font-semibold text-slate-500 shrink-0">Trạng thái:</span>
            <select
              className="select text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors rounded-xl py-2 px-3 text-slate-700 font-medium cursor-pointer w-full sm:w-auto min-w-[170px]"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value)
                setPage(1)
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Hoạt động (Hiển thị)</option>
              <option value="locked">Đã khóa (Đã ẩn)</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <Icon name="alert-circle" className="h-5 w-5" />
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="table-head-row">
              <tr>
                <th className="table-cell">Bệnh nhân</th>
                <th className="table-cell">Liên hệ</th>
                <th className="table-cell">Hồ sơ</th>
                <th className="table-cell">Khám gần nhất</th>
                <th className="table-cell">Trạng thái</th>
                <th className="table-cell text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-slate-500">
                    <span className="spinner mr-2 align-middle" />
                    Đang tải danh sách bệnh nhân...
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-sm text-slate-500">
                    Chưa có bệnh nhân phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                patients.map((patient) => (
                  <tr key={patient.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <PatientAvatar patient={patient} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{patient.ho_ten}</p>
                          <p className="text-xs text-slate-500">
                            {patient.primary_member?.gioi_tinh ? GENDER_LABEL[patient.primary_member.gioi_tinh] : 'Chưa có giới tính'}
                            {patient.primary_member?.ngay_sinh ? ` · ${formatDate(patient.primary_member.ngay_sinh)}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="font-medium text-slate-700">{patient.email}</p>
                      <p className="text-xs text-slate-500">{patient.so_dien_thoai || 'Chưa có số điện thoại'}</p>
                    </td>
                    <td className="table-cell">
                      <p className="font-semibold text-slate-800">{patient.family_member_count} thành viên</p>
                      <p className="text-xs text-slate-500">
                        {patient.appointment_count} lịch hẹn · {patient.medical_record_count} hồ sơ khám
                      </p>
                    </td>
                    <td className="table-cell">{formatDate(patient.last_exam_at)}</td>
                    <td className="table-cell">
                      <Badge color={patient.status === 'active' ? 'green' : 'red'}>
                        {USER_STATUS_LABEL[patient.status]}
                      </Badge>
                    </td>
                    <td className="table-cell">
                      <div className="flex justify-end gap-1">
                        <button className="btn-icon" title="Xem chi tiết" onClick={() => openPatient(patient, 'info')}>
                          <Icon name="eye" className="h-4 w-4" />
                        </button>
                        <button className="btn-icon" title="Lịch sử khám" onClick={() => openPatient(patient, 'history')}>
                          <Icon name="file-text" className="h-4 w-4" />
                        </button>
                        <button className="btn-icon" title="Sửa bệnh nhân" onClick={() => startEdit(patient)}>
                          <Icon name="edit" className="h-4 w-4" />
                        </button>
                        {patient.status === 'locked' ? (
                          <button className="btn-icon text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" title="Mở khóa (Hiển thị)" onClick={() => setConfirmAction({ type: 'unlock', patient })}>
                            <Icon name="refresh-cw" className="h-4 w-4" />
                          </button>
                        ) : (
                          <button className="btn-icon text-amber-600 hover:bg-amber-50 hover:text-amber-700" title="Khóa tài khoản (Ẩn)" onClick={() => setConfirmAction({ type: 'lock', patient })}>
                            <Icon name="lock" className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 py-2 md:flex-row">
        <p className="text-sm text-slate-500">
          Hiển thị <span className="font-semibold text-slate-800">{patients.length}</span> / {pagination.total} bệnh nhân
        </p>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="btn-secondary disabled:opacity-50">
            Trước
          </button>
          <span className="px-2 text-sm font-semibold text-slate-700">Trang {page} / {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="btn-secondary disabled:opacity-50">
            Sau
          </button>
        </div>
      </div>

      {selectedPatient && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setSelectedPatient(null)}>
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <PatientAvatar patient={selectedPatient} />
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-900">{selectedPatient.ho_ten}</h2>
                  <p className="text-sm text-slate-500">{selectedPatient.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn-secondary" onClick={() => startEdit(selectedPatient)}>
                  <Icon name="edit" className="h-4 w-4" />
                  Sửa
                </button>
                {selectedPatient.status === 'locked' ? (
                  <button className="btn-secondary text-emerald-700" onClick={() => setConfirmAction({ type: 'unlock', patient: selectedPatient })}>
                    <Icon name="refresh-cw" className="h-4 w-4" />
                    Mở khóa
                  </button>
                ) : (
                  <button className="btn-secondary text-amber-700" onClick={() => setConfirmAction({ type: 'lock', patient: selectedPatient })}>
                    <Icon name="lock" className="h-4 w-4" />
                    Khóa (Ẩn)
                  </button>
                )}
                <button className="btn-icon" onClick={() => setSelectedPatient(null)} title="Đóng">
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-100 px-5">
              <div className="flex gap-1 overflow-x-auto">
                {[
                  ['info', 'Chi tiết'],
                  ['history', 'Lịch sử khám'],
                  ['audit', 'Lịch sử chỉnh sửa'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === key ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    onClick={() => setActiveTab(key as DetailTab)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="py-16 text-center text-sm text-slate-500">
                  <span className="spinner mr-2 align-middle" />
                  Đang tải chi tiết...
                </div>
              ) : activeTab === 'info' ? (
                <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoItem label="Họ tên" value={selectedPatient.ho_ten} />
                    <InfoItem label="Email" value={selectedPatient.email} />
                    <InfoItem label="Số điện thoại" value={selectedPatient.so_dien_thoai} />
                    <InfoItem label="Ngày tham gia" value={formatDate(selectedPatient.ngay_tao)} />
                    <InfoItem label="Ngày sinh" value={formatDate(selectedPatient.primary_member?.ngay_sinh)} />
                    <InfoItem label="Giới tính" value={selectedPatient.primary_member?.gioi_tinh ? GENDER_LABEL[selectedPatient.primary_member.gioi_tinh] : null} />
                    <InfoItem label="Nhóm máu" value={selectedPatient.primary_member?.nhom_mau} />
                    <InfoItem label="Dị ứng" value={selectedPatient.primary_member?.di_ung} />
                    <InfoItem label="Bệnh nền" value={selectedPatient.primary_member?.benh_nen} />
                    <InfoItem label="Số hồ sơ khám" value={selectedPatient.medical_record_count} />
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="font-bold text-slate-900">Thành viên gia đình</h3>
                      <Badge color="gray">{selectedPatient.family_members?.length || 0}</Badge>
                    </div>
                    <div className="space-y-3">
                      {(selectedPatient.family_members || []).length === 0 ? (
                        <p className="text-sm text-slate-500">Chưa có thành viên gia đình.</p>
                      ) : (
                        selectedPatient.family_members?.map((member) => (
                          <div key={member.id} className="rounded-lg bg-slate-50 p-3">
                            <p className="font-semibold text-slate-800">{member.ho_ten}</p>
                            <p className="text-xs text-slate-500">
                              {member.quan_he || 'Chưa rõ quan hệ'} · {member.gioi_tinh ? GENDER_LABEL[member.gioi_tinh] : 'Chưa rõ giới tính'}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : activeTab === 'history' ? (
                <div className="space-y-4">
                  {examHistory.length === 0 ? (
                    <div className="empty-state">Chưa có lịch sử khám bệnh.</div>
                  ) : (
                    examHistory.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="font-bold text-slate-900">{item.chan_doan}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatDate(item.ngay_kham)} {item.gio_kham ? `· ${item.gio_kham}` : ''} · {item.benh_nhan}
                            </p>
                          </div>
                          <Badge color="blue">{item.ma_lich_hen || item.queue_id ? 'Hồ sơ khám' : 'Kết quả khám'}</Badge>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <InfoItem label="Bác sĩ" value={item.bac_si || 'Chưa ghi nhận'} />
                          <InfoItem label="Phòng" value={item.phong_kham || 'Chưa ghi nhận'} />
                          <InfoItem label="Chuyên khoa" value={item.chuyen_khoa || 'Chưa ghi nhận'} />
                        </div>
                        {(item.huong_dan_dieu_tri || item.ghi_chu) && (
                          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                            {item.huong_dan_dieu_tri && <p><span className="font-semibold">Hướng dẫn:</span> {item.huong_dan_dieu_tri}</p>}
                            {item.ghi_chu && <p className="mt-1"><span className="font-semibold">Ghi chú:</span> {item.ghi_chu}</p>}
                          </div>
                        )}
                        <div className="mt-4">
                          <h4 className="mb-2 text-sm font-bold text-slate-800">Đơn thuốc</h4>
                          {item.don_thuoc.length === 0 ? (
                            <p className="text-sm text-slate-500">Không có đơn thuốc trong hồ sơ này.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                              <table className="w-full min-w-[640px] text-sm">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Thuốc</th>
                                    <th className="px-3 py-2 text-left">Liều lượng</th>
                                    <th className="px-3 py-2 text-left">Tần suất</th>
                                    <th className="px-3 py-2 text-left">Số ngày</th>
                                    <th className="px-3 py-2 text-left">Ghi chú</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.don_thuoc.flatMap((prescription) => prescription.items).map((drug) => (
                                    <tr key={drug.id} className="border-t border-slate-100">
                                      <td className="px-3 py-2 font-semibold text-slate-800">{drug.ten_thuoc}</td>
                                      <td className="px-3 py-2 text-slate-600">{drug.lieu_luong || '—'}</td>
                                      <td className="px-3 py-2 text-slate-600">{drug.tan_suat || drug.gio_uong.join(', ') || '—'}</td>
                                      <td className="px-3 py-2 text-slate-600">{drug.so_ngay}</td>
                                      <td className="px-3 py-2 text-slate-600">{drug.ghi_chu || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.length === 0 ? (
                    <div className="empty-state">Chưa có lịch sử chỉnh sửa bệnh nhân.</div>
                  ) : (
                    auditLogs.map((log) => {
                      const fields = changedFields(log)
                      return (
                        <div key={log._id} className="rounded-xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-bold text-slate-900">{actionLabel(log.hanh_dong)}</p>
                              <p className="mt-0.5 text-xs text-slate-500">
                                <span className="font-semibold text-slate-700">Thực hiện bởi:</span> {log.nguoi_thuc_hien_id?.ho_ten || 'Hệ thống'} · <span className="font-semibold text-slate-700">Thời gian:</span> {formatDateTime(log.ngay_tao)}
                              </p>
                            </div>
                            <Badge color={log.loai_doi_tuong === 'patient' ? 'blue' : 'gray'}>
                              {OBJECT_LABEL[log.loai_doi_tuong] || log.loai_doi_tuong}
                            </Badge>
                          </div>
                          {fields.length > 0 && (
                            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-100">
                              <table className="w-full min-w-[560px] text-sm">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Trường</th>
                                    <th className="px-3 py-2 text-left">Trước</th>
                                    <th className="px-3 py-2 text-left">Sau</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {fields.map((field) => (
                                    <tr key={field} className="border-t border-slate-100">
                                      <td className="px-3 py-2 font-semibold text-slate-700">{FIELD_LABEL[field] || field}</td>
                                      <td className="px-3 py-2 text-red-600">{valueText(field, log.du_lieu_cu?.[field])}</td>
                                      <td className="px-3 py-2 text-emerald-700">{valueText(field, log.du_lieu_moi?.[field])}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {editingPatient && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
          <form onSubmit={submitEdit} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Sửa bệnh nhân</h3>
                <p className="text-sm text-slate-500">Chỉnh sửa thông tin hành chính và hồ sơ cơ bản.</p>
              </div>
              <button type="button" className="btn-icon" onClick={() => setEditingPatient(null)}>
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {formError}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="input-label">Họ tên *</label>
                <input className="input" required value={editingPatient.ho_ten} onChange={(event) => setEditingPatient({ ...editingPatient, ho_ten: event.target.value })} />
              </div>
              <div>
                <label className="input-label">Email</label>
                <input className="input bg-slate-50 text-slate-500" disabled value={editingPatient.email} />
              </div>
              <div>
                <label className="input-label">Số điện thoại</label>
                <input className="input" value={editingPatient.so_dien_thoai || ''} onChange={(event) => setEditingPatient({ ...editingPatient, so_dien_thoai: event.target.value })} />
              </div>
              <div>
                <label className="input-label">Trạng thái</label>
                <select className="input" value={editingPatient.status} onChange={(event) => setEditingPatient({ ...editingPatient, status: event.target.value as 'active' | 'locked' })}>
                  <option value="active">Hoạt động (Hiển thị)</option>
                  <option value="locked">Đã khóa (Ẩn)</option>
                </select>
              </div>
              <div>
                <label className="input-label">Ngày sinh</label>
                <input className="input" type="date" value={toDateInput(editingPatient.primary_member?.ngay_sinh)} onChange={(event) => updatePrimaryMember('ngay_sinh', event.target.value)} />
              </div>
              <div>
                <label className="input-label">Giới tính</label>
                <select className="input" value={editingPatient.primary_member?.gioi_tinh || ''} onChange={(event) => updatePrimaryMember('gioi_tinh', event.target.value)}>
                  <option value="">Chưa chọn</option>
                  <option value="nam">Nam</option>
                  <option value="nu">Nữ</option>
                  <option value="khac">Khác</option>
                </select>
              </div>
              <div>
                <label className="input-label">Nhóm máu</label>
                <select className="input" value={editingPatient.primary_member?.nhom_mau || ''} onChange={(event) => updatePrimaryMember('nhom_mau', event.target.value)}>
                  <option value="">Chưa rõ</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="AB">AB</option>
                  <option value="O">O</option>
                </select>
              </div>
              <div>
                <label className="input-label">Ảnh đại diện URL</label>
                <input className="input" value={editingPatient.anh_dai_dien || ''} onChange={(event) => setEditingPatient({ ...editingPatient, anh_dai_dien: event.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Dị ứng</label>
                <textarea className="input min-h-20" value={editingPatient.primary_member?.di_ung || ''} onChange={(event) => updatePrimaryMember('di_ung', event.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="input-label">Bệnh nền</label>
                <textarea className="input min-h-20" value={editingPatient.primary_member?.benh_nen || ''} onChange={(event) => updatePrimaryMember('benh_nen', event.target.value)} />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" className="btn-secondary" disabled={submitting} onClick={() => setEditingPatient(null)}>
                Hủy
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {confirmAction && createPortal(
        <ConfirmDialog
          open={!!confirmAction}
          danger={confirmAction.type === 'lock'}
          confirmDisabled={submitting}
          title={
            confirmAction.type === 'lock'
              ? 'Khóa tài khoản bệnh nhân'
              : 'Mở khóa tài khoản bệnh nhân'
          }
          message={
            confirmAction.type === 'lock'
              ? `Bạn có chắc muốn khóa tài khoản bệnh nhân "${confirmAction.patient.ho_ten}"? Bệnh nhân sẽ bị ẩn và không thể đặt lịch khám cho đến khi được mở khóa.`
              : `Bạn có chắc muốn mở khóa tài khoản bệnh nhân "${confirmAction.patient.ho_ten}"?`
          }
          confirmText={submitting ? 'Đang xử lý...' : 'Xác nhận'}
          onConfirm={handleConfirmedAction}
          onCancel={() => setConfirmAction(null)}
        />,
        document.body
      )}
    </AdminAutoStagger>
  )
}
