import { Router } from "express"
import { auth } from "../middlewares/auth.js"
import { permitirTipo } from "../middlewares/permitirTipo.js"
import { limitarLogin } from "../middlewares/limitarLogin.js"
import * as c from "../controllers/superadminController.js"
export default function superadminRoutes(app) {
  const router = Router()
  router.use(auth, permitirTipo("SUPER_ADMIN"))
  router.get("/dashboard", c.dashboard)
  router.get("/paroquias", c.listar)
  router.post("/paroquias", c.salvarParoquia)
  router.get("/paroquias/:id", c.detalhes)
  router.put("/paroquias/:id", c.salvarParoquia)
  router.patch("/paroquias/:id/status", c.statusParoquia)
  router.get("/paroquias/:id/admins", c.listarAdmins)
  router.post("/paroquias/:id/admins", c.criarAdmin)
  router.put("/admins/:id", c.editarAdmin)
  router.patch("/admins/:id/status", c.statusAdmin)
  router.post("/admins/:id/convite", c.conviteAdmin)
  router.post("/admins/:id/transferir", c.transferir)
  app.use("/superadmin", router)
  app.get("/auth/sessao", auth, c.sessao)
  app.post("/auth/aceitar-convite", limitarLogin, c.aceitar)
}
