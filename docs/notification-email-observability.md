# Notification Email Observability

Email delivery should leave enough traces for debugging without exposing secrets.

## Logs To Check

- Backend startup confirms environment loading.
- Send attempts include recipient count.
- Failures include provider error code.
- Logs do not include `EMAIL_PASS`.

## Admin Signals

- UI success state after API response.
- History row with email channel.
- Recipient count shown in history.

Add structured delivery records later if production requires audit-level tracking.
