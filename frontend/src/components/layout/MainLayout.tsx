import { useState } from 'react'
import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface MainLayoutProps {
  children: ReactNode
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(255,184,28,0.10),_transparent_26%),linear-gradient(180deg,_rgb(var(--c-fondo-1))_0%,_rgb(var(--c-fondo-2))_42%,_rgb(var(--c-fondo-3))_100%)]">
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <div
        className={`min-h-screen flex flex-col transition-all duration-300 ${isCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}
      >
        <Header onOpenMobileMenu={() => setIsMobileOpen(true)} />

        <main className="flex-1 p-4 sm:p-6">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>

        <footer className="border-t border-neutral-200 bg-white/70 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="max-w-[1600px] mx-auto flex flex-col items-center justify-between gap-1 text-center text-sm text-neutral-600 sm:flex-row sm:text-left">
            <p>© 2026 Cooperativa el Triunfo. Todos los derechos reservados.</p>
            <p>Versión 1.0.0</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
