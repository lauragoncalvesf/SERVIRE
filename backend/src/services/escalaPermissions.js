import prisma from "../lib/prisma.js";

export async function usuarioPodeGerenciarPastoral(
  usuarioId,
  tipoUsuario,
  pastoralId
) {
  if (tipoUsuario === "ADMIN") {
    return true
  }

  const coordenacao =
    await prisma.membroPastoral.findFirst({
      where: {
        usuarioId,
        pastoralId,
        ativo: true,
        papel: "COORDENADOR"
      }
    })

  return Boolean(coordenacao)
}