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

import SegurancaConta from "./pages/SegurancaConta"
import MeuPerfil from "./pages/MeuPerfil"
import Superadmin from "./pages/Superadmin"
import AceitarConvite from "./pages/AceitarConvite"

function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/esqueci-senha" element={<SegurancaConta modo="solicitar" />} />
          <Route path="/confirmar-email" element={<SegurancaConta modo="confirmar" />} />
          <Route path="/redefinir-senha" element={<SegurancaConta modo="redefinir" />} />
          <Route path="/meu-perfil" element={<ProtectedRoute pessoal><MeuPerfil /></ProtectedRoute>} />
          <Route path="/superadmin" element={<ProtectedRoute global><Superadmin /></ProtectedRoute>} />
          <Route path="/aceitar-convite" element={<AceitarConvite />} />

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
