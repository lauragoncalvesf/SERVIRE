import assert from "node:assert/strict"
import { mock, test } from "node:test"

const prisma = { $transaction: mock.fn() }
mock.module("../src/lib/prisma.js", { defaultExport: prisma })
const { executarTransacao } = await import("../src/services/transacao.js")
const { adicionarItemEscala } = await import("../src/controllers/itemEscalaController.js")
const { autoEscalar } = await import("../src/controllers/autoEscalaController.js")
const conflito = () => Object.assign(new Error("Conflito de escrita"), { code: "P2034" })
const resposta = () => ({
  code: 200,
  status(code) { this.code = code; return this },
  json(body) { this.body = body; return this }
})

function bancoTeste() {
  const escala = {
    id: 10, eventoId: 20, pastoralId: 30, status: "ABERTA",
    pastoral: { permiteAutoEscala: true, exigeConfirmacao: true },
    evento: { titulo: "Missa" }
  }
  const itens = []
  return {
    itens,
    escala: {
      findFirst: async () => escala,
      findUnique: async () => ({ ...escala, funcoes: [{ quantidadeVagas: 1, itens }] }),
      update: mock.fn(async () => ({}))
    },
    funcaoEscala: { findFirst: async () => ({
      id: 40, funcaoPastoralId: 50, quantidadeVagas: 1, itens: [...itens],
      funcaoPastoral: { nome: "Leitor" }
    }) },
    membroPastoral: { findFirst: async () => ({ ativo: true }), findUnique: async () => ({ ativo: true }) },
    usuario: { findFirst: async () => ({ id: 4 }) },
    indisponibilidade: { findUnique: async () => null },
    itemEscala: {
      findFirst: async () => null,
      findUnique: async ({ where }) => itens.find((item) => item.id === where.id) || null,
      create: async ({ data }) => { const item = { id: 1, ...data }; itens.push(item); return item }
    },
    notificacao: { create: mock.fn(async ({ data }) => ({ id: 1, ...data })) }
  }
}
const req = () => ({
  params: { escalaId: "10" }, body: { funcaoEscalaId: "40", usuarioId: "4" },
  usuarioId: 4, paroquiaId: 1, tipoUsuario: "ADMIN"
})

test("repete conflitos serializáveis e limita a três tentativas", async () => {
  let tentativas = 0
  prisma.$transaction.mock.mockImplementation(async (operacao, options) => {
    assert.equal(options.isolationLevel, "Serializable")
    if (++tentativas < 3) throw conflito()
    return operacao({})
  })
  assert.equal(await executarTransacao(async () => "ok"), "ok")
  assert.equal(tentativas, 3)
  tentativas = 0
  prisma.$transaction.mock.mockImplementation(async () => { tentativas++; throw conflito() })
  await assert.rejects(executarTransacao(async () => {}), { code: "P2034" })
  assert.equal(tentativas, 3)
})

test("autoescala revalida a última vaga após conflito, sem enviar sucesso antes do commit", async () => {
  const tx = bancoTeste()
  const res = resposta()
  let tentativas = 0
  prisma.$transaction.mock.mockImplementation(async (operacao) => {
    tentativas++
    if (tentativas === 1) {
      const resultado = await operacao(tx)
      assert.equal(resultado.codigo, 201)
      assert.equal(res.body, undefined)
      // A transação perdeu para outro participante: desfazemos a escrita local
      // e simulamos o estado já confirmado pela transação concorrente.
      tx.itens.splice(0, tx.itens.length, { id: 9, usuarioId: 5, status: "CONFIRMADO" })
      throw conflito()
    }
    return operacao(tx)
  })
  await autoEscalar(req(), res)
  assert.equal(res.code, 409)
  assert.equal(tx.itens.length, 1)
  assert.equal(tx.itens[0].usuarioId, 5)
  assert.equal(tentativas, 2)
})

test("falha na notificação aborta a transação da participação", async (t) => {
  t.mock.method(console, "error", () => {})
  const tx = bancoTeste()
  tx.notificacao.create.mock.mockImplementation(async () => { throw new Error("Notificação indisponível") })
  let abortou = false
  prisma.$transaction.mock.mockImplementation(async (operacao) => {
    try { return await operacao(tx) }
    catch (error) { abortou = true; tx.itens.length = 0; throw error }
  })
  const res = resposta()
  await adicionarItemEscala(req(), res)
  assert.equal(res.code, 500)
  assert.equal(abortou, true)
  assert.equal(tx.itens.length, 0)
})

test("participação, notificação e status usam o cliente transacional", async () => {
  const tx = bancoTeste()
  let confirmou = false
  const res = resposta()
  prisma.$transaction.mock.mockImplementation(async (operacao) => {
    const resultado = await operacao(tx)
    assert.equal(res.body, undefined)
    confirmou = true
    return resultado
  })
  await adicionarItemEscala(req(), res)
  assert.equal(confirmou, true)
  assert.equal(res.code, 201)
  assert.equal(tx.notificacao.create.mock.calls[0].arguments[0].data.usuarioId, 4)
  assert.equal(tx.escala.update.mock.callCount(), 1)
})
