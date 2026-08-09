import { expect, test } from 'playwright/test'

const profileA = {
  id: 'profile-a',
  ho_ten: 'Nguyen An Binh',
  so_dien_thoai: '0907770000',
  ngay_sinh: null,
  gioi_tinh: 'nam',
  nguon_tao: 'tai_quay',
  tai_khoan_id: null,
  nguoi_giam_ho_id: null,
  member_id: null,
  trang_thai: 'active',
  lich_hen_hom_nay: [],
}

test('receptionist can create a profile and check in a patient', async ({ page }) => {
  let profileCreated = false
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())

    if (url.pathname.endsWith('/receptionist/notifications/recent')) {
      return route.fulfill({ json: { success: true, data: [] } })
    }

    if (url.pathname.endsWith('/receptionist/patient-intake/search')) {
      return route.fulfill({
        json: {
          success: true,
          data: { phone: '0907770000', profiles: profileCreated ? [profileA] : [], total: profileCreated ? 1 : 0, can_tao_moi: true, ambiguous_appointments: [], account_appointments: [], checked_at: '2026-07-28T08:00:00.000Z' },
        },
      })
    }

    if (url.pathname.endsWith('/receptionist/patient-intake/profiles') && request.method() === 'POST') {
      profileCreated = true
      return route.fulfill({
        status: 201,
        json: { success: true, data: { profile: profileA } },
      })
    }

    if (url.pathname.endsWith('/receptionist/patient-intake/availability')) {
      return route.fulfill({
        json: {
          success: true,
          data: {
            ngay: '2026-07-28T00:00:00.000Z',
            slots: [{
              schedule_id: 'schedule-1',
              slot_id: 'slot-1',
              doctor_id: 'doctor-1',
              specialty_id: 'specialty-tnh',
              gio_bat_dau: '15:30',
              gio_ket_thuc: '16:00',
              phong_kham: 'Phong TMH 01',
              ngay: '2026-07-28T00:00:00.000Z',
            }],
            slot_cho_xu_ly: [],
            minh_chung_suc_chua: [{ doctor_id: 'doctor-1', bac_si: 'Bac si E2E', schedule_id: 'schedule-1', lich_ngay: '2026-07-28T00:00:00.000Z', khung_gan_nhat: { schedule_id: 'schedule-1', slot_id: 'slot-1', doctor_id: 'doctor-1', gio_bat_dau: '15:30', gio_ket_thuc: '16:00', ngay: '2026-07-28T00:00:00.000Z' }, tong_slot_trong_khung: 2, online_da_dat: 1, walk_in_tong: 1, walk_in_da_giu: 0, walk_in_con_lai: 1, dang_cho: 1, do_tre_phut: 0, nguyenNhanDoTre: 'khong_tre', nguong_dung_walk_in_phut: 30, ket_luan: 'co_the_tiep_nhan', ly_do: 'Con slot walk-in' }],
            checked_at: '2026-07-28T08:00:00.000Z',
            trang_thai_kiem_tra: 'co_the_tiep_nhan',
            goi_y_quay_lai: null,
            bi_chan_qua_tai: false,
            thong_bao: null,
          },
        },
      })
    }

    if (url.pathname.endsWith('/receptionist/patient-intake/check-in') && request.method() === 'POST') {
      return route.fulfill({
        status: 201,
        json: {
          success: true,
          message: 'Da tiep nhan benh nhan vao hang doi',
          data: { entry: { _id: 'queue-1' }, slot: {} },
        },
      })
    }

    return route.fulfill({ json: { success: true, data: [] } })
  })

  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'browser-e2e-token')
    sessionStorage.setItem('user', JSON.stringify({
      id: 'receptionist-1',
      email: 'receptionist@example.test',
      ho_ten: 'Le tan E2E',
      role: 'receptionist',
      status: 'active',
    }))
  })

  await page.goto('/receptionist/patient-intake')
  await page.locator('input[inputmode="tel"]').fill(profileA.so_dien_thoai)
  await page.getByRole('button', { name: 'Tra cứu hồ sơ' }).click()
  await expect(page.getByRole('heading', { name: 'Xác nhận đúng người, rồi mới mở thao tác tiếp theo' })).toBeVisible()

  await page.locator('input[required]').fill(profileA.ho_ten)
  await page.getByRole('button', { name: 'Tạo hồ sơ và chọn hồ sơ này' }).click()
  await expect(page.getByText(profileA.ho_ten).first()).toBeVisible()

  await page.getByRole('button', { name: 'Khám bệnh' }).click()
  await expect(page.getByRole('button', { name: /15:30-16:00/ })).toBeVisible()
  await page.getByRole('button', { name: /Xác nhận khám bệnh cho Nguyen An Binh/ }).click()
  await expect(page.getByText(/Đã tiếp nhận walk-in Nguyen An Binh vào hàng đợi/)).toBeVisible()
})

