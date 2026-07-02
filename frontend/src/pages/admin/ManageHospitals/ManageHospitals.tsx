import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { HospitalItem, SpecialtyItem } from '@/types'
import { hospitalService } from '@/services/hospital.service'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'

import ClinicList from './ClinicList'
import EditClinic from './EditClinic'
import SpecialtyList from './SpecialtyList'
import AddSpecialty from './AddSpecialty'
import EditSpecialty from './EditSpecialty'
import HospitalAuditLogModal from './HospitalAuditLogModal'

type ClinicView = 'list' | 'add' | 'edit' | 'specialties'
type SpecialtyView = 'list' | 'add' | 'edit'

export default function ManageHospitals() {
  // ---- State phòng khám (chi nhánh) ----
  const [clinics, setClinics] = useState<HospitalItem[]>([])
  const [clinicLoading, setClinicLoading] = useState(true)
  const [clinicView, setClinicView] = useState<ClinicView>('list')
  const [editingClinic, setEditingClinic] = useState<HospitalItem | null>(null)
  const [selectedClinic, setSelectedClinic] = useState<HospitalItem | null>(null)

  const [searchParams, setSearchParams] = useSearchParams()

  // ---- State chuyên khoa ----
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([])
  const [specialtyLoading, setSpecialtyLoading] = useState(false)
  const [specialtyView, setSpecialtyView] = useState<SpecialtyView>('list')
  const [editingSpecialty, setEditingSpecialty] = useState<SpecialtyItem | null>(null)

  // ---- State Lịch sử (Audit Log) ----
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [auditTitle, setAuditTitle] = useState('')
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  // ---- Load dữ liệu chi nhánh ----
  const fetchClinics = () => {
    setClinicLoading(true)
    hospitalService.getAllClinics()
      .then(setClinics)
      .catch((err) => console.error('Lỗi khi tải danh sách chi nhánh', err))
      .finally(() => setClinicLoading(false))
  }

  useEffect(() => {
    fetchClinics()
  }, [])

  // ---- Sync URL with State ----
  useEffect(() => {
    if (clinics.length === 0) return

    const clinicIdQuery = searchParams.get('clinic')

    if (clinicIdQuery) {
      if (clinicView !== 'specialties' || selectedClinic?._id !== clinicIdQuery) {
        const c = clinics.find((x) => x._id === clinicIdQuery)
        if (c) {
          setSelectedClinic(c)
          setClinicView('specialties')
          setSpecialtyView('list')
          fetchSpecialties(c._id)
        } else {
          searchParams.delete('clinic')
          setSearchParams(searchParams)
        }
      }
    } else {
      if (clinicView === 'specialties') {
        setClinicView('list')
        setSelectedClinic(null)
      }
    }
  }, [searchParams, clinics, clinicView, selectedClinic])

  // ---- Load danh sách chuyên khoa cho 1 chi nhánh ----
  const fetchSpecialties = (clinicId: string) => {
    setSpecialtyLoading(true)
    hospitalService.getSpecialties(clinicId)
      .then(setSpecialties)
      .finally(() => setSpecialtyLoading(false))
  }

  // ---- Handlers: Chi nhánh ----
  function handleClinicSaved() {
    fetchClinics()
    setClinicView('list')
    setEditingClinic(null)
  }

  function handleEditClinic(c: HospitalItem) {
    setEditingClinic(c)
    setClinicView('edit')
  }

  function handleViewSpecialties(c: HospitalItem) {
    setSelectedClinic(c)
    setClinicView('specialties')
    setSpecialtyView('list')
    fetchSpecialties(c._id)
    searchParams.set('clinic', c._id)
    setSearchParams(searchParams)
  }

  async function handleDeleteClinic(c: HospitalItem) {
    if (!window.confirm(`Bạn có chắc muốn ngừng hoạt động chi nhánh "${c.ten}"?`)) return
    try {
      await hospitalService.deleteClinic(c._id)
      fetchClinics()
    } catch (error) {
      alert('Lỗi khi ngừng hoạt động chi nhánh')
    }
  }

  async function handleRestoreClinic(c: HospitalItem) {
    if (!window.confirm(`Bạn có chắc muốn khôi phục hoạt động chi nhánh "${c.ten}"?`)) return
    try {
      await hospitalService.updateClinicInfo(c._id, { trang_thai: 'active' })
      fetchClinics()
    } catch (error) {
      alert('Lỗi khi khôi phục chi nhánh')
    }
  }

  async function handleViewClinicLogs(c: HospitalItem) {
    setAuditTitle(`Chi nhánh ${c.ten}`)
    setAuditModalOpen(true)
    setAuditLoading(true)
    try {
      const logs = await hospitalService.getClinicLogs(c._id)
      setAuditLogs(logs)
    } catch (err: any) {
      console.error(err)
      alert('Lỗi tải lịch sử: ' + (err.response?.data?.message || err.message))
    } finally {
      setAuditLoading(false)
    }
  }

  // ---- Handlers: Chuyên khoa ----
  function handleSpecialtySaved(saved: SpecialtyItem) {
    setSpecialties((prev) => {
      const exists = prev.find((s) => s._id === saved._id)
      if (exists) return prev.map((s) => (s._id === saved._id ? saved : s))
      return [...prev, saved].sort((a, b) => a.thu_tu - b.thu_tu)
    })
    setSpecialtyView('list')
    setEditingSpecialty(null)
  }

  function handleSpecialtyToggled(updated: SpecialtyItem) {
    setSpecialties((prev) => prev.map((s) => (s._id === updated._id ? updated : s)))
  }

  function handleEditSpecialty(s: SpecialtyItem) {
    setEditingSpecialty(s)
    setSpecialtyView('edit')
  }

  async function handleViewSpecialtyLogs(s: SpecialtyItem) {
    setAuditTitle(`Chuyên khoa ${s.ten}`)
    setAuditModalOpen(true)
    setAuditLoading(true)
    try {
      const logs = await hospitalService.getSpecialtyLogs(s._id)
      setAuditLogs(logs)
    } catch (err: any) {
      console.error(err)
      alert('Lỗi tải lịch sử: ' + (err.response?.data?.message || err.message))
    } finally {
      setAuditLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Phòng Khám & Chuyên Khoa"
        description="Quản lý thông tin các chi nhánh phòng khám và danh sách chuyên khoa trong hệ thống."
      />

      {clinicView === 'list' && (
        <ClinicList
          clinics={clinics}
          loading={clinicLoading}
          onAdd={() => setClinicView('add')}
          onEdit={handleEditClinic}
          onDelete={handleDeleteClinic}
          onRestore={handleRestoreClinic}
          onViewSpecialties={handleViewSpecialties}
          onViewLogs={handleViewClinicLogs}
        />
      )}

      {(clinicView === 'add' || clinicView === 'edit') && (
        <EditClinic
          clinic={editingClinic}
          onSaved={handleClinicSaved}
          onCancel={() => { setClinicView('list'); setEditingClinic(null) }}
        />
      )}

      {clinicView === 'specialties' && selectedClinic && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setClinicView('list')
                setSelectedClinic(null)
                searchParams.delete('clinic')
                setSearchParams(searchParams)
              }}
              className="btn-secondary"
            >
              <Icon name="chevron-left" className="h-4 w-4 mr-1" />
              Quay lại danh sách chi nhánh
            </button>
            <h2 className="text-xl font-bold text-slate-800">
              Chuyên Khoa: <span className="text-brand-600">{selectedClinic.ten}</span>
            </h2>
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
              clinicId={selectedClinic._id}
              onSaved={handleSpecialtySaved}
              onCancel={() => setSpecialtyView('list')}
            />
          )}

          {specialtyView === 'edit' && editingSpecialty && (
            <EditSpecialty
              specialty={editingSpecialty}
              onSaved={handleSpecialtySaved}
              onCancel={() => { setSpecialtyView('list'); setEditingSpecialty(null) }}
            />
          )}
        </div>
      )}

      <HospitalAuditLogModal
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        title={auditTitle}
        logs={auditLogs}
        loading={auditLoading}
      />
    </div>
  )
}
