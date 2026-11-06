import * as perfil from "../services/perfilService.js"

export async function consultar(req, res) {
  res.set("Cache-Control", "no-store").json(await perfil.consultarPerfil(req))
}
export async function atualizar(req, res) {
  res.set("Cache-Control", "no-store").json(await perfil.atualizarPerfil(req, req.body))
}
export async function atualizarSenha(req, res) {
  res.set("Cache-Control", "no-store").json(await perfil.alterarSenha(req, req.body))
}
