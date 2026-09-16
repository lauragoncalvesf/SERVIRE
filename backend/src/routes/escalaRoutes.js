import {
  criarEscala,
  listarEscalasEvento,
  atualizarStatusEscala,
} from "../controllers/escalaController.js"
import {
  adicionarItemEscala,
  atualizarItemEscala,
  removerItemEscala,
  responderEscala,
  sairDaEscala
} from "../controllers/itemEscalaController.js"
import {
  substituirMembroEscala
} from "../controllers/substituicaoEscalaController.js"
import {
  autoEscalar
} from "../controllers/autoEscalaController.js"
import {
  listarMinhasEscalas
} from "../controllers/minhasEscalasController.js"

import { auth } from "../middlewares/auth.js"
import { 
  permitirCoordenadorPastoralBody, 
  permitirCoordenadorPorEscala,
  permitirCoordenadorPorItemEscala 
} from "../middlewares/permitirCoordenadorPastoral.js"

export default function escalaRoutes(app) {
    app.post(
    "/escalas",
    auth,
    permitirCoordenadorPastoralBody(),
    criarEscala
    )

    app.post(
    "/escalas/:escalaId/itens",
    auth,
    permitirCoordenadorPorEscala(),
    adicionarItemEscala
    )

  app.get(
    "/eventos/:eventoId/escalas",
    auth,
    listarEscalasEvento
  )

    app.patch(
    "/escalas/itens/:itemId",
    auth,
    permitirCoordenadorPorItemEscala(),
    atualizarItemEscala
    )
    
    app.delete(
    "/escalas/itens/:itemId",
    auth,
    permitirCoordenadorPorItemEscala(),
    removerItemEscala
    )

    app.patch(
    "/escalas/:escalaId/status",
    auth,
    permitirCoordenadorPorEscala(),
    atualizarStatusEscala
    )

    app.patch(
    "/escalas/itens/:itemId/resposta",
    auth,
    responderEscala
    )
    
    app.post(
    "/escalas/itens/:itemId/substituir",
    auth,
    permitirCoordenadorPorItemEscala(),
    substituirMembroEscala
    )

    app.get(
    "/minhas-escalas",
    auth,
    listarMinhasEscalas
    )

    app.post(
    "/escalas/:escalaId/autoescalar",
    auth,
    autoEscalar
    )

    app.patch(
    "/escalas/itens/:itemId/sair",
    auth,
    sairDaEscala
    )
}