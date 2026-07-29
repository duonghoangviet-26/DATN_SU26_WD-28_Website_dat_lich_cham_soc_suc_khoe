import { expect, test } from 'playwright/test'

test('shows the booked examination details after a successful VNPAY return', async ({ page }) => {
  let detailRequested = false

  await page.route('**/api/patient/records/appointment-payment-success', async (route) => {
    detailRequested = true
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'appointment-payment-success',
          loai_kham: 'clinic',
          ngay_kham: '2026-07-30T00:00:00.000Z',
          gio_kham: '19:30',
          ten_dich_vu: 'Tai Mũi Họng',
          phong_kham: 'Phòng 101, Tầng 1',
          status: 'confirmed',
          payment_status: 'paid',
          gia_kham: 200000,
          ten_khach: 'Nguyễn Thị Hạnh',
          so_dien_thoai_khach: '0909000097',
          bac_si: { ho_ten: 'BS. Lê Quốc Bảo', anh_dai_dien: null },
          ket_qua: null,
        },
      }),
    })
  })

  await page.addInitScript(() => {
    localStorage.setItem('token', 'browser-e2e-token')
    localStorage.setItem('user', JSON.stringify({
      id: 'patient-1',
      role: 'user',
      ho_ten: 'Nguyễn Thị Hạnh',
      so_dien_thoai: '0909000097',
    }))
  })

  await page.goto('/payment/vnpay-result?payment_status=success&appointment_id=appointment-payment-success&payment_id=payment-success')

  await expect(page.getByRole('heading', { name: 'Thanh toán thành công' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Tai Mũi Họng' })).toBeVisible()
  await expect(page.getByText('19:30', { exact: true })).toBeVisible()
  await expect(page.getByText('BS. Lê Quốc Bảo', { exact: true })).toBeVisible()
  await expect(page.getByText('Phòng 101, Tầng 1', { exact: true })).toBeVisible()
  await expect(page.getByText('200.000đ', { exact: true })).toBeVisible()
  await expect(page.getByText('payment-success', { exact: true })).toBeVisible()
  await expect.poll(() => detailRequested).toBe(true)
})
