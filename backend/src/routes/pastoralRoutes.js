import {
  criarPastoral,
  listarPastorais,
  atualizarPastoral
} from "../controllers/pastoralController.js"
import { auth } from "../middlewares/auth.js"
import { permitirTipo } from "../middlewares/permitirTipo.js"
import { permitirCoordenadorPorPastoral } from "../middlewares/permitirCoordenadorPastoral.js"


export default function pastoralRoutes(app) {
  app.post("/pastorais", auth, permitirTipo("ADMIN"), criarPastoral)
  app.get("/pastorais", auth, listarPastorais)
  app.patch("/pastorais/:pastoralId", auth, permitirCoordenadorPorPastoral(), atualizarPastoral)
}




