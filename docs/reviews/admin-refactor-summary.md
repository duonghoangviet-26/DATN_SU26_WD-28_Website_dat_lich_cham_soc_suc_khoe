# Admin Refactor Summary

## Scope

This summary only covers the 7 admin domains that are explicitly in scope:

- clinics
- specialties
- services
- appointments
- payments
- reviews
- notifications

The following remain out of scope and are not part of the action plan below:

- `backend/src/routes/doctor.routes.js`
- `backend/src/controllers/doctor.controller.js`
- `frontend/src/pages/admin/ManageDoctor*`
- admin user-management domain
- nurse / receptionist domains

## Executive Assessment

The admin area is currently in a mixed state:

- backend route structure has been partially cleaned and is closer to the target layout
- model references for `ChiNhanh` were corrected to `ThongTinPhongKham`
- notification frontend auth wiring is now correct
- frontend admin structure still reflects the old "multi-branch hospital" design
- several frontend services still use mocks instead of real APIs
- there are still contract mismatches between model, controller, and UI in the clinics/specialties and appointments flows

The most important conclusion is this:

- the codebase has **not fully absorbed the business decision "only 1 clinic/facility exists"**
- because of that, the current admin clinics/specialties area still behaves like a branch-management module

## What Has Already Been Done

- route cleanup started:
  - `clinic.routes.js` removed
  - `clinic-info.routes.js` removed
  - `notification.routes.js` moved under `routes/admin/`
  - `appointments.controller.js` duplicate removed
- backend route mounts were consolidated in `backend/src/routes/index.js`
- dead code after `return` was removed from `backend/src/controllers/admin/appointment.controller.js`
- `ref: 'ChiNhanh'` was fixed to `ref: 'ThongTinPhongKham'` in:
  - `backend/src/models/BacSi.js`
  - `backend/src/models/LichHen.js`
  - `backend/src/models/HoaDon.js`
  - `backend/src/models/LichLamViec.js`
- `frontend/src/services/notification.service.ts` now uses `axiosInstance`
- notification UI no longer hardcodes `CURRENT_ADMIN_ID`
- audit documents were created:
  - `docs/reviews/admin-routes-audit.md`
  - `docs/reviews/admin-id-audit.md`

## Critical Findings

### 1. Single-clinic business rule is still not reflected in clinics UI/controller design

Current state:

- `backend/src/models/ThongTinPhongKham.js` describes clinic info
- `frontend/src/pages/admin/ManageHospitals/*` still manages a list of clinics/branches
- `frontend/src/services/hospital.service.ts` still exposes multi-clinic CRUD
- `backend/src/controllers/admin/clinic-info.controller.js` still supports:
  - list all clinics
  - create a new clinic
  - deactivate one clinic
  - restore one clinic
  - copy specialties across clinics

Why this is wrong:

- roadmap says there is only 1 facility
- therefore "branch list", "copy specialty to another clinic", "delete/restore a clinic", and nested "specialties by clinic" are all leftovers from the old design

What to remove:

- the "many clinics" mental model in admin UI
- copy-specialty-across-clinics flow
- create-many-clinics flow
- clinic selector / clinic list as the primary navigation pattern

What to keep:

- `ThongTinPhongKham` as the single source of truth
- audit log for clinic info
- update form for clinic info

What to add / change:

- replace clinic list UI with a singleton clinic settings page
- load the first and only `ThongTinPhongKham` document, or create/bootstrap one if missing
- rename module semantics from "Hospitals" / "Chi nhanh" to "Clinic settings" / "Thong tin phong kham"
- make specialty management live under the singleton clinic context implicitly, not by asking the user to pick a clinic

How to implement:

1. Keep backend route path `/admin/clinics`, but change behavior toward singleton semantics.
2. Add a controller helper that fetches the only clinic document.
3. If no clinic exists, create one default document or provide a setup flow.
4. Replace `ManageHospitals` with `ManageClinics` and render:
   - clinic info card/form
   - specialty list for the singleton clinic
   - audit log
5. Remove UI actions that imply multiple clinics:
   - "view specialties of clinic X"
   - "copy specialty to clinics"
   - "restore clinic"
   - clinic list table

### 2. `admin/specialties` canonical controller conflicts with the current model

