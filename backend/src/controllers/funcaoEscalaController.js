import prisma from "../lib/prisma.js"

import { 
  atualizarStatusAutomaticoEscala,
  escalaPodeSerEditada
} from "./../services/escalaService.js"
import { 
  usuarioPodeGerenciarPastoral 
} from "./../services/escalaPermissions.js"


function inteiroPositivo(valor) {
  if (typeof valor !== "string" && typeof valor !== "number") return false
  const numero = Number(valor)
  return Number.isInteger(numero) && numero > 0 && numero <= 2147483647
}

export async function adicionarFuncaoEscala(req, res, next) {
  try {
    if (!inteiroPositivo(req.params.escalaId)) {
      return res.status(400).json({ mensagem: "escalaId inválido" })
    }

    const escalaId = Number(req.params.escalaId)

    const {
      funcaoPastoralId,
      quantidadeVagas
    } = req.body ?? {}

    if (
      !inteiroPositivo(funcaoPastoralId) ||
      !inteiroPositivo(quantidadeVagas)
    ) {
      return res.status(400).json({
        mensagem: "Função e quantidade de vagas devem ser inteiros positivos"
      })
    }

    const escala = await prisma.escala.findFirst({
      where: {
        id: escalaId,
        evento: {
          paroquiaId: req.paroquiaId
        }
      }
    })

    if (!escala) {
      return res.status(404).json({
        mensagem: "Escala não encontrada"
      })
    }

    if (!escalaPodeSerEditada(escala.status)) {
      return res.status(400).json({
        mensagem: "Esta escala não pode mais ser editada"
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

    const funcaoPastoral = await prisma.funcaoPastoral.findFirst({
      where: {
        id: Number(funcaoPastoralId),
        pastoralId: escala.pastoralId,
        ativa: true
      }
    })

    if (!funcaoPastoral) {
      return res.status(400).json({
        mensagem: "Esta função não pertence à pastoral da escala"
      })
    }

    const existente = await prisma.funcaoEscala.findUnique({
      where: {
        escalaId_funcaoPastoralId: {
          escalaId,
          funcaoPastoralId: Number(funcaoPastoralId)
        }
      }
    })

    if (existente) {
      return res.status(409).json({
        mensagem: "Esta função já foi adicionada à escala"
      })
    }

    const funcaoEscala = await prisma.funcaoEscala.create({
      data: {
        escalaId,
        funcaoPastoralId: Number(funcaoPastoralId),
        quantidadeVagas: Number(quantidadeVagas)
      },
      include: {
        funcaoPastoral: true
      }
    })

    await atualizarStatusAutomaticoEscala(escalaId)

    return res.status(201).json(funcaoEscala)

  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ mensagem: "Esta função já foi adicionada à escala" })
    }

    return next(error)
  }
}

export async function listarFuncoesEscala(req, res, next) {
  try {
    if (!inteiroPositivo(req.params.escalaId)) {
      return res.status(400).json({ mensagem: "escalaId inválido" })
    }

    const escalaId = Number(req.params.escalaId)

    const escala = await prisma.escala.findFirst({
      where: {
        id: escalaId,
        evento: {
          paroquiaId: req.paroquiaId
        }
      }
    })

    if (!escala) {
      return res.status(404).json({
        mensagem: "Escala não encontrada"
      })
    }

    const funcoes = await prisma.funcaoEscala.findMany({
      where: {
        escalaId
      },
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
      },
      orderBy: {
        id: "asc"
      }
    })

    const resultado = funcoes.map((funcao) => ({
      ...funcao,
      quantidadePreenchida: funcao.itens.length,
      preenchida:
        funcao.itens.length >= funcao.quantidadeVagas
    }))

    return res.json(resultado)

  } catch (error) {
    return next(error)
  }
}

