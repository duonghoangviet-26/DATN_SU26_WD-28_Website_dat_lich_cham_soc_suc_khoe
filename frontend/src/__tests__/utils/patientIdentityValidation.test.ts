import { describe, expect, it } from 'vitest'

import {
  getLatestAllowedBirthDateInput,
  normalizePersonName,
  normalizePhoneInput,
  validateBirthDate,
  validatePatientName,
  validateVietnamesePhone,
} from '@/utils/patientIdentityValidation'

describe('patient identity validation', () => {
  it('chuẩn hóa số điện thoại về chữ số và giới hạn 10 ký tự', () => {
    expect(normalizePhoneInput('0907 770 000 ext')).toBe('0907770000')
  })

  it('chỉ chấp nhận số điện thoại 10 số bắt đầu bằng 0', () => {
    expect(validateVietnamesePhone('0907770000')).toBe('')
    expect(validateVietnamesePhone('907770000')).toContain('10 chữ số')
    expect(validateVietnamesePhone('1907770000')).toContain('bắt đầu bằng 0')
  })

  it('chuẩn hóa và kiểm tra họ tên hợp lệ', () => {
    expect(normalizePersonName('  Nguyễn   Văn   A  ')).toBe('Nguyễn Văn A')
    expect(validatePatientName('Nguyễn Văn A')).toBe('')
    expect(validatePatientName('Nguyễn Văn A2')).toContain('chỉ được chứa chữ cái')
  })

  it('không cho chọn ngày sinh ở tương lai hoặc dưới 30 ngày tuổi', () => {
    const today = new Date('2026-08-08T00:00:00')
    expect(getLatestAllowedBirthDateInput(today)).toBe('2026-07-09')
    expect(validateBirthDate('2026-08-09', today)).toContain('ở tương lai')
    expect(validateBirthDate('2026-08-01', today)).toContain('ít nhất 30 ngày')
    expect(validateBirthDate('2026-07-09', today)).toBe('')
  })
})
