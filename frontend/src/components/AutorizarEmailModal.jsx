import { useState } from "react"
import api from "../services/api"

export default function AutorizarEmailModal({ usuario, global = false, fechar }) {
  const [senha, setSenha] = useState("")
  const [identidade, setIdentidade] = useState(false)
  const [autorizado, setAutorizado] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [mensagem, setMensagem] = useState("")
  async function executar(event) {
    event.preventDefault(); setOcupado(true); setMensagem("")
    const base = global ? `/superadmin/admins/${usuario.id}` : `/usuarios/${usuario.id}`
    try {
      const { data } = await api.post(`${base}/email/${autorizado ? "confirmacao" : "autorizar"}`, { senhaAtual: senha, emailEsperado: usuario.email, ...(!autorizado ? { identidadeConferida: identidade } : {}) })
      setMensagem(data.mensagem); setAutorizado(true)
      if (autorizado) setSenha("")
    } catch (erro) { setMensagem(erro.response?.data?.mensagem || "Não foi possível concluir a operação.") }
    finally { setOcupado(false) }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="autorizar-email-titulo" className="w-full max-w-lg rounded-2xl bg-white p-6 text-slate-900 space-y-4">
    <h2 id="autorizar-email-titulo" className="text-xl font-bold text-[#1D5C9E]">Autorizar e-mail de recuperação</h2>
    <p>{usuario.nome} · {usuario.email}</p>
    <p>Confira a identidade por um canal independente, como atendimento presencial ou contato já conhecido. Possuir acesso ao e-mail não é prova suficiente.</p>
    <form onSubmit={executar} className="space-y-4"><fieldset disabled={ocupado} className="space-y-4">
      {!autorizado && <label className="flex gap-2"><input type="checkbox" required checked={identidade} onChange={e => setIdentidade(e.target.checked)} />Conferi a identidade e o vínculo deste endereço com o titular.</label>}
      <label className="block">Sua senha atual<input className="mt-2 block w-full rounded-lg border p-3" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} /></label>
      <button className="rounded-lg bg-[#1D5C9E] p-3 text-white" type="submit">{ocupado ? "Processando..." : autorizado ? "Enviar confirmação ao titular" : "Registrar autorização do vínculo"}</button>
    </fieldset></form>
    {mensagem && <p role="status">{mensagem}</p>}
    <button type="button" disabled={ocupado} className="rounded-lg border p-3" onClick={fechar}>Fechar</button>
  </section></div>
}
