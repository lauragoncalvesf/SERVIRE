import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuth } from "../contexts/auth"
import { formatarData, statusItemAtivo, escalaEditavel, numeroInteiroPositivo} from "../utils"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock3,
  ListPlus,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserPlus,
  UserRound,
  Users
} from "lucide-react"


export default function EventoEscalas() {
  const { eventoId } = useParams()
  const navigate = useNavigate()
  const { usuario } = useAuth()

  const [evento, setEvento] = useState(null)
  const [escalas, setEscalas] = useState([])
  const [pastorais, setPastorais] = useState([])

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState("")

  const [mostrarNovaEscala, setMostrarNovaEscala] = useState(false)
  const [pastoralSelecionada, setPastoralSelecionada] = useState("")
  const [observacao, setObservacao] = useState("")

  const [salvando, setSalvando] = useState(false)
  const [erroFormulario, setErroFormulario] = useState("")

  const [mostrarAdicionarMembro, setMostrarAdicionarMembro] = useState(false)
  
  const [escalaSelecionada, setEscalaSelecionada] = useState(null)
  const [funcoesDisponiveis, setFuncoesDisponiveis] = useState([])
  const [membrosDisponiveis, setMembrosDisponiveis] = useState([])
  const [funcaoSelecionada, setFuncaoSelecionada] = useState("")
  const [membroSelecionado, setMembroSelecionado] = useState("")
  const [salvandoItem, setSalvandoItem] = useState(false)
  const [erroItem, setErroItem] = useState("")
  
  const [funcoesPastoral, setFuncoesPastoral] = useState([])
  const [funcoesSelecionadas, setFuncoesSelecionadas] = useState([])
 
  const [mostrarEditarFuncaoEscala, setMostrarEditarFuncaoEscala] = useState(false)
  const [funcaoEscalaEditando, setFuncaoEscalaEditando] = useState(null)
  const [quantidadeVagasEditando, setQuantidadeVagasEditando] = useState(1)
  const [salvandoFuncaoEscala, setSalvandoFuncaoEscala] = useState(false)
  const [erroFuncaoEscala, setErroFuncaoEscala] = useState("")

  const [mostrarAdicionarFuncaoEscala, setMostrarAdicionarFuncaoEscala] = useState(false)
  const [escalaAdicionandoFuncao, setEscalaAdicionandoFuncao] = useState(null)

  const [funcoesParaAdicionar, setFuncoesParaAdicionar] = useState([])
  const [novaFuncaoEscalaId, setNovaFuncaoEscalaId] = useState("")
  const [novaQuantidadeVagas, setNovaQuantidadeVagas] = useState(1)

  const [salvandoNovaFuncaoEscala, setSalvandoNovaFuncaoEscala] = useState(false)
  const [erroNovaFuncaoEscala, setErroNovaFuncaoEscala] = useState("")

  const [mostrarSubstituirMembro, setMostrarSubstituirMembro] = useState(false)
  const [itemSubstituindo, setItemSubstituindo] = useState(null)
  const [escalaSubstituindo, setEscalaSubstituindo] = useState(null)

  const [membrosSubstituicao, setMembrosSubstituicao] = useState([])
  const [novoMembroId, setNovoMembroId] = useState("")

  const [salvandoSubstituicao, setSalvandoSubstituicao] = useState(false)
  const [erroSubstituicao, setErroSubstituicao] = useState("")

  const pastoraisGerenciaveis =
    pastorais.filter(
      (pastoral) =>
        pastoral.podeGerenciar
    )

  const podeCriarEscala =
    pastoraisGerenciaveis.length > 0



  async function carregarFuncoesPastoral(pastoralId) {
    try {
        setFuncoesPastoral([])
        setFuncoesSelecionadas([])
        setErroFormulario("")

        if (!pastoralId) {
        return
        }

        const response = await api.get(
        `/pastorais/${pastoralId}/funcoes`
        )

        setFuncoesPastoral(response.data)

    } catch (error) {
        setErroFormulario(
        error.response?.data?.mensagem ||
        "Erro ao carregar funções da pastoral"
        )
    }
    }

    function alternarFuncao(funcaoId) {
    setFuncoesSelecionadas((anteriores) => {
        const jaSelecionada = anteriores.some(
        (item) =>
            item.funcaoPastoralId === funcaoId
        )

        if (jaSelecionada) {
        return anteriores.filter(
            (item) =>
            item.funcaoPastoralId !== funcaoId
        )
        }

        return [
        ...anteriores,
        {
            funcaoPastoralId: funcaoId,
            quantidadeVagas: 1
        }
        ]
    })
    }

    function alterarQuantidadeFuncao(funcaoId, quantidade) {
    setFuncoesSelecionadas((anteriores) =>
        anteriores.map((item) =>
        item.funcaoPastoralId === funcaoId
            ? {
                ...item,
                quantidadeVagas: Number(quantidade)
            }
            : item
        )
    )
    }

  const carregarDados = useCallback(() => {
    return Promise.all([
        api.get(`/eventos/${eventoId}/escalas`),
        api.get("/pastorais")
      ]).then(([
        escalasResponse,
        pastoraisResponse
      ]) => {

      setEvento(escalasResponse.data.evento)
      setEscalas(escalasResponse.data.escalas)
      setPastorais(pastoraisResponse.data)

      setErro("")
    }).catch((error) => {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao carregar evento"
      )
    }).finally(() => {
      setCarregando(false)
    })
  }, [eventoId])

  useEffect(() => {
    if (!eventoId) {
      return
    }

    carregarDados()

    function atualizarAoVoltarParaPagina() {
      if (
        document.visibilityState === "visible"
      ) {
        carregarDados()
      }
    }

    function atualizarAoFocar() {
      carregarDados()
    }

    document.addEventListener(
      "visibilitychange",
      atualizarAoVoltarParaPagina
    )

    window.addEventListener(
      "focus",
      atualizarAoFocar
    )

    const intervalo = setInterval(() => {
      carregarDados()
    }, 30000)

    return () => {
      document.removeEventListener(
        "visibilitychange",
        atualizarAoVoltarParaPagina
      )

      window.removeEventListener(
        "focus",
        atualizarAoFocar
      )

      clearInterval(intervalo)
    }
  }, [eventoId, carregarDados])

  async function criarEscala(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErroFormulario("")

      if (!pastoralSelecionada) {
        setErroFormulario("Selecione uma pastoral")
        return
      }

      if(funcoesSelecionadas.length === 0) {
        setErroFormulario("Selecione pelo menos uma função")
        return
      }

      const quantidadeInvalida = funcoesSelecionadas.some(
        (funcao) =>
            !numeroInteiroPositivo(funcao.quantidadeVagas) 
      )

      if (quantidadeInvalida) {
        setErroFormulario("Todas as funções devem possuir pelo menos 1 vaga")
        return
      }

      await api.post("/escalas", {
        eventoId: Number(eventoId),
        pastoralId: Number(pastoralSelecionada),
        observacao,
        funcoes: funcoesSelecionadas
      })

      setPastoralSelecionada("")
      setObservacao("")
      setFuncoesPastoral([])
      setFuncoesSelecionadas([])
      setMostrarNovaEscala(false)

      await carregarDados()

    } catch (error) {
      setErroFormulario(
        error.response?.data?.mensagem ||
        "Erro ao criar escala"
      )
    } finally {
      setSalvando(false)
    }
  }

  async function abrirAdicionarMembro(escala) {
    try {
        setErroItem("")
        setEscalaSelecionada(escala)

        const membrosResponse = await api.get(
        `/pastorais/${escala.pastoral.id}/membros`
        )

        const funcoesDaEscala =
        escala.funcoes?.filter((funcaoEscala) => {
            const ocupadas =
            funcaoEscala.itens?.filter(
                (item) => 
                statusItemAtivo(item.status)
            ).length || 0

            return ocupadas < funcaoEscala.quantidadeVagas
        }) || []

        setFuncoesDisponiveis(funcoesDaEscala)
        setMembrosDisponiveis(membrosResponse.data)

        setFuncaoSelecionada("")
        setMembroSelecionado("")

        setMostrarAdicionarMembro(true)
    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao carregar membros e funções"
      )    
    }
  }
  
  async function adicionarMembroEscala(event) {
    event.preventDefault()
    
    try {
      setSalvandoItem(true)
        setErroItem("")
        await api.post(
          `/escalas/${escalaSelecionada.id}/itens`,
          {
            funcaoEscalaId: Number(funcaoSelecionada),
            usuarioId: Number(membroSelecionado)
          }
        )

        setMostrarAdicionarMembro(false)
        setEscalaSelecionada(null)
        setFuncaoSelecionada("")
        setMembroSelecionado("")
        
        await carregarDados()

    } catch (error) {
      console.log("ERRO AO ADICIONAR:", error.response?.data)

      setErroItem(
        error.response?.data?.mensagem ||
        "Erro ao adicionar membro à escala"
      )
      } finally {
        setSalvandoItem(false)
      }
  }

  async function alterarStatusEscala(escalaId, status) {
    try {
      setErro("")

      await api.patch(
        `/escalas/${escalaId}/status`,
        {
          status
        }
      )
      
      await carregarDados()

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao atualizar status da escala"
      )
    }
  }

  async function meEscalar(escalaId, funcaoEscalaId) {
    try {
      setErro("")
      
      await api.post(
        `/escalas/${escalaId}/autoescalar`,
        {
          funcaoEscalaId
        }
    )

    await carregarDados()

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao realizar autoescala"
      )
      }
  }
  
  function abrirEditarFuncaoEscala(funcaoEscala) {
    setFuncaoEscalaEditando(funcaoEscala)
    setQuantidadeVagasEditando(funcaoEscala.quantidadeVagas)
    setErroFuncaoEscala("")
    setMostrarEditarFuncaoEscala(true)
  }

  async function salvarEdicaoFuncaoEscala(event) {
    event.preventDefault()

    try {
      setSalvandoFuncaoEscala(true)
      setErroFuncaoEscala("")

      await api.patch(
        `/funcoes-escala/${funcaoEscalaEditando.id}`,
        {
          quantidadeVagas: Number(quantidadeVagasEditando)
        }
      )

      setMostrarEditarFuncaoEscala(false)
      setFuncaoEscalaEditando(null)

      await carregarDados()

    } catch (error) {
      setErroFuncaoEscala(
        error.response?.data?.mensagem ||
        "Erro ao atualizar quantidade de vagas"
      )
      } finally {
        setSalvandoFuncaoEscala(false)
      }
  }

  async function abrirAdicionarFuncaoEscala(escala) {
    try {
      setErroNovaFuncaoEscala("")
      setEscalaAdicionandoFuncao(escala)

      const response = await api.get(
        `/pastorais/${escala.pastoral.id}/funcoes`
      )

      const idsJaUsados =
        escala.funcoes?.map(
          (funcaoEscala) =>
            funcaoEscala.funcaoPastoral.id
        ) || []

      const disponiveis = response.data.filter(
        (funcao) =>
          !idsJaUsados.includes(funcao.id)
      )

      setFuncoesParaAdicionar(disponiveis)
      setNovaFuncaoEscalaId("")
      setNovaQuantidadeVagas(1)

      setMostrarAdicionarFuncaoEscala(true)

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao carregar funções disponíveis"
      )
    }
  }

  async function adicionarNovaFuncaoEscala(event) {
    event.preventDefault()

    try {
      setSalvandoNovaFuncaoEscala(true)
      setErroNovaFuncaoEscala("")

      await api.post(
        `/escalas/${escalaAdicionandoFuncao.id}/funcoes`,
        {
          funcaoPastoralId: Number(novaFuncaoEscalaId),
          quantidadeVagas: Number(novaQuantidadeVagas)
        }
      )

      setMostrarAdicionarFuncaoEscala(false)
      setEscalaAdicionandoFuncao(null)
      setNovaFuncaoEscalaId("")
      setNovaQuantidadeVagas(1)

      await carregarDados()

    } catch (error) {
      setErroNovaFuncaoEscala(
        error.response?.data?.mensagem ||
        "Erro ao adicionar função à escala"
      )
    } finally {
      setSalvandoNovaFuncaoEscala(false)
    }
  }

  async function removerFuncaoEscala(funcaoEscala) {
    const confirmar = window.confirm(
      `Deseja remover a função "${funcaoEscala.funcaoPastoral.nome}" desta escala?`
    )

    if (!confirmar) {
      return
    }

    try {
      setErro("")

      await api.delete(
        `/funcoes-escala/${funcaoEscala.id}`
      )

      await carregarDados()

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao remover função da escala"
      )
    }
  }

  async function abrirSubstituirMembro(item, escala) {
  try {
    setErroSubstituicao("")
    setItemSubstituindo(item)
    setEscalaSubstituindo(escala)
    setNovoMembroId("")

    const response = await api.get(
      `/pastorais/${escala.pastoral.id}/membros`
    )

    const membros = response.data.filter(
      (membro) =>
        membro.ativo !== false &&
        membro.usuario.id !== item.usuario.id
    )

    setMembrosSubstituicao(membros)
    setMostrarSubstituirMembro(true)

  } catch (error) {
    setErro(
      error.response?.data?.mensagem ||
      "Erro ao carregar membros da pastoral"
    )
  }
}

