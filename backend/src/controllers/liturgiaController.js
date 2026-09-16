import * as cheerio from "cheerio"

const URL_LITURGIA =
  "https://liturgia.cancaonova.com/pb/"

function extrairPrimeiroGrupo(texto, regex) {
  const resultado = texto.match(regex)

  return resultado?.[1]?.trim() || null
}

function extrairFraseDestaque(texto) {
  const resultado = texto.match(
    /Evangelho\s*\([^)]+\)\s*-\s*(?:Aleluia[^.]*\.\s*-\s*)?(.+?)\s+Proclamação do Evangelho/i
  )

  if (!resultado?.[1]) {
    return null
  }

  return resultado[1]
    .replace(/\s+/g, " ")
    .replace(/^-\s*/, "")
    .trim()
}

export async function buscarLiturgiaHoje(
  req,
  res
) {
  try {
    const response = await fetch(
      URL_LITURGIA,
      {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      }
    )

    if (!response.ok) {
      return res.status(502).json({
        mensagem:
          "Não foi possível consultar a liturgia do dia"
      })
    }

    const html = await response.text()

    const $ = cheerio.load(html)

    const textoPagina = $("body")
      .text()
      .replace(/\s+/g, " ")
      .trim()

    const corLiturgica =
      extrairPrimeiroGrupo(
        textoPagina,
        /Cor Litúrgica:\s*([A-Za-zÀ-ÿ]+)/
      )

    const titulo =
      extrairPrimeiroGrupo(
        textoPagina,
        /\d{1,2}\s+Sep\s+\d{4}\s+(.+?)\s+A\+\s+A-/
      )

    const primeiraLeitura =
      extrairPrimeiroGrupo(
        textoPagina,
        /1ª Leitura\s+(.+?)\s+Salmo/
      )

    const salmo =
      extrairPrimeiroGrupo(
        textoPagina,
        /Salmo\s+(.+?)\s+Evangelho/
      )

    const evangelho =
      extrairPrimeiroGrupo(
        textoPagina,
        /Evangelho\s+(.+?)\s+Primeira Leitura/
      )

    const fraseDestaque =
      extrairFraseDestaque(
        textoPagina
      )

    return res.json({
      fonte: "Canção Nova",
      url: URL_LITURGIA,
      titulo,
      corLiturgica,
      primeiraLeitura,
      salmo,
      evangelho,
      fraseDestaque
    })

  } catch (error) {
    console.error(
      "Erro ao buscar liturgia:",
      error
    )

    return res.status(500).json({
      mensagem:
        "Erro ao buscar liturgia do dia"
    })
  }
}