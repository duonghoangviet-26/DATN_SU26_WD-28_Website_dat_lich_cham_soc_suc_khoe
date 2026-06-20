import { useEffect, useState } from 'react'
import type { HospitalItem, SpecialtyItem } from '@/types'
import { hospitalService } from '@/services/hospital.service'
import PageHeader from '@/components/common/PageHeader'
import Icon from '@/components/admin/icons'

import ClinicDetail from './ClinicDetail'
import EditClinic from './EditClinic'
import SpecialtyList from './SpecialtyList'
import AddSpecialty from './AddSpecialty'
import EditSpecialty from './EditSpecialty'

type Tab = 'clinic' | 'specialty'
type SpecialtyView = 'list' | 'add' | 'edit'

export default function ManageHospitals() {
  const [tab, setTab] = useState<Tab>('clinic')

  // ---- State phòng khám ----
  const [clinic, setClinic] = useState<HospitalItem | null>(null)
  const [clinicLoading, setClinicLoading] = useState(true)
  const [clinicError, setClinicError] = useState<string | null>(null)
  const [editingClinic, setEditingClinic] = useState(false)

  // ---- State chuyên khoa ----
  const [specialties, setSpecialties] = useState<SpecialtyItem[]>([])
  const [specialtyLoading, setSpecialtyLoading] = useState(true)
  const [specialtyView, setSpecialtyView] = useState<SpecialtyView>('list')
  const [editingSpecialty, setEditingSpecialty] = useState<SpecialtyItem | null>(null)

  // ---- Load dữ liệu phòng khám ----
  useEffect(() => {
    setClinicLoading(true)
    setClinicError(null)
    hospitalService.getClinicInfo()
      .then(setClinic)
      .catch(() => setClinicError('Không thể tải thông tin phòng khám'))
      .finally(() => setClinicLoading(false))
  }, [])

  // ---- Load danh sách chuyên khoa ----
  useEffect(() => {
    setSpecialtyLoading(true)
    hospitalService.getSpecialties()
      .then(setSpecialties)
      .finally(() => setSpecialtyLoading(false))
  }, [])

  // ---- Handlers ----
  function handleClinicSaved(updated: HospitalItem) {
    setClinic(updated)
    setEditingClinic(false)
  }

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
        description="Quản lý thông tin phòng khám và danh sách các chuyên khoa trong hệ thống."
      />

      {/* Tab switch */}
      <div className="card mb-5 flex gap-1 p-1.5">
        <button
          onClick={() => { setTab('clinic'); setEditingClinic(false) }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'clinic' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Icon name="hospital" className="h-4 w-4" />
          Phòng Khám
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
          {clinicLoading && (
            <div className="card flex items-center justify-center py-20 text-slate-400">
              Đang tải thông tin phòng khám...
            </div>
          )}

          {clinicError && !clinicLoading && (
            <div className="card px-6 py-10 text-center">
              <p className="text-red-500">{clinicError}</p>
              <button
                className="mt-3 text-sm text-brand-600 underline"
                onClick={() => window.location.reload()}
              >
                Thử lại
              </button>
            </div>
          )}

          {!clinicLoading && !clinicError && clinic && (
            <>
              {!editingClinic ? (
                <ClinicDetail clinic={clinic} onEdit={() => setEditingClinic(true)} />
              ) : (
                <EditClinic
                  clinic={clinic}
                  onSaved={handleClinicSaved}
                  onCancel={() => setEditingClinic(false)}
                />
              )}
            </>
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
