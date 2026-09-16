import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/auth"

export default function PublicRoute({ children }) {
  const { autenticado } = useAuth()

  if (autenticado) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    )
  }

  return children
}