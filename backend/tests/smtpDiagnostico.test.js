import assert from "node:assert/strict"
import { mock, test } from "node:test"
mock.module("nodemailer", { defaultExport: { createTransport() { throw new Error("Rede proibida nos testes") } } })
const { diagnosticarErroSmtp, criarServicoEmail } = await import("../src/services/emailService.js")
const { entregarConvite } = await import("../src/services/conviteEmailService.js")

for (const [nome, erro, esperado] of [
  ["conexão recusada encapsulada", { code: "ESOCKET", originalCode: "ECONNREFUSED", command: "CONN" }, { categoria: "CONEXAO", codigo: "ECONNREFUSED", etapa: "CONN" }],
  ["rede indisponível", { code: "ENETUNREACH" }, { categoria: "CONEXAO", codigo: "ENETUNREACH", etapa: "DESCONHECIDA" }],
  ["timeout de conexão", { code: "ETIMEDOUT", timeoutType: "CONNECT_TIMEOUT", command: "CONN" }, { categoria: "TIMEOUT", codigo: "ETIMEDOUT", etapa: "CONN", tipoTimeout: "CONNECT_TIMEOUT" }],
  ["timeout de socket", { code: "ESOCKET", cause: { code: "ETIMEDOUT", timeoutType: "SOCKET_TIMEOUT" } }, { categoria: "TIMEOUT", codigo: "ETIMEDOUT", etapa: "DESCONHECIDA", tipoTimeout: "SOCKET_TIMEOUT" }],
  ["DNS temporário", { code: "EDNS", originalCode: "EAI_AGAIN" }, { categoria: "DNS", codigo: "EAI_AGAIN", etapa: "DESCONHECIDA" }],
  ["DNS inexistente", { code: "ESOCKET", cause: { code: "ENOTFOUND" } }, { categoria: "DNS", codigo: "ENOTFOUND", etapa: "DESCONHECIDA" }],
  ["TLS certificado", { code: "ESOCKET", originalCode: "CERT_HAS_EXPIRED", command: "CONN" }, { categoria: "TLS", codigo: "CERT_HAS_EXPIRED", etapa: "CONN" }],
  ["TLS upgrade", { code: "ETLS", command: "STARTTLS" }, { categoria: "TLS", codigo: "ETLS", etapa: "STARTTLS" }],
  ["autenticação Gmail", { code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 }, { categoria: "AUTENTICACAO", codigo: "EAUTH", etapa: "AUTH", respostaSmtp: 535 }],
  ["destinatário recusado", { code: "EENVELOPE", command: "RCPT TO", responseCode: 550 }, { categoria: "DESTINATARIO", codigo: "DESTINATARIO_RECUSADO", etapa: "RCPT TO", respostaSmtp: 550 }],
  ["rede cai durante RCPT", { code: "ESOCKET", originalCode: "ECONNRESET", command: "RCPT TO" }, { categoria: "CONEXAO", codigo: "ECONNRESET", etapa: "RCPT TO" }],
  ["rede cai durante AUTH", { code: "ECONNRESET", command: "AUTH LOGIN" }, { categoria: "CONEXAO", codigo: "ECONNRESET", etapa: "AUTH" }],
  ["falha desconhecida", new Error("mensagem privada"), { categoria: "DESCONHECIDO", codigo: "NAO_CLASSIFICADO", etapa: "DESCONHECIDA" }],
  ["erro nulo", null, { categoria: "DESCONHECIDO", codigo: "NAO_CLASSIFICADO", etapa: "DESCONHECIDA" }]
]) test(`diagnóstico SMTP: ${nome}`, () => assert.deepEqual(diagnosticarErroSmtp(erro), esperado))

const env = { SMTP_HOST: "smtp.example.com", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_USER: "fixture@example.com", SMTP_PASS: "senha-privada", EMAIL_FROM: "fixture@example.com", FRONTEND_URL: "https://servire.example.com" }
const token = "b".repeat(64)
const segredo = "senha-privada JWT-privado https://servire.example.com/aceitar-convite#token=" + token + " destinatario@example.com conteudo-privado"
const mensagem = { para: "destinatario@example.com", assunto: "Privado", html: segredo, texto: segredo }
function capturarLogs(t) {
  const logs = []
  for (const metodo of ["log", "warn", "error", "info", "debug"]) {
    const spy = mock.method(console, metodo, (...args) => logs.push(args))
    t.after(() => spy.mock.restore())
  }
  return logs
}

