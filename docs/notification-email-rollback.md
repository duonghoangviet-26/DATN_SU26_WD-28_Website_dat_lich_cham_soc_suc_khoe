# Notification Email Rollback

If email delivery causes problems, roll back to website-only notifications.

## UI Rollback

Use the website notification mode and avoid the email mode until backend credentials are fixed.

## Backend Rollback

1. Remove or disable Gmail credentials in local `.env`.
2. Restart backend.
3. Confirm website notifications still save successfully.

## Git Rollback

Use a normal revert commit for code changes. Do not reset shared history after pushing to `lichhen`.
