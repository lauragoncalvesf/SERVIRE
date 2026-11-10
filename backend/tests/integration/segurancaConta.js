// Só cria bases novas e descartáveis em PostgreSQL LOCAL. Nunca usa .env como destino.
import assert from "node:assert/strict"
import { mock } from "node:test"
import { readdir, readFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import pg from "pg"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { once } from "node:events"
const url = process.env.TEST_DATABASE_URL
if (!url) throw new Error("Defina TEST_DATABASE_URL local e descartável")
const parsed = new URL(url)
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !/^\/servire_test_[a-z0-9_]+$/.test(parsed.pathname)) throw new Error("Base precisa ser local e ter prefixo servire_test_")
process.env.DATABASE_URL = url; process.env.NODE_ENV = "test"
const envios = []
mock.module("../../src/services/emailSegurancaService.js", { namedExports: { enviarEmailSeguranca: async dados => { envios.push(dados); return { status: "enviado" } } } })
const root = new URL("../../", import.meta.url)
const adminDb = new pg.Client({ connectionString: new URL("/postgres", url).href })
await adminDb.connect()
const nome = parsed.pathname.slice(1)
await adminDb.query(`CREATE DATABASE "${nome}"`)
await adminDb.query(`CREATE DATABASE "${nome}_deploy"`)
await adminDb.end()
const db = new pg.Client({ connectionString: url }); await db.connect()
let prisma, server
let verificacoes = 0
function igual(a, b) { assert.deepEqual(a, b); verificacoes++ }
async function rejeitar(promessa, status) { await assert.rejects(promessa, { status }); verificacoes++ }
try {
  const migrations = (await readdir(new URL("prisma/migrations/", root))).filter(n => /^\d/.test(n)).sort()
  const nova = "20261109000100_confirmacao_recuperacao_email"
  for (const migration of migrations.filter(n => n < nova)) await db.query(await readFile(new URL(`prisma/migrations/${migration}/migration.sql`, root), "utf8"))
  const hash = await bcrypt.hash("SenhaAtual12345", 4)
  await db.query(`INSERT INTO "Paroquia" ("nome","atualizadoEm") VALUES ('Legado',NOW())`)
  await db.query(`INSERT INTO "Usuario" ("nome","email","senha","tipo","paroquiaId","atualizadoEm") VALUES ('Legado','legado@example.com',$1,'MEMBRO',1,NOW())`, [hash])
  for (const migration of migrations.filter(n => n >= nova)) await db.query(await readFile(new URL(`prisma/migrations/${migration}/migration.sql`, root), "utf8"))
  const legado = (await db.query('SELECT "emailAutorizadoEm","emailConfirmadoEm","senha","versaoSessao" FROM "Usuario" WHERE id=1')).rows[0]
  igual(legado, { emailAutorizadoEm: null, emailConfirmadoEm: null, senha: hash, versaoSessao: 0 })
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { cwd: root, env: { ...process.env, DATABASE_URL: new URL(`/${nome}_deploy`, url).href }, stdio: "pipe" }); verificacoes++
  prisma = (await import("../../src/lib/prisma.js")).default
  const s = await import("../../src/services/segurancaContaService.js")
  const { hashSeguranca } = await import("../../src/services/limiteSegurancaService.js")
  const p = await prisma.paroquia.create({ data: { nome: "Outra" } })
  const admin = await prisma.usuario.create({ data: { nome: "Admin", email: "admin@example.com", senha: hash, tipo: "ADMIN", paroquiaId: 1 } })
  const global = await prisma.usuario.create({ data: { nome: "Global", email: "global@example.com", senha: hash, tipo: "SUPER_ADMIN" } })
  const outro = await prisma.usuario.create({ data: { nome: "Outro", email: "legado@example.com", senha: hash, paroquiaId: p.id } })
  const sessao = { usuarioId: 1, paroquiaId: 1, versaoSessao: 0 }
  const corpo = { senhaAtual: "SenhaAtual12345", emailEsperado: "legado@example.com" }
  await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: 1 }); igual(envios.length, 0)
  await s.solicitarConfirmacao(sessao, corpo)
  const confirmacao = envios.at(-1)
  const registro = await prisma.tokenSeguranca.findFirst({ where: { usuarioId: 1 } })
  igual(registro.tokenHash, hashSeguranca(confirmacao.token)); igual(registro.token, undefined)
  assert(Math.abs(registro.expiraEm - Date.now() - 1800000) < 5000); verificacoes++
  const concorrentes = await Promise.allSettled([s.confirmarEmail({ token: confirmacao.token }), s.confirmarEmail({ token: confirmacao.token })])
  igual(concorrentes.filter(r => r.status === "fulfilled").length, 1)
  await rejeitar(s.confirmarEmail({ token: confirmacao.token }), 400)
  await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: p.id }); igual(envios.length, 1)
  await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: null }); igual(envios.length, 1)
  await s.processarRecuperacao({ email: corpo.emailEsperado, paroquiaId: 1 })
  const recuperacao = envios.at(-1)
  igual(recuperacao.usuario.id, 1)
  await rejeitar(s.redefinirSenha({ token: confirmacao.token, novaSenha: "NovaSenhaSegura123", confirmarSenha: "NovaSenhaSegura123" }), 400)
  const resultado = await s.redefinirSenha({ token: recuperacao.token, novaSenha: "NovaSenhaSegura123", confirmarSenha: "NovaSenhaSegura123" })
  igual(resultado.token, undefined)
  const apos = await prisma.usuario.findUnique({ where: { id: 1 } })
  igual(apos.versaoSessao, 1); assert(await bcrypt.compare("NovaSenhaSegura123", apos.senha)); verificacoes++
  await rejeitar(s.redefinirSenha({ token: recuperacao.token, novaSenha: "NovaSenhaSegura456", confirmarSenha: "NovaSenhaSegura456" }), 400)
  igual((await prisma.usuario.findUnique({ where: { id: outro.id } })).senha, hash)
  // O trigger cobre edições já existentes e alterações diretas: endereço antigo não revive.
  await prisma.usuario.update({ where: { id: 1 }, data: { email: "novo@example.com" } })
  let u = await prisma.usuario.findUnique({ where: { id: 1 } })
  igual(u.emailAutorizadoEm, null); igual(u.emailConfirmadoEm, null); igual(u.versaoSessao, 2)
  await prisma.usuario.update({ where: { id: 1 }, data: { email: corpo.emailEsperado } })
  igual((await prisma.usuario.findUnique({ where: { id: 1 } })).emailConfirmadoEm, null)
  await rejeitar(s.confirmarEmail({ token: confirmacao.token }), 400)
  // Hierarquia e reautenticação administrativas reais.
  const sessaoAdmin = { usuarioId: admin.id, paroquiaId: 1, versaoSessao: 0 }
  await rejeitar(s.autorizarEmailAdministrativo(sessaoAdmin, outro.id, { senhaAtual: corpo.senhaAtual, emailEsperado: outro.email, identidadeConferida: true }), 403)
  await rejeitar(s.autorizarEmailAdministrativo(sessaoAdmin, admin.id, { senhaAtual: corpo.senhaAtual, emailEsperado: admin.email, identidadeConferida: true }), 403)
  await s.autorizarEmailAdministrativo(sessaoAdmin, 1, { ...corpo, identidadeConferida: true })
  igual((await prisma.usuario.findUnique({ where: { id: 1 } })).emailAutorizadoPor, admin.id)
  const globalSessao = { usuarioId: global.id, paroquiaId: null, versaoSessao: 0 }
  await s.autorizarEmailAdministrativo(globalSessao, admin.id, { senhaAtual: corpo.senhaAtual, emailEsperado: admin.email, identidadeConferida: true })
  igual((await prisma.usuario.findUnique({ where: { id: admin.id } })).emailAutorizadoPor, global.id)
  await rejeitar(s.autorizarEmailAdministrativo(globalSessao, 1, { ...corpo, identidadeConferida: true }), 403)
  // Cooldown e limites sobrevivem à criação de novas instâncias/request; duas chamadas só emitem uma.
  const corpoAdmin = { senhaAtual: corpo.senhaAtual, emailEsperado: admin.email }
  const simultaneos = await Promise.allSettled([s.solicitarConfirmacao(globalSessao, corpoAdmin, admin.id), s.solicitarConfirmacao(globalSessao, corpoAdmin, admin.id)])
  igual(simultaneos.filter(r => r.status === "fulfilled").length, 1)
  const tokenAdmin = envios.at(-1).token
  await prisma.usuario.update({ where: { id: admin.id }, data: { email: "mudou-admin@example.com" } })
  igual((await prisma.tokenSeguranca.findUnique({ where: { tokenHash: hashSeguranca(tokenAdmin) } })).consumidoEm !== null, true)
  await rejeitar(s.confirmarEmail({ token: tokenAdmin }), 400)
  // Integridade: impedir confirmação sem autorização no banco.
  await assert.rejects(db.query('UPDATE "Usuario" SET "emailConfirmadoEm"=NOW() WHERE id=$1', [outro.id]), { code: "23514" }); verificacoes++
  // Edição seguida de falha faz rollback também da invalidação pelo trigger.
  const estadoAntes = await prisma.usuario.findUnique({ where: { id: 1 } })
  await assert.rejects(prisma.$transaction(async tx => { await tx.usuario.update({ where: { id: 1 }, data: { email: "rollback@example.com" } }); throw new Error("rollback") })); verificacoes++
  u = await prisma.usuario.findUnique({ where: { id: 1 } })
  igual(u.email, estadoAntes.email); igual(u.emailAutorizadoEm, estadoAntes.emailAutorizadoEm)
  // Rotas reais: whitelist pessoal global, hierarquia e autorização exigida no HTTP.
  process.env.JWT_SECRET = "segredo-exclusivo-integracao-seguranca"
  const app = (await import("../../src/app.js")).default
  server = app.listen(0, "127.0.0.1"); await once(server, "listening")
  const origem = `http://127.0.0.1:${server.address().port}`
  async function assinar(id) {
    const conta = await prisma.usuario.findUnique({ where: { id } })
    return jwt.sign({ usuarioId: id, paroquiaId: conta.paroquiaId, versaoSessao: conta.versaoSessao }, process.env.JWT_SECRET, { expiresIn: "1h", algorithm: "HS256" })
  }
  async function http(caminho, body, token) {
    const resposta = await fetch(origem + caminho, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
    const dados = await resposta.json()
    igual(dados.token, undefined)
    return resposta.status
  }
  const gt = await assinar(global.id), at = await assinar(admin.id), mt = await assinar(outro.id)
  igual(await http("/meu-perfil/email/confirmacao", { senhaAtual: corpo.senhaAtual, emailEsperado: global.email }, gt), 200)
  igual(await http("/meu-perfil/email/confirmacao", corpo), 401)
  igual(await http(`/usuarios/1/email/autorizar`, { ...corpo, identidadeConferida: true }, gt), 403)
  igual(await http(`/superadmin/admins/${admin.id}/email/autorizar`, { ...corpo, identidadeConferida: true }, mt), 403)
  igual(await http(`/usuarios/${outro.id}/email/autorizar`, { senhaAtual: corpo.senhaAtual, emailEsperado: outro.email, identidadeConferida: true }, at), 403)
  igual(await http("/usuarios/1/email/autorizar", { ...corpo, identidadeConferida: true }, at), 200)
  igual(await http("/auth/redefinir-senha", { token: "0".repeat(64), novaSenha: "NovaSenhaSegura123", confirmarSenha: "NovaSenhaSegura123" }), 400)
  igual(await http("/auth/confirmar-email", { token: "0".repeat(64) }), 400)
  console.log(`Segurança PostgreSQL: ${verificacoes} verificações aprovadas; migração com legado, deploy completo, concorrência, trigger e rollback.`)
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  if (prisma) await prisma.$disconnect()
  await db.end()
}
