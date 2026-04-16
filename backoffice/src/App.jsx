import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import UsersList from './pages/users/List'
import UserForm from './pages/users/Form'
import CarrierCompaniesList from './pages/carrier-companies/List'
import CarrierCompanyForm from './pages/carrier-companies/Form'
import VehiclesList from './pages/vehicles/List'
import VehicleForm from './pages/vehicles/Form'
import VehiclesAdminList from './pages/vehicles/AdminList'
import OrdersList from './pages/orders/List'
import OrderDetail from './pages/orders/Detail'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="profile" element={<Profile />} />

          {/* Orders — carrier_company and superadmin */}
          <Route
            path="orders"
            element={
              <ProtectedRoute allowedRoles={['carrier_company', 'superadmin', 'admin']}>
                <OrdersList />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders/:orderId"
            element={
              <ProtectedRoute allowedRoles={['carrier_company', 'superadmin', 'admin']}>
                <OrderDetail />
              </ProtectedRoute>
            }
          />

          {/* Vehicles — superadmin global view */}
          <Route
            path="vehicles"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <VehiclesAdminList />
              </ProtectedRoute>
            }
          />

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
