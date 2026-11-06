import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/auth"

export default function ProtectedRoute({ children, global = false, pessoal = false }) {
  const { autenticado, usuario, carregandoSessao } = useAuth()

  if (carregandoSessao) return <p role="status">Validando sessão...</p>

  if (!autenticado) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  if (global && usuario?.tipo !== "SUPER_ADMIN") return <Navigate to="/dashboard" replace />
  if (!global && !pessoal && usuario?.tipo === "SUPER_ADMIN") return <Navigate to="/superadmin" replace />
  return children
}