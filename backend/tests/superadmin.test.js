import assert from "node:assert/strict"
import { mock, test } from "node:test"
const tx = { conviteAdmin: { updateMany: mock.fn(), create: mock.fn(), findUnique: mock.fn() }, usuario: { update: mock.fn(), count: mock.fn() }, paroquia: { findUnique: mock.fn() }, auditoriaAdmin: { create: mock.fn() } }
mock.module("../src/lib/prisma.js", { defaultExport: { $transaction: async callback => callback(tx) } })
const { dadosPessoa, idValido, validarSenha, emitirConvite, hashToken, protegerUltimoAdmin, aceitarConvite } = await import("../src/services/superadminService.js")

test("valida IDs sem coerções e limita tamanho", () => {
  for (const valor of [null, undefined, true, [], {}, -1, 0, 1.1, "abc", "1e3", 2147483648]) assert.throws(() => idValido(valor), { status: 400 })
  assert.equal(idValido("42"), 42)
})
test("normaliza contatos, exige nome, e-mail e UF válidos; ignora privilégios do payload", () => {
  assert.deepEqual(dadosPessoa({ nome: " Teste ", email: " TESTE@EXAMPLE.COM ", tipo: "SUPER_ADMIN", paroquiaId: 9, ativo: false }), { nome: "Teste", email: "teste@example.com", telefone: null })
  for (const body of [{}, { nome: " " }, { nome: "X", email: "inválido" }, { nome: "X", email: "a@b.com", telefone: {} }]) assert.throws(() => dadosPessoa(body), { status: 400 })
  assert.throws(() => dadosPessoa({ nome: "X", estado: "XX" }, true), { status: 400 })
})
test("senha exige tamanho, letras e números e respeita limite em bytes do bcrypt", () => {
  for (const senha of [null, 12, "curta", "123456789012", "abcdefghijkl", "á".repeat(36) + "A1"]) assert.throws(() => validarSenha(senha), { status: 400 })
  validarSenha("SenhaSegura123456")
})
test("convite usa entropia segura, hash persistido e invalida convites anteriores", async () => {
  const convite = await emitirConvite(tx, 7)
  assert.match(convite.token, /^[a-f0-9]{64}$/)
  assert.equal(tx.conviteAdmin.create.mock.calls.at(-1).arguments[0].data.tokenHash, hashToken(convite.token))
  assert.equal(JSON.stringify(tx.conviteAdmin.create.mock.calls.at(-1).arguments).includes(convite.token), false)
  assert.equal(tx.conviteAdmin.updateMany.mock.calls.at(-1).arguments[0].where.usuarioId, 7)
  assert(convite.expiraEm > new Date())
})
test("último administrador ativo de paróquia ativa é protegido", async () => {
  tx.paroquia.findUnique.mock.mockImplementation(async () => ({ ativa: true }))
  tx.usuario.count.mock.mockImplementation(async () => 0)
  await assert.rejects(protegerUltimoAdmin(tx, { id: 1, paroquiaId: 1, ativo: true }), { status: 409 })
  tx.usuario.count.mock.mockImplementation(async () => 1)
  await protegerUltimoAdmin(tx, { id: 1, paroquiaId: 1, ativo: true })
  tx.paroquia.findUnique.mock.mockImplementation(async () => ({ ativa: false }))
  await protegerUltimoAdmin(tx, { id: 1, paroquiaId: 1, ativo: true })
})
test("convite rejeita conta inativa, paróquia inativa, tipo incorreto, expiração e reutilização sem mudar senha", async () => {
  const valido = { id: 1, usuarioId: 7, consumidoEm: null, expiraEm: new Date(Date.now() + 60000), usuario: { tipo: "ADMIN", ativo: true, paroquia: { ativa: true } } }
  const invalidos = [null, { ...valido, consumidoEm: new Date() }, { ...valido, expiraEm: new Date(0) }, ...[{ tipo: "MEMBRO" }, { ativo: false }, { paroquia: { ativa: false } }].map(usuario => ({ ...valido, usuario: { ...valido.usuario, ...usuario } }))]
  tx.usuario.update.mock.resetCalls()
  for (const registro of invalidos) {
    tx.conviteAdmin.findUnique.mock.mockImplementation(async () => registro)
    await assert.rejects(aceitarConvite("a".repeat(64), "SenhaSegura12345"), { status: 400 })
  }
  assert.equal(tx.usuario.update.mock.callCount(), 0)
})
test("consumo condicional rejeita corrida de aceitação de convite", async () => {
  tx.conviteAdmin.findUnique.mock.mockImplementation(async () => ({ id: 1, usuarioId: 7, consumidoEm: null, expiraEm: new Date(Date.now() + 60000), usuario: { tipo: "ADMIN", ativo: true, paroquia: { ativa: true } } }))
  tx.conviteAdmin.updateMany.mock.mockImplementation(async () => ({ count: 0 }))
  await assert.rejects(aceitarConvite("a".repeat(64), "SenhaSegura12345"), { status: 400 })
})
