import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/auth"

export default function ProtectedRoute({ children }) {
  const { autenticado } = useAuth()

  if (!autenticado) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  return children
}