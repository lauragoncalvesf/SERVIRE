import prisma from "../lib/prisma.js"

import {
  atualizarStatusAutomaticoEscala,
  escalaPodeSerEditada
} from "../services/escalaService.js"

import {
  usuarioPodeGerenciarPastoral
} from "../services/escalaPermissions.js"

import {
  criarNotificacao
} from "../services/notificacaoServices.js"


export async function substituirMembroEscala(req, res) {
  try {
    const resposta = await executarTransacao(async (prisma) => {
      const res = {
        codigo: 200,
        status(codigo) { this.codigo = codigo; return this },
        json(corpo) { return { codigo: this.codigo, corpo } }
      }

      const itemId = Number(req.params.itemId)
      const { novoUsuarioId } = req.body

      if (!novoUsuarioId) {
        return res.status(400).json({
          mensagem: "novoUsuarioId é obrigatório"
        })
      }

      const itemAtual = await prisma.itemEscala.findFirst({
        where: {
          id: itemId,
          escala: {
            evento: {
              paroquiaId: req.paroquiaId
            }
          }
        },
        include: {
          escala: {
            include: {
              pastoral: true,
              evento: true
            }
          },
          funcaoPastoral: true,
          funcaoEscala: true,
          usuario: {
            select: {
              id: true,
              nome: true
            }
          }
        }
      })

      if (!itemAtual) {
        return res.status(404).json({
          mensagem: "Item da escala não encontrado"
        })
      }

      const podeGerenciar =
        await usuarioPodeGerenciarPastoral(
          req.usuarioId,
          req.tipoUsuario,
          itemAtual.escala.pastoralId
        )

      if (!podeGerenciar) {
        return res.status(403).json({
          mensagem:
            "Você não possui permissão para gerenciar esta escala"
        })
      }

      if (
        !escalaPodeSerEditada(
          itemAtual.escala.status
        )
      ) {
        return res.status(400).json({
          mensagem:
            "Esta escala está encerrada ou cancelada e não pode ser alterada"
        })
      }

      if (itemAtual.status === "SUBSTITUIDO") {
        return res.status(400).json({
          mensagem: "Este item já foi substituído"
        })
      }

      if (!itemAtual.funcaoEscalaId) {
        return res.status(400).json({
          mensagem:
            "Este item pertence a uma estrutura antiga de escala e não pode ser substituído"
        })
      }

      const usuario = await prisma.usuario.findFirst({
        where: {
          id: Number(novoUsuarioId),
          paroquiaId: req.paroquiaId,
          ativo: true
        }
      })

      if (!usuario) {
        return res.status(404).json({
          mensagem: "Novo usuário não encontrado"
        })
      }

      const membroPastoral = await prisma.membroPastoral.findUnique({
        where: {
          usuarioId_pastoralId: {
            usuarioId: Number(novoUsuarioId),
            pastoralId: itemAtual.escala.pastoralId
          }
        }
      })

      if (!membroPastoral || !membroPastoral.ativo) {
        return res.status(400).json({
          mensagem: "O novo usuário não é membro ativo desta pastoral"
        })
      }

      const indisponibilidade =
        await prisma.indisponibilidade.findUnique({
          where: {
            usuarioId_eventoId: {
              usuarioId: Number(novoUsuarioId),
              eventoId: itemAtual.escala.eventoId
            }
          }
        })

      if (indisponibilidade) {
        return res.status(409).json({
          mensagem:
            "O novo membro informou indisponibilidade para este evento",
          motivo: indisponibilidade.motivo
        })
      }

      const conflito = await prisma.itemEscala.findFirst({
        where: {
          usuarioId: Number(novoUsuarioId),

          escala: {
            eventoId: itemAtual.escala.eventoId
          },

          status: {
            in: ["PENDENTE", "CONFIRMADO"]
          }
        }
      })

      if (conflito) {
        return res.status(409).json({
          mensagem: "O novo membro já está escalado neste evento"
        })
      }

      const statusInicial =
        itemAtual.escala.pastoral.exigeConfirmacao
          ? "PENDENTE"
          : "CONFIRMADO"

      const resultado = await (async (tx) => {
        const antigo = await tx.itemEscala.update({
          where: {
            id: itemId
          },
          data: {
            status: "SUBSTITUIDO"
          }
        })

        const novo = await tx.itemEscala.create({
          data: {
            escalaId: itemAtual.escalaId,

            eventoId:
              itemAtual.escala.eventoId,

            usuarioId:
              Number(novoUsuarioId),

            funcaoEscalaId:
              itemAtual.funcaoEscalaId,

            funcaoPastoralId:
              itemAtual.funcaoPastoralId,

            status: statusInicial
          },

          include: {
            usuario: {
              select: {
                id: true,
                nome: true
              }
            },

            funcaoEscala: {
              include: {
                funcaoPastoral: true
              }
            }
          }
        })

        return {
          antigo,
          novo
        }
      })(prisma)

      await criarNotificacao({
        tipo: "SUBSTITUIDO",

        titulo: itemAtual.escala.pastoral.exigeConfirmacao
          ? "Você foi escalado como substituto"
          : "Você entrou na escala",

        mensagem: itemAtual.escala.pastoral.exigeConfirmacao
          ? `Você foi colocado no lugar de ${itemAtual.usuario.nome} na função ${itemAtual.funcaoPastoral.nome} em ${itemAtual.escala.evento.titulo}. Confirme sua participação.`
          : `Você foi colocado no lugar de ${itemAtual.usuario.nome} na função ${itemAtual.funcaoPastoral.nome} em ${itemAtual.escala.evento.titulo}.`,

        usuarioId: Number(novoUsuarioId),

        eventoId: itemAtual.escala.eventoId,

        escalaId: itemAtual.escalaId,

        itemEscalaId: resultado.novo.id
      }, prisma)

      await criarNotificacao({
        tipo: "SUBSTITUIDO",

        titulo: "Você foi substituído na escala",

        mensagem:
          `Você foi substituído na função ${itemAtual.funcaoPastoral.nome} em ${itemAtual.escala.evento.titulo}.`,

        usuarioId: itemAtual.usuario.id,

        eventoId: itemAtual.escala.eventoId,

        escalaId: itemAtual.escalaId,

        itemEscalaId: resultado.antigo.id
      }, prisma)

      await atualizarStatusAutomaticoEscala(
        itemAtual.escalaId, prisma
      )

      return res.json({
        mensagem: "Membro substituído com sucesso",

        substituido:
          itemAtual.usuario.nome,

        novoMembro:
          resultado.novo
      })

    })
    return res.status(resposta.codigo).json(resposta.corpo)

  } catch (error) {
    if (error.code === "P2034") {
      return res.status(409).json({ mensagem: "A escala foi alterada por outra pessoa. Atualize e tente novamente." })
    }
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao substituir membro da escala"
    })
  }
}