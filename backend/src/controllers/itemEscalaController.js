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

import {
  executarTransacao
} from "../services/transacao.js"

export async function adicionarItemEscala(req, res) {
  try {
    const resposta = await executarTransacao(async (prisma) => {
      const res = {
        codigo: 200,
        status(codigo) { this.codigo = codigo; return this },
        json(corpo) { return { codigo: this.codigo, corpo } }
      }

      const {
        funcaoEscalaId,
        usuarioId
      } = req.body

      const escalaId = Number(req.params.escalaId)

      if (!funcaoEscalaId || !usuarioId) {
        return res.status(400).json({
          mensagem: "Função e membro são obrigatórios"
        })
      }

      // Busca a escala e garante que pertence à paróquia
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

      if (!escalaPodeSerEditada(escala.status)) {
        return res.status(400).json({
          mensagem:
            "Esta escala está encerrada ou cancelada e não pode ser alterada"
        })
      }

      // Busca a função específica desta escala
      const funcaoEscala = await prisma.funcaoEscala.findFirst({
        where: {
          id: Number(funcaoEscalaId),
          escalaId
        },
        include: {
          funcaoPastoral: true,
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

      // Verifica quantidade de vagas
      if (
        funcaoEscala.itens.length >=
        funcaoEscala.quantidadeVagas
      ) {
        return res.status(409).json({
          mensagem: "Todas as vagas desta função já foram preenchidas"
        })
      }

      // Verifica usuário
      const usuario = await prisma.usuario.findFirst({
        where: {
          id: Number(usuarioId),
          paroquiaId: req.paroquiaId,
          ativo: true
        }
      })

      if (!usuario) {
        return res.status(404).json({
          mensagem: "Usuário não encontrado"
        })
      }

      // O usuário precisa participar da pastoral
      const membroPastoral = await prisma.membroPastoral.findUnique({
        where: {
          usuarioId_pastoralId: {
            usuarioId: Number(usuarioId),
            pastoralId: escala.pastoralId
          }
        }
      })

      if (!membroPastoral || !membroPastoral.ativo) {
        return res.status(400).json({
          mensagem: "Este usuário não é membro ativo desta pastoral"
        })
      }

      // Verifica indisponibilidade
      const indisponibilidade =
        await prisma.indisponibilidade.findUnique({
          where: {
            usuarioId_eventoId: {
              usuarioId: Number(usuarioId),
              eventoId: escala.eventoId
            }
          }
        })

      if (indisponibilidade) {
        return res.status(409).json({
          mensagem:
            "Este membro informou que não está disponível para este evento",
          motivo: indisponibilidade.motivo
        })
      }

      // Só PENDENTE e CONFIRMADO representam conflito ativo.
      // RECUSADO e SUBSTITUIDO não devem bloquear nova escalação.
      const conflito = await prisma.itemEscala.findFirst({
        where: {
          usuarioId: Number(usuarioId),
          escala: {
            eventoId: escala.eventoId
          }, 
          status: {
            in: ["PENDENTE", "CONFIRMADO"]
          }
        },
        include: {
          escala: {
            include: {
              pastoral: true,
              evento: true
            }
          },
          funcaoPastoral: true
        }
      })

      if (conflito) {
        return res.status(409).json({
          mensagem: "Este membro já está escalado neste evento",
          conflito: {
            pastoral: conflito.escala.pastoral.nome,
            funcao: conflito.funcaoPastoral.nome
          }
        })
      }

      // Pastoral decide se precisa de confirmação
      const statusInicial =
        escala.pastoral.exigeConfirmacao
          ? "PENDENTE"
          : "CONFIRMADO"

          const itemCriado =
            await prisma.itemEscala.create({
              data: {
                escalaId,
                eventoId: escala.eventoId,
                usuarioId: Number(usuarioId),

                funcaoEscalaId:
                  funcaoEscala.id,

                funcaoPastoralId:
                  funcaoEscala.funcaoPastoralId,

                status: statusInicial
              }
            })

            const item =
              await prisma.itemEscala.findUnique({
                where: {
                  id: itemCriado.id
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

              

      await criarNotificacao({
        tipo: escala.pastoral.exigeConfirmacao
          ? "CONFIRMACAO_PENDENTE"
          : "ESCALADO",

        titulo: escala.pastoral.exigeConfirmacao
          ? "Confirmação de escala"
          : "Você foi escalado",

        mensagem: escala.pastoral.exigeConfirmacao
          ? `Você foi escalado para ${funcaoEscala.funcaoPastoral.nome} em ${escala.evento.titulo}. Confirme sua participação.`
          : `Você foi escalado para ${funcaoEscala.funcaoPastoral.nome} em ${escala.evento.titulo}.`,

        usuarioId: Number(usuarioId),

        eventoId: escala.eventoId,

        escalaId: escala.id,

        itemEscalaId: item.id
      }, prisma)

      await atualizarStatusAutomaticoEscala(
        escalaId, prisma
      )

      return res.status(201).json(item)

    })
    return res.status(resposta.codigo).json(resposta.corpo)

  } catch (error) {
    if (error.code === "P2034") {
      return res.status(409).json({ mensagem: "A escala foi alterada por outra pessoa. Atualize e tente novamente." })
    }
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao adicionar membro à escala"
    })
  }
}

export async function atualizarItemEscala(req, res) {
  try {
    const itemId = Number(req.params.itemId)

    const {
      usuarioId,
      funcaoEscalaId,
      status
    } = req.body

    const statusPermitidos = [
      "PENDENTE",
      "CONFIRMADO",
      "RECUSADO",
      "SUBSTITUIDO",
      "REMOVIDO"
    ]

    if (
      status !== undefined &&
      !statusPermitidos.includes(status)
    ) {
      return res.status(400).json({
        mensagem: "Status do item inválido"
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
        funcaoEscala: {
          include: {
            funcaoPastoral: true
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

    if (
      itemAtual.status === "SUBSTITUIDO"
    ) {
      return res.status(400).json({
        mensagem: "Este item já foi substituído"
      })
    }

    if (!itemAtual.funcaoEscalaId) {
      return res.status(400).json({
        mensagem:
          "Este item pertence a uma estrutura antiga de escala"
      })
    }

    const novoUsuarioId =
      usuarioId
        ? Number(usuarioId)
        : itemAtual.usuarioId

    const novaFuncaoEscalaId =
      funcaoEscalaId
        ? Number(funcaoEscalaId)
        : itemAtual.funcaoEscalaId

    // Verifica usuário
    const usuario = await prisma.usuario.findFirst({
      where: {
        id: novoUsuarioId,
        paroquiaId: req.paroquiaId,
        ativo: true
      }
    })

    if (!usuario) {
      return res.status(404).json({
        mensagem: "Usuário não encontrado"
      })
    }

    // Busca a nova função dentro da mesma escala
    const novaFuncaoEscala =
      await prisma.funcaoEscala.findFirst({
        where: {
          id: novaFuncaoEscalaId,
          escalaId: itemAtual.escalaId
        },

        include: {
          funcaoPastoral: true,

          itens: {
            where: {
              status: {
                in: [
                  "PENDENTE",
                  "CONFIRMADO"
                ]
              },

              NOT: {
                id: itemId
              }
            }
          }
        }
      })

    if (!novaFuncaoEscala) {
      return res.status(404).json({
        mensagem:
          "Função não encontrada nesta escala"
      })
    }

    // Verifica se ainda existe vaga
    if (
      novaFuncaoEscala.itens.length >=
      novaFuncaoEscala.quantidadeVagas
    ) {
      return res.status(409).json({
        mensagem:
          "Todas as vagas desta função já foram preenchidas"
      })
    }

    // Verifica se é membro da pastoral
    const membroPastoral =
      await prisma.membroPastoral.findUnique({
        where: {
          usuarioId_pastoralId: {
            usuarioId: novoUsuarioId,
            pastoralId:
              itemAtual.escala.pastoralId
          }
        }
      })

    if (
      !membroPastoral ||
      !membroPastoral.ativo
    ) {
      return res.status(400).json({
        mensagem:
          "Este usuário não é membro ativo desta pastoral"
      })
    }

    // Verifica indisponibilidade
    const indisponibilidade =
      await prisma.indisponibilidade.findUnique({
        where: {
          usuarioId_eventoId: {
            usuarioId: novoUsuarioId,
            eventoId:
              itemAtual.escala.eventoId
          }
        }
      })

    if (indisponibilidade) {
      return res.status(409).json({
        mensagem:
          "Este membro informou que não está disponível para este evento",

        motivo:
          indisponibilidade.motivo
      })
    }

    // Verifica conflito em outra função/pastoral do mesmo evento
    const conflito =
      await prisma.itemEscala.findFirst({
        where: {
          usuarioId: novoUsuarioId,

          escala: {
            eventoId:
              itemAtual.escala.eventoId
          },

          status: {
            in: [
              "PENDENTE",
              "CONFIRMADO"
            ]
          },

          NOT: {
            id: itemId
          }
        },

        include: {
          escala: {
            include: {
              pastoral: true
            }
          },

          funcaoPastoral: true
        }
      })

    if (conflito) {
      return res.status(409).json({
        mensagem:
          "Este membro já está escalado neste evento",

        conflito: {
          pastoral:
            conflito.escala.pastoral.nome,

          funcao:
            conflito.funcaoPastoral.nome
        }
      })
    }

    const item =
      await prisma.itemEscala.update({
        where: {
          id: itemId
        },

        data: {
          usuarioId:
            novoUsuarioId,

          funcaoEscalaId:
            novaFuncaoEscala.id,

          // Mantido temporariamente
          funcaoPastoralId:
            novaFuncaoEscala.funcaoPastoralId,

          ...(status && {
            status
          })
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

    await atualizarStatusAutomaticoEscala(
      itemAtual.escalaId
    )

    return res.json(item)

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem:
        "Erro ao atualizar item da escala"
    })
  }
}


export async function removerItemEscala(req, res) {
  try {
    const itemId = Number(req.params.itemId)

    const item = await prisma.itemEscala.findFirst({
      where: {
        id: itemId,
        escala: {
          evento: {
            paroquiaId: req.paroquiaId
          }
        }
      },
      include: {
        escala: true
      }
    })

    if (!item) {
      return res.status(404).json({
        mensagem: "Item da escala não encontrado"
      })
    }

    const podeGerenciar =
      await usuarioPodeGerenciarPastoral(
        req.usuarioId,
        req.tipoUsuario,
        item.escala.pastoralId
      )

    if (!podeGerenciar) {
      return res.status(403).json({
        mensagem:
          "Você não possui permissão para gerenciar esta escala"
      })
    }

    if (
      !escalaPodeSerEditada(
        item.escala.status
      )
    ) {
      return res.status(400).json({
        mensagem:
          "Esta escala está encerrada ou cancelada e não pode ser alterada"
      })
    }

    const escalaId = item.escalaId

    await prisma.itemEscala.update({
      where: {
        id: itemId
      },
      data: {
        status: "REMOVIDO"
      }
    })

    await atualizarStatusAutomaticoEscala(
      escalaId
    )

    return res.json({
      mensagem: "Membro removido da escala com sucesso"
    })

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao remover membro da escala"
    })
  }
}

export async function responderEscala(req, res) {
  try {
    const itemId = Number(req.params.itemId)
    const { status } = req.body

    const statusPermitidos = [
      "CONFIRMADO",
      "RECUSADO"
    ]

    if (!statusPermitidos.includes(status)) {
      return res.status(400).json({
        mensagem: "Status deve ser CONFIRMADO ou RECUSADO"
      })
    }

    const item = await prisma.itemEscala.findFirst({
      where: {
        id: itemId,
        usuarioId: req.usuarioId,
        evento: {
          paroquiaId: req.paroquiaId
        }
      },
      include: {
        escala: {
          include: {
            evento: true,
            pastoral: true
          }
        },
        usuario: {
          select: {
            id: true,
            nome: true
          }
        },
        funcaoPastoral: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    })

    if (!item) {
    return res.status(404).json({
        mensagem: "Item da escala não encontrado"
    })
    }

    const statusPermitidosParaResposta = [
      "ABERTA",
      "PREENCHIDA"
    ]

    if (
      !statusPermitidosParaResposta.includes(
        item.escala.status
      )
    ) {
      return res.status(400).json({
        mensagem:
          "Esta escala não está disponível para confirmação"
      })
    }

    if (item.status === "SUBSTITUIDO") {
    return res.status(400).json({
        mensagem: "Este item já foi substituído"
    })
    }

    if (
      item.status === "CONFIRMADO" ||
      item.status === "RECUSADO"
    ) {
      return res.status(400).json({
        mensagem: "Esta escala já foi respondida"
      })
    }

    const itemAtualizado = await prisma.itemEscala.update({
      where: {
        id: itemId
      },
      data: {
        status
      },
      include: {
        usuario: {
          select: {
            id: true,
            nome: true
          }
        },
        funcaoPastoral: {
          select: {
            id: true,
            nome: true
          }
        },
        escala: {
          include: {
            evento: {
              select: {
                id: true,
                titulo: true,
                dataHora: true
              }
            },
            pastoral: {
              select: {
                id: true,
                nome: true
              }
            }
          }
        }
      }
    })

    await atualizarStatusAutomaticoEscala(item.escalaId)

    return res.json({
      mensagem:
        status === "CONFIRMADO"
          ? "Participação confirmada com sucesso"
          : "Participação recusada",
      item: itemAtualizado
    })

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao responder escala"
    })
  }
}


export async function sairDaEscala(req, res) {
  try {
    const itemId = Number(req.params.itemId)

    const item = await prisma.itemEscala.findFirst({
      where: {
        id: itemId,
        usuarioId: req.usuarioId,
        evento: {
          paroquiaId: req.paroquiaId
        }
      },
      include: {
        escala: true
      }
    })

    if (!item) {
      return res.status(404).json({
        mensagem: "Escala não encontrada"
      })
    }

    if (
      !["PENDENTE", "CONFIRMADO"].includes(
        item.status
      )
    ) {
      return res.status(400).json({
        mensagem:
          "Você não possui uma participação ativa nesta escala"
      })
    }

    if (
      ["ENCERRADA", "CANCELADA"].includes(
        item.escala.status
      )
    ) {
      return res.status(400).json({
        mensagem:
          "Esta escala não permite mais alterações"
      })
    }

    const itemAtualizado =
      await prisma.itemEscala.update({
        where: {
          id: itemId
        },

        data: {
          status: "REMOVIDO"
        }
      })

    await atualizarStatusAutomaticoEscala(
      item.escalaId
    )

    return res.json({
      mensagem:
        "Você saiu da escala com sucesso",
      item: itemAtualizado
    })

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem:
        "Erro ao sair da escala"
    })
  }
}