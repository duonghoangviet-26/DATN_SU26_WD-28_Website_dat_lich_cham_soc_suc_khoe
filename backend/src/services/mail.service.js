import nodemailer from 'nodemailer'

let transporter = null

function getMailConfig() {
  const user = process.env.SMTP_USER || process.env.EMAIL_USER
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '587', 10)

  if (!user || !pass) {
    throw new Error('Thieu EMAIL_USER/SMTP_USER hoac EMAIL_PASS/SMTP_PASS de gui email')
  }

  return { user, pass, host, port }
}

function getTransporter() {
  if (!transporter) {
    const { user, pass, host, port } = getMailConfig()
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
  }

  return transporter
}

export function isMailConfigured() {
  return Boolean((process.env.EMAIL_USER && process.env.EMAIL_PASS) || (process.env.SMTP_USER && process.env.SMTP_PASS))
}

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function renderNotificationEmail({ title, content, url = null }) {
  const safeTitle = escapeHtml(title)
  const safeContent = escapeHtml(content).replace(/\r?\n/g, '<br />')
  const safeUrl = url ? escapeHtml(url) : null

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
      <h2 style="margin: 0 0 16px; color: #0f172a;">${safeTitle}</h2>
      <div style="font-size: 14px;">${safeContent}</div>
      ${safeUrl ? `<p style="margin-top: 20px;"><a href="${safeUrl}" style="color: #2563eb;">Xem chi tiet</a></p>` : ''}
      <p style="margin-top: 24px; font-size: 12px; color: #64748b;">
        Email nay duoc gui tu he thong ViteFamily.
      </p>
    </div>
  `
}

export function renderResetPasswordEmail({ token }) {
  const resetUrl = `http://localhost:5173/reset-password?token=${token}`
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; padding: 24px; border-radius: 12px;">
      <h2 style="margin: 0 0 16px; color: #0f172a; text-align: center;">Đặt lại mật khẩu</h2>
      <p>Xin chào,</p>
      <p>Bạn nhận được email này vì hệ thống của chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại Phòng khám ViteFamily.</p>
      <p>Vui lòng click vào nút bên dưới để tiến hành thiết lập mật khẩu mới (Liên kết này có hiệu lực trong vòng 15 phút):</p>
      <p style="margin: 24px 0; text-align: center;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
          Đặt lại mật khẩu
        </a>
      </p>
      <p>Hoặc sao chép và dán đường dẫn dưới đây vào trình duyệt của bạn:</p>
      <p style="word-break: break-all; color: #2563eb; font-size: 13px;">${resetUrl}</p>
      <p style="font-size: 12px; color: #64748b; margin-top: 24px;">
        Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này. Mật khẩu của bạn vẫn được giữ an toàn.
      </p>
      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="font-size: 12px; color: #9ca3af; text-align: center;">
        Email này được gửi tự động từ hệ thống Phòng khám ViteFamily.
      </p>
    </div>
  `
}

export async function sendMail({ to, subject, text, html }) {
  if (!to || !subject || (!text && !html)) {
    throw new Error('Thieu thong tin bat buoc khi gui email')
  }

  const { user } = getMailConfig()
  const fromName = process.env.SMTP_FROM_NAME || 'ViteFamily'
  const info = await getTransporter().sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject,
    text,
    html,
  })

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  }
}

export async function sendNotificationEmail({ to, title, content, url = null }) {
  return sendMail({
    to,
    subject: title,
    text: `${title}\n\n${content}${url ? `\n\n${url}` : ''}`,
    html: renderNotificationEmail({ title, content, url }),
  })
}

export async function sendResetPasswordEmail({ to, token }) {
  const resetUrl = `http://localhost:5173/reset-password?token=${token}`
  return sendMail({
    to,
    subject: '[ViteFamily] Đặt lại mật khẩu tài khoản của bạn',
    text: `Bạn nhận được email này vì có yêu cầu đặt lại mật khẩu cho tài khoản. Vui lòng truy cập đường dẫn sau để đặt lại mật khẩu: ${resetUrl}`,
    html: renderResetPasswordEmail({ token })
  })
}

