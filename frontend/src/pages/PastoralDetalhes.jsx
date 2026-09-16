import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import AppLayout from "../components/AppLayout"
import api from "../services/api"

import { emailValido, textoPreenchido, telefoneValido, formatarPapelPastoral, normalizarEmail }  from "../utils"
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Church,
  CircleDot,
  ListChecks,
  Pencil,
  Plus,
  Settings2,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users
} from "lucide-react"

export default function PastoralDetalhes() {
  const navigate = useNavigate()
  const { pastoralId } = useParams()

  const [pastoral, setPastoral] = useState(null)
  const [membros, setMembros] = useState([])
  const [funcoes, setFuncoes] = useState([])

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState("")

  const [mostrarNovoMembro, setMostrarNovoMembro] =
    useState(false)

  const [mostrarNovaFuncao, setMostrarNovaFuncao] =
    useState(false)

  const [usuariosDisponiveis, setUsuariosDisponiveis] =
    useState([])

  const [usuarioSelecionado, setUsuarioSelecionado] =
    useState("")

  const [papelMembro, setPapelMembro] =
    useState("MEMBRO")

  const [nomeFuncao, setNomeFuncao] = useState("")
  const [descricaoFuncao, setDescricaoFuncao] =
    useState("")

  const [salvando, setSalvando] = useState(false)

  const [erroFormulario, setErroFormulario] =
    useState("")

  const podeGerenciar =
    Boolean(pastoral?.podeGerenciar)

  const [mostrarEditarMembro, setMostrarEditarMembro] =
    useState(false)

  const [membroEditando, setMembroEditando] =
    useState(null)

  const [papelEditando, setPapelEditando] =
    useState("MEMBRO")

  const [salvandoEdicao, setSalvandoEdicao] =
    useState(false)

  const [erroEdicao, setErroEdicao] =
    useState("")

  const [mostrarEditarFuncao, setMostrarEditarFuncao] =
    useState(false)

  const [funcaoEditando, setFuncaoEditando] =
    useState(null)

  const [nomeFuncaoEditando, setNomeFuncaoEditando] =
    useState("")

  const [
    descricaoFuncaoEditando,
    setDescricaoFuncaoEditando
  ] = useState("")

  const [
    salvandoFuncaoEdicao,
    setSalvandoFuncaoEdicao
  ] = useState(false)

  const [
    erroFuncaoEdicao,
    setErroFuncaoEdicao
  ] = useState("")

  const [
    mostrarEditarPastoral,
    setMostrarEditarPastoral
  ] = useState(false)

  const [
    nomePastoralEditando,
    setNomePastoralEditando
  ] = useState("")

  const [
    descricaoPastoralEditando,
    setDescricaoPastoralEditando
  ] = useState("")

  const [
    autoEscalaEditando,
    setAutoEscalaEditando
  ] = useState(false)

  const [
    confirmacaoEditando,
    setConfirmacaoEditando
  ] = useState(false)

  const [
    ativaEditando,
    setAtivaEditando
  ] = useState(true)

  const [
    salvandoPastoral,
    setSalvandoPastoral
  ] = useState(false)

  const [
    erroPastoralEdicao,
    setErroPastoralEdicao
  ] = useState("")

  const [
    modoAdicionarMembro,
    setModoAdicionarMembro
  ] = useState("EXISTENTE")

  const [
    novoUsuarioNome,
    setNovoUsuarioNome
  ] = useState("")

  const [
    novoUsuarioEmail,
    setNovoUsuarioEmail
  ] = useState("")

  const [
    novoUsuarioTelefone,
    setNovoUsuarioTelefone
  ] = useState("")

  const [
    novoUsuarioSenha,
    setNovoUsuarioSenha
  ] = useState("")

  const usuariosNaoVinculados =
    usuariosDisponiveis.filter(
      (usuarioDisponivel) =>
        !membros.some(
          (membro) =>
            membro.usuario.id ===
            usuarioDisponivel.id
        )
    )



  function carregarUsuarios() {
    return api.get("/usuarios")
      .then((response) => setUsuariosDisponiveis(response.data))
      .catch((error) => console.error(error))
  }

  const carregarDados = useCallback(() => {
    return Promise.all([
        api.get("/pastorais"),

        api.get(
          `/pastorais/${pastoralId}/membros`
        ),

        api.get(
          `/pastorais/${pastoralId}/funcoes`
        )
      ]).then(([
        pastoraisResponse,
        membrosResponse,
        funcoesResponse
      ]) => {

      const pastoralEncontrada =
        pastoraisResponse.data.find(
          (item) =>
            item.id ===
            Number(pastoralId)
        )

      if (!pastoralEncontrada) {
        setErro(
          "Pastoral não encontrada"
        )
        return
      }

      setPastoral(
        pastoralEncontrada
      )

      setMembros(
        membrosResponse.data
      )

      setFuncoes(
        funcoesResponse.data
      )

      setErro("")
    }).catch((error) => {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao carregar dados da pastoral"
      )
    }).finally(() => {
      setCarregando(false)
    })
  }, [pastoralId])

  useEffect(() => {
    carregarDados()
    carregarUsuarios()
  }, [carregarDados])

  function limparFormularioMembro() {
    setUsuarioSelecionado("")
    setPapelMembro("MEMBRO")

    setNovoUsuarioNome("")
    setNovoUsuarioEmail("")
    setNovoUsuarioTelefone("")
    setNovoUsuarioSenha("")

    setModoAdicionarMembro(
      "EXISTENTE"
    )

    setErroFormulario("")
  }

  function fecharModalMembro() {
    limparFormularioMembro()

    setMostrarNovoMembro(
      false
    )
  }

  async function adicionarMembro(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErroFormulario("")

      let usuarioIdFinal

      if (
        modoAdicionarMembro ===
        "EXISTENTE"
      ) {
        if (!usuarioSelecionado) {
          setErroFormulario(
            "Selecione um usuário"
          )
          return
        }

        usuarioIdFinal =
          Number(
            usuarioSelecionado
          )

      } else {
        if (
          !textoPreenchido(novoUsuarioNome) ||
          !textoPreenchido(novoUsuarioEmail) ||
          !textoPreenchido(novoUsuarioSenha)
        ) {
          setErroFormulario(
            "Nome, e-mail e senha são obrigatórios"
          )
          return
        }

        if (!emailValido(novoUsuarioEmail)) {
            setErroFormulario(
                "Informe um e-mail válido"
            )
            return
        }

        if (!telefoneValido(novoUsuarioTelefone)) {
            setErroFormulario(
                "Informe um telefone válido"
            )
            return
        }        

        const usuarioResponse =
          await api.post(
            "/usuarios",
            {
              nome:
                novoUsuarioNome.trim(),

              email:
                normalizarEmail(novoUsuarioEmail),

              telefone:
                novoUsuarioTelefone.trim() ||
                null,

              senha:
                novoUsuarioSenha
            }
          )

        usuarioIdFinal =
          usuarioResponse.data.id
      }

      await api.post(
        "/membros-pastorais",
        {
          usuarioId:
            usuarioIdFinal,

          pastoralId:
            Number(pastoralId),

          papel:
            papelMembro
        }
      )

      limparFormularioMembro()

      setMostrarNovoMembro(
        false
      )

      await Promise.all([
        carregarDados(),
        carregarUsuarios()
      ])

    } catch (error) {
      setErroFormulario(
        error.response?.data?.mensagem ||
        "Erro ao adicionar membro"
      )
    } finally {
      setSalvando(false)
    }
  }

  async function criarFuncao(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErroFormulario("")
      
      if(!textoPreenchido(nomeFuncao)) {
        setErroFormulario(
            "Informe o nome da função"
        )
        return
      }

      await api.post(
        "/funcoes-pastorais",
        {
          nome: nomeFuncao.trim(),
          descricao:
            descricaoFuncao.trim() || null,
          pastoralId:
            Number(pastoralId)
        }
      )

      setNomeFuncao("")
      setDescricaoFuncao("")
      setMostrarNovaFuncao(false)

      await carregarDados()

    } catch (error) {
      setErroFormulario(
        error.response?.data?.mensagem ||
        "Erro ao criar função"
      )
    } finally {
      setSalvando(false)
    }
  }

  function abrirEditarMembro(
    membro
  ) {
    setMembroEditando(membro)

    setPapelEditando(
      membro.papel
    )

    setErroEdicao("")

    setMostrarEditarMembro(
      true
    )
  }

  async function salvarEdicaoMembro(
    event
  ) {
    event.preventDefault()

    try {
      setSalvandoEdicao(true)
      setErroEdicao("")

      await api.patch(
        `/membros-pastorais/${membroEditando.id}`,
        {
          papel:
            papelEditando
        }
      )

      setMostrarEditarMembro(
        false
      )

      setMembroEditando(null)

      await carregarDados()

    } catch (error) {
      setErroEdicao(
        error.response?.data?.mensagem ||
        "Erro ao atualizar membro"
      )
    } finally {
      setSalvandoEdicao(false)
    }
  }

  function abrirEditarFuncao(
    funcao
  ) {
    setFuncaoEditando(
      funcao
    )

    setNomeFuncaoEditando(
      funcao.nome
    )

    setDescricaoFuncaoEditando(
      funcao.descricao || ""
    )

    setErroFuncaoEdicao("")

    setMostrarEditarFuncao(
      true
    )
  }

  async function salvarEdicaoFuncao(
    event
  ) {
    event.preventDefault()

    try {
      setSalvandoFuncaoEdicao(
        true
      )

      setErroFuncaoEdicao("")

      await api.patch(
        `/funcoes-pastorais/${funcaoEditando.id}`,
        {
          nome:
            nomeFuncaoEditando,

          descricao:
            descricaoFuncaoEditando
        }
      )

      setMostrarEditarFuncao(
        false
      )

      setFuncaoEditando(null)

      await carregarDados()

    } catch (error) {
      setErroFuncaoEdicao(
        error.response?.data?.mensagem ||
        "Erro ao atualizar função"
      )
    } finally {
      setSalvandoFuncaoEdicao(
        false
      )
    }
  }

  function abrirEditarPastoral() {
    setNomePastoralEditando(
      pastoral.nome
    )

    setDescricaoPastoralEditando(
      pastoral.descricao || ""
    )

    setAutoEscalaEditando(
      Boolean(
        pastoral.permiteAutoEscala
      )
    )

    setConfirmacaoEditando(
      Boolean(
        pastoral.exigeConfirmacao
      )
    )

    setAtivaEditando(
      Boolean(
        pastoral.ativa
      )
    )

    setErroPastoralEdicao("")

    setMostrarEditarPastoral(
      true
    )
  }

  async function salvarEdicaoPastoral(
    event
  ) {
    event.preventDefault()

    try {
      setSalvandoPastoral(true)

      setErroPastoralEdicao("")

      await api.patch(
        `/pastorais/${pastoralId}`,
        {
          nome:
            nomePastoralEditando,

          descricao:
            descricaoPastoralEditando,

          permiteAutoEscala:
            autoEscalaEditando,

          exigeConfirmacao:
            confirmacaoEditando,

          ativa:
            ativaEditando
        }
      )

      setMostrarEditarPastoral(
        false
      )

      await carregarDados()

    } catch (error) {
      setErroPastoralEdicao(
        error.response?.data?.mensagem ||
        "Erro ao atualizar pastoral"
      )
    } finally {
      setSalvandoPastoral(false)
    }
  }

  if (carregando) {
    return (
      <AppLayout
        titulo="Pastoral"
        subtitulo="Carregando informações..."
      >
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Church size={18} />
            </div>
            <p>Carregando pastoral...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      titulo={pastoral?.nome || "Pastoral"}
      subtitulo={pastoral?.descricao}
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate("/pastorais")}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition w-fit"
          >
            <ArrowLeft size={17} />
            Voltar para pastorais
          </button>

          {podeGerenciar && (
            <button
              type="button"
              onClick={abrirEditarPastoral}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50 transition"
            >
              <Settings2 size={16} />
              Editar pastoral
            </button>
          )}
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
            {erro}
          </div>
        )}

        {!erro && (
          <>
            <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className={`h-1.5 ${pastoral?.ativa ? "bg-emerald-500" : "bg-slate-300"}`} />

              <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Church size={22} />
                      </div>

                      <div className="min-w-0">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 break-words">
                          {pastoral?.nome}
                        </h2>

                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${pastoral?.ativa ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                            {pastoral?.ativa ? <CheckCircle2 size={12} /> : <CircleDot size={12} />}
                            {pastoral?.ativa ? "Ativa" : "Inativa"}
                          </span>

                          {podeGerenciar && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                              <ShieldCheck size={12} />
                              Coordenação
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {pastoral?.descricao && (
                      <p className="text-sm text-slate-500 leading-relaxed mt-4 max-w-2xl">
                        {pastoral.descricao}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
                    <div className="bg-slate-50 rounded-xl px-3 py-3 text-center min-w-0">
                      <Users size={16} className="mx-auto text-slate-500" />
                      <p className="text-lg font-bold text-slate-900 mt-1">{membros.length}</p>
                      <p className="text-[11px] text-slate-400">Membros</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl px-3 py-3 text-center min-w-0">
                      <ListChecks size={16} className="mx-auto text-slate-500" />
                      <p className="text-lg font-bold text-slate-900 mt-1">{funcoes.length}</p>
                      <p className="text-[11px] text-slate-400">Funções</p>
                    </div>

                    <div className="bg-slate-50 rounded-xl px-3 py-3 text-center min-w-0">
                      <BadgeCheck size={16} className={pastoral?.ativa ? "mx-auto text-emerald-600" : "mx-auto text-slate-400"} />
                      <p className={`text-sm font-bold mt-2 ${pastoral?.ativa ? "text-emerald-700" : "text-slate-500"}`}>
                        {pastoral?.ativa ? "Ativa" : "Inativa"}
                      </p>
                      <p className="text-[11px] text-slate-400">Status</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg text-slate-900">Membros</h2>
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{membros.length}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Pessoas que participam desta pastoral.</p>
                  </div>

                  {podeGerenciar && (
                    <button
                      type="button"
                      onClick={() => { limparFormularioMembro(); setMostrarNovoMembro(true) }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#3B7EC7] text-white px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2F6BAA] transition"
                    >
                      <UserPlus size={16} />
                      Adicionar membro
                    </button>
                  )}
                </div>

                <div className="p-3 sm:p-4 space-y-2">
                  {membros.length === 0 && (
                    <div className="border border-dashed border-slate-200 rounded-xl p-5 text-center">
                      <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                        <Users size={18} />
                      </div>
                      <p className="text-sm text-slate-500 mt-3">Nenhum membro cadastrado.</p>
                    </div>
                  )}

                  {membros.map((membro) => (
                    <div key={membro.id} className="bg-slate-50 rounded-xl p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${membro.papel === "COORDENADOR" ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-600"}`}>
                          {membro.papel === "COORDENADOR" ? <ShieldCheck size={17} /> : <UserRound size={17} />}
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 break-words">{membro.usuario.nome}</p>
                          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 break-all">{membro.usuario.email}</p>
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-1.5 px-2 py-1 rounded-full ${membro.papel === "COORDENADOR" ? "bg-blue-50 text-blue-700" : "bg-white text-slate-600"}`}>
                            {formatarPapelPastoral(membro.papel)}
                          </span>
                        </div>
                      </div>

                      {podeGerenciar && (
                        <button
                          type="button"
                          onClick={() => abrirEditarMembro(membro)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 border border-slate-200 bg-white text-slate-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
                        >
                          <Pencil size={13} />
                          Editar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg text-slate-900">Funções</h2>
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{funcoes.length}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Funções disponíveis nas escalas desta pastoral.</p>
                  </div>

                  {podeGerenciar && (
                    <button
                      type="button"
                      onClick={() => { setErroFormulario(""); setMostrarNovaFuncao(true) }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#3B7EC7] text-white px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2F6BAA] transition"
                    >
                      <Plus size={16} />
                      Nova função
                    </button>
                  )}
                </div>

                <div className="p-3 sm:p-4 space-y-2">
                  {funcoes.length === 0 && (
                    <div className="border border-dashed border-slate-200 rounded-xl p-5 text-center">
                      <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                        <ListChecks size={18} />
                      </div>
                      <p className="text-sm text-slate-500 mt-3">Nenhuma função cadastrada.</p>
                    </div>
                  )}

                  {funcoes.map((funcao) => (
                    <div key={funcao.id} className="bg-slate-50 rounded-xl p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                          <ListChecks size={17} />
                        </div>

                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 break-words">{funcao.nome}</p>
                          {funcao.descricao && (
                            <p className="text-sm text-slate-500 mt-1 leading-relaxed break-words">{funcao.descricao}</p>
                          )}
                        </div>
                      </div>

                      {podeGerenciar && (
                        <button
                          type="button"
                          onClick={() => abrirEditarFuncao(funcao)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 border border-slate-200 bg-white text-slate-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 transition"
                        >
                          <Pencil size={13} />
                          Editar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>

      {/* MODAL NOVO MEMBRO */}
      {mostrarNovoMembro && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  Adicionar membro
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Adicione um usuário existente ou crie uma nova conta.
                </p>

              </div>

              <button
                type="button"
                onClick={
                  fecharModalMembro
                }
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                adicionarMembro
              }
              className="space-y-5 mt-6"
            >

              <div>

                <label className="block text-sm font-medium mb-2">
                  Como deseja adicionar?
                </label>

                <div className="grid grid-cols-2 gap-3">

                  <button
                    type="button"
                    onClick={() => {
                      setModoAdicionarMembro(
                        "EXISTENTE"
                      )

                      setErroFormulario(
                        ""
                      )
                    }}
                    className={`border rounded-lg px-4 py-3 text-sm font-medium ${
                      modoAdicionarMembro ===
                      "EXISTENTE"
                        ? "border-[#3B7EC7] bg-[#3B7EC7] text-white"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    Usuário existente
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModoAdicionarMembro(
                        "NOVO"
                      )

                      setErroFormulario(
                        ""
                      )
                    }}
                    className={`border rounded-lg px-4 py-3 text-sm font-medium ${
                      modoAdicionarMembro ===
                      "NOVO"
                        ? "border-[#3B7EC7] bg-[#3B7EC7] text-white"
                        : "border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    Novo usuário
                  </button>

                </div>

              </div>

              {modoAdicionarMembro ===
                "EXISTENTE" && (

                <div>

                  <label className="block text-sm font-medium mb-2">
                    Usuário
                  </label>

                  <select
                    value={
                      usuarioSelecionado
                    }
                    onChange={(event) =>
                      setUsuarioSelecionado(
                        event.target.value
                      )
                    }
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  >
                    <option value="">
                      Selecione
                    </option>

                    {usuariosNaoVinculados.map(
                      (item) => (
                        <option
                          key={
                            item.id
                          }
                          value={
                            item.id
                          }
                        >
                          {item.nome} - {item.email}
                        </option>
                      )
                    )}

                  </select>

                  {usuariosNaoVinculados.length ===
                    0 && (
                    <p className="text-sm text-slate-500 mt-2">
                      Todos os usuários cadastrados já pertencem a esta pastoral.
                    </p>
                  )}

                </div>
              )}

              {modoAdicionarMembro ===
                "NOVO" && (

                <div className="space-y-4">

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Nome
                    </label>

                    <input
                      type="text"
                      value={
                        novoUsuarioNome
                      }
                      onChange={(event) =>
                        setNovoUsuarioNome(
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
                      value={
                        novoUsuarioEmail
                      }
                      onChange={(event) =>
                        setNovoUsuarioEmail(
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
                      value={
                        novoUsuarioTelefone
                      }
                      onChange={(event) =>
                        setNovoUsuarioTelefone(
                          event.target.value
                        )
                      }
                      className="w-full border border-slate-300 rounded-lg px-4 py-3"
                      placeholder="(83) 99999-9999"
                    />

                  </div>

                  <div>

                    <label className="block text-sm font-medium mb-2">
                      Senha provisória
                    </label>

                    <input
                      type="password"
                      value={
                        novoUsuarioSenha
                      }
                      onChange={(event) =>
                        setNovoUsuarioSenha(
                          event.target.value
                        )
                      }
                      required
                      className="w-full border border-slate-300 rounded-lg px-4 py-3"
                      placeholder="Senha inicial"
                    />

                    <p className="text-xs text-slate-500 mt-2">
                      O usuário poderá usar esta senha para acessar o sistema.
                    </p>

                  </div>

                </div>
              )}

              <div>

                <label className="block text-sm font-medium mb-2">
                  Papel na pastoral
                </label>

                <select
                  value={
                    papelMembro
                  }
                  onChange={(event) =>
                    setPapelMembro(
                      event.target.value
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                >
                  <option value="MEMBRO">
                    Membro
                  </option>

                  <option value="COORDENADOR">
                    Coordenador
                  </option>
                </select>

              </div>

              {erroFormulario && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                  {erroFormulario}
                </div>
              )}

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={
                    fecharModalMembro
                  }
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvando ||
                    (
                      modoAdicionarMembro ===
                        "EXISTENTE" &&
                      !usuarioSelecionado
                    )
                  }
                  className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#2F6BAA] transition disabled:opacity-60"
                >
                  {salvando
                    ? "Salvando..."
                    : modoAdicionarMembro ===
                      "NOVO"
                    ? "Criar e adicionar"
                    : "Adicionar"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* MODAL NOVA FUNÇÃO */}
      {mostrarNovaFuncao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg bg-white rounded-2xl p-6">

            <div className="flex items-center justify-between">

              <h2 className="text-xl font-bold text-slate-900">
                Nova função
              </h2>

              <button
                type="button"
                onClick={() =>
                  setMostrarNovaFuncao(
                    false
                  )
                }
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                criarFuncao
              }
              className="space-y-5 mt-6"
            >

              <div>

                <label className="block text-sm font-medium mb-2">
                  Nome
                </label>

                <input
                  value={
                    nomeFuncao
                  }
                  onChange={(event) =>
                    setNomeFuncao(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="Ex.: Transmissão"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  Descrição
                </label>

                <textarea
                  value={
                    descricaoFuncao
                  }
                  onChange={(event) =>
                    setDescricaoFuncao(
                      event.target.value
                    )
                  }
                  rows={4}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="Descrição da função"
                />

              </div>

              {erroFormulario && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                  {erroFormulario}
                </div>
              )}

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setMostrarNovaFuncao(
                      false
                    )
                  }
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvando
                  }
                  className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#2F6BAA] transition disabled:opacity-60"
                >
                  {salvando
                    ? "Salvando..."
                    : "Cadastrar"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* MODAL EDITAR MEMBRO */}
      {mostrarEditarMembro &&
        membroEditando && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-md bg-white rounded-2xl p-6">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  Editar membro
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {
                    membroEditando.usuario.nome
                  }
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarEditarMembro(
                    false
                  )
                }
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                salvarEdicaoMembro
              }
              className="space-y-5 mt-6"
            >

              <div>

                <label className="block text-sm font-medium mb-2">
                  Papel na pastoral
                </label>

                <select
                  value={
                    papelEditando
                  }
                  onChange={(event) =>
                    setPapelEditando(
                      event.target.value
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                >
                  <option value="MEMBRO">
                    Membro
                  </option>

                  <option value="COORDENADOR">
                    Coordenador
                  </option>
                </select>

              </div>

              {erroEdicao && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                  {erroEdicao}
                </div>
              )}

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setMostrarEditarMembro(
                      false
                    )
                  }
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvandoEdicao
                  }
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

      {/* MODAL EDITAR FUNÇÃO */}
      {mostrarEditarFuncao &&
        funcaoEditando && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-md bg-white rounded-2xl p-6">

            <div className="flex items-center justify-between">

              <h2 className="text-xl font-bold text-slate-900">
                Editar função
              </h2>

              <button
                type="button"
                onClick={() =>
                  setMostrarEditarFuncao(
                    false
                  )
                }
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                salvarEdicaoFuncao
              }
              className="space-y-5 mt-6"
            >

              <div>

                <label className="block text-sm font-medium mb-2">
                  Nome
                </label>

                <input
                  value={
                    nomeFuncaoEditando
                  }
                  onChange={(event) =>
                    setNomeFuncaoEditando(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  Descrição
                </label>

                <textarea
                  value={
                    descricaoFuncaoEditando
                  }
                  onChange={(event) =>
                    setDescricaoFuncaoEditando(
                      event.target.value
                    )
                  }
                  rows={4}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                />

              </div>

              {erroFuncaoEdicao && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                  {erroFuncaoEdicao}
                </div>
              )}

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setMostrarEditarFuncao(
                      false
                    )
                  }
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvandoFuncaoEdicao
                  }
                  className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#2F6BAA] transition disabled:opacity-60"
                >
                  {salvandoFuncaoEdicao
                    ? "Salvando..."
                    : "Salvar alterações"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* MODAL EDITAR PASTORAL */}
      {mostrarEditarPastoral && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg bg-white rounded-2xl p-6">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  Editar pastoral
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Configurações gerais da pastoral.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setMostrarEditarPastoral(
                    false
                  )
                }
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                salvarEdicaoPastoral
              }
              className="space-y-5 mt-6"
            >

              <div>

                <label className="block text-sm font-medium mb-2">
                  Nome
                </label>

                <input
                  value={
                    nomePastoralEditando
                  }
                  onChange={(event) =>
                    setNomePastoralEditando(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                />

              </div>

              <div>

                <label className="block text-sm font-medium mb-2">
                  Descrição
                </label>

                <textarea
                  value={
                    descricaoPastoralEditando
                  }
                  onChange={(event) =>
                    setDescricaoPastoralEditando(
                      event.target.value
                    )
                  }
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                />

              </div>

              <label className="flex items-start gap-3 cursor-pointer">

                <input
                  type="checkbox"
                  checked={
                    autoEscalaEditando
                  }
                  onChange={(event) =>
                    setAutoEscalaEditando(
                      event.target.checked
                    )
                  }
                  className="mt-1"
                />

                <div>

                  <p className="font-medium text-slate-900">
                    Permitir autoescala
                  </p>

                  <p className="text-sm text-slate-500">
                    Os membros poderão escolher vagas em escalas abertas.
                  </p>

                </div>

              </label>

              <label className="flex items-start gap-3 cursor-pointer">

                <input
                  type="checkbox"
                  checked={
                    confirmacaoEditando
                  }
                  onChange={(event) =>
                    setConfirmacaoEditando(
                      event.target.checked
                    )
                  }
                  className="mt-1"
                />

                <div>

                  <p className="font-medium text-slate-900">
                    Exigir confirmação
                  </p>

                  <p className="text-sm text-slate-500">
                    Membros adicionados pela coordenação precisarão confirmar ou recusar.
                  </p>

                </div>

              </label>

              <label className="flex items-start gap-3 cursor-pointer">

                <input
                  type="checkbox"
                  checked={
                    ativaEditando
                  }
                  onChange={(event) =>
                    setAtivaEditando(
                      event.target.checked
                    )
                  }
                  className="mt-1"
                />

                <div>

                  <p className="font-medium text-slate-900">
                    Pastoral ativa
                  </p>

                  <p className="text-sm text-slate-500">
                    Pastorais inativas não devem participar de novas escalas.
                  </p>

                </div>

              </label>

              {erroPastoralEdicao && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                  {erroPastoralEdicao}
                </div>
              )}

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setMostrarEditarPastoral(
                      false
                    )
                  }
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvandoPastoral
                  }
                  className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#2F6BAA] transition disabled:opacity-60"
                >
                  {salvandoPastoral
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