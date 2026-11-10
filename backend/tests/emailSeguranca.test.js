import assert from "node:assert/strict"
import { mock, test } from "node:test"
const enviar = mock.fn(async () => ({ status: "enviado" }))
mock.module("../src/services/resendEmailService.js", { namedExports: { criarServicoResend: () => ({ enviar }) } })
const { enviarEmailSeguranca } = await import("../src/services/emailSegurancaService.js")
const usuario = { id: 1, nome: '<script>Maria & "João"</script>', email: "fixture@example.com", paroquia: { nome: "Paróquia <img src=x>" } }
const token = "f".repeat(64)
const tokenHash = "a".repeat(64)
test("confirmação e recuperação usam template seguro, prazo, URL e idempotência separados", async t => {
  const original = process.env.FRONTEND_URL
  process.env.FRONTEND_URL = "https://servirepastoral.com.br"
  t.after(() => { if (original === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = original })
  for (const [finalidade, caminho, prefixo] of [["CONFIRMAR_EMAIL", "confirmar-email", "confirmacao-email"], ["RECUPERAR_SENHA", "redefinir-senha", "recuperacao-senha"]]) {
    assert.equal((await enviarEmailSeguranca({ usuario, token, tokenHash, finalidade })).status, "enviado")
    const payload = enviar.mock.calls.at(-1).arguments[0]
    assert(payload.html.includes("30 minutos")); assert(payload.texto.includes("uma única vez"))
    assert(payload.html.includes(`https://servirepastoral.com.br/${caminho}#token=${token}`))
    assert(!payload.html.includes("<script>")); assert(!payload.html.includes("<img src=x>")); assert(payload.html.includes("&lt;script&gt;"))
    assert.equal(payload.idempotencyKey, `${prefixo}/${tokenHash}`)
    assert.equal(payload.para, usuario.email)
  }
})
test("URL inválida não envia nem expõe o link", async t => {
  const original = process.env.FRONTEND_URL
  process.env.FRONTEND_URL = "http://localhost:5173"
  t.after(() => { if (original === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = original })
  enviar.mock.resetCalls()
  const resultado = await enviarEmailSeguranca({ usuario, token, tokenHash, finalidade: "RECUPERAR_SENHA" })
  assert.equal(resultado.motivo, "FRONTEND_URL_INVALIDA"); assert(!JSON.stringify(resultado).includes(token))
  assert.equal(enviar.mock.callCount(), 0)
})
