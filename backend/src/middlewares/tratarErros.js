export function tratarErros(error, req, res, next) {
  if (res.headersSent) {
    return next(error)
  }

  const status = Number.isInteger(error.status) &&
    error.status >= 400 && error.status <= 599
    ? error.status
    : 500

  if (status >= 500) {
    console.error(error)
  }

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
