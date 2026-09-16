import {
  contarNotificacoesNaoLidas,
  listarMinhasNotificacoes,
  marcarNotificacaoComoLida,
  marcarTodasComoLidas
} from "../controllers/notificacaoController.js"

import { auth } from "../middlewares/auth.js"

export default function notificacaoRoutes(app) {
  app.get(
    "/notificacoes",
    auth,
    listarMinhasNotificacoes
  )

  app.get(
    "/notificacoes/nao-lidas",
    auth,
    contarNotificacoesNaoLidas
  )

  app.patch(
    "/notificacoes/:id/lida",
    auth,
    marcarNotificacaoComoLida
  )

  app.patch(
    "/notificacoes/lidas/todas",
    auth,
    marcarTodasComoLidas
  )
}