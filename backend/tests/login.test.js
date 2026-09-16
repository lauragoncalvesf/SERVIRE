import assert from "node:assert/strict"
import { mock, test } from "node:test"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"

const findFirst = mock.fn()
mock.module("../src/lib/prisma.js", { defaultExport: { usuario: { findFirst } } })
const { login } = await import("../src/controllers/authController.js")
const dados = { email: "teste@example.com", senha: " senha com espaços ", paroquiaId: 3 }
const hash = await bcrypt.hash(dados.senha, 4)
const usuario = {
  id: 7, nome: "Teste", email: dados.email, senha: hash,
  tipo: "MEMBRO", paroquiaId: 3, paroquia: { id: 3, nome: "Paróquia" }
}

async function executar(body) {
  const res = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
  const next = mock.fn()
  await login({ body }, res, next)
  return { res, next }
}

test("rejeita dados inválidos sem consultar o banco", async () => {
  findFirst.mock.resetCalls()
  const invalidos = [undefined, null, {}, ...[
    ["email", {}], ["email", [dados.email]], ["email", "   "],
    ["senha", 123], ["senha", {}], ["senha", ""],
    ...[true, [3], {}, "abc", -1, 0, 1.5, 2147483648].map(id => ["paroquiaId", id])
  ].map(([campo, valor]) => ({ ...dados, [campo]: valor }))]
  for (const body of invalidos) {
    const { res, next } = await executar(body)
    assert.equal(res.code, 400)
    assert.equal(next.mock.callCount(), 0)
  }
  assert.equal(findFirst.mock.callCount(), 0)
})

test("login usa usuário e paróquia ativos e emite token compatível sem expor hash", async (t) => {
  const original = process.env.JWT_SECRET
  process.env.JWT_SECRET = "segredo-do-teste-login"
  t.after(() => {
    if (original === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = original
  })
  findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, {
      email: dados.email, paroquiaId: 3, ativo: true, paroquia: { ativa: true }
    })
    return usuario
  })
  const { res, next } = await executar({ ...dados, paroquiaId: "3" })
  assert.equal(next.mock.callCount(), 0)
  assert.equal(res.code, undefined)
  assert.deepEqual(res.body.usuario, {
    id: 7, nome: "Teste", email: dados.email, tipo: "MEMBRO", paroquia: usuario.paroquia
  })
  const payload = jwt.verify(res.body.token, process.env.JWT_SECRET, { algorithms: ["HS256"] })
  assert.equal(payload.usuarioId, 7)
  assert.equal(payload.paroquiaId, 3)
  assert.equal(payload.tipo, "MEMBRO")
  assert.equal(payload.exp - payload.iat, 7 * 24 * 60 * 60)
  assert.equal(JSON.stringify(res.body).includes(hash), false)
})

test("usuário indisponível e senha incorreta retornam a mesma resposta", async () => {
  findFirst.mock.mockImplementation(async () => null)
  const ausente = await executar(dados)
  findFirst.mock.mockImplementation(async () => usuario)
  const incorreta = await executar({ ...dados, senha: dados.senha.trim() })
  for (const { res, next } of [ausente, incorreta]) {
    assert.equal(res.code, 401)
    assert.deepEqual(res.body, { mensagem: "Email ou senha inválidos" })
    assert.equal(next.mock.callCount(), 0)
  }
})

test("falhas do banco seguem para o tratamento central", async () => {
  const erro = new Error("Falha simulada")
  findFirst.mock.mockImplementation(async () => { throw erro })
  const { res, next } = await executar(dados)
  assert.equal(res.body, undefined)
  assert.equal(next.mock.callCount(), 1)
  assert.equal(next.mock.calls[0].arguments[0], erro)
})
