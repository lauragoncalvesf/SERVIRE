export function tratarErros(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  if (error.code === "P2002") return res.status(409).json({ mensagem: "Cadastro duplicado" })
  if (error.code === "P2034") return res.status(409).json({ mensagem: "Conflito de atualização. Tente novamente." })
  const status = Number.isInteger(error.status) &&
    error.status >= 400 && error.status <= 599
    ? error.status
    : 500

  if (status >= 500) {
    console.error({ nome: error.name, codigo: error.code ?? "INTERNO" })
  }

  if (error.publica && status < 500) return res.status(status).json({ mensagem: error.message })

  let mensagem = status >= 500
    ? "Erro interno do servidor"
    : "Requisição inválida"

  if (error.type === "entity.parse.failed") {
    mensagem = "JSON inválido no corpo da requisição"
  } else if (status === 413) {
    mensagem = "Corpo da requisição excede o tamanho permitido"
  }

  return res.status(status).json({ mensagem })
}
