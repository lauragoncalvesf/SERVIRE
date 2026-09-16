import assert from "node:assert/strict"
import { mock, test } from "node:test"

const prisma = {
  usuario: { findUnique: mock.fn(async () => ({ id: 4, nome: "Teste" })) },
  itemEscala: { findFirst: mock.fn(), findMany: mock.fn(), update: mock.fn() },
  escala: { findUnique: mock.fn(), update: mock.fn() }
}
mock.module("../src/lib/prisma.js", { defaultExport: prisma })
const { listarMinhasEscalas } = await import("../src/controllers/minhasEscalasController.js")
const { responderEscala } = await import("../src/controllers/itemEscalaController.js")
const resposta = () => ({
  status(code) { this.code = code; return this },
  json(body) { this.body = body; return this }
})

test("Minhas Escalas exclui rascunhos e canceladas mantendo filtro de usuário e paróquia", async () => {
  prisma.itemEscala.findMany.mock.mockImplementation(async ({ where }) => {
    assert.equal(where.usuarioId, 4)
    assert.equal(where.evento.paroquiaId, 1)
    assert.deepEqual(where.status.in, ["PENDENTE", "CONFIRMADO"])
    assert.deepEqual(where.escala.status.notIn, ["RASCUNHO", "CANCELADA"])
    return []
  })
  const res = resposta()
  await listarMinhasEscalas({ usuarioId: 4, paroquiaId: 1 }, res)
  assert.deepEqual(res.body.escalas, [])
})

for (const status of ["CONFIRMADO", "RECUSADO"]) {
  test(`responde ${status} ao próprio convite pendente sem tentar uma nova escalação`, async () => {
    prisma.itemEscala.findFirst.mock.resetCalls()
    prisma.itemEscala.findFirst.mock.mockImplementation(async ({ where }) => {
      assert.deepEqual(where, { id: 23, usuarioId: 4, evento: { paroquiaId: 1 } })
      return { id: 23, status: "PENDENTE", escalaId: 10, escala: { status: "PREENCHIDA" } }
    })
    prisma.itemEscala.update.mock.mockImplementation(async ({ where, data }) => {
      assert.equal(where.id, 23)
      assert.deepEqual(data, { status })
      return { id: 23, status }
    })
    prisma.escala.findUnique.mock.mockImplementation(async () => ({
      id: 10, status: "PREENCHIDA", pastoral: { exigeConfirmacao: true },
      funcoes: [{ quantidadeVagas: 1, itens: status === "CONFIRMADO" ? [{ status }] : [] }]
    }))
    prisma.escala.update.mock.mockImplementation(async ({ data }) => {
      assert.equal(data.status, status === "CONFIRMADO" ? "COMPLETA" : "ABERTA")
    })
    const res = resposta()
    await responderEscala({ params: { itemId: "23" }, body: { status }, usuarioId: 4, paroquiaId: 1 }, res)
    assert.equal(res.code, undefined)
    assert.equal(res.body.item.status, status)
    assert.equal(prisma.itemEscala.findFirst.mock.callCount(), 1)
  })
}
