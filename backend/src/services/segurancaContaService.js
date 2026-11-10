import bcrypt from "bcrypt"
import { randomBytes } from "node:crypto"
import prisma from "../lib/prisma.js"
import { executarTransacao } from "./transacao.js"
import { auditar, falhar, validarSenha, idValido } from "./superadminService.js"
import { consumirLimite, hashSeguranca } from "./limiteSegurancaService.js"
import { enviarEmailSeguranca } from "./emailSegurancaService.js"

const normalizar = valor => typeof valor === "string" ? valor.trim().toLowerCase() : ""
const ativo = { ativo: true, OR: [{ tipo: "SUPER_ADMIN", paroquiaId: null }, { paroquia: { ativa: true } }] }
function corpo(body, campos) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(c => !campos.includes(c))) falhar(400, "Dados inválidos")
}
async function bloquear(tx, id) { await tx.$queryRaw`SELECT "id" FROM "Usuario" WHERE "id" = ${id} FOR UPDATE` }
async function buscar(tx, id) {
  return tx.usuario.findFirst({ where: { id, ...ativo }, include: { paroquia: { select: { id: true, nome: true } } } })
}
async function autenticar(tx, sessao, senha) {
  await bloquear(tx, sessao.usuarioId)
  const autor = await buscar(tx, sessao.usuarioId)
  if (!autor || autor.paroquiaId !== sessao.paroquiaId || autor.versaoSessao !== sessao.versaoSessao) falhar(401, "Sessão indisponível")
  if (typeof senha !== "string" || !senha) falhar(400, "Informe sua senha atual")
  if (!await bcrypt.compare(senha, autor.senha)) falhar(403, "Senha atual incorreta")
  return autor
}
async function destinatarioAdministrativo(tx, autor, id, emailEsperado) {
  if (autor.id === id) falhar(403, "Use Meu Perfil para sua própria conta")
  await bloquear(tx, id)
  const usuario = await buscar(tx, id)
  if (!usuario) falhar(404, "Conta indisponível")
  const permitido = (autor.tipo === "ADMIN" && usuario.tipo === "MEMBRO" && autor.paroquiaId === usuario.paroquiaId)
    || (autor.tipo === "SUPER_ADMIN" && usuario.tipo === "ADMIN")
  if (!permitido) falhar(403, "Você não pode autorizar o endereço desta conta")
  if (normalizar(emailEsperado) !== normalizar(usuario.email)) falhar(409, "O endereço mudou. Atualize a página antes de continuar")
  return usuario
}
async function invalidar(tx, usuarioId) {
  await tx.tokenSeguranca.updateMany({ where: { usuarioId, consumidoEm: null }, data: { consumidoEm: new Date() } })
}
async function emitir(tx, usuario, finalidade) {
  const base = `envio:${usuario.id}:${finalidade}`
  if (!await consumirLimite(tx, `${base}:cooldown`, 1, 60)) return null
  if (!await consumirLimite(tx, `${base}:hora`, 3, 3600)) return null
  await tx.tokenSeguranca.updateMany({ where: { usuarioId: usuario.id, finalidade, consumidoEm: null }, data: { consumidoEm: new Date() } })
  const token = randomBytes(32).toString("hex")
  const tokenHash = hashSeguranca(token)
  await tx.tokenSeguranca.create({ data: { usuarioId: usuario.id, finalidade, tokenHash, emailHash: hashSeguranca(normalizar(usuario.email)), versaoSessao: usuario.versaoSessao, expiraEm: new Date(Date.now() + 30 * 60000) } })
  return { usuario, token, tokenHash, finalidade }
}
export async function autorizarEmailAdministrativo(sessao, id, body) {
  corpo(body, ["senhaAtual", "emailEsperado", "identidadeConferida"])
  if (body.identidadeConferida !== true) falhar(400, "Confirme a verificação independente da identidade")
  return executarTransacao(async tx => {
    const autor = await autenticar(tx, sessao, body.senhaAtual)
    const usuario = await destinatarioAdministrativo(tx, autor, idValido(id), body.emailEsperado)
    await invalidar(tx, usuario.id)
    await tx.usuario.update({ where: { id: usuario.id }, data: { emailAutorizadoEm: new Date(), emailAutorizadoPor: autor.id, emailConfirmadoEm: null } })
    await auditar(tx, autor.id, "AUTORIZAR_EMAIL_IDENTIDADE_CONFERIDA", "Usuario", usuario.id)
    return { mensagem: "Vínculo autorizado. Envie a confirmação ao titular." }
  })
}
export async function solicitarConfirmacao(sessao, body, id = null) {
  corpo(body, ["senhaAtual", "emailEsperado"])
  const entrega = await executarTransacao(async tx => {
    const autor = await autenticar(tx, sessao, body.senhaAtual)
    const usuario = id === null ? autor : await destinatarioAdministrativo(tx, autor, idValido(id), body.emailEsperado)
    if (normalizar(body.emailEsperado) !== normalizar(usuario.email)) falhar(409, "O endereço mudou. Atualize a página")
    if (id !== null && !usuario.emailAutorizadoEm) falhar(409, "Autorize o vínculo antes de enviar a confirmação")
    if (usuario.emailAutorizadoEm && usuario.emailConfirmadoEm) return { confirmado: true }
    const token = await emitir(tx, usuario, "CONFIRMAR_EMAIL")
    if (!token) return null
    if (id === null && !usuario.emailAutorizadoEm) {
      await tx.usuario.update({ where: { id: usuario.id }, data: { emailAutorizadoEm: new Date(), emailAutorizadoPor: usuario.id, emailConfirmadoEm: null } })
      await auditar(tx, usuario.id, "AUTORIZAR_PROPRIO_EMAIL_COM_SENHA", "Usuario", usuario.id)
    }
    await auditar(tx, autor.id, "SOLICITAR_CONFIRMACAO_EMAIL", "Usuario", usuario.id)
    return token
  })
  if (!entrega) falhar(429, "Aguarde 60 segundos entre envios. Limite de 3 envios por hora.")
  if (entrega.confirmado) return { mensagem: "Este endereço já está confirmado." }
  const envio = await enviarEmailSeguranca(entrega)
  return { mensagem: envio.status === "enviado" ? "Confirmação enviada. Verifique seu e-mail e a pasta de spam." : "Envio não confirmado. Tente novamente após o intervalo permitido.", envio }
}
export function validarSolicitacaoPublica(body) {
  corpo(body, ["email", "paroquiaId"])
  const email = normalizar(body.email)
  if (!email || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falhar(400, "Informe um e-mail válido")
  const paroquiaId = body.paroquiaId == null || body.paroquiaId === "" ? null : idValido(body.paroquiaId)
  return { email, paroquiaId }
}
export async function processarRecuperacao({ email, paroquiaId }) {
  const entrega = await executarTransacao(async tx => {
    // Nunca usar findFirst e escolher uma conta arbitrária em dados legados ambíguos.
    const contas = await tx.usuario.findMany({ where: { email: { equals: email, mode: "insensitive" }, paroquiaId, ...(paroquiaId === null ? { tipo: "SUPER_ADMIN" } : {}) }, take: 2, select: { id: true } })
    if (contas.length !== 1) return null
    await bloquear(tx, contas[0].id)
    const usuario = await buscar(tx, contas[0].id)
    if (!usuario || usuario.paroquiaId !== paroquiaId || normalizar(usuario.email) !== email || !usuario.emailAutorizadoEm || !usuario.emailConfirmadoEm) return null
    const token = await emitir(tx, usuario, "RECUPERAR_SENHA")
    if (token) await auditar(tx, usuario.id, "SOLICITAR_RECUPERACAO", "Usuario", usuario.id)
    return token
  })
  if (entrega) await enviarEmailSeguranca(entrega)
}
async function consumir(tx, token, finalidade) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) falhar(400, "Link inválido ou expirado")
  const registro = await tx.tokenSeguranca.findUnique({ where: { tokenHash: hashSeguranca(token) } })
  if (!registro || registro.finalidade !== finalidade) falhar(400, "Link inválido ou expirado")
  await bloquear(tx, registro.usuarioId)
  const usuario = await buscar(tx, registro.usuarioId)
  if (!usuario || !usuario.emailAutorizadoEm || (finalidade === "RECUPERAR_SENHA" && !usuario.emailConfirmadoEm)
    || registro.emailHash !== hashSeguranca(normalizar(usuario.email)) || registro.versaoSessao !== usuario.versaoSessao) falhar(400, "Link inválido ou expirado")
  const consumo = await tx.tokenSeguranca.updateMany({ where: { id: registro.id, finalidade, consumidoEm: null, expiraEm: { gt: new Date() } }, data: { consumidoEm: new Date() } })
  if (consumo.count !== 1) falhar(400, "Link inválido ou expirado")
  return usuario
}
export async function confirmarEmail(body) {
  corpo(body, ["token"])
  return executarTransacao(async tx => {
    const usuario = await consumir(tx, body.token, "CONFIRMAR_EMAIL")
    await tx.usuario.update({ where: { id: usuario.id }, data: { emailConfirmadoEm: new Date() } })
    await auditar(tx, usuario.id, "CONFIRMAR_EMAIL", "Usuario", usuario.id)
    return { mensagem: "E-mail confirmado. A recuperação de senha está habilitada." }
  })
}
export async function redefinirSenha(body) {
  corpo(body, ["token", "novaSenha", "confirmarSenha"])
  validarSenha(body.novaSenha)
  if (body.novaSenha !== body.confirmarSenha) falhar(400, "A confirmação da senha não confere")
  return executarTransacao(async tx => {
    const usuario = await consumir(tx, body.token, "RECUPERAR_SENHA")
    if (await bcrypt.compare(body.novaSenha, usuario.senha)) falhar(400, "Escolha uma senha diferente da atual")
    const senha = await bcrypt.hash(body.novaSenha, 12)
    await tx.usuario.update({ where: { id: usuario.id }, data: { senha, versaoSessao: { increment: 1 } } })
    await invalidar(tx, usuario.id)
    await tx.conviteAdmin.updateMany({ where: { usuarioId: usuario.id, consumidoEm: null }, data: { consumidoEm: new Date() } })
    await auditar(tx, usuario.id, "REDEFINIR_SENHA", "Usuario", usuario.id)
    return { mensagem: "Senha redefinida. Entre novamente com sua nova senha." }
  })
}
