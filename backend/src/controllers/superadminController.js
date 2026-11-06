import prisma from "../lib/prisma.js"
import { randomBytes } from "node:crypto"
import bcrypt from "bcrypt"
import { executarTransacao } from "../services/transacao.js"
import { usuarioSeguro, idValido, dadosPessoa, falhar, auditar, emitirConvite, protegerUltimoAdmin, aceitarConvite } from "../services/superadminService.js"

export async function dashboard(req, res) {
  const [total, ativas, administradores] = await Promise.all([prisma.paroquia.count(), prisma.paroquia.count({ where: { ativa: true } }), prisma.usuario.count({ where: { tipo: "ADMIN" } })])
  res.json({ total, ativas, inativas: total - ativas, administradores })
}
export async function listar(req, res) {
  const pagina = idValido(req.query.pagina ?? 1)
  const busca = String(req.query.busca ?? "").trim().slice(0, 200)
  if (req.query.status && !["ativa", "inativa"].includes(req.query.status)) falhar(400, "Status inválido")
  const where = { ...(req.query.status ? { ativa: req.query.status === "ativa" } : {}), ...(busca ? { OR: ["nome", "cidade"].map(campo => ({ [campo]: { contains: busca, mode: "insensitive" } })) } : {}) }
  const [dados, total] = await Promise.all([prisma.paroquia.findMany({ where, orderBy: { nome: "asc" }, skip: (pagina - 1) * 20, take: 20 }), prisma.paroquia.count({ where })])
  res.json({ dados, total, pagina })
}
export async function detalhes(req, res) {
  const paroquia = await prisma.paroquia.findUnique({ where: { id: idValido(req.params.id) } })
  if (!paroquia) falhar(404, "Paróquia não encontrada")
  res.json(paroquia)
}
export async function salvarParoquia(req, res) {
  const id = req.params.id ? idValido(req.params.id) : null
  const dados = dadosPessoa(req.body, true)
  const resultado = await executarTransacao(async tx => {
    if (id && !await tx.paroquia.findUnique({ where: { id } })) falhar(404, "Paróquia não encontrada")
    const duplicada = await tx.paroquia.findFirst({ where: { nome: { equals: dados.nome, mode: "insensitive" }, cidade: dados.cidade ? { equals: dados.cidade, mode: "insensitive" } : null, estado: dados.estado, ...(id ? { NOT: { id } } : {}) } })
    if (duplicada) falhar(409, "Já existe paróquia com esse nome, cidade e estado")
    const paroquia = id ? await tx.paroquia.update({ where: { id }, data: dados }) : await tx.paroquia.create({ data: dados })
    await auditar(tx, req.usuarioId, id ? "EDITAR" : "CRIAR", "Paroquia", paroquia.id)
    return paroquia
  })
  res.status(id ? 200 : 201).json(resultado)
}
export async function statusParoquia(req, res) {
  const id = idValido(req.params.id)
  if (typeof req.body?.ativa !== "boolean") falhar(400, "Status inválido")
  res.json(await executarTransacao(async tx => {
    if (!await tx.paroquia.findUnique({ where: { id } })) falhar(404, "Paróquia não encontrada")
    const paroquia = await tx.paroquia.update({ where: { id }, data: { ativa: req.body.ativa } })
    // Revogação permanente: tokens anteriores não voltam a funcionar na reativação.
    await tx.usuario.updateMany({ where: { paroquiaId: id }, data: { versaoSessao: { increment: 1 } } })
    await auditar(tx, req.usuarioId, req.body.ativa ? "ATIVAR" : "DESATIVAR", "Paroquia", id)
    return paroquia
  }))
}
export async function listarAdmins(req, res) {
  const paroquiaId = idValido(req.params.id)
  if (!await prisma.paroquia.findUnique({ where: { id: paroquiaId } })) falhar(404, "Paróquia não encontrada")
  res.json(await prisma.usuario.findMany({ where: { paroquiaId, tipo: "ADMIN" }, select: usuarioSeguro, orderBy: { nome: "asc" } }))
}
export async function criarAdmin(req, res) {
  const paroquiaId = idValido(req.params.id)
  const dados = dadosPessoa(req.body)
  const senha = await bcrypt.hash(randomBytes(32).toString("hex"), 12)
  const resultado = await executarTransacao(async tx => {
    if (!await tx.paroquia.findFirst({ where: { id: paroquiaId, ativa: true } })) falhar(400, "Paróquia inexistente ou inativa")
    if (await tx.usuario.findFirst({ where: { paroquiaId, email: { equals: dados.email, mode: "insensitive" } } })) falhar(409, "E-mail já cadastrado nesta paróquia")
    const usuario = await tx.usuario.create({ data: { ...dados, senha, paroquiaId, tipo: "ADMIN" }, select: usuarioSeguro })
    const convite = await emitirConvite(tx, usuario.id)
    await auditar(tx, req.usuarioId, "CRIAR_ADMIN", "Usuario", usuario.id)
    return { usuario, convite }
  })
  res.set("Cache-Control", "no-store").status(201).json(resultado)
}
export async function editarAdmin(req, res) {
  const id = idValido(req.params.id)
  const dados = dadosPessoa(req.body)
  res.json(await executarTransacao(async tx => {
    const usuario = await tx.usuario.findFirst({ where: { id, tipo: "ADMIN" } })
    if (!usuario) falhar(404, "Administrador não encontrado")
    if (await tx.usuario.findFirst({ where: { paroquiaId: usuario.paroquiaId, email: { equals: dados.email, mode: "insensitive" }, NOT: { id } } })) falhar(409, "E-mail já cadastrado nesta paróquia")
    if (dados.email !== usuario.email) await tx.conviteAdmin.updateMany({ where: { usuarioId: id, consumidoEm: null }, data: { consumidoEm: new Date() } })
    const atualizado = await tx.usuario.update({ where: { id }, data: { ...dados, versaoSessao: { increment: 1 } }, select: usuarioSeguro })
    await auditar(tx, req.usuarioId, "EDITAR_ADMIN", "Usuario", id)
    return atualizado
  }))
}
export async function statusAdmin(req, res) {
  const id = idValido(req.params.id)
  if (typeof req.body?.ativo !== "boolean") falhar(400, "Status inválido")
  res.json(await executarTransacao(async tx => {
    const usuario = await tx.usuario.findFirst({ where: { id, tipo: "ADMIN" } })
    if (!usuario) falhar(404, "Administrador não encontrado")
    if (!req.body.ativo) await protegerUltimoAdmin(tx, usuario)
    if (req.body.ativo && !await tx.paroquia.findFirst({ where: { id: usuario.paroquiaId, ativa: true } })) falhar(409, "Paróquia inativa")
    const atualizado = await tx.usuario.update({ where: { id }, data: { ativo: req.body.ativo, versaoSessao: { increment: 1 } }, select: usuarioSeguro })
    await tx.conviteAdmin.updateMany({ where: { usuarioId: id, consumidoEm: null }, data: { consumidoEm: new Date() } })
    await auditar(tx, req.usuarioId, req.body.ativo ? "ATIVAR_ADMIN" : "DESATIVAR_ADMIN", "Usuario", id)
    return atualizado
  }))
}
export async function conviteAdmin(req, res) {
  const id = idValido(req.params.id)
  res.set("Cache-Control", "no-store").json(await executarTransacao(async tx => {
    if (!await tx.usuario.findFirst({ where: { id, tipo: "ADMIN", ativo: true, paroquia: { ativa: true } } })) falhar(404, "Administrador indisponível")
    const convite = await emitirConvite(tx, id)
    await auditar(tx, req.usuarioId, "EMITIR_CONVITE", "Usuario", id)
    return { convite }
  }))
}
export async function transferir(req, res) {
  const id = idValido(req.params.id)
  const sucessorId = idValido(req.body?.sucessorId)
  if (id === sucessorId) falhar(400, "Selecione outro administrador")
  res.json(await executarTransacao(async tx => {
    const atual = await tx.usuario.findFirst({ where: { id, tipo: "ADMIN", ativo: true } })
    if (!atual) falhar(404, "Administrador não encontrado")
    const sucessor = await tx.usuario.findFirst({ where: { id: sucessorId, tipo: "ADMIN", ativo: true, paroquiaId: atual.paroquiaId, paroquia: { ativa: true } } })
    if (!sucessor || await tx.conviteAdmin.count({ where: { usuarioId: sucessorId, consumidoEm: null } })) falhar(409, "Sucessor deve ser administrador ativo da mesma paróquia com convite aceito")
    await tx.usuario.update({ where: { id }, data: { tipo: "MEMBRO", versaoSessao: { increment: 1 } } })
    await tx.conviteAdmin.updateMany({ where: { usuarioId: id, consumidoEm: null }, data: { consumidoEm: new Date() } })
    await auditar(tx, req.usuarioId, `TRANSFERIR_PARA_${sucessorId}`, "Usuario", id)
    return { mensagem: "Administração transferida; conta anterior mantida como membro" }
  }))
}
export async function aceitar(req, res) { res.json(await aceitarConvite(req.body?.token, req.body?.senha)) }
export async function sessao(req, res) {
  res.set("Cache-Control", "no-store").json(await prisma.usuario.findUnique({ where: { id: req.usuarioId }, select: { ...usuarioSeguro, paroquia: { select: { id: true, nome: true } } } }))
}
