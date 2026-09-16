import {
  buscarLiturgiaHoje
} from "../controllers/liturgiaController.js"

export default function liturgiaRoutes(app) {
  app.get(
    "/liturgia/hoje",
    buscarLiturgiaHoje
  )
}