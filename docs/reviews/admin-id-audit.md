# Admin ID Audit

## Scope

This audit covers only the 7 in-scope admin domains:

- clinics
- specialties
- services
- appointments
- payments
- reviews
- notifications

Out-of-scope domains such as `admin/doctors`, `admin/users`, nurse, receptionist, and patient flows are intentionally excluded.

## Audit Goal

Confirm that no in-scope admin flow trusts `admin_id` from client body input, and that the audit file itself does not miss any file participating in those 7 domains.

## Result

- No in-scope backend controller currently trusts `admin_id` from `req.body`.
- No in-scope frontend page or service currently sends `admin_id` or hardcoded `CURRENT_ADMIN_ID`.
- In-scope write actions derive operator identity from `req.user.id` on the backend.

## Coverage Matrix

### Backend routes reviewed

- `backend/src/routes/admin/clinics.routes.js`
- `backend/src/routes/admin/specialties.routes.js`
- `backend/src/routes/admin/services.routes.js`
- `backend/src/routes/admin/appointment.routes.js`
- `backend/src/routes/admin/payments.routes.js`
- `backend/src/routes/admin/invoices.routes.js`
- `backend/src/routes/admin/refunds.routes.js`
- `backend/src/routes/admin/review.routes.js`
- `backend/src/routes/admin/notifications.routes.js`

### Backend controllers reviewed

- `backend/src/controllers/admin/clinic-info.controller.js`
- `backend/src/controllers/admin/clinic.controller.js`
- `backend/src/controllers/admin/specialties.controller.js`
- `backend/src/controllers/admin/services.controller.js`
- `backend/src/controllers/admin/appointment.controller.js`
- `backend/src/controllers/admin/payments.controller.js`
- `backend/src/controllers/admin/invoices.controller.js`
- `backend/src/controllers/admin/refunds.controller.js`
- `backend/src/controllers/admin/review.controller.js`
- `backend/src/controllers/notification.controller.js`

### Frontend services reviewed

- `frontend/src/services/clinic.service.ts`
- `frontend/src/services/specialty.service.ts`
- `frontend/src/services/service.service.ts`
- `frontend/src/services/appointment.service.ts`
- `frontend/src/services/payment.service.ts`
- `frontend/src/services/review.service.ts`
- `frontend/src/services/notification.service.ts`

### Frontend pages reviewed

- `frontend/src/pages/admin/ManageClinics/ManageClinics.tsx`
- `frontend/src/pages/admin/ManageClinics/ClinicDetail.tsx`
- `frontend/src/pages/admin/ManageClinics/EditClinic.tsx`
- `frontend/src/pages/admin/ManageClinics/ClinicAuditLogModal.tsx`
- `frontend/src/pages/admin/ManageClinics/AddSpecialty.tsx`
- `frontend/src/pages/admin/ManageClinics/EditSpecialty.tsx`
- `frontend/src/pages/admin/ManageClinics/SpecialtyList.tsx`
- `frontend/src/pages/admin/ManageClinics/SpecialtyDoctorsModal.tsx`
- `frontend/src/pages/admin/ManageServices.tsx`
- `frontend/src/pages/admin/ManageServiceSpecialtyDetail.tsx`
- `frontend/src/pages/admin/ManageAppointments/ManageAppointments.tsx`
- `frontend/src/pages/admin/ManageAppointments/AppointmentList.tsx`
- `frontend/src/pages/admin/ManageAppointments/DoctorAppointmentGroupList.tsx`
- `frontend/src/pages/admin/ManageAppointments/AddAppointment.tsx`
- `frontend/src/pages/admin/ManageAppointments/AppointmentDetail.tsx`
- `frontend/src/pages/admin/ManageAppointments/AppointmentHistoryModal.tsx`
- `frontend/src/pages/admin/ManageAppointments/RescheduleAppointment.tsx`
- `frontend/src/pages/admin/ManagePayments.tsx`
- `frontend/src/pages/admin/ManageReviews.tsx`
- `frontend/src/pages/admin/ManageNotifications/ManageNotifications.tsx`
- `frontend/src/pages/admin/ManageNotifications/ReceiveNotificationTab.tsx`
- `frontend/src/pages/admin/ManageNotifications/SendNotificationTab.tsx`
- `frontend/src/pages/admin/ManageNotifications/UpdateNotification.tsx`

## Findings

### Safe backend identity sources

- `clinic-info.controller.js` writes audit metadata from `req.user?.id` and `req.user?.role`.
- `services.controller.js` writes creator and audit log identity from `req.user.id`.
- `appointment.controller.js` uses `req.user.id` for refund actions, appointment history, and reschedule history.
- `payments.controller.js` uses `req.user.id` for refund processor data.
- `refunds.controller.js` resolves operator identity from `req.user.id`.
- `review.controller.js` passes `req.user.id` into review service actions.
- `notification.controller.js` does not read or forward `admin_id` from request body.

### In-scope grep result

Checked the full in-scope file set above with:

```txt
rg -n "admin_id|CURRENT_ADMIN_ID" <all in-scope backend/frontend files>
```

Result: no matches in the 7 audited domains.

## Conclusion

No in-scope file currently trusts client-supplied `admin_id`, and this audit now covers the full file surface of the 7 scoped admin domains for Phase 3 Step 10.

## Out of Scope But Still Important

- `backend/src/controllers/doctor.controller.js` still accepts `admin_id` from request body.
- `frontend/src/pages/admin/ManageDoctor/*` still hardcodes `CURRENT_ADMIN_ID`.
- `frontend/src/services/doctor.service.ts` still sends `admin_id` for doctor moderation actions.
