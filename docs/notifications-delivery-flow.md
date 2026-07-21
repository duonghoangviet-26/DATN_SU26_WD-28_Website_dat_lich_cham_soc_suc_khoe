# Notification Delivery Flow

## Admin Send Flow

1. Admin opens `/admin/notifications`.
2. Frontend calls `POST /api/admin/notifications`.
3. Backend creates one `thong_bao_he_thong` document as the send history record.
4. Backend creates child `thong_bao` documents for each recipient.
5. If `kenh_gui=email`, backend sends email through Gmail after the database write.

Email sending is not allowed to block the main notification flow. If SMTP fails,
the notification documents remain the source of truth and the error is logged.

## Targets

| UI target | Backend target | User roles |
| --- | --- | --- |
| Tat ca | `tat_ca` | `user`, `patient`, `doctor`, `receptionist`, `nurse` |
| Benh nhan | `benh_nhan` | `user`, `patient` |
| Bac si | `bac_si` | `doctor` |
| Le tan | `le_tan` | `receptionist` |
| Y ta | `y_ta` | `nurse` |

## Recipient Selection

For a specific target, admin can send to:

- all active users in that role group;
- selected users via `recipient_ids`.

The backend validates selected recipients by role, status, and soft-delete state.
If any selected recipient is invalid, the request fails instead of silently
sending to the wrong account.

## Channel Semantics

| `kenh_gui` | Behavior |
| --- | --- |
| `in_app` | Create in-app notifications only. |
| `email` | Create in-app notifications and send Gmail email. |

The stored child notification includes `kenh_gui` so later audits can identify
how the notification was sent.
