import { useEffect, useState } from 'react'
import type { HospitalItem, SpecialtyItem } from '@/types'
import { hospitalService } from '@/services/hospital.service'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'

import ClinicList from './ClinicList'
import EditClinic from './EditClinic'
import SpecialtyList from './SpecialtyList'
import AddSpecialty from './AddSpecialty'
import EditSpecialty from './EditSpecialty'

type Tab = 'clinic' | 'specialty'
type ClinicView = 'list' | 'add' | 'edit'
type SpecialtyView = 'list' | 'add' | 'edit'

export default function ManageHospitals() {
  const [tab, setTab] = useState<Tab>('clinic')

  // ---- State phòng khám (chi nhánh) ----
  const [clinics, setClinics] = useState<HospitalItem[]>([])
  const [clinicLoading, setClinicLoading] = useState(true)
  const [clinicView, setClinicView] = useState<ClinicView>('list')
  const [editingClinic, setEditingClinic] = useState<HospitalItem | null>(null)

  // ---- State chuyên khoa ----
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([])
  const [specialtyLoading, setSpecialtyLoading] = useState(true)
  const [specialtyView, setSpecialtyView] = useState<SpecialtyView>('list')
  const [editingSpecialty, setEditingSpecialty] = useState<SpecialtyItem | null>(null)

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

  // ---- Load danh sách chuyên khoa ----
  useEffect(() => {
    setSpecialtyLoading(true)
    hospitalService.getSpecialties()
      .then(setSpecialties)
      .finally(() => setSpecialtyLoading(false))
  }, [])

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

  async function handleDeleteClinic(c: HospitalItem) {
    if (!window.confirm(`Bạn có chắc muốn ngừng hoạt động chi nhánh "${c.ten}"?`)) return
    try {
      await hospitalService.deleteClinic(c._id)
      fetchClinics()
    } catch (error) {
      alert('Lỗi khi xóa chi nhánh')
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

  return (
    <div>
      <PageHeader
        title="Phòng Khám & Chuyên Khoa"
        description="Quản lý thông tin các chi nhánh phòng khám và danh sách chuyên khoa trong hệ thống."
      />

      {/* Tab switch */}
      <div className="card mb-5 flex gap-1 p-1.5">
        <button
          onClick={() => { setTab('clinic'); setClinicView('list'); setEditingClinic(null) }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'clinic' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="hospital" className="h-4 w-4" />
          Phòng Khám ({clinics.length})
        </button>
        <button
          onClick={() => { setTab('specialty'); setSpecialtyView('list'); setEditingSpecialty(null) }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'specialty' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="service" className="h-4 w-4" />
          Chuyên Khoa ({specialties.length})
        </button>
      </div>

      {/* ===== TAB PHÒNG KHÁM ===== */}
      {tab === 'clinic' && (
        <>
          {clinicView === 'list' && (
            <ClinicList
              clinics={clinics}
              loading={clinicLoading}
              onAdd={() => setClinicView('add')}
              onEdit={handleEditClinic}
              onDelete={handleDeleteClinic}
            />
          )}

          {(clinicView === 'add' || clinicView === 'edit') && (
            <EditClinic
              clinic={editingClinic}
              onSaved={handleClinicSaved}
              onCancel={() => { setClinicView('list'); setEditingClinic(null) }}
            />
          )}
        </>
      )}

      {/* ===== TAB CHUYÊN KHOA ===== */}
      {tab === 'specialty' && (
        <>
          {specialtyView === 'list' && (
            <SpecialtyList
              specialties={specialties}
              loading={specialtyLoading}
              onAdd={() => setSpecialtyView('add')}
              onEdit={handleEditSpecialty}
              onChange={handleSpecialtyToggled}
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
              onCancel={() => { setSpecialtyView('list'); setEditingSpecialty(null) }}
            />
          )}
        </>
      )}
    </div>
  )
}
