import dotenv from 'dotenv'

import { sendMail } from '../services/mail.service.js'

dotenv.config()

const to = process.argv[2]
const subject = process.argv[3] || `[VitaFamily] Test email ${new Date().toISOString()}`

if (!to) {
  console.error('Usage: node src/scripts/test-mail.js <recipient-email> [subject]')
  process.exit(1)
}

try {
  const info = await sendMail({
    to,
    subject,
    text: 'Day la email test gui that tu he thong VitaFamily bang Nodemailer Gmail.',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>VitaFamily - Test email</h2>
        <p>Day la email test gui that tu he thong VitaFamily bang Nodemailer Gmail.</p>
        <p>Thoi gian gui: ${new Date().toISOString()}</p>
      </div>
    `,
  })

  console.log(JSON.stringify({
    success: true,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  }, null, 2))
} catch (error) {
  console.error(JSON.stringify({
    success: false,
    message: error.message,
    code: error.code,
    command: error.command,
    response: error.response,
  }, null, 2))
  process.exit(1)
}
