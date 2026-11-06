import { listarParoquias } from "../controllers/paroquiaController.js"

export default function paroquiaRoutes(app) {
  app.get("/paroquias", listarParoquias)
}
