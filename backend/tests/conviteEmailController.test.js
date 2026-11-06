import assert from "node:assert/strict"
import { mock, test } from "node:test"
const usuario = { id: 4, nome: "Maria", email: "maria@example.com", paroquiaId: 2, tipo: "ADMIN", paroquia: { nome: "São José" } }
const tx = {
  paroquia: { findFirst: async () => ({ id: 2, nome: "São José" }) },
  usuario: { findFirst: async () => null, create: mock.fn(async () => usuario) },
  conviteAdmin: { updateMany: async () => ({ count: 1 }), create: mock.fn(async () => ({})) },
  auditoriaAdmin: { create: mock.fn(async () => ({})) }
}
let emTransacao = false
let tentativas = 0
let repetir = false
let falhaCommit = false
mock.module("../src/lib/prisma.js", { defaultExport: { $transaction: async callback => {
  emTransacao = true
  try {
    const resultado = await callback(tx)
    tentativas++
    if (falhaCommit) throw new Error("Commit indisponível")
    if (repetir && tentativas === 1) throw Object.assign(new Error("Conflito"), { code: "P2034" })
    return resultado
  } finally { emTransacao = false }
} } })
mock.module("bcrypt", { defaultExport: { hash: async () => "hash-simulado" } })
let statusEnvio = "enviado"
const entregar = mock.fn(async ({ convite, paroquia }) => {
  assert.equal(emTransacao, false)
  assert.equal(paroquia, "São José")
  return { envio: { status: statusEnvio }, convite: { expiraEm: convite.expiraEm, ...(statusEnvio !== "enviado" ? { token: convite.token } : {}) } }
})
mock.module("../src/services/conviteEmailService.js", { namedExports: { entregarConvite: entregar } })
const { criarAdmin, conviteAdmin } = await import("../src/controllers/superadminController.js")
function resposta() { return { set(nome, valor) { this[nome] = valor; return this }, status(code) { this.code = code; return this }, json(body) { this.body = body; return this } } }
const req = { params: { id: "2" }, body: { nome: "Maria", email: "maria@example.com" }, usuarioId: 1 }

test("cadastro envia somente uma vez após retries serializáveis e não retorna segredo no sucesso", async () => {
  repetir = true; tentativas = 0
  const res = resposta()
  await criarAdmin(req, res)
  assert.equal(tentativas, 2); assert.equal(entregar.mock.callCount(), 1)
  assert.equal(res.code, 201); assert.equal(res.body.envio.status, "enviado")
  assert.equal(res.body.convite.token, undefined)
  assert.equal(res["Cache-Control"], "no-store")
  const persistido = tx.conviteAdmin.create.mock.calls.at(-1).arguments[0].data
  assert.equal(persistido.token, undefined); assert.match(persistido.tokenHash, /^[a-f0-9]{64}$/)
})
test("falha SMTP mantém cadastro confirmado e retorna status e token manual", async () => {
  repetir = false; statusEnvio = "nao_enviado"; tentativas = 0; entregar.mock.resetCalls()
  const res = resposta()
  await criarAdmin(req, res)
  assert.equal(res.code, 201); assert.equal(res.body.usuario.id, 4)
  assert.equal(tentativas, 1); assert.equal(res.body.envio.status, "nao_enviado")
  assert.match(res.body.convite.token, /^[a-f0-9]{64}$/)
})
test("transação não confirmada nunca dispara envio", async () => {
  falhaCommit = true; entregar.mock.resetCalls()
  await assert.rejects(criarAdmin(req, resposta()), /Commit indisponível/)
  assert.equal(entregar.mock.callCount(), 0)
  falhaCommit = false
})
test("reemissão usa mesmo serviço após commit e mantém invalidação e prazo de 48 horas", async () => {
  tx.usuario.findFirst = async () => usuario
  statusEnvio = "nao_configurado"; entregar.mock.resetCalls()
  const res = resposta()
  await conviteAdmin(req, res)
  assert.equal(entregar.mock.callCount(), 1)
  assert.equal(res.body.envio.status, "nao_configurado")
  assert.match(res.body.convite.token, /^[a-f0-9]{64}$/)
  assert(Math.abs(res.body.convite.expiraEm - Date.now() - 48 * 3600000) < 2000)
})
