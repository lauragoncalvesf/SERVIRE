import assert from "node:assert/strict"
import { once } from "node:events"
import { mock, test } from "node:test"
import jwt from "jsonwebtoken"

const prisma = {
  paroquia: { create: mock.fn(), findMany: mock.fn() },
  usuario: { findFirst: mock.fn() }
}
mock.module("../src/lib/prisma.js", { defaultExport: prisma })
const { default: app } = await import("../src/app.js")
const { criarParoquia, listarParoquias } = await import("../src/controllers/paroquiaController.js")

async function executar(handler, body) {
  const res = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
  const next = mock.fn()
  await handler({ body }, res, next)
  return { res, next }
}

test("criação rejeita campos inválidos e normaliza textos opcionais", async () => {
  prisma.paroquia.create.mock.resetCalls()
  const invalidos = [undefined, null, {}, { nome: " " }, { nome: 1 }, { nome: {} },
    ...["cidade", "estado", "telefone", "email"].flatMap(campo =>
      [123, true, [], {}].map(valor => ({ nome: "Teste", [campo]: valor })))]
  for (const body of invalidos) {
    const { res, next } = await executar(criarParoquia, body)
    assert.equal(res.code, 400)
    assert.equal(next.mock.callCount(), 0)
  }
  assert.equal(prisma.paroquia.create.mock.callCount(), 0)
  prisma.paroquia.create.mock.mockImplementation(async ({ data }) => {
    assert.deepEqual(data, {
      nome: "Teste", cidade: "Cidade", estado: null, telefone: null, email: null
    })
    return { id: 10, ...data }
  })
  const { res, next } = await executar(criarParoquia, {
    nome: " Teste ", cidade: " Cidade ", estado: " ", telefone: null
  })
  assert.equal(res.code, 201)
  assert.equal(next.mock.callCount(), 0)
})

test("rotas exigem admin para criar e listam apenas dados públicos de paróquias ativas", async (t) => {
  const original = process.env.JWT_SECRET
  process.env.JWT_SECRET = "segredo-teste-paroquias"
  t.after(() => {
    if (original === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = original
  })
  const server = app.listen(0, "127.0.0.1")
  t.after(() => new Promise((resolve, reject) => {
    server.close(erro => erro ? reject(erro) : resolve())
    server.closeAllConnections()
  }))
  await once(server, "listening")
  const base = `http://127.0.0.1:${server.address().port}/paroquias`
  prisma.paroquia.create.mock.resetCalls()
  prisma.paroquia.create.mock.mockImplementation(async ({ data }) => ({ id: 10, ...data }))
  for (const tipo of [undefined, "MEMBRO", "ADMIN"]) {
    prisma.usuario.findFirst.mock.mockImplementation(async () => ({ id: 7, paroquiaId: 3, tipo }))
    const headers = { "Content-Type": "application/json" }
    if (tipo) headers.Authorization = `Bearer ${jwt.sign({ usuarioId: 7, paroquiaId: 3, tipo }, process.env.JWT_SECRET, { expiresIn: "1h" })}`
    const res = await fetch(base, { method: "POST", headers, body: JSON.stringify({ nome: "Teste" }) })
    assert.equal(res.status, !tipo ? 401 : tipo === "ADMIN" ? 201 : 403)
    await res.json()
    assert.equal(prisma.paroquia.create.mock.callCount(), tipo === "ADMIN" ? 1 : 0)
  }
  const publicas = [{ id: 10, nome: "Teste", cidade: "Cidade", estado: "SP" }]
  prisma.paroquia.findMany.mock.mockImplementation(async query => {
    assert.deepEqual(query, {
      where: { ativa: true },
      select: { id: true, nome: true, cidade: true, estado: true },
      orderBy: { nome: "asc" }
    })
    return publicas
  })
  const lista = await fetch(base)
  assert.equal(lista.status, 200)
  assert.deepEqual(await lista.json(), publicas)
})

test("falhas de criação e listagem são encaminhadas ao tratamento central", async () => {
  const erro = new Error("Falha simulada")
  for (const [handler, metodo] of [[criarParoquia, "create"], [listarParoquias, "findMany"]]) {
    prisma.paroquia[metodo].mock.mockImplementation(async () => { throw erro })
    const { res, next } = await executar(handler, { nome: "Teste" })
    assert.equal(res.body, undefined)
    assert.equal(next.mock.callCount(), 1)
    assert.equal(next.mock.calls[0].arguments[0], erro)
  }
})
