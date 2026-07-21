# Notification Email Restart Checklist

Use this checklist after changing notification email code or Gmail credentials.

## Backend

1. Stop the running backend process.
2. Confirm `backend/.env` contains `EMAIL_USER` and `EMAIL_PASS`.
3. Start backend again from the `backend` folder.
4. Call `GET /api/health` and expect a successful response.

## Frontend

1. Restart the Vite dev server if UI code changed.
2. Hard refresh `/login` and `/admin/notifications`.
3. Open the send tab and confirm the old "waiting for backend" alert no longer appears.

## Smoke Test

1. Send one email notification to a single recipient.
2. Confirm API returns `201`.
3. Confirm `so_nguoi_nhan` equals the selected recipient count.
4. Ask the recipient to check Inbox and Spam.
