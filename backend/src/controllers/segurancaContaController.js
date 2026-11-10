import * as s from "../services/segurancaContaService.js"
import { enfileirarSeguranca } from "../services/filaSegurancaService.js"

export function solicitarRecuperacao(req, res) {
  const dados = s.validarSolicitacaoPublica(req.body)
  res.once("finish", () => enfileirarSeguranca(() => s.processarRecuperacao(dados)))
  res.set("Cache-Control", "no-store").status(202).json({ mensagem: "Se houver uma conta elegível com esses dados, enviaremos as instruções. Caso não receba, procure o responsável pelo seu cadastro." })
}
export async function confirmar(req, res) {
  res.set("Cache-Control", "no-store").json(await s.confirmarEmail(req.body))
}
export async function redefinir(req, res) {
  res.set("Cache-Control", "no-store").json(await s.redefinirSenha(req.body))
}
export async function solicitarConfirmacaoPessoal(req, res) {
  res.set("Cache-Control", "no-store").json(await s.solicitarConfirmacao(req, req.body))
}
export async function autorizarAdministrativamente(req, res) {
  res.set("Cache-Control", "no-store").json(await s.autorizarEmailAdministrativo(req, req.params.id, req.body))
}
export async function enviarConfirmacaoAdministrativa(req, res) {
  res.set("Cache-Control", "no-store").json(await s.solicitarConfirmacao(req, req.body, req.params.id))
}
