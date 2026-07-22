import { useEffect, useState } from 'react'
import type { ClinicItem, ClinicRoomItem, ClinicRoomOptions, SpecialtyItem } from '@/types'
import { clinicService } from '@/services/clinic.service'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'
import { AdminAutoStagger } from '@/components/admin/motion/AdminMotion'

import EditClinic from './EditClinic'
import ClinicDetail from './ClinicDetail'
import SpecialtyList from './SpecialtyList'
import AddSpecialty from './AddSpecialty'
import EditSpecialty from './EditSpecialty'
import ClinicAuditLogModal from './ClinicAuditLogModal'
import ClinicRoomsTab from './ClinicRoomsTab'

type SpecialtyView = 'list' | 'add' | 'edit'
type ClinicMode = 'view' | 'edit'
type SectionTab = 'specialties' | 'rooms'

export default function ManageClinics() {
  const [clinic, setClinic] = useState<ClinicItem | null>(null)
  const [clinicLoading, setClinicLoading] = useState(true)
  const [clinicMode, setClinicMode] = useState<ClinicMode>('view')

  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([])
  const [specialtyLoading, setSpecialtyLoading] = useState(true)
  const [specialtyView, setSpecialtyView] = useState<SpecialtyView>('list')
  const [editingSpecialty, setEditingSpecialty] = useState<SpecialtyItem | null>(null)
  const [sectionTab, setSectionTab] = useState<SectionTab>('specialties')

  const [rooms, setRooms] = useState<ClinicRoomItem[]>([])
  const [roomOptions, setRoomOptions] = useState<ClinicRoomOptions>({ doctors: [], nurses: [] })
  const [roomLoading, setRoomLoading] = useState(true)
  const [roomError, setRoomError] = useState<string | null>(null)

  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [auditTitle, setAuditTitle] = useState('')
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  async function fetchClinic() {
    setClinicLoading(true)
    try {
      const data = await clinicService.getCurrentClinic()
      setClinic(data)
    } catch {
    } finally {
      setClinicLoading(false)
    }
  }

  async function fetchSpecialties() {
    setSpecialtyLoading(true)
    try {
      const data = await clinicService.getSpecialties()
      setSpecialties(data)
    } catch {
    } finally {
      setSpecialtyLoading(false)
    }
  }

  async function fetchRooms() {
    setRoomLoading(true)
    setRoomError(null)
    try {
      const data = await clinicService.getRooms()
      setRooms(data)
    } catch (error: any) {
      setRooms([])
      setRoomError(getRequestErrorMessage(error, 'Không thể tải danh sách phòng khám nhỏ.'))
    } finally {
      setRoomLoading(false)
    }
  }

  async function fetchRoomOptions() {
    try {
      const data = await clinicService.getRoomOptions()
      setRoomOptions(data)
    } catch {
      setRoomOptions({ doctors: [], nurses: [] })
    }
  }

  useEffect(() => {
    fetchClinic()
    fetchSpecialties()
    fetchRooms()
    fetchRoomOptions()
  }, [])

  useEffect(() => {
    if (!clinic && !clinicLoading) {
      setClinicMode('edit')
    }
  }, [clinic, clinicLoading])

  async function handleClinicSaved(updatedClinic: ClinicItem) {
    setClinic(updatedClinic)
    setClinicMode('view')
    await fetchSpecialties()
  }

  function handleSpecialtySaved(saved: SpecialtyItem) {
    setSpecialties((prev) => {
      const exists = prev.find((item) => item._id === saved._id)
      const nextItems = exists
        ? prev.map((item) => (item._id === saved._id ? saved : item))
        : [...prev, saved]
      return nextItems.sort((a, b) => a.thu_tu - b.thu_tu)
    })
    setSpecialtyView('list')
    setEditingSpecialty(null)
  }

  function handleSpecialtyToggled(updated: SpecialtyItem) {
    setSpecialties((prev) => prev.map((item) => (item._id === updated._id ? updated : item)))
  }

  function handleEditSpecialty(specialty: SpecialtyItem) {
    setEditingSpecialty(specialty)
    setSpecialtyView('edit')
  }

  async function handleViewClinicLogs() {
    setAuditTitle('Thông tin phòng khám')
    setAuditModalOpen(true)
    setAuditLoading(true)
    try {
      const logs = await clinicService.getCurrentClinicLogs()
      setAuditLogs(logs)
    } catch (error: any) {
      alert('Lỗi tải lịch sử: ' + (error.response?.data?.message || error.message))
    } finally {
      setAuditLoading(false)
    }
  }

  async function handleViewSpecialtyLogs(specialty: SpecialtyItem) {
    setAuditTitle(`Chuyên khoa ${specialty.ten}`)
    setAuditModalOpen(true)
    setAuditLoading(true)
    try {
      const logs = await clinicService.getSpecialtyLogs(specialty._id)
      setAuditLogs(logs)
    } catch (error: any) {
      alert('Lỗi tải lịch sử: ' + (error.response?.data?.message || error.message))
    } finally {
      setAuditLoading(false)
    }
  }

  const activeSpecialties = specialties.filter((item) => item.status === 'active').length
  const hiddenSpecialties = specialties.filter((item) => item.status === 'hidden').length
  const totalDoctorsInSpecialties = specialties.reduce((sum, item) => sum + (item.doctor_count || 0), 0)
  const activeRooms = rooms.filter((item) => item.trang_thai === 'active').length
  const totalRoomDoctors = rooms.reduce((sum, item) => sum + item.doctor_count, 0)
  const totalRoomNurses = rooms.reduce((sum, item) => sum + item.nurse_count, 0)

  return (
    <AdminAutoStagger className="space-y-6">
      <PageHeader
        title="Phòng khám & Chuyên khoa"
        description="Quản lý cơ sở duy nhất của ViteFamily và danh sách chuyên khoa đang vận hành."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Cơ sở"
          value={clinic ? 1 : 0}
          note={clinic ? 'Đã khởi tạo phòng khám chính' : 'Chưa có dữ liệu phòng khám'}
          icon="hospital"
        />
        <SummaryCard
          title="Phòng khám nhỏ"
          value={activeRooms}
          note="Phòng vật lý đang sử dụng"
          icon="map-pin"
        />
        <SummaryCard
          title="Chuyên khoa hiển thị"
          value={activeSpecialties}
          note="Đang xuất hiện trên hệ thống"
          icon="file-text"
        />
        <SummaryCard
          title="Chuyên khoa ẩn"
          value={hiddenSpecialties}
          note="Tạm ngưng hiển thị"
          icon="eye-off"
        />
        <SummaryCard
          title="Tổng bác sĩ"
          value={totalDoctorsInSpecialties}
          note="Đếm theo từng chuyên khoa"
          icon="users"
        />
        <SummaryCard
          title="Nhân sự phòng"
          value={totalRoomDoctors + totalRoomNurses}
          note={`${totalRoomDoctors} bác sĩ, ${totalRoomNurses} y tá`}
          icon="user"
        />
      </div>

      {clinic && clinicMode === 'view' ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_360px]">
          <ClinicDetail
            clinic={clinic}
            onEdit={() => setClinicMode('edit')}
            onViewLogs={handleViewClinicLogs}
            onRefresh={fetchClinic}
          />

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tổng quan</p>
              <h3 className="mt-2 text-lg font-bold text-slate-800">Vận hành nhanh</h3>
              <p className="mt-1 text-sm text-slate-500">
                Xem nhanh tình hình chuyên khoa và mở chế độ chỉnh sửa khi cần cập nhật thông tin cơ sở.
              </p>
            </div>

            <div className="space-y-3 p-5">
              <QuickItem label="Chuyên khoa đang hiển thị" value={`${activeSpecialties} khoa`} />
              <QuickItem label="Chuyên khoa đã ẩn" value={`${hiddenSpecialties} khoa`} />
              <QuickItem label="Tổng bác sĩ gắn khoa" value={`${totalDoctorsInSpecialties} bác sĩ`} />
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 p-5">
              <button
                type="button"
                onClick={() => setClinicMode('edit')}
                className="btn-primary w-full"
              >
                Chỉnh sửa thông tin phòng khám
              </button>
            </div>
          </div>
        </div>
      ) : (
        <EditClinic
          clinic={clinic}
          loading={clinicLoading}
          onSaved={handleClinicSaved}
          onCancel={async () => {
            await fetchClinic()
            setClinicMode(clinic ? 'view' : 'edit')
          }}
          onViewLogs={handleViewClinicLogs}
        />
      )}

      {!clinic && !clinicLoading ? (
        <div className="card rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
          Hãy lưu thông tin phòng khám trước khi quản lý chuyên khoa. Toàn bộ chuyên khoa sẽ được gắn vào cơ sở duy nhất này.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white">
            <div className="px-5 py-4">
              <h3 className="text-lg font-bold text-slate-800">Dữ liệu vận hành</h3>
              <p className="mt-1 text-sm text-slate-500">
                Quản lý chuyên khoa và phòng khám nhỏ trong cùng một khu vực để dễ phân công nhân sự.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setSectionTab('specialties')}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  sectionTab === 'specialties'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name="file-text" className="h-4 w-4" />
                Chuyên khoa
              </button>
              <button
                type="button"
                onClick={() => setSectionTab('rooms')}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  sectionTab === 'rooms'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name="map-pin" className="h-4 w-4" />
                Phòng khám nhỏ
              </button>
            </div>
          </div>

          {sectionTab === 'specialties' && (
            <>
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Chuyên khoa vận hành</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Gom danh sách và thao tác quản lý chuyên khoa vào một khu vực gọn hơn, để theo dõi và cập nhật nhanh.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSpecialtyView('list')
                  setEditingSpecialty(null)
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  specialtyView === 'list'
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name="file-text" className="h-4 w-4" />
                Danh sách
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpecialtyView('add')
                  setEditingSpecialty(null)
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  specialtyView === 'add'
                    ? 'bg-brand-500 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon name="plus" className="h-4 w-4" />
                Thêm khoa
              </button>
                </div>
            </div>

              {specialtyView === 'list' && (
            <SpecialtyList
              specialties={specialties}
              loading={specialtyLoading}
              onAdd={() => setSpecialtyView('add')}
              onEdit={handleEditSpecialty}
              onChange={handleSpecialtyToggled}
              onViewLogs={handleViewSpecialtyLogs}
            />
              )}

              {specialtyView === 'add' && (
            <AddSpecialty
              onSaved={handleSpecialtySaved}
              onCancel={() => setSpecialtyView('list')}
            />
              )}

              {specialtyView === 'edit' && editingSpecialty && (
            <EditSpecialty
              specialty={editingSpecialty}
              onSaved={handleSpecialtySaved}
              onCancel={() => {
                setSpecialtyView('list')
                setEditingSpecialty(null)
              }}
            />
              )}
            </>
          )}

          {sectionTab === 'rooms' && (
            <ClinicRoomsTab
              rooms={rooms}
              options={roomOptions}
              loading={roomLoading}
              loadError={roomError}
              onRetry={fetchRooms}
              onChanged={async () => {
                await fetchRooms()
                await fetchRoomOptions()
              }}
            />
          )}
        </div>
      )}

      <ClinicAuditLogModal
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        title={auditTitle}
        logs={auditLogs}
        loading={auditLoading}
      />
    </AdminAutoStagger>
  )
}

function SummaryCard({
  title,
  value,
  note,
  icon,
}: {
  title: string
  value: number
  note: string
  icon: string
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-800">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{note}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Icon name={icon} className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

function QuickItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  )
}

function getRequestErrorMessage(error: any, fallback: string) {
  const status = error?.response?.status
  const message = error?.response?.data?.message || error?.message
  if (status) return `${fallback} HTTP ${status}${message ? `: ${message}` : ''}`
  return message ? `${fallback} ${message}` : fallback
}
