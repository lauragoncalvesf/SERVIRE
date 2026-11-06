import { auth } from "../middlewares/auth.js"
import { limitarLogin } from "../middlewares/limitarLogin.js"
import { consultar, atualizar, atualizarSenha } from "../controllers/perfilController.js"

export default function perfilRoutes(app) {
  app.get("/meu-perfil", auth, consultar)
  // Reutiliza proteção de tentativas por IP também na confirmação de senha atual.
  app.patch("/meu-perfil", auth, limitarLogin, atualizar)
  app.put("/meu-perfil/senha", auth, limitarLogin, atualizarSenha)
}
