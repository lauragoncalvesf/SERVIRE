import { criarServicoResend } from "./resendEmailService.js"
import { criarLinkConvite, escaparHtml } from "./conviteEmailService.js"

const email = criarServicoResend()
export async function enviarEmailSeguranca({ usuario, token, tokenHash, finalidade }) {
  const origem = process.env.FRONTEND_URL ?? "https://servirepastoral.com.br"
  const base = criarLinkConvite(origem, token)
  if (!base) return { status: "nao_enviado", motivo: "FRONTEND_URL_INVALIDA" }
  const confirmar = finalidade === "CONFIRMAR_EMAIL"
  const url = new URL(base)
  url.pathname = confirmar ? "/confirmar-email" : "/redefinir-senha"
  const link = url.href
  const acao = confirmar ? "Confirmar meu e-mail" : "Redefinir minha senha"
  const explicacao = confirmar ? "Confirme seu endereço para habilitar a recuperação da sua conta. Esta confirmação exige um vínculo previamente autorizado." : "Recebemos uma solicitação para redefinir a senha da sua conta."
  const escopo = usuario.paroquia?.nome || "Administração global"
  const texto = `SERVIRE — Sistema de Gestão Pastoral\n\nOlá, ${usuario.nome}!\n${escopo}\n\n${explicacao}\n\n${acao}: ${link}\n\nEste link expira em 30 minutos e pode ser usado uma única vez. Se não solicitou esta ação, ignore a mensagem. Sua senha não muda sem a confirmação.`
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:20px 12px;background:#F7F5EF;font-family:Arial,sans-serif;color:#1e293b"><table role="presentation" style="width:100%;max-width:600px;margin:auto;background:white;border-radius:16px"><tr><td style="padding:24px;background:#1D5C9E;color:white"><h1>SERVIRE</h1><p>Sistema de Gestão Pastoral</p></td></tr><tr><td style="padding:24px;line-height:1.6"><p>Olá, ${escaparHtml(usuario.nome)}!</p><p>${escaparHtml(escopo)}</p><p>${explicacao}</p><p><a href="${escaparHtml(link)}" style="display:inline-block;background:#1D5C9E;color:white;padding:14px 20px;border-radius:8px;text-decoration:none">${acao}</a></p><p>Este link expira em <strong>30 minutos</strong> e pode ser usado uma única vez.</p><p style="word-break:break-all">${escaparHtml(link)}</p><p>Se não solicitou esta ação, ignore a mensagem. Sua senha não muda sem a confirmação.</p></td></tr></table></body></html>`
  return email.enviar({ para: usuario.email, assunto: `${acao} — SERVIRE`, texto, html, idempotencyKey: `${confirmar ? "confirmacao-email" : "recuperacao-senha"}/${tokenHash}` })
}
