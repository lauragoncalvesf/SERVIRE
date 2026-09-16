import prisma from "../lib/prisma.js"


export async function listarMinhasEscalas(req, res) {
  try {
    const usuarioId = req.usuarioId
    
    const usuario = await prisma.usuario.findUnique({
      where: {
        id: usuarioId
      }
    })

    if (!usuario) {
      return res.status(404).json({
        mensagem: "Usuário não encontrado"
      })
    }

    const itens = await prisma.itemEscala.findMany({
      where: {
        usuarioId,
        status: {
          in: ["PENDENTE", "CONFIRMADO"]
        },
        escala: {
          status: {
            notIn: ["RASCUNHO", "CANCELADA"]
          }
        },
        evento: {
          paroquiaId: req.paroquiaId        
        }
      },
      include: {
        funcaoPastoral: {
          select: {
            id: true,
            nome: true
          }
        },
        escala: {
          include: {
            pastoral: {
              select: {
                id: true,
                nome: true
              }
            },
            evento: {
              select: {
                id: true,
                titulo: true,
                tipo: true,
                dataHora: true,
                local: true
              }
            }
          }
        }
      },
      orderBy: {
        evento: {
          dataHora: "asc"
        }
      }
    })

    const escalas = itens.map(item => ({
      itemId: item.id,
      status: item.status,

      evento: {
        id: item.escala.evento.id,
        titulo: item.escala.evento.titulo,
        tipo: item.escala.evento.tipo,
        dataHora: item.escala.evento.dataHora,
        local: item.escala.evento.local
      },

      pastoral: {
        id: item.escala.pastoral.id,
        nome: item.escala.pastoral.nome
      },

      funcao: {
        id: item.funcaoPastoral.id,
        nome: item.funcaoPastoral.nome
      }
    }))

    return res.json({
      usuario: {
        id: usuario.id,
        nome: usuario.nome
      },
      escalas
    })

  } catch (error) {
    console.error(error)

    return res.status(500).json({
      mensagem: "Erro ao listar escalas do usuário"
    })
  }
}

