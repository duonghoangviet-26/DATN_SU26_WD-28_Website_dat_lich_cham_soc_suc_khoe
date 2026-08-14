import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import AdminLayout from '@/layouts/AdminLayout'
import DoctorLayout from '@/layouts/DoctorLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ClientLayout from '@/layouts/ClientLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'

import ReceptionistLayout from '@/pages/receptionist/Layout'
const ReceptionistDashboard = lazy(() => import('@/pages/receptionist/Dashboard'))
const ReceptionistAppointments = lazy(() => import('@/pages/receptionist/Appointments'))
const ReceptionistPayments = lazy(() => import('@/pages/receptionist/Payments'))
const ReceptionistPatientIntake = lazy(() => import('@/pages/receptionist/PatientIntake'))
const ReceptionistOfflineQueue = lazy(() => import('@/pages/receptionist/OfflineQueue'))
const ReceptionistDoctorDayView = lazy(() => import('@/pages/receptionist/DoctorDayView'))
const ReceptionistContactTasks = lazy(() => import('@/pages/receptionist/ContactTasks'))
const ReceptionistActivityLog = lazy(() => import('@/pages/receptionist/ActivityLog'))
const ReceptionistEmergencyReport = lazy(() => import('@/pages/receptionist/EmergencyReport'))
const ReceptionistNewsList = lazy(() => import('@/pages/receptionist/NewsList'))
const ReceptionistNewsCreate = lazy(() => import('@/pages/receptionist/NewsCreate'))
const ReceptionistNewsEdit = lazy(() => import('@/pages/receptionist/NewsEdit'))

