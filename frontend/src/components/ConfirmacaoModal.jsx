import { useEffect } from "react"
import { AlertTriangle, X } from "lucide-react"

export default function ConfirmacaoModal({
  aberto,
  titulo,
  mensagem,
  textoConfirmar = "Confirmar",
  textoCancelar = "Voltar",
  carregando = false,
  onConfirmar,
  onFechar
}) {
  useEffect(() => {
    if (!aberto) return undefined

    function fecharComEscape(event) {
      if (event.key === "Escape" && !carregando) onFechar()
    }

    document.addEventListener("keydown", fecharComEscape)
    return () => document.removeEventListener("keydown", fecharComEscape)
  }, [aberto, carregando, onFechar])

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !carregando) onFechar()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacao-modal-titulo"
        aria-describedby="confirmacao-modal-mensagem"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
            <AlertTriangle size={21} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 id="confirmacao-modal-titulo" className="text-lg font-bold text-slate-900">
              {titulo}
            </h2>
            <p id="confirmacao-modal-mensagem" className="mt-2 text-sm leading-relaxed text-slate-600">
              {mensagem}
            </p>
          </div>

          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50"
            aria-label="Fechar confirmação"
          >
            <X size={19} />
          </button>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onFechar}
            disabled={carregando}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {textoCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={carregando}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
          >
            {carregando ? "Aguarde..." : textoConfirmar}
          </button>
        </div>
      </section>
    </div>
  )
}