test('receptionist checks in a booked appointment without using walk-in capacity', async ({ page }) => {
  const bookedAppointment = {
    id: 'appointment-online-1',
    ma_lich_hen: 'LH-E2E-001',
    ngay_kham: '2026-07-28T00:00:00.000Z',
    gio_kham: '09:00',
    gio_ket_thuc: '09:30',
    status: 'confirmed',
    payment_status: 'paid',
    nguon: 'online',
    doctor: { id: 'doctor-1', ho_ten: 'Bac si Online' },
    chuyen_khoa: { id: 'specialty-1', ten: 'Tai Mui Hong' },
    phong_kham: 'TMH 01',
  }
  const bookedProfile = {
    ...profileA,
    id: 'profile-online',
    ho_ten: 'E2E Online Patient',
    lich_hen_hom_nay: [bookedAppointment],
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/receptionist/notifications/recent')) return route.fulfill({ json: { success: true, data: [] } })
    if (url.pathname.endsWith('/receptionist/patient-intake/search')) return route.fulfill({ json: { success: true, data: { phone: bookedProfile.so_dien_thoai, profiles: [bookedProfile], total: 1, can_tao_moi: true, ambiguous_appointments: [], checked_at: '2026-07-28T08:00:00.000Z' } } })
    if (url.pathname.endsWith('/receptionist/appointments/appointment-online-1/arrived') && request.method() === 'PATCH') return route.fulfill({ json: { success: true, data: { ...bookedAppointment, status: 'checked_in' }, hang_doi: { id: 'queue-online-1', doctor_id: 'doctor-1', phong_kham: 'TMH 01', checkin_time: '2026-07-28T08:05:00.000Z' }, canh_bao: [] } })
    if (url.pathname.endsWith('/receptionist/patient-intake/availability')) return route.fulfill({ json: { success: true, data: { slots: [], slot_de_xuat: null, ly_do_de_xuat: null, minh_chung_suc_chua: [], trang_thai_kiem_tra: 'co_the_tiep_nhan', checked_at: '2026-07-28T08:00:00.000Z', goi_y_quay_lai: null, slot_cho_xu_ly: [], bi_chan_qua_tai: false, thong_bao: null } } })
    return route.fulfill({ json: { success: true, data: [] } })
  })

  await page.addInitScript(() => {
    sessionStorage.setItem('token', 'browser-e2e-token')
    sessionStorage.setItem('user', JSON.stringify({ id: 'receptionist-1', email: 'receptionist@example.test', ho_ten: 'Le tan E2E', role: 'receptionist', status: 'active' }))
  })
  await page.goto('/receptionist/patient-intake')
  await page.locator('input[inputmode="tel"]').fill(bookedProfile.so_dien_thoai)
  await page.getByRole('button', { name: 'Tra cứu hồ sơ' }).click()
  await page.getByText(bookedProfile.ho_ten, { exact: true }).click()
  await page.getByRole('button', { name: 'Check-in' }).click()
  await page.getByText('LH-E2E-001', { exact: false }).click()
  await page.getByRole('button', { name: /Check-in lịch hẹn/ }).click()
  await expect(page.getByText(/Đã check-in lịch hẹn LH-E2E-001/)).toBeVisible()
})

