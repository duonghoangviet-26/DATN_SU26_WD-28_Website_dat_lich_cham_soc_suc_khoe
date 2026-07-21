# Notification Email Test Matrix

Use this matrix when validating email notification delivery.

| Case | Target | Expected Result |
| --- | --- | --- |
| 1 | Single doctor | One doctor receives email |
| 2 | Single nurse | One nurse receives email |
| 3 | All doctors | Every active doctor with email receives email |
| 4 | All nurses | Every active nurse with email receives email |
| 5 | Patient | Selected patient receives email |
| 6 | Receptionist | Selected receptionist receives email |

## Pass Criteria

- API returns success.
- Notification is stored in history.
- Recipient count matches valid target emails.
- No browser alert says the backend is missing.