Current state:

- `backend/src/models/ChuyenKhoa.js` requires `phong_kham_id`
- `backend/src/controllers/admin/specialties.controller.js` creates `ChuyenKhoa` without `phong_kham_id`
- `frontend/src/services/specialty.service.ts` is still mock-only
- current real frontend for specialty management still goes through legacy nested clinic routes

Why this is dangerous:

- if frontend switches to `/admin/specialties` now, create/update logic can break immediately
- the canonical route/controller is not yet aligned with the actual schema

What to remove:

- the assumption that specialties are fully independent from clinic context

What to keep:

- `backend/src/routes/admin/specialties.routes.js` as the long-term canonical route file

What to add / change:

- make `specialties.controller.js` aware of singleton clinic context
- on create, auto-assign `phong_kham_id` = singleton clinic id
- on list, filter by singleton clinic id
- on update/toggle/getById, ensure the record belongs to the singleton clinic

How to implement:

1. Add a shared helper `getSingletonClinicId()`.
2. Update `list`, `create`, `getById`, `update`, `toggle` in `specialties.controller.js`.
3. After canonical routes work with the model, migrate frontend specialty management from `hospitalService` nested endpoints to `specialty.service.ts`.
4. Only then remove legacy compatibility aliases under `/admin/clinic-info/...`.

### 3. Appointment create flow is still inconsistent after partial cleanup

Current state:

- roadmap requires:
  - `service_id` required only for `home`
  - `clinic` appointments must work without `service_id`
- controller was partially updated
- but `backend/src/controllers/admin/appointment.controller.js` still creates:
  - `service_id: service._id`
- when `loai_kham = 'clinic'`, `service` is `null`, so this will fail

There is a second mismatch:

- `frontend/src/pages/admin/ManageAppointments/AddAppointment.tsx` still forces:
  - doctor
  - service
  - schedule
  - slot
  for both `clinic` and `home`

There is a third mismatch:

- `backend/src/models/LichHen.js` says:
  - `home` requires `service_id` and `dia_chi_kham`
  - `clinic` requires `doctor_id`, `schedule_id`, `slot_id`
- that matches the roadmap better than the current admin form does

What to remove:

- the frontend rule "every appointment must choose a service"
- the backend line that dereferences `service._id` when `service` may be null

What to keep:

- appointment history logging
- refund sync on admin cancellation
- admin-only appointment routes

What to add / change:

- in controller:
  - set `service_id: service?._id ?? null`
  - keep `gia_kham` fallback logic
- in form:
  - `clinic`: require doctor + schedule + slot, hide service selector
  - `home`: require doctor + service + address, and decide whether schedule/slot are truly required by business

Important decision still needed in code:

- today the schema says `home` appointments do not keep `schedule_id/slot_id`
- but the admin form currently still fetches doctor schedules for home bookings
- choose one rule and apply it consistently:
  - either home booking uses schedule/slot
  - or home booking does not use schedule/slot

Recommended direction:

- if home visit still needs a doctor time slot, update the schema/hook to support it
- if not, remove schedule/slot from home form and controller requirements

### 4. Appointments list UI and backend pagination contract are not aligned

Current state:

- `frontend/src/pages/admin/ManageAppointments/ManageAppointments.tsx` always requests `view_mode=doctor_grouped`
- backend grouped response returns `data` and `summary`, but no guaranteed paginated contract
- frontend still has pagination state, but in grouped mode the behavior is inconsistent

What to remove:

- hidden dependency on a special grouped response shape without a formal contract

What to add / change:

- choose one of two directions:
  - keep grouped mode and define a proper paginated grouped response
  - or fetch flat paginated data and group on frontend

Recommended direction:

- keep backend pagination canonical and group on frontend only for presentation
- this reduces API complexity and prevents pagination drift

### 5. `specialty.service.ts`, `service.service.ts`, and `payment.service.ts` are still mock services

Current state:

- `frontend/src/services/specialty.service.ts` uses `mockSpecialties`
- `frontend/src/services/service.service.ts` uses `mockServices`
- `frontend/src/services/payment.service.ts` uses `mockPayments`

Impact:

