import prisma from "../lib/prisma.js"

export async function listarMinhasNotificacoes(req, res) {
  try {
    const notificacoes =
      await prisma.notificacao.findMany({
        where: {
          usuarioId: req.usuarioId
        },
        orderBy: {
          criadoEm: "desc"
        },
        take: 50
      })

    return res.json(notificacoes)

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem:
        "Erro ao carregar notificações"
    })
  }
}

export async function contarNotificacoesNaoLidas(
  req,
  res
) {
  try {
    const quantidade =
      await prisma.notificacao.count({
        where: {
          usuarioId: req.usuarioId,
          lidaEm: null
        }
      })

    return res.json({
      quantidade
    })

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem:
        "Erro ao contar notificações"
    })
  }
}

export async function marcarNotificacaoComoLida(
  req,
  res
) {
  try {
    const notificacaoId =
      Number(req.params.id)

    const notificacao =
      await prisma.notificacao.findFirst({
        where: {
          id: notificacaoId,
          usuarioId: req.usuarioId
        }
      })

    if (!notificacao) {
      return res.status(404).json({
        mensagem:
          "Notificação não encontrada"
      })
    }

    const atualizada =
      await prisma.notificacao.update({
        where: {
          id: notificacaoId
        },
        data: {
          lidaEm:
            notificacao.lidaEm || new Date()
        }
      })

    return res.json(atualizada)

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem:
        "Erro ao atualizar notificação"
    })
  }
}

export async function marcarTodasComoLidas(
  req,
  res
) {
  try {
    await prisma.notificacao.updateMany({
      where: {
        usuarioId: req.usuarioId,
        lidaEm: null
      },
      data: {
        lidaEm: new Date()
      }
    })

    return res.json({
      mensagem:
        "Notificações marcadas como lidas"
    })

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem:
        "Erro ao atualizar notificações"
    })
  }
}