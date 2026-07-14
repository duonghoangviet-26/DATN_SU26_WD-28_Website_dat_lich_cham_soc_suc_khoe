import { Routes, Route, Navigate } from 'react-router-dom'

import AdminLayout from '@/layouts/AdminLayout'
import DoctorLayout from '@/layouts/DoctorLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ClientLayout from '@/layouts/ClientLayout'
import ProtectedRoute from '@/routes/ProtectedRoute'

import ReceptionistLayout from '@/pages/receptionist/Layout'
import ReceptionistDashboard from '@/pages/receptionist/Dashboard'
import ReceptionistAppointments from '@/pages/receptionist/Appointments'
import ReceptionistPayments from '@/pages/receptionist/Payments'

import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import Home from '@/pages/client/Home'
import DoctorList from '@/pages/client/DoctorList'
import DoctorDetail from '@/pages/client/DoctorDetail'
import ServiceList from '@/pages/client/ServiceList'
import ServiceDetail from '@/pages/client/ServiceDetail'
import Booking from '@/pages/client/Booking'
import Profile from '@/pages/client/Profile'
import NewsList from '@/pages/client/NewsList'
import NewsDetail from '@/pages/client/NewsDetail'

import Dashboard from '@/pages/admin/Dashboard'
import ManageUsers from '@/pages/admin/ManageUsers'
import ManageDoctors from '@/pages/admin/ManageDoctors'
import ManageClinics from '@/pages/admin/ManageClinics/ManageClinics'
import ManageServices from '@/pages/admin/ManageServices'
import ManageServiceSpecialtyDetail from '@/pages/admin/ManageServiceSpecialtyDetail'
import ManageAppointments from '@/pages/admin/ManageAppointments/ManageAppointments'
import ManageDoctorSchedules from '@/pages/admin/ManageDoctorSchedules'
import ManageReviews from '@/pages/admin/ManageReviews'
import ManageNotifications from '@/pages/admin/ManageNotifications/ManageNotifications'
import ManagePayments from '@/pages/admin/ManagePayments'

import DoctorDashboard from '@/pages/doctor/DoctorDashboard'
import DoctorProfile from '@/pages/doctor/DoctorProfile'
import DoctorSchedule from '@/pages/doctor/DoctorSchedule'
import DoctorAppointments from '@/pages/doctor/DoctorAppointments'

import NotFound from '@/pages/NotFound'

export default function AppRoutes() {
  return (
    <Routes>
      {/* Khu vực khách (client) */}
      <Route element={<ClientLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/bac-si" element={<DoctorList />} />
        <Route path="/bac-si/:id" element={<DoctorDetail />} />
        <Route path="/dich-vu" element={<ServiceList />} />
        <Route path="/dich-vu/:id" element={<ServiceDetail />} />
        <Route
          path="/booking"
          element={
            <ProtectedRoute roles={['user']}>
              <Booking />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute roles={['user']}>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="/tin-tuc" element={<NewsList />} />
        <Route path="/tin-tuc/:slug" element={<NewsDetail />} />
      </Route>

      {/* Khu vực xác thực */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
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
        <Route path="users" element={<ManageUsers />} />           {/* C1 */}
        <Route path="doctors" element={<ManageDoctors />} />       {/* C2 */}
        <Route path="clinics" element={<ManageClinics />} />       {/* C3 */}
        <Route path="hospitals" element={<Navigate to="/admin/clinics" replace />} />
        <Route path="services" element={<ManageServices />} />     {/* C4 */}
        <Route path="services/chuyen-khoa/:slug" element={<ManageServiceSpecialtyDetail />} />
        <Route path="appointments" element={<ManageAppointments />} /> {/* C5 */}
        <Route path="doctor-schedules" element={<ManageDoctorSchedules />} />
        <Route path="reviews" element={<ManageReviews />} />       {/* C6 */}
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
        <Route path="schedule" element={<DoctorSchedule />} />         {/* B2 */}
        <Route path="profile" element={<DoctorProfile />} />           {/* B1 */}
      </Route>

      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  )
}

