import {
  criarEvento,
  listarEventos
} from "../controllers/eventoController.js"
import { auth } from "../middlewares/auth.js"

export default function eventoRoutes(app) {
  app.post("/eventos", auth, criarEvento)
  app.get("/eventos", auth, listarEventos)
}