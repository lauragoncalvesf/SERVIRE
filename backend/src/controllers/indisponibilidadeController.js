import prisma from "../lib/prisma.js"
import { atualizarStatusAutomaticoEscala } from "./../services/escalaService.js"

export async function criarIndisponibilidade(req, res) {
  try {
    const {
      eventoId,
      motivo
    } = req.body

    const usuarioId = req.usuarioId

    if (!eventoId) {
      return res.status(400).json({
        mensagem: "eventoId é obrigatório"
      })
    }

    const evento = await prisma.evento.findFirst({
      where: {
        id: Number(eventoId),
        paroquiaId: req.paroquiaId,
        ativo: true
      }
    })

    if (!evento) {
      return res.status(404).json({
        mensagem: "Evento não encontrado"
      })
    }

    const existente =
      await prisma.indisponibilidade.findUnique({
        where: {
          usuarioId_eventoId: {
            usuarioId,
            eventoId: Number(eventoId)
          }
        }
      })

    if (existente) {
      return res.status(409).json({
        mensagem:
          "Você já informou indisponibilidade para este evento"
      })
    }

    // Verifica se o usuário já possui participação ativa no evento
    const itemEscalaAtivo =
      await prisma.itemEscala.findFirst({
        where: {
          usuarioId,
          eventoId: Number(eventoId),

          status: {
            in: [
              "PENDENTE",
              "CONFIRMADO"
            ]
          }
        }
      })

    // Quem já confirmou não pode simplesmente marcar indisponibilidade
    if (
      itemEscalaAtivo?.status === "CONFIRMADO"
    ) {
      return res.status(409).json({
        mensagem:
          "Você já confirmou sua participação neste evento. Solicite uma substituição antes de marcar indisponibilidade."
      })
    }

    let escalaParaRecalcularId = null

    const indisponibilidade =
      await prisma.$transaction(async (tx) => {

        // Se havia convite pendente, marcar indisponibilidade
        // equivale a recusar aquele convite
        if (
          itemEscalaAtivo?.status === "PENDENTE"
        ) {
          await tx.itemEscala.update({
            where: {
              id: itemEscalaAtivo.id
            },

            data: {
              status: "RECUSADO"
            }
          })

          escalaParaRecalcularId =
            itemEscalaAtivo.escalaId
        }

        return tx.indisponibilidade.create({
          data: {
            usuarioId: Number(usuarioId),
            eventoId: Number(eventoId),
            motivo:
              motivo?.trim() || null
          }
        })
      })

    // Recalcula a escala caso um convite pendente tenha sido recusado
    if (escalaParaRecalcularId) {
      await atualizarStatusAutomaticoEscala(
        escalaParaRecalcularId
      )
    }

    return res.status(201).json(
      indisponibilidade
    )

  } catch (error) {
    console.error(error)

    if (error.code === "P2002") {
      return res.status(409).json({
        mensagem:
          "Você já informou indisponibilidade para este evento"
      })
    }

    return res.status(500).json({
      mensagem:
        "Erro ao registrar indisponibilidade"
    })
  }
}

export async function listarIndisponibilidadesEvento(req, res) {
  try {
    const eventoId = Number(req.params.eventoId)

    const indisponibilidades =
      await prisma.indisponibilidade.findMany({
        where: {
          eventoId,
          evento: {
            paroquiaId: req.paroquiaId
          }
        },

        include: {
          usuario: {
            select: {
              id: true,
              nome: true
            }
          }
        },

        orderBy: {
          usuario: {
            nome: "asc"
          }
        }
      })

    return res.json(indisponibilidades)

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao listar indisponibilidades"
    })
  }
}

export async function listarMinhasIndisponibilidades(req, res) {
  try {
    const indisponibilidades =
      await prisma.indisponibilidade.findMany({
        where: {
          usuarioId: req.usuarioId,
          evento: {
            paroquiaId: req.paroquiaId
          }
        },

        include: {
          evento: {
            select: {
              id: true,
              titulo: true,
              dataHora: true,
              local: true
            }
          }
        },

        orderBy: {
          evento: {
            dataHora: "asc"
          }
        }
      })

    return res.json(indisponibilidades)

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem:
        "Erro ao listar indisponibilidades"
    })
  }
}

export async function removerIndisponibilidade(req, res) {
  try {
    const eventoId =
      Number(req.params.eventoId)

    const indisponibilidade =
      await prisma.indisponibilidade.findUnique({
        where: {
          usuarioId_eventoId: {
            usuarioId: req.usuarioId,
            eventoId
          }
        }
      })

    if (!indisponibilidade) {
      return res.status(404).json({
        mensagem:
          "Indisponibilidade não encontrada"
      })
    }

    await prisma.indisponibilidade.delete({
      where: {
        id: indisponibilidade.id
      }
    })

    return res.json({
      mensagem:
        "Indisponibilidade removida com sucesso"
    })

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem:
        "Erro ao remover indisponibilidade"
    })
  }
}