async function substituirMembro(event) {
  event.preventDefault()

  try {
    setSalvandoSubstituicao(true)
    setErroSubstituicao("")

    await api.post(
      `/escalas/itens/${itemSubstituindo.id}/substituir`,
      {
        novoUsuarioId: Number(novoMembroId)
      }
    )

    setMostrarSubstituirMembro(false)
    setItemSubstituindo(null)
    setEscalaSubstituindo(null)
    setNovoMembroId("")

    await carregarDados()

  } catch (error) {
    setErroSubstituicao(
      error.response?.data?.mensagem ||
      "Erro ao substituir membro"
    )
  } finally {
    setSalvandoSubstituicao(false)
  }
}

async function removerMembroEscala(item) {
  const confirmar = window.confirm(
    `Deseja remover ${item.usuario.nome} desta escala?`
  )

  if (!confirmar) {
    return
  }

  try {
    setErro("")

    await api.delete(
      `/escalas/itens/${item.id}`
    )

    await carregarDados()

  } catch (error) {
    setErro(
      error.response?.data?.mensagem ||
      "Erro ao remover membro da escala"
    )
  }
}

const jaEstouEscaladoNoEvento = escalas.some(
  (escalaItem) =>
    escalaItem.funcoes?.some(
      (funcaoEscala) =>
        funcaoEscala.itens?.some(
          (item) =>
            item.usuario?.id === usuario?.id && statusItemAtivo(item.status)
        )
    )
)

  return (
    <AppLayout
      titulo={evento?.titulo || "Evento"}
      subtitulo={
        evento
          ? `${formatarData(evento.dataHora)}${evento.local ? ` • ${evento.local}` : ""}`
          : "Carregando evento..."
      }
    >

      <button
        type="button"
        onClick={() => navigate("/eventos")}
        className="
          mb-5
          inline-flex
          items-center
          gap-2
          text-sm
          font-medium
          text-slate-500
          hover:text-slate-900
          transition
        "
      >
        <ArrowLeft size={17} />
        Voltar para eventos
      </button>

      {carregando && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <Clock3 size={17} />
            </div>
            <p>Carregando escalas do evento...</p>
          </div>
        </div>
      )}

      {erro && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          {erro}
        </div>
      )}

      {!carregando && !erro && (
        <div className="space-y-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Escalas do evento
                </h2>

                {escalas.length > 0 && (
                  <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    {escalas.length}
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-500 mt-1">
                Acompanhe as pastorais, funções e pessoas escaladas.
              </p>
            </div>

            {podeCriarEscala && (
              <button
                type="button"
                onClick={() => {
                  setErroFormulario("")
                  setMostrarNovaEscala(true)
                }}
                className="
                  w-full 
                  sm:w-auto
                  inline-flex 
                  items-center justify-center gap-2
                  bg-[#3B7EC7] 
                  text-white
                  px-4 py-2.5
                  rounded-xl
                  text-sm font-semibold
                  hover:bg-[#2F6BAA]
                  transition
                "
              >
                <Plus size={17} />
                Nova escala
              </button>
            )}
          </div>

          {escalas.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 text-center shadow-sm">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center">
                <Users size={22} />
              </div>

              <h3 className="font-bold text-slate-900 mt-4">
                Nenhuma escala criada
              </h3>

              <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
                Quando uma pastoral tiver uma escala neste evento, ela aparecerá aqui.
              </p>

              {podeCriarEscala && (
                <button
                  type="button"
                  onClick={() => {
                    setErroFormulario("")
                    setMostrarNovaEscala(true)
                  }}
                  className="mt-5 inline-flex items-center justify-center gap-2 bg-[#3B7EC7] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2F6BAA]"
                >
                  <Plus size={16} />
                  Criar primeira escala
                </button>
              )}
            </div>
          )}

          {escalas.length > 0 && (
            <div className="space-y-5">
              {escalas.map((escala) => {
                const totalVagas =
                  escala.funcoes?.reduce(
                    (total, funcao) =>
                      total + Number(funcao.quantidadeVagas || 0),
                    0
                  ) || 0

                const itensAtivos =
                  escala.funcoes?.flatMap(
                    (funcao) =>
                      funcao.itens?.filter(
                        (item) => statusItemAtivo(item.status)
                      ) || []
                  ) || []

                const totalPreenchidas = itensAtivos.length
                const totalConfirmados = itensAtivos.filter(
                  (item) => item.status === "CONFIRMADO"
                ).length
                const totalPendentes = itensAtivos.filter(
                  (item) => item.status === "PENDENTE"
                ).length

                const percentual =
                  totalVagas > 0
                    ? Math.min(
                        100,
                        Math.round((totalPreenchidas / totalVagas) * 100)
                      )
                    : 0

                return (
                  <section
                    key={escala.id}
                    className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
                  >
                    <div
                      className={`
                        h-1.5
                        ${
                          escala.status === "COMPLETA"
                            ? "bg-emerald-500"
                            : escala.status === "PREENCHIDA"
                            ? "bg-amber-400"
                            : escala.status === "ABERTA"
                            ? "bg-blue-500"
                            : escala.status === "CANCELADA"
                            ? "bg-red-500"
                            : "bg-slate-300"
                        }
                      `}
                    />

                    <div className="p-4 sm:p-5 border-b border-slate-100">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                              {escala.pastoral.nome}
                            </h3>

                            <span
                              className={`
                                inline-flex items-center gap-1.5
                                text-xs font-semibold
                                px-2.5 py-1 rounded-full
                                ${
                                  escala.status === "ABERTA"
                                    ? "bg-blue-50 text-blue-700"
                                    : escala.status === "PREENCHIDA"
                                    ? "bg-amber-50 text-amber-700"
                                    : escala.status === "COMPLETA"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : escala.status === "CANCELADA"
                                    ? "bg-red-50 text-red-700"
                                    : escala.status === "ENCERRADA"
                                    ? "bg-slate-200 text-slate-700"
                                    : "bg-slate-100 text-slate-700"
                                }
                              `}
                            >
                              {escala.status === "COMPLETA" ? (
                                <CheckCircle2 size={13} />
                              ) : escala.status === "PREENCHIDA" ? (
                                <Clock3 size={13} />
                              ) : (
                                <CircleDot size={13} />
                              )}
                              {escala.status}
                            </span>
                          </div>

                          {escala.observacao && (
                            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                              {escala.observacao}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
                          <div className="bg-slate-50 rounded-xl px-3 py-2 text-center min-w-0">
                            <p className="text-[11px] text-slate-400 font-medium">
                              Funções
                            </p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">
                              {escala.funcoes?.length || 0}
                            </p>
                          </div>

                          <div className="bg-slate-50 rounded-xl px-3 py-2 text-center min-w-0">
                            <p className="text-[11px] text-slate-400 font-medium">
                              Vagas
                            </p>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">
                              {totalPreenchidas}/{totalVagas}
                            </p>
                          </div>

                          <div className="bg-emerald-50 rounded-xl px-3 py-2 text-center min-w-0">
                            <p className="text-[11px] text-emerald-600 font-medium">
                              Confirmados
                            </p>
                            <p className="text-sm font-bold text-emerald-700 mt-0.5">
                              {totalConfirmados}
                            </p>
                          </div>
                        </div>
                      </div>

                      {totalVagas > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-3 mb-1.5">
                            <p className="text-xs font-medium text-slate-500">
                              Preenchimento da escala
                            </p>
                            <p className="text-xs font-semibold text-slate-600">
                              {percentual}%
                            </p>
                          </div>

                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                percentual >= 100
                                  ? "bg-emerald-500"
                                  : "bg-blue-500"
                              }`}
                              style={{ width: `${percentual}%` }}
                            />
                          </div>

                          {totalPendentes > 0 && (
                            <p className="text-xs text-amber-700 mt-2">
                              {totalPendentes} confirmação(ões) pendente(s)
                            </p>
                          )}
                        </div>
                      )}

                      {escala.podeGerenciar && escalaEditavel(escala.status) && (
                        <details className="group mt-4 border border-slate-200 rounded-xl overflow-hidden">
                          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                            <span>Ações da coordenação</span>
                            <ChevronDown
                              size={17}
                              className="text-slate-400 transition-transform group-open:rotate-180"
                            />
                          </summary>

                          <div className="border-t border-slate-100 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() => abrirAdicionarMembro(escala)}
                              className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50"
                            >
                              <UserPlus size={16} />
                              Adicionar membro
                            </button>

                            <button
                              type="button"
                              onClick={() => abrirAdicionarFuncaoEscala(escala)}
                              className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white text-slate-700 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-50"
                            >
                              <ListPlus size={16} />
                              Adicionar função
                            </button>

                            {escala.status === "RASCUNHO" && (
                              <button
                                type="button"
                                onClick={() =>
                                  alterarStatusEscala(escala.id, "ABERTA")
                                }
                                className="inline-flex items-center justify-center gap-2 bg-[#3B7EC7] text-white px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2F6BAA]"
                              >
                                <Send size={16} />
                                Disponibilizar
                              </button>
                            )}
                          </div>
                        </details>
                      )}
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                      {!escala.funcoes || escala.funcoes.length === 0 ? (
                        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-5 text-center">
                          <p className="text-sm text-slate-500">
                            Nenhuma função configurada nesta escala.
                          </p>
                        </div>
                      ) : (
                        escala.funcoes.map((funcaoEscala) => {
                          const itensAtivosFuncao =
                            funcaoEscala.itens?.filter(
                              (item) => statusItemAtivo(item.status)
                            ) || []

                          const quantidadePreenchida = itensAtivosFuncao.length
                          const preenchida =
                            quantidadePreenchida >= funcaoEscala.quantidadeVagas
                          const vagasRestantes = Math.max(
                            0,
                            funcaoEscala.quantidadeVagas - quantidadePreenchida
                          )

                          return (
                            <div
                              key={funcaoEscala.id}
                              className="border border-slate-200 rounded-2xl overflow-hidden"
                            >
                              <div className="bg-slate-50/70 p-4 border-b border-slate-100">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-bold text-slate-900">
                                        {funcaoEscala.funcaoPastoral.nome}
                                      </h4>

                                      <span
                                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                                          preenchida
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-amber-50 text-amber-700"
                                        }`}
                                      >
                                        {preenchida
                                          ? "Preenchida"
                                          : `${vagasRestantes} vaga(s)`}
                                      </span>
                                    </div>

                                    {funcaoEscala.funcaoPastoral.descricao && (
                                      <p className="text-xs text-slate-500 mt-1.5">
                                        {funcaoEscala.funcaoPastoral.descricao}
                                      </p>
                                    )}

                                    <p className="text-sm text-slate-500 mt-2">
                                      {quantidadePreenchida} de{" "}
                                      {funcaoEscala.quantidadeVagas} vaga(s) preenchida(s)
                                    </p>
                                  </div>

                                  {escala.podeGerenciar &&
                                    escalaEditavel(escala.status) && (
                                      <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            abrirEditarFuncaoEscala(funcaoEscala)
                                          }
                                          className="inline-flex items-center justify-center gap-1.5 border border-slate-200 bg-white text-slate-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50"
                                        >
                                          <Pencil size={13} />
                                          Editar
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            removerFuncaoEscala(funcaoEscala)
                                          }
                                          className="inline-flex items-center justify-center gap-1.5 border border-red-100 bg-white text-red-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-red-50"
                                        >
                                          <Trash2 size={13} />
                                          Remover
                                        </button>
                                      </div>
                                    )}
                                </div>
                              </div>

                              <div className="p-3 sm:p-4">
                                {itensAtivosFuncao.length === 0 ? (
                                  <div className="flex items-center gap-3 text-sm text-slate-400 py-2">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                      <UserRound size={15} />
                                    </div>
                                    Nenhum membro nesta função.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {itensAtivosFuncao.map((item) => (
                                      <div
                                        key={item.id}
                                        className="bg-slate-50 rounded-xl p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div
                                            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                              item.status === "CONFIRMADO"
                                                ? "bg-emerald-100 text-emerald-700"
                                                : "bg-amber-100 text-amber-700"
                                            }`}
                                          >
                                            <UserRound size={16} />
                                          </div>

                                          <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 break-words">
                                              {item.usuario.nome}
                                            </p>

                                            <span
                                              className={`inline-flex items-center gap-1 text-[11px] font-semibold mt-1 ${
                                                item.status === "CONFIRMADO"
                                                  ? "text-emerald-700"
                                                  : "text-amber-700"
                                              }`}
                                            >
                                              {item.status === "CONFIRMADO" ? (
                                                <CheckCircle2 size={12} />
                                              ) : (
                                                <Clock3 size={12} />
                                              )}
                                              {item.status === "CONFIRMADO"
                                                ? "Confirmado"
                                                : "Aguardando confirmação"}
                                            </span>
                                          </div>
                                        </div>

                                        {escala.podeGerenciar &&
                                          escalaEditavel(escala.status) && (
                                            <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  abrirSubstituirMembro(item, escala)
                                                }
                                                className="border border-slate-200 bg-white text-slate-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50"
                                              >
                                                Substituir
                                              </button>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removerMembroEscala(item)
                                                }
                                                className="border border-red-100 bg-white text-red-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-red-50"
                                              >
                                                Remover
                                              </button>
                                            </div>
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {escala.status === "ABERTA" &&
                                  escala.pastoral.permiteAutoEscala &&
                                  !preenchida &&
                                  !jaEstouEscaladoNoEvento && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        meEscalar(escala.id, funcaoEscala.id)
                                      }
                                      className="mt-4 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#3B7EC7] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#2F6BAA] transition"
                                    >
                                      <UserPlus size={16} />
                                      Me escalar nesta função
                                    </button>
                                  )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}

      {mostrarNovaEscala && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg bg-white rounded-2xl p-6">

            <div className="flex items-center justify-between">

              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Nova escala
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Escolha a pastoral desta escala.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMostrarNovaEscala(false)}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={criarEscala}
              className="space-y-5 mt-6"
            >

              <div>
                <label className="block text-sm font-medium mb-2">
                  Pastoral
                </label>

                <select
                  value={pastoralSelecionada}
                  onChange={(event) =>{
                    const pastoralId = event.target.value
                    setPastoralSelecionada(pastoralId)
                    carregarFuncoesPastoral(pastoralId)
                  } }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                >
                  <option value="">
                    Selecione
                  </option>

                  {pastoraisGerenciaveis.map(
                    (pastoral) => (
                      <option
                        key={pastoral.id}
                        value={pastoral.id}
                      >
                        {pastoral.nome}
                      </option>
                    )
                  )}

                </select>
                {pastoralSelecionada && (
                <div className="mt-5">

                    <label className="block text-sm font-medium mb-2">
                    Funções que serão usadas nesta escala
                    </label>

                    {funcoesPastoral.length === 0 ? (
                    <div className="border border-slate-200 rounded-lg p-4 text-sm text-slate-500">
                        Esta pastoral ainda não possui funções cadastradas.
                    </div>
                    ) : (
                    <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">

                        {funcoesPastoral.map((funcao) => {
                        const selecionada = funcoesSelecionadas.find(
                            (item) =>
                            item.funcaoPastoralId === funcao.id
                        )

                        return (
                            <div
                            key={funcao.id}
                            className="p-4"
                            >

                            <div className="flex items-center justify-between gap-4">

                                <label className="flex items-center gap-3 cursor-pointer">

                                <input
                                    type="checkbox"
                                    checked={Boolean(selecionada)}
                                    onChange={() =>
                                    alternarFuncao(funcao.id)
                                    }
                                    className="w-4 h-4"
                                />

                                <div>
                                    <p className="font-medium text-slate-900">
                                    {funcao.nome}
                                    </p>

                                    {funcao.descricao && (
                                    <p className="text-sm text-slate-500 mt-1">
                                        {funcao.descricao}
                                    </p>
                                    )}
                                </div>

                                </label>

                                {selecionada && (
                                <div className="flex items-center gap-2">

                                    <span className="text-sm text-slate-500">
                                    Vagas
                                    </span>

                                    <input
                                    type="number"
                                    min="1"
                                    value={selecionada.quantidadeVagas}
                                    onChange={(event) =>
                                        alterarQuantidadeFuncao(
                                        funcao.id,
                                        event.target.value
                                        )
                                    }
                                    className="w-20 border border-slate-300 rounded-lg px-3 py-2"
                                    />

                                </div>
                                )}

                            </div>

                            </div>
                        )
                        })}

                    </div>
                    )}

                </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Observação
                </label>

                <textarea
                  value={observacao}
                  onChange={(event) =>
                    setObservacao(event.target.value)
                  }
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="Observações sobre esta escala"
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
                  onClick={() => setMostrarNovaEscala(false)}
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvando||
                    !pastoralSelecionada ||
                    funcoesSelecionadas.length === 0}
                  className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#2F6BAA] transition disabled:opacity-60"
                >
                  {salvando
                    ? "Salvando..."
                    : "Criar escala"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {mostrarAdicionarMembro && escalaSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-lg bg-white rounded-2xl p-6">

            <div className="flex items-center justify-between">

                <div>
                <h2 className="text-xl font-bold text-slate-900">
                    Adicionar membro
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                    {escalaSelecionada.pastoral.nome}
                </p>
                </div>

                <button
                type="button"
                onClick={() => setMostrarAdicionarMembro(false)}
                className="text-slate-500 hover:text-slate-900"
                >
                ✕
                </button>

            </div>

            <form
                onSubmit={adicionarMembroEscala}
                className="space-y-5 mt-6"
            >

                <div>
                <label className="block text-sm font-medium mb-2">
                    Função
                </label>

                <select
                    value={funcaoSelecionada}
                    onChange={(event) =>
                    setFuncaoSelecionada(event.target.value)
                    }
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-3"
                >
                    <option value="">
                    Selecione uma função
                    </option>

                {funcoesDisponiveis.map((funcaoEscala) => {
                const ocupadas =
                    funcaoEscala.itens?.filter(
                    (item) => statusItemAtivo(item.status)
                    ).length || 0

                return (
                    <option
                    key={funcaoEscala.id}
                    value={funcaoEscala.id}
                    >
                    {funcaoEscala.funcaoPastoral.nome}
                    {" "}
                    ({ocupadas}/{funcaoEscala.quantidadeVagas})
                    </option>
                )
                })}

                </select>
                </div>

                <div>
                <label className="block text-sm font-medium mb-2">
                    Membro
                </label>

                <select
                    value={membroSelecionado}
                    onChange={(event) =>
                    setMembroSelecionado(event.target.value)
                    }
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-3"
                >
                    <option value="">
                    Selecione um membro
                    </option>

                    {membrosDisponiveis.map((membro) => (
                    <option
                        key={membro.id}
                        value={membro.usuario.id}
                    >
                        {membro.usuario.nome}
                    </option>
                    ))}

                </select>
                </div>

                {erroItem && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                    {erroItem}
                </div>
                )}

                <div className="flex justify-end gap-3">

                <button
                    type="button"
                    onClick={() => setMostrarAdicionarMembro(false)}
                    className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                    Cancelar
                </button>

                <button
                    type="submit"
                    disabled={salvandoItem}
                    className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg disabled:opacity-60"
                >
                    {salvandoItem
                    ? "Salvando..."
                    : "Adicionar"}
                </button>

                </div>

            </form>

            </div>

        </div>
        )}

        {mostrarEditarFuncaoEscala && funcaoEscalaEditando && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-md bg-white rounded-2xl p-6">

              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Editar vagas
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    {funcaoEscalaEditando.funcaoPastoral.nome}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarEditarFuncaoEscala(false)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  ✕
                </button>

              </div>

              <form
                onSubmit={salvarEdicaoFuncaoEscala}
                className="space-y-5 mt-6"
              >

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quantidade de vagas
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={quantidadeVagasEditando}
                    onChange={(event) =>
                      setQuantidadeVagasEditando(event.target.value)
                    }
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  />
                </div>

                {erroFuncaoEscala && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                    {erroFuncaoEscala}
                  </div>
                )}

                <div className="flex justify-end gap-3">

                  <button
                    type="button"
                    onClick={() => setMostrarEditarFuncaoEscala(false)}
                    className="border border-slate-300 px-4 py-2 rounded-lg"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={salvandoFuncaoEscala}
                    className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg disabled:opacity-60"
                  >
                    {salvandoFuncaoEscala
                      ? "Salvando..."
                      : "Salvar"}
                  </button>

                </div>

              </form>

            </div>

          </div>
        )}

        {mostrarAdicionarFuncaoEscala && escalaAdicionandoFuncao && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-md bg-white rounded-2xl p-6">

              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Adicionar função
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    {escalaAdicionandoFuncao.pastoral.nome}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMostrarAdicionarFuncaoEscala(false)}
                  className="text-slate-500 hover:text-slate-900"
                >
                  ✕
                </button>

              </div>

              <form
                onSubmit={adicionarNovaFuncaoEscala}
                className="space-y-5 mt-6"
              >

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Função
                  </label>

                  <select
                    value={novaFuncaoEscalaId}
                    onChange={(event) =>
                      setNovaFuncaoEscalaId(event.target.value)
                    }
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  >
                    <option value="">
                      Selecione
                    </option>

                    {funcoesParaAdicionar.map((funcao) => (
                      <option
                        key={funcao.id}
                        value={funcao.id}
                      >
                        {funcao.nome}
                      </option>
                    ))}

                  </select>

                  {funcoesParaAdicionar.length === 0 && (
                    <p className="text-sm text-slate-500 mt-2">
                      Todas as funções desta pastoral já estão nesta escala.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Quantidade de vagas
                  </label>

                  <input
                    type="number"
                    min="1"
                    value={novaQuantidadeVagas}
                    onChange={(event) =>
                      setNovaQuantidadeVagas(event.target.value)
                    }
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  />
                </div>

                {erroNovaFuncaoEscala && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                    {erroNovaFuncaoEscala}
                  </div>
                )}

                <div className="flex justify-end gap-3">

                  <button
                    type="button"
                    onClick={() => setMostrarAdicionarFuncaoEscala(false)}
                    className="border border-slate-300 px-4 py-2 rounded-lg"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={
                      salvandoNovaFuncaoEscala ||
                      !novaFuncaoEscalaId ||
                      funcoesParaAdicionar.length === 0
                    }
                    className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg disabled:opacity-60"
                  >
                    {salvandoNovaFuncaoEscala
                      ? "Salvando..."
                      : "Adicionar"}
                  </button>

                </div>

              </form>

            </div>

          </div>
        )}

        {mostrarSubstituirMembro &&
          itemSubstituindo &&
          escalaSubstituindo && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

            <div className="w-full max-w-md bg-white rounded-2xl p-6">

              <div className="flex items-center justify-between">

                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Substituir membro
                  </h2>

                  <p className="text-sm text-slate-500 mt-1">
                    Substituir {itemSubstituindo.usuario.nome}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setMostrarSubstituirMembro(false)
                  }
                  className="text-slate-500 hover:text-slate-900"
                >
                  ✕
                </button>

              </div>

              <form
                onSubmit={substituirMembro}
                className="space-y-5 mt-6"
              >

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Novo membro
                  </label>

                  <select
                    value={novoMembroId}
                    onChange={(event) =>
                      setNovoMembroId(event.target.value)
                    }
                    required
                    className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  >
                    <option value="">
                      Selecione um membro
                    </option>

                    {membrosSubstituicao.map((membro) => (
                      <option
                        key={membro.id}
                        value={membro.usuario.id}
                      >
                        {membro.usuario.nome}
                      </option>
                    ))}

                  </select>
                </div>

                {erroSubstituicao && (
                  <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                    {erroSubstituicao}
                  </div>
                )}

                <div className="flex justify-end gap-3">

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarSubstituirMembro(false)
                    }
                    className="border border-slate-300 px-4 py-2 rounded-lg"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={
                      salvandoSubstituicao ||
                      !novoMembroId
                    }
                    className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg disabled:opacity-60"
                  >
                    {salvandoSubstituicao
                      ? "Substituindo..."
                      : "Substituir"}
                  </button>

                </div>

              </form>

            </div>

          </div>
        )}


    </AppLayout>
  )
}
