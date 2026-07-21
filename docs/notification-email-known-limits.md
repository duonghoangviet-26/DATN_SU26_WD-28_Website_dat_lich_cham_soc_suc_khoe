# Notification Email Known Limits

The current Gmail-based implementation is suitable for development and small internal tests.

## Limits

- Gmail has sending limits.
- There is no retry queue yet.
- Delivery confirmation depends on the mail provider.
- Invalid recipient emails are skipped or fail at send time.
- Doctor and nurse coverage depends on seeded account data.

## Production Direction

For production, consider a transactional email provider, retry tracking, bounce handling, and an admin delivery status view.
