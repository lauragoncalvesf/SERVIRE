import assert from "node:assert/strict"
import { mock, test, beforeEach } from "node:test"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import express from "express"
import { once } from "node:events"
const senhaAtual = "SenhaAtual12345"
const hash = await bcrypt.hash(senhaAtual, 4)
let usuario
let duplicado
const tx = {
  usuario: {
    findFirst: mock.fn(async ({ where, select }) => {
      if (where.NOT) return duplicado
      if (where.id !== usuario.id || where.paroquiaId !== usuario.paroquiaId || where.versaoSessao !== usuario.versaoSessao) return null
      return Object.fromEntries(Object.keys(select).map(c => [c, usuario[c]]))
    }),
    update: mock.fn(async ({ where, data, select }) => {
      assert.equal(where.id, usuario.id)
      usuario = { ...usuario, ...data, versaoSessao: data.versaoSessao ? usuario.versaoSessao + 1 : usuario.versaoSessao }
      return Object.fromEntries(Object.keys(select).map(c => [c, usuario[c]]))
    })
  },
  conviteAdmin: { updateMany: mock.fn(async () => ({ count: 1 })) },
  auditoriaAdmin: { create: mock.fn(async () => ({})) }
}
mock.module("../src/lib/prisma.js", { defaultExport: { ...tx, $transaction: async callback => callback(tx) } })
const perfil = await import("../src/services/perfilService.js")
const { default: perfilRoutes } = await import("../src/routes/perfilRoutes.js")
const { tratarErros } = await import("../src/middlewares/tratarErros.js")
const sessao = { usuarioId: 7, paroquiaId: 3, versaoSessao: 0 }
process.env.JWT_SECRET = "segredo-exclusivo-do-teste-de-perfil"
beforeEach(() => {
  usuario = { id: 7, nome: "Maria", email: "maria@example.com", telefone: null, ativo: true, tipo: "MEMBRO", paroquiaId: 3, versaoSessao: 0, senha: hash, paroquia: { id: 3, nome: "Paróquia" }, pastorais: [] }
  duplicado = null
  for (const m of [tx.usuario.update, tx.conviteAdmin.updateMany, tx.auditoriaAdmin.create]) m.mock.resetCalls()
})
const dados = { nome: "Maria Nova", email: "maria@example.com" }
const senhas = { senhaAtual, novaSenha: "NovaSenhaSegura123", confirmarSenha: "NovaSenhaSegura123" }

