import assert from "node:assert/strict"
import { mock, test } from "node:test"
import jwt from "jsonwebtoken"

const findFirst = mock.fn()
mock.module("../src/lib/prisma.js", {
  defaultExport: { usuario: { findFirst } }
})
const { auth } = await import("../src/middlewares/auth.js")
const segredo = "segredo-exclusivo-dos-testes"
const claims = { usuarioId: 7, paroquiaId: 3, tipo: "ADMIN" }
const assinar = (payload = claims, options = {}) =>
  jwt.sign(payload, segredo, { expiresIn: "1h", ...options })

async function executar(t, authorization) {
  const original = process.env.JWT_SECRET
  process.env.JWT_SECRET = segredo
  t.after(() => {
    if (original === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = original
  })
  const req = { headers: { authorization } }
  const res = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
  const next = mock.fn()
  await auth(req, res, next)
  return { req, res, next }
}

for (const [nome, authorization] of [
  ["sem token", undefined],
  ["sem Bearer", "Basic abc"],
  ["campos extras", `Bearer ${assinar()} extra`],
  ["token malformado", "Bearer abc"],
  ["assinatura inválida", `Bearer ${jwt.sign(claims, "outro-segredo")}`],
  ["expirado", `Bearer ${assinar(claims, { expiresIn: -1 })}`],
  ["algoritmo diferente", `Bearer ${assinar(claims, { algorithm: "HS384" })}`],
  ["sem expiração", `Bearer ${jwt.sign(claims, segredo)}`],
  ["sem usuário", `Bearer ${assinar({ paroquiaId: 3 })}`],
  ["sem paróquia", `Bearer ${assinar({ usuarioId: 7 })}`],
  ["ID como texto", `Bearer ${assinar({ ...claims, usuarioId: "7" })}`],
  ["ID negativo", `Bearer ${assinar({ ...claims, paroquiaId: -1 })}`],
  ["ID fracionado", `Bearer ${assinar({ ...claims, usuarioId: 1.5 })}`]
]) {
  test(`rejeita ${nome} antes de consultar o banco`, async (t) => {
    findFirst.mock.resetCalls()
    const { req, res, next } = await executar(t, authorization)
    assert.equal(res.code, 401)
    assert.equal(next.mock.callCount(), 0)
    assert.equal(findFirst.mock.callCount(), 0)
    assert.equal(req.usuarioId, undefined)
  })
}

test("usa o perfil atual e limita a consulta ao usuário e paróquia ativos", async (t) => {
  findFirst.mock.mockImplementation(async (query) => {
    assert.deepEqual(query, {
      where: { id: 7, paroquiaId: 3, ativo: true, paroquia: { ativa: true } },
      select: { id: true, paroquiaId: true, tipo: true }
    })
    return { id: 7, paroquiaId: 3, tipo: "MEMBRO" }
  })
  const { req, res, next } = await executar(t, `bearer ${assinar()}`)
  assert.equal(res.code, undefined)
  assert.equal(req.usuarioId, 7)
  assert.equal(req.paroquiaId, 3)
  assert.equal(req.tipoUsuario, "MEMBRO")
  assert.equal(next.mock.callCount(), 1)
  assert.deepEqual(next.mock.calls[0].arguments, [])
})

test("nega acesso quando a consulta não encontra usuário ativo na paróquia ativa", async (t) => {
  findFirst.mock.mockImplementation(async () => null)
  const { req, res, next } = await executar(t, `Bearer ${assinar()}`)
  assert.equal(res.code, 401)
  assert.equal(next.mock.callCount(), 0)
  assert.equal(req.tipoUsuario, undefined)
})

test("encaminha falha do banco ao tratamento de erros sem retornar 401", async (t) => {
  const erro = new Error("Banco indisponível")
  findFirst.mock.mockImplementation(async () => { throw erro })
  const { req, res, next } = await executar(t, `Bearer ${assinar()}`)
  assert.equal(res.code, undefined)
  assert.equal(req.usuarioId, undefined)
  assert.equal(next.mock.callCount(), 1)
  assert.equal(next.mock.calls[0].arguments[0], erro)
})
