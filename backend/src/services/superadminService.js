import { createHash, randomBytes } from "node:crypto"
import bcrypt from "bcrypt"
import { executarTransacao } from "./transacao.js"

export const usuarioSeguro = { id: true, nome: true, email: true, telefone: true, ativo: true, tipo: true, paroquiaId: true }
export function falhar(status, mensagem) { throw Object.assign(new Error(mensagem), { status, publica: true }) }
export function idValido(valor) {
  if (!["string", "number"].includes(typeof valor) || !/^\d+$/.test(String(valor))) falhar(400, "Identificador inválido")
  const id = Number(valor)
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) falhar(400, "Identificador inválido")
  return id
}
export function dadosPessoa(body, paroquia = false) {
  const dados = {}
  if (typeof body?.nome !== "string" || !body.nome.trim() || body.nome.length > 200) falhar(400, "Nome obrigatório, até 200 caracteres")
  dados.nome = body.nome.trim()
  for (const campo of paroquia ? ["cidade", "estado", "telefone", "email"] : ["telefone", "email"]) {
    const valor = body[campo]
    if (valor != null && (typeof valor !== "string" || valor.length > 200)) falhar(400, `${campo} inválido`)
    dados[campo] = valor?.trim() || null
  }
  if (!paroquia && !dados.email) falhar(400, "E-mail obrigatório")
  if (dados.email) {
    dados.email = dados.email.toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) falhar(400, "E-mail inválido")
  }
  if (paroquia && dados.estado) {
    dados.estado = dados.estado.toUpperCase()
    if (!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(dados.estado)) falhar(400, "Estado deve ser uma UF válida")
  }
  if (dados.telefone && !/^[+()\d\s.-]{8,25}$/.test(dados.telefone)) falhar(400, "Telefone inválido")
  return dados
}
export function validarSenha(senha) {
  if (typeof senha !== "string" || senha.length < 12 || Buffer.byteLength(senha) > 72 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) falhar(400, "Senha deve ter ao menos 12 caracteres, letras e números e até 72 bytes")
}
export const hashToken = token => createHash("sha256").update(token).digest("hex")
export async function auditar(tx, autorId, acao, recurso, recursoId) {
  await tx.auditoriaAdmin.create({ data: { autorId, acao, recurso, recursoId } })
}
export async function emitirConvite(tx, usuarioId) {
  await tx.conviteAdmin.updateMany({ where: { usuarioId, consumidoEm: null }, data: { consumidoEm: new Date() } })
  const token = randomBytes(32).toString("hex")
  const expiraEm = new Date(Date.now() + 48 * 3600000)
  await tx.conviteAdmin.create({ data: { usuarioId, tokenHash: hashToken(token), expiraEm } })
  return { token, expiraEm }
}
export async function protegerUltimoAdmin(tx, usuario) {
  const paroquia = await tx.paroquia.findUnique({ where: { id: usuario.paroquiaId } })
  if (paroquia?.ativa && usuario.ativo && await tx.usuario.count({ where: { paroquiaId: usuario.paroquiaId, tipo: "ADMIN", ativo: true, NOT: { id: usuario.id } } }) === 0) falhar(409, "A paróquia ativa precisa manter um administrador ativo")
}
export async function aceitarConvite(token, senha) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) falhar(400, "Convite inválido ou expirado")
  validarSenha(senha)
  const senhaHash = await bcrypt.hash(senha, 12)
  return executarTransacao(async tx => {
    const convite = await tx.conviteAdmin.findUnique({ where: { tokenHash: hashToken(token) }, include: { usuario: { include: { paroquia: true } } } })
    if (!convite || convite.consumidoEm || convite.expiraEm <= new Date() || convite.usuario.tipo !== "ADMIN" || !convite.usuario.ativo || !convite.usuario.paroquia?.ativa) falhar(400, "Convite inválido ou expirado")
    const consumo = await tx.conviteAdmin.updateMany({ where: { id: convite.id, consumidoEm: null, expiraEm: { gt: new Date() } }, data: { consumidoEm: new Date() } })
    if (consumo.count !== 1) falhar(400, "Convite inválido ou expirado")
    await tx.usuario.update({ where: { id: convite.usuarioId }, data: { senha: senhaHash, versaoSessao: { increment: 1 } } })
    await auditar(tx, convite.usuarioId, "ACEITAR_CONVITE", "Usuario", convite.usuarioId)
    return { mensagem: "Senha definida. Entre com sua paróquia, e-mail e nova senha." }
  })
}
