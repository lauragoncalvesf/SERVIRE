import {
  Bell,
  Check,
  CheckCheck
} from "lucide-react"

import {
  useEffect,
  useState
} from "react"

import {
  useNavigate
} from "react-router-dom"

import api from "../services/api"
import {
  formatarData
} from "../utils"

const INTERVALO_ATUALIZACAO = 60000

export default function NotificacoesMenu() {

  const [
    notificacoes,
    setNotificacoes
  ] = useState([])

  const [
    quantidadeNaoLidas,
    setQuantidadeNaoLidas
  ] = useState(0)

  const [
    aberto,
    setAberto
  ] = useState(false)

  const [
    carregando,
    setCarregando
  ] = useState(false)

  const [
    erro,
    setErro
  ] = useState("")

  const navigate = useNavigate()

  useEffect(() => {

    carregarQuantidadeNaoLidas()

    const intervalo = setInterval(() => {

      if (document.visibilityState !== "visible") {
        return
      }

      carregarQuantidadeNaoLidas()

      if (aberto) {
        carregarNotificacoes()
      }

    }, INTERVALO_ATUALIZACAO)

    return () => {
      clearInterval(intervalo)
    }

  }, [aberto])

  async function carregarQuantidadeNaoLidas() {

    try {

      const response =
        await api.get(
          "/notificacoes/nao-lidas"
        )

      setQuantidadeNaoLidas(
        response.data.quantidade
      )

    } catch (error) {

      console.error(
        "Erro ao carregar quantidade de notificações:",
        error
      )

    }
  }

  async function carregarNotificacoes() {

    try {

      setCarregando(true)
      setErro("")

      const response =
        await api.get(
          "/notificacoes"
        )

      setNotificacoes(
        response.data
      )

    } catch (error) {

      setErro(
        error.response?.data?.mensagem ||
        "Erro ao carregar notificações"
      )

    } finally {

      setCarregando(false)

    }
  }

  async function alternarMenu() {

    const novoEstado = !aberto

    setAberto(
      novoEstado
    )

    if (novoEstado) {
      await carregarNotificacoes()
    }
  }

  async function abrirNotificacao(
    notificacao
  ) {

    try {

      if (!notificacao.lidaEm) {

        await api.patch(
          `/notificacoes/${notificacao.id}/lida`
        )

        setNotificacoes(
          (anteriores) =>
            anteriores.map(
              (item) =>
                item.id ===
                notificacao.id
                  ? {
                      ...item,
                      lidaEm:
                        new Date()
                          .toISOString()
                    }
                  : item
            )
        )

        setQuantidadeNaoLidas(
          (quantidade) =>
            Math.max(
              0,
              quantidade - 1
            )
        )
      }

      setAberto(false)

      if (
        notificacao.eventoId
      ) {

        navigate(
          `/eventos/${notificacao.eventoId}/escalas`
        )
      }

    } catch (error) {

      setErro(
        error.response?.data?.mensagem ||
        "Erro ao abrir notificação"
      )
    }
  }

  async function marcarTodasComoLidas() {

    try {

      await api.patch(
        "/notificacoes/lidas/todas"
      )

      setNotificacoes(
        (anteriores) =>
          anteriores.map(
            (item) => ({
              ...item,
              lidaEm:
                item.lidaEm ||
                new Date()
                  .toISOString()
            })
          )
      )

      setQuantidadeNaoLidas(0)

    } catch (error) {

      setErro(
        error.response?.data?.mensagem ||
        "Erro ao marcar notificações como lidas"
      )
    }
  }

  return (
    <div className="relative">

      <button
        type="button"
        onClick={alternarMenu}
        className={`
          relative
          w-10 h-10
          flex
          items-center
          justify-center
          rounded-xl
          transition

          ${
            aberto
              ? `
                bg-[#EFE8D6]
                text-[#3B7EC7]
              `
              : `
                text-[#3B7EC7]
                hover:bg-[#EFE8D6]
              `
          }
        `}
        title="Notificações"
      >

        <Bell size={21} />

        {quantidadeNaoLidas > 0 && (
          <span
            className="
              absolute
              -top-1
              -right-1
              min-w-5
              h-5
              px-1
              flex
              items-center
              justify-center
              rounded-full
              bg-red-500
              border-2
              border-white
              text-white
              text-[10px]
              font-bold
            "
          >
            {quantidadeNaoLidas > 99
              ? "99+"
              : quantidadeNaoLidas}
          </span>
        )}

      </button>

      {aberto && (
        <div
          className="
            fixed
            sm:absolute

            top-20
            sm:top-12

            left-3
            right-3

            sm:left-auto
            sm:right-0

            z-50

            sm:w-[380px]
            sm:max-w-[calc(100vw-2rem)]

            bg-white
            border
            border-[#EFE8D6]
            rounded-2xl
            shadow-xl
            overflow-hidden
          "
        >

          <div
            className="
              h-1.5
              bg-[#3B7EC7]
            "
          />

          <div
            className="
              p-4
              border-b
              border-[#EFE8D6]
              flex
              items-center
              justify-between
              gap-3
            "
          >

            <div>

              <h2
                className="
                  font-bold
                  text-slate-900
                "
              >
                Notificações
              </h2>

              <p
                className="
                  text-xs
                  text-slate-500
                  mt-1
                "
              >
                {quantidadeNaoLidas === 0
                  ? "Você está em dia"
                  : `${quantidadeNaoLidas} não lida(s)`}
              </p>

            </div>

            {quantidadeNaoLidas > 0 && (
              <button
                type="button"
                onClick={
                  marcarTodasComoLidas
                }
                className="
                  inline-flex
                  items-center
                  gap-1.5
                  text-xs
                  font-semibold
                  text-[#3B7EC7]
                  hover:text-[#2F6BAA]
                  transition
                "
              >

                <CheckCheck size={14} />

                <span
                  className="
                    hidden
                    sm:inline
                  "
                >
                  Marcar todas
                </span>

              </button>
            )}

          </div>

          {erro && (
            <div
              className="
                m-3
                bg-red-50
                border
                border-red-200
                text-red-700
                rounded-xl
                p-3
                text-sm
              "
            >
              {erro}
            </div>
          )}

          {carregando && (
            <div
              className="
                p-5
                text-sm
                text-slate-500
              "
            >
              Carregando notificações...
            </div>
          )}

          {!carregando &&
            notificacoes.length === 0 && (

              <div
                className="
                  px-6
                  py-10
                  text-center
                "
              >

                <div
                  className="
                    w-12 h-12
                    mx-auto
                    rounded-2xl
                    bg-[#EFE8D6]
                    text-[#3B7EC7]
                    flex
                    items-center
                    justify-center
                  "
                >
                  <Bell size={22} />
                </div>

                <p
                  className="
                    text-sm
                    font-semibold
                    text-slate-700
                    mt-4
                  "
                >
                  Nenhuma notificação
                </p>

                <p
                  className="
                    text-xs
                    text-slate-400
                    mt-1
                  "
                >
                  Novas informações aparecerão aqui.
                </p>

              </div>
            )}

          {!carregando &&
            notificacoes.length > 0 && (

              <div
                className="
                  max-h-[430px]
                  overflow-y-auto
                "
              >

                {notificacoes.map(
                  (notificacao) => (

                    <button
                      type="button"
                      key={notificacao.id}
                      onClick={() =>
                        abrirNotificacao(
                          notificacao
                        )
                      }
                      className={`
                        w-full
                        text-left
                        p-4
                        border-b
                        border-slate-100
                        transition

                        ${
                          notificacao.lidaEm
                            ? `
                              bg-white
                              hover:bg-slate-50
                            `
                            : `
                              bg-[#F3F8FE]
                              hover:bg-[#EAF3FC]
                            `
                        }
                      `}
                    >

                      <div
                        className="
                          flex
                          items-start
                          gap-3
                        "
                      >

                        <div
                          className={`
                            w-9 h-9
                            rounded-xl
                            flex
                            items-center
                            justify-center
                            shrink-0

                            ${
                              notificacao.lidaEm
                                ? `
                                  bg-slate-100
                                  text-slate-400
                                `
                                : `
                                  bg-[#EFE8D6]
                                  text-[#3B7EC7]
                                `
                            }
                          `}
                        >
                          <Bell size={16} />
                        </div>

                        <div
                          className="
                            flex-1
                            min-w-0
                          "
                        >

                          <div
                            className="
                              flex
                              items-start
                              gap-2
                            "
                          >

                            <p
                              className="
                                text-sm
                                font-semibold
                                text-slate-900
                                leading-snug
                                flex-1
                              "
                            >
                              {notificacao.titulo}
                            </p>

                            {!notificacao.lidaEm && (
                              <span
                                className="
                                  w-2 h-2
                                  rounded-full
                                  bg-[#3B7EC7]
                                  shrink-0
                                  mt-1.5
                                "
                              />
                            )}

                          </div>

                          <p
                            className="
                              text-sm
                              text-slate-600
                              mt-1
                              leading-relaxed
                            "
                          >
                            {notificacao.mensagem}
                          </p>

                          <div
                            className="
                              mt-2
                              flex
                              items-center
                              justify-between
                              gap-3
                            "
                          >

                            <p
                              className="
                                text-xs
                                text-slate-400
                              "
                            >
                              {formatarData(
                                notificacao.criadoEm
                              )}
                            </p>

                            {notificacao.lidaEm && (
                              <span
                                className="
                                  inline-flex
                                  items-center
                                  gap-1
                                  text-[11px]
                                  font-medium
                                  text-emerald-600
                                "
                              >
                                <Check size={12} />

                                Lida
                              </span>
                            )}

                          </div>

                        </div>

                      </div>

                    </button>
                  )
                )}

              </div>
            )}

        </div>
      )}

    </div>
  )
}
