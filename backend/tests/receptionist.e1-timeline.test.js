import test from 'node:test'
import assert from 'node:assert/strict'

import {
  HO_SO_WHITELIST_HANH_DONG,
  LICH_HEN_WHITELIST_HANH_DONG,
  HANH_DONG_NHAN,
  locTruongNhayCam,
  diffThayDoi,
  tuNhatKy,
  tuLichSuLichHen,
} from '../src/services/receptionistTimeline.service.js'

test('E-1 every whitelisted hanh_dong has a Vietnamese label (no raw code leaking to UI)', () => {
  for (const action of [...HO_SO_WHITELIST_HANH_DONG, ...LICH_HEN_WHITELIST_HANH_DONG]) {
    assert.ok(HANH_DONG_NHAN[action], `Thieu nhan tieng Viet cho hanh_dong=${action}`)
  }
})

test('E-1 locTruongNhayCam strips fields outside the whitelist', () => {
  const result = locTruongNhayCam({ ho_ten: 'Nguyen Van A', gia_kham: 500000, mat_khau: 'hash' })
  assert.deepEqual(result, { ho_ten: 'Nguyen Van A' })
})

test('E-1 locTruongNhayCam returns null when nothing survives the whitelist or input is empty', () => {
  assert.equal(locTruongNhayCam({ gia_kham: 500000 }), null)
  assert.equal(locTruongNhayCam(null), null)
  assert.equal(locTruongNhayCam(undefined), null)
})

test('E-1 diffThayDoi computes changed fields and ignores the changed_fields meta key', () => {
  const diff = diffThayDoi(
    { changed_fields: ['so_dien_thoai'], so_dien_thoai: '0900000000' },
    { changed_fields: ['so_dien_thoai'], so_dien_thoai: '0911111111' },
  )
  assert.deepEqual(diff, [{ truong: 'so_dien_thoai', cu: '0900000000', moi: '0911111111' }])
})

test('E-1 diffThayDoi returns empty array when both sides are empty', () => {
  assert.deepEqual(diffThayDoi(null, null), [])
  assert.deepEqual(diffThayDoi({}, {}), [])
})

test('E-1 tuNhatKy maps a NhatKyThaoTac doc to the unified timeline row shape', () => {
  const row = tuNhatKy({
    ngay_tao: new Date('2026-08-01T03:00:00.000Z'),
    nguoi_thuc_hien_id: { ho_ten: 'Le tan A' },
    vai_tro: 'receptionist',
    hanh_dong: 'UPDATE_PATIENT_PROFILE_ADMINISTRATIVE',
    ly_do: 'Khach yeu cau sua SDT',
    du_lieu_cu: { changed_fields: ['so_dien_thoai'], so_dien_thoai: '0900000000' },
    du_lieu_moi: { changed_fields: ['so_dien_thoai'], so_dien_thoai: '0911111111' },
  })

  assert.equal(row.nguon, 'nhat_ky')
  assert.equal(row.nguoi.ho_ten, 'Le tan A')
  assert.equal(row.nguoi.vai_tro, 'Lễ tân')
  assert.equal(row.nhan, HANH_DONG_NHAN.UPDATE_PATIENT_PROFILE_ADMINISTRATIVE)
  assert.equal(row.ly_do, 'Khach yeu cau sua SDT')
  assert.deepEqual(row.thay_doi, [{ truong: 'so_dien_thoai', cu: '0900000000', moi: '0911111111' }])
})

test('E-1 tuNhatKy falls back to the raw action code when no Vietnamese label is registered', () => {
  const row = tuNhatKy({ ngay_tao: new Date(), nguoi_thuc_hien_id: null, vai_tro: 'system', hanh_dong: 'UNKNOWN_ACTION' })
  assert.equal(row.nhan, 'UNKNOWN_ACTION')
  assert.equal(row.nguoi.ho_ten, null)
})

test('E-1 tuNhatKy filters sensitive fields out of thay_doi via the field whitelist', () => {
  const row = tuNhatKy({
    ngay_tao: new Date(),
    nguoi_thuc_hien_id: { ho_ten: 'Admin A' },
    vai_tro: 'admin',
    hanh_dong: 'UPDATE_PATIENT',
    du_lieu_cu: { ho_ten: 'Cu', gia_kham_noi_bo: 999 },
    du_lieu_moi: { ho_ten: 'Moi', gia_kham_noi_bo: 1000 },
  })
  const fields = row.thay_doi.map((item) => item.truong)
  assert.ok(fields.includes('ho_ten'))
  assert.ok(!fields.includes('gia_kham_noi_bo'), 'Truong nhay cam khong duoc lot vao thay_doi')
})

test('E-1 tuLichSuLichHen only reports fields that actually changed', () => {
  const row = tuLichSuLichHen({
    thoi_diem: new Date('2026-08-01T02:00:00.000Z'),
    nguoi_thay_doi_id: { ho_ten: 'Le tan B' },
    vai_tro: 'receptionist',
    tu_trang_thai: 'confirmed',
    den_trang_thai: 'checked_in',
    gio_kham_cu: '09:00',
    gio_kham_moi: '09:00',
    bac_si_cu_id: null,
    bac_si_moi_id: null,
    ly_do_thay_doi: 'Check-in tai quay',
  })

  assert.equal(row.nguon, 'lich_su_lich_hen')
  assert.deepEqual(row.thay_doi, [{ truong: 'trang_thai', cu: 'confirmed', moi: 'checked_in' }])
  assert.equal(row.nhan, 'Chuyển trạng thái sang "checked_in"')
})

test('E-1 tuLichSuLichHen falls back to kenh_thay_doi when vai_tro is absent (legacy rows)', () => {
  const row = tuLichSuLichHen({
    thoi_diem: new Date(),
    nguoi_thay_doi_id: { ho_ten: 'He thong' },
    vai_tro: undefined,
    kenh_thay_doi: 'admin',
    tu_trang_thai: 'pending',
    den_trang_thai: 'cancelled',
  })
  assert.equal(row.nguoi.vai_tro, 'admin')
})
