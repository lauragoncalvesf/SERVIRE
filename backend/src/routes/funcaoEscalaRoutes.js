import {
  adicionarFuncaoEscala,
  listarFuncoesEscala,
  atualizarFuncaoEscala,
  removerFuncaoEscala
} from "../controllers/funcaoEscalaController.js"

import { auth } from "../middlewares/auth.js"

import {
  permitirCoordenadorPorEscala,
  permitirCoordenadorPorFuncaoEscala
} from "../middlewares/permitirCoordenadorPastoral.js"

export default function funcaoEscalaRoutes(app) {
  app.post(
    "/escalas/:escalaId/funcoes",
    auth,
    permitirCoordenadorPorEscala(),
    adicionarFuncaoEscala
  )

  app.get(
    "/escalas/:escalaId/funcoes",
    auth,
    listarFuncoesEscala
  )

  app.patch(
    "/funcoes-escala/:funcaoEscalaId",
    auth,
    permitirCoordenadorPorFuncaoEscala(),
    atualizarFuncaoEscala
  )

  app.delete(
    "/funcoes-escala/:funcaoEscalaId",
    auth,
    permitirCoordenadorPorFuncaoEscala(),
    removerFuncaoEscala
  )
}
