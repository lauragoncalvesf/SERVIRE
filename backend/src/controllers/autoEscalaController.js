import prisma from "../lib/prisma.js"   

import {
  atualizarStatusAutomaticoEscala,
} from "../services/escalaService.js"
import {
    executarTransacao
} from "../services/transacao.js"

export async function autoEscalar(req, res) {
  try {
    const resposta = await executarTransacao(async (prisma) => {
      const res = {
        codigo: 200,
        status(codigo) { this.codigo = codigo; return this },
        json(corpo) { return { codigo: this.codigo, corpo } }
      }

      const escalaId = Number(req.params.escalaId)
      const { funcaoEscalaId } = req.body

      if (!funcaoEscalaId) {
        return res.status(400).json({
          mensagem: "Função da escala é obrigatória"
        })
      }

      const escala = await prisma.escala.findFirst({
        where: {
          id: escalaId,
          evento: {
            paroquiaId: req.paroquiaId
          }
        },
        include: {
          pastoral: true,
          evento: true
        }
      })

      if (!escala) {
        return res.status(404).json({
          mensagem: "Escala não encontrada"
        })
      }

      if (escala.status !== "ABERTA") {
        return res.status(400).json({
          mensagem: "Esta escala não está aberta para autoescala"
        })
      }

      if (!escala.pastoral.permiteAutoEscala) {
        return res.status(403).json({
          mensagem: "Esta pastoral não permite autoescala"
        })
      }

      const vinculo = await prisma.membroPastoral.findFirst({
        where: {
          usuarioId: req.usuarioId,
          pastoralId: escala.pastoralId,
          ativo: true
        }
      })

      if (!vinculo) {
        return res.status(403).json({
          mensagem: "Você não é membro desta pastoral"
        })
      }

      const funcaoEscala = await prisma.funcaoEscala.findFirst({
        where: {
          id: Number(funcaoEscalaId),
          escalaId
        },
        include: {
          itens: {
            where: {
              status: {
                in: ["PENDENTE", "CONFIRMADO"]
              }
            }
          }
        }
      })

      if (!funcaoEscala) {
        return res.status(404).json({
          mensagem: "Função não encontrada nesta escala"
        })
      }

      if (
        funcaoEscala.itens.length >=
        funcaoEscala.quantidadeVagas
      ) {
        return res.status(409).json({
          mensagem: "Esta função já está preenchida"
        })
      }

      const indisponibilidade =
        await prisma.indisponibilidade.findUnique({
          where: {
            usuarioId_eventoId: {
              usuarioId: req.usuarioId,
              eventoId: escala.eventoId
            }
          }
        })

      if (indisponibilidade) {
        return res.status(409).json({
          mensagem:
            indisponibilidade.motivo
              ? `Você marcou indisponibilidade para este evento: ${indisponibilidade.motivo}`
              : "Você marcou indisponibilidade para este evento"
        })
      }

      const conflito = await prisma.itemEscala.findFirst({
        where: {
          usuarioId: req.usuarioId,
          escala: {
            eventoId: escala.eventoId
          },
          status: {
            in: ["PENDENTE", "CONFIRMADO"]
          }
        }
      })

      if (conflito) {
        return res.status(409).json({
          mensagem: "Você já está escalado neste evento"
        })
      }

      const item = await prisma.itemEscala.create({
        data: {
          escalaId,
          eventoId: escala.eventoId,
          usuarioId: req.usuarioId,

          funcaoEscalaId: funcaoEscala.id,

          // temporário enquanto ainda mantemos a coluna antiga
          funcaoPastoralId:
            funcaoEscala.funcaoPastoralId,

          status: "CONFIRMADO"
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

      await atualizarStatusAutomaticoEscala(escalaId, prisma)

      return res.status(201).json(item)

    })
    return res.status(resposta.codigo).json(resposta.corpo)

  } catch (error) {
    if (error.code === "P2034") {
      return res.status(409).json({ mensagem: "A escala foi alterada por outra pessoa. Atualize e tente novamente." })
    }
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao realizar autoescala"
    })
  }
}