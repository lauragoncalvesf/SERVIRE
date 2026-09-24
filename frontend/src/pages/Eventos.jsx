import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/auth"
import { formatarTipoEvento } from "../utils"


import AppLayout from "../components/AppLayout"
import ConfirmacaoModal from "../components/ConfirmacaoModal"
import api from "../services/api"

import FullCalendar from "@fullcalendar/react"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  List,
  MapPin,
  Pencil,
  Plus,
  Rows3,
  XCircle
} from "lucide-react"
import ptBrLocale from "@fullcalendar/core/locales/pt-br.js"
import listPlugin from "@fullcalendar/list"

export default function Eventos() {
  const navigate = useNavigate()

  const { usuario } = useAuth()

  const [eventos, setEventos] = useState([])
  const [pastorais, setPastorais] = useState([])
  const [indisponibilidades, setIndisponibilidades] = useState([])

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState("")

  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [eventoEmEdicao, setEventoEmEdicao] = useState(null)
  const [eventoParaCancelar, setEventoParaCancelar] = useState(null)
  const [cancelandoEvento, setCancelandoEvento] = useState(false)
  const [eventoParaDisponibilizar, setEventoParaDisponibilizar] = useState(null)
  const [removendoIndisponibilidade, setRemovendoIndisponibilidade] = useState(false)

  const [titulo, setTitulo] = useState("")
  const [tipo, setTipo] = useState("MISSA")
  const [dataHora, setDataHora] = useState("")
  const [local, setLocal] = useState("")
  const [descricao, setDescricao] = useState("")

  const [salvando, setSalvando] = useState(false)
  const [erroFormulario, setErroFormulario] = useState("")

  const calendarioRef = useRef(null)
  const [tituloCalendario, setTituloCalendario] = useState("")

  const [mostrarDetalhesEvento, setMostrarDetalhesEvento] = useState(false)
  const [eventoSelecionado, setEventoSelecionado] = useState(null)

  const [visualizacao, setVisualizacao] = useState(() => {
    const preferenciaSalva =
      localStorage.getItem(
        "visualizacao-eventos"
      )

    if (
      preferenciaSalva === "mes" ||
      preferenciaSalva === "agenda"
    ) {
      return preferenciaSalva
    }

    return window.innerWidth < 768
      ? "agenda"
      : "mes"
  })

  const [
    mostrarIndisponibilidade,
    setMostrarIndisponibilidade
  ] = useState(false)

  const [
    eventoIndisponibilidade,
    setEventoIndisponibilidade
  ] = useState(null)

  const [
    motivoIndisponibilidade,
    setMotivoIndisponibilidade
  ] = useState("")

  const [
    salvandoIndisponibilidade,
    setSalvandoIndisponibilidade
  ] = useState(false)

  const [
    erroIndisponibilidade,
    setErroIndisponibilidade
  ] = useState("")

  const podeCriar =
    usuario?.tipo === "ADMIN" ||
    pastorais.some(
      (pastoral) =>
        pastoral.podeGerenciar
    )

  useEffect(() => {
    carregarEventos()
  }, [])

  function alterarVisualizacao(novaVisualizacao) {
    setVisualizacao(novaVisualizacao)

    localStorage.setItem(
      "visualizacao-eventos",
      novaVisualizacao
    )

    const apiCalendario =
      calendarioRef.current?.getApi()

    if (!apiCalendario) {
      return
    }

    apiCalendario.changeView(
      novaVisualizacao === "mes"
        ? "dayGridMonth"
        : "listMonth"
    )
  }

  async function carregarEventos() {
    try {
      setCarregando(true)
      setErro("")

      const [
        eventosResponse,
        indisponibilidadesResponse,
        pastoraisResponse
      ] = await Promise.all([
        api.get("/eventos"),
        api.get("/minhas-indisponibilidades"),
        api.get("/pastorais")
      ])

      setEventos(eventosResponse.data)

      setIndisponibilidades(
        indisponibilidadesResponse.data
      )

      setPastorais(
        pastoraisResponse.data
      )

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao carregar eventos"
      )
    } finally {
      setCarregando(false)
    }
  }

  function limparFormularioEvento() {
    setTitulo("")
    setTipo("MISSA")
    setDataHora("")
    setLocal("")
    setDescricao("")
    setEventoEmEdicao(null)
    setErroFormulario("")
  }

  function fecharFormularioEvento() {
    setMostrarFormulario(false)
    limparFormularioEvento()
  }

  function formatarDataHoraLocal(valor) {
    const data = new Date(valor)
    const deslocamento = data.getTimezoneOffset() * 60000
    return new Date(data.getTime() - deslocamento).toISOString().slice(0, 16)
  }

  function abrirEdicaoEvento(evento) {
    setTitulo(evento.titulo)
    setTipo(evento.tipo)
    setDataHora(formatarDataHoraLocal(evento.dataHora))
    setLocal(evento.local || "")
    setDescricao(evento.descricao || "")
    setEventoEmEdicao(evento)
    setErroFormulario("")
    setMostrarDetalhesEvento(false)
    setEventoSelecionado(null)
    setMostrarFormulario(true)
  }

  async function salvarEvento(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErroFormulario("")

      const dados = {
        titulo,
        tipo,
        dataHora,
        local,
        descricao
      }

      if (eventoEmEdicao) {
        await api.put(`/eventos/${eventoEmEdicao.id}`, dados)
      } else {
        await api.post("/eventos", dados)
      }

      fecharFormularioEvento()

      await carregarEventos()

    } catch (error) {
      setErroFormulario(
        error.response?.data?.mensagem ||
        eventoEmEdicao
          ? "Erro ao atualizar evento"
          : "Erro ao criar evento"
      )
    } finally {
      setSalvando(false)
    }
  }

  async function cancelarEvento(evento) {
    try {
      setCancelandoEvento(true)
      setErro("")
      await api.delete(`/eventos/${evento.id}`)
      setEventoParaCancelar(null)
      setMostrarDetalhesEvento(false)
      setEventoSelecionado(null)
      await carregarEventos()
    } catch (error) {
      setErro(error.response?.data?.mensagem || "Erro ao cancelar evento")
    } finally {
      setCancelandoEvento(false)
    }
  }

  function buscarIndisponibilidade(eventoId) {
    return indisponibilidades.find(
      (indisponibilidade) =>
        indisponibilidade.eventoId === eventoId
    )
  }

  function abrirIndisponibilidade(evento) {
    setEventoIndisponibilidade(evento)
    setMotivoIndisponibilidade("")
    setErroIndisponibilidade("")
    setMostrarIndisponibilidade(true)
  }

  async function salvarIndisponibilidade(event) {
    event.preventDefault()

    try {
      setSalvandoIndisponibilidade(true)
      setErroIndisponibilidade("")

      await api.post(
        "/indisponibilidades",
        {
          eventoId:
            eventoIndisponibilidade.id,

          motivo:
            motivoIndisponibilidade.trim() ||
            null
        }
      )

      setMostrarIndisponibilidade(false)
      setEventoIndisponibilidade(null)
      setMotivoIndisponibilidade("")

      await carregarEventos()

    } catch (error) {
      setErroIndisponibilidade(
        error.response?.data?.mensagem ||
        "Erro ao registrar indisponibilidade"
      )
    } finally {
      setSalvandoIndisponibilidade(false)
    }
  }

  async function removerIndisponibilidade(eventoId) {
    try {
      setRemovendoIndisponibilidade(true)
      setErro("")

      await api.delete(
        `/indisponibilidades/eventos/${eventoId}`
      )

      setEventoParaDisponibilizar(null)
      setMostrarDetalhesEvento(false)
      setEventoSelecionado(null)
      await carregarEventos()

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao remover indisponibilidade"
      )
    } finally {
      setRemovendoIndisponibilidade(false)
    }
  }

  function classesPorTipoEvento(tipo) {
    const classes = {
      MISSA:
        "bg-blue-50 border-blue-200 text-blue-800",

      CELEBRACAO:
        "bg-violet-50 border-violet-200 text-violet-800",

      ADORACAO:
        "bg-amber-50 border-amber-200 text-amber-800",

      NOVENA:
        "bg-purple-50 border-purple-200 text-purple-800",

      PROCISSAO:
        "bg-emerald-50 border-emerald-200 text-emerald-800",

      REUNIAO:
        "bg-slate-100 border-slate-300 text-slate-800",

      OUTRO:
        "bg-cyan-50 border-cyan-200 text-cyan-800"
    }

  return (
    classes[tipo] ||
    "bg-slate-100 border-slate-200 text-slate-800"
  )
}

