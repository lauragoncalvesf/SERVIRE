import prisma from "../src/lib/prisma.js"

async function main() {
  const antigos = await prisma.itemEscala.findMany({
    where: {
      funcaoEscalaId: null
    }
  })

  console.log(
    `${antigos.length} item(ns) antigo(s) encontrado(s)`
  )

  if (antigos.length === 0) {
    return
  }

  const resultado =
    await prisma.itemEscala.deleteMany({
      where: {
        funcaoEscalaId: null
      }
    })

  console.log(
    `${resultado.count} item(ns) removido(s)`
  )
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })