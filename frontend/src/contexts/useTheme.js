import { useContext } from "react"
import { ThemeContext } from "./theme"

export function useTheme() {
  const contexto = useContext(ThemeContext)
  if (!contexto) throw new Error("useTheme requer ThemeProvider")
  return contexto
}
