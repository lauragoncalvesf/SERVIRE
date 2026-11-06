import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/auth"

export default function PublicRoute({ children }) {
  const { autenticado, usuario, carregandoSessao } = useAuth()

  if (carregandoSessao) return <p role="status">Validando sessão...</p>
  if (autenticado) {
    return (
      <Navigate
        to={usuario?.tipo === "SUPER_ADMIN" ? "/superadmin" : "/dashboard"}
        replace
      />
    )
  }

  return children
}