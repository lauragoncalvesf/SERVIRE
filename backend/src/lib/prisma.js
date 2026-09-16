import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import { obterDatabaseUrl } from "../config.js"

const adapter = new PrismaPg({
  connectionString: obterDatabaseUrl(process.env)
})

const prisma = new PrismaClient({
  adapter
})

export default prisma
