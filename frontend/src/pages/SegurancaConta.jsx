import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import api from "../services/api"
import "./MeuPerfil.css"

export default function SegurancaConta({ modo }) {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token") || "")
  useEffect(() => { if (modo !== "solicitar") window.history.replaceState(null, "", window.location.pathname) }, [modo])
  const [email, setEmail] = useState("")
  const [paroquia, setParoquia] = useState("")
  const [senha, setSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [mostrar, setMostrar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [concluido, setConcluido] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")
  async function enviar(event) {
    event.preventDefault(); setErro(""); setMensagem("")
    if (modo === "redefinir" && (senha !== confirmacao || senha.length < 12 || new TextEncoder().encode(senha).length > 72 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha))) { setErro("Confirme senhas iguais com ao menos 12 caracteres, letras e números e até 72 bytes."); return }
    setOcupado(true)
    try {
      const caminho = modo === "solicitar" ? "/auth/esqueci-senha" : modo === "confirmar" ? "/auth/confirmar-email" : "/auth/redefinir-senha"
      const body = modo === "solicitar" ? { email: email.trim().toLowerCase(), paroquiaId: paroquia ? Number(paroquia) : null } : modo === "confirmar" ? { token } : { token, novaSenha: senha, confirmarSenha: confirmacao }
      const { data } = await api.post(caminho, body)
      setMensagem(data.mensagem); setConcluido(true); setSenha(""); setConfirmacao("")
    } catch (falha) { setErro(falha.response?.data?.mensagem || "Não foi possível concluir. Tente novamente mais tarde.") }
    finally { setOcupado(false) }
  }
  return <main className="perfil-page min-h-screen flex items-center justify-center bg-[#F7F5EF] p-4"><section className="perfil-card w-full max-w-lg space-y-5">
    <h1 className="text-2xl font-bold text-[#1D5C9E]">{modo === "solicitar" ? "Esqueci minha senha" : modo === "confirmar" ? "Confirmar e-mail" : "Redefinir senha"}</h1>
    {modo === "solicitar" && <p>Informe os mesmos dados usados no login. A recuperação depende de endereço previamente autorizado e confirmado. Se não o habilitou, procure o responsável pelo seu cadastro.</p>}
    {!concluido && <form onSubmit={enviar}><fieldset disabled={ocupado} className="space-y-4">
      {modo === "solicitar" ? <><label htmlFor="recuperar-paroquia">Paróquia<input id="recuperar-paroquia" type="number" min="1" step="1" value={paroquia} onChange={e => setParoquia(e.target.value)} /></label><label htmlFor="recuperar-email">E-mail<input id="recuperar-email" type="email" autoComplete="email" required maxLength={200} value={email} onChange={e => setEmail(e.target.value)} /></label></> : !token ? <p role="alert">Abra o link completo recebido por e-mail.</p> : modo === "confirmar" ? <p>Clique abaixo para confirmar seu endereço. Esta ação não altera sua senha nem inicia uma sessão.</p> : <><p>Use ao menos 12 caracteres, letras e números e até 72 bytes.</p><label htmlFor="recuperar-senha">Nova senha<input id="recuperar-senha" type={mostrar ? "text" : "password"} required minLength={12} autoComplete="new-password" value={senha} onChange={e => setSenha(e.target.value)} /></label><label htmlFor="recuperar-confirmacao">Confirmar nova senha<input id="recuperar-confirmacao" type={mostrar ? "text" : "password"} required minLength={12} autoComplete="new-password" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} /></label><button type="button" aria-pressed={mostrar} onClick={() => setMostrar(v => !v)}>{mostrar ? "Ocultar senhas" : "Mostrar senhas"}</button></>}
      <button className="perfil-botao" type="submit" disabled={modo !== "solicitar" && !token}>{ocupado ? "Processando..." : modo === "solicitar" ? "Solicitar recuperação" : modo === "confirmar" ? "Confirmar meu e-mail" : "Salvar nova senha"}</button>
    </fieldset></form>}
    {erro && <p className="perfil-erro" role="alert">{erro}</p>}
    {mensagem && <p className="perfil-sucesso" role="status">{mensagem}</p>}
    <Link className="block text-[#1D5C9E] underline" to="/login">Voltar ao login</Link>
  </section></main>
}