test("logs só contêm valores permitidos mesmo com segredos em todos os campos livres", async t => {
  const logs = capturarLogs(t)
  const erro = Object.assign(new Error(segredo), { code: "EAUTH", command: "AUTH LOGIN", responseCode: 535, response: segredo, stack: segredo, auth: segredo, envelope: segredo, rejected: [segredo], token, cause: { code: segredo }, originalCode: segredo, timeoutType: segredo })
  const sendMail = mock.fn(async () => { throw erro })
  const servico = criarServicoEmail({ env, criarTransporte: () => ({ sendMail, close() {} }) })
  assert.deepEqual(await servico.enviar(mensagem), { status: "nao_enviado", motivo: "FALHA_SMTP" })
  assert.deepEqual(logs, [[JSON.stringify({ evento: "smtp_falha", categoria: "AUTENTICACAO", codigo: "EAUTH", etapa: "AUTH", respostaSmtp: 535 })]])
  for (const privado of [env.SMTP_USER, env.SMTP_PASS, token, mensagem.para, "JWT-privado", "https://", "conteudo-privado"]) assert(!JSON.stringify(logs).includes(privado))
  assert.equal(sendMail.mock.callCount(), 1)
})
test("campos técnicos desconhecidos não são copiados nem interpolados", () => {
  assert.deepEqual(diagnosticarErroSmtp({ code: segredo, originalCode: segredo, command: segredo, responseCode: "535 " + segredo, timeoutType: segredo }), { categoria: "DESCONHECIDO", codigo: "NAO_CLASSIFICADO", etapa: "DESCONHECIDA" })
  assert.equal(diagnosticarErroSmtp({ code: "ERR_SSL_" + segredo }).codigo, "TLS_OUTRO")
  for (const responseCode of [NaN, 399, 600, 550.5, "550", {}]) assert.equal(diagnosticarErroSmtp({ responseCode }).respostaSmtp, undefined)
})
test("recusa no resultado sendMail gera diagnóstico sem registrar destinatários", async t => {
  const logs = capturarLogs(t)
  const servico = criarServicoEmail({ env, criarTransporte: () => ({ sendMail: async () => ({ accepted: [], rejected: [mensagem.para], response: segredo }) }) })
  assert.deepEqual(await servico.enviar(mensagem), { status: "nao_enviado", motivo: "SMTP_NAO_CONFIRMADO" })
  assert.deepEqual(JSON.parse(logs[0][0]), { evento: "smtp_falha", categoria: "DESTINATARIO", codigo: "DESTINATARIO_RECUSADO", etapa: "RCPT TO" })
})
test("diagnóstico mantém entrega manual e expiração do convite após falha", async t => {
  const logs = capturarLogs(t)
  const email = criarServicoEmail({ env, criarTransporte: () => ({ sendMail: async () => { throw { code: "ETIMEDOUT", command: "CONN" } } }) })
  const expiraEm = new Date(Date.now() + 48 * 3600000)
  const resultado = await entregarConvite({ usuario: { nome: "Teste", email: mensagem.para }, paroquia: "Teste", convite: { token, expiraEm } }, { env, email })
  assert.deepEqual(resultado.envio, { status: "nao_enviado", motivo: "FALHA_SMTP" })
  assert.equal(resultado.convite.token, token)
  assert.equal(resultado.convite.expiraEm, expiraEm)
  assert.equal(resultado.convite.link, `${env.FRONTEND_URL}/aceitar-convite#token=${token}`)
  assert.equal(JSON.parse(logs[0][0]).categoria, "TIMEOUT")
  assert(!JSON.stringify(logs).includes(token))
})
test("sucesso e ambiente de teste não geram diagnóstico de falha nem acessam SMTP real", async t => {
  const logs = capturarLogs(t)
  const criarTransporte = mock.fn(() => ({ sendMail: async () => ({ accepted: [mensagem.para] }) }))
  assert.deepEqual(await criarServicoEmail({ env, criarTransporte }).enviar(mensagem), { status: "enviado" })
  assert.equal((await criarServicoEmail({ env: { ...env, NODE_ENV: "test" }, criarTransporte }).enviar(mensagem)).motivo, "AMBIENTE_TESTE")
  assert.equal(criarTransporte.mock.callCount(), 1)
  assert.equal(logs.length, 0)
})
