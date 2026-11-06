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

// Apenas valores desta lista podem sair do erro do provedor para os logs.
const codigosDns = new Set(["EDNS", "ENOTFOUND", "EAI_AGAIN", "EAI_FAIL"])
const codigosTimeout = new Set(["ETIMEDOUT", "ESOCKETTIMEDOUT"])
const codigosTls = new Set([
  "ETLS", "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_TLS_CERT_SIGNATURE_ALGORITHM_UNSUPPORTED", "ERR_SSL_WRONG_VERSION_NUMBER",
  "ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION", "ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE"
])
const codigosConexao = new Set(["ECONNECTION", "ESOCKET", "ECONNREFUSED", "ECONNRESET", "ECONNABORTED", "EHOSTUNREACH", "ENETUNREACH", "EPIPE", "EADDRNOTAVAIL"])
const etapas = new Set(["CONN", "EHLO", "HELO", "STARTTLS", "AUTH", "MAIL FROM", "RCPT TO", "DATA"])
const tiposTimeout = new Set(["CONNECT_TIMEOUT", "GREETING_TIMEOUT", "SOCKET_TIMEOUT", "UPGRADE_TIMEOUT"])

export function diagnosticarErroSmtp(erro) {
  // Sem ler message, response, stack, destinatários ou outras propriedades livres.
  const fontes = [erro, erro?.cause].filter(fonte => fonte && typeof fonte === "object")
  const codigos = fontes.flatMap(fonte => [fonte.originalCode, fonte.code]).filter(codigo => typeof codigo === "string")
  const comando = erro?.command
  const etapa = etapas.has(comando) ? comando
    : typeof comando === "string" && /^AUTH (PLAIN|LOGIN|XOAUTH2|CRAM-MD5)$/.test(comando) ? "AUTH" : "DESCONHECIDA"
  let categoria = "DESCONHECIDO"
  let codigo = "NAO_CLASSIFICADO"
  const escolher = (lista, nome) => {
    const encontrado = codigos.find(valor => lista.has(valor))
    if (!encontrado) return false
    categoria = nome; codigo = encontrado; return true
  }
  if (!escolher(codigosDns, "DNS") && !escolher(codigosTimeout, "TIMEOUT") && !escolher(codigosTls, "TLS")) {
    if (codigos.some(valor => /^ERR_(SSL|TLS)_/.test(valor)) || etapa === "STARTTLS") {
      categoria = "TLS"; codigo = "TLS_OUTRO"
    } else if (escolher(codigosConexao, "CONEXAO")) {
      // Falha de rede durante AUTH/RCPT continua sendo conexão, não recusa SMTP.
    } else if (codigos.includes("EAUTH") || etapa === "AUTH") {
      categoria = "AUTENTICACAO"; codigo = "EAUTH"
    } else if (etapa === "RCPT TO") {
      categoria = "DESTINATARIO"; codigo = "DESTINATARIO_RECUSADO"
    }
  }
  const diagnostico = { categoria, codigo, etapa }
  if (Number.isInteger(erro?.responseCode) && erro.responseCode >= 400 && erro.responseCode <= 599) {
    diagnostico.respostaSmtp = erro.responseCode
  }
  const tipoTimeout = fontes.map(fonte => fonte.timeoutType).find(valor => tiposTimeout.has(valor))
  if (categoria === "TIMEOUT" && tipoTimeout) diagnostico.tipoTimeout = tipoTimeout
  return diagnostico
}

function registrarFalhaSmtp(diagnostico) {
  // JSON de campos permitidos; nunca serializar o erro ou a configuração SMTP.
  console.warn(JSON.stringify({ evento: "smtp_falha", ...diagnostico }))
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
          registrarFalhaSmtp(resultado.rejected?.length
            ? { categoria: "DESTINATARIO", codigo: "DESTINATARIO_RECUSADO", etapa: "RCPT TO" }
            : { categoria: "NAO_CONFIRMADO", codigo: "SEM_CONFIRMACAO", etapa: "DESCONHECIDA" })
          return { status: "nao_enviado", motivo: "SMTP_NAO_CONFIRMADO" }
        }
        return { status: "enviado" }
      } catch (erro) {
        registrarFalhaSmtp(diagnosticarErroSmtp(erro))
        return { status: "nao_enviado", motivo: "FALHA_SMTP" }
      } finally {
        try { transporte?.close() } catch { /* Sem logs de dados do provedor. */ }
      }
    }
  }
}
