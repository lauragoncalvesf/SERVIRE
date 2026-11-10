import { useState } from "react"
import api from "../services/api"

export default function ConfirmacaoEmailPerfil({ perfil, aoAtualizar }) {
  const [senha, setSenha] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const confirmado = !!perfil.emailAutorizadoEm && !!perfil.emailConfirmadoEm
  async function enviar(event) {
    event.preventDefault(); setOcupado(true); setMensagem("")
    try {
      const { data } = await api.post("/meu-perfil/email/confirmacao", { senhaAtual: senha, emailEsperado: perfil.email })
      setSenha(""); setMensagem(data.mensagem)
      const atualizado = await api.get("/meu-perfil")
      aoAtualizar(atualizado.data)
    } catch (erro) { setMensagem(erro.response?.data?.mensagem || "Não foi possível solicitar a confirmação.") }
    finally { setOcupado(false) }
  }
  return <section className="perfil-card" aria-labelledby="confirmacao-email-titulo">
    <h2 id="confirmacao-email-titulo">E-mail para recuperação</h2>
    <p className="perfil-descricao">{perfil.email}</p>
    <p role="status">{confirmado ? "Confirmado — recuperação de senha habilitada." : perfil.emailAutorizadoEm ? "Pendente — falta confirmar o link enviado para sua caixa postal." : "Pendente — autorize e confirme seu endereço para habilitar a recuperação."}</p>
    {!confirmado && <form onSubmit={enviar} className="mt-4 space-y-4"><fieldset disabled={ocupado} className="space-y-4">
      <label htmlFor="senha-confirmar-email">Sua senha atual<input id="senha-confirmar-email" type="password" required autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} /></label>
      <p className="perfil-descricao">Confira o endereço acima. Sua senha autoriza o vínculo; o link comprova acesso ao e-mail. O link vale por 30 minutos.</p>
      <button className="perfil-botao" type="submit">{ocupado ? "Solicitando..." : perfil.emailAutorizadoEm ? "Reenviar confirmação" : "Autorizar e confirmar este e-mail"}</button>
    </fieldset></form>}
    {mensagem && <p role="status" className="mt-3">{mensagem}</p>}
  </section>
}
