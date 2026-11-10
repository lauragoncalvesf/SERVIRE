import assert from "node:assert/strict"
import { mock, test, beforeEach } from "node:test"
import bcrypt from "bcrypt"
import express from "express"
import { once } from "node:events"
const hash = await bcrypt.hash("SenhaAtual12345", 4)
let usuarios, tokens, limites, auditorias
const banco = {
  $queryRaw: mock.fn(async (partes, ...valores) => {
    if (partes.join("").includes("FOR UPDATE")) return [{ id: valores[0] }]
    const [key, segundos] = valores
    const anterior = limites.get(key)
    const registro = !anterior || anterior.expira <= Date.now() ? { attempts: 1, expira: Date.now() + segundos * 1000 } : { ...anterior, attempts: anterior.attempts + 1 }
    limites.set(key, registro); return [registro]
  }),
  usuario: {
    findFirst: async ({ where }) => {
      const u = usuarios.find(u => u.id === where.id)
      return u && u.ativo && (u.tipo === "SUPER_ADMIN" || u.paroquia?.ativa) ? structuredClone(u) : null
    },
    findMany: async ({ where }) => usuarios.filter(u => u.paroquiaId === where.paroquiaId && u.email.toLowerCase() === where.email.equals.toLowerCase()).slice(0, 2).map(u => ({ id: u.id })),
    update: async ({ where, data }) => {
      const u = usuarios.find(u => u.id === where.id)
      Object.assign(u, { ...data, ...(data.versaoSessao ? { versaoSessao: u.versaoSessao + 1 } : {}) }); return structuredClone(u)
    }
  },
  tokenSeguranca: {
    create: async ({ data }) => { const t = { id: tokens.length + 1, criadoEm: new Date(), consumidoEm: null, ...data }; tokens.push(t); return t },
    findUnique: async ({ where }) => structuredClone(tokens.find(t => t.tokenHash === where.tokenHash) || null),
    updateMany: async ({ where, data }) => {
      let count = 0
      for (const token of tokens) {
        if (Object.entries(where).every(([k, v]) => k === "expiraEm" ? token.expiraEm > v.gt : token[k] === v)) { Object.assign(token, data); count++ }
      }
      return { count }
    }
  },
  conviteAdmin: { updateMany: mock.fn(async () => ({ count: 1 })) },
  auditoriaAdmin: { create: async ({ data }) => { auditorias.push(data); return data } }
}
banco.$transaction = async operacao => {
  const snapshot = structuredClone({ usuarios, tokens, limites, auditorias })
  try { return await operacao(banco) } catch (erro) { ({ usuarios, tokens, limites, auditorias } = snapshot); throw erro }
}
mock.module("../src/lib/prisma.js", { defaultExport: banco })
const enviar = mock.fn(async () => ({ status: "enviado" }))
mock.module("../src/services/emailSegurancaService.js", { namedExports: { enviarEmailSeguranca: enviar } })
const s = await import("../src/services/segurancaContaService.js")
const { consumirLimite, hashSeguranca } = await import("../src/services/limiteSegurancaService.js")
const { criarFilaSeguranca } = await import("../src/services/filaSegurancaService.js")
const { default: rotas } = await import("../src/routes/segurancaContaRoutes.js")
const { tratarErros } = await import("../src/middlewares/tratarErros.js")
const sessao = { usuarioId: 3, paroquiaId: 1, versaoSessao: 0 }
const corpo = { senhaAtual: "SenhaAtual12345", emailEsperado: "membro@example.com" }
function usuario(id, tipo = "MEMBRO", paroquiaId = 1) { return { id, nome: `Pessoa ${id}`, email: id === 3 ? "membro@example.com" : `pessoa${id}@example.com`, senha: hash, tipo, paroquiaId, ativo: true, versaoSessao: 0, paroquia: paroquiaId ? { id: paroquiaId, nome: "Paróquia", ativa: true } : null, emailAutorizadoEm: null, emailAutorizadoPor: null, emailConfirmadoEm: null } }
beforeEach(() => {
  usuarios = [usuario(1, "SUPER_ADMIN", null), usuario(2, "ADMIN"), usuario(3), usuario(4, "MEMBRO", 2), usuario(5, "ADMIN", 2)]
  tokens = []; limites = new Map(); auditorias = []
  enviar.mock.resetCalls(); enviar.mock.mockImplementation(async () => ({ status: "enviado" }))
  banco.conviteAdmin.updateMany.mock.resetCalls()
})
async function habilitar() { await s.solicitarConfirmacao(sessao, corpo); const token = enviar.mock.calls.at(-1).arguments[0].token; await s.confirmarEmail({ token }); return token }
async function recuperar() { await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: 1 }); return enviar.mock.calls.at(-1).arguments[0].token }

