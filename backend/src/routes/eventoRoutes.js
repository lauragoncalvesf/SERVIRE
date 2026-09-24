import {
  atualizarEvento,
  cancelarEvento,
  criarEvento,
  listarEventos
} from "../controllers/eventoController.js"
import { auth } from "../middlewares/auth.js"
import { permitirTipo } from "../middlewares/permitirTipo.js"

export default function eventoRoutes(app) {
  app.post("/eventos", auth, criarEvento)
  app.get("/eventos", auth, listarEventos)
  app.put("/eventos/:eventoId", auth, permitirTipo("ADMIN"), atualizarEvento)
  app.delete("/eventos/:eventoId", auth, permitirTipo("ADMIN"), cancelarEvento)
}
