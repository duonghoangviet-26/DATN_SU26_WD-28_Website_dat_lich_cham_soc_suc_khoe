# Notification Email Operator Runbook

Use this runbook for manual admin testing.

## Send One Email

1. Start backend and frontend.
2. Log in as admin.
3. Open `/admin/notifications`.
4. Choose `Gui qua Email`.
5. Select one recipient first.
6. Send and confirm the success toast.

## Send Group Email

After a single-recipient test passes, choose all doctors or all nurses and send the same message to the group.

## After Sending

Check notification history, backend logs, and the recipient mailbox.
