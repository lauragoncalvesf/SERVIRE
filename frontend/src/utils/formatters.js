export function formatarData(dataHora) {
  if (!dataHora) {
    return ""
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(dataHora))
}

export function formatarDataCurta(dataHora) {
  if (!dataHora) {
    return ""
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short"
  }).format(new Date(dataHora))
}

export function formatarHora(dataHora) {
  if (!dataHora) {
    return ""
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeStyle: "short"
  }).format(new Date(dataHora))
}

export function formatarTelefone(telefone) {
  if (!telefone) {
    return ""
  }

  const numeros = telefone.replace(/\D/g, "")

  if (numeros.length === 11) {
    return numeros.replace(
      /(\d{2})(\d{5})(\d{4})/,
      "($1) $2-$3"
    )
  }

  if (numeros.length === 10) {
    return numeros.replace(
      /(\d{2})(\d{4})(\d{4})/,
      "($1) $2-$3"
    )
  }

  return telefone
}

export function capitalizar(texto) {
  if (!texto) {
    return ""
  }

  return texto
    .toLowerCase()
    .replace(
      /\b\w/g,
      (letra) => letra.toUpperCase()
    )
}

export function formatarDataMedia(dataHora) {
  if (!dataHora) {
    return ""
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(dataHora))
}

export function formatarTipoEvento(tipo) {
  const tipos = {
    MISSA: "Missa",
    CELEBRACAO: "Celebração",
    ADORACAO: "Adoração",
    NOVENA: "Novena",
    PROCISSAO: "Procissão",
    REUNIAO: "Reunião",
    OUTRO: "Outro"
  }

  return tipos[tipo] || tipo
}

export function formatarPapelPastoral(papel) {
  const papeis = {
    MEMBRO: "Membro",
    COORDENADOR: "Coordenador"
  }

  return papeis[papel] || papel
}

export function formatarTipoUsuario(tipo) {
  const tipos = {
    ADMIN: "Administrador",
    MEMBRO: "Membro"
  }

  return tipos[tipo] || tipo
}

export function formatarStatusItem(status) {
  const statusMap = {
    PENDENTE: "Pendente",
    CONFIRMADO: "Confirmado",
    RECUSADO: "Recusado",
    SUBSTITUIDO: "Substituído",
    REMOVIDO: "Removido"
  }

  return statusMap[status] || status
}

export function normalizarTexto(texto) {
  if (!texto) {
    return ""
  }

  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}
 
export function normalizarEmail(email) {
  if (!email) {
    return ""
  }

  return email
    .trim()
    .toLowerCase()
}