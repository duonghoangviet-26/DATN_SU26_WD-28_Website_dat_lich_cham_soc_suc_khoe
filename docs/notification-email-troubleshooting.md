# Notification Email Troubleshooting

## Gmail Authentication Fails

Check that `EMAIL_USER` is the Gmail account and `EMAIL_PASS` is a Google App Password. Restart the backend after changing either value.

## Email Is Not Received

1. Check Spam.
2. Confirm the recipient account has a valid email.
3. Check backend logs for `[notification-email]`.
4. Send a single-recipient test before sending to a group.

## UI Still Shows Old Alert

Restart Vite and hard refresh the browser. The old alert usually means the frontend bundle is stale or the send handler still points to mock behavior.

## Recipient Count Is Zero

Verify the selected role has users in the database and that those users have non-empty email values.
