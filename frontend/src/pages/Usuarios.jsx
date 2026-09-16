import { useEffect, useMemo, useState } from "react"

import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuth } from "../contexts/auth"
import { emailValido, textoPreenchido, telefoneValido, formatarTelefone, formatarTipoUsuario, normalizarTexto, normalizarEmail } from "../utils"


export default function Usuarios() {
  const { usuario } = useAuth()

  const [usuarios, setUsuarios] = useState([])

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState("")

  const [busca, setBusca] = useState("")
  const [filtroStatus, setFiltroStatus] = useState("TODOS")

  const [mostrarNovoUsuario, setMostrarNovoUsuario] =
    useState(false)

  const [nomeNovo, setNomeNovo] = useState("")
  const [emailNovo, setEmailNovo] = useState("")
  const [telefoneNovo, setTelefoneNovo] = useState("")
  const [senhaNova, setSenhaNova] = useState("")
  const [tipoNovo, setTipoNovo] = useState("MEMBRO")

  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const [erroNovo, setErroNovo] = useState("")

  const [mostrarEditarUsuario, setMostrarEditarUsuario] =
    useState(false)

  const [usuarioEditando, setUsuarioEditando] = useState(null)

  const [nomeEditando, setNomeEditando] = useState("")
  const [emailEditando, setEmailEditando] = useState("")
  const [telefoneEditando, setTelefoneEditando] = useState("")
  const [tipoEditando, setTipoEditando] = useState("MEMBRO")
  const [ativoEditando, setAtivoEditando] = useState(true)

  const [salvandoEdicao, setSalvandoEdicao] =
    useState(false)

  const [erroEdicao, setErroEdicao] = useState("")

  useEffect(() => {
    carregarUsuarios()
  }, [])

  async function carregarUsuarios() {
    try {
      setCarregando(true)
      setErro("")

      const response =
        await api.get("/usuarios")

      setUsuarios(response.data)

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao carregar usuários"
      )
    } finally {
      setCarregando(false)
    }
  }

  const usuariosFiltrados = useMemo(() => {
    const textoBusca =
      normalizarTexto(busca)

    return usuarios.filter((item) => {
      const correspondeBusca =
        !textoBusca ||
        normalizarTexto(item.nome)
          .includes(textoBusca) ||
          normalizarTexto(item.email)
          .includes(textoBusca)

      const correspondeStatus =
        filtroStatus === "TODOS" ||
        (
          filtroStatus === "ATIVOS" &&
          item.ativo
        ) ||
        (
          filtroStatus === "INATIVOS" &&
          !item.ativo
        )

      return (
        correspondeBusca &&
        correspondeStatus
      )
    })
  }, [
    usuarios,
    busca,
    filtroStatus
  ])

  function limparNovoUsuario() {
    setNomeNovo("")
    setEmailNovo("")
    setTelefoneNovo("")
    setSenhaNova("")
    setTipoNovo("MEMBRO")
    setErroNovo("")
  }

  function abrirNovoUsuario() {
    limparNovoUsuario()
    setMostrarNovoUsuario(true)
  }

  function fecharNovoUsuario() {
    limparNovoUsuario()
    setMostrarNovoUsuario(false)
  }

  async function criarUsuario(event) {
    event.preventDefault()

    try {
      setSalvandoNovo(true)
      setErroNovo("")

      if (
        !textoPreenchido(nomeNovo) ||
        !textoPreenchido(emailNovo) ||
        !textoPreenchido(senhaNova)
        ) {
        setErroNovo(
            "Nome, e-mail e senha são obrigatórios"
        )
        return
        }

        if (!emailValido(emailNovo)) {
        setErroNovo(
            "Informe um e-mail válido"
        )
        return
        }

        if (senhaNova.length < 8) {
          setErroNovo("A senha deve ter pelo menos 8 caracteres")
          return
        }

        if (!telefoneValido(telefoneNovo)) {
        setErroNovo(
            "Informe um telefone válido"
        )
        return
        }

      await api.post(
        "/usuarios",
        {
          nome: nomeNovo.trim(),
          email: normalizarEmail(emailNovo),
          telefone:
            telefoneNovo.trim() || null,
          senha: senhaNova,
          tipo: tipoNovo
        }
      )

      fecharNovoUsuario()

      await carregarUsuarios()

    } catch (error) {
      setErroNovo(
        error.response?.data?.mensagem ||
        "Erro ao criar usuário"
      )
    } finally {
      setSalvandoNovo(false)
    }
  }

  function abrirEditarUsuario(item) {
    setUsuarioEditando(item)

    setNomeEditando(
      item.nome || ""
    )

    setEmailEditando(
      item.email || ""
    )

    setTelefoneEditando(
      item.telefone || ""
    )

    setTipoEditando(
      item.tipo || "MEMBRO"
    )

    setAtivoEditando(
      Boolean(item.ativo)
    )

    setErroEdicao("")

    setMostrarEditarUsuario(true)
  }

  function fecharEditarUsuario() {
    setUsuarioEditando(null)
    setErroEdicao("")
    setMostrarEditarUsuario(false)
  }

  async function salvarEdicaoUsuario(event) {
    event.preventDefault()

    if (!usuarioEditando) {
      return
    }

    try {
      setSalvandoEdicao(true)
      setErroEdicao("")

      if (
        !textoPreenchido(nomeEditando) ||
        !textoPreenchido(emailEditando)
        ) {
        setErroEdicao(
            "Nome e e-mail são obrigatórios"
        )
        return
        }

        if (!emailValido(emailEditando)) {
        setErroEdicao(
            "Informe um e-mail válido"
        )
        return
        }

        if (!telefoneValido(telefoneEditando)) {
        setErroEdicao(
            "Informe um telefone válido"
        )
        return
        }

      await api.patch(
        `/usuarios/${usuarioEditando.id}`,
        {
          nome: nomeEditando.trim(),
          email: emailEditando.trim() .toLowerCase(),
          telefone:
            telefoneEditando.trim() || null,
          tipo: tipoEditando,
          ativo: ativoEditando
        }
      )

      fecharEditarUsuario()

      await carregarUsuarios()

    } catch (error) {
      setErroEdicao(
        error.response?.data?.mensagem ||
        "Erro ao atualizar usuário"
      )
    } finally {
      setSalvandoEdicao(false)
    }
  }

  if (
    usuario &&
    usuario.tipo !== "ADMIN"
  ) {
    return (
      <AppLayout
        titulo="Usuários"
        subtitulo="Gestão de usuários da paróquia"
      >
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-5">
          Você não possui permissão para acessar esta página.
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      titulo="Usuários"
      subtitulo="Gerencie as contas de acesso da paróquia"
    >

      <div className="space-y-6">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

          <div className="flex flex-col sm:flex-row gap-3 flex-1">

            <input
              type="text"
              value={busca}
              onChange={(event) =>
                setBusca(
                  event.target.value
                )
              }
              placeholder="Buscar por nome ou e-mail"
              className="w-full sm:max-w-md border border-slate-300 rounded-lg px-4 py-3"
            />

            <select
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(
                  event.target.value
                )
              }
              className="border border-slate-300 rounded-lg px-4 py-3 bg-white"
            >
              <option value="TODOS">
                Todos
              </option>

              <option value="ATIVOS">
                Ativos
              </option>

              <option value="INATIVOS">
                Inativos
              </option>
            </select>

          </div>

          <button
            onClick={abrirNovoUsuario}
            className="bg-[#3B7EC7] text-white px-4 py-3 rounded-lg font-medium hover:bg-[#2F6BAA] transition"
          >
            + Novo usuário
          </button>

        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {erro}
          </div>
        )}

        {carregando && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-500">
            Carregando usuários...
          </div>
        )}

        {!carregando &&
          !erro &&
          usuariosFiltrados.length === 0 && (

          <div className="bg-white border border-slate-200 rounded-xl p-6 text-slate-500">
            Nenhum usuário encontrado.
          </div>
        )}

        {!carregando &&
          !erro &&
          usuariosFiltrados.length > 0 && (

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

            <div className="divide-y divide-slate-100">

              {usuariosFiltrados.map(
                (item) => (

                <div
                  key={item.id}
                  className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                >

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <p className="font-semibold text-slate-900">
                        {item.nome}
                      </p>

                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          item.tipo === "ADMIN"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {formatarTipoUsuario(item.tipo)}
                      </span>

                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          item.ativo
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {item.ativo
                          ? "Ativo"
                          : "Inativo"}
                      </span>

                    </div>

                    <p className="text-sm text-slate-500 mt-1 break-all">
                      {item.email}
                    </p>

                    {item.telefone && (
                      <p className="text-sm text-slate-500 mt-1">
                        {formatarTelefone(item.telefone)}
                      </p>
                    )}

                  </div>

                  <button
                    onClick={() =>
                      abrirEditarUsuario(
                        item
                      )
                    }
                    className="border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50"
                  >
                    Editar
                  </button>

                </div>
              ))}

            </div>

          </div>
        )}

      </div>

      {/* MODAL NOVO USUÁRIO */}
      {mostrarNovoUsuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  Novo usuário
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Crie uma nova conta de acesso para a paróquia.
                </p>

              </div>

              <button
                type="button"
                onClick={fecharNovoUsuario}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={criarUsuario}
              className="space-y-5 mt-6"
            >

              <div>

                <label className="block text-sm font-medium mb-2">
                  Nome
                </label>

                <input
                  type="text"
                  value={nomeNovo}
                  onChange={(event) =>
                    setNomeNovo(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="Nome completo"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  E-mail
                </label>

                <input
                  type="email"
                  value={emailNovo}
                  onChange={(event) =>
                    setEmailNovo(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="email@exemplo.com"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  Telefone
                </label>

                <input
                  type="text"
                  value={telefoneNovo}
                  onChange={(event) =>
                    setTelefoneNovo(
                      event.target.value
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="(83) 99999-9999"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  Senha inicial
                </label>

                <input
                  type="password"
                  value={senhaNova}
                  onChange={(event) =>
                    setSenhaNova(
                      event.target.value
                    )
                  }
                  required
                  minLength={8}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="Pelo menos 8 caracteres"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  Tipo de usuário
                </label>

                <select
                  value={tipoNovo}
                  onChange={(event) =>
                    setTipoNovo(
                      event.target.value
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                >
                  <option value="MEMBRO">
                    Membro
                  </option>

                  <option value="ADMIN">
                    Administrador
                  </option>
                </select>

                <p className="text-xs text-slate-500 mt-2">
                  Coordenadores são definidos dentro de cada pastoral, não pelo tipo global do usuário.
                </p>

              </div>

              {erroNovo && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {erroNovo}
                </div>
              )}

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={fecharNovoUsuario}
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvandoNovo}
                  className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#2F6BAA] transition disabled:opacity-60"
                >
                  {salvandoNovo
                    ? "Criando..."
                    : "Criar usuário"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* MODAL EDITAR USUÁRIO */}
      {mostrarEditarUsuario &&
        usuarioEditando && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  Editar usuário
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Atualize os dados e permissões globais da conta.
                </p>

              </div>

              <button
                type="button"
                onClick={fecharEditarUsuario}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={salvarEdicaoUsuario}
              className="space-y-5 mt-6"
            >

              <div>

                <label className="block text-sm font-medium mb-2">
                  Nome
                </label>

                <input
                  type="text"
                  value={nomeEditando}
                  onChange={(event) =>
                    setNomeEditando(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  E-mail
                </label>

                <input
                  type="email"
                  value={emailEditando}
                  onChange={(event) =>
                    setEmailEditando(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  Telefone
                </label>

                <input
                  type="text"
                  value={telefoneEditando}
                  onChange={(event) =>
                    setTelefoneEditando(
                      event.target.value
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  Tipo de usuário
                </label>

                <select
                  value={tipoEditando}
                  onChange={(event) =>
                    setTipoEditando(
                      event.target.value
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                >
                  <option value="MEMBRO">
                    Membro
                  </option>

                  <option value="ADMIN">
                    Administrador
                  </option>
                </select>

              </div>

              <label className="flex items-start gap-3 cursor-pointer">

                <input
                  type="checkbox"
                  checked={ativoEditando}
                  onChange={(event) =>
                    setAtivoEditando(
                      event.target.checked
                    )
                  }
                  className="mt-1"
                />

                <div>

                  <p className="font-medium text-slate-900">
                    Usuário ativo
                  </p>

                  <p className="text-sm text-slate-500">
                    Usuários inativos não devem conseguir utilizar normalmente o sistema.
                  </p>

                </div>

              </label>

              {erroEdicao && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {erroEdicao}
                </div>
              )}

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={fecharEditarUsuario}
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvandoEdicao}
                  className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#2F6BAA] transition disabled:opacity-60"
                >
                  {salvandoEdicao
                    ? "Salvando..."
                    : "Salvar alterações"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </AppLayout>
  )
}
