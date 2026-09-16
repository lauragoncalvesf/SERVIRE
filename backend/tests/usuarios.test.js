import assert from "node:assert/strict"
import { mock, test } from "node:test"
import bcrypt from "bcrypt"

const prisma = {
  paroquia: { findUnique: mock.fn() },
  membroPastoral: { findFirst: mock.fn() },
  usuario: { findFirst: mock.fn(), create: mock.fn(), findMany: mock.fn() }
}
mock.module("../src/lib/prisma.js", { defaultExport: prisma })
const { criarUsuario, listarUsuarios } = await import("../src/controllers/usuarioController.js")
const dados = { nome: " Teste ", email: "teste@example.com", senha: " senha preservada " }

async function executar(body, handler = criarUsuario, tipoUsuario = "ADMIN") {
  const res = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this }
  }
  const next = mock.fn()
  await handler({ body, paroquiaId: 3, usuarioId: 7, tipoUsuario }, res, next)
  return { res, next }
}

function preparar() {
  for (const model of Object.values(prisma)) {
    for (const method of Object.values(model)) method.mock.resetCalls()
  }
  prisma.paroquia.findUnique.mock.mockImplementation(async ({ where }) => {
    assert.equal(where.id, 3)
    return { id: 3, ativa: true }
  })
  prisma.usuario.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { email: dados.email, paroquiaId: 3 })
    return null
  })
}

test("valida campos antes de acessar o banco", async () => {
  preparar()
  const invalidos = [undefined, null, {}, ...[
    ["nome", {}], ["nome", " "], ["email", []], ["email", "email-invalido"],
    ["email", " teste@example.com "], ["senha", 123], ["senha", {}], ["senha", ""], ["senha", "curta"],
    ["telefone", 123], ["telefone", {}], ["tipo", "SUPERADMIN"], ["tipo", null],
    ["tipo", ""], ["tipo", ["ADMIN"]]
  ].map(([campo, valor]) => ({ ...dados, [campo]: valor }))]
  for (const body of invalidos) {
    const { res, next } = await executar(body)
    assert.equal(res.code, 400)
    assert.equal(next.mock.callCount(), 0)
  }
  assert.equal(prisma.paroquia.findUnique.mock.callCount(), 0)
  assert.equal(prisma.usuario.create.mock.callCount(), 0)
})

test("cria na paróquia autenticada, preserva senha e não retorna hash", async () => {
  preparar()
  prisma.usuario.create.mock.mockImplementation(async ({ data, select }) => {
    assert.equal(data.paroquiaId, 3)
    assert.equal(data.nome, "Teste")
    assert.equal(data.telefone, null)
    assert.equal(data.tipo, "MEMBRO")
    assert.notEqual(data.senha, dados.senha)
    assert.equal(await bcrypt.compare(dados.senha, data.senha), true)
    assert.equal(await bcrypt.compare(dados.senha.trim(), data.senha), false)
    assert.equal(select.senha, undefined)
    return Object.fromEntries(Object.keys(select).map(key => [key, key === "id" ? 7 : data[key]]))
  })
  const { res, next } = await executar({ ...dados, paroquiaId: 999, telefone: " " })
  assert.equal(res.code, 201)
  assert.equal(res.body.senha, undefined)
  assert.equal(next.mock.callCount(), 0)
})

test("bloqueia paróquia indisponível e email duplicado", async () => {
  preparar()
  for (const paroquia of [null, { ativa: false }]) {
    prisma.paroquia.findUnique.mock.mockImplementation(async () => paroquia)
    assert.equal((await executar(dados)).res.code, 404)
  }
  assert.equal(prisma.usuario.create.mock.callCount(), 0)
  preparar()
  prisma.usuario.findFirst.mock.mockImplementation(async () => ({ id: 7 }))
  assert.equal((await executar(dados)).res.code, 409)
  assert.equal(prisma.usuario.create.mock.callCount(), 0)
})

test("duplicidade concorrente retorna 409 e demais falhas seguem para next", async () => {
  preparar()
  prisma.usuario.create.mock.mockImplementation(async () => { throw { code: "P2002" } })
  const duplicado = await executar(dados)
  assert.equal(duplicado.res.code, 409)
  assert.equal(duplicado.next.mock.callCount(), 0)
  const erro = new Error("Falha simulada")
  prisma.usuario.create.mock.mockImplementation(async () => { throw erro })
  const falha = await executar(dados)
  assert.equal(falha.res.body, undefined)
  assert.equal(falha.next.mock.calls[0].arguments[0], erro)
})

test("listagem usa a paróquia autenticada, omite senha e encaminha falhas", async () => {
  prisma.usuario.findMany.mock.mockImplementation(async ({ where, select }) => {
    assert.deepEqual(where, { paroquiaId: 3 })
    assert.equal(select.senha, undefined)
    return [{ id: 7, nome: "Teste" }]
  })
  const resultado = await executar({ paroquiaId: 999 }, listarUsuarios)
  assert.deepEqual(resultado.res.body, [{ id: 7, nome: "Teste" }])
  const erro = new Error("Falha simulada")
  prisma.usuario.findMany.mock.mockImplementation(async () => { throw erro })
  const falha = await executar({}, listarUsuarios)
  assert.equal(falha.next.mock.calls[0].arguments[0], erro)
})

test("membro sem coordenação não pode criar nem listar usuários", async () => {
  preparar()
  prisma.membroPastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, {
      usuarioId: 7, ativo: true, papel: "COORDENADOR",
      pastoral: { paroquiaId: 3, ativa: true }
    })
    return null
  })
  for (const handler of [criarUsuario, listarUsuarios]) {
    const { res, next } = await executar(dados, handler, "MEMBRO")
    assert.equal(res.code, 403)
    assert.equal(next.mock.callCount(), 0)
  }
  assert.equal(prisma.usuario.create.mock.callCount(), 0)
  assert.equal(prisma.usuario.findMany.mock.callCount(), 0)
})

test("coordenador por vínculo cria apenas MEMBRO mesmo solicitando ADMIN", async () => {
  preparar()
  prisma.membroPastoral.findFirst.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, {
      usuarioId: 7, ativo: true, papel: "COORDENADOR",
      pastoral: { paroquiaId: 3, ativa: true }
    })
    return { id: 20 }
  })
  prisma.usuario.create.mock.mockImplementation(async ({ data }) => {
    assert.equal(data.tipo, "MEMBRO")
    assert.equal(data.paroquiaId, 3)
    return { id: 8, tipo: data.tipo }
  })
  const { res, next } = await executar({ ...dados, tipo: "ADMIN" }, criarUsuario, "MEMBRO")
  assert.equal(res.code, 201)
  assert.equal(res.body.tipo, "MEMBRO")
  assert.equal(next.mock.callCount(), 0)
  prisma.usuario.findMany.mock.mockImplementation(async ({ where }) => {
    assert.deepEqual(where, { paroquiaId: 3 })
    return [{ id: 8 }]
  })
  const lista = await executar({}, listarUsuarios, "MEMBRO")
  assert.deepEqual(lista.res.body, [{ id: 8 }])
  assert.equal(lista.next.mock.callCount(), 0)
})
