import assert from "node:assert/strict"
import { mock, test } from "node:test"

const prisma = Object.fromEntries(
  ["pastoral", "escala", "itemEscala", "membroPastoral", "funcaoPastoral", "funcaoEscala"]
    .map(nome => [nome, { findFirst: mock.fn(), findUnique: mock.fn() }])
)
mock.module("../src/lib/prisma.js", { defaultExport: prisma })
const permissoes = await import("../src/middlewares/permitirCoordenadorPastoral.js")

const caminhos = [
  ["permitirCoordenadorPastoralBody", "pastoral", "pastoralId", "body"],
  ["permitirCoordenadorPorPastoral", "pastoral", "pastoralId", "params"],
  ["permitirCoordenadorPorEscala", "escala", "escalaId", "params"],
  ["permitirCoordenadorPorItemEscala", "itemEscala", "itemId", "params"],
  ["permitirCoordenadorPorMembroPastoral", "membroPastoral", "membroPastoralId", "params"],
  ["permitirCoordenadorPorFuncaoPastoral", "funcaoPastoral", "funcaoId", "params"],
  ["permitirCoordenadorPorFuncaoEscala", "funcaoEscala", "funcaoEscalaId", "params"]
]

for (const [nome, modelo, parametro, origem] of caminhos) {
  test(`${nome}: isolamento, vínculo, IDs e falhas do banco`, async () => {
    async function executar({ id = "10", tipo = "MEMBRO", ausente = false,
      vinculo = { ativo: true, papel: "COORDENADOR" }, erroBusca, erroVinculo,
      semBody = false } = {}) {
      const req = {
        params: {}, body: { pastoralId: 999 },
        usuarioId: 7, paroquiaId: 3, tipoUsuario: tipo
      }
      req[origem][parametro] = id
      if (semBody) delete req.body
      const res = {
        status(code) { this.code = code; return this },
        json(body) { this.body = body; return this }
      }
      const next = mock.fn()
      prisma[modelo].findFirst.mock.resetCalls()
      prisma.membroPastoral.findUnique.mock.resetCalls()
      prisma[modelo].findFirst.mock.mockImplementation(async ({ where }) => {
        if (erroBusca) throw erroBusca
        assert.equal(where.id, 10)
        if (modelo === "pastoral") assert.equal(where.paroquiaId, 3)
        if (["membroPastoral", "funcaoPastoral", "escala"].includes(modelo)) {
          assert.equal(where.pastoral.paroquiaId, 3)
        }
        if (["escala", "itemEscala"].includes(modelo)) {
          assert.equal(where.evento.paroquiaId, 3)
        }
        if (["itemEscala", "funcaoEscala"].includes(modelo)) {
          assert.equal(where.escala.pastoral.paroquiaId, 3)
          assert.equal(where.escala.evento.paroquiaId, 3)
        }
        return ausente ? null : { id: 10, pastoralId: 10, escala: { pastoralId: 10 } }
      })
      prisma.membroPastoral.findUnique.mock.mockImplementation(async ({ where }) => {
        if (erroVinculo) throw erroVinculo
        assert.deepEqual(where.usuarioId_pastoralId, { usuarioId: 7, pastoralId: 10 })
        return vinculo
      })
      await permissoes[nome]()(req, res, next)
      return { res, next }
    }

    for (const id of ["abc", "0", "-1", "1.5", "Infinity", "2147483648", true, [10], {}]) {
      const { res, next } = await executar({ id })
      assert.equal(res.code, 400)
      assert.equal(next.mock.callCount(), 0)
      assert.equal(prisma[modelo].findFirst.mock.callCount(), 0)
    }
    if (origem === "body") {
      assert.equal((await executar({ semBody: true })).res.code, 400)
    }
    for (const tipo of ["ADMIN", "MEMBRO"]) {
      const liberado = await executar({ tipo })
      assert.equal(liberado.res.code, undefined)
      assert.equal(liberado.next.mock.callCount(), 1)
      assert.deepEqual(liberado.next.mock.calls[0].arguments, [])
      if (tipo === "ADMIN") assert.equal(prisma.membroPastoral.findUnique.mock.callCount(), 0)
      const ausente = await executar({ tipo, ausente: true })
      assert.equal(ausente.res.code, 404)
      assert.equal(ausente.next.mock.callCount(), 0)
    }
    for (const vinculo of [null, { ativo: false, papel: "COORDENADOR" }, { ativo: true, papel: "MEMBRO" }]) {
      const negado = await executar({ vinculo })
      assert.equal(negado.res.code, 403)
      assert.equal(negado.next.mock.callCount(), 0)
    }
    const membro = await executar({ tipo: "MEMBRO", vinculo: null })
    assert.equal(membro.res.code, 403)
    assert.equal(membro.next.mock.callCount(), 0)
    for (const campo of ["erroBusca", "erroVinculo"]) {
      const erro = new Error("Falha simulada")
      const falha = await executar({ [campo]: erro })
      assert.equal(falha.res.code, undefined)
      assert.equal(falha.next.mock.callCount(), 1)
      assert.equal(falha.next.mock.calls[0].arguments[0], erro)
    }
  })
}
