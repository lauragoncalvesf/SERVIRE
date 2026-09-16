export function emailValido(email) {
  if (!email) {
    return false
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  )
}

export function textoPreenchido(texto) {
  return (
    typeof texto === "string" &&
    texto.trim().length > 0
  )
}

export function numeroInteiroPositivo(valor) {
  const numero = Number(valor)

  return (
    Number.isInteger(numero) &&
    numero > 0
  )
}

export function telefoneValido(telefone) {
  if (!telefone) {
    return true
  }

  const numeros =
    telefone.replace(/\D/g, "")

  return (
    numeros.length === 10 ||
    numeros.length === 11
  )
}