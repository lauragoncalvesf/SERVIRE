import {
  criarIndisponibilidade,
  listarIndisponibilidadesEvento,
  listarMinhasIndisponibilidades,
  removerIndisponibilidade
} from "../controllers/indisponibilidadeController.js"
import { auth } from "../middlewares/auth.js"

export default function indisponibilidadeRoutes(app) {
  app.post(
    "/indisponibilidades",
    auth,
    criarIndisponibilidade
  )

  app.get(
    "/minhas-indisponibilidades",
    auth,
    listarMinhasIndisponibilidades
  )

  app.delete(
    "/indisponibilidades/eventos/:eventoId",
    auth,
    removerIndisponibilidade
  )

  app.get(
    "/eventos/:eventoId/indisponibilidades",
    auth,
    listarIndisponibilidadesEvento
  )
}