function abrirDetalhesEvento(evento) {
  setEventoSelecionado(evento)
  setMostrarDetalhesEvento(true)
}

  return (
    <AppLayout
      titulo="Eventos"
      subtitulo="Gerencie os eventos e celebrações da paróquia"
    >
      <div className="space-y-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Calendário da paróquia
            </h2>

            <p className="text-sm text-slate-500 mt-1">
              Acompanhe missas, celebrações e demais eventos.
            </p>
          </div>

          {podeCriar && (
            <button
              type="button"
              onClick={() => {
                limparFormularioEvento()
                setMostrarFormulario(true)
              }}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                bg-[#3B7EC7]
                text-white
                px-4
                py-2.5
                rounded-lg
                font-medium
                hover:bg-[#2F6BAA]
                transition
              "
            >
              <Plus size={18} />

              Novo evento
            </button>
          )}

        </div>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          {erro}
        </div>
      )}

      {carregando ? (

        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          <div className="flex items-center gap-3 text-slate-500">
            <CalendarDays size={20} />

            Carregando calendário...
          </div>
        </div>

      ) : (

        <div
          className="
            eventos-calendar
            bg-white
            border border-slate-200
            rounded-2xl
            shadow-sm
            p-3
            sm:p-4
            md:p-6
          "
        >

          <div className="mb-5 space-y-4">

            <div className="flex items-center justify-between gap-3">

              <div className="flex items-center gap-2 min-w-0">

                <button
                  type="button"
                  onClick={() =>
                    calendarioRef.current
                      ?.getApi()
                      .prev()
                  }
                  className="
                    w-10 h-10
                    shrink-0
                    flex items-center justify-center
                    border border-slate-200
                    rounded-xl
                    text-slate-600
                    hover:bg-slate-50
                    active:bg-slate-100
                    transition
                  "
                  aria-label="Mês anterior"
                >
                  <ChevronLeft size={19} />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    calendarioRef.current
                      ?.getApi()
                      .next()
                  }
                  className="
                    w-10 h-10
                    shrink-0
                    flex items-center justify-center
                    border border-slate-200
                    rounded-xl
                    text-slate-600
                    hover:bg-slate-50
                    active:bg-slate-100
                    transition
                  "
                  aria-label="Próximo mês"
                >
                  <ChevronRight size={19} />
                </button>

                <h3
                  className="
                    ml-1
                    text-base
                    sm:text-lg
                    font-bold
                    text-slate-900
                    capitalize
                    truncate
                  "
                >
                  {tituloCalendario}
                </h3>

              </div>

              <button
                type="button"
                onClick={() =>
                  calendarioRef.current
                    ?.getApi()
                    .today()
                }
                className="
                  shrink-0
                  px-3.5 py-2
                  rounded-xl
                  border border-slate-200
                  bg-white
                  text-sm font-semibold
                  text-slate-700
                  hover:bg-slate-50
                  transition
                "
              >
                Hoje
              </button>

            </div>

            <div
              className="
                grid grid-cols-2
                gap-1
                bg-slate-100
                rounded-xl
                p-1
                sm:flex sm:w-fit
              "
            >

              <button
                type="button"
                onClick={() =>
                  alterarVisualizacao("mes")
                }
                className={`
                  min-h-10
                  px-4
                  rounded-lg
                  text-sm
                  font-semibold
                  flex
                  items-center
                  justify-center
                  gap-2
                  transition

                  ${
                    visualizacao === "mes"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }
                `}
              >
                <Rows3 size={16} />
                Mês
              </button>

              <button
                type="button"
                onClick={() =>
                  alterarVisualizacao("agenda")
                }
                className={`
                  min-h-10
                  px-4
                  rounded-lg
                  text-sm
                  font-semibold
                  flex
                  items-center
                  justify-center
                  gap-2
                  transition

                  ${
                    visualizacao === "agenda"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }
                `}
              >
                <List size={16} />
                Agenda
              </button>

            </div>

          </div>

          <FullCalendar
            plugins={[
              dayGridPlugin,
              interactionPlugin, 
              listPlugin
            ]}

            initialView={
              visualizacao === "mes"
              ? "dayGridMonth"
              : "listMonth"
            }
            
            locale={ptBrLocale}
            firstDay={0}

            height="auto"

            fixedWeekCount={false}

            dayMaxEvents={3}

             dayCellClassNames={(info) => {
              if (info.isToday) {
                return [
                  "bg-blue-50/40"
                ]
              }

              return []
            }}

            dayCellDidMount={(info) => {
              if (!info.isToday) {
                return
              }

              const numero =
                info.el.querySelector(
                  ".fc-daygrid-day-number"
                )

              if (numero) {
                numero.classList.add(
                  "bg-blue-600",
                  "text-white",
                  "rounded-full",
                  "w-7",
                  "h-7",
                  "flex",
                  "items-center",
                  "justify-center",
                  "font-semibold"
                )
              }
            }}

            moreLinkText={(numero) =>
              `+${numero} eventos`
            }

            headerToolbar={false}

            ref={calendarioRef}

            datesSet={(info) => {
              setTituloCalendario(
                new Intl.DateTimeFormat("pt-BR", {
                  month: "long",
                  year: "numeric"
                }).format(info.view.currentStart)
              )
            }}

            buttonText={{
              today: "Hoje"
            }}

            events={eventos.map((evento) => {
              const indisponibilidade =
                buscarIndisponibilidade(
                  evento.id
                )

              return {
                id: String(evento.id),

                title: evento.titulo,

                start: evento.dataHora,

                extendedProps: {
                  evento,
                  indisponibilidade
                }
              }
            })}

            eventClick={(info) => {
              const evento =
                info.event.extendedProps.evento

              abrirDetalhesEvento(evento)
            }}

            dateClick={(info) => {
              if (!podeCriar) {
                return
              }

              const dataSelecionada =
                `${info.dateStr}T19:00`

              setDataHora(
                dataSelecionada
              )

              setEventoEmEdicao(null)
              setErroFormulario("")
              setMostrarFormulario(true)
            }}

            eventContent={(info) => {
              const evento =
                info.event.extendedProps.evento

              const indisponibilidade =
                info.event.extendedProps
                  .indisponibilidade

              const hora =
                new Intl.DateTimeFormat(
                  "pt-BR",
                  {
                    hour: "2-digit",
                    minute: "2-digit"
                  }
                ).format(
                  new Date(evento.dataHora)
                )
              
              const ehAgenda =
                info.view.type === "listMonth"

              return ehAgenda ? (
                <div
                  className={`
                    w-full
                    min-w-0
                    rounded-xl
                    p-3
                    cursor-pointer
                    transition
                    hover:shadow-sm

                    ${
                      indisponibilidade
                        ? "bg-red-50 border border-red-100 text-red-800"
                        : classesPorTipoEvento(
                            evento.tipo
                          )
                    }
                  `}
                >

                  <div className="flex items-start gap-3 w-full min-w-0">

                    <div
                      className="
                        w-9 h-9
                        sm:w-10 sm:h-10
                        rounded-xl
                        bg-white/70
                        flex 
                        items-center
                        justify-center
                        shrink-0
                      "
                    >
                      <Clock3 size={17} />
                    </div>

                    <div className="min-w-0 flex-1 w-full">

                      <div className="flex items-start justify-between gap-2">

                        <h4
                          className="
                            text-sm
                            font-bold
                            leading-snug
                            min-w-0
                            whitespace-normal
                            break-normal
                          "
                        >
                          {evento.titulo}
                        </h4>

                        <span 
                          className="
                            text-xs 
                            font-bold
                            shrink-0
                            whitespace-nowrap
                          "
                        >
                          {hora}
                        </span>

                      </div>

                      <p className="text-xs opacity-75 mt-1">
                        {formatarTipoEvento(
                          evento.tipo
                        )}
                      </p>

                      {evento.local && (
                        <div className="flex items-start gap-1 mt-2 opacity-75 min-w-0" >
                          <MapPin size={12} className="shrink-0 mt-0.5"/>

                          <span className="text-xs break-words min-w-0">
                            {evento.local}
                          </span>
                        </div>
                      )}

                      {indisponibilidade && (
                        <div className="mt-2 text-xs font-semibold bg-red-100/70 rounded-lg px-2 py-1.5">
                          Você informou indisponibilidade
                        </div>
                      )}

                    </div>

                  </div>

                </div>
              ) : (
                <div
                  className={`
                    w-full
                    rounded-md
                    px-2 py-1.5
                    border
                    cursor-pointer
                    overflow-hidden
                    transition
                    hover:brightness-95

                    ${
                      indisponibilidade
                        ? "bg-red-50 border-red-200 text-red-800"
                        : classesPorTipoEvento(
                            evento.tipo
                          )
                    }
                  `}
                >

                  <div className="flex items-center gap-1.5">

                    <span className="text-[10px] font-bold shrink-0">
                      {hora}
                    </span>

                    <span className="text-xs font-semibold truncate">
                      {evento.titulo}
                    </span>

                  </div>

                </div>
              )
            }}
          />

        </div>
      )}

    </div>

    {mostrarDetalhesEvento && eventoSelecionado && (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">

        <div
          className="
            w-full
            sm:max-w-md
            bg-white
            rounded-t-3xl
            sm:rounded-2xl
            shadow-xl
            overflow-hidden
          "
        >

          <div
            className={`
              h-1.5

              ${
                buscarIndisponibilidade(
                  eventoSelecionado.id
                )
                  ? "bg-red-500"
                  : eventoSelecionado.tipo === "MISSA"
                  ? "bg-blue-500"
                  : eventoSelecionado.tipo === "CELEBRACAO"
                  ? "bg-violet-500"
                  : eventoSelecionado.tipo === "ADORACAO"
                  ? "bg-amber-500"
                  : eventoSelecionado.tipo === "NOVENA"
                  ? "bg-purple-500"
                  : eventoSelecionado.tipo === "PROCISSAO"
                  ? "bg-emerald-500"
                  : eventoSelecionado.tipo === "REUNIAO"
                  ? "bg-slate-500"
                  : "bg-cyan-500"
              }
            `}
          />

          <div className="p-5 sm:p-6">

            <div className="flex items-start justify-between gap-4">

              <div className="min-w-0">

                <span
                  className={`
                    inline-flex
                    items-center
                    px-2.5 py-1
                    rounded-full
                    text-xs
                    font-semibold

                    ${
                      eventoSelecionado.tipo === "MISSA"
                        ? "bg-blue-50 text-blue-700"
                        : eventoSelecionado.tipo === "CELEBRACAO"
                        ? "bg-violet-50 text-violet-700"
                        : eventoSelecionado.tipo === "ADORACAO"
                        ? "bg-amber-50 text-amber-700"
                        : eventoSelecionado.tipo === "NOVENA"
                        ? "bg-purple-50 text-purple-700"
                        : eventoSelecionado.tipo === "PROCISSAO"
                        ? "bg-emerald-50 text-emerald-700"
                        : eventoSelecionado.tipo === "REUNIAO"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-cyan-50 text-cyan-700"
                    }
                  `}
                >
                  {formatarTipoEvento(
                    eventoSelecionado.tipo
                  )}
                </span>

                <h2
                  className="
                    text-xl
                    sm:text-2xl
                    font-bold
                    text-slate-900
                    leading-tight
                    mt-3
                  "
                >
                  {eventoSelecionado.titulo}
                </h2>

              </div>

              <button
                type="button"
                onClick={() => {
                  setMostrarDetalhesEvento(false)
                  setEventoSelecionado(null)
                }}
                className="
                  w-9 h-9
                  shrink-0
                  flex
                  items-center
                  justify-center
                  rounded-full
                  text-slate-500
                  hover:bg-slate-100
                  hover:text-slate-900
                  transition
                "
                aria-label="Fechar detalhes"
              >
                ✕
              </button>

            </div>

            <div className="mt-6 space-y-4">

              <div className="flex items-start gap-3">

                <div
                  className="
                    w-10 h-10
                    rounded-xl
                    bg-blue-50
                    text-blue-700
                    flex
                    items-center
                    justify-center
                    shrink-0
                  "
                >
                  <CalendarDays size={18} />
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Data e horário
                  </p>

                  <p className="text-sm font-semibold text-slate-800 mt-0.5">
                    {new Intl.DateTimeFormat(
                      "pt-BR",
                      {
                        dateStyle: "medium",
                        timeStyle: "short"
                      }
                    ).format(
                      new Date(
                        eventoSelecionado.dataHora
                      )
                    )}
                  </p>
                </div>

              </div>

              {eventoSelecionado.local && (
                <div className="flex items-start gap-3">

                  <div
                    className="
                      w-10 h-10
                      rounded-xl
                      bg-violet-50
                      text-violet-700
                      flex
                      items-center
                      justify-center
                      shrink-0
                    "
                  >
                    <MapPin size={18} />
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Local
                    </p>

                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {eventoSelecionado.local}
                    </p>
                  </div>

                </div>
              )}

              {eventoSelecionado.descricao && (
                <div
                  className="
                    bg-slate-50
                    border border-slate-100
                    rounded-xl
                    p-4
                  "
                >
                  <p className="text-xs font-medium text-slate-400">
                    Descrição
                  </p>

                  <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                    {eventoSelecionado.descricao}
                  </p>
                </div>
              )}

              {buscarIndisponibilidade(
                eventoSelecionado.id
              ) && (
                <div
                  className="
                    bg-red-50
                    border border-red-100
                    rounded-xl
                    p-4
                  "
                >
                  <p className="text-sm font-semibold text-red-700">
                    Você informou indisponibilidade
                  </p>

                  {buscarIndisponibilidade(
                    eventoSelecionado.id
                  )?.motivo && (
                    <p className="text-sm text-red-600 mt-1">
                      {
                        buscarIndisponibilidade(
                          eventoSelecionado.id
                        ).motivo
                      }
                    </p>
                  )}
                </div>
              )}

            </div>

            <div
              className="
                mt-6
                pt-5
                border-t border-slate-100
                space-y-3
              "
            >

              <button
                type="button"
                onClick={() => {
                  const id =
                    eventoSelecionado.id

                  setMostrarDetalhesEvento(false)
                  setEventoSelecionado(null)

                  navigate(
                    `/eventos/${id}/escalas`
                  )
                }}
                className="
                  w-full
                  bg-[#3B7EC7]
                  text-white
                  px-4 py-3
                  rounded-xl
                  text-sm
                  font-semibold
                  hover:bg-[#2F6BAA]
                  transition
                "
              >
                Ver escalas do evento
              </button>

              {usuario?.tipo === "ADMIN" && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => abrirEdicaoEvento(eventoSelecionado)}
                    className="flex items-center justify-center gap-2 border border-blue-200 bg-blue-50 text-blue-700 px-3 py-3 rounded-xl text-sm font-semibold hover:bg-blue-100 transition"
                  >
                    <Pencil size={17} />
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => setEventoParaCancelar(eventoSelecionado)}
                    className="flex items-center justify-center gap-2 border border-red-200 bg-red-50 text-red-700 px-3 py-3 rounded-xl text-sm font-semibold hover:bg-red-100 transition"
                  >
                    <XCircle size={17} />
                    Cancelar evento
                  </button>
                </div>
              )}

              {buscarIndisponibilidade(
                eventoSelecionado.id
              ) ? (
                <button
                  type="button"
                  onClick={() => setEventoParaDisponibilizar(eventoSelecionado)}
                  className="
                    w-full
                    border border-slate-200
                    bg-white
                    text-slate-700
                    px-4 py-3
                    rounded-xl
                    text-sm
                    font-semibold
                    hover:bg-slate-50
                    transition
                  "
                >
                  Estou disponível novamente
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const evento =
                      eventoSelecionado

                    setMostrarDetalhesEvento(false)
                    setEventoSelecionado(null)

                    abrirIndisponibilidade(
                      evento
                    )
                  }}
                  className="
                    w-full
                    border border-red-200
                    bg-red-50
                    text-red-700
                    px-4 py-3
                    rounded-xl
                    text-sm
                    font-semibold
                    hover:bg-red-100
                    transition
                  "
                >
                  Não posso participar
                </button>
              )}

            </div>

          </div>

        </div>

      </div>
    )}

      {mostrarFormulario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl p-6">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  {eventoEmEdicao ? "Editar evento" : "Novo evento"}
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {eventoEmEdicao
                    ? "Atualize as informações do evento selecionado."
                    : "Cadastre uma nova celebração ou evento."}
                </p>

              </div>

              <button
                type="button"
                onClick={fecharFormularioEvento}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={salvarEvento}
              className="space-y-5 mt-6"
            >

              <div>
                <label className="block text-sm font-medium mb-2">
                  Título
                </label>

                <input
                  type="text"
                  value={titulo}
                  onChange={(event) =>
                    setTitulo(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="Ex.: Missa de Domingo - 09h"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Tipo
                </label>

                <select
                  value={tipo}
                  onChange={(event) =>
                    setTipo(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                >
                  <option value="MISSA">
                    Missa
                  </option>

                  <option value="CELEBRACAO">
                    Celebração
                  </option>

                  <option value="ADORACAO">
                    Adoração
                  </option>

                  <option value="NOVENA">
                    Novena
                  </option>

                  <option value="PROCISSAO">
                    Procissão
                  </option>

                  <option value="REUNIAO">
                    Reunião
                  </option>

                  <option value="OUTRO">
                    Outro
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Data e hora
                </label>

                <input
                  type="datetime-local"
                  value={dataHora}
                  onChange={(event) =>
                    setDataHora(
                      event.target.value
                    )
                  }
                  required
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Local
                </label>

                <input
                  type="text"
                  value={local}
                  onChange={(event) =>
                    setLocal(
                      event.target.value
                    )
                  }
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="Ex.: Igreja Matriz"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Descrição
                </label>

                <textarea
                  value={descricao}
                  onChange={(event) =>
                    setDescricao(
                      event.target.value
                    )
                  }
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                  placeholder="Informações adicionais sobre o evento"
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
                  onClick={fecharFormularioEvento}
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={salvando}
                  className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#2F6BAA] transition disabled:opacity-60"
                >
                  {salvando
                    ? "Salvando..."
                    : eventoEmEdicao
                    ? "Salvar alterações"
                    : "Criar evento"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      <ConfirmacaoModal
        aberto={Boolean(eventoParaCancelar)}
        titulo="Cancelar evento"
        mensagem={eventoParaCancelar
          ? `O evento “${eventoParaCancelar.titulo}” deixará de aparecer no calendário. As informações vinculadas serão preservadas.`
          : ""}
        textoConfirmar="Cancelar evento"
        carregando={cancelandoEvento}
        onConfirmar={() => cancelarEvento(eventoParaCancelar)}
        onFechar={() => setEventoParaCancelar(null)}
      />

      <ConfirmacaoModal
        aberto={Boolean(eventoParaDisponibilizar)}
        titulo="Informar disponibilidade"
        mensagem={eventoParaDisponibilizar
          ? `Você voltará a aparecer como disponível para o evento “${eventoParaDisponibilizar.titulo}”.`
          : ""}
        textoConfirmar="Estou disponível"
        carregando={removendoIndisponibilidade}
        onConfirmar={() => removerIndisponibilidade(eventoParaDisponibilizar.id)}
        onFechar={() => setEventoParaDisponibilizar(null)}
      />

      {mostrarIndisponibilidade &&
        eventoIndisponibilidade && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

          <div className="w-full max-w-md bg-white rounded-2xl p-6">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold text-slate-900">
                  Informar indisponibilidade
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  {
                    eventoIndisponibilidade.titulo
                  }
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  setMostrarIndisponibilidade(false)
                  setEventoIndisponibilidade(null)
                  setMotivoIndisponibilidade("")
                  setErroIndisponibilidade("")
                }}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={
                salvarIndisponibilidade
              }
              className="space-y-5 mt-6"
            >

              <div>

                <label className="block text-sm font-medium mb-2">
                  Motivo
                  <span className="text-slate-400 font-normal">
                    {" "}(opcional)
                  </span>
                </label>

                <textarea
                  value={
                    motivoIndisponibilidade
                  }
                  onChange={(event) =>
                    setMotivoIndisponibilidade(
                      event.target.value
                    )
                  }
                  rows={3}
                  placeholder="Ex.: Estarei viajando"
                  className="w-full border border-slate-300 rounded-lg px-4 py-3"
                />

              </div>

              {erroIndisponibilidade && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                  {erroIndisponibilidade}
                </div>
              )}

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() => {
                    setMostrarIndisponibilidade(false)
                    setEventoIndisponibilidade(null)
                    setMotivoIndisponibilidade("")
                    setErroIndisponibilidade("")
                  }}
                  className="border border-slate-300 px-4 py-2 rounded-lg"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    salvandoIndisponibilidade
                  }
                  className="bg-[#3B7EC7] text-white px-4 py-2 rounded-lg disabled:opacity-60"
                >
                  {
                    salvandoIndisponibilidade
                      ? "Salvando..."
                      : "Confirmar"
                  }
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </AppLayout>
  )
}