- UI is not reflecting DB state
- admin actions can look "successful" while writing nowhere
- backend cleanup cannot be validated end-to-end from admin UI

What to remove:

- all mock-based CRUD logic in those 3 files

What to keep:

- current TypeScript shapes if they still match backend responses

What to add / change:

- replace each service with `axiosInstance` calls to real admin endpoints
- normalize response mapping in one place per service
- return backend-native statuses instead of inventing mock-only ones

Implementation order:

1. `specialty.service.ts`
2. `service.service.ts`
3. `payment.service.ts`

### 6. Payments frontend and backend likely have a status contract mismatch

Current state:

- frontend `PaymentStatus` in `frontend/src/types/index.ts` is:
  - `unpaid | paid | refunded`
- backend `ThanhToan.status` in `backend/src/models/ThanhToan.js` is:
  - `pending | paid | failed | refunded`

Why this matters:

- once frontend switches from mocks to API, status rendering/filtering can break

What to remove:

- the frontend-only payment status vocabulary

What to add / change:

- update frontend payment types, labels, filters, badges, and revenue calculations to use backend statuses
- decide whether UI wants to display:
  - raw payment status
  - invoice status
  - appointment payment status

Recommended direction:

- keep them separate in UI:
  - payment status from `ThanhToan`
  - invoice status from `HoaDon`
  - appointment payment status from `LichHen`

### 7. Dashboard is still sample-data only

Current state:

- `frontend/src/pages/admin/Dashboard.tsx` is hardcoded
- values are static sample numbers

What to remove:

- all hardcoded stats and fake activity items that pretend to be real admin data

What to add / change:

- create a real `admin/dashboard` endpoint
- drive dashboard from:
  - today appointment count
  - active doctor count
  - payment/invoice revenue
  - review moderation stats if useful

Recommended scope-safe summary payload:

- `todayAppointments`
- `pendingAppointments`
- `confirmedAppointments`
- `monthlyRevenue`
- `activeDoctors`
- `hiddenReviews`
- `pendingRefunds` only if backend has a stable definition

### 8. Frontend naming and module structure still reflect the old domain model

Current state:

- route/menu still use `/admin/hospitals`
- page folder is `frontend/src/pages/admin/ManageHospitals/`
- service is `hospital.service.ts`
- there are thin re-export layers:
  - `frontend/src/pages/admin/ManageNotifications.tsx`
  - `frontend/src/pages/admin/ManageHospitals/index.ts`
  - `frontend/src/pages/admin/ManageAppointments/index.ts`

What to remove:

- `Hospital` naming inside the in-scope admin area
- unnecessary re-export layers where they do not provide code-splitting or route encapsulation value

What to add / change:

- rename:
  - `ManageHospitals` -> `ManageClinics`
  - `hospital.service.ts` -> `clinic.service.ts`
  - admin menu path `/admin/hospitals` -> `/admin/clinics`
- update `frontend/src/routes/adminMenu.ts`
- update `frontend/src/routes/AppRoutes.tsx`
- collapse thin re-export files when they only forward default exports

Recommended migration sequence:

1. Rename service + page folder.
2. Update imports.
3. Update route path.
4. Add temporary redirect from `/admin/hospitals` to `/admin/clinics` if needed.
5. Remove dead re-export wrappers.

### 9. Notification domain is mostly on the right track, but structure is still not fully normalized

Current state:

- route file is correctly under `backend/src/routes/admin/notifications.routes.js`
- frontend service now uses `axiosInstance`
- admin hardcoded sender id was removed
- controller still lives at `backend/src/controllers/notification.controller.js` instead of `controllers/admin/`

Assessment:

- functionally acceptable for now
- structurally still inconsistent with the 7-domain admin layout

What to keep:

- current notification API contract
- JWT-based auth flow

What to add / change later:

- optionally move controller to `backend/src/controllers/admin/notifications.controller.js`
- only do this if import paths and tests are updated together

### 10. Review domain is mostly real-API based, but still needs endpoint contract verification

Current state:

- `frontend/src/services/review.service.ts` already calls real admin endpoints
- backend review routes exist and are admin-protected

Potential issue to verify:

- frontend service includes `getDoctors()` against `/admin/reviews/doctors`
- current reviewed route file does not expose `/doctors`

