import { describe, expect, it } from 'vitest'

import { getUnlinkedAccountAppointments } from '@/services/receptionist-patient-intake.service'
import type { PatientProfile, TodayAppointment } from '@/services/receptionist-patient-intake.service'

function apptStub(id: string): TodayAppointment {
  return {
    id,
    ma_lich_hen: `LH-${id}`,
    ngay_kham: '2026-08-04T00:00:00.000Z',
    gio_kham: '13:30',
    status: 'confirmed',
    payment_status: 'paid',
    nguon: 'online',
    doctor: null,
    chuyen_khoa: null,
  }
}

function profileStub(id: string, lichHenHomNay: TodayAppointment[]): PatientProfile {
  return {
    id,
    ho_ten: 'Khách test',
    nguon_tao: 'tai_quay',
    trang_thai: 'active',
    lich_hen_hom_nay: lichHenHomNay,
  }
}

describe('getUnlinkedAccountAppointments', () => {
  it('lịch của tài khoản online KHÔNG bị ẩn khi trùng SĐT với 1 hồ sơ tại quầy không liên kết tài khoản (bug tái hiện từ dữ liệu thật)', () => {
    // Kịch bản thật: khách có 1 hồ sơ tại quầy cũ (tai_khoan_id: null, không có lịch hôm nay)
    // và 1 tài khoản online riêng với lịch đã thanh toán hôm nay — 2 danh tính chưa được nối.
    const profiles = [profileStub('profile-1', [])]
    const accountAppointments = [apptStub('appt-online-1')]

    const result = getUnlinkedAccountAppointments(profiles, accountAppointments)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('appt-online-1')
  })

  it('không lặp lại lịch đã được gắn đúng vào một hồ sơ', () => {
    const linkedAppt = apptStub('appt-linked')
    const profiles = [profileStub('profile-1', [linkedAppt])]
    const accountAppointments = [linkedAppt]

    const result = getUnlinkedAccountAppointments(profiles, accountAppointments)

    expect(result).toHaveLength(0)
  })

  it('khi chưa có hồ sơ nào, mọi lịch của tài khoản online đều coi là chưa gắn (hành vi cũ)', () => {
    const accountAppointments = [apptStub('appt-1'), apptStub('appt-2')]

    const result = getUnlinkedAccountAppointments([], accountAppointments)

    expect(result).toHaveLength(2)
  })
})
