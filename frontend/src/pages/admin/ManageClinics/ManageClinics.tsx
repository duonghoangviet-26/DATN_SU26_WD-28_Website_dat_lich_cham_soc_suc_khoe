import { useEffect, useState } from 'react'
import type { ClinicItem, SpecialtyItem } from '@/types'
import { clinicService } from '@/services/clinic.service'
import PageHeader from '@/components/common/PageHeader'

import EditClinic from './EditClinic'
import SpecialtyList from './SpecialtyList'
import AddSpecialty from './AddSpecialty'
import EditSpecialty from './EditSpecialty'
import ClinicAuditLogModal from './ClinicAuditLogModal'

type SpecialtyView = 'list' | 'add' | 'edit'

export default function ManageClinics() {
  const [clinic, setClinic] = useState<ClinicItem | null>(null)
  const [clinicLoading, setClinicLoading] = useState(true)

  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([])
  const [specialtyLoading, setSpecialtyLoading] = useState(true)
  const [specialtyView, setSpecialtyView] = useState<SpecialtyView>('list')
  const [editingSpecialty, setEditingSpecialty] = useState<SpecialtyItem | null>(null)

  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [auditTitle, setAuditTitle] = useState('')
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  async function fetchClinic() {
    setClinicLoading(true)
    try {
      const data = await clinicService.getCurrentClinic()
      setClinic(data)
    } catch (error) {
      console.error('Loi khi tai thong tin phong kham', error)
    } finally {
      setClinicLoading(false)
    }
  }

  async function fetchSpecialties() {
    setSpecialtyLoading(true)
    try {
      const data = await clinicService.getSpecialties()
      setSpecialties(data)
    } catch (error) {
      console.error('Loi khi tai danh sach chuyen khoa', error)
    } finally {
      setSpecialtyLoading(false)
    }
  }

  useEffect(() => {
    fetchClinic()
    fetchSpecialties()
  }, [])

  async function handleClinicSaved(updatedClinic: ClinicItem) {
    setClinic(updatedClinic)
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
    setAuditTitle('Thong tin phong kham')
    setAuditModalOpen(true)
    setAuditLoading(true)
    try {
      const logs = await clinicService.getCurrentClinicLogs()
      setAuditLogs(logs)
    } catch (error: any) {
      console.error(error)
      alert('Loi tai lich su: ' + (error.response?.data?.message || error.message))
    } finally {
      setAuditLoading(false)
    }
  }

  async function handleViewSpecialtyLogs(specialty: SpecialtyItem) {
    setAuditTitle(`Chuyen khoa ${specialty.ten}`)
    setAuditModalOpen(true)
    setAuditLoading(true)
    try {
      const logs = await clinicService.getSpecialtyLogs(specialty._id)
      setAuditLogs(logs)
    } catch (error: any) {
      console.error(error)
      alert('Loi tai lich su: ' + (error.response?.data?.message || error.message))
    } finally {
      setAuditLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Phong Kham & Chuyen Khoa"
        description="Quan ly thong tin co so duy nhat cua VitaFamily va danh sach chuyen khoa dang van hanh."
      />

      <EditClinic
        clinic={clinic}
        loading={clinicLoading}
        onSaved={handleClinicSaved}
        onCancel={fetchClinic}
        onViewLogs={handleViewClinicLogs}
      />

      {!clinic && !clinicLoading ? (
        <div className="card rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
          Hay luu thong tin phong kham truoc khi quan ly chuyen khoa. Toan bo chuyen khoa admin se duoc gan vao co so duy nhat nay.
        </div>
      ) : (
        <div className="space-y-4">
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
        </div>
      )}

      <ClinicAuditLogModal
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        title={auditTitle}
        logs={auditLogs}
        loading={auditLoading}
      />
    </div>
  )
}
