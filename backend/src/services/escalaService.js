import prisma from  "../lib/prisma.js";

export const STATUS_ESCALA_EDITAVEIS = [
  "RASCUNHO",
  "ABERTA",
  "PREENCHIDA",
  "COMPLETA"
]

export function escalaPodeSerEditada(status) {
  return STATUS_ESCALA_EDITAVEIS.includes(status)
}

export async function atualizarStatusAutomaticoEscala(escalaId, banco = prisma) {
  const escala = await banco.escala.findUnique({
    where: {
      id: escalaId
    },
    include: {
      pastoral: true,

      funcoes: {
        include: {
          itens: {
            where: {
              status: {
                in: ["PENDENTE", "CONFIRMADO"]
              }
            }
          }
        }
      }
    }
  })

  if (!escala) {
    return
  }

  if (
    escala.status === "RASCUNHO" ||
    escala.status === "ENCERRADA" ||
    escala.status === "CANCELADA"
  ) {
    return
  }

  const todasFuncoesPreenchidas =
    escala.funcoes.length > 0 &&
    escala.funcoes.every(
      (funcao) =>
        funcao.itens.length >= funcao.quantidadeVagas
    )

  if (!todasFuncoesPreenchidas) {
    if (escala.status !== "ABERTA") {
      await banco.escala.update({
        where: {
          id: escalaId
        },
        data: {
          status: "ABERTA"
        }
      })
    }

    return
  }

  if (!escala.pastoral.exigeConfirmacao) {
    await banco.escala.update({
      where: {
        id: escalaId
      },
      data: {
        status: "COMPLETA"
      }
    })

    return
  }

  const todosItens = escala.funcoes.flatMap(
    (funcao) => funcao.itens
  )

  const todosConfirmados =
    todosItens.length > 0 &&
    todosItens.every(
      (item) => item.status === "CONFIRMADO"
    )

  await banco.escala.update({
    where: {
      id: escalaId
    },
    data: {
      status: todosConfirmados
        ? "COMPLETA"
        : "PREENCHIDA"
    }
  })
}