import {
  adicionarMembroPastoral,
  listarMembrosPastoral,
  atualizarMembroPastoral
} from "../controllers/membroPastoralController.js"
import { auth } from "../middlewares/auth.js"
import { permitirCoordenadorPastoralBody, permitirCoordenadorPorMembroPastoral } from "../middlewares/permitirCoordenadorPastoral.js"

export default function membroPastoralRoutes(app) {
  app.post("/membros-pastorais",
    auth,
    permitirCoordenadorPastoralBody(),
    adicionarMembroPastoral)

  app.get(
    "/pastorais/:pastoralId/membros",
    auth,
    listarMembrosPastoral
  )

  app.patch(
  "/membros-pastorais/:membroPastoralId",
  auth,
  permitirCoordenadorPorMembroPastoral(),
  atualizarMembroPastoral
)
}