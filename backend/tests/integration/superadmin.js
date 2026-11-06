// Exclusivamente PostgreSQL descartável local. Nunca lê DATABASE_URL do .env.
import assert from "node:assert/strict"
import { once } from "node:events"
import { readdir, readFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import pg from "pg"
import bcrypt from "bcrypt"

const url = process.env.TEST_DATABASE_URL
if (!url) throw new Error("Defina TEST_DATABASE_URL para banco descartável local")
const parsed = new URL(url)
if (!["127.0.0.1", "localhost"].includes(parsed.hostname) || !/^\/servire_test_[a-z0-9_]+$/.test(parsed.pathname)) throw new Error("Teste exige banco local com prefixo servire_test_")
process.env.DATABASE_URL = url
process.env.JWT_SECRET = "segredo-apenas-integracao-descartavel"
process.env.NODE_ENV = "test"
const root = new URL("../../", import.meta.url)
const client = new pg.Client({ connectionString: new URL("/postgres", url).href })
await client.connect()
const nome = parsed.pathname.slice(1)
// CREATE somente; banco preexistente faz o teste abortar, sem limpeza destrutiva.
await client.query(`CREATE DATABASE "${nome}"`)
await client.end()
const db = new pg.Client({ connectionString: url })
await db.connect()
let prisma, server
let verificacoes = 0
function verificar(atual, esperado) { assert.deepEqual(atual, esperado); verificacoes++ }
try {
  // Dados reais no schema anterior, antes das duas migrações novas.
  const migrations = (await readdir(new URL("prisma/migrations/", root))).filter(n => /^\d/.test(n)).sort()
  for (const migration of migrations.filter(n => n < "202611")) await db.query(await readFile(new URL(`prisma/migrations/${migration}/migration.sql`, root), "utf8"))
  await db.query(`INSERT INTO "Paroquia" ("nome","atualizadoEm") VALUES ('Legado', NOW()); INSERT INTO "Usuario" ("nome","email","senha","tipo","paroquiaId","atualizadoEm") VALUES ('Legado','legado@example.com','hash-antigo','ADMIN',1,NOW());`)
  for (const migration of migrations.filter(n => n >= "202611")) await db.query(await readFile(new URL(`prisma/migrations/${migration}/migration.sql`, root), "utf8"))
  verificar((await db.query('SELECT "paroquiaId", "versaoSessao" FROM "Usuario" WHERE id = 1')).rows[0], { paroquiaId: 1, versaoSessao: 0 })
  for (const [tipo, paroquia] of [["MEMBRO", null], ["ADMIN", null], ["SUPER_ADMIN", 1]]) {
    await assert.rejects(db.query(`INSERT INTO "Usuario" ("nome","email","senha","tipo","paroquiaId","atualizadoEm") VALUES ('Invalido','invalido@example.com','hash',$1,$2,NOW())`, [tipo, paroquia]), { code: "23514" }); verificacoes++
  }
  // migrate deploy de ponta a ponta em segundo banco vazio.
  const deployNome = `${nome}_deploy`
  await db.query(`CREATE DATABASE "${deployNome}"`)
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { cwd: root, env: { ...process.env, DATABASE_URL: new URL(`/${deployNome}`, url).href }, stdio: "pipe" })
  verificacoes++
  const bootstrapEnv = { ...process.env, DATABASE_URL: new URL(`/${deployNome}`, url).href, SUPERADMIN_NOME: "Bootstrap teste", SUPERADMIN_EMAIL: "bootstrap@example.com", SUPERADMIN_SENHA: "SenhaBootstrap12345" }
  execFileSync(process.execPath, ["scripts/criarSuperadmin.js"], { cwd: root, env: bootstrapEnv, stdio: "pipe" })
  await assert.rejects(async () => execFileSync(process.execPath, ["scripts/criarSuperadmin.js"], { cwd: root, env: bootstrapEnv, stdio: "pipe" }))
  verificacoes += 2
  prisma = (await import("../../src/lib/prisma.js")).default
  const app = (await import("../../src/app.js")).default
  server = app.listen(0, "127.0.0.1"); await once(server, "listening")
  const base = `http://127.0.0.1:${server.address().port}`
  const senha = "SenhaSegura12345"
  const hash = await bcrypt.hash(senha, 4)
  const global = await prisma.usuario.create({ data: { nome: "Global", email: "global@example.com", senha: hash, tipo: "SUPER_ADMIN" } })
  const p2 = await prisma.paroquia.create({ data: { nome: "Outra" } })
  const admin = await prisma.usuario.create({ data: { nome: "Admin", email: "admin@example.com", senha: hash, tipo: "ADMIN", paroquiaId: p2.id } })
  const membro = await prisma.usuario.create({ data: { nome: "Membro", email: "membro@example.com", senha: hash, paroquiaId: p2.id } })
  async function request(path, method = "GET", body, token) {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const data = await res.json()
    assert(!JSON.stringify(data).includes(hash)); assert(!Object.hasOwn(data, "senha"))
    return { status: res.status, data }
  }
  async function login(email, paroquiaId) { return request("/login", "POST", { email, senha, paroquiaId }) }
  const gt = (await login(global.email, null)).data.token
  verificar(typeof gt, "string")
  const at = (await login(admin.email, p2.id)).data.token
  const mt = (await login(membro.email, p2.id)).data.token
  verificar(typeof at, "string"); verificar(typeof mt, "string")
  verificar((await request("/superadmin/dashboard", "GET", null, gt)).status, 200)
  for (const token of [at, mt]) verificar((await request("/superadmin/dashboard", "GET", null, token)).status, 403)
  verificar((await request("/pastorais", "GET", null, gt)).status, 403)
  verificar((await request("/auth/sessao", "GET", null, gt)).data.paroquia, null)
  verificar((await request("/superadmin/dashboard", "GET", null, "invalido")).status, 401)
  verificar((await request("/superadmin/paroquias", "POST", {}, gt)).status, 400)
  verificar((await request("/superadmin/paroquias", "POST", { nome: "X", estado: "ZZ" }, gt)).status, 400)
  const p = (await request("/superadmin/paroquias", "POST", { nome: " Nova ", cidade: "Cidade", estado: "sp" }, gt)).data
  verificar(p.nome, "Nova"); verificar(p.estado, "SP")
  verificar((await request("/superadmin/paroquias", "POST", { nome: "nova", cidade: "cidade", estado: "SP" }, gt)).status, 409)
  verificar((await request(`/superadmin/paroquias/${p.id}`, "PUT", { nome: "Editada" }, gt)).status, 200)
  verificar((await request(`/superadmin/paroquias/${p.id}/admins`, "POST", { nome: "Novo", email: "novo@example.com", tipo: "SUPER_ADMIN" }, gt)).data.usuario.tipo, "ADMIN")
  verificar((await request(`/superadmin/paroquias/${p.id}/admins`, "POST", { nome: "Novo", email: "NOVO@example.com" }, gt)).status, 409)
  verificar((await request("/superadmin/paroquias/999999/admins", "POST", { nome: "Novo", email: "outro@example.com" }, gt)).status, 400)
  const novo = await prisma.usuario.findFirst({ where: { paroquiaId: p.id, tipo: "ADMIN" } })
  verificar((await request(`/superadmin/admins/${novo.id}/status`, "PATCH", { ativo: false }, gt)).status, 409)
  const convite = (await request(`/superadmin/admins/${novo.id}/convite`, "POST", {}, gt)).data.convite
  verificar((await prisma.conviteAdmin.findUnique({ where: { tokenHash: convite.token } })), null)
  verificar((await request("/auth/aceitar-convite", "POST", { token: convite.token, senha })).status, 200)
  verificar((await request("/auth/aceitar-convite", "POST", { token: convite.token, senha })).status, 400)
  const expirado = (await request(`/superadmin/admins/${novo.id}/convite`, "POST", {}, gt)).data.convite
  await prisma.conviteAdmin.updateMany({ where: { usuarioId: novo.id, consumidoEm: null }, data: { expiraEm: new Date(0) } })
  verificar((await request("/auth/aceitar-convite", "POST", { token: expirado.token, senha })).status, 400)
  verificar((await request(`/usuarios/${novo.id}`, "PATCH", { nome: "Ataque" }, at)).status, 404)
  const pastoral1 = await prisma.pastoral.create({ data: { nome: "Pastoral A", paroquiaId: p2.id } })
  const pastoral2 = await prisma.pastoral.create({ data: { nome: "Pastoral B", paroquiaId: p2.id } })
  await prisma.membroPastoral.create({ data: { usuarioId: membro.id, pastoralId: pastoral1.id, papel: "COORDENADOR" } })
  verificar((await request(`/pastorais/${pastoral1.id}`, "PATCH", { nome: "Autorizada" }, mt)).status, 200)
  verificar((await request(`/pastorais/${pastoral2.id}`, "PATCH", { nome: "Negada" }, mt)).status, 403)
  verificar((await request("/superadmin/dashboard", "GET", null, mt)).status, 403)
  await prisma.membroPastoral.create({ data: { usuarioId: membro.id, pastoralId: pastoral2.id, papel: "COORDENADOR" } })
  verificar((await request(`/pastorais/${pastoral2.id}`, "PATCH", { nome: "Também autorizada" }, mt)).status, 200)
  verificar((await request(`/superadmin/paroquias/${p2.id}/status`, "PATCH", { ativa: false }, gt)).status, 200)
  verificar((await request("/auth/sessao", "GET", null, at)).status, 401)
  verificar((await login(admin.email, p2.id)).status, 401)
  verificar(await prisma.pastoral.count({ where: { paroquiaId: p2.id } }), 2)
  verificar((await request(`/superadmin/paroquias/${p2.id}/admins`, "POST", { nome: "Outro", email: "outro@example.com" }, gt)).status, 400)
  verificar((await request(`/superadmin/paroquias/${p2.id}/status`, "PATCH", { ativa: true }, gt)).status, 200)
  verificar((await request("/auth/sessao", "GET", null, at)).status, 401)
  verificar((await login(admin.email, p2.id)).status, 200)
  await prisma.usuario.update({ where: { id: membro.id }, data: { ativo: false } })
  verificar((await login(membro.email, p2.id)).status, 401)
  const segundo = (await request(`/superadmin/paroquias/${p.id}/admins`, "POST", { nome: "Sucessor", email: "sucessor@example.com" }, gt)).data
  verificar((await request(`/superadmin/admins/${novo.id}/transferir`, "POST", { sucessorId: segundo.usuario.id }, gt)).status, 409)
  verificar((await request("/auth/aceitar-convite", "POST", { token: segundo.convite.token, senha })).status, 200)
  verificar((await request(`/superadmin/admins/${novo.id}`, "PUT", { nome: "Editado", email: "novo@example.com", tipo: "SUPER_ADMIN", paroquiaId: p2.id }, gt)).status, 200)
  verificar((await prisma.usuario.findUnique({ where: { id: novo.id } })).tipo, "ADMIN")
  verificar((await prisma.usuario.findUnique({ where: { id: novo.id } })).paroquiaId, p.id)
  verificar((await request(`/superadmin/admins/${novo.id}/transferir`, "POST", { sucessorId: admin.id }, gt)).status, 409)
  verificar((await request(`/superadmin/admins/${novo.id}/transferir`, "POST", { sucessorId: segundo.usuario.id }, gt)).status, 200)
  verificar((await prisma.usuario.findUnique({ where: { id: novo.id } })).tipo, "MEMBRO")
  verificar((await request(`/superadmin/admins/${segundo.usuario.id}/status`, "PATCH", { ativo: false }, gt)).status, 409)
  // Falha de auditoria faz rollback da alteração administrativa, no banco real.
  const nomeAntes = (await prisma.paroquia.findUnique({ where: { id: p.id } })).nome
  await db.query(`CREATE FUNCTION rejeitar_auditoria() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha simulada de auditoria'; END; $$; CREATE TRIGGER falha_auditoria BEFORE INSERT ON "AuditoriaAdmin" FOR EACH ROW EXECUTE FUNCTION rejeitar_auditoria();`)
  verificar((await request(`/superadmin/paroquias/${p.id}`, "PUT", { nome: "Não persistir" }, gt)).status, 500)
  await db.query('DROP TRIGGER falha_auditoria ON "AuditoriaAdmin"; DROP FUNCTION rejeitar_auditoria();')
  verificar((await prisma.paroquia.findUnique({ where: { id: p.id } })).nome, nomeAntes)
  const antes = await prisma.paroquia.count()
  await assert.rejects(prisma.$transaction(async tx => { await tx.paroquia.create({ data: { nome: "Rollback" } }); throw new Error("rollback") }))
  verificar(await prisma.paroquia.count(), antes)
  assert(await prisma.auditoriaAdmin.count() > 5)
  console.log(`Integração PostgreSQL: ${verificacoes} verificações aprovadas; migrações novas preservam dados e migrate deploy completo aprovado.`)
} finally {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
  if (prisma) await prisma.$disconnect()
  await db.end()
}
