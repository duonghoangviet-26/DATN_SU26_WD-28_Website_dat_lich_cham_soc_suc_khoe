# Admin ID Audit

## Scope

This audit only covers the 7 in-scope admin domains:

- clinics
- specialties
- services
- appointments
- payments
- reviews
- notifications

Excluded domains such as `admin/doctors` and `admin/users` are intentionally not part of this audit file.

## Result

No in-scope backend controller currently trusts `admin_id` from `req.body`.

## Files Reviewed

- `backend/src/controllers/admin/clinic-info.controller.js`
- `backend/src/controllers/admin/specialties.controller.js`
- `backend/src/controllers/admin/services.controller.js`
- `backend/src/controllers/admin/appointment.controller.js`
- `backend/src/controllers/admin/payments.controller.js`
- `backend/src/controllers/admin/review.controller.js`
- `backend/src/controllers/notification.controller.js`

## Findings

### Safe usage already based on authenticated user

- `clinic-info.controller.js` writes audit data with `req.user?.id`
- `appointment.controller.js` writes history and refund actions with `req.user.id`
- `payments.controller.js` writes refund processor data with `req.user.id`
- `review.controller.js` passes `req.user.id` to review service methods
- `notification.controller.js` does not accept or forward `admin_id` from request body

### No in-scope changes needed for backend at this phase

- There is no controller in the audited scope that currently reads `admin_id` from client body input.

## Out of Scope But Still Important

- `backend/src/controllers/doctor.controller.js` still accepts `admin_id` from request body.
- `frontend/src/pages/admin/ManageDoctor/*` still hardcodes `CURRENT_ADMIN_ID`.
- `frontend/src/pages/admin/ManageNotifications/SendNotificationTab.tsx` used to send `admin_id`; that client-side hardcode has been removed in the current refactor pass.
