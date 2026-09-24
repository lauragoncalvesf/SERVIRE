import { useEffect, useState } from "react"

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  UserRoundCheck,
  XCircle
} from "lucide-react"

import AppLayout from "../components/AppLayout"
import ConfirmacaoModal from "../components/ConfirmacaoModal"
import api from "../services/api"
import {
  formatarData,
  formatarStatusItem
} from "../utils"

export default function MinhasEscalas() {
  const [escalas, setEscalas] = useState([])
  const [usuario, setUsuario] = useState(null)

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState("")
  const [respondendo, setRespondendo] = useState(null)
  const [escalaParaSair, setEscalaParaSair] = useState(null)
  const [saindoDaEscala, setSaindoDaEscala] = useState(false)

  useEffect(() => {
    carregarEscalas()
  }, [])

  async function carregarEscalas() {
    try {
      setCarregando(true)
      setErro("")

      const response = await api.get("/minhas-escalas")

      setUsuario(response.data.usuario)
      setEscalas(response.data.escalas)

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao carregar suas escalas"
      )
    } finally {
      setCarregando(false)
    }
  }

  async function responder(itemId, status) {
    try {
      setRespondendo(itemId)
      setErro("")

      await api.patch(
        `/escalas/itens/${itemId}/resposta`,
        {
          status
        }
      )

      await carregarEscalas()

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao responder escala"
      )
    } finally {
      setRespondendo(null)
    }
  }

  async function sairDaEscala(itemId) {
    try {
      setSaindoDaEscala(true)
      setErro("")

      await api.patch(
        `/escalas/itens/${itemId}/sair`
      )

      setEscalaParaSair(null)
      await carregarEscalas()

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao sair da escala"
      )
    } finally {
      setSaindoDaEscala(false)
    }
  }

  return (
    <AppLayout
      titulo="Minhas Escalas"
      subtitulo={
        usuario
          ? `Escalas de ${usuario.nome}`
          : "Acompanhe suas participações"
      }
    >

      {erro && (
        <div className="mb-5 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          {erro}
        </div>
      )}

      {carregando && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <p className="text-slate-500">
            Carregando suas escalas...
          </p>
        </div>
      )}

      {!carregando && escalas.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">

          <h2 className="text-lg font-semibold text-slate-900">
            Nenhuma escala encontrada
          </h2>

          <p className="text-slate-500 mt-2">
            Quando você for escalado, suas participações aparecerão aqui.
          </p>

        </div>
      )}

      {!carregando && escalas.length > 0 && (
        <div className="space-y-4">

          {escalas.map((escala) => (
            <section
              key={escala.itemId}
              className="
                bg-white
                border border-slate-200
                rounded-2xl
                shadow-sm
                overflow-hidden
              "
            >
              <div
                className={`
                  h-1.5
                  ${
                    escala.status === "CONFIRMADO"
                      ? "bg-emerald-500"
                      : escala.status === "RECUSADO"
                      ? "bg-red-500"
                      : "bg-amber-400"
                  }
                `}
              />

              <div className="p-4 sm:p-5">

                <div className="flex flex-col gap-4">

                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0">

                      <div className="flex items-center gap-2 flex-wrap">

                        <span
                          className="
                            text-xs
                            font-semibold
                            bg-slate-100
                            text-slate-700
                            px-2.5 py-1
                            rounded-full
                          "
                        >
                          {escala.pastoral.nome}
                        </span>

                        <span
                          className={`
                            inline-flex
                            items-center
                            gap-1
                            text-xs
                            font-semibold
                            px-2.5 py-1
                            rounded-full

                            ${
                              escala.status === "CONFIRMADO"
                                ? "bg-emerald-50 text-emerald-700"
                                : escala.status === "RECUSADO"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700"
                            }
                          `}
                        >
                          {escala.status === "CONFIRMADO" && (
                            <CheckCircle2 size={13} />
                          )}

                          {escala.status === "RECUSADO" && (
                            <XCircle size={13} />
                          )}

                          {escala.status === "PENDENTE" && (
                            <Clock3 size={13} />
                          )}

                          {formatarStatusItem(
                            escala.status
                          )}
                        </span>

                      </div>

                      <h2
                        className="
                          text-lg
                          sm:text-xl
                          font-bold
                          text-slate-900
                          mt-3
                          leading-snug
                        "
                      >
                        {escala.evento.titulo}
                      </h2>

                    </div>

                  </div>

                  <div className="grid gap-3">

                    <div className="flex items-start gap-3">

                      <div
                        className="
                          w-9 h-9
                          rounded-lg
                          bg-blue-50
                          text-blue-700
                          flex
                          items-center
                          justify-center
                          shrink-0
                        "
                      >
                        <CalendarDays size={17} />
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-400">
                          Data e horário
                        </p>

                        <p className="text-sm font-medium text-slate-700 mt-0.5">
                          {formatarData(
                            escala.evento.dataHora
                          )}
                        </p>
                      </div>

                    </div>

                    {escala.evento.local && (
                      <div className="flex items-start gap-3">

                        <div
                          className="
                            w-9 h-9
                            rounded-lg
                            bg-violet-50
                            text-violet-700
                            flex
                            items-center
                            justify-center
                            shrink-0
                          "
                        >
                          <MapPin size={17} />
                        </div>

                        <div>
                          <p className="text-xs font-medium text-slate-400">
                            Local
                          </p>

                          <p className="text-sm font-medium text-slate-700 mt-0.5">
                            {escala.evento.local}
                          </p>
                        </div>

                      </div>
                    )}

                    <div className="flex items-start gap-3">

                      <div
                        className="
                          w-9 h-9
                          rounded-lg
                          bg-slate-100
                          text-slate-700
                          flex
                          items-center
                          justify-center
                          shrink-0
                        "
                      >
                        <UserRoundCheck size={17} />
                      </div>

                      <div>
                        <p className="text-xs font-medium text-slate-400">
                          Sua função
                        </p>

                        <p className="text-sm font-semibold text-slate-900 mt-0.5">
                          {escala.funcao.nome}
                        </p>
                      </div>

                    </div>

                  </div>

                  {escala.status === "PENDENTE" && (
                    <div
                      className="
                        pt-4
                        border-t border-slate-100
                        grid
                        grid-cols-1
                        sm:grid-cols-2
                        gap-2
                      "
                    >

                      <button
                        type="button"
                        onClick={() =>
                          responder(
                            escala.itemId,
                            "CONFIRMADO"
                          )
                        }
                        disabled={
                          respondendo === escala.itemId
                        }
                        className="
                          w-full
                          inline-flex
                          items-center
                          justify-center
                          gap-2
                          bg-emerald-600
                          text-white
                          px-4 py-3
                          rounded-xl
                          text-sm
                          font-semibold
                          hover:bg-emerald-700
                          disabled:opacity-60
                          transition
                        "
                      >
                        <CheckCircle2 size={17} />

                        {respondendo === escala.itemId
                          ? "Respondendo..."
                          : "Confirmar participação"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          responder(
                            escala.itemId,
                            "RECUSADO"
                          )
                        }
                        disabled={
                          respondendo === escala.itemId
                        }
                        className="
                          w-full
                          inline-flex
                          items-center
                          justify-center
                          gap-2
                          border border-red-200
                          bg-red-50
                          text-red-700
                          px-4 py-3
                          rounded-xl
                          text-sm
                          font-semibold
                          hover:bg-red-100
                          disabled:opacity-60
                          transition
                        "
                      >
                        <XCircle size={17} />

                        Recusar
                      </button>

                    </div>
                  )}

                  {escala.status === "CONFIRMADO" && (
                    <div className="pt-4 border-t border-slate-100">

                      <div
                        className="
                          mb-3
                          bg-emerald-50
                          border border-emerald-100
                          text-emerald-800
                          rounded-xl
                          px-3 py-2.5
                          text-sm
                          flex
                          items-center
                          gap-2
                        "
                      >
                        <CheckCircle2
                          size={17}
                          className="shrink-0"
                        />

                        Sua participação está confirmada.
                      </div>

                      <button
                        type="button"
                        onClick={() => setEscalaParaSair(escala)}
                        className="
                          w-full
                          sm:w-auto
                          border border-red-200
                          text-red-700
                          px-4 py-2.5
                          rounded-xl
                          text-sm
                          font-medium
                          hover:bg-red-50
                          transition
                        "
                      >
                        Sair da escala
                      </button>

                    </div>
                  )}

                </div>

              </div>
            </section>
          ))}

        </div>
      )}

      <ConfirmacaoModal
        aberto={Boolean(escalaParaSair)}
        titulo="Sair da escala"
        mensagem={escalaParaSair
          ? `Sua participação em “${escalaParaSair.evento.titulo}” será removida e a vaga ficará disponível para outra pessoa.`
          : ""}
        textoConfirmar="Sair da escala"
        carregando={saindoDaEscala}
        onConfirmar={() => sairDaEscala(escalaParaSair.itemId)}
        onFechar={() => setEscalaParaSair(null)}
      />

    </AppLayout>
  )
}