test('receptionist reviews the doctor-approved billing preview before collecting cash', async ({ page }) => {
  let invoiceCreated = false
  const pendingCase = {
    id: 'queue-1', source: 'offline', ten_benh_nhan: 'E2E Cashier Patient', so_dien_thoai: '0907770000', specialty_id: 'specialty-tnh', invoice: null, pending_payment: null, payments: [],
    billing_summary: {
      tong_tien_kham: 200000, chi_tiet_thu_phi: [
        { loai: 'phi_kham', ten: 'Phí khám', so_tien: 200000, so_luong: 1, thanh_tien: 200000 },
        { loai: 'dich_vu', service_id: 'service-1', ten: 'Nội soi tai mũi họng', so_tien: 150000, so_luong: 1, thanh_tien: 150000 },
      ], tong_tien_phat_sinh: 150000, tong_thanh_toan: 350000, tong_da_thu: 0, con_phai_thu: 350000, trang_thai_hoa_don: 'chua_thanh_toan', source: 'medical_record',
    },
    dich_vu_chi_dinh: [{ service_id: 'service-1', ten: 'Nội soi tai mũi họng', so_luong: 1, thanh_tien: 150000 }],
  }
  const paidCase = {
    ...pendingCase,
    invoice: { id: 'invoice-1', hang_doi_id: 'queue-1', ho_so_benh_nhan_id: 'profile-a', so_hoa_don: 'HD-E2E', tong_tien_kham: 200000, chi_tiet_thu_phi: pendingCase.billing_summary.chi_tiet_thu_phi, tong_tien_phat_sinh: 150000, tong_thanh_toan: 350000, tong_da_thu: 350000, con_phai_thu: 0, trang_thai_hoa_don: 'da_thanh_toan_du' },
    payments: [{ id: 'payment-1', so_tien: 350000, phuong_thuc: 'tien_mat', status: 'paid', ma_giao_dich: 'TXN-E2E-1', ngay_tao: '2026-07-28T08:00:00.000Z', ngay_thanh_toan: '2026-07-28T08:02:00.000Z' }],
    billing_summary: { ...pendingCase.billing_summary, tong_da_thu: 350000, con_phai_thu: 0, trang_thai_hoa_don: 'da_thanh_toan_du', source: 'invoice' },
  }
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/receptionist/notifications/recent')) return route.fulfill({ json: { success: true, data: [] } })
    if (url.pathname.endsWith('/receptionist/payments/cases') && request.method() === 'GET') {
      const currentView = url.searchParams.get('view')
      return route.fulfill({ json: { success: true, data: currentView === 'paid' ? (invoiceCreated ? [paidCase] : []) : (invoiceCreated ? [] : [pendingCase]) } })
    }
    if (url.pathname.endsWith('/receptionist/payments/cases/queue-1') && request.method() === 'GET') {
      return route.fulfill({ json: { success: true, data: invoiceCreated ? paidCase : pendingCase } })
    }
    if (url.pathname.endsWith('/receptionist/payments/cases/queue-1/invoice') && request.method() === 'POST') {
      invoiceCreated = true
      return route.fulfill({ status: 201, json: { success: true, data: paidCase } })
    }
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.addInitScript(() => sessionStorage.setItem('user', JSON.stringify({ id: 'receptionist-1', email: 'receptionist@example.test', ho_ten: 'Le tan E2E', role: 'receptionist', status: 'active' })))
  await page.addInitScript(() => sessionStorage.setItem('token', 'browser-e2e-token'))
  await page.goto('/receptionist/payments')
  await page.getByRole('button').filter({ hasText: 'E2E Cashier Patient' }).click()
  await expect(page.getByText(/số tiền xem trước từ hồ sơ bệnh án/i)).toBeVisible()
  await expect(page.getByText('Nội soi tai mũi họng')).toBeVisible()
  await page.getByRole('button', { name: /Xác nhận thu tiền mặt 350.000 đ/ }).click()
  await expect(page.getByText(/Đã ghi nhận thu tiền mặt/i)).toBeVisible()
  await page.getByRole('tab', { name: 'Đã thanh toán' }).click()
  await expect(page.getByText('HD-E2E')).toBeVisible()
})

