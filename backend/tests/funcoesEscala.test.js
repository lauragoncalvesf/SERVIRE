import assert from "node:assert/strict"
import { mock, test } from "node:test"
const prisma = {
  escala: { findFirst: mock.fn() }, funcaoPastoral: { findFirst: mock.fn() },
  funcaoEscala: { findFirst: mock.fn(), findUnique: mock.fn(), findMany: mock.fn(), create: mock.fn(), update: mock.fn(), delete: mock.fn() }
}
const recalcular = mock.fn()
mock.module("../src/lib/prisma.js", { defaultExport: prisma })
mock.module("../src/services/escalaService.js", { namedExports: {
  atualizarStatusAutomaticoEscala: recalcular,
  escalaPodeSerEditada: (status) => !["ENCERRADA", "CANCELADA"].includes(status)
} })
mock.module("../src/services/escalaPermissions.js", { namedExports: {
  usuarioPodeGerenciarPastoral: async () => true
} })
const { adicionarFuncaoEscala, listarFuncoesEscala, atualizarFuncaoEscala, removerFuncaoEscala } = await import("../src/controllers/funcaoEscalaController.js")
async function executar(handler, body = { funcaoPastoralId: 5, quantidadeVagas: 2 }, params = { escalaId: "10", funcaoEscalaId: "20" }) {
  const res = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
  const next = mock.fn()
  await handler({ body, params, paroquiaId: 3, usuarioId: 7, tipoUsuario: "ADMIN" }, res, next)
  return { res, next }
}
const registro = (status = "ABERTA", itens = []) => ({ id: 20, escalaId: 10, escala: { status }, itens })

test("IDs e quantidades inválidos são rejeitados antes de consultar o banco", async () => {
  for (const valor of [null, true, [], {}, -1, 0, 1.5, "abc", 2147483648]) {
    for (const handler of [adicionarFuncaoEscala, atualizarFuncaoEscala]) {
      assert.equal((await executar(handler, { funcaoPastoralId: 5, quantidadeVagas: valor })).res.code, 400)
    }
    assert.equal((await executar(adicionarFuncaoEscala, { funcaoPastoralId: valor, quantidadeVagas: 2 })).res.code, 400)
    for (const handler of [adicionarFuncaoEscala, listarFuncoesEscala, atualizarFuncaoEscala, removerFuncaoEscala]) {
      assert.equal((await executar(handler, {}, { escalaId: valor, funcaoEscalaId: valor })).res.code, 400)
    }
  }
  for (const modelo of Object.values(prisma)) {
    for (const metodo of Object.values(modelo)) assert.equal(metodo.mock.callCount(), 0)
  }
})

test("edição bloqueia redução abaixo das vagas ocupadas e retorna só itens ativos", async () => {
  prisma.funcaoEscala.findFirst.mock.mockImplementation(async ({ where, include }) => {
    assert.equal(where.escala.evento.paroquiaId, 3)
    assert.deepEqual(include.itens.where.status.in, ["PENDENTE", "CONFIRMADO"])
    return registro("ABERTA", [{ status: "PENDENTE" }, { status: "CONFIRMADO" }])
  })
  assert.equal((await executar(atualizarFuncaoEscala, { quantidadeVagas: 1 })).res.code, 400)
  assert.equal(prisma.funcaoEscala.update.mock.callCount(), 0)
  prisma.funcaoEscala.update.mock.mockImplementation(async ({ data }) => {
    assert.equal(data.quantidadeVagas, 2)
    return { id: 20, quantidadeVagas: 2 }
  })
  prisma.funcaoEscala.findUnique.mock.mockImplementation(async ({ include }) => {
    assert.deepEqual(include.itens.where.status, { in: ["PENDENTE", "CONFIRMADO"] })
    return { id: 20, quantidadeVagas: 2 }
  })
  const resultado = await executar(atualizarFuncaoEscala, { quantidadeVagas: "2" })
  assert.equal(resultado.res.body.quantidadeVagas, 2)
  assert.equal(recalcular.mock.calls.at(-1).arguments[0], 10)
})

test("remoção bloqueia membros ativos e escalas encerradas ou canceladas", async () => {
  for (const [status, itens] of [["ABERTA", [{ status: "PENDENTE" }]], ["ENCERRADA", []], ["CANCELADA", []]]) {
    prisma.funcaoEscala.findFirst.mock.mockImplementation(async () => registro(status, itens))
    assert.equal((await executar(removerFuncaoEscala)).res.code, 400)
  }
  assert.equal(prisma.funcaoEscala.delete.mock.callCount(), 0)
  prisma.funcaoEscala.findFirst.mock.mockImplementation(async ({ include }) => {
    assert.deepEqual(include.itens.where.status.in, ["PENDENTE", "CONFIRMADO"])
    return registro()
  })
  prisma.funcaoEscala.delete.mock.mockImplementation(async ({ where }) => assert.equal(where.id, 20))
  assert.equal((await executar(removerFuncaoEscala)).res.body.mensagem, "Função removida da escala")
})

test("criação exige função da pastoral e trata duplicidade concorrente", async () => {
  prisma.escala.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.equal(where.evento.paroquiaId, 3)
    return { id: 10, pastoralId: 6, status: "ABERTA" }
  })
  prisma.funcaoPastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 5, pastoralId: 6, ativa: true })
    return null
  })
  assert.equal((await executar(adicionarFuncaoEscala)).res.code, 400)
  prisma.funcaoPastoral.findFirst.mock.mockImplementation(async () => ({ id: 5 }))
  prisma.funcaoEscala.findUnique.mock.mockImplementation(async () => null)
  prisma.funcaoEscala.create.mock.mockImplementation(async ({ data }) => {
    assert.deepEqual(data, { escalaId: 10, funcaoPastoralId: 5, quantidadeVagas: 2 })
    return { id: 20, ...data }
  })
  assert.equal((await executar(adicionarFuncaoEscala)).res.code, 201)
  prisma.funcaoEscala.create.mock.mockImplementation(async () => { throw { code: "P2002" } })
  assert.equal((await executar(adicionarFuncaoEscala)).res.code, 409)
})

test("listagem calcula ocupação com itens ativos e encaminha falhas internas", async () => {
  prisma.escala.findFirst.mock.mockImplementation(async () => ({ id: 10, pastoralId: 6, status: "ABERTA" }))
  prisma.funcaoEscala.findMany.mock.mockImplementation(async ({ include }) => {
    assert.deepEqual(include.itens.where.status.in, ["PENDENTE", "CONFIRMADO"])
    return [{ id: 20, quantidadeVagas: 2, itens: [{ status: "PENDENTE" }] }]
  })
  const lista = await executar(listarFuncoesEscala)
  assert.equal(lista.res.body[0].quantidadePreenchida, 1)
  assert.equal(lista.res.body[0].preenchida, false)
  const erro = new Error("Falha simulada")
  prisma.funcaoEscala.findMany.mock.mockImplementation(async () => { throw erro })
  const falha = await executar(listarFuncoesEscala)
  assert.equal(falha.next.mock.calls[0].arguments[0], erro)
})
