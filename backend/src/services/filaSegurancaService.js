// Fila transitória e limitada: nenhum token é persistido em texto puro.
// Trabalho público acontece após a resposta; falhas de entrega não revelam contas.
export function criarFilaSeguranca({ concorrencia = 2, capacidade = 64 } = {}) {
  const pendentes = []
  let ativos = 0
  function executar() {
    while (ativos < concorrencia && pendentes.length) {
      const tarefa = pendentes.shift()
      ativos++
      Promise.resolve().then(tarefa).catch(() => {
        console.warn(JSON.stringify({ evento: "seguranca_email", codigo: "FALHA_PROCESSAMENTO" }))
      }).finally(() => { ativos--; executar() })
    }
  }
  return tarefa => {
    if (pendentes.length + ativos >= capacidade) {
      console.warn(JSON.stringify({ evento: "seguranca_email", codigo: "FILA_OCUPADA" }))
      return false
    }
    pendentes.push(tarefa)
    setImmediate(executar)
    return true
  }
}
export const enfileirarSeguranca = criarFilaSeguranca()
