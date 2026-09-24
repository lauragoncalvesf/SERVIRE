import assert from "node:assert/strict"
import { mock, test } from "node:test"

const prisma = {
  evento: {
    findFirst: mock.fn(),
    update: mock.fn()
  }
}

mock.module("../src/lib/prisma.js", { defaultExport: prisma })

const { atualizarEvento, cancelarEvento } = await import("../src/controllers/eventoController.js")

async function executar(handler, { body = {}, eventoId = "12" } = {}) {
  const res = {
    status(code) { this.code = code; return this },
    json(data) { this.body = data; return this }
  }

  await handler({ body, params: { eventoId }, paroquiaId: 3 }, res)
  return res
}

test("edição valida os dados antes de consultar o banco", async () => {
  for (const body of [
    {},
    { titulo: " ", tipo: "MISSA", dataHora: "2026-09-24T19:00" },
    { titulo: "Missa", tipo: "INVALIDO", dataHora: "2026-09-24T19:00" },
    { titulo: "Missa", tipo: "MISSA", dataHora: "data inválida" }
  ]) {
    const res = await executar(atualizarEvento, { body })
    assert.equal(res.code, 400)
  }

  assert.equal(prisma.evento.findFirst.mock.callCount(), 0)
})

test("edição limita o evento à paróquia autenticada e normaliza os campos", async () => {
  prisma.evento.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 12, paroquiaId: 3, ativo: true })
    return { id: 12 }
  })
  prisma.evento.update.mock.mockImplementation(async ({ where, data }) => ({ ...where, ...data }))

  const res = await executar(atualizarEvento, {
    body: {
      titulo: "  Missa dominical  ",
      tipo: "MISSA",
      dataHora: "2026-09-24T19:00:00-03:00",
      local: "  Matriz  ",
      descricao: "  Celebração  "
    }
  })

  assert.equal(res.code, undefined)
  assert.equal(res.body.titulo, "Missa dominical")
  assert.equal(res.body.local, "Matriz")
  assert.equal(res.body.descricao, "Celebração")
  assert.equal(res.body.dataHora.toISOString(), "2026-09-24T22:00:00.000Z")
})

test("cancelamento desativa o evento sem apagar seus vínculos", async () => {
  prisma.evento.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 12, paroquiaId: 3, ativo: true })
    return { id: 12 }
  })
  prisma.evento.update.mock.mockImplementation(async ({ where, data }) => {
    assert.deepEqual(where, { id: 12 })
    assert.deepEqual(data, { ativo: false })
    return { id: 12, ativo: false }
  })

  const res = await executar(cancelarEvento)
  assert.deepEqual(res.body, { mensagem: "Evento cancelado com sucesso" })
})