export async function atualizarFuncaoEscala(req, res, next) {
  try {
    if (!inteiroPositivo(req.params.funcaoEscalaId)) {
      return res.status(400).json({
        mensagem: "funcaoEscalaId inválido"
      })
    }

    const funcaoEscalaId =
      Number(req.params.funcaoEscalaId)

    const {
      quantidadeVagas
    } = req.body ?? {}

    const quantidade =
      Number(quantidadeVagas)

    if (!inteiroPositivo(quantidadeVagas)) {
      return res.status(400).json({
        mensagem:
          "A quantidade de vagas deve ser de pelo menos 1"
      })
    }

    const funcaoEscala =
      await prisma.funcaoEscala.findFirst({
        where: {
          id: funcaoEscalaId,
          escala: {
            evento: {
              paroquiaId: req.paroquiaId
            }
          }
        },

        include: {
          escala: true,

          itens: {
            where: {
              status: {
                in: [
                  "PENDENTE",
                  "CONFIRMADO"
                ]
              }
            }
          }
        }
      })

    if (!funcaoEscala) {
      return res.status(404).json({
        mensagem:
          "Função da escala não encontrada"
      })
    }

    if (
      !escalaPodeSerEditada(
        funcaoEscala.escala.status
      )
    ) {
      return res.status(400).json({
        mensagem:
          "Esta escala não pode mais ser editada"
      })
    }

    const podeGerenciar =
      await usuarioPodeGerenciarPastoral(
        req.usuarioId,
        req.tipoUsuario,
        funcaoEscala.escala.pastoralId
      )

    if (!podeGerenciar) {
      return res.status(403).json({
        mensagem:
          "Você não possui permissão para gerenciar esta escala"
      })
    }

    const quantidadeOcupada =
      funcaoEscala.itens.length

    if (quantidade < quantidadeOcupada) {
      return res.status(400).json({
        mensagem:
          `Esta função já possui ${quantidadeOcupada} membro(s). ` +
          "A quantidade de vagas não pode ser menor que a quantidade ocupada."
      })
    }

    await prisma.funcaoEscala.update({
      where: {
        id: funcaoEscalaId
      },

      data: {
        quantidadeVagas: quantidade
      }
    })

    const atualizada =
      await prisma.funcaoEscala.findUnique({
        where: {
          id: funcaoEscalaId
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
      })

    await atualizarStatusAutomaticoEscala(
      funcaoEscala.escalaId
    )

    return res.json(atualizada)

  } catch (error) {
    return next(error)
  }
}

export async function removerFuncaoEscala(req, res, next) {
  try {
    if (!inteiroPositivo(req.params.funcaoEscalaId)) {
      return res.status(400).json({ mensagem: "funcaoEscalaId inválido" })
    }

    const funcaoEscalaId = Number(req.params.funcaoEscalaId)

    const funcaoEscala =
      await prisma.funcaoEscala.findFirst({
        where: {
          id: funcaoEscalaId,
          escala: {
            evento: {
              paroquiaId: req.paroquiaId
            }
          }
        },

        include: {
          escala: true,

          itens: {
            where: {
              status: {
                in: [
                  "PENDENTE",
                  "CONFIRMADO"
                ]
              }
            }
          }
        }
      })

    if (!funcaoEscala) {
      return res.status(404).json({
        mensagem: "Função da escala não encontrada"
      })
    }

    if (
      !escalaPodeSerEditada(funcaoEscala.escala.status)
    ) {
      return res.status(400).json({
        mensagem: "Esta escala não pode mais ser editada"
      })
    }

    const podeGerenciar =
      await usuarioPodeGerenciarPastoral(
        req.usuarioId,
        req.tipoUsuario,
        funcaoEscala.escala.pastoralId
      )

    if (!podeGerenciar) {
      return res.status(403).json({
        mensagem:
          "Você não possui permissão para gerenciar esta escala"
      })
    }

    if (funcaoEscala.itens.length > 0) {
      return res.status(400).json({
        mensagem:
          "Não é possível remover esta função porque existem membros vinculados a ela"
      })
    }

    const escalaId =
      funcaoEscala.escalaId

    await prisma.funcaoEscala.delete({
      where: {
        id: funcaoEscalaId
      }
    })

    await atualizarStatusAutomaticoEscala(
      escalaId
    )

    return res.json({
      mensagem: "Função removida da escala"
    })

  } catch (error) {
    return next(error)
  }
}