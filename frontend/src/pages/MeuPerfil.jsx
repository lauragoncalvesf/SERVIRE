import { useEffect, useState } from "react"
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react"
import ConfirmacaoEmailPerfil from "../components/ConfirmacaoEmailPerfil"
import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuth } from "../contexts/auth"
import { formatarTipoUsuario, emailValido } from "../utils"
import "./MeuPerfil.css"

function CampoSenha({ id, rotulo, valor, alterar, nova = false, obrigatorio = true }) {
  const [visivel, setVisivel] = useState(false)
  return <div>
    <label htmlFor={id}>{rotulo}</label>
    <div className="perfil-senha">
      <input id={id} type={visivel ? "text" : "password"} value={valor} onChange={e => alterar(e.target.value)} autoComplete={nova ? "new-password" : "current-password"} required={obrigatorio} minLength={nova ? 12 : undefined} />
      <button type="button" aria-label={`${visivel ? "Ocultar" : "Mostrar"} ${rotulo.toLowerCase()}`} aria-pressed={visivel} onClick={() => setVisivel(v => !v)}>{visivel ? <EyeOff size={19} /> : <Eye size={19} />}</button>
    </div>
  </div>
}

export default function MeuPerfil() {
  const { atualizarSessao } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [nome, setNome] = useState("")
  const [email, setEmail] = useState("")
  const [senhaEmail, setSenhaEmail] = useState("")
  const [senhaAtual, setSenhaAtual] = useState("")
  const [novaSenha, setNovaSenha] = useState("")
  const [confirmacao, setConfirmacao] = useState("")
  const [carregando, setCarregando] = useState(true)
  const [ocupado, setOcupado] = useState("")
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState("")
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    let ativo = true
    api.get("/meu-perfil").then(({ data }) => {
      if (ativo) { setPerfil(data); setNome(data.nome); setEmail(data.email) }
    }).catch(falha => { if (ativo) setErro(falha.response?.data?.mensagem || "Não foi possível carregar seu perfil.") })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [tentativa])
  const mudouEmail = perfil && email.trim().toLowerCase() !== perfil.email.trim().toLowerCase()
  async function salvarDados(event) {
    event.preventDefault(); setErro(""); setSucesso("")
    if (!nome.trim() || nome.trim().length > 200 || !emailValido(email.trim()) || email.length > 200) { setErro("Informe um nome e um e-mail válidos."); return }
    if (mudouEmail && !senhaEmail) { setErro("Informe a senha atual para alterar o e-mail."); return }
    setOcupado("dados")
    try {
      const { data } = await api.patch("/meu-perfil", { nome: nome.trim(), email: email.trim().toLowerCase(), ...(mudouEmail ? { senhaAtual: senhaEmail } : {}) })
      atualizarSessao(data); setPerfil(data.usuario); setNome(data.usuario.nome); setEmail(data.usuario.email); setSenhaEmail(""); setSucesso(data.mensagem)
    } catch (falha) { setErro(falha.response?.data?.mensagem || "Não foi possível atualizar seus dados.") }
    finally { setOcupado("") }
  }
  async function salvarSenha(event) {
    event.preventDefault(); setErro(""); setSucesso("")
    if (novaSenha !== confirmacao) { setErro("A confirmação da nova senha não confere."); return }
    if (novaSenha.length < 12 || new TextEncoder().encode(novaSenha).length > 72 || !/[A-Za-z]/.test(novaSenha) || !/\d/.test(novaSenha)) { setErro("A nova senha deve ter ao menos 12 caracteres, letras e números, e até 72 bytes."); return }
    if (novaSenha === senhaAtual) { setErro("A nova senha deve ser diferente da senha atual."); return }
    setOcupado("senha")
    try {
      const { data } = await api.put("/meu-perfil/senha", { senhaAtual, novaSenha, confirmarSenha: confirmacao })
      atualizarSessao(data); setPerfil(data.usuario); setSenhaAtual(""); setNovaSenha(""); setConfirmacao(""); setSucesso(data.mensagem)
    } catch (falha) { setErro(falha.response?.data?.mensagem || "Não foi possível atualizar a senha.") }
    finally { setOcupado("") }
  }
  return <AppLayout titulo="Meu Perfil" subtitulo="Seus dados pessoais e a segurança da sua conta">
    <div className="perfil-page max-w-5xl space-y-5">
      {erro && <p className="perfil-erro" role="alert">{erro}</p>}
      {sucesso && <p className="perfil-sucesso" role="status">{sucesso}</p>}
      {carregando ? <p role="status">Carregando seu perfil...</p> : !perfil ? <button className="perfil-botao" onClick={() => { setErro(""); setCarregando(true); setTentativa(v => v + 1) }}>Tentar novamente</button> : <div className="grid gap-6 lg:grid-cols-2">
        <section className="perfil-card" aria-labelledby="dados-titulo">
          <h2 id="dados-titulo"><UserRound size={21} aria-hidden="true" />Dados pessoais</h2>
          <p className="perfil-descricao">Mantenha seu nome e e-mail atualizados.</p>
          <form onSubmit={salvarDados} className="space-y-5">
            <fieldset disabled={!!ocupado} className="space-y-5">
              <div><label htmlFor="perfil-nome">Nome completo</label><input id="perfil-nome" value={nome} onChange={e => setNome(e.target.value)} required maxLength={200} autoComplete="name" /></div>
              <div><label htmlFor="perfil-email">E-mail</label><input id="perfil-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={200} autoComplete="email" /></div>
              <div><label htmlFor="perfil-cargo">Nível de acesso</label><input id="perfil-cargo" readOnly value={perfil.tipo === "MEMBRO" && perfil.coordenacoes?.length ? "Coordenador de pastoral" : formatarTipoUsuario(perfil.tipo)} /></div>
              {perfil.paroquia && <p className="perfil-descricao">Paróquia: {perfil.paroquia.nome}</p>}
              {mudouEmail && <><CampoSenha id="perfil-senha-email" rotulo="Senha atual para alterar e-mail" valor={senhaEmail} alterar={setSenhaEmail} /><p className="perfil-descricao">Ao alterar o e-mail, as outras sessões serão encerradas. Use o novo endereço no próximo login.</p></>}
              <button className="perfil-botao" type="submit">{ocupado === "dados" ? "Salvando..." : "Salvar alterações"}</button>
            </fieldset>
          </form>
        </section>
        <ConfirmacaoEmailPerfil key={perfil.email} perfil={perfil} aoAtualizar={setPerfil} />
        <section className="perfil-card" aria-labelledby="senha-titulo">
          <h2 id="senha-titulo"><LockKeyhole size={21} aria-hidden="true" />Alterar senha</h2>
          <p className="perfil-descricao" id="senha-regras">Use ao menos 12 caracteres, com letras e números e até 72 bytes. Após a alteração, as outras sessões serão encerradas.</p>
          <form onSubmit={salvarSenha} aria-describedby="senha-regras">
            <fieldset disabled={!!ocupado} className="space-y-5">
              <CampoSenha id="perfil-senha-atual" rotulo="Senha atual" valor={senhaAtual} alterar={setSenhaAtual} />
              <CampoSenha id="perfil-nova-senha" rotulo="Nova senha" valor={novaSenha} alterar={setNovaSenha} nova />
              <CampoSenha id="perfil-confirmar-senha" rotulo="Confirmar nova senha" valor={confirmacao} alterar={setConfirmacao} nova />
              <button className="perfil-botao" type="submit">{ocupado === "senha" ? "Atualizando..." : "Atualizar senha"}</button>
            </fieldset>
          </form>
        </section>
      </div>}
    </div>
  </AppLayout>
}
