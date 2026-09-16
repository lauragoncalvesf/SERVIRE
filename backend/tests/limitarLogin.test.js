import assert from "node:assert/strict"
import { mock, test } from "node:test"

const contagens = new Map()
const banco = {
  $queryRaw: mock.fn(async (parts, key) => {
    const attempts = (contagens.get(key) || 0) + 1
    contagens.set(key, attempts)
    return [{ attempts, expiresAt: new Date(Date.now() + 15 * 60 * 1000) }]
  }),
  $executeRaw: mock.fn(async () => 0)
}
mock.module("../src/lib/prisma.js", { defaultExport: banco })
const { limitarLogin } = await import("../src/middlewares/limitarLogin.js")

async function executar(ip, email = "teste@example.com") {
  const res = {
    status(code) { this.code = code; return this },
    set(nome, valor) { this[nome] = valor; return this },
    json(body) { this.body = body; return this }
  }
  const next = mock.fn()
  await limitarLogin({ ip, body: { email, paroquiaId: 3 } }, res, next)
  return { res, next }
}

test("permite 10 tentativas e bloqueia a 11ª por 15 minutos", async () => {
  for (let tentativa = 1; tentativa <= 10; tentativa++) {
    const { res, next } = await executar("192.0.2.1")
    assert.equal(res.code, undefined)
    assert.equal(next.mock.callCount(), 1)
  }
  const { res, next } = await executar("192.0.2.1")
  assert.equal(res.code, 429)
  assert.equal(next.mock.callCount(), 0)
  assert.ok(Number(res["Retry-After"]) > 0)
})

test("bloqueia a conta mesmo quando o IP muda", async () => {
  const { res } = await executar("192.0.2.2")
  assert.equal(res.code, 429)
  const outraConta = await executar("192.0.2.3", "outra@example.com")
  assert.equal(outraConta.next.mock.callCount(), 1)
})
