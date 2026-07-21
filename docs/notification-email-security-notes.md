# Notification Email Security Notes

Email credentials must stay in environment files only.

## Rules

- Do not commit `.env`.
- Use Google App Password, not the normal Gmail password.
- Rotate the App Password if it was shared in chat, screenshots, or logs.
- Keep backend logs free from credential values.
- Treat email test accounts as real recipients.

## Recommended Rotation

Create a new Google App Password before final deployment, update `backend/.env`, restart the backend, and run one smoke test.
