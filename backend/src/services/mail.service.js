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
        Email nay duoc gui tu he thong VitaFamily.
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
  const fromName = process.env.SMTP_FROM_NAME || 'VitaFamily'
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
