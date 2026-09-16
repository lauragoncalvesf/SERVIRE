import prisma from "../lib/prisma.js"

export async function criarNotificacao({
  tipo,
  titulo,
  mensagem,
  usuarioId,
  eventoId = null,
  escalaId = null,
  itemEscalaId = null
}, banco = prisma) {
  return banco.notificacao.create({
    data: {
      tipo,
      titulo,
      mensagem,
      usuarioId,
      eventoId,
      escalaId,
      itemEscalaId
    }
  })
}

export async function criarNotificacaoSeNaoExistir({
  tipo,
  titulo,
  mensagem,
  usuarioId,
  eventoId = null,
  escalaId = null,
  itemEscalaId = null
}, banco = prisma) {
  const existente =
    await banco.notificacao.findFirst({
      where: {
        tipo,
        usuarioId,
        eventoId,
        escalaId,
        itemEscalaId,
        lidaEm: null
      }
    })

  if (existente) {
    return existente
  }

  return criarNotificacao({
    tipo,
    titulo,
    mensagem,
    usuarioId,
    eventoId,
    escalaId,
    itemEscalaId
  }, banco)
}