import {
  CalendarDays,
  Church,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  Users,
  X
} from "lucide-react"

import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"

import { useAuth } from "../contexts/auth"
import { useTheme } from "../contexts/useTheme"
import logoClara from "../assets/logo3clara.png"

import { formatarTipoUsuario } from "../utils"
import NotificacoesMenu from "./NotificacoesMenu"

export default function AppLayout({
  children,
  titulo,
  subtitulo
}) {
  const navigate = useNavigate()
  const { usuario, logout } = useAuth()
  const { tema, alternarTema } = useTheme()

  const [menuAberto, setMenuAberto] = useState(false)

  function handleLogout() {
    logout()
    navigate("/login", { replace: true })
  }

  const menu = [
    {
      nome: "Dashboard",
      caminho: "/dashboard",
      icone: LayoutDashboard
    },
    {
      nome: "Pastorais",
      caminho: "/pastorais",
      icone: Church
    },
    {
      nome: "Eventos",
      caminho: "/eventos",
      icone: CalendarDays
    },
    {
      nome: "Minhas Escalas",
      caminho: "/minhas-escalas",
      icone: Users
    },

    ...(usuario?.tipo === "ADMIN"
      ? [
          {
            nome: "Usuários",
            caminho: "/usuarios",
            icone: ClipboardList
          }
        ]
      : [])
  ]

  return (
    <div className="app-shell min-h-screen bg-[#F7F5EF]">

      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          className="
            fixed
            inset-0
            bg-black/30
            backdrop-blur-[1px]
            z-40
            lg:hidden
          "
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50
          h-screen
          w-64
          app-sidebar
          bg-[#1D5C9E]
          text-white
          transition-transform
          duration-200

          ${
            menuAberto
              ? "translate-x-0"
              : "-translate-x-full"
          }

          lg:translate-x-0
        `}
      >

        <div className="h-full flex flex-col">

          <div
            className="
              h-20
              px-4
              flex
              items-center
              justify-between
              border-b
              border-white/15
            "
          >

            <img
              src={logoClara}
              alt="Servire — Sistema de Gestão Pastoral"
              className="block h-auto w-[184px] max-w-full object-contain lg:w-[208px]"
            />

            <button
              type="button"
              onClick={() =>
                setMenuAberto(false)
              }
              className="
                lg:hidden
                w-8 h-8 shrink-0
                flex
                items-center
                justify-center
                rounded-lg
                text-white/80
                hover:bg-white/10
              "
              aria-label="Fechar menu"
            >
              <X size={21} />
            </button>

          </div>

          <nav
            className="
              flex-1
              px-3
              py-5
              space-y-1.5
            "
          >

            {menu.map((item) => {

              const Icone = item.icone

              return (
                <NavLink
                  key={item.caminho}
                  to={item.caminho}
                  onClick={() =>
                    setMenuAberto(false)
                  }
                  className={({ isActive }) =>
                    `
                      flex
                      items-center
                      gap-3
                      px-4
                      py-3
                      rounded-xl
                      text-sm
                      font-semibold
                      transition

                      ${
                        isActive
                          ? `
                            bg-[#EFE8D6]
                            text-[#1D5C9E]
                            shadow-sm
                          `
                          : `
                            text-white/85
                            hover:bg-white/10
                            hover:text-white
                          `
                      }
                    `
                  }
                >

                  <Icone size={19} />

                  {item.nome}

                </NavLink>
              )
            })}

          </nav>

          <div
            className="
              p-4
              border-t
              border-white/15
            "
          >

            <div
              className="
                mb-3
                px-3
                py-3
                rounded-xl
                bg-white/10
              "
            >

              <p
                className="
                  font-semibold
                  text-sm
                  text-white
                "
              >
                {usuario?.nome}
              </p>

              <p
                className="
                  text-xs
                  text-white/65
                  mt-1
                "
              >
                {formatarTipoUsuario(
                  usuario?.tipo
                )}
              </p>

            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="
                w-full
                flex
                items-center
                gap-3
                text-white/80
                px-3
                py-2.5
                rounded-xl
                hover:bg-white/10
                hover:text-white
                transition
              "
            >

              <LogOut size={18} />

              Sair

            </button>

          </div>

        </div>

      </aside>

      <div className="app-content lg:ml-64 min-h-screen">

        <header
          className="
            min-h-20
            bg-white
            border-b
            border-[#EFE8D6]
            flex
            items-center
            justify-between
            gap-4
            px-4
            sm:px-5
            lg:px-8
            py-3
            lg:py-0
            sticky
            top-0
            z-30
          "
        >

          <div
            className="
              flex
              items-center
              min-w-0
            "
          >

            <button
              type="button"
              onClick={() =>
                setMenuAberto(true)
              }
              className="
                mr-3
                lg:hidden
                w-10 h-10
                shrink-0
                flex
                items-center
                justify-center
                rounded-xl
                bg-[#EFE8D6]
                text-[#1D5C9E]
                hover:bg-[#E8DFC8]
                transition
              "
              aria-label="Abrir menu"
            >
              <Menu size={21} />
            </button>

            <div className="min-w-0">

              <h1
                className="
                  text-lg
                  sm:text-xl
                  font-bold
                  text-slate-900
                  truncate
                "
              >
                {titulo}
              </h1>

              {subtitulo && (
                <p
                  className="
                    text-xs
                    sm:text-sm
                    text-slate-500
                    mt-1
                    line-clamp-1
                  "
                >
                  {subtitulo}
                </p>
              )}

            </div>

          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={alternarTema}
              className="theme-toggle"
              aria-label={tema === "claro" ? "Ativar modo escuro" : "Ativar modo claro"}
              title={tema === "claro" ? "Modo escuro" : "Modo claro"}
            >
              {tema === "claro" ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <NotificacoesMenu />
          </div>

        </header>

        <main className="p-4 sm:p-5 lg:p-8">
          {children}
        </main>

      </div>

    </div>
  )
}
