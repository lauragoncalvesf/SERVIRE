import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import api from "../services/api"
export default function AceitarConvite() {
  const [token] = useState(() => {
    return new URLSearchParams(window.location.hash.slice(1)).get("token") || ""
  })
  useEffect(() => { window.history.replaceState(null, "", window.location.pathname) }, [])
  const [senha, setSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [mensagem, setMensagem] = useState("")
  const [ocupado, setOcupado] = useState(false)
  const [concluido, setConcluido] = useState(false)
  async function enviar(event) {
    event.preventDefault()
    if (senha !== confirmacao) { setMensagem("As senhas não coincidem"); return }
    setOcupado(true)
    try {
      const { data } = await api.post("/auth/aceitar-convite", { token, senha })
      setMensagem(data.mensagem); setConcluido(true); setSenha(""); setConfirmacao("")
    } catch (erro) { setMensagem(erro.response?.data?.mensagem || "Não foi possível aceitar o convite") }
    finally { setOcupado(false) }
  }
  return <main className="min-h-screen bg-[#F7F5EF] p-6 flex justify-center items-center"><section className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
    <h1 className="text-2xl font-bold text-[#1D5C9E]">Definir senha do administrador</h1>
    <p>Use ao menos 12 caracteres, com letras e números (máximo de 72 bytes).</p>
    {!concluido && <form onSubmit={enviar} className="space-y-4">
      <label className="block">Nova senha<input className="block border rounded p-3 w-full" type="password" autoComplete="new-password" required minLength={12} value={senha} onChange={e => setSenha(e.target.value)} /></label>
      <label className="block">Confirmar senha<input className="block border rounded p-3 w-full" type="password" autoComplete="new-password" required value={confirmacao} onChange={e => setConfirmacao(e.target.value)} /></label>
      <button className="bg-[#1D5C9E] text-white rounded p-3" disabled={ocupado || !token}>{ocupado ? "Salvando..." : "Definir senha"}</button>
    </form>}
    <p role="status">{mensagem || (!token ? "Abra o link de convite fornecido pelo Superadministrador." : "")}</p><Link to="/login">Ir para login</Link>
  </section></main>
}
