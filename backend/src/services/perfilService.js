import bcrypt from "bcrypt"
import prisma from "../lib/prisma.js"
import { executarTransacao } from "./transacao.js"
import { auditar, falhar, validarSenha, usuarioSeguro } from "./superadminService.js"
import { assinarToken } from "./sessaoService.js"

const selecaoPerfil = {
  ...usuarioSeguro,
  emailAutorizadoEm: true,
  emailConfirmadoEm: true,
  paroquia: { select: { id: true, nome: true } },
  pastorais: {
    where: { ativo: true, papel: "COORDENADOR", pastoral: { ativa: true } },
    select: { pastoral: { select: { id: true, nome: true, paroquiaId: true } } }
  }
}
function publico(usuario) {
  const { pastorais = [], senha, versaoSessao, ...perfil } = usuario
  void senha; void versaoSessao
  return { ...perfil, coordenacoes: pastorais.filter(v => v.pastoral.paroquiaId === usuario.paroquiaId).map(v => ({ id: v.pastoral.id, nome: v.pastoral.nome })) }
}
function proprietario(sessao) {
  return {
    id: sessao.usuarioId, paroquiaId: sessao.paroquiaId,
    ativo: true, versaoSessao: sessao.versaoSessao,
    ...(sessao.paroquiaId === null ? { tipo: "SUPER_ADMIN" } : { paroquia: { ativa: true } })
  }
}
function validarCorpo(body, campos) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(campo => !campos.includes(campo))) {
    falhar(400, "Informe somente os campos permitidos para seu perfil")
  }
}
async function confirmarSenha(senhaAtual, hash) {
  if (typeof senhaAtual !== "string" || !senhaAtual) falhar(400, "Informe a senha atual")
  if (!await bcrypt.compare(senhaAtual, hash)) falhar(403, "Senha atual incorreta")
}
export async function consultarPerfil(sessao) {
  const usuario = await prisma.usuario.findFirst({ where: proprietario(sessao), select: selecaoPerfil })
  if (!usuario) falhar(401, "Sessão indisponível. Entre novamente.")
  return publico(usuario)
}
export async function atualizarPerfil(sessao, body) {
  validarCorpo(body, ["nome", "email", "senhaAtual"])
  if (typeof body.nome !== "string" || !body.nome.trim() || body.nome.trim().length > 200) falhar(400, "Informe nome com até 200 caracteres")
  if (typeof body.email !== "string" || body.email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) falhar(400, "Informe um e-mail válido")
  const nome = body.nome.trim()
  const email = body.email.trim().toLowerCase()
  return executarTransacao(async tx => {
    const atual = await tx.usuario.findFirst({ where: proprietario(sessao), select: { ...selecaoPerfil, senha: true, versaoSessao: true } })
    if (!atual) falhar(401, "Sessão indisponível. Entre novamente.")
    const mudouEmail = email !== atual.email.trim().toLowerCase()
    if (mudouEmail) {
      await confirmarSenha(body.senhaAtual, atual.senha)
      const duplicado = await tx.usuario.findFirst({
        where: { paroquiaId: atual.paroquiaId, email: { equals: email, mode: "insensitive" }, NOT: { id: atual.id } }, select: { id: true }
      })
      if (duplicado) falhar(409, "E-mail indisponível para esta conta")
      await tx.conviteAdmin.updateMany({ where: { usuarioId: atual.id, consumidoEm: null }, data: { consumidoEm: new Date() } })
    }
    const usuario = await tx.usuario.update({
      where: { id: atual.id },
      data: { nome, email, ...(mudouEmail ? { versaoSessao: { increment: 1 } } : {}) },
      select: { ...selecaoPerfil, versaoSessao: true }
    })
    await auditar(tx, atual.id, "EDITAR_PROPRIO_PERFIL", "Usuario", atual.id)
    return { usuario: publico(usuario), ...(mudouEmail ? { token: assinarToken(usuario) } : {}), mensagem: "Dados atualizados com sucesso." }
  })
}
export async function alterarSenha(sessao, body) {
  validarCorpo(body, ["senhaAtual", "novaSenha", "confirmarSenha"])
  validarSenha(body.novaSenha)
  if (body.novaSenha !== body.confirmarSenha) falhar(400, "A confirmação da nova senha não confere")
  return executarTransacao(async tx => {
    const atual = await tx.usuario.findFirst({ where: proprietario(sessao), select: { ...selecaoPerfil, senha: true, versaoSessao: true } })
    if (!atual) falhar(401, "Sessão indisponível. Entre novamente.")
    await confirmarSenha(body.senhaAtual, atual.senha)
    if (await bcrypt.compare(body.novaSenha, atual.senha)) falhar(400, "A nova senha deve ser diferente da senha atual")
    const senha = await bcrypt.hash(body.novaSenha, 12)
    const usuario = await tx.usuario.update({ where: { id: atual.id }, data: { senha, versaoSessao: { increment: 1 } }, select: { ...selecaoPerfil, versaoSessao: true } })
    await tx.conviteAdmin.updateMany({ where: { usuarioId: atual.id, consumidoEm: null }, data: { consumidoEm: new Date() } })
    await auditar(tx, atual.id, "ALTERAR_PROPRIA_SENHA", "Usuario", atual.id)
    return { usuario: publico(usuario), token: assinarToken(usuario), mensagem: "Senha atualizada. As outras sessões foram encerradas." }
  })
}
