import "dotenv/config"
import bcrypt from "bcrypt"
import prisma from "../src/lib/prisma.js"
import { dadosPessoa, validarSenha } from "../src/services/superadminService.js"

try {
  const dados = dadosPessoa({ nome: process.env.SUPERADMIN_NOME, email: process.env.SUPERADMIN_EMAIL })
  const senha = process.env.SUPERADMIN_SENHA
  validarSenha(senha)
  delete process.env.SUPERADMIN_SENHA
  const hash = await bcrypt.hash(senha, 12)
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73910425)`
    if (await tx.usuario.count({ where: { tipo: "SUPER_ADMIN" } })) throw new Error("Já existe Superadministrador. Bootstrap cancelado.")
    const existente = await tx.usuario.findFirst({ where: { email: { equals: dados.email, mode: "insensitive" } } })
    if (existente) throw new Error("E-mail já utilizado. Nenhuma conta foi alterada. Utilize outro e-mail para a conta global.")
    const usuario = await tx.usuario.create({ data: { ...dados, senha: hash, tipo: "SUPER_ADMIN", paroquiaId: null } })
    await tx.auditoriaAdmin.create({ data: { autorId: usuario.id, acao: "BOOTSTRAP", recurso: "Usuario", recursoId: usuario.id } })
  }, { isolationLevel: "Serializable" })
  console.log("Superadministrador criado com sucesso.")
} catch (erro) {
  console.error(erro.publica || !erro.code ? erro.message : "Não foi possível criar a conta. Verifique a configuração e as migrações.")
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
