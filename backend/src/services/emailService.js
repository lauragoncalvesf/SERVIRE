import nodemailer from "nodemailer"

const remetente = "SERVIRE — Sistema de Gestão Pastoral"
const emailValido = valor => typeof valor === "string" && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(valor)

export function lerConfiguracaoEmail(env) {
  const campos = ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"]
  if (campos.some(campo => typeof env[campo] !== "string" || !env[campo].trim())) {
    return { status: "nao_configurado", motivo: "SMTP_AUSENTE" }
  }
  const port = Number(env.SMTP_PORT)
  const secure = env.SMTP_SECURE.trim().toLowerCase()
  const from = env.EMAIL_FROM.trim()
  const address = from.match(/^[^<>\r\n]*<([^<>\r\n]+)>$/)?.[1] || from
  if (!/^\d+$/.test(env.SMTP_PORT) || !Number.isInteger(port) || port < 1 || port > 65535 ||
      !["true", "false"].includes(secure) ||
      (port === 465 && secure !== "true") || (port === 587 && secure !== "false") ||
      !/^[a-z\d.-]+$/i.test(env.SMTP_HOST.trim()) || !emailValido(address) ||
      /[\r\n]/.test(env.SMTP_USER)) {
    return { status: "nao_enviado", motivo: "SMTP_INVALIDO" }
  }
  return {
    status: "configurado",
    from: { name: remetente, address },
    transporte: {
      host: env.SMTP_HOST.trim(), port, secure: secure === "true",
      requireTLS: secure === "false",
      auth: { user: env.SMTP_USER.trim(), pass: env.SMTP_PASS },
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      pool: false, logger: false, debug: false,
      disableFileAccess: true, disableUrlAccess: true
    }
  }
}

// A fábrica permite simular o transporte sem abrir conexões nos testes.
export function criarServicoEmail({ env = process.env, criarTransporte = nodemailer.createTransport } = {}) {
  return {
    async enviar({ para, assunto, html, texto }) {
      const config = lerConfiguracaoEmail(env)
      if (config.status !== "configurado") return { status: config.status, motivo: config.motivo }
      // Defesa adicional para a suíte HTTP/integração, mesmo se o .env contiver SMTP real.
      if (env.NODE_ENV === "test") return { status: "nao_configurado", motivo: "AMBIENTE_TESTE" }
      if (!emailValido(para)) return { status: "nao_enviado", motivo: "DESTINATARIO_INVALIDO" }
      let transporte
      try {
        transporte = criarTransporte(config.transporte)
        const resultado = await transporte.sendMail({
          from: config.from, to: para, subject: assunto, html, text: texto,
          disableFileAccess: true, disableUrlAccess: true
        })
        const aceito = resultado.accepted?.some(endereco =>
          String(typeof endereco === "object" ? endereco.address : endereco).toLowerCase() === para.toLowerCase())
        if (!aceito || resultado.rejected?.length || resultado.pending?.length) {
          return { status: "nao_enviado", motivo: "SMTP_NAO_CONFIRMADO" }
        }
        return { status: "enviado" }
      } catch {
        // Erros SMTP podem conter credenciais, destinatários e trechos da mensagem.
        // Não registrar nem propagar o objeto do provedor.
        return { status: "nao_enviado", motivo: "FALHA_SMTP" }
      } finally {
        try { transporte?.close() } catch { /* Sem logs de dados do provedor. */ }
      }
    }
  }
}
