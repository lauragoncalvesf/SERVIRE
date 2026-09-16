import assert from "node:assert/strict"
import { mock, test } from "node:test"

const prisma = {
  funcaoPastoral: { findFirst: mock.fn() },
  funcaoEscala: { findFirst: mock.fn() },
  membroPastoral: { findUnique: mock.fn() }
}

mock.module("../src/lib/prisma.js", { defaultExport: prisma })

const {
  permitirCoordenadorPorFuncaoPastoral,
  permitirCoordenadorPorFuncaoEscala
} = await import("../src/middlewares/permitirCoordenadorPastoral.js")

for (const [modelo, parametro, middleware, registro] of [
  ["funcaoPastoral", "funcaoId", permitirCoordenadorPorFuncaoPastoral, { pastoralId: 20 }],
  ["funcaoEscala", "funcaoEscalaId", permitirCoordenadorPorFuncaoEscala, { escala: { pastoralId: 20 } }]
]) {
  for (const cenario of [
    { nome: "administrador", tipo: "ADMIN", esperado: 200 },
    { nome: "coordenador da pastoral", vinculo: { ativo: true, papel: "COORDENADOR" }, esperado: 200 },
    { nome: "coordenador de outra pastoral", vinculo: null, esperado: 403 },
    { nome: "vínculo inativo", vinculo: { ativo: false, papel: "COORDENADOR" }, esperado: 403 },
    { nome: "membro sem coordenação", vinculo: { ativo: true, papel: "MEMBRO" }, esperado: 403 },
    { nome: "usuário comum", tipo: "MEMBRO", esperado: 403 },
    { nome: "recurso ausente ou de outra paróquia, mesmo para admin", tipo: "ADMIN", ausente: true, esperado: 404 },
    ...["abc", "0", "-1", "1.5"].map(id => ({ nome: `ID inválido ${id}`, id, esperado: 400 }))
  ]) {
    test(`${modelo}: ${cenario.nome}`, async () => {
      prisma[modelo].findFirst.mock.resetCalls()
      prisma.membroPastoral.findUnique.mock.resetCalls()
      prisma[modelo].findFirst.mock.mockImplementation(async ({ where }) => {
        assert.equal(where.id, 10)
        if (modelo === "funcaoPastoral") {
          assert.equal(where.pastoral.paroquiaId, 3)
        } else {
          assert.equal(where.escala.evento.paroquiaId, 3)
          assert.equal(where.escala.pastoral.paroquiaId, 3)
        }
        return cenario.ausente ? null : registro
      })
      prisma.membroPastoral.findUnique.mock.mockImplementation(async ({ where }) => {
        assert.deepEqual(where.usuarioId_pastoralId, { usuarioId: 7, pastoralId: 20 })
        return cenario.vinculo
      })
      const req = {
        params: { [parametro]: cenario.id ?? "10" },
        body: { pastoralId: 999 },
        usuarioId: 7,
        paroquiaId: 3,
        tipoUsuario: cenario.tipo ?? "MEMBRO"
      }
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this },
        json(body) { this.body = body; return this }
      }
      const next = mock.fn()
      await middleware()(req, res, next)
      assert.equal(res.statusCode, cenario.esperado)
      assert.equal(next.mock.callCount(), cenario.esperado === 200 ? 1 : 0)
      if (cenario.esperado === 400) assert.equal(prisma[modelo].findFirst.mock.callCount(), 0)
      const deveConsultarVinculo = cenario.tipo !== "ADMIN" && !cenario.ausente && !cenario.id
      assert.equal(prisma.membroPastoral.findUnique.mock.callCount(), deveConsultarVinculo ? 1 : 0)
    })
  }
}
