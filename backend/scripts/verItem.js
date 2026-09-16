import prisma from "../src/lib/prisma.js"

const itens = await prisma.itemEscala.findMany({
  where: {
    funcaoEscalaId: null
  },
  include: {
    usuario: {
      select: {
        nome: true
      }
    },
    funcaoPastoral: {
      select: {
        nome: true
      }
    },
    escala: {
      include: {
        evento: {
          select: {
            titulo: true
          }
        },
        pastoral: {
          select: {
            nome: true
          }
        }
      }
    }
  }
})

console.dir(itens, { depth: null })

console.log(
  `Total de itens antigos: ${itens.length}`
)

await prisma.$disconnect()