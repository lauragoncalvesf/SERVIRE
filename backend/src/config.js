export function obterDatabaseUrl(env) {
  if (!env.DATABASE_URL?.trim()) {
    throw new Error("Configuração obrigatória ausente: DATABASE_URL")
  }

  return env.DATABASE_URL
}

export function validarConfiguracao(env) {
  if (!env.JWT_SECRET?.trim()) {
    throw new Error("Configuração obrigatória ausente: JWT_SECRET")
  }

  obterDatabaseUrl(env)
  validarOrigens(env)

  const porta = Number(env.PORT ?? 3333)
  const proxyHops = Number(env.PROXY_HOPS ?? 0)

  if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
    throw new Error("PORT deve ser um número inteiro entre 1 e 65535")
  }

  if (!Number.isInteger(proxyHops) || proxyHops < 0 || proxyHops > 5) {
    throw new Error("PROXY_HOPS deve ser um inteiro entre 0 e 5")
  }

  return { porta, proxyHops }
}

export function validarOrigens(env) {
  const origens = (env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",").map((origem) => origem.trim()).filter(Boolean)

  if (env.NODE_ENV === "production" && !env.CORS_ORIGINS?.trim()) {
    throw new Error("Configuração obrigatória ausente: CORS_ORIGINS")
  }

  if (!origens.length || origens.some((origem) => {
    try {
      const url = new URL(origem)
      return !["http:", "https:"].includes(url.protocol) || url.origin !== origem
    } catch {
      return true
    }
  })) {
    throw new Error("CORS_ORIGINS deve conter origens HTTP válidas")
  }

  return origens
}