export function renderBookingSuccessEmail({
  ma_lich_hen,
  ten_benh_nhan,
  so_dien_thoai,
  ten_bac_si,
  chuyen_khoa,
  ngay_kham,
  gio_kham,
  phong_kham,
  dia_chi,
  tong_tien,
  loai_kham,
}) {
  const safeMaLich = escapeHtml(ma_lich_hen)
  const safeTenBn = escapeHtml(ten_benh_nhan)
  const safeSdt = escapeHtml(so_dien_thoai || 'Chưa cung cấp')
  const safeTenBs = escapeHtml(ten_bac_si || 'Bác sĩ chuyên khoa')
  const safeChuyenKhoa = escapeHtml(chuyen_khoa || 'Đa khoa')
  const safeNgayKham = escapeHtml(ngay_kham)
  const safeGioKham = escapeHtml(gio_kham)
  const safePhongKham = escapeHtml(phong_kham || 'Phòng khám ViteFamily')
  const safeDiaChi = escapeHtml(dia_chi || 'Phòng 101, Tầng 1, Tòa nhà ViteFamily')
  const safeTongTien = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(tong_tien || 0)

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #2563eb; margin: 0; font-size: 24px;">🏥 ViteFamily Health</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Xác nhận đặt lịch khám thành công</p>
      </div>

      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <span style="color: #166534; font-size: 16px; font-weight: bold;">✅ THANH TOÁN THÀNH CÔNG</span>
        <p style="margin: 4px 0 0; color: #15803d; font-size: 13px;">Cảm ơn bạn đã tin tưởng dịch vụ chăm sóc sức khỏe của ViteFamily!</p>
      </div>

      <h3 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">Thông tin lịch khám</h3>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; width: 40%;">Mã lịch hẹn:</td>
          <td style="padding: 8px 0; font-weight: bold; color: #2563eb;">${safeMaLich}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Họ và tên bệnh nhân:</td>
          <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${safeTenBn}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Số điện thoại:</td>
          <td style="padding: 8px 0; color: #0f172a;">${safeSdt}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Bác sĩ phụ trách:</td>
          <td style="padding: 8px 0; font-weight: bold; color: #0f172a;">${safeTenBs} (${safeChuyenKhoa})</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Thời gian khám:</td>
          <td style="padding: 8px 0; font-weight: bold; color: #2563eb;">${safeGioKham} - Ngày ${safeNgayKham}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Địa điểm khám:</td>
          <td style="padding: 8px 0; color: #0f172a;">${safePhongKham} (${safeDiaChi})</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Hình thức khám:</td>
          <td style="padding: 8px 0; color: #0f172a;">${loai_kham === 'clinic' ? 'Tại phòng khám' : 'Khám tại nhà'}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b;">Số tiền đã thanh toán:</td>
          <td style="padding: 8px 0; font-weight: bold; color: #16a34a; font-size: 16px;">${safeTongTien}</td>
        </tr>
      </table>

      <div style="background-color: #f8fafc; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #64748b; margin-bottom: 24px;">
        📌 <strong>Lưu ý:</strong> Vui lòng có mặt tại phòng khám trước 15 phút so với giờ hẹn và mang theo giấy tờ tùy thân để làm thủ tục khám nhanh chóng.
      </div>

      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
        Email này được gửi tự động từ Hệ thống Đặt lịch Chăm sóc Sức khỏe ViteFamily.
      </p>
    </div>
  `
}

export async function sendBookingSuccessEmail({ to, bookingData }) {
  if (!to) return null
  return sendMail({
    to,
    subject: `[ViteFamily] Xác nhận lịch khám thành công - Mã LH: ${bookingData.ma_lich_hen}`,
    text: `Lịch khám ${bookingData.ma_lich_hen} của bạn đã được thanh toán thành công. Thời gian: ${bookingData.gio_kham} ngày ${bookingData.ngay_kham}.`,
    html: renderBookingSuccessEmail(bookingData),
  })
}

