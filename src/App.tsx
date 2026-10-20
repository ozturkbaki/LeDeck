import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorBoundary } from '@shared/components/ErrorBoundary'
import { DeviceSelectionPage } from './pages/DeviceSelectionPage'

// H Series
import { HSessionProvider } from './modules/HSeries/state/HSessionState'
import { HConnectionPage } from './modules/HSeries/connection/HConnectionPage'
import { HDashboardPage } from './modules/HSeries/dashboard/HDashboardPage'

// TU Series
import { TUSessionProvider } from './modules/TUSeries/state/TUSessionState'
import { TUConnectionPage } from './modules/TUSeries/connection/TUConnectionPage'
import { TUDashboardPage } from './modules/TUSeries/dashboard/TUDashboardPage'

// VX Series
import { VXSessionProvider } from './modules/VXSeries/state/VXSessionState'
import { VXSelectionPage } from './modules/VXSeries/selection/VXSelectionPage'
import { VXConnectionPage } from './modules/VXSeries/connection/VXConnectionPage'
import { VXDashboardPage } from './modules/VXSeries/dashboard/VXDashboardPage'

// VX Pro
import { VXProSessionProvider } from './modules/VXPro/state/VXProSessionState'
import { VXProConnectionPage } from './modules/VXPro/connection/VXProConnectionPage'
import { VXProDashboardPage } from './modules/VXPro/dashboard/VXProDashboardPage'

// MCTRL
import { MCTRLSessionProvider } from './modules/MCTRL/state/MCTRLSessionState'
import { MCTRLConnectionPage } from './modules/MCTRL/connection/MCTRLConnectionPage'
import { MCTRLDashboardPage } from './modules/MCTRL/dashboard/MCTRLDashboardPage'

// Taurus (TB / TCC)
import { TaurusSessionProvider } from './modules/Taurus/state/TaurusSessionState'
import { TaurusConnectionPage } from './modules/Taurus/connection/TaurusConnectionPage'
import { TaurusDashboardPage } from './modules/Taurus/dashboard/TaurusDashboardPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Device Selection */}
        <Route path="/" element={<DeviceSelectionPage />} />

        {/* H Series — isolated in its own ErrorBoundary + Provider */}
        <Route
          path="/hseries/*"
          element={
            <ErrorBoundary moduleName="H Series">
              <HSessionProvider>
                <Routes>
                  <Route path="connect" element={<HConnectionPage />} />
                  <Route path="dashboard" element={<HDashboardPage />} />
                  <Route path="*" element={<Navigate to="connect" replace />} />
                </Routes>
              </HSessionProvider>
            </ErrorBoundary>
          }
        />

        {/* TU Series */}
        <Route
          path="/tuseries/*"
          element={
            <ErrorBoundary moduleName="TU Series">
              <TUSessionProvider>
                <Routes>
                  <Route path="connect" element={<TUConnectionPage />} />
                  <Route path="dashboard" element={<TUDashboardPage />} />
                  <Route path="*" element={<Navigate to="connect" replace />} />
                </Routes>
              </TUSessionProvider>
            </ErrorBoundary>
          }
        />

        {/* VX Series */}
        <Route
          path="/vxseries/*"
          element={
            <ErrorBoundary moduleName="VX Series">
              <VXSessionProvider>
                <Routes>
                  {/* Alt model seçim ekranı — Provider dışında olmadığı için session context "dummy" ama zararsız */}
                  <Route path="select" element={<VXSelectionPage />} />
                  {/* Standard VX bağlantı */}
                  <Route path="connect/standard" element={<VXConnectionPage />} />
                  <Route path="connect/pro" element={<Navigate to="/vxpro/connect" replace />} />
                  {/* Dashboard */}
                  <Route path="dashboard" element={<VXDashboardPage />} />
                  {/* Varsayılan: seçim ekranına yönlendir */}
                  <Route path="*" element={<Navigate to="select" replace />} />
                </Routes>
              </VXSessionProvider>
            </ErrorBoundary>
          }
        />

        {/* VX Pro */}
        <Route
          path="/vxpro/*"
          element={
            <ErrorBoundary moduleName="VX Pro">
              <VXProSessionProvider>
                <Routes>
                  <Route path="connect" element={<VXProConnectionPage />} />
                  <Route path="dashboard" element={<VXProDashboardPage />} />
                  <Route path="*" element={<Navigate to="connect" replace />} />
                </Routes>
              </VXProSessionProvider>
            </ErrorBoundary>
          }
        />

        {/* MCTRL */}
        <Route
          path="/mctrl/*"
          element={
            <ErrorBoundary moduleName="MCTRL">
              <MCTRLSessionProvider>
                <Routes>
                  <Route path="connect"   element={<MCTRLConnectionPage />} />
                  <Route path="dashboard" element={<MCTRLDashboardPage />} />
                  <Route path="*"         element={<Navigate to="connect" replace />} />
                </Routes>
              </MCTRLSessionProvider>
            </ErrorBoundary>
          }
        />

        {/* Taurus (TB / TCC) */}
        <Route
          path="/taurus/*"
          element={
            <ErrorBoundary moduleName="Taurus">
              <TaurusSessionProvider>
                <Routes>
                  <Route path="connect"   element={<TaurusConnectionPage />} />
                  <Route path="dashboard" element={<TaurusDashboardPage />} />
                  <Route path="*"         element={<Navigate to="connect" replace />} />
                </Routes>
              </TaurusSessionProvider>
            </ErrorBoundary>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
