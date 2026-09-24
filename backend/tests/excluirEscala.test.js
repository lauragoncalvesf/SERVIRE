import assert from "node:assert/strict"
import { mock, test } from "node:test"

const prisma = {
  escala: {
    findFirst: mock.fn(),
    delete: mock.fn()
  }
}

mock.module("../src/lib/prisma.js", { defaultExport: prisma })
mock.module("../src/services/transacao.js", { namedExports: { executarTransacao: mock.fn() } })
mock.module("../src/services/notificacaoServices.js", {
  namedExports: { criarNotificacao: mock.fn(), criarNotificacaoSeNaoExistir: mock.fn() }
})
mock.module("../src/services/escalaService.js", {
  namedExports: { atualizarStatusAutomaticoEscala: mock.fn(), escalaPodeSerEditada: mock.fn() }
})
mock.module("../src/services/escalaPermissions.js", {
  namedExports: { usuarioPodeGerenciarPastoral: mock.fn() }
})

const { excluirEscala } = await import("../src/controllers/escalaController.js")

async function executar(escalaId = "8") {
  const res = {
    status(code) { this.code = code; return this },
    json(data) { this.body = data; return this }
  }
  await excluirEscala({ params: { escalaId }, paroquiaId: 3 }, res)
  return res
}

test("exclusão limita a escala à paróquia e apaga pelo ID", async () => {
  prisma.escala.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 8, evento: { paroquiaId: 3 } })
    return { id: 8 }
  })
  prisma.escala.delete.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { id: 8 })
    return { id: 8 }
  })

  const res = await executar()
  assert.deepEqual(res.body, { mensagem: "Escala excluída com sucesso" })
})

test("exclusão rejeita ID inválido e escala de outra paróquia", async () => {
  assert.equal((await executar("abc")).code, 400)
  prisma.escala.findFirst.mock.mockImplementation(async () => null)
  assert.equal((await executar()).code, 404)
})

