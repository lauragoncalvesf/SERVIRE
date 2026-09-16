import assert from "node:assert/strict"
import { mock, test } from "node:test"
const prisma = {
  usuario: { findFirst: mock.fn() }, pastoral: { findFirst: mock.fn() },
  membroPastoral: { findFirst: mock.fn(), findUnique: mock.fn(), findMany: mock.fn(), create: mock.fn(), update: mock.fn() }
}
mock.module("../src/lib/prisma.js", { defaultExport: prisma })
const { adicionarMembroPastoral, listarMembrosPastoral, atualizarMembroPastoral } = await import("../src/controllers/membroPastoralController.js")
const dados = { usuarioId: 7, pastoralId: 10 }
async function executar(handler, body = dados, params = { pastoralId: "10", membroPastoralId: "20" }) {
  const res = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
  const next = mock.fn()
  await handler({ body, params, paroquiaId: 3 }, res, next)
  return { res, next }
}

test("IDs e papéis inválidos retornam 400 antes da consulta", async () => {
  for (const id of [undefined, null, true, [], {}, "abc", -1, 0, 1.5, 2147483648]) {
    for (const campo of ["usuarioId", "pastoralId"]) {
      assert.equal((await executar(adicionarMembroPastoral, { ...dados, [campo]: id })).res.code, 400)
    }
    assert.equal((await executar(listarMembrosPastoral, {}, { pastoralId: id })).res.code, 400)
    assert.equal((await executar(atualizarMembroPastoral, { papel: "MEMBRO" }, { membroPastoralId: id })).res.code, 400)
  }
  for (const papel of [null, "", "ADMIN", true, {}]) {
    for (const handler of [adicionarMembroPastoral, atualizarMembroPastoral]) {
      assert.equal((await executar(handler, { ...dados, papel })).res.code, 400)
    }
  }
  for (const model of Object.values(prisma)) {
    for (const metodo of Object.values(model)) assert.equal(metodo.mock.callCount(), 0)
  }
})

test("inclusão limita usuário e pastoral à paróquia e trata duplicidade concorrente", async () => {
  prisma.usuario.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 7, paroquiaId: 3, ativo: true })
    return { id: 7 }
  })
  prisma.pastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 10, paroquiaId: 3, ativa: true })
    return { id: 10 }
  })
  prisma.membroPastoral.findUnique.mock.mockImplementation(async () => null)
  prisma.membroPastoral.create.mock.mockImplementation(async ({ data }) => {
    assert.deepEqual(data, { usuarioId: 7, pastoralId: 10, papel: "MEMBRO" })
    return { id: 20, ...data }
  })
  assert.equal((await executar(adicionarMembroPastoral)).res.code, 201)
  prisma.membroPastoral.create.mock.mockImplementation(async () => { throw { code: "P2002" } })
  assert.equal((await executar(adicionarMembroPastoral)).res.code, 409)
  prisma.usuario.findFirst.mock.mockImplementation(async () => null)
  assert.equal((await executar(adicionarMembroPastoral)).res.code, 404)
})

test("listagem exige pastoral da paróquia e filtra vínculos e usuários ativos", async () => {
  prisma.pastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 10, paroquiaId: 3 })
    return { id: 10 }
  })
  prisma.membroPastoral.findMany.mock.mockImplementation(async ({ where, include }) => {
    assert.deepEqual(where, { pastoralId: 10, ativo: true, usuario: { ativo: true, paroquiaId: 3 } })
    assert.equal(include.usuario.select.senha, undefined)
    return []
  })
  assert.deepEqual((await executar(listarMembrosPastoral)).res.body, [])
})

test("edição altera somente o papel de vínculo da paróquia e encaminha falhas", async () => {
  prisma.membroPastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 20, pastoral: { paroquiaId: 3 } })
    return { id: 20 }
  })
  prisma.membroPastoral.update.mock.mockImplementation(async ({ data }) => {
    assert.deepEqual(data, { papel: "COORDENADOR" })
    return { id: 20, ...data }
  })
  const atualizado = await executar(atualizarMembroPastoral, { papel: "COORDENADOR", pastoralId: 999 })
  assert.equal(atualizado.res.body.papel, "COORDENADOR")
  const erro = new Error("Falha simulada")
  for (const [handler, model, metodo] of [
    [adicionarMembroPastoral, "usuario", "findFirst"],
    [listarMembrosPastoral, "pastoral", "findFirst"],
    [atualizarMembroPastoral, "membroPastoral", "findFirst"]
  ]) {
    prisma[model][metodo].mock.mockImplementation(async () => { throw erro })
    const falha = await executar(handler, { ...dados, papel: "MEMBRO" })
    assert.equal(falha.next.mock.calls[0].arguments[0], erro)
    assert.equal(falha.res.body, undefined)
  }
})