test("conta existente começa sem elegibilidade e não recebe recuperação", async () => {
  await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: 1 })
  assert.equal(enviar.mock.callCount(), 0); assert.equal(tokens.length, 0)
})
test("autorização pessoal exige senha e endereço atual exato, sem confiar em IDs do body", async () => {
  for (const [body, status] of [[{ ...corpo, senhaAtual: "errada" }, 403], [{ ...corpo, emailEsperado: "outro@example.com" }, 409], [{ ...corpo, usuarioId: 4 }, 400]]) {
    await assert.rejects(s.solicitarConfirmacao(sessao, body), { status })
  }
  assert.equal(tokens.length, 0); assert.equal(enviar.mock.callCount(), 0)
})
test("fluxo pessoal armazena só hash, autoriza com senha e confirma com uso único", async () => {
  const resultado = await s.solicitarConfirmacao(sessao, corpo)
  assert(!JSON.stringify(resultado).includes("token"))
  const envio = enviar.mock.calls[0].arguments[0]
  assert.equal(tokens[0].tokenHash, hashSeguranca(envio.token)); assert.equal(tokens[0].token, undefined)
  assert(Math.abs(tokens[0].expiraEm - Date.now() - 1800000) < 2000)
  assert.equal(usuarios[2].emailAutorizadoPor, 3); assert.equal(usuarios[2].emailConfirmadoEm, null)
  await s.confirmarEmail({ token: envio.token })
  assert(usuarios[2].emailConfirmadoEm)
  await assert.rejects(s.confirmarEmail({ token: envio.token }), { status: 400 })
})
test("recuperação só envia após autorização E confirmação", async () => {
  await s.solicitarConfirmacao(sessao, corpo)
  await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: 1 })
  assert.equal(enviar.mock.callCount(), 1)
  await s.confirmarEmail({ token: enviar.mock.calls[0].arguments[0].token })
  await recuperar(); assert.equal(enviar.mock.callCount(), 2)
})
test("ADMIN autoriza só membro da própria paróquia e registra conferência sem enviar automaticamente", async () => {
  await s.autorizarEmailAdministrativo({ ...sessao, usuarioId: 2 }, 3, { ...corpo, identidadeConferida: true })
  assert.equal(usuarios[2].emailAutorizadoPor, 2); assert.equal(enviar.mock.callCount(), 0)
  assert.equal(auditorias[0].acao, "AUTORIZAR_EMAIL_IDENTIDADE_CONFERIDA")
  await s.solicitarConfirmacao({ ...sessao, usuarioId: 2 }, corpo, 3)
  assert.equal(enviar.mock.callCount(), 1)
})
test("hierarquia rejeita autorizar sem conferência, autoaprovação, outro ADMIN e outra paróquia", async () => {
  const admin = { ...sessao, usuarioId: 2 }
  await assert.rejects(s.autorizarEmailAdministrativo(admin, 3, corpo), { status: 400 })
  for (const id of [2, 4, 5, 1]) await assert.rejects(s.autorizarEmailAdministrativo(admin, id, { ...corpo, identidadeConferida: true }), { status: 403 })
  await assert.rejects(s.autorizarEmailAdministrativo(sessao, 2, { ...corpo, identidadeConferida: true }), { status: 403 })
})
test("SUPER_ADMIN autoriza ADMIN mas não membros ou sua própria conta", async () => {
  const global = { usuarioId: 1, paroquiaId: null, versaoSessao: 0 }
  await s.autorizarEmailAdministrativo(global, 2, { senhaAtual: corpo.senhaAtual, emailEsperado: usuarios[1].email, identidadeConferida: true })
  assert.equal(usuarios[1].emailAutorizadoPor, 1)
  for (const id of [1, 3]) await assert.rejects(s.autorizarEmailAdministrativo(global, id, { ...corpo, identidadeConferida: true }), { status: 403 })
})
test("não envia confirmação administrativa sem autorização prévia", async () => {
  await assert.rejects(s.solicitarConfirmacao({ ...sessao, usuarioId: 2 }, corpo, 3), { status: 409 })
})
test("mesmo e-mail em duas paróquias recupera somente o escopo indicado", async () => {
  await habilitar()
  usuarios[3].email = corpo.emailEsperado
  Object.assign(usuarios[3], { emailAutorizadoEm: new Date(), emailConfirmadoEm: new Date(), emailAutorizadoPor: 5 })
  await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: 2 })
  assert.equal(enviar.mock.calls.at(-1).arguments[0].usuario.id, 4)
  assert.equal(tokens.at(-1).usuarioId, 4)
})
test("escopo global não cai em conta paroquial nem escolhe conta ambígua", async () => {
  await habilitar()
  await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: null })
  assert.equal(enviar.mock.callCount(), 1)
  usuarios.push({ ...usuario(6), email: "MEMBRO@example.com" })
  await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: 1 })
  assert.equal(enviar.mock.callCount(), 1)
})
test("token de outro propósito, expirado ou anterior à troca de e-mail/versão é rejeitado", async () => {
  await s.solicitarConfirmacao(sessao, corpo)
  const token = enviar.mock.calls[0].arguments[0].token
  await assert.rejects(s.redefinirSenha({ token, novaSenha: "NovaSenhaSegura123", confirmarSenha: "NovaSenhaSegura123" }), { status: 400 })
  usuarios[2].email = "mudou@example.com"
  await assert.rejects(s.confirmarEmail({ token }), { status: 400 })
  usuarios[2].email = corpo.emailEsperado; usuarios[2].versaoSessao = 1
  await assert.rejects(s.confirmarEmail({ token }), { status: 400 })
  usuarios[2].versaoSessao = 0; tokens[0].expiraEm = new Date(0)
  await assert.rejects(s.confirmarEmail({ token }), { status: 400 })
})
test("redefinição forte revoga sessões e convites, usa bcrypt e não retorna JWT", async () => {
  await habilitar(); const token = await recuperar()
  const resultado = await s.redefinirSenha({ token, novaSenha: "NovaSenhaSegura123", confirmarSenha: "NovaSenhaSegura123" })
  assert.equal(usuarios[2].versaoSessao, 1); assert(await bcrypt.compare("NovaSenhaSegura123", usuarios[2].senha))
  assert.equal(resultado.token, undefined); assert.equal(banco.conviteAdmin.updateMany.mock.callCount(), 1)
  await assert.rejects(s.redefinirSenha({ token, novaSenha: "NovaSenhaSegura456", confirmarSenha: "NovaSenhaSegura456" }), { status: 400 })
})
test("rejeita senha fraca, confirmação divergente e reutilização sem consumir token", async () => {
  await habilitar(); const token = await recuperar()
  for (const [novaSenha, confirmarSenha] of [["curta", "curta"], ["NovaSenhaSegura123", "Diferente12345"], [corpo.senhaAtual, corpo.senhaAtual]]) {
    await assert.rejects(s.redefinirSenha({ token, novaSenha, confirmarSenha }), { status: 400 })
  }
  assert.equal(tokens.at(-1).consumidoEm, null)
})
test("conta ou paróquia inativas não recuperam nem confirmam", async () => {
  await habilitar(); enviar.mock.resetCalls()
  usuarios[2].ativo = false; await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: 1 })
  usuarios[2].ativo = true; usuarios[2].paroquia.ativa = false; await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: 1 })
  assert.equal(enviar.mock.callCount(), 0)
})
test("cooldown e teto horário são persistidos e rejeitam repetição concorrente", async () => {
  await s.solicitarConfirmacao(sessao, corpo)
  await assert.rejects(s.solicitarConfirmacao(sessao, corpo), { status: 429 })
  for (let i = 0; i < 2; i++) {
    for (const limite of limites.values()) if (limite.expira < Date.now() + 100000) limite.expira = 0
    await s.solicitarConfirmacao(sessao, corpo)
  }
  for (const limite of limites.values()) if (limite.expira < Date.now() + 100000) limite.expira = 0
  await assert.rejects(s.solicitarConfirmacao(sessao, corpo), { status: 429 })
  assert.equal(enviar.mock.callCount(), 3)
})
test("falha Resend preserva autorização e token, sem retornar o segredo", async () => {
  enviar.mock.mockImplementation(async () => ({ status: "nao_enviado", motivo: "FALHA_RESEND" }))
  const resultado = await s.solicitarConfirmacao(sessao, corpo)
  assert.equal(resultado.envio.status, "nao_enviado"); assert(usuarios[2].emailAutorizadoEm)
  assert.equal(tokens[0].consumidoEm, null)
  assert(!JSON.stringify(resultado).includes(enviar.mock.calls[0].arguments[0].token))
})
test("sessão antiga não autoriza e campos proibidos no pedido público são rejeitados", async () => {
  usuarios[2].versaoSessao = 1
  await assert.rejects(s.solicitarConfirmacao(sessao, corpo), { status: 401 })
  assert.throws(() => s.validarSolicitacaoPublica({ email: corpo.emailEsperado, paroquiaId: 1, usuarioId: 4 }), { status: 400 })
})
test("limites guardam apenas chaves derivadas e usam namespace separado do login", async () => {
  for (let i = 0; i < 5; i++) assert(await consumirLimite(banco, "ip:recuperacao:127.0.0.1", 5, 900))
  assert.equal(await consumirLimite(banco, "ip:recuperacao:127.0.0.1", 5, 900), false)
  assert([...limites.keys()].every(key => /^[a-f0-9]{64}$/.test(key)))
})
test("fila limita concorrência, descarta excesso e sanitiza falhas", async t => {
  const warn = mock.method(console, "warn", () => {})
  t.after(() => warn.mock.restore())
  const fila = criarFilaSeguranca({ capacidade: 1, concorrencia: 1 })
  assert(fila(async () => { throw new Error("token-e-chave-privados") }))
  assert.equal(fila(async () => {}), false)
  await new Promise(resolve => setTimeout(resolve, 20))
  assert(!JSON.stringify(warn.mock.calls).includes("token-e-chave-privados"))
})
test("API pública responde igualmente para elegível e inexistente, não expõe links e aplica 429 por IP", async t => {
  await habilitar()
  const app = express(); app.use(express.json()); rotas(app); app.use(tratarErros)
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening")
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve) }))
  const base = `http://127.0.0.1:${server.address().port}`
  let referencia
  for (let i = 0; i < 6; i++) {
    const resposta = await fetch(base + "/auth/esqueci-senha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: i % 2 ? "ausente@example.com" : corpo.emailEsperado, paroquiaId: 1 }) })
    const dados = await resposta.json()
    if (i === 0) referencia = dados
    assert.equal(resposta.status, i < 5 ? 202 : 429)
    if (i < 5) assert.deepEqual(dados, referencia)
    assert(!JSON.stringify(dados).includes("#token=")); assert.equal(dados.token, undefined)
  }
  await new Promise(resolve => setTimeout(resolve, 20))
})
