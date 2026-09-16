import assert from "node:assert/strict"
import { mock, test } from "node:test"

// Isola a configuração local e impede conexões com o banco nos testes.
mock.module("dotenv/config", {})
const adaptadores = []
const clientes = []
mock.module("@prisma/adapter-pg", {
  namedExports: {
    PrismaPg: class {
      constructor(config) {
        this.config = config
        adaptadores.push(this)
      }
    }
  }
})
mock.module("@prisma/client", {
  namedExports: {
    PrismaClient: class {
      constructor(config) {
        this.config = config
        clientes.push(this)
      }
    }
  }
})

test("importação direta valida DATABASE_URL e compartilha o cliente", async (t) => {
  const original = process.env.DATABASE_URL
  t.after(() => {
    if (original === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = original
  })

  for (const [indice, valor] of [undefined, "", "   "].entries()) {
    if (valor === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = valor

    await assert.rejects(import(`../src/lib/prisma.js?invalido=${indice}`), {
      message: "Configuração obrigatória ausente: DATABASE_URL"
    })
  }
  assert.equal(adaptadores.length, 0)
  assert.equal(clientes.length, 0)

  process.env.DATABASE_URL = "postgresql://usuario:senha@localhost:5432/teste"
  const primeiro = await import("../src/lib/prisma.js")
  const segundo = await import("../src/lib/prisma.js")
  assert.equal(primeiro.default, segundo.default)
  assert.equal(adaptadores.length, 1)
  assert.equal(clientes.length, 1)
  assert.equal(adaptadores[0].config.connectionString, process.env.DATABASE_URL)
  assert.equal(primeiro.default.config.adapter, adaptadores[0])
})
