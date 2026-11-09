import { Resend } from "resend"

const REMETENTE = "SERVIRE <convites@send.servirepastoral.com.br>"
const emailValido = valor => typeof valor === "string" && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(valor)

function registrarFalha(erro, timeout = false) {
  // Nunca registrar error.message, headers, payload ou o objeto do SDK.
  const status = Number.isInteger(erro?.statusCode) && erro.statusCode >= 400 && erro.statusCode <= 599 ? erro.statusCode : null
  const codigo = timeout ? "TIMEOUT"
    : status === 401 || status === 403 ? "AUTORIZACAO"
    : status === 429 ? "LIMITE"
    : status === 409 ? "IDEMPOTENCIA"
    : status >= 500 ? "PROVEDOR"
    : status ? "REQUISICAO_RECUSADA" : "REDE_OU_RESPOSTA_INVALIDA"
  console.warn(JSON.stringify({ evento: "resend_falha", codigo, ...(status ? { statusHttp: status } : {}) }))
}

function clientePadrao(chave) {
  const cliente = new Resend(chave, { baseUrl: "https://api.resend.com" })
  // SDK 6.x lê RESEND_DEBUG do ambiente e pode imprimir erros livres do provedor.
  // Desativar explicitamente, independentemente da configuração externa.
  cliente.debug = false
  return cliente
}

export function criarServicoResend({ env = process.env, criarCliente = clientePadrao } = {}) {
  // Somente tentativas em andamento. Não mantém tokens, payloads ou histórico em cache.
  const emAndamento = new Map()
  return {
    async enviar({ para, assunto, html, texto, idempotencyKey }) {
      const chave = process.env.RESEND_API_KEY?.trim()
      if (!chave) return { status: "nao_configurado", motivo: "RESEND_AUSENTE" }
      if (!/^re_[A-Za-z0-9_-]+$/.test(chave)) return { status: "nao_enviado", motivo: "RESEND_INVALIDO" }
      // Mesmo uma chave real no .env não permite envio pela suíte de integração.
      if (env.NODE_ENV === "test") return { status: "nao_configurado", motivo: "AMBIENTE_TESTE" }
      if (!emailValido(para)) return { status: "nao_enviado", motivo: "DESTINATARIO_INVALIDO" }
      if (typeof idempotencyKey !== "string" || !/^convite-admin\/[a-f0-9]{64}$/.test(idempotencyKey)) {
        return { status: "nao_enviado", motivo: "IDEMPOTENCIA_INVALIDA" }
      }
      if (emAndamento.has(idempotencyKey)) return emAndamento.get(idempotencyKey)
      // Um microtask permite registrar a tentativa antes de chamar o SDK.
      const tentativa = Promise.resolve().then(async () => {
        const signal = AbortSignal.timeout(15000)
        try {
          const cliente = criarCliente(chave)
          const resultado = await cliente.emails.send({
            from: REMETENTE, to: [para], subject: assunto, html, text: texto
          }, { idempotencyKey, signal })
          if (resultado?.error || typeof resultado?.data?.id !== "string" || !resultado.data.id.trim()) {
            registrarFalha(resultado?.error, signal.aborted)
            return { status: "nao_enviado", motivo: "FALHA_RESEND" }
          }
          // Aceito pelo provedor não significa entregue à caixa de entrada.
          return { status: "enviado" }
        } catch (erro) {
          registrarFalha(erro, signal.aborted)
          return { status: "nao_enviado", motivo: "FALHA_RESEND" }
        }
      })
      emAndamento.set(idempotencyKey, tentativa)
      try { return await tentativa } finally { emAndamento.delete(idempotencyKey) }
    }
  }
}
