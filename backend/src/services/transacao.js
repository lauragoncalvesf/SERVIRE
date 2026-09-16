import prisma from "../lib/prisma.js"

// A leitura das vagas e a gravação precisam compartilhar o mesmo snapshot.
// Em conflito serializável, repetimos todas as validações com dados atualizados.
export async function executarTransacao(operacao) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      return await prisma.$transaction(operacao, {
        isolationLevel: "Serializable"
      })
    } catch (error) {
      if (error.code !== "P2034" || tentativa === 2) throw error
    }
  }
}
