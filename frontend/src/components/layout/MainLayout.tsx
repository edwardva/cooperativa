import { useState } from 'react'
import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface MainLayoutProps {
  children: ReactNode
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(255,184,28,0.10),_transparent_26%),linear-gradient(180deg,_#fffdfa_0%,_#fbfcfa_42%,_#f8faf7_100%)]">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      
      <div className={`min-h-screen flex flex-col transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
        <Header />
        
        <main className="flex-1 p-6">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
        
        <footer className="border-t border-neutral-200 bg-white/70 px-6 py-4 backdrop-blur-sm">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between text-sm text-neutral-600">
            <p>© 2026 Cooperativa el Triunfo. Todos los derechos reservados.</p>
            <p>Versión 1.0.0</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
