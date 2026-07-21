# Notification Email Validation Rules

Email notifications should be validated before sending.

## Required Fields

- Subject
- Body
- Send channel
- Target audience or selected recipients

## Recipient Rules

- Selected recipient ids must exist.
- Role-based recipients must match the selected role.
- Users without email cannot receive email.
- Empty recipient sets should return a clear error.

## Safety

Backend validation is the source of truth. Frontend validation only improves user experience.
