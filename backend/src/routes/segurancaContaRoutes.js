import { auth } from "../middlewares/auth.js"
import { permitirTipo } from "../middlewares/permitirTipo.js"
import { limitarSeguranca } from "../middlewares/limitarSeguranca.js"
import * as c from "../controllers/segurancaContaController.js"

export default function segurancaContaRoutes(app) {
  app.post("/auth/esqueci-senha", limitarSeguranca("recuperacao"), c.solicitarRecuperacao)
  app.post("/auth/redefinir-senha", limitarSeguranca("redefinir", 20), c.redefinir)
  app.post("/auth/confirmar-email", limitarSeguranca("confirmar", 20), c.confirmar)
  app.post("/meu-perfil/email/confirmacao", auth, limitarSeguranca("pessoal", 10), c.solicitarConfirmacaoPessoal)
  app.post("/usuarios/:id/email/autorizar", auth, permitirTipo("ADMIN"), limitarSeguranca("autorizacao", 10), c.autorizarAdministrativamente)
  app.post("/usuarios/:id/email/confirmacao", auth, permitirTipo("ADMIN"), limitarSeguranca("confirmacao-admin", 10), c.enviarConfirmacaoAdministrativa)
  app.post("/superadmin/admins/:id/email/autorizar", auth, permitirTipo("SUPER_ADMIN"), limitarSeguranca("autorizacao-global", 10), c.autorizarAdministrativamente)
  app.post("/superadmin/admins/:id/email/confirmacao", auth, permitirTipo("SUPER_ADMIN"), limitarSeguranca("confirmacao-global", 10), c.enviarConfirmacaoAdministrativa)
}
