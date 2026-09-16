import {
  criarUsuario,
  listarUsuarios,
  atualizarUsuario
} from "../controllers/usuarioController.js"
import { auth } from "../middlewares/auth.js"

export default function usuarioRoutes(app) {
  app.post("/usuarios",
    auth,
    criarUsuario)

  app.get("/usuarios",
    auth,
    listarUsuarios)

  app.patch("/usuarios/:id",
    auth,
    atualizarUsuario)
}
