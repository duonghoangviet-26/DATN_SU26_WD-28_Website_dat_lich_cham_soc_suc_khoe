# Admin Routes Audit

## Scope

This audit only covers the 7 admin domains in scope for the refactor roadmap:

- `admin/clinics`
- `admin/specialties`
- `admin/services`
- `admin/appointments`
- `admin/payments`
- `admin/reviews`
- `admin/notifications`

Excluded domains such as `admin/doctors`, `admin/users`, `doctor`, `patient`, `nurse`, `receptionist` are intentionally not analyzed for refactor actions here.

## Current Effective Mounts

| Domain | Public path | Route file | Controller file(s) | Status |
| --- | --- | --- | --- | --- |
| Clinics | `/api/admin/clinics` | `backend/src/routes/admin/clinics.routes.js` | `backend/src/controllers/admin/clinic-info.controller.js` | canonical |
| Clinics | `/api/admin/clinic-info` | `backend/src/routes/admin/clinics.routes.js` | `backend/src/controllers/admin/clinic-info.controller.js` | legacy compatibility mount |
| Specialties | `/api/admin/specialties` | `backend/src/routes/admin/specialties.routes.js` | `backend/src/controllers/admin/specialties.controller.js`, `backend/src/controllers/admin/clinic-info.controller.js` | canonical + compatibility handlers |
| Specialties | `/api/admin/clinic` | `backend/src/routes/admin/specialties.routes.js` | `backend/src/controllers/admin/specialties.controller.js` | legacy compatibility mount |
| Specialties | `/api/admin/clinic-info/:id/specialties` and related nested endpoints | `backend/src/routes/admin/specialties.routes.js` | `backend/src/controllers/admin/clinic-info.controller.js` | legacy compatibility mount |
| Services | `/api/admin/services` | `backend/src/routes/admin/services.routes.js` | `backend/src/controllers/admin/services.controller.js` | mounted through `backend/src/routes/admin/index.js` |
| Appointments | `/api/admin/appointments` | `backend/src/routes/admin/appointment.routes.js` | `backend/src/controllers/admin/appointment.controller.js` | canonical |
| Payments | `/api/admin/payments` | `backend/src/routes/admin/payments.routes.js` | `backend/src/controllers/admin/payments.controller.js` | canonical |
| Reviews | `/api/admin/reviews` | `backend/src/routes/admin/review.routes.js` | `backend/src/controllers/admin/review.controller.js` | canonical |
| Notifications | `/api/admin/notifications` | `backend/src/routes/admin/notifications.routes.js` | `backend/src/controllers/notification.controller.js` | canonical path, controller still outside `controllers/admin` |

## Legacy/Overlap Findings

### Resolved in current cleanup

- `backend/src/routes/admin/clinic.routes.js` was a duplicate specialty-oriented route file and has been removed.
- `backend/src/routes/admin/clinic-info.routes.js` was replaced by `backend/src/routes/admin/clinics.routes.js`.
- `backend/src/routes/notification.routes.js` was moved to `backend/src/routes/admin/notifications.routes.js`.
- `backend/src/controllers/admin/appointments.controller.js` was not mounted by `backend/src/routes/index.js` and has been removed.
- Dead code after `return` statements in `backend/src/controllers/admin/appointment.controller.js` was removed.

### Still intentionally preserved for compatibility

- `/api/admin/clinic/*` remains mounted temporarily as a legacy alias through `backend/src/routes/admin/specialties.routes.js`.
- `/api/admin/clinic-info/*` remains mounted temporarily for existing frontend code, split across:
  - `backend/src/routes/admin/clinics.routes.js` for clinic CRUD
  - `backend/src/routes/admin/specialties.routes.js` for nested specialty endpoints

## Route Inventory By File

### `backend/src/routes/admin/clinics.routes.js`

- `GET /`
- `POST /`
- `GET /:id`
- `GET /:id/logs`
- `PUT /:id`
- `DELETE /:id`

### `backend/src/routes/admin/specialties.routes.js`

- `GET /`
- `POST /`
- `GET /:id`
- `PUT /:id`
- `PATCH /:id/toggle`
- `GET /specialties`
- `POST /specialties`
- `PUT /specialties/:id`
- `PATCH /specialties/:id/toggle`
- `GET /:id/specialties`
- `POST /:id/specialties`
- `GET /specialties/:specialtyId/logs`
- `GET /specialties/:specialtyId/doctors`
- `PUT /specialties/:specialtyId`
- `PATCH /specialties/:specialtyId/toggle`
- `POST /specialties/:specialtyId/copy`

### `backend/src/routes/admin/services.routes.js`

- `GET /`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `PATCH /:id/toggle`

### `backend/src/routes/admin/appointment.routes.js`

- `GET /doctors/active`
- `GET /services/active`
- `GET /doctors/:id/schedules`
- `GET /`
- `POST /`
- `GET /:id`
- `GET /:id/history`
- `PATCH /:id/cancel`
- `PATCH /:id/reschedule`
- `PATCH /:id/restore`
- `DELETE /:id`

### `backend/src/routes/admin/payments.routes.js`

- `GET /`
- `POST /`
- `GET /:id`
- `PATCH /:id`
- `PATCH /:id/refund`

### `backend/src/routes/admin/review.routes.js`

- `GET /`
- `POST /batch`
- `GET /:id`
- `PATCH /:id/hide`
- `PATCH /:id/show`
- `PATCH /:id/delete`
- `PATCH /:id/restore`
- `DELETE /:id/permanently`

### `backend/src/routes/admin/notifications.routes.js`

- `GET /`
- `GET /received`
- `POST /`
- `PUT /:id`
- `DELETE /:id`
- `PUT /received/:id/read`
- `GET /:id/logs`

## Verification Notes

- Code-level mount verification is complete from `backend/src/routes/index.js` and the route files above.
- Runtime verification against a live server is still pending and should be completed after the next test pass:
  - unauthenticated request returns `401`
  - non-admin token returns `403`
  - previously used legacy endpoints do not return `404`
