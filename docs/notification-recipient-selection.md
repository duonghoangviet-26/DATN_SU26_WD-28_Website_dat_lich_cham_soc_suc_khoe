# Notification Recipient Selection

Admin can send notification email by role or by selected people.

## Supported Groups

- All active doctors
- All active nurses
- Selected doctors
- Selected nurses
- Receptionists and patients when the backend exposes matching accounts

## Expected Behavior

1. The UI loads available recipients from user data.
2. Admin chooses a target group.
3. Admin may select individual doctors or nurses when a specific group is selected.
4. Backend validates selected ids before sending email.
5. The saved notification history stores the channel and recipient count.

## Empty Data

Doctor and nurse modules may still be incomplete during development. If the list is empty, test the backend with known seeded users first, then retest once those modules are finished.
