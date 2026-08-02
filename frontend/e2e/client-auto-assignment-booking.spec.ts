import { expect, test } from 'playwright/test'

const PATIENT_EMAIL = 'patient.test@vitafamily.local'
const PATIENT_PASSWORD = 'Test123456'

test('patient books a specialty time slot without choosing a doctor', async ({ page }) => {
  test.setTimeout(60_000)

  let submittedPayload: Record<string, unknown> | null = null

  // The page still reads the actual APIs for authentication, specialties and
  // availability. Only the final write is mocked to avoid creating an
  // appointment, invoice or payment in the shared demo database.
  await page.route('**/api/patient/booking', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }

    submittedPayload = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'browser-e2e-appointment',
          appointment_id: 'browser-e2e-appointment',
          invoice_id: 'browser-e2e-invoice',
          payment_id: 'browser-e2e-payment',
          so_hoa_don: 'HD-BROWSER-E2E',
          ma_giao_dich: 'TXN-BROWSER-E2E',
          status: 'pending',
          payment_status: 'unpaid',
          payment_record_status: 'pending',
          invoice_status: 'chua_thanh_toan',
          gia_kham: 200000,
          ten_dich_vu: 'Khám chuyên khoa',
          ngay_kham: '2026-07-29',
          gio_kham: '14:00',
        },
      }),
    })
  })

  await page.route('**/api/patient/payments/browser-e2e-payment/vnpay-session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          payment_id: 'browser-e2e-payment',
          appointment_id: 'browser-e2e-appointment',
          hoa_don_id: 'browser-e2e-invoice',
          ma_giao_dich: 'TXN-BROWSER-E2E',
          so_tien: 200000,
          payment_status: 'pending',
          appointment_status: 'pending',
          appointment_payment_status: 'unpaid',
          invoice_status: 'chua_thanh_toan',
          ngay_thanh_toan: null,
          phuong_thuc: 'chuyen_khoan',
          gateway: {
            provider: 'vnpay',
            mode: 'mock',
            payment_url: null,
            qr_payload: 'VNPAY|BROWSER-E2E',
            expires_at: '2030-01-01T00:00:00.000Z',
            vnp_txn_ref: 'TXN-BROWSER-E2E',
            bank_code: 'VNBANK',
            locale: 'vn',
            merchant_name: 'ViteFamily',
            merchant_code: 'VITEFAMILY',
            note: null,
            mock_status: 'waiting_for_customer',
            is_expired: false,
          },
        },
      }),
    })
  })

  await page.goto('/login')
  await page.locator('input[type="email"]').fill(PATIENT_EMAIL)
  await page.locator('input[type="password"]').fill(PATIENT_PASSWORD)
  await page.locator('form button[type="submit"]').click()
  await expect(page).not.toHaveURL(/\/login/)

  await page.goto('/booking')
  const specialtyButtons = page.locator('button.rounded-full')
  await expect(specialtyButtons.nth(1)).toBeVisible({ timeout: 20_000 })
  await specialtyButtons.nth(1).click()
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  const availableSlot = page.getByRole('button', { name: /còn\s+\d+\s+chỗ/i }).first()
  await expect(availableSlot).toBeVisible({ timeout: 20_000 })
  await availableSlot.click()
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  const contactPhone = page.locator('main input:not([type="checkbox"])').first()
  await expect(contactPhone).toBeVisible()
  await contactPhone.fill('0901234567')
  await page.locator('textarea').fill('Đau họng và nghẹt mũi kéo dài ba ngày.')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()

  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Xác nhận đặt lịch khám' }).click()

  await expect.poll(() => submittedPayload).not.toBeNull()
  expect(submittedPayload).toMatchObject({
    loai_kham: 'clinic',
    specialty_id: expect.any(String),
    gio_bat_dau: expect.stringMatching(/^\d{2}:\d{2}$/),
    ngay_kham: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    dong_y_dieu_khoan: true,
  })
  expect(submittedPayload).not.toHaveProperty('doctor_id')
  expect(submittedPayload).not.toHaveProperty('schedule_id')
  expect(submittedPayload).not.toHaveProperty('slot_id')

  await expect(page.getByText('HD-BROWSER-E2E')).toBeVisible()
})