const Login = lazy(() => import('@/pages/auth/Login'))
const Register = lazy(() => import('@/pages/auth/Register'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const Home = lazy(() => import('@/pages/client/Home'))
const DoctorList = lazy(() => import('@/pages/client/DoctorList'))
const DoctorDetail = lazy(() => import('@/pages/client/DoctorDetail'))
const ServiceList = lazy(() => import('@/pages/client/ServiceList'))
const ServiceDetail = lazy(() => import('@/pages/client/ServiceDetail'))
const Booking = lazy(() => import('@/pages/client/Booking'))
const Profile = lazy(() => import('@/pages/client/Profile'))
const VnpayResult = lazy(() => import('@/pages/client/VnpayResult'))
const NewsList = lazy(() => import('@/pages/client/NewsList'))
const NewsDetail = lazy(() => import('@/pages/client/NewsDetail'))
const AboutUs = lazy(() => import('@/pages/client/AboutUs'))
const Policy = lazy(() => import('@/pages/client/Policy'))
const Feedback = lazy(() => import('@/pages/client/Feedback'))

const Dashboard = lazy(() => import('@/pages/admin/Dashboard'))
const ManageUsers = lazy(() => import('@/pages/admin/ManageUsers'))
const ManagePatients = lazy(() => import('@/pages/admin/ManagePatients'))
const ManageDoctors = lazy(() => import('@/pages/admin/ManageDoctors'))
const ManageClinics = lazy(() => import('@/pages/admin/ManageClinics/ManageClinics'))
const ManageServices = lazy(() => import('@/pages/admin/ManageServices'))
const ManageServiceSpecialtyDetail = lazy(() => import('@/pages/admin/ManageServiceSpecialtyDetail'))
const ManageAppointments = lazy(() => import('@/pages/admin/ManageAppointments/ManageAppointments'))
const ManageDoctorSchedules = lazy(() => import('@/pages/admin/ManageDoctorSchedules'))
const ManageReviews = lazy(() => import('@/pages/admin/ManageReviews'))
const ManageNews = lazy(() => import('@/pages/admin/ManageNews'))
const ManageNotifications = lazy(() => import('@/pages/admin/ManageNotifications/ManageNotifications'))
const ManagePayments = lazy(() => import('@/pages/admin/ManagePayments'))
const DoctorRevenueDetail = lazy(() => import('@/pages/admin/DoctorRevenueDetail'))

const DoctorDashboard = lazy(() => import('@/pages/doctor/DoctorDashboard'))
const DoctorProfile = lazy(() => import('@/pages/doctor/DoctorProfile'))
const DoctorSchedule = lazy(() => import('@/pages/doctor/DoctorSchedule'))
const DoctorAppointments = lazy(() => import('@/pages/doctor/DoctorAppointments'))
const DoctorExamQueue = lazy(() => import('@/pages/doctor/DoctorExamQueue'))
const DoctorLeaveRequests = lazy(() => import('@/pages/doctor/DoctorLeaveRequests'))
const DoctorExamSession = lazy(() => import('@/pages/doctor/ExamSessionPage'))
const DoctorExamHistory = lazy(() => import('@/pages/doctor/DoctorExamHistory'))

const NotFound = lazy(() => import('@/pages/NotFound'))

function RouteFallback() {
  return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">Dang tai...</div>
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
      {/* Khu vực khách (client) */}
      <Route element={<ClientLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/bac-si" element={<DoctorList />} />
        <Route path="/bac-si/:id" element={<DoctorDetail />} />
        <Route path="/dich-vu" element={<ServiceList />} />
        <Route path="/dich-vu/:id" element={<ServiceDetail />} />
        <Route path="/payment/vnpay-result" element={<VnpayResult />} />
        <Route
          path="/booking"
          element={
          <ProtectedRoute roles={['user', 'patient']}>
              <Booking />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute roles={['user', 'patient']}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="/tin-tuc" element={<NewsList />} />
        <Route path="/tin-tuc/:slug" element={<NewsDetail />} />
        <Route path="/ve-chung-toi" element={<AboutUs />} />
        <Route path="/chinh-sach" element={<Policy />} />
        <Route path="/phan-hoi" element={<Feedback />} />
      </Route>

      {/* Khu vực xác thực */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Khu vực Admin — yêu cầu role = admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="doanh-thu-bac-si/:id" element={<DoctorRevenueDetail />} />
        <Route path="users" element={<ManageUsers />} />           {/* C1 */}
        <Route path="patients" element={<ManagePatients />} />
        <Route path="doctors" element={<ManageDoctors />} />       {/* C2 */}
        <Route path="clinics" element={<ManageClinics />} />       {/* C3 */}
        <Route path="hospitals" element={<Navigate to="/admin/clinics" replace />} />
        <Route path="services" element={<ManageServices />} />     {/* C4 */}
        <Route path="services/chuyen-khoa/:slug" element={<ManageServiceSpecialtyDetail />} />
        <Route path="appointments" element={<ManageAppointments />} /> {/* C5 */}
        <Route path="doctor-schedules" element={<ManageDoctorSchedules />} />
        <Route path="reviews" element={<ManageReviews />} />       {/* C6 */}
        <Route path="news" element={<ManageNews />} />
        <Route path="notifications" element={<ManageNotifications />} /> {/* C7 */}
        <Route path="payments" element={<ManagePayments />} />     {/* C8 */}
      </Route>

      {/* Khu vực Lễ tân — yêu cầu role = receptionist hoặc admin */}
      <Route
        path="/receptionist"
        element={
          <ProtectedRoute roles={['receptionist', 'admin']}>
            <ReceptionistLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ReceptionistDashboard />} />
        <Route path="appointments" element={<ReceptionistAppointments />} />
        <Route path="payments" element={<ReceptionistPayments />} />
        <Route path="patient-intake" element={<ReceptionistPatientIntake />} />
        <Route path="offline-queue" element={<ReceptionistOfflineQueue />} />
        <Route path="doctor-day-view" element={<ReceptionistDoctorDayView />} />
        <Route path="contact-tasks" element={<ReceptionistContactTasks />} />
        <Route path="activity-log" element={<ReceptionistActivityLog />} />
        <Route path="emergency-report" element={<ReceptionistEmergencyReport />} /> {/* C6/D78 — biên bản ca khẩn cuối ngày */}
        <Route path="booking" element={<ReceptionistPatientIntake />} />
        <Route path="news" element={<ReceptionistNewsList />} />
        <Route path="news/create" element={<ReceptionistNewsCreate />} />
        <Route path="news/:id/edit" element={<ReceptionistNewsEdit />} />
      </Route>

      {/* Khu vực Doctor — yêu cầu role = doctor */}
      <Route
        path="/doctor"
        element={
          <ProtectedRoute roles={['doctor']}>
            <DoctorLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DoctorDashboard />} />                  {/* B5 */}
        <Route path="appointments" element={<DoctorAppointments />} /> {/* B3+B4 */}
        <Route path="pending-records" element={<DoctorExamQueue />} /> {/* B4 — hồ sơ chờ khám (online + offline) */}
        <Route path="exam-history" element={<DoctorExamHistory />} /> {/* C4 — bệnh nhân đã khám */}
        <Route path="exam/:queueId" element={<DoctorExamSession />} /> {/* B4 — phiên khám 5 bước */}
        <Route path="schedule" element={<DoctorSchedule />} />         {/* B2 */}
        <Route path="leave-requests" element={<DoctorLeaveRequests />} /> {/* B8 — xin nghỉ */}
        <Route path="profile" element={<DoctorProfile />} />           {/* B1 */}
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
  )
}

