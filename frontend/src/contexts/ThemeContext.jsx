import { createContext, useContext, useEffect, useState } from "react"

const ThemeContext = createContext(null)
const STORAGE_KEY = "servire-tema"

function temaInicial() {
  try {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo === "claro" || salvo === "escuro") return salvo
  } catch {
    // A preferência continua funcionando nesta sessão sem armazenamento.
  }

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "escuro"
    : "claro"
}

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(temaInicial)

  useEffect(() => {
    document.documentElement.dataset.theme = tema
    document.documentElement.style.colorScheme = tema === "escuro" ? "dark" : "light"
    try {
      localStorage.setItem(STORAGE_KEY, tema)
    } catch {
      // Armazenamento indisponível não impede a troca de tema.
    }
  }, [tema])

  function alternarTema() {
    setTema((atual) => atual === "claro" ? "escuro" : "claro")
  }

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const contexto = useContext(ThemeContext)
  if (!contexto) throw new Error("useTheme requer ThemeProvider")
  return contexto
}
