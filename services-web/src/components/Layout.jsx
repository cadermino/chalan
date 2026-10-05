import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <a href="https://chalan.pe" aria-label="Chalán">
            {/* El logo es oscuro: se invierte para el fondo de pizarra, igual que en la landing. */}
            <img src={`${import.meta.env.BASE_URL}logo_chalan.png`} alt="Chalán" className="h-8 w-auto [filter:brightness(0)_invert(1)]" />
          </a>
          <span className="text-sm text-inkSoft">Embalaje profesional</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-line py-4 text-center text-xs text-mute">
        Chalán · Lima, Perú
      </footer>
    </div>
  )
}
