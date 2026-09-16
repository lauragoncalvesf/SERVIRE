import prisma from "../lib/prisma.js"

async function main() {
  const itensSemFuncaoEscala =
    await prisma.itemEscala.findMany({
      where: {
        funcaoEscalaId: null
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
            pastoral: {
              select: {
                nome: true
              }
            },
            evento: {
              select: {
                titulo: true,
                dataHora: true
              }
            }
          }
        }
      }
    })

  console.log(
    `Encontrados ${itensSemFuncaoEscala.length} item(ns) sem funcaoEscalaId`
  )

  for (const item of itensSemFuncaoEscala) {
    console.log("\nAnalisando:", {
      itemId: item.id,
      usuario: item.usuario.nome,
      evento: item.escala.evento.titulo,
      pastoral: item.escala.pastoral.nome,
      funcao: item.funcaoPastoral.nome,
      status: item.status
    })

    const funcaoEscala =
      await prisma.funcaoEscala.findUnique({
        where: {
          escalaId_funcaoPastoralId: {
            escalaId: item.escalaId,
            funcaoPastoralId:
              item.funcaoPastoralId
          }
        }
      })

    if (!funcaoEscala) {
      console.log(
        `⚠ Nenhuma FuncaoEscala encontrada para o item ${item.id}`
      )

      continue
    }

    await prisma.itemEscala.update({
      where: {
        id: item.id
      },
      data: {
        funcaoEscalaId:
          funcaoEscala.id
      }
    })

    console.log(
      `✓ Item ${item.id} associado à FuncaoEscala ${funcaoEscala.id}`
    )
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })