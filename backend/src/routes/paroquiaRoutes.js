import {
  criarParoquia,
  listarParoquias
} from "../controllers/paroquiaController.js"
import { auth } from "../middlewares/auth.js"
import { permitirTipo } from "../middlewares/permitirTipo.js"

export default function paroquiaRoutes(app) {
  app.post("/paroquias", auth, permitirTipo("ADMIN"), criarParoquia)
  app.get("/paroquias", listarParoquias)
}
