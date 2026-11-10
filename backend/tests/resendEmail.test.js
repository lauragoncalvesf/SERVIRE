import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { beforeEach, afterEach, mock, test } from "node:test"

let resposta
const construir = mock.fn()
const enviar = mock.fn(async () => resposta)
// O SDK inteiro é simulado: nenhum teste deste arquivo consegue abrir HTTPS real.
mock.module("resend", { namedExports: { Resend: class {
  constructor(chave, options) {
    construir(chave, options)
    this.debug = true
    this.emails = { send: (...args) => { assert.equal(this.debug, false); return enviar(...args) } }
  }
} } })
const { criarServicoResend } = await import("../src/services/resendEmailService.js")
const { entregarConvite, modeloConvite } = await import("../src/services/conviteEmailService.js")
const chaveFixture = "re_chave_ficticia_apenas_teste"
const token = "c".repeat(64)
const idempotencyKey = `convite-admin/${createHash("sha256").update(token).digest("hex")}`
const mensagem = { para: "pessoa@example.com", assunto: "Convite", html: "<p>Privado</p>", texto: "Privado", idempotencyKey }
const dados = { usuario: { nome: "Maria", email: mensagem.para }, paroquia: "São José", convite: { token, expiraEm: new Date(Date.now() + 48 * 3600000) } }
let anteriores
beforeEach(() => {
  anteriores = Object.fromEntries(["RESEND_API_KEY", "NODE_ENV", "RESEND_DEBUG", "RESEND_BASE_URL", "FRONTEND_URL"].map(c => [c, process.env[c]]))
  process.env.RESEND_API_KEY = chaveFixture; process.env.NODE_ENV = "production"
  delete process.env.FRONTEND_URL
  resposta = { data: { id: "email-simulado" }, error: null }
  construir.mock.resetCalls(); enviar.mock.resetCalls()
  enviar.mock.mockImplementation(async () => resposta)
})
afterEach(() => { for (const [campo, valor] of Object.entries(anteriores)) { if (valor === undefined) delete process.env[campo]; else process.env[campo] = valor } })
function logsSeguros(t) {
  const logs = []
  for (const metodo of ["warn", "error", "log", "info", "debug"]) {
    const spy = mock.method(console, metodo, (...args) => logs.push(args))
    t.after(() => spy.mock.restore())
  }
  return logs
}

