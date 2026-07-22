# Notification Email Environment Template

Backend email delivery expects these variables in `backend/.env`.

```env
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASS=your-google-app-password
```

## Notes

- App Password values normally contain spaces when copied from Google.
- Keep the value exactly as generated unless the backend explicitly normalizes it.
- Restart the backend after changing either variable.
- Never commit real values.
