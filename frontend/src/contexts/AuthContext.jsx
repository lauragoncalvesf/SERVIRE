import {
  useEffect,
  useState
} from "react"

import api from "../services/api"

import { AuthContext } from "./auth"

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      const usuarioSalvo = localStorage.getItem("usuario")
      return localStorage.getItem("token") && usuarioSalvo
        ? JSON.parse(usuarioSalvo)
        : null
    } catch {
      localStorage.removeItem("token")
      localStorage.removeItem("usuario")
      return null
    }
  })

  useEffect(() => {
    const encerrarSessao = () => setUsuario(null)
    window.addEventListener("sessao-expirada", encerrarSessao)
    return () => window.removeEventListener("sessao-expirada", encerrarSessao)
  }, [])

  async function login(email, senha, paroquiaId) {
    const response = await api.post("/login", {
      email,
      senha,
      paroquiaId
    })

    const {
      token,
      usuario
    } = response.data

    localStorage.setItem("token", token)
    localStorage.setItem(
      "usuario",
      JSON.stringify(usuario)
    )

    setUsuario(usuario)

    return usuario
  }

  function logout() {
    localStorage.removeItem("token")
    localStorage.removeItem("usuario")

    setUsuario(null)
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        login,
        logout,
        autenticado: !!usuario
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
