export function statusItemAtivo(status) {
  return [
    "PENDENTE",
    "CONFIRMADO"
  ].includes(status)
}

export function statusItemFinalizado(status) {
  return [
    "RECUSADO",
    "SUBSTITUIDO",
    "REMOVIDO"
  ].includes(status)
}

export function escalaEditavel(status) {
  return [
    "RASCUNHO",
    "ABERTA",
    "PREENCHIDA",
    "COMPLETA"
  ].includes(status)
}

export function escalaFinalizada(status) {
  return [
    "ENCERRADA",
    "CANCELADA"
  ].includes(status)
}

export function escalaAceitaResposta(status) {
  return [
    "ABERTA",
    "PREENCHIDA"
  ].includes(status)
}