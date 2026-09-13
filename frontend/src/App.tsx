import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { ProtectedRoute } from './components/ProtectedRoute'
import { MainLayout } from './components/layout/MainLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import { ParametrosPage } from './pages/ParametrosPage'
import { FeriasPage } from './pages/FeriasPage'
import { TiposCuentaPage } from './pages/TiposCuentaPage'
import { TiposPrestamoPage } from './pages/TiposPrestamoPage'
import { ReportesPage } from './pages/ReportesPage'
import { SemanasColectaPage } from './pages/SemanasColectaPage'
import { ImpresionPage } from './pages/ImpresionPage'
import { SociosPage } from './pages/SociosPage'
import { AhorroPage } from './pages/AhorroPage'
import FunerariaPage from './pages/FunerariaPage'
import SaludPage from './pages/SaludPage'
import AsambleasPage from './pages/AsambleasPage'
import ColectaPage from './pages/ColectaPage'
import PrestamosPage from './pages/PrestamosPage'
import ColectaReportesPage from './pages/ColectaReportesPage'
import TrabajadoresPage from './pages/TrabajadoresPage'
import SaludFeriaPage from './pages/SaludFeriaPage'

function App() {
  const initialize = useAuthStore((state) => state.initialize)

  // Inicializar autenticación desde localStorage al cargar
  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta raíz redirige a dashboard o login según autenticación */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Ruta de login */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Rutas protegidas */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DashboardPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/parametros"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ParametrosPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        {/* La pantalla se llamaba Ubicaciones; se renombro a Ferias y se
            conserva la ruta anterior para no romper enlaces guardados */}
        <Route path="/ubicaciones" element={<Navigate to="/ferias" replace />} />

        <Route
          path="/ferias"
          element={
            <ProtectedRoute>
              <MainLayout>
                <FeriasPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/salud/pago-feria"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SaludFeriaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/trabajadores"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TrabajadoresPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/tipos-cuenta"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TiposCuentaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/tipos-prestamo"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TiposPrestamoPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/colecta"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ColectaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/colecta/reportes"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ColectaReportesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/asambleas"
          element={
            <ProtectedRoute>
              <MainLayout>
                <AsambleasPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/reportes"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ReportesPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/semanas-colecta"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SemanasColectaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/impresion"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ImpresionPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        {/* Rutas futuras */}
        <Route
          path="/socios"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SociosPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/ahorro"
          element={
            <ProtectedRoute>
              <MainLayout>
                <AhorroPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/funeraria"
          element={
            <ProtectedRoute>
              <MainLayout>
                <FunerariaPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/salud"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SaludPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/prestamos"
          element={
            <ProtectedRoute>
              <MainLayout>
                <PrestamosPage />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        
        {/* 404 - Redirigir a dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