test("SDK recebe chave exclusivamente de process.env e envia por HTTPS com timeout e remetente correto", async () => {
  const resultado = await criarServicoResend({ env: { NODE_ENV: "production", RESEND_API_KEY: "nao-usar-esta-chave" } }).enviar(mensagem)
  assert.deepEqual(resultado, { status: "enviado" })
  assert.deepEqual(construir.mock.calls[0].arguments, [chaveFixture, { baseUrl: "https://api.resend.com" }])
  const [payload, options] = enviar.mock.calls[0].arguments
  assert.deepEqual(payload, { from: "SERVIRE <convites@send.servirepastoral.com.br>", to: [mensagem.para], subject: mensagem.assunto, html: mensagem.html, text: mensagem.texto })
  assert.equal(options.idempotencyKey, idempotencyKey)
  assert(options.signal instanceof AbortSignal)
  assert(!JSON.stringify(resultado).includes(chaveFixture))
})
test("chave ausente ou inválida não inicializa o SDK", async () => {
  delete process.env.RESEND_API_KEY
  assert.deepEqual(await criarServicoResend().enviar(mensagem), { status: "nao_configurado", motivo: "RESEND_AUSENTE" })
  process.env.RESEND_API_KEY = "chave inválida\nprivada"
  assert.deepEqual(await criarServicoResend().enviar(mensagem), { status: "nao_enviado", motivo: "RESEND_INVALIDO" })
  assert.equal(construir.mock.callCount(), 0)
})
test("NODE_ENV=test bloqueia o SDK mesmo com chave configurada", async () => {
  process.env.NODE_ENV = "test"
  assert.equal((await criarServicoResend().enviar(mensagem)).motivo, "AMBIENTE_TESTE")
  assert.equal(construir.mock.callCount(), 0)
})
test("falha do provedor preserva resposta segura e só registra status e códigos controlados", async t => {
  const logs = logsSeguros(t)
  const privado = `${chaveFixture} ${token} ${mensagem.para} JWT-privado https://servirepastoral.com.br/aceitar-convite#token=${token}`
  resposta = { data: null, error: { name: privado, message: privado, statusCode: 403, headers: { Authorization: chaveFixture }, payload: privado } }
  assert.deepEqual(await criarServicoResend().enviar(mensagem), { status: "nao_enviado", motivo: "FALHA_RESEND" })
  assert.deepEqual(logs, [[JSON.stringify({ evento: "resend_falha", codigo: "AUTORIZACAO", statusHttp: 403 })]])
  for (const valor of [chaveFixture, token, mensagem.para, "JWT-privado", "https://"]) assert(!JSON.stringify(logs).includes(valor))
  assert.equal(enviar.mock.callCount(), 1)
})
test("exceção de rede é sanitizada, sem retry ou fallback SMTP", async t => {
  const logs = logsSeguros(t)
  enviar.mock.mockImplementation(async () => { throw new Error(`${chaveFixture} ${token}`) })
  assert.equal((await criarServicoResend().enviar(mensagem)).motivo, "FALHA_RESEND")
  assert.equal(enviar.mock.callCount(), 1)
  assert.deepEqual(JSON.parse(logs[0][0]), { evento: "resend_falha", codigo: "REDE_OU_RESPOSTA_INVALIDA" })
})
test("timeout usa AbortSignal de 15 segundos e mantém falha recuperável", async t => {
  const logs = logsSeguros(t)
  const timeout = mock.method(AbortSignal, "timeout", () => AbortSignal.abort())
  t.after(() => timeout.mock.restore())
  resposta = { data: null, error: { statusCode: null } }
  assert.equal((await criarServicoResend().enviar(mensagem)).status, "nao_enviado")
  assert.equal(timeout.mock.calls[0].arguments[0], 15000)
  assert.equal(JSON.parse(logs[0][0]).codigo, "TIMEOUT")
})
test("resposta sem ID confirmado nunca é tratada como enviada", async t => {
  logsSeguros(t)
  for (const r of [undefined, {}, { data: { id: "" } }, { data: { id: "email" }, error: { statusCode: 500 } }]) {
    resposta = r
    assert.equal((await criarServicoResend().enviar(mensagem)).status, "nao_enviado")
  }
})
test("deduplica chamadas simultâneas e libera o registro em memória após concluir", async () => {
  let liberar
  enviar.mock.mockImplementation(() => new Promise(resolve => { liberar = resolve }))
  const servico = criarServicoResend()
  const a = servico.enviar(mensagem)
  const b = servico.enviar(mensagem)
  await Promise.resolve()
  assert.equal(enviar.mock.callCount(), 1)
  liberar(resposta)
  assert.deepEqual(await Promise.all([a, b]), [{ status: "enviado" }, { status: "enviado" }])
  enviar.mock.mockImplementation(async () => resposta)
  await servico.enviar(mensagem)
  assert.equal(enviar.mock.callCount(), 2)
  // Tentativas posteriores reutilizam a mesma chave no provedor (janela de 24h).
  assert.equal(enviar.mock.calls[1].arguments[1].idempotencyKey, idempotencyKey)
})
test("convites novos usam chaves diferentes e não reutilizam o token em texto puro", async () => {
  const email = { enviar: mock.fn(async () => ({ status: "enviado" })) }
  for (const valor of [token, "d".repeat(64), token]) await entregarConvite({ ...dados, convite: { ...dados.convite, token: valor } }, { env: {}, email })
  const chaves = email.enviar.mock.calls.map(c => c.arguments[0].idempotencyKey)
  assert.equal(chaves[0], chaves[2]); assert.notEqual(chaves[0], chaves[1])
  assert(!chaves[0].includes(token))
})
test("fluxo completo usa domínio oficial por padrão, respeita FRONTEND_URL e oculta token no sucesso", async () => {
  const resultado = await entregarConvite(dados)
  assert.equal(resultado.envio.status, "enviado"); assert.equal(resultado.convite.token, undefined)
  const payload = enviar.mock.calls[0].arguments[0]
  assert(payload.html.includes(`https://servirepastoral.com.br/aceitar-convite#token=${token}`))
  assert(payload.text.includes("48 horas")); assert(payload.html.includes("Maria")); assert(payload.html.includes("São José"))
  const enviarCustom = mock.fn(async () => ({ status: "enviado" }))
  await entregarConvite(dados, { env: { FRONTEND_URL: "https://teste.example.com" }, email: { enviar: enviarCustom } })
  assert(enviarCustom.mock.calls[0].arguments[0].texto.includes("https://teste.example.com/aceitar-convite"))
})
test("falha Resend e ausência de chave preservam token, link manual e validade", async t => {
  logsSeguros(t)
  resposta = { data: null, error: { statusCode: 429 } }
  const falha = await entregarConvite(dados)
  assert.equal(falha.envio.motivo, "FALHA_RESEND")
  delete process.env.RESEND_API_KEY
  const ausente = await entregarConvite(dados)
  assert.equal(ausente.envio.status, "nao_configurado")
  for (const resultado of [falha, ausente]) {
    assert.equal(resultado.convite.token, token)
    assert.equal(resultado.convite.expiraEm, dados.convite.expiraEm)
    assert.equal(resultado.convite.link, `https://servirepastoral.com.br/aceitar-convite#token=${token}`)
  }
})
test("modelo escapa HTML e saúda sem nome quando indisponível", () => {
  const modelo = modeloConvite({ paroquia: "Paróquia <script>", link: "https://servirepastoral.com.br" })
  assert(modelo.html.includes("Olá!")); assert(!modelo.html.includes("undefined")); assert(modelo.html.includes("&lt;script&gt;"))
})
test("debug do SDK e URL externa do ambiente não conseguem expor dados ou redirecionar a chave", async t => {
  const logs = logsSeguros(t)
  process.env.RESEND_DEBUG = "true"; process.env.RESEND_BASE_URL = "https://nao-usar.example.com"
  await criarServicoResend().enviar(mensagem)
  assert.equal(construir.mock.calls[0].arguments[1].baseUrl, "https://api.resend.com")
  assert.equal(logs.length, 0)
})

// A separação por finalidade impede colisões com os convites administrativos.
test("Resend aceita as três finalidades e rejeita prefixos arbitrários sem envio", async () => {
  for (const prefixo of ["convite-admin", "confirmacao-email", "recuperacao-senha"]) {
    const chave = `${prefixo}/${"a".repeat(64)}`
    assert.equal((await criarServicoResend().enviar({ ...mensagem, idempotencyKey: chave })).status, "enviado")
    assert.equal(enviar.mock.calls.at(-1).arguments[1].idempotencyKey, chave)
  }
  assert.equal((await criarServicoResend().enviar({ ...mensagem, idempotencyKey: `outro/${"a".repeat(64)}` })).motivo, "IDEMPOTENCIA_INVALIDA")
  assert.equal(enviar.mock.callCount(), 3)
})
