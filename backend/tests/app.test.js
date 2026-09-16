import assert from "node:assert/strict"
import { once } from "node:events"
import { mock, test } from "node:test"
import { validarConfiguracao, validarOrigens } from "../src/config.js"
import { tratarErros } from "../src/middlewares/tratarErros.js"

mock.module("../src/lib/prisma.js", { defaultExport: {} })
const { default: app } = await import("../src/app.js")

test("configuração exige segredo e banco sem expor seus valores", () => {
  const env = { JWT_SECRET: "segredo-de-teste", DATABASE_URL: "postgresql://teste" }
  assert.deepEqual(validarConfiguracao(env), { porta: 3333, proxyHops: 0 })
  assert.deepEqual(validarConfiguracao({ ...env, PORT: "4000" }), { porta: 4000, proxyHops: 0 })
  for (const nome of ["JWT_SECRET", "DATABASE_URL"]) {
    for (const valor of [undefined, "", "   "]) {
      assert.throws(() => validarConfiguracao({ ...env, [nome]: valor }), {
        message: `Configuração obrigatória ausente: ${nome}`
      })
    }
  }
  for (const PORT of ["", "abc", "0", "-1", "1.5", "65536"]) {
    assert.throws(() => validarConfiguracao({ ...env, PORT }), /PORT deve ser/)
  }
})

test("produção exige origens explícitas e aceita apenas URLs de origem", () => {
  const env = { JWT_SECRET: "segredo", DATABASE_URL: "postgresql://teste", NODE_ENV: "production" }
  assert.throws(() => validarConfiguracao(env), /CORS_ORIGINS/)
  assert.deepEqual(validarOrigens({ ...env, CORS_ORIGINS: "https://app.example.com,https://admin.example.com" }),
    ["https://app.example.com", "https://admin.example.com"])
  for (const origem of ["*", "https://app.example.com/path", "javascript:alert(1)"]) {
    assert.throws(() => validarOrigens({ ...env, CORS_ORIGINS: origem }), /CORS_ORIGINS/)
  }
})

test("API mantém a rota inicial e padroniza erros HTTP em JSON", async (t) => {
  const server = app.listen(0, "127.0.0.1")
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
    server.closeAllConnections()
  }))
  await once(server, "listening")
  const base = `http://127.0.0.1:${server.address().port}`

  const inicio = await fetch(base)
  assert.equal(inicio.status, 200)
  assert.deepEqual(await inicio.json(), { mensagem: "API Sistema Paróquia funcionando" })

  const origemPermitida = await fetch(base, { headers: { Origin: "http://localhost:5173" } })
  assert.equal(origemPermitida.headers.get("access-control-allow-origin"), "http://localhost:5173")
  const origemExterna = await fetch(base, { headers: { Origin: "https://outra.example.com" } })
  assert.equal(origemExterna.headers.get("access-control-allow-origin"), null)

  const ausente = await fetch(`${base}/rota-inexistente`)
  assert.equal(ausente.status, 404)
  assert.deepEqual(await ausente.json(), { mensagem: "Rota não encontrada" })

  const invalido = await fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"email":'
  })
  assert.equal(invalido.status, 400)
  assert.deepEqual(await invalido.json(), { mensagem: "JSON inválido no corpo da requisição" })

  const grande = await fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "a".repeat(110000) })
  })
  assert.equal(grande.status, 413)
  assert.deepEqual(await grande.json(), { mensagem: "Corpo da requisição excede o tamanho permitido" })
})

test("erro interno não expõe detalhes e resposta iniciada é delegada", (t) => {
  t.mock.method(console, "error", () => {})
  const erro = new Error("Detalhes internos do banco")
  const res = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
  tratarErros(erro, {}, res, () => assert.fail("Não deve delegar"))
  assert.equal(res.code, 500)
  assert.deepEqual(res.body, { mensagem: "Erro interno do servidor" })

  const next = mock.fn()
  tratarErros(erro, {}, { headersSent: true }, next)
  assert.equal(next.mock.callCount(), 1)
  assert.equal(next.mock.calls[0].arguments[0], erro)
})
