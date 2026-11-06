import assert from "node:assert/strict"
import { mock, test } from "node:test"

// Qualquer uso acidental do transporte padrão falha sem abrir rede.
const transportePadrao = mock.fn(() => { throw new Error("Transporte real proibido nos testes") })
mock.module("nodemailer", { defaultExport: { createTransport: transportePadrao } })
const { criarServicoEmail, lerConfiguracaoEmail } = await import("../src/services/emailService.js")
const { criarLinkConvite, modeloConvite, entregarConvite } = await import("../src/services/conviteEmailService.js")
const env = { SMTP_HOST: "smtp.example.com", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_USER: "fixture@example.com", SMTP_PASS: "senha-ficticia-exclusiva-do-teste", EMAIL_FROM: "fixture@example.com", FRONTEND_URL: "https://servire.example.com" }
const token = "a".repeat(64)
const convite = { token, expiraEm: new Date(Date.now() + 48 * 3600000) }
const dados = { usuario: { nome: "Maria", email: "maria@example.com" }, paroquia: "São José", convite }
const mensagem = { para: dados.usuario.email, assunto: "Convite", html: "<p>Convite</p>", texto: "Convite" }

test("configuração ausente não cria transporte", async () => {
  const criarTransporte = mock.fn()
  for (const campo of Object.keys(env).filter(c => c !== "FRONTEND_URL")) {
    const incompleto = { ...env }; delete incompleto[campo]
    assert.equal((await criarServicoEmail({ env: incompleto, criarTransporte }).enviar(mensagem)).status, "nao_configurado")
  }
  assert.equal(criarTransporte.mock.callCount(), 0)
})
test("configurações inválidas são rejeitadas antes de abrir rede", () => {
  for (const valores of [{ SMTP_PORT: "abc" }, { SMTP_PORT: "0" }, { SMTP_PORT: "65536" }, { SMTP_PORT: "465x" }, { SMTP_SECURE: "yes" }, { SMTP_SECURE: "false" }, { SMTP_PORT: "587" }, { SMTP_HOST: "host\r\nheader" }, { EMAIL_FROM: "sem-email" }, { EMAIL_FROM: "a@example.com\r\nBcc: b@example.com" }, { SMTP_USER: "a\r\nb" }]) {
    assert.deepEqual(lerConfiguracaoEmail({ ...env, ...valores }), { status: "nao_enviado", motivo: "SMTP_INVALIDO" })
  }
})
test("TLS validado, timeouts, remetente e variantes HTML/texto no envio confirmado", async () => {
  for (const valores of [{}, { SMTP_PORT: "587", SMTP_SECURE: "false" }]) {
    const sendMail = mock.fn(async () => ({ accepted: [mensagem.para], rejected: [] }))
    const close = mock.fn()
    const criarTransporte = mock.fn(() => ({ sendMail, close }))
    const servico = criarServicoEmail({ env: { ...env, ...valores }, criarTransporte })
    assert.deepEqual(await servico.enviar(mensagem), { status: "enviado" })
    const config = criarTransporte.mock.calls[0].arguments[0]
    assert.equal(config.tls.rejectUnauthorized, true)
    assert.equal(config.tls.minVersion, "TLSv1.2")
    assert.equal(config.requireTLS, config.port === 587)
    assert.equal(config.connectionTimeout, 10000)
    assert.equal(config.greetingTimeout, 10000)
    assert.equal(config.socketTimeout, 15000)
    assert.equal(config.logger, false); assert.equal(config.debug, false)
    const mail = sendMail.mock.calls[0].arguments[0]
    assert.deepEqual(mail.from, { name: "SERVIRE — Sistema de Gestão Pastoral", address: env.EMAIL_FROM })
    assert.equal(mail.html, mensagem.html); assert.equal(mail.text, mensagem.texto)
    assert.equal(close.mock.callCount(), 1)
  }
})
test("falha ou recusa SMTP não registra segredos e não tenta enviar novamente", async t => {
  const logs = [mock.method(console, "log", () => {}), mock.method(console, "warn", () => {}), mock.method(console, "error", () => {}), mock.method(console, "debug", () => {})]
  t.after(() => logs.forEach(log => log.mock.restore()))
  const sendMail = mock.fn(async () => { throw new Error(`${env.SMTP_PASS} ${token}`) })
  const servico = criarServicoEmail({ env, criarTransporte: () => ({ sendMail, close() {} }) })
  const resultado = await servico.enviar(mensagem)
  assert.deepEqual(resultado, { status: "nao_enviado", motivo: "FALHA_SMTP" })
  assert.equal(sendMail.mock.callCount(), 1)
  assert(!JSON.stringify(resultado).includes(env.SMTP_PASS)); assert(!JSON.stringify(resultado).includes(token))
  for (const log of logs.filter(log => log !== console.warn)) assert.equal(log.mock.callCount(), 0)
  assert.deepEqual(JSON.parse(console.warn.mock.calls[0].arguments[0]), {
    evento: "smtp_falha", categoria: "DESCONHECIDO", codigo: "NAO_CLASSIFICADO", etapa: "DESCONHECIDA"
  })
  for (const resposta of [{ accepted: [], rejected: [mensagem.para] }, {}, { accepted: [mensagem.para], pending: [mensagem.para] }]) {
    const s = criarServicoEmail({ env, criarTransporte: () => ({ sendMail: async () => resposta }) })
    assert.equal((await s.enviar(mensagem)).status, "nao_enviado")
  }
})
test("NODE_ENV=test bloqueia SMTP mesmo com credenciais completas", async () => {
  const criarTransporte = mock.fn()
  const servico = criarServicoEmail({ env: { ...env, NODE_ENV: "test" }, criarTransporte })
  assert.deepEqual(await servico.enviar(mensagem), { status: "nao_configurado", motivo: "AMBIENTE_TESTE" })
  assert.equal(criarTransporte.mock.callCount(), 0)
})
test("link usa apenas a origem pública configurada, com token no fragmento", () => {
  assert.equal(criarLinkConvite(env.FRONTEND_URL, token), `https://servire.example.com/aceitar-convite#token=${token}`)
  assert.equal(criarLinkConvite(env.FRONTEND_URL + "/", token), criarLinkConvite(env.FRONTEND_URL, token))
  for (const origem of [undefined, "", "invalida", "http://servire.example.com", "https://localhost", "https://127.0.0.1", "https://192.168.1.2", "https://10.0.0.1", "https://172.16.0.1", "https://[::1]", "https://servire.example.com/path", "https://user:pass@servire.example.com", "https://servire.example.com?url=x", "https://servire.example.com#x"]) assert.equal(criarLinkConvite(origem, token), null)
  assert.equal(criarLinkConvite(env.FRONTEND_URL, "invalido"), null)
})
test("modelo responsivo escapa dados dinâmicos e inclui paróquia, prazo e texto", () => {
  const modelo = modeloConvite({ nome: '<script>"Maria" & João</script>', paroquia: "São José <img src=x onerror=alert(1)>", link: `https://servire.example.com/aceitar-convite#token=${token}` })
  assert(!modelo.html.includes("<script>")); assert(!modelo.html.includes("<img src=x"))
  assert(modelo.html.includes("&lt;script&gt;&quot;Maria&quot; &amp; João"))
  assert(modelo.html.includes("viewport")); assert(modelo.html.includes("max-width:600px"))
  assert(modelo.html.includes("Aceitar convite e definir senha")); assert(modelo.html.includes("48 horas"))
  assert(modelo.texto.includes(token)); assert(modelo.texto.includes("São José"))
})
test("entrega confirmada omite token e link da resposta administrativa", async () => {
  const enviar = mock.fn(async () => ({ status: "enviado" }))
  const resultado = await entregarConvite(dados, { env, email: { enviar } })
  assert.deepEqual(resultado, { envio: { status: "enviado" }, convite: { expiraEm: convite.expiraEm } })
  assert(!JSON.stringify(resultado).includes(token))
  assert.equal(enviar.mock.calls[0].arguments[0].para, dados.usuario.email)
  assert(enviar.mock.calls[0].arguments[0].html.includes("São José"))
})
test("falha ou ausência SMTP preserva convite e permite recuperar o link uma vez na resposta", async () => {
  for (const status of ["nao_enviado", "nao_configurado"]) {
    const resultado = await entregarConvite(dados, { env, email: { enviar: async () => ({ status }) } })
    assert.equal(resultado.envio.status, status)
    assert.equal(resultado.convite.token, token)
    assert.equal(resultado.convite.expiraEm, convite.expiraEm)
    assert.equal(resultado.convite.link, criarLinkConvite(env.FRONTEND_URL, token))
  }
})
test("URL ausente ou inválida impede envio e preserva alternativa manual", async () => {
  const enviar = mock.fn()
  const resultado = await entregarConvite(dados, { env: { ...env, FRONTEND_URL: "http://localhost:5173" }, email: { enviar } })
  assert.equal(resultado.envio.motivo, "FRONTEND_URL_INVALIDA")
  assert.equal(resultado.convite.token, token)
  assert.equal(resultado.convite.link, undefined)
  assert.equal(enviar.mock.callCount(), 0)
})
