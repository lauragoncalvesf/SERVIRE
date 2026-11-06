import { criarServicoEmail } from "./emailService.js"

export function criarLinkConvite(frontendUrl, token) {
  if (typeof frontendUrl !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null
  try {
    const url = new URL(frontendUrl)
    // A URL deve ser uma origem pública HTTPS, não uma URL de redirecionamento.
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
        !["", "/"].includes(url.pathname) || !url.hostname.includes(".") ||
        /^(localhost|.*\.localhost|.*\.local|127\..*|0\..*|10\..*|192\.168\..*|169\.254\..*|172\.(1[6-9]|2\d|3[01])\..*)$/i.test(url.hostname) ||
        url.hostname.includes(":")) return null
    const link = new URL("/aceitar-convite", url)
    link.hash = new URLSearchParams({ token }).toString()
    return link.href
  } catch { return null }
}

export function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, caractere => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caractere])
}

export function modeloConvite({ nome, paroquia, link }) {
  const n = escaparHtml(nome)
  const p = escaparHtml(paroquia)
  const href = escaparHtml(link)
  return {
    assunto: "Convite para administrar sua paróquia no SERVIRE",
    texto: `SERVIRE — Sistema de Gestão Pastoral\n\nOlá, ${nome}!\n\nVocê foi convidado(a) para administrar a paróquia ${paroquia} no SERVIRE.\n\nAceitar convite e definir senha:\n${link}\n\nO convite expira em 48 horas a partir da emissão e só pode ser utilizado uma vez.\nSe não reconhecer este convite, ignore esta mensagem.`,
    html: `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Convite SERVIRE</title></head>
<body style="margin:0;padding:20px 12px;background:#F7F5EF;font-family:Arial,sans-serif;color:#1e293b;">
<table role="presentation" style="width:100%;border-collapse:collapse;"><tr><td align="center">
<table role="presentation" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #EFE8D6;border-radius:16px;border-spacing:0;overflow:hidden;">
<tr><td style="padding:28px 24px;background:#1D5C9E;color:#ffffff;"><h1 style="margin:0;font-size:28px;">SERVIRE</h1><p style="margin:8px 0 0;font-size:15px;">Sistema de Gestão Pastoral</p></td></tr>
<tr><td style="padding:28px 24px;font-size:16px;line-height:1.6;"><p>Olá, ${n}!</p><p>Você foi convidado(a) para administrar a paróquia <strong>${p}</strong> no SERVIRE. Defina sua senha para começar a utilizar o sistema.</p>
<table role="presentation" style="margin:24px 0;border-spacing:0;"><tr><td style="border-radius:8px;background:#1D5C9E;"><a href="${href}" style="display:inline-block;padding:16px 20px;color:#ffffff;font-weight:bold;text-decoration:none;">Aceitar convite e definir senha</a></td></tr></table>
<p>O convite expira em <strong>48 horas a partir da emissão</strong> e só pode ser utilizado uma vez.</p><p style="font-size:14px;color:#475569;">Se o botão não funcionar, copie este endereço para o navegador:</p><p style="font-size:13px;overflow-wrap:anywhere;word-break:break-all;"><a href="${href}" style="color:#1D5C9E;">${href}</a></p>
<p style="font-size:14px;color:#475569;">Se não reconhecer este convite, ignore esta mensagem.</p></td></tr>
<tr><td style="padding:20px 24px;background:#EFE8D6;color:#1D5C9E;font-size:14px;text-align:center;">A serviço de uma Igreja mais viva.</td></tr></table>
</td></tr></table></body></html>`
  }
}

// Executar somente depois do commit: o retry serializável nunca deve enviar e-mail.
export async function entregarConvite({ usuario, paroquia, convite }, { env = process.env, email = criarServicoEmail({ env }) } = {}) {
  const link = criarLinkConvite(env.FRONTEND_URL, convite.token)
  const envio = link
    ? await email.enviar({ para: usuario.email, ...modeloConvite({ nome: usuario.nome, paroquia, link }) })
    : { status: "nao_enviado", motivo: "FRONTEND_URL_INVALIDA" }
  return {
    envio,
    convite: {
      expiraEm: convite.expiraEm,
      // Só revelar o segredo para recuperação manual quando não houver confirmação SMTP.
      ...(envio.status !== "enviado" ? { token: convite.token, ...(link ? { link } : {}) } : {})
    }
  }
}
