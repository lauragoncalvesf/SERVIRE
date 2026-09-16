import assert from "node:assert/strict"
import { mock, test } from "node:test"
const prisma = {
  pastoral: { findFirst: mock.fn(), findMany: mock.fn(), create: mock.fn(), update: mock.fn() },
  paroquia: { findUnique: mock.fn() },
  membroPastoral: { findMany: mock.fn() }
}
mock.module("../src/lib/prisma.js", { defaultExport: prisma })
const { criarPastoral, atualizarPastoral, listarPastorais } = await import("../src/controllers/pastoralController.js")
async function executar(handler, body, tipoUsuario = "MEMBRO") {
  const res = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
  const next = mock.fn()
  await handler({ body, params: { pastoralId: "10" }, paroquiaId: 3, usuarioId: 7, tipoUsuario }, res, next)
  return { res, next }
}

test("valida nomes, descrição e booleanos sem consultar o banco", async () => {
  for (const handler of [criarPastoral, atualizarPastoral]) {
    const corpos = [undefined, { nome: 1 }, { nome: " " }, { nome: "Teste", descricao: {} }]
    for (const campo of ["permiteAutoEscala", "exigeConfirmacao", ...(handler === atualizarPastoral ? ["ativa"] : [])]) {
      for (const valor of ["false", 0, null, []]) corpos.push({ nome: "Teste", [campo]: valor })
    }
    for (const body of corpos) {
      const { res, next } = await executar(handler, body)
      assert.equal(res.code, 400)
      assert.equal(next.mock.callCount(), 0)
    }
  }
  assert.equal(prisma.pastoral.findFirst.mock.callCount(), 0)
  assert.equal(prisma.paroquia.findUnique.mock.callCount(), 0)
})

test("edição preserva opções omitidas e permite false explícito", async () => {
  const atual = { id: 10, nome: "Antiga", descricao: "Descrição", ativa: true, permiteAutoEscala: true, exigeConfirmacao: true }
  prisma.pastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.equal(where.paroquiaId, 3)
    return typeof where.id === "number" ? atual : null
  })
  prisma.pastoral.update.mock.mockImplementation(async ({ data }) => ({ ...atual, ...data }))
  const parcial = await executar(atualizarPastoral, { nome: " Nova " })
  assert.deepEqual(parcial.res.body, { ...atual, nome: "Nova" })
  const explicito = await executar(atualizarPastoral, { nome: "Nova", ativa: false, permiteAutoEscala: false, exigeConfirmacao: false, descricao: null })
  assert.deepEqual(explicito.res.body, { ...atual, nome: "Nova", ativa: false, permiteAutoEscala: false, exigeConfirmacao: false, descricao: null })
})

test("criação normaliza nome e usa a paróquia autenticada", async () => {
  prisma.paroquia.findUnique.mock.mockImplementation(async () => ({ ativa: true }))
  prisma.pastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { nome: "Teste", paroquiaId: 3 })
    return null
  })
  prisma.pastoral.create.mock.mockImplementation(async ({ data }) => {
    assert.deepEqual(data, { nome: "Teste", descricao: null, permiteAutoEscala: false, exigeConfirmacao: false, paroquiaId: 3 })
    return { id: 10, ...data }
  })
  assert.equal((await executar(criarPastoral, { nome: " Teste ", paroquiaId: 999 })).res.code, 201)
})

test("duplicidade concorrente retorna 409 na criação e edição", async () => {
  prisma.pastoral.findFirst.mock.mockImplementation(async ({ where }) => typeof where.id === "number" ? { id: 10 } : null)
  for (const [handler, metodo] of [[criarPastoral, "create"], [atualizarPastoral, "update"]]) {
    prisma.pastoral[metodo].mock.mockImplementation(async () => { throw { code: "P2002" } })
    const { res, next } = await executar(handler, { nome: "Teste" })
    assert.equal(res.code, 409)
    assert.equal(next.mock.callCount(), 0)
  }
})

test("listagem concede gerenciamento apenas às pastorais coordenadas e aos admins", async () => {
  prisma.pastoral.findMany.mock.mockImplementation(async ({ where }) => {
    assert.equal(where.paroquiaId, 3)
    return [{ id: 10 }, { id: 11 }]
  })
  prisma.membroPastoral.findMany.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { usuarioId: 7, pastoralId: { in: [10, 11] }, ativo: true, papel: "COORDENADOR" })
    return [{ pastoralId: 10 }]
  })
  const membro = await executar(listarPastorais)
  assert.deepEqual(membro.res.body, [{ id: 10, podeGerenciar: true }, { id: 11, podeGerenciar: false }])
  assert.equal(prisma.membroPastoral.findMany.mock.callCount(), 1)
  const admin = await executar(listarPastorais, undefined, "ADMIN")
  assert.equal(admin.res.body.every(p => p.podeGerenciar), true)
  assert.equal(prisma.membroPastoral.findMany.mock.callCount(), 1)
})
