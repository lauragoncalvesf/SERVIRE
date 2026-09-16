import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowRight, Church, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"

import { useAuth } from "../contexts/auth"
import { emailValido, textoPreenchido, numeroInteiroPositivo, normalizarEmail } from "../utils"
import "./Login.css"

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [paroquiaId, setParoquiaId] = useState("")
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setErro("")
      setCarregando(true)

      if (!numeroInteiroPositivo(paroquiaId)) {
        setErro("Informe uma paróquia válida")
        return
      }
      if (!textoPreenchido(email)) {
        setErro("Informe o e-mail")
        return
      }
      if (!emailValido(email)) {
        setErro("Informe um e-mail válido")
        return
      }
      if (!textoPreenchido(senha)) {
        setErro("Informe a senha")
        return
      }

      await login(normalizarEmail(email), senha, Number(paroquiaId))
      navigate("/dashboard")
    } catch (error) {
      setErro(error.response?.data?.mensagem || "Não foi possível realizar o login")
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-background" aria-hidden="true" />
      <div className="login-arc login-arc-top" aria-hidden="true" />
      <div className="login-arc login-arc-bottom" aria-hidden="true" />

      <section className="login-card" aria-labelledby="login-title">
        <header className="login-header">
          <img className="login-logo" src="/logo3.png" alt="Servire — Sistema de Gestão Pastoral" />
          <h1 id="login-title">Bem-vindo</h1>
          <p>Entre para acessar suas pastorais e escalas.</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="login-paroquia">Paróquia</label>
            <div className="login-input-wrap">
              <Church aria-hidden="true" size={25} strokeWidth={1.8} />
              <input id="login-paroquia" type="number" min="1" step="1" value={paroquiaId}
                onChange={(event) => setParoquiaId(event.target.value)} placeholder="ID da paróquia" required />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-email">E-mail</label>
            <div className="login-input-wrap">
              <Mail aria-hidden="true" size={26} strokeWidth={1.8} />
              <input id="login-email" type="email" value={email}
                onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com"
                autoComplete="username" required />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="login-senha">Senha</label>
            <div className="login-input-wrap">
              <LockKeyhole aria-hidden="true" size={25} strokeWidth={1.8} />
              <input id="login-senha" type={mostrarSenha ? "text" : "password"} value={senha}
                onChange={(event) => setSenha(event.target.value)} placeholder="Sua senha"
                autoComplete="current-password" required />
              <button className="login-password-toggle" type="button"
                onClick={() => setMostrarSenha((visivel) => !visivel)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} aria-pressed={mostrarSenha}>
                {mostrarSenha ? <Eye size={22} strokeWidth={1.8} /> : <EyeOff size={22} strokeWidth={1.8} />}
              </button>
            </div>
          </div>

          {erro && <p className="login-error" role="alert">{erro}</p>}

          <button className="login-submit" type="submit" disabled={carregando}>
            <span>{carregando ? "Entrando..." : "Entrar"}</span>
            {!carregando && <ArrowRight aria-hidden="true" size={24} strokeWidth={1.9} />}
          </button>
        </form>

        <footer className="login-footer">
          <div className="login-footer-divider" aria-hidden="true"><span>✝</span></div>
          <p>A serviço de uma Igreja mais viva.</p>
        </footer>
      </section>
    </main>
  )
}