What to add / change:

- verify whether doctor-filter endpoint exists elsewhere
- if it does not exist, either:
  - add the endpoint
  - or remove that frontend dependency

## Detailed Action Plan

### Phase A. Lock the domain model first

Goal:

- make the codebase obey "1 clinic only"

Steps:

1. Convert clinics backend behavior from multi-branch CRUD to singleton clinic info management.
2. Update specialty canonical controller to auto-bind to singleton clinic.
3. Keep legacy mounts temporarily, but treat them as adapters only.

PASS condition:

- there is no user-facing admin workflow that implies multiple clinics exist

### Phase B. Fix backend contract bugs before touching UI migrations

Steps:

1. Fix `createAppointment` null service dereference.
2. Reconcile home-appointment rule across schema, controller, and form.
3. Add tests for:
   - clinic appointment without `service_id`
   - home appointment without `service_id` fails
   - populate `chi_nhanh_id` works on the four corrected models
4. Verify review doctor-filter endpoint contract.
5. Verify payment status vocabulary exposed to frontend.

PASS condition:

- backend contracts are stable enough that frontend can stop using mocks without guessing

### Phase C. Replace frontend mocks one module at a time

Steps:

1. Replace `specialty.service.ts` with real API.
2. Replace `service.service.ts` with real API.
3. Replace `payment.service.ts` with real API.
4. Re-test:
   - specialties CRUD
   - services CRUD/toggle
   - payment list/detail/refund

PASS condition:

- no in-scope admin page depends on mock data

### Phase D. Rename and simplify the clinics UI

Steps:

1. Rename `ManageHospitals` to `ManageClinics`.
2. Replace list-of-clinics UI with singleton clinic settings UI.
3. Move specialty UI under that singleton page.
4. Remove multi-clinic actions from the interface.
5. Update route path and menu to `/admin/clinics`.

PASS condition:

- admin clinic area reads like a single-facility product, not a hospital chain tool

### Phase E. Finish dashboard and final cleanup

Steps:

1. Add real dashboard summary endpoint.
2. Replace sample stats in `Dashboard.tsx`.
3. Remove thin re-export files that add no value.
4. Produce final cleanup report.

PASS condition:

- all 7 in-scope admin domains use real data, correct naming, and consistent contracts

## What Should Be Removed

Remove immediately after replacement is ready:

- multi-clinic UX assumptions in `ManageHospitals`
- specialty copy-across-clinics flow
- mock logic in:
  - `frontend/src/services/specialty.service.ts`
  - `frontend/src/services/service.service.ts`
  - `frontend/src/services/payment.service.ts`
- hardcoded dashboard data
- `Hospital` naming inside in-scope admin modules

Remove later after migration is complete:

- legacy compatibility paths under `/admin/clinic-info`
- legacy compatibility paths under `/admin/clinic`
- thin re-export files that are no longer useful

## What Should Be Added

- singleton clinic helper/service on backend
- real dashboard endpoint
- model populate tests for corrected `ThongTinPhongKham` refs
- appointment contract tests
- frontend types aligned with real payment statuses
- frontend clinic module naming aligned with business language

## Verification Checklist

- `populate('chi_nhanh_id')` works in all corrected models
- clinic appointment can be created without `service_id`
- home appointment without `service_id` is rejected
- specialties CRUD works through canonical `/admin/specialties`
- clinics UI no longer shows branch list semantics
- services page uses real API data
- payments page uses real API data and correct statuses
- notifications send/list/read/update/delete still work with JWT auth
- dashboard uses real backend data
- frontend build passes
- backend tests pass

## Known Blockers

- backend test run currently depends on external MongoDB Atlas connectivity
- frontend typecheck currently has several pre-existing unrelated errors outside this scope
- some legacy compatibility routes must stay temporarily until frontend migration is finished

## Remaining Out-of-Scope Risks

These were intentionally not changed here, but should be kept visible:

- `doctor.routes.js` still lacks the stronger admin protection noted in the roadmap
- `doctor.controller.js` still accepts `admin_id` from request body
- `ManageDoctor*` frontend still contains hardcoded admin assumptions and `phi_tu_van`
- admin user-management and nurse/receptionist domains are still untouched
