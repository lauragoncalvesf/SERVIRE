import assert from "node:assert/strict"
import { mock, test } from "node:test"
const prisma = {
  pastoral: { findFirst: mock.fn() },
  funcaoPastoral: { findFirst: mock.fn(), findMany: mock.fn(), create: mock.fn(), update: mock.fn() }
}
mock.module("../src/lib/prisma.js", { defaultExport: prisma })
const { criarFuncaoPastoral, listarFuncoesPastoral, atualizarFuncaoPastoral } = await import("../src/controllers/funcaoPastoralController.js")
async function executar(handler, body = { nome: " Teste ", pastoralId: 10 }, params = { pastoralId: "10", funcaoId: "20" }) {
  const res = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
  const next = mock.fn()
  await handler({ body, params, paroquiaId: 3 }, res, next)
  return { res, next }
}

test("rejeita IDs e campos inválidos antes de consultar o banco", async () => {
  for (const id of [null, true, [], {}, -1, 0, 1.5, "abc", 2147483648]) {
    assert.equal((await executar(criarFuncaoPastoral, { nome: "Teste", pastoralId: id })).res.code, 400)
    assert.equal((await executar(listarFuncoesPastoral, {}, { pastoralId: id })).res.code, 400)
    assert.equal((await executar(atualizarFuncaoPastoral, { nome: "Teste" }, { funcaoId: id })).res.code, 400)
  }
  for (const handler of [criarFuncaoPastoral, atualizarFuncaoPastoral]) {
    for (const body of [null, {}, { nome: {} }, { nome: " " }, { nome: "Teste", pastoralId: 10, descricao: [] }]) {
      assert.equal((await executar(handler, body)).res.code, 400)
    }
  }
  assert.equal(prisma.pastoral.findFirst.mock.callCount(), 0)
  assert.equal(prisma.funcaoPastoral.findFirst.mock.callCount(), 0)
})

test("criação usa nome normalizado na busca e na gravação", async () => {
  prisma.pastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 10, paroquiaId: 3, ativa: true })
    return { id: 10 }
  })
  prisma.funcaoPastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { nome: "Teste", pastoralId: 10 })
    return null
  })
  prisma.funcaoPastoral.create.mock.mockImplementation(async ({ data }) => {
    assert.deepEqual(data, { nome: "Teste", descricao: null, pastoralId: 10 })
    return { id: 20, ...data }
  })
  assert.equal((await executar(criarFuncaoPastoral)).res.code, 201)
  prisma.funcaoPastoral.findFirst.mock.mockImplementation(async () => ({ id: 20 }))
  assert.equal((await executar(criarFuncaoPastoral)).res.code, 409)
})

test("edição preserva descrição omitida e usa pastoral persistida para duplicidade", async () => {
  prisma.funcaoPastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    if (typeof where.id === "number") {
      assert.deepEqual(where, { id: 20, pastoral: { paroquiaId: 3 } })
      return { id: 20, pastoralId: 10 }
    }
    assert.deepEqual(where, { pastoralId: 10, nome: "Teste", id: { not: 20 } })
    return null
  })
  prisma.funcaoPastoral.update.mock.mockImplementation(async ({ data }) => ({ descricao: "Original", ...data }))
  const preservada = await executar(atualizarFuncaoPastoral, { nome: " Teste ", pastoralId: 999 })
  assert.equal(preservada.res.body.descricao, "Original")
  const limpa = await executar(atualizarFuncaoPastoral, { nome: "Teste", descricao: null })
  assert.equal(limpa.res.body.descricao, null)
})

test("listagem filtra funções ativas da pastoral da paróquia", async () => {
  prisma.funcaoPastoral.findMany.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { pastoralId: 10, ativa: true })
    return []
  })
  assert.deepEqual((await executar(listarFuncoesPastoral)).res.body, [])
  prisma.pastoral.findFirst.mock.mockImplementation(async () => null)
  assert.equal((await executar(listarFuncoesPastoral)).res.code, 404)
})

test("duplicidades concorrentes retornam 409 e falhas internas são encaminhadas", async () => {
  prisma.pastoral.findFirst.mock.mockImplementation(async () => ({ id: 10 }))
  prisma.funcaoPastoral.findFirst.mock.mockImplementation(async ({ where }) => typeof where.id === "number" ? { id: 20, pastoralId: 10 } : null)
  const erro = new Error("Falha simulada")
  for (const [handler, metodo] of [[criarFuncaoPastoral, "create"], [atualizarFuncaoPastoral, "update"], [listarFuncoesPastoral, "findMany"]]) {
    if (metodo !== "findMany") {
      prisma.funcaoPastoral[metodo].mock.mockImplementation(async () => { throw { code: "P2002" } })
      assert.equal((await executar(handler)).res.code, 409)
    }
    prisma.funcaoPastoral[metodo].mock.mockImplementation(async () => { throw erro })
    const falha = await executar(handler)
    assert.equal(falha.next.mock.calls[0].arguments[0], erro)
    assert.equal(falha.res.body, undefined)
  }
})
