import prisma from "../lib/prisma.js"
import { executarTransacao } from "../services/transacao.js"
import { criarNotificacao, criarNotificacaoSeNaoExistir} from "../services/notificacaoServices.js"
import { atualizarStatusAutomaticoEscala, escalaPodeSerEditada } from "../services/escalaService.js"
import { usuarioPodeGerenciarPastoral } from "../services/escalaPermissions.js"

export async function criarEscala(req, res) {
  try {
    const {
      eventoId,
      pastoralId,
      observacao,
      funcoes
    } = req.body

    if (!eventoId || !pastoralId) {
      return res.status(400).json({
        mensagem: "Evento e pastoral são obrigatórios"
      })
    }

    if (!Array.isArray(funcoes) || funcoes.length === 0) {
      return res.status(400).json({
        mensagem: "Adicione pelo menos uma função à escala"
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

    const pastoral = await prisma.pastoral.findFirst({
      where: {
        id: Number(pastoralId),
        paroquiaId: req.paroquiaId,
        ativa: true
      }
    })

    if (!pastoral) {
      return res.status(404).json({
        mensagem: "Pastoral não encontrada"
      })
    }

    const podeGerenciar =
      await usuarioPodeGerenciarPastoral(
        req.usuarioId,
        req.tipoUsuario,
        pastoral.id
      )

    if (!podeGerenciar) {
      return res.status(403).json({
        mensagem:
          "Você não possui permissão para criar escala desta pastoral"
      })
    }

    const escalaExistente = await prisma.escala.findUnique({
      where: {
        eventoId_pastoralId: {
          eventoId: Number(eventoId),
          pastoralId: Number(pastoralId)
        }
      }
    })

    if (escalaExistente) {
      return res.status(409).json({
        mensagem: "Já existe uma escala desta pastoral para este evento"
      })
    }

    const idsFuncoes = funcoes.map((funcao) =>
      Number(funcao.funcaoPastoralId)
    )

    const idsUnicos = new Set(idsFuncoes)

    if (idsUnicos.size !== idsFuncoes.length) {
      return res.status(400).json({
        mensagem: "Não é permitido repetir funções na mesma escala"
      })
    }

    for (const funcao of funcoes) {
      const quantidade = Number(funcao.quantidadeVagas)

      if (
        !funcao.funcaoPastoralId ||
        !Number.isInteger(quantidade) ||
        quantidade < 1
      ) {
        return res.status(400).json({
          mensagem: "Todas as funções devem possuir uma quantidade de vagas válida"
        })
      }
    }

    const funcoesPastoral = await prisma.funcaoPastoral.findMany({
      where: {
        id: {
          in: idsFuncoes
        },
        pastoralId: Number(pastoralId),
        ativa: true
      }
    })

    if (funcoesPastoral.length !== idsFuncoes.length) {
      return res.status(400).json({
        mensagem: "Uma ou mais funções não pertencem à pastoral selecionada"
      })
    }

    const escala = await prisma.$transaction(async (tx) => {
      const novaEscala = await tx.escala.create({
        data: {
          eventoId: Number(eventoId),
          pastoralId: Number(pastoralId),
          observacao: observacao?.trim() || null,
          status: "RASCUNHO"
        }
      })

      await tx.funcaoEscala.createMany({
        data: funcoes.map((funcao) => ({
          escalaId: novaEscala.id,
          funcaoPastoralId: Number(funcao.funcaoPastoralId),
          quantidadeVagas: Number(funcao.quantidadeVagas)
        }))
      })

      return tx.escala.findUnique({
        where: {
          id: novaEscala.id
        },
        include: {
          evento: {
            select: {
              id: true,
              titulo: true,
              dataHora: true,
              local: true
            }
          },

          pastoral: {
            select: {
              id: true,
              nome: true,
              permiteAutoEscala: true,
              exigeConfirmacao: true
            }
          },

          funcoes: {
            include: {
              funcaoPastoral: true,
              itens: {
                where: {
                  status: {
                    in: ["PENDENTE", "CONFIRMADO"]
                  }
                },
                include: {
                  usuario: {
                    select: {
                      id: true,
                      nome: true
                    }
                  }
                }
              }
            }
          }
        }
      })
    })

    return res.status(201).json(escala)

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao criar escala"
    })
  }
}


export async function listarEscalasEvento(req, res) {
  try {
    const eventoId = Number(req.params.eventoId)

    const evento = await prisma.evento.findFirst({
      where: {
        id: eventoId,
        paroquiaId: req.paroquiaId
      },

      include: {
        escalas: {
          include: {
            pastoral: {
              select: {
                id: true,
                nome: true,
                permiteAutoEscala: true,
                exigeConfirmacao: true
              }
            },

            funcoes: {
              include: {
                funcaoPastoral: {
                  select: {
                    id: true,
                    nome: true,
                    descricao: true
                  }
                },

                itens: {
                  where: {
                    status: {
                      in: [
                        "PENDENTE",
                        "CONFIRMADO"
                      ]
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
                    criadoEm: "asc"
                  }
                }
              },

              orderBy: {
                id: "asc"
              }
            }
          },

          orderBy: {
            criadoEm: "asc"
          }
        }
      }
    })

    if (!evento) {
      return res.status(404).json({
        mensagem: "Evento não encontrado"
      })
    }

    let escalasVisiveis = []

    if (req.tipoUsuario === "ADMIN") {
      escalasVisiveis =
        evento.escalas.map((escala) => ({
          ...escala,
          podeGerenciar: true
        }))
    } else {
      const vinculos =
        await prisma.membroPastoral.findMany({
          where: {
            usuarioId: req.usuarioId,
            ativo: true
          },

          select: {
            pastoralId: true,
            papel: true
          }
        })

      const vinculosPorPastoral =
        new Map(
          vinculos.map((vinculo) => [
            vinculo.pastoralId,
            vinculo
          ])
        )

      escalasVisiveis =
        evento.escalas
          .filter((escala) =>
            vinculosPorPastoral.has(
              escala.pastoral.id
            )
          )
          .map((escala) => {
            const vinculo =
              vinculosPorPastoral.get(
                escala.pastoral.id
              )

            return {
              ...escala,

              podeGerenciar:
                vinculo.papel ===
                "COORDENADOR"
            }
          })
    }

    return res.json({
      evento: {
        id: evento.id,
        titulo: evento.titulo,
        tipo: evento.tipo,
        dataHora: evento.dataHora,
        local: evento.local,
        descricao: evento.descricao
      },

      escalas: escalasVisiveis
    })

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem:
        "Erro ao listar escalas do evento"
    })
  }
}

