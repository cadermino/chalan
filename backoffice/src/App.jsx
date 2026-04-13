import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import UsersList from './pages/users/List'
import UserForm from './pages/users/Form'
import CarrierCompaniesList from './pages/carrier-companies/List'
import CarrierCompanyForm from './pages/carrier-companies/Form'
import VehiclesList from './pages/vehicles/List'
import VehicleForm from './pages/vehicles/Form'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />

          {/* Carrier companies */}
          <Route path="carrier-companies" element={<CarrierCompaniesList />} />
          <Route
            path="carrier-companies/new"
            element={
              <ProtectedRoute allowedRoles={['superadmin', 'admin']}>
                <CarrierCompanyForm />
              </ProtectedRoute>
            }
          />
          <Route path="carrier-companies/:id/edit" element={<CarrierCompanyForm />} />
          <Route path="carrier-companies/:companyId/vehicles" element={<VehiclesList />} />
          <Route path="carrier-companies/:companyId/vehicles/new" element={<VehicleForm />} />
          <Route path="carrier-companies/:companyId/vehicles/:vehicleId/edit" element={<VehicleForm />} />

          {/* Users — superadmin only */}
          <Route
            path="users"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <UsersList />
              </ProtectedRoute>
            }
          />
          <Route
            path="users/new"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <UserForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="users/:id/edit"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <UserForm />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
