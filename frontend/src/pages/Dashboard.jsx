import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Church,
  Clock3,
  ExternalLink,
  ListChecks,
  Quote,
  Users
} from "lucide-react"

import {
  useEffect,
  useState
} from "react"

import {
  useNavigate
} from "react-router-dom"

import AppLayout from "../components/AppLayout"
import { useAuth } from "../contexts/auth"
import api from "../services/api"

export default function Dashboard() {
  const { usuario } = useAuth()
  const navigate = useNavigate()

  const [liturgia, setLiturgia] =
    useState(null)

  const [eventos, setEventos] =
    useState([])

  const [minhasEscalas, setMinhasEscalas] =
    useState([])

  const [pastorais, setPastorais] =
    useState([])

  const [
    notificacoesNaoLidas,
    setNotificacoesNaoLidas
  ] = useState(0)

  const [
    carregandoLiturgia,
    setCarregandoLiturgia
  ] = useState(true)

  useEffect(() => {
    async function carregarDashboard() {
      try {
      const [
        liturgiaResponse,
        eventosResponse,
        escalasResponse,
        pastoraisResponse,
        notificacoesResponse
      ] = await Promise.allSettled([
        api.get("/liturgia/hoje"),
        api.get("/eventos"),
        api.get("/minhas-escalas"),
        api.get("/pastorais"),
        api.get("/notificacoes/nao-lidas")
      ])

      if (
        liturgiaResponse.status ===
        "fulfilled"
      ) {
        setLiturgia(
          liturgiaResponse.value.data
        )
      }

      if (
        eventosResponse.status ===
        "fulfilled"
      ) {
        setEventos(
          Array.isArray(
            eventosResponse.value.data
          )
            ? eventosResponse.value.data
            : []
        )
      }

      if (
        escalasResponse.status ===
        "fulfilled"
      ) {
        setMinhasEscalas(
          Array.isArray(
            escalasResponse.value.data?.escalas
          )
            ? escalasResponse.value.data.escalas
            : []
        )
      }

      if (
        pastoraisResponse.status ===
        "fulfilled"
      ) {
        setPastorais(
          Array.isArray(
            pastoraisResponse.value.data
          )
            ? pastoraisResponse.value.data
            : []
        )
      }

      if (
        notificacoesResponse.status ===
        "fulfilled"
      ) {
        setNotificacoesNaoLidas(
          notificacoesResponse.value.data
            ?.quantidade || 0
        )
      }

      } catch (error) {
      console.error(
        "Erro ao carregar dashboard:",
        error
      )

      } finally {
        setCarregandoLiturgia(false)
      }
    }
    void carregarDashboard()
  }, [])

  function obterDataEvento(evento) {
    return (
      evento?.dataHora ||
      evento?.data ||
      evento?.inicio ||
      null
    )
  }

  function obterDataEscala(item) {
    return (
      item?.evento?.dataHora ||
      item?.evento?.data ||
      item?.dataHora ||
      null
    )
  }

  const agora = new Date()

  const proximosEventos = eventos
    .filter((evento) => {
      const data = obterDataEvento(evento)

      return (
        data &&
        new Date(data) >= agora
      )
    })
    .sort(
      (a, b) =>
        new Date(obterDataEvento(a)) -
        new Date(obterDataEvento(b))
    )

  const proximoEvento =
    proximosEventos[0] || null

  const proximasEscalas =
    minhasEscalas
      .filter((item) => {
        const data =
          obterDataEscala(item)

        return (
          data &&
          new Date(data) >= agora &&
          ![
            "RECUSADO",
            "SUBSTITUIDO",
            "REMOVIDO"
          ].includes(item.status)
        )
      })
      .sort(
        (a, b) =>
          new Date(
            obterDataEscala(a)
          ) -
          new Date(
            obterDataEscala(b)
          )
      )

  const proximaEscala =
    proximasEscalas[0] || null

  function formatarDataHora(data) {
    if (!data) return "Data não informada"

    return new Intl.DateTimeFormat(
      "pt-BR",
      {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      }
    ).format(new Date(data))
  }

  const hojeFormatado =
    new Intl.DateTimeFormat(
      "pt-BR",
      {
        weekday: "long",
        day: "2-digit",
        month: "long"
      }
    ).format(new Date())

  const primeiroNome =
    usuario?.nome
      ?.trim()
      ?.split(" ")[0] ||
    "Olá"

  return (
    <AppLayout
      titulo="Início"
      subtitulo={usuario?.paroquia?.nome}
    >
      <div className="space-y-6">

        {/* SAUDAÇÃO */}
        <section>
          <h2
            className="
              text-2xl
              sm:text-3xl
              font-bold
              text-slate-900
            "
          >
            Olá, {primeiroNome}
          </h2>

          <p
            className="
              text-sm
              text-slate-500
              mt-1
              capitalize
            "
          >
            {hojeFormatado}
          </p>
        </section>

        {/* LITURGIA DO DIA */}
        <section
          className="
            bg-white
            border
            border-[#EFE8D6]
            rounded-2xl
            shadow-sm
            overflow-hidden
          "
        >
          <div className="h-1.5 bg-[#3B7EC7]" />

          <div className="p-5 sm:p-6">

            <div
              className="
                flex
                flex-col
                gap-4
                sm:flex-row
                sm:items-start
                sm:justify-between
              "
            >
              <div className="flex items-start gap-3">

                <div
                  className="
                    w-11 h-11
                    rounded-xl
                    bg-[#EFE8D6]
                    text-[#3B7EC7]
                    flex
                    items-center
                    justify-center
                    shrink-0
                  "
                >
                  <BookOpen size={20} />
                </div>

                <div>
                  <p
                    className="
                      text-xs
                      uppercase
                      tracking-wider
                      font-bold
                      text-[#3B7EC7]
                    "
                  >
                    Liturgia do Dia
                  </p>

                  {liturgia?.titulo && (
                    <h3
                      className="
                        text-lg
                        sm:text-xl
                        font-bold
                        text-slate-900
                        mt-1
                      "
                    >
                      {liturgia.titulo}
                    </h3>
                  )}

                  {liturgia?.corLiturgica && (
                    <div
                      className="
                        inline-flex
                        items-center
                        gap-2
                        mt-2
                        text-xs
                        font-medium
                        text-slate-500
                      "
                    >
                      <span
                        className="
                          w-2.5 h-2.5
                          rounded-full
                          bg-emerald-500
                        "
                      />

                      Cor litúrgica:{" "}
                      {liturgia.corLiturgica}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {carregandoLiturgia && (
              <div
                className="
                  mt-6
                  text-sm
                  text-slate-500
                "
              >
                Carregando liturgia...
              </div>
            )}

            {!carregandoLiturgia &&
              liturgia && (
                <>
                  <div
                    className="
                      grid
                      gap-3
                      mt-6
                      sm:grid-cols-2
                    "
                  >

                    <div
                      className="
                        bg-[#F7F5EF]
                        rounded-xl
                        p-4
                      "
                    >
                      <p
                        className="
                          text-xs
                          font-bold
                          uppercase
                          tracking-wide
                          text-slate-400
                        "
                      >
                        1ª Leitura
                      </p>

                      <p
                        className="
                          font-semibold
                          text-slate-800
                          mt-1
                        "
                      >
                        {liturgia.primeiraLeitura}
                      </p>
                    </div>

                    <div
                      className="
                        bg-[#F7F5EF]
                        rounded-xl
                        p-4
                      "
                    >
                      <p
                        className="
                          text-xs
                          font-bold
                          uppercase
                          tracking-wide
                          text-slate-400
                        "
                      >
                        Salmo
                      </p>

                      <p
                        className="
                          font-semibold
                          text-slate-800
                          mt-1
                        "
                      >
                        {liturgia.salmo}
                      </p>
                    </div>

                  </div>

                  <div
                    className="
                      mt-3
                      rounded-2xl
                      bg-[#EEF5FC]
                      border
                      border-[#D9E8F7]
                      p-5
                      sm:p-6
                    "
                  >

                    <div className="flex items-center gap-2">

                      <BookOpen
                        size={17}
                        className="text-[#3B7EC7]"
                      />

                      <p
                        className="
                          text-sm
                          font-bold
                          text-[#3B7EC7]
                        "
                      >
                        Evangelho
                      </p>

                    </div>

                    <p
                      className="
                        text-lg
                        font-bold
                        text-slate-900
                        mt-2
                      "
                    >
                      {liturgia.evangelho}
                    </p>

                    {liturgia.fraseDestaque && (
                      <div
                        className="
                          mt-5
                          flex
                          gap-3
                          items-start
                        "
                      >

                        <Quote
                          size={20}
                          className="
                            text-[#3B7EC7]
                            shrink-0
                            mt-0.5
                          "
                        />

                        <p
                          className="
                            text-base
                            sm:text-lg
                            leading-relaxed
                            text-slate-700
                            italic
                          "
                        >
                          “{liturgia.fraseDestaque}”
                        </p>

                      </div>
                    )}

                    <a
                      href={liturgia.url}
                      target="_blank"
                      rel="noreferrer"
                      className="
                        inline-flex
                        items-center
                        gap-2
                        mt-5
                        text-sm
                        font-semibold
                        text-[#3B7EC7]
                        hover:text-[#2F6BAA]
                        transition
                      "
                    >
                      Ver liturgia completa
                      <ExternalLink size={14} />
                    </a>

                  </div>
                </>
              )}

            {!carregandoLiturgia &&
              !liturgia && (
                <p
                  className="
                    mt-6
                    text-sm
                    text-slate-500
                  "
                >
                  Não foi possível carregar a
                  liturgia do dia.
                </p>
              )}

          </div>
        </section>

        {/* PRÓXIMOS COMPROMISSOS */}
        <section>

          <div className="mb-4">
            <h2
              className="
                text-lg
                font-bold
                text-slate-900
              "
            >
              Próximos compromissos
            </h2>

            <p
              className="
                text-sm
                text-slate-500
                mt-1
              "
            >
              O que vem pela frente na sua paróquia.
            </p>
          </div>

          <div
            className="
              grid
              gap-4
              lg:grid-cols-2
            "
          >

            {/* PRÓXIMO EVENTO */}
            <div
              className="
                bg-white
                border
                border-slate-200
                rounded-2xl
                p-5
                shadow-sm
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >

                <div
                  className="
                    w-10 h-10
                    rounded-xl
                    bg-[#EFE8D6]
                    text-[#3B7EC7]
                    flex
                    items-center
                    justify-center
                  "
                >
                  <CalendarDays size={18} />
                </div>

                <span
                  className="
                    text-xs
                    font-semibold
                    text-slate-400
                  "
                >
                  Próximo evento
                </span>

              </div>

              {proximoEvento ? (
                <>
                  <h3
                    className="
                      text-lg
                      font-bold
                      text-slate-900
                      mt-4
                    "
                  >
                    {proximoEvento.nome ||
                      proximoEvento.titulo ||
                      proximoEvento.tipo ||
                      "Evento"}
                  </h3>

                  <div
                    className="
                      flex
                      items-center
                      gap-2
                      mt-2
                      text-sm
                      text-slate-500
                    "
                  >
                    <Clock3 size={15} />

                    {formatarDataHora(
                      obterDataEvento(
                        proximoEvento
                      )
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate("/eventos")
                    }
                    className="
                      inline-flex
                      items-center
                      gap-2
                      mt-5
                      text-sm
                      font-semibold
                      text-[#3B7EC7]
                      hover:text-[#2F6BAA]
                    "
                  >
                    Ver eventos
                    <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <p
                  className="
                    text-sm
                    text-slate-500
                    mt-4
                  "
                >
                  Nenhum próximo evento encontrado.
                </p>
              )}

            </div>

            {/* PRÓXIMA ESCALA */}
            <div
              className="
                bg-white
                border
                border-slate-200
                rounded-2xl
                p-5
                shadow-sm
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >

                <div
                  className="
                    w-10 h-10
                    rounded-xl
                    bg-[#EEF5FC]
                    text-[#3B7EC7]
                    flex
                    items-center
                    justify-center
                  "
                >
                  <ListChecks size={18} />
                </div>

                <span
                  className="
                    text-xs
                    font-semibold
                    text-slate-400
                  "
                >
                  Minha próxima escala
                </span>

              </div>

              {proximaEscala ? (
                <>
                  <h3
                    className="
                      text-lg
                      font-bold
                      text-slate-900
                      mt-4
                    "
                  >
                    {proximaEscala.pastoral?.nome ||
                      proximaEscala.escala?.pastoral?.nome ||
                      "Escala pastoral"}
                  </h3>

                  <p
                    className="
                      text-sm
                      text-slate-600
                      mt-1
                    "
                  >
                    {proximaEscala.funcao?.nome ||
                      "Função definida na escala"}
                  </p>

                  <div
                    className="
                      flex
                      items-center
                      gap-2
                      mt-2
                      text-sm
                      text-slate-500
                    "
                  >
                    <Clock3 size={15} />

                    {formatarDataHora(
                      obterDataEscala(
                        proximaEscala
                      )
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        "/minhas-escalas"
                      )
                    }
                    className="
                      inline-flex
                      items-center
                      gap-2
                      mt-5
                      text-sm
                      font-semibold
                      text-[#3B7EC7]
                      hover:text-[#2F6BAA]
                    "
                  >
                    Ver minhas escalas
                    <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <p
                  className="
                    text-sm
                    text-slate-500
                    mt-4
                  "
                >
                  Você não possui próximas escalas.
                </p>
              )}

            </div>

          </div>

        </section>

        {/* RESUMO */}
        <section>

          <div className="mb-4">
            <h2
              className="
                text-lg
                font-bold
                text-slate-900
              "
            >
              Resumo
            </h2>
          </div>

          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-3
              gap-3
            "
          >

            <button
              type="button"
              onClick={() =>
                navigate("/pastorais")
              }
              className="
                bg-white
                border
                border-slate-200
                rounded-xl
                p-4
                text-left
                hover:border-[#3B7EC7]/40
                transition
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <Church
                  size={18}
                  className="text-[#3B7EC7]"
                />

                <div>
                  <p
                    className="
                      text-xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {pastorais.length}
                  </p>

                  <p
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    Pastorais
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                navigate(
                  "/minhas-escalas"
                )
              }
              className="
                bg-white
                border
                border-slate-200
                rounded-xl
                p-4
                text-left
                hover:border-[#3B7EC7]/40
                transition
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <Users
                  size={18}
                  className="text-[#3B7EC7]"
                />

                <div>
                  <p
                    className="
                      text-xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {proximasEscalas.length}
                  </p>

                  <p
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    Próximas escalas
                  </p>
                </div>
              </div>
            </button>

            <div
              className="
                bg-white
                border
                border-slate-200
                rounded-xl
                p-4
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <Bell
                  size={18}
                  className="text-[#3B7EC7]"
                />

                <div>
                  <p
                    className="
                      text-xl
                      font-bold
                      text-slate-900
                    "
                  >
                    {notificacoesNaoLidas}
                  </p>

                  <p
                    className="
                      text-xs
                      text-slate-500
                    "
                  >
                    Notificações não lidas
                  </p>
                </div>
              </div>
            </div>

          </div>

        </section>

      </div>
    </AppLayout>
  )
}