export async function atualizarStatusEscala(req, res) {
  try {
    const resposta = await executarTransacao(async (prisma) => {
      const res = {
        codigo: 200,
        status(codigo) { this.codigo = codigo; return this },
        json(corpo) { return { codigo: this.codigo, corpo } }
      }

      const escalaId = Number(req.params.escalaId)
      const { status } = req.body

      const statusPermitidos = [
        "RASCUNHO",
        "ABERTA",
        "PREENCHIDA",
        "COMPLETA",
        "ENCERRADA",
        "CANCELADA"
      ]

      if (!statusPermitidos.includes(status)) {
        return res.status(400).json({
          mensagem: "Status de escala inválido"
        })
      }

      const escala = await prisma.escala.findFirst({
        where: {
          id: escalaId,
          pastoral: {
            paroquiaId: req.paroquiaId
          }
        },
        include: {
          pastoral: true,
          evento: true,
          funcoes: true
        }
      })

      if (!escala) {
        return res.status(404).json({
          mensagem: "Escala não encontrada"
        })
      }

      const podeGerenciar =
        await usuarioPodeGerenciarPastoral(
          req.usuarioId,
          req.tipoUsuario,
          escala.pastoralId
        )

      if (!podeGerenciar) {
        return res.status(403).json({
          mensagem:
            "Você não possui permissão para gerenciar esta escala"
        })
      }

      if (
        status === "ABERTA" &&
        escala.funcoes.length === 0
      ) {
        return res.status(400).json({
          mensagem:
            "Adicione pelo menos uma função antes de disponibilizar a escala"
        })
      }

      if (
        status === "ABERTA" &&
        escala.status !== "RASCUNHO"
      ) {
        return res.status(400).json({
          mensagem:
            "Somente escalas em rascunho podem ser disponibilizadas manualmente"
        })
      }

      const atualizada = await prisma.escala.update({
        where: {
          id: escalaId
        },
        data: {
          status
        }
      })

      if (
        escala.status === "RASCUNHO" &&
        status === "ABERTA"
      ) {
        const membros =
          await prisma.membroPastoral.findMany({
            where: {
              pastoralId: escala.pastoralId,
              ativo: true,
              usuario: {
                ativo: true
              }
            },
            select: {
              usuarioId: true
            }
          })

          for (const membro of membros) {
            await criarNotificacaoSeNaoExistir(
              {
                tipo: "ESCALA_ABERTA",

                titulo:
                  "Nova escala disponível",

                mensagem:
                  `A escala da pastoral ${escala.pastoral.nome} para ${escala.evento.titulo} está disponível.`,

                usuarioId:
                  membro.usuarioId,

                eventoId:
                  escala.eventoId,

                escalaId:
                  escala.id
              },
              prisma
            )
          }
      }

      return res.json(atualizada)

    })
    return res.status(resposta.codigo).json(resposta.corpo)

  } catch (error) {
    if (error.code === "P2034") {
      return res.status(409).json({ mensagem: "A escala foi alterada por outra pessoa. Atualize e tente novamente." })
    }
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao atualizar status da escala"
    })
  }
}

export async function excluirEscala(req, res) {
  try {
    const escalaId = Number(req.params.escalaId)

    if (!Number.isSafeInteger(escalaId) || escalaId < 1) {
      return res.status(400).json({ mensagem: "Escala inválida" })
    }

    const escala = await prisma.escala.findFirst({
      where: {
        id: escalaId,
        evento: { paroquiaId: req.paroquiaId }
      },
      select: { id: true }
    })

    if (!escala) {
      return res.status(404).json({ mensagem: "Escala não encontrada" })
    }

    await prisma.escala.delete({ where: { id: escalaId } })

    return res.json({ mensagem: "Escala excluída com sucesso" })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ mensagem: "Erro ao excluir escala" })
  }
}
