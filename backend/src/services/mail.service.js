import nodemailer from 'nodemailer'

let transporter = null

function getMailConfig() {
  const user = process.env.EMAIL_USER
  const pass = process.env.EMAIL_PASS

  if (!user || !pass) {
    throw new Error('Thieu EMAIL_USER hoac EMAIL_PASS de gui email')
  }

  return { user, pass }
}

function getTransporter() {
  if (!transporter) {
    const { user, pass } = getMailConfig()
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    })
  }

  return transporter
}

export function isMailConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS)
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

export async function sendMail({ to, subject, text, html }) {
  if (!to || !subject || (!text && !html)) {
    throw new Error('Thieu thong tin bat buoc khi gui email')
  }

  const { user } = getMailConfig()
  const info = await getTransporter().sendMail({
    from: `"VitaFamily" <${user}>`,
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
