import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import {
  ArrowRight,
  CheckCircle2,
  Church,
  Plus,
  ShieldCheck,
  UserRound,
  Users,
  X
} from "lucide-react"

import AppLayout from "../components/AppLayout"
import api from "../services/api"
import { useAuth } from "../contexts/auth"
import { textoPreenchido } from "../utils"

export default function Pastorais() {

  const navigate = useNavigate()

  const { usuario } = useAuth()

  const [pastorais, setPastorais] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState("")

  const [mostrarFormulario, setMostrarFormulario] = useState(false)

  const [nome, setNome] = useState("")
  const [descricao, setDescricao] = useState("")

  const [salvando, setSalvando] = useState(false)
  const [erroFormulario, setErroFormulario] = useState("")

  async function criarPastoral(event) {
    event.preventDefault()

    try {
      setSalvando(true)
      setErroFormulario("")

      if (!textoPreenchido(nome)) {
        setErroFormulario(
          "Informe o nome da pastoral"
        )
        return
      }

      await api.post("/pastorais", {
        nome: nome.trim(),
        descricao:
          descricao?.trim() || null
      })

      setNome("")
      setDescricao("")
      setMostrarFormulario(false)

      await carregarPastorais()

    } catch (error) {
      setErroFormulario(
        error.response?.data?.mensagem ||
        "Erro ao criar pastoral"
      )
    } finally {
      setSalvando(false)
    }
  }

  const carregarPastorais = useCallback(async () => {
    try {
      setCarregando(true)
      setErro("")

      const response =
        await api.get("/pastorais")

      setPastorais(response.data)

    } catch (error) {
      setErro(
        error.response?.data?.mensagem ||
        "Erro ao carregar pastorais"
      )
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarPastorais()
  }, [carregarPastorais])

  return (
    <AppLayout
      titulo="Pastorais"
      subtitulo="Gerencie as pastorais da paróquia"
    >

      <div className="space-y-6">

        <div
          className="
            flex
            flex-col
            gap-4
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >

          <div>

            <div className="flex items-center gap-2">

              <h2
                className="
                  text-lg
                  font-bold
                  text-slate-900
                "
              >
                Pastorais
              </h2>

              {!carregando &&
                pastorais.length > 0 && (
                  <span
                    className="
                      bg-slate-100
                      text-slate-600
                      text-xs
                      font-semibold
                      px-2.5 py-1
                      rounded-full
                    "
                  >
                    {pastorais.length}
                  </span>
                )}

            </div>

            <p className="text-sm text-slate-500 mt-1">
              Consulte e organize as pastorais da paróquia.
            </p>

          </div>

          {usuario?.tipo === "ADMIN" && (
            <button
              type="button"
              onClick={() => {
                setErroFormulario("")
                setMostrarFormulario(true)
              }}
              className="
                w-full
                sm:w-auto
                inline-flex
                items-center
                justify-center
                gap-2
                bg-[#3B7EC7]
                text-white
                px-4 py-2.5
                rounded-xl
                text-sm
                font-semibold
                hover:bg-[#2F6BAA]
                transition
              "
            >
              <Plus size={17} />

              Nova pastoral
            </button>
          )}

        </div>

        {carregando && (
          <div
            className="
              bg-white
              border border-slate-200
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <div
              className="
                flex
                items-center
                gap-3
                text-slate-500
              "
            >

              <div
                className="
                  w-10 h-10
                  rounded-xl
                  bg-slate-100
                  flex
                  items-center
                  justify-center
                "
              >
                <Church size={18} />
              </div>

              <p>
                Carregando pastorais...
              </p>

            </div>

          </div>
        )}

        {erro && (
          <div
            className="
              bg-red-50
              border border-red-200
              text-red-700
              rounded-xl
              p-4
            "
          >
            {erro}
          </div>
        )}

        {!carregando &&
          !erro &&
          pastorais.length === 0 && (
            <div
              className="
                bg-white
                border border-slate-200
                rounded-2xl
                p-8
                sm:p-10
                text-center
                shadow-sm
              "
            >

              <div
                className="
                  w-14 h-14
                  mx-auto
                  bg-slate-100
                  rounded-2xl
                  flex
                  items-center
                  justify-center
                  text-slate-500
                "
              >
                <Church size={24} />
              </div>

              <h2
                className="
                  text-lg
                  font-bold
                  text-slate-900
                  mt-4
                "
              >
                Nenhuma pastoral cadastrada
              </h2>

              <p
                className="
                  text-sm
                  text-slate-500
                  mt-2
                  max-w-sm
                  mx-auto
                "
              >
                As pastorais cadastradas aparecerão aqui.
              </p>

              {usuario?.tipo === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => {
                    setErroFormulario("")
                    setMostrarFormulario(true)
                  }}
                  className="
                    mt-5
                    inline-flex
                    items-center
                    justify-center
                    gap-2
                    bg-[#3B7EC7]
                    text-white
                    px-4 py-2.5
                    rounded-xl
                    text-sm
                    font-semibold
                    hover:bg-[#2F6BAA]
                    transition
                  "
                >
                  <Plus size={16} />

                  Cadastrar primeira pastoral
                </button>
              )}

            </div>
          )}

        {!carregando &&
          !erro &&
          pastorais.length > 0 && (

            <div
              className="
                grid
                grid-cols-1
                gap-4
                md:grid-cols-2
                xl:grid-cols-3
              "
            >

              {pastorais.map((pastoral) => {

                const papel =
                  pastoral.papel ||
                  pastoral.meuPapel ||
                  pastoral.membroAtual?.papel

                const ehCoordenador =
                  pastoral.podeGerenciar ||
                  papel === "COORDENADOR"

                return (
                  <button
                    type="button"
                    key={pastoral.id}
                    onClick={() =>
                      navigate(
                        `/pastorais/${pastoral.id}`
                      )
                    }
                    className="
                      group
                      w-full
                      h-full
                      flex
                      flex-col
                      text-left
                      bg-white
                      border border-slate-200
                      rounded-2xl
                      overflow-hidden
                      shadow-sm
                      hover:shadow-md
                      hover:border-slate-300
                      transition
                    "
                  >

                    <div
                      className={`
                        h-1.5
                        ${
                          pastoral.ativa
                            ? "bg-emerald-500"
                            : "bg-slate-300"
                        }
                      `}
                    />

                    <div className="p-4 sm:p-5 flex flex-col flex-1">

                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-4
                        "
                      >

                        <div
                          className="
                            flex
                            items-start
                            gap-3
                            min-w-0
                          "
                        >

                          <div
                            className="
                              w-11 h-11
                              shrink-0
                              rounded-xl
                              bg-slate-100
                              text-slate-700
                              flex
                              items-center
                              justify-center
                            "
                          >
                            <Church size={20} />
                          </div>

                          <div className="min-w-0">

                            <h3
                              className="
                                text-base
                                sm:text-lg
                                font-bold
                                text-slate-900
                                break-words
                              "
                            >
                              {pastoral.nome}
                            </h3>

                            <div
                              className="
                                flex
                                items-center
                                gap-2
                                flex-wrap
                                mt-2
                              "
                            >

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
                                    pastoral.ativa
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-slate-100 text-slate-500"
                                  }
                                `}
                              >

                                {pastoral.ativa && (
                                  <CheckCircle2
                                    size={12}
                                  />
                                )}

                                {pastoral.ativa
                                  ? "Ativa"
                                  : "Inativa"}

                              </span>

                              {usuario?.tipo !==
                                "ADMIN" &&
                                ehCoordenador && (
                                  <span
                                    className="
                                      inline-flex
                                      items-center
                                      gap-1
                                      bg-blue-50
                                      text-blue-700
                                      text-xs
                                      font-semibold
                                      px-2.5 py-1
                                      rounded-full
                                    "
                                  >
                                    <ShieldCheck
                                      size={12}
                                    />

                                    Coordenador
                                  </span>
                                )}

                              {usuario?.tipo !==
                                "ADMIN" &&
                                !ehCoordenador &&
                                papel && (
                                  <span
                                    className="
                                      inline-flex
                                      items-center
                                      gap-1
                                      bg-slate-100
                                      text-slate-600
                                      text-xs
                                      font-semibold
                                      px-2.5 py-1
                                      rounded-full
                                    "
                                  >
                                    <UserRound
                                      size={12}
                                    />

                                    Membro
                                  </span>
                                )}

                            </div>

                          </div>

                        </div>

                        <div
                          className="
                            w-9 h-9
                            shrink-0
                            rounded-full
                            flex
                            items-center
                            justify-center
                            text-slate-400
                            group-hover:text-slate-800
                            group-hover:bg-slate-100
                            transition
                          "
                        >
                          <ArrowRight size={17} />
                        </div>

                      </div>

                      <p
                        className="
                          text-sm
                          text-slate-500
                          leading-relaxed
                          mt-4
                          min-h-10
                        "
                      >
                        {pastoral.descricao ||
                          "Sem descrição cadastrada."}
                      </p>

                      <div
                        className="
                          mt-auto
                          pt-4
                          border-t border-slate-100
                          flex
                          items-center
                          justify-between
                          gap-4
                        "
                      >

                        <div
                          className="
                            flex
                            items-center
                            gap-3
                          "
                        >

                          <div
                            className="
                              w-9 h-9
                              rounded-xl
                              bg-slate-100
                              text-slate-600
                              flex
                              items-center
                              justify-center
                            "
                          >
                            <Users size={17} />
                          </div>

                          <div>

                            <p
                              className="
                                text-xs
                                font-medium
                                text-slate-400
                              "
                            >
                              Membros
                            </p>

                            <p
                              className="
                                text-base
                                font-bold
                                text-slate-900
                              "
                            >
                              {
                                pastoral._count
                                  ?.membros ?? 0
                              }
                            </p>

                          </div>

                        </div>

                        <span
                          className="
                            text-xs
                            font-semibold
                            text-slate-500
                            group-hover:text-slate-900
                            transition
                          "
                        >
                          Ver detalhes
                        </span>

                      </div>

                    </div>

                  </button>
                )
              })}

            </div>
          )}

      </div>

      {mostrarFormulario && (
        <div
          className="
            fixed inset-0
            z-50
            flex
            items-end
            sm:items-center
            justify-center
            bg-black/40
            p-0
            sm:p-4
          "
        >

          <div
            className="
              w-full
              sm:max-w-lg
              bg-white
              rounded-t-3xl
              sm:rounded-2xl
              shadow-xl
              overflow-hidden
            "
          >

            <div className="h-1.5 bg-[#3B7EC7]" />

            <div className="p-5 sm:p-6">

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-4
                "
              >

                <div>

                  <div
                    className="
                      w-10 h-10
                      rounded-xl
                      bg-slate-100
                      text-slate-700
                      flex
                      items-center
                      justify-center
                      mb-3
                    "
                  >
                    <Church size={19} />
                  </div>

                  <h2
                    className="
                      text-xl
                      font-bold
                      text-slate-900
                    "
                  >
                    Nova pastoral
                  </h2>

                  <p
                    className="
                      text-sm
                      text-slate-500
                      mt-1
                    "
                  >
                    Cadastre uma pastoral na sua paróquia.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormulario(false)
                    setErroFormulario("")
                  }}
                  className="
                    w-9 h-9
                    shrink-0
                    rounded-full
                    flex
                    items-center
                    justify-center
                    text-slate-500
                    hover:bg-slate-100
                    hover:text-slate-900
                    transition
                  "
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>

              </div>

              <form
                onSubmit={criarPastoral}
                className="space-y-5 mt-6"
              >

                <div>

                  <label
                    className="
                      block
                      text-sm
                      font-semibold
                      text-slate-700
                      mb-2
                    "
                  >
                    Nome da pastoral
                  </label>

                  <input
                    type="text"
                    value={nome}
                    onChange={(event) =>
                      setNome(
                        event.target.value
                      )
                    }
                    required
                    placeholder="Ex.: PASCOM"
                    className="
                      w-full
                      border border-slate-300
                      rounded-xl
                      px-4 py-3
                      text-sm
                      outline-none
                      focus:border-slate-500
                      focus:ring-2
                      focus:ring-slate-200
                      transition
                    "
                  />

                </div>

                <div>

                  <label
                    className="
                      block
                      text-sm
                      font-semibold
                      text-slate-700
                      mb-2
                    "
                  >
                    Descrição
                  </label>

                  <textarea
                    value={descricao}
                    onChange={(event) =>
                      setDescricao(
                        event.target.value
                      )
                    }
                    placeholder="Ex.: Pastoral responsável pela comunicação da paróquia"
                    rows={4}
                    className="
                      w-full
                      border border-slate-300
                      rounded-xl
                      px-4 py-3
                      text-sm
                      outline-none
                      resize-none
                      focus:border-slate-500
                      focus:ring-2
                      focus:ring-slate-200
                      transition
                    "
                  />

                </div>

                {erroFormulario && (
                  <div
                    className="
                      bg-red-50
                      border border-red-200
                      text-red-700
                      rounded-xl
                      p-3
                      text-sm
                    "
                  >
                    {erroFormulario}
                  </div>
                )}

                <div
                  className="
                    pt-2
                    grid
                    grid-cols-1
                    sm:grid-cols-2
                    gap-3
                  "
                >

                  <button
                    type="button"
                    onClick={() => {
                      setMostrarFormulario(false)
                      setErroFormulario("")
                    }}
                    className="
                      order-2
                      sm:order-1
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
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={salvando}
                    className="
                      order-1
                      sm:order-2
                      w-full
                      bg-[#3B7EC7]
                      text-white
                      px-4 py-3
                      rounded-xl
                      text-sm
                      font-semibold
                      hover:bg-[#2F6BAA]
                      disabled:opacity-60
                      disabled:cursor-not-allowed
                      transition
                    "
                  >
                    {salvando
                      ? "Salvando..."
                      : "Cadastrar pastoral"}
                  </button>

                </div>

              </form>

            </div>

          </div>

        </div>
      )}

    </AppLayout>
  )
}