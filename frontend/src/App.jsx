import {
  BrowserRouter,
  Navigate,
  Route,
  Routes
} from "react-router-dom"

import { AuthProvider } from "./contexts/AuthContext"
import { ThemeProvider } from "./contexts/ThemeContext"

import ProtectedRoute from "./components/ProtectedRoute"
import PublicRoute from "./components/PublicRoute"

import Login from "./pages/Login"
import Dashboard from "./pages/Dashboard"
import Pastorais from "./pages/Pastorais"
import PastoralDetalhes from "./pages/PastoralDetalhes"
import Eventos from "./pages/Eventos"
import EventoEscalas from "./pages/EventoEscalas"
import MinhasEscalas from "./pages/MinhasEscalas"
import Usuarios from "./pages/Usuarios"

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          <Route
            path="/"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pastorais"
            element={
              <ProtectedRoute>
                <Pastorais />
              </ProtectedRoute>
            }
          />

          <Route
            path="/pastorais/:pastoralId"
            element={
              <ProtectedRoute>
                <PastoralDetalhes />
              </ProtectedRoute>
            }
          />

          <Route
            path="/eventos"
            element={
              <ProtectedRoute>
                <Eventos />
              </ProtectedRoute>
            }
          />

          <Route
          path="/eventos/:eventoId/escalas"
          element={
            <ProtectedRoute>
              <EventoEscalas />
            </ProtectedRoute>
          }
        />

        <Route
        path="/minhas-escalas"
        element={
          <ProtectedRoute>
            <MinhasEscalas />
          </ProtectedRoute>
        } 
      />

        <Route
          path="/usuarios"
          element={
            <ProtectedRoute>
              <Usuarios />
            </ProtectedRoute>
          }
        />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App