test("consulta usa o ID e paróquia da sessão e não seleciona senha ou versão", async () => {
  const resultado = await perfil.consultarPerfil(sessao)
  assert.equal(resultado.id, 7); assert.equal(resultado.nome, "Maria")
  assert.equal(resultado.senha, undefined); assert.equal(resultado.versaoSessao, undefined)
  assert.equal(tx.usuario.findFirst.mock.calls.at(-1).arguments[0].select.senha, undefined)
})
test("consulta identifica coordenação ativa sem criar perfil global de coordenador", async () => {
  usuario.pastorais = [{ pastoral: { id: 1, nome: "Música", paroquiaId: 3 } }, { pastoral: { id: 9, nome: "Outra", paroquiaId: 4 } }]
  const resultado = await perfil.consultarPerfil(sessao)
  assert.equal(resultado.tipo, "MEMBRO")
  assert.deepEqual(resultado.coordenacoes, [{ id: 1, nome: "Música" }])
})
test("altera nome sem trocar token, paróquia ou perfil", async () => {
  const resultado = await perfil.atualizarPerfil(sessao, { ...dados, nome: " Maria Nova " })
  assert.equal(resultado.usuario.nome, "Maria Nova"); assert.equal(resultado.token, undefined)
  assert.equal(usuario.versaoSessao, 0); assert.equal(usuario.tipo, "MEMBRO"); assert.equal(usuario.paroquiaId, 3)
  assert.equal(tx.conviteAdmin.updateMany.mock.callCount(), 0)
})
test("troca e-mail normalizado com senha atual, revoga tokens e convites antigos", async () => {
  const resultado = await perfil.atualizarPerfil(sessao, { ...dados, email: " NOVO@EXAMPLE.COM ", senhaAtual })
  assert.equal(resultado.usuario.email, "novo@example.com")
  assert.equal(usuario.versaoSessao, 1)
  assert.equal(jwt.verify(resultado.token, process.env.JWT_SECRET).versaoSessao, 1)
  assert.equal(tx.conviteAdmin.updateMany.mock.calls[0].arguments[0].where.usuarioId, 7)
  assert.equal(resultado.usuario.senha, undefined)
})
test("duplicidade respeita o escopo paroquial, rejeita conflito e não revela outra conta", async () => {
  duplicado = { id: 8 }
  await assert.rejects(perfil.atualizarPerfil(sessao, { ...dados, email: "usado@example.com", senhaAtual }), { status: 409 })
  const where = tx.usuario.findFirst.mock.calls.at(-1).arguments[0].where
  assert.equal(where.paroquiaId, 3); assert.deepEqual(where.NOT, { id: 7 })
  assert.equal(tx.usuario.update.mock.callCount(), 0)
})
test("troca de e-mail exige senha atual e senha incorreta retorna 403 sem invalidar sessão", async () => {
  for (const [senha, status] of [[undefined, 400], ["incorreta", 403]]) {
    await assert.rejects(perfil.atualizarPerfil(sessao, { ...dados, email: "novo@example.com", senhaAtual: senha }), { status })
  }
  assert.equal(tx.usuario.update.mock.callCount(), 0)
})
test("rejeita campos de privilégios, paróquia e IDs sem gravação", async () => {
  for (const campo of ["id", "usuarioId", "paroquiaId", "tipo", "ativo", "versaoSessao", "permissoes", "senha"]) {
    await assert.rejects(perfil.atualizarPerfil(sessao, { ...dados, [campo]: "SUPER_ADMIN" }), { status: 400 })
    await assert.rejects(perfil.alterarSenha(sessao, { ...senhas, [campo]: "SUPER_ADMIN" }), { status: 400 })
  }
  assert.equal(tx.usuario.update.mock.callCount(), 0)
})
test("nome e e-mail inválidos são rejeitados", async () => {
  for (const body of [null, [], {}, { ...dados, nome: " " }, { ...dados, nome: "a".repeat(201) }, { ...dados, email: "inválido" }, { ...dados, email: {} }]) {
    await assert.rejects(perfil.atualizarPerfil(sessao, body), { status: 400 })
  }
})
test("alteração de senha válida mantém sessão atual com token renovado e bcrypt", async () => {
  const resultado = await perfil.alterarSenha(sessao, senhas)
  assert(await bcrypt.compare(senhas.novaSenha, usuario.senha)); assert.notEqual(usuario.senha, hash)
  assert.equal(usuario.versaoSessao, 1)
  assert.equal(jwt.verify(resultado.token, process.env.JWT_SECRET).usuarioId, 7)
  assert.equal(resultado.usuario.senha, undefined)
  assert.equal(JSON.stringify(resultado).includes(usuario.senha), false)
})
test("rejeita senha inválida, confirmação diferente, reutilização e senha atual incorreta", async () => {
  for (const [body, status] of [
    [{ ...senhas, novaSenha: "curta" }, 400], [{ ...senhas, confirmarSenha: "OutraSenha12345" }, 400],
    [{ ...senhas, senhaAtual: "incorreta" }, 403], [{ senhaAtual, novaSenha: senhaAtual, confirmarSenha: senhaAtual }, 400],
    [{ ...senhas, novaSenha: "a".repeat(72) + "1", confirmarSenha: "a".repeat(72) + "1" }, 400]
  ]) await assert.rejects(perfil.alterarSenha(sessao, body), { status })
  assert.equal(tx.usuario.update.mock.callCount(), 0)
})
test("requisição em andamento com versão antiga não altera conta", async () => {
  usuario.versaoSessao = 1
  await assert.rejects(perfil.atualizarPerfil(sessao, dados), { status: 401 })
  await assert.rejects(perfil.alterarSenha(sessao, senhas), { status: 401 })
  assert.equal(tx.usuario.update.mock.callCount(), 0)
})
test("conta global consulta e edita próprio perfil com vínculo nulo", async () => {
  usuario.tipo = "SUPER_ADMIN"; usuario.paroquiaId = null; usuario.paroquia = null
  const global = { ...sessao, paroquiaId: null }
  assert.equal((await perfil.consultarPerfil(global)).tipo, "SUPER_ADMIN")
  const resultado = await perfil.atualizarPerfil(global, { ...dados, email: "global@example.com", senhaAtual })
  assert.equal(jwt.verify(resultado.token, process.env.JWT_SECRET).paroquiaId, null)
})
test("endpoints rejeitam requisições não autenticadas", async t => {
  const app = express(); app.use(express.json()); perfilRoutes(app); app.use(tratarErros)
  const server = app.listen(0, "127.0.0.1")
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }))
  await once(server, "listening")
  for (const [url, method] of [["/meu-perfil", "GET"], ["/meu-perfil", "PATCH"], ["/meu-perfil/senha", "PUT"]]) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${url}`, { method })
    assert.equal(res.status, 401)
  }
})
