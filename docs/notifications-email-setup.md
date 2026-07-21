# Notification Email Setup

## Purpose

Admin notifications can be delivered through two channels:

- In-app notification: stored in MongoDB and shown in the application.
- Email notification: stored in MongoDB and sent through Gmail SMTP with Nodemailer.

## Environment

Backend reads Gmail credentials from `backend/.env`:

```env
EMAIL_USER=<gmail-account>
EMAIL_PASS=<gmail-app-password>
```

`EMAIL_PASS` must be a Google App Password, not the normal Gmail login password.
The Gmail account must have 2-Step Verification enabled before Google allows
App Password creation.

## Files

- `backend/src/services/mail.service.js`: creates the Gmail transporter and sends mail.
- `backend/src/services/notification.service.js`: creates system notifications and triggers email delivery when `kenh_gui=email`.
- `backend/src/scripts/test-mail.js`: standalone SMTP smoke test.

## Smoke Test

Run from `backend`:

```bash
node src/scripts/test-mail.js recipient@example.com
```

Expected success shape:

```json
{
  "success": true,
  "accepted": ["recipient@example.com"],
  "rejected": []
}
```

If Gmail returns `EAUTH 535`, the sender credentials are invalid or the password
is not a valid App Password.
