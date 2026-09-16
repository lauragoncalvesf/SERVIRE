import {
  criarFuncaoPastoral,
  listarFuncoesPastoral,
  atualizarFuncaoPastoral
} from "../controllers/funcaoPastoralController.js"

import { auth } from "../middlewares/auth.js"
import {
  permitirCoordenadorPastoralBody,
  permitirCoordenadorPorFuncaoPastoral
} from "../middlewares/permitirCoordenadorPastoral.js"

export default function funcaoPastoralRoutes(app) {
    app.post(
    "/funcoes-pastorais",
    auth,
    permitirCoordenadorPastoralBody(),
    criarFuncaoPastoral
    )

  app.get(
    "/pastorais/:pastoralId/funcoes",
    auth,
    listarFuncoesPastoral
  )

  app.patch(
  "/funcoes-pastorais/:funcaoId",
  auth,
  permitirCoordenadorPorFuncaoPastoral(),
  atualizarFuncaoPastoral
)

}