test('receptionist can confirm a pending transfer and review it in payment history', async ({ page }) => {
  const invoice = {
    id: 'invoice-2',
    hang_doi_id: 'queue-2',
    ho_so_benh_nhan_id: 'profile-b',
    so_hoa_don: 'HD-E2E-2',
    tong_tien_kham: 200000,
    chi_tiet_thu_phi: [],
    tong_tien_phat_sinh: 0,
    tong_thanh_toan: 200000,
    tong_da_thu: 0,
    con_phai_thu: 200000,
    trang_thai_hoa_don: 'chua_thanh_toan',
  }
  const pendingPayment = { id: 'payment-2', hoa_don_id: 'invoice-2', hang_doi_id: 'queue-2', so_tien: 200000, phuong_thuc: 'chuyen_khoan', status: 'pending', ma_giao_dich: 'TXN-E2E-2', ngay_tao: '2026-07-28T08:00:00.000Z' }
  let transferConfirmed = false
  const pendingCase = {
    id: 'queue-2', source: 'offline', ten_benh_nhan: 'E2E Transfer Patient', so_dien_thoai: '0907770001', specialty_id: 'specialty-tnh', invoice, pending_payment: pendingPayment, payments: [pendingPayment],
    billing_summary: { tong_tien_kham: 200000, chi_tiet_thu_phi: [{ loai: 'phi_kham', ten: 'Phí khám', so_tien: 200000, so_luong: 1, thanh_tien: 200000 }], tong_tien_phat_sinh: 0, tong_thanh_toan: 200000, tong_da_thu: 0, con_phai_thu: 200000, trang_thai_hoa_don: 'chua_thanh_toan', source: 'invoice' },
    dich_vu_chi_dinh: [],
  }
  const paidCase = {
    ...pendingCase,
    invoice: { ...invoice, tong_da_thu: 200000, con_phai_thu: 0, trang_thai_hoa_don: 'da_thanh_toan_du' },
    pending_payment: null,
    payments: [{ ...pendingPayment, status: 'paid', ngay_thanh_toan: '2026-07-28T08:03:00.000Z' }],
    billing_summary: { ...pendingCase.billing_summary, tong_da_thu: 200000, con_phai_thu: 0, trang_thai_hoa_don: 'da_thanh_toan_du' },
  }

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/receptionist/notifications/recent')) return route.fulfill({ json: { success: true, data: [] } })
    if (url.pathname.endsWith('/receptionist/payments/cases') && request.method() === 'GET') {
      const currentView = url.searchParams.get('view')
      return route.fulfill({ json: { success: true, data: currentView === 'paid' ? (transferConfirmed ? [paidCase] : []) : (transferConfirmed ? [] : [pendingCase]) } })
    }
    if (url.pathname.endsWith('/receptionist/payments/cases/queue-2') && request.method() === 'GET') {
      return route.fulfill({ json: { success: true, data: transferConfirmed ? paidCase : pendingCase } })
    }
    if (url.pathname.endsWith('/receptionist/payments/cases/queue-2/payments/payment-2/confirm') && request.method() === 'PATCH') {
      transferConfirmed = true
      return route.fulfill({ json: { success: true, data: paidCase } })
    }
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.addInitScript(() => sessionStorage.setItem('user', JSON.stringify({ id: 'receptionist-1', email: 'receptionist@example.test', ho_ten: 'Le tan E2E', role: 'receptionist', status: 'active' })))
  await page.addInitScript(() => sessionStorage.setItem('token', 'browser-e2e-token'))
  await page.goto('/receptionist/payments')
  await page.getByRole('button').filter({ hasText: 'E2E Transfer Patient' }).click()
  await expect(page.getByText('Chờ xác nhận chuyển khoản')).toBeVisible()
  await page.getByRole('button', { name: 'Xác nhận đã nhận tiền' }).click()
  await expect(page.getByText(/Đã xác nhận tiền chuyển khoản/i)).toBeVisible()
  await expect(page.getByText('Tiền mặt')).not.toBeVisible()
  await expect(page.getByText(/Chuyển khoản · Đã thanh toán/)).toBeVisible()
})

test('doctor can open and save an offline examination result', async ({ page }) => {
  let resultCreated = false
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/doctor/room-status')) return route.fulfill({ json: { success: true, data: { trang_thai: 'san_sang', phong_kham: 'TMH 01', benh_nhan_hien_tai_id: null, thoi_gian_kham_tb_phut: 15 } } })
    if (url.pathname.endsWith('/doctor/queue/pending-checkin')) return route.fulfill({ json: { success: true, data: [] } })
    if (url.pathname.endsWith('/doctor/queue')) return route.fulfill({ json: { success: true, data: [{ id: 'queue-1', appointment_id: null, ho_so_benh_nhan_id: 'profile-a', nguon: 'offline', ten_benh_nhan: 'E2E Doctor Patient', tuoi: 8, gioi_tinh: 'nam', phong_kham: 'TMH 01', muc_uu_tien: 'offline', hang_doi_trang_thai: 'hoan_thanh', checkin_time: '2026-07-28T08:00:00.000Z', ket_qua_id: resultCreated ? 'result-1' : null, ket_qua_status: resultCreated ? 'da_xac_nhan' : null, trang_thai_tong_hop: resultCreated ? 'da_xong' : 'cho_nhap_ho_so' }] } })
    if (url.pathname.endsWith('/doctor/appointments/records/queue-1/result') && request.method() === 'GET') return route.fulfill({ status: 404, json: { success: false, message: 'Chua co ket qua' } })
    if (url.pathname.endsWith('/doctor/appointments/records/queue-1/result') && request.method() === 'POST') {
      resultCreated = true
      return route.fulfill({ status: 201, json: { success: true, data: { id: 'result-1', hang_doi_id: 'queue-1', chan_doan: 'Viem mui hong cap', status: 'da_xac_nhan', thuoc: [] } } })
    }
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.addInitScript(() => sessionStorage.setItem('user', JSON.stringify({ id: 'doctor-1', email: 'doctor@example.test', ho_ten: 'Bac si E2E', role: 'doctor', status: 'active' })))
  await page.addInitScript(() => sessionStorage.setItem('token', 'browser-e2e-token'))
  await page.goto('/doctor/pending-records')
  await page.getByRole('button', { name: 'Nhập hồ sơ' }).click()
  await page.locator('textarea').first().fill('Viem mui hong cap')
  await page.getByRole('button', { name: 'Lưu kết quả' }).click()
  await expect(page.getByRole('table').getByText('Đã xong')).toBeVisible()
})
