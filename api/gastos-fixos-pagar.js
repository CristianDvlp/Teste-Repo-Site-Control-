import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";

const sql = neon(process.env.DATABASE_URL);

function pegarCookie(req, nome) {
  const cookies = req.headers.cookie || "";
  const partes = cookies.split(";").map(cookie => cookie.trim());

  for (const parte of partes) {
    const [chave, valor] = parte.split("=");

    if (chave === nome) {
      return valor;
    }
  }

  return null;
}

function obterUsuarioLogado(req) {
  const token = pegarCookie(req, "session");

  if (!token) {
    throw new Error("NAO_LOGADO");
  }

  const dados = jwt.verify(token, process.env.JWT_SECRET);

  return {
    id: dados.id,
    usuario: dados.usuario
  };
}

function converterValorParaNumero(valor) {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : null;
  }

  const limpo = String(valor)
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = Number(limpo);

  if (!Number.isFinite(numero)) {
    return null;
  }

  return numero;
}

function dataAtualBrasil() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo"
  });
}

function dataExiste(ano, mes, dia) {
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));

  return (
    data.getFullYear() === Number(ano) &&
    data.getMonth() === Number(mes) - 1 &&
    data.getDate() === Number(dia)
  );
}

function converterDataParaBanco(data) {
  if (!data) {
    return dataAtualBrasil();
  }

  const texto = String(data).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split("-");

    if (!dataExiste(ano, mes, dia)) {
      return null;
    }

    return texto;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split("/");

    if (!dataExiste(ano, mes, dia)) {
      return null;
    }

    return `${ano}-${mes}-${dia}`;
  }

  return null;
}

function obterMesReferenciaDaDataBanco(dataBanco) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataBanco || ""))) {
    return "";
  }

  const [ano, mes] = dataBanco.split("-");
  return `${mes}/${ano}`;
}

function validarMesReferencia(mesReferencia) {
  const texto = String(mesReferencia || "").trim();

  if (!/^\d{2}\/\d{4}$/.test(texto)) {
    return false;
  }

  const [mes, ano] = texto.split("/").map(Number);

  if (mes < 1 || mes > 12) {
    return false;
  }

  if (ano < 2020 || ano > 2100) {
    return false;
  }

  return true;
}

function normalizarId(valor) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function tratarErro(res, erro) {
  console.error(erro);

  if (erro.message === "NAO_LOGADO") {
    return res.status(401).json({ erro: "Você precisa estar logado" });
  }

  if (erro.name === "JsonWebTokenError" || erro.name === "TokenExpiredError") {
    return res.status(401).json({ erro: "Sessão inválida ou expirada" });
  }

  const mensagem = String(erro.message || "");

  if (
    mensagem.includes("duplicate key") ||
    mensagem.includes("gastos_fixos_pagamentos") ||
    mensagem.includes("lancamentos_usuario_id_import_hash_key")
  ) {
    return res.status(409).json({
      erro: "Esse gasto fixo já foi marcado como pago neste mês"
    });
  }

  return res.status(500).json({ erro: "Erro ao marcar gasto fixo como pago" });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  try {
    const usuarioLogado = obterUsuarioLogado(req);
    const usuarioId = usuarioLogado.id;

    const {
      id,
      gasto_fixo_id,
      gastoFixoId,
      data_pagamento,
      dataPagamento,
      valor_pago,
      valorPago,
      mes_referencia,
      mesReferencia
    } = req.body || {};

    const gastoFixoIdFinal = normalizarId(id || gasto_fixo_id || gastoFixoId);

    if (!gastoFixoIdFinal) {
      return res.status(400).json({
        erro: "Informe o ID do gasto fixo"
      });
    }

    const dataBanco = converterDataParaBanco(data_pagamento || dataPagamento);

    if (!dataBanco) {
      return res.status(400).json({
        erro: "Informe uma data de pagamento válida"
      });
    }

    const mesReferenciaFinal = validarMesReferencia(mes_referencia || mesReferencia)
      ? String(mes_referencia || mesReferencia).trim()
      : obterMesReferenciaDaDataBanco(dataBanco);

    if (!validarMesReferencia(mesReferenciaFinal)) {
      return res.status(400).json({
        erro: "Mês de referência inválido. Use o formato MM/AAAA"
      });
    }

    const valorPagoInformado = converterValorParaNumero(valor_pago ?? valorPago);

    if (valorPagoInformado !== null && valorPagoInformado <= 0) {
      return res.status(400).json({
        erro: "O valor pago precisa ser maior que zero"
      });
    }

    const importHash = `gasto_fixo:${gastoFixoIdFinal}:${mesReferenciaFinal}`;

    const resultado = await sql`
      WITH gasto AS (
        SELECT
          id,
          usuario_id,
          descricao,
          categoria,
          valor_previsto,
          dia_vencimento,
          pagamento
        FROM gastos_fixos
        WHERE id = ${gastoFixoIdFinal}
          AND usuario_id = ${usuarioId}
          AND COALESCE(
            TO_DATE(NULLIF(TRIM(mes_referencia::text), ''), 'MM/YYYY'),
            DATE_TRUNC('month', criado_em)::date
          ) <= TO_DATE(${mesReferenciaFinal}, 'MM/YYYY')
          AND (
            (
              ativo = TRUE
              AND NULLIF(TRIM(mes_fim::text), '') IS NULL
            )
            OR (
              NULLIF(TRIM(mes_fim::text), '') IS NOT NULL
              AND TO_DATE(mes_fim::text, 'MM/YYYY')
                  >= TO_DATE(${mesReferenciaFinal}, 'MM/YYYY')
            )
          )
      ),
      dados_pagamento AS (
        SELECT
          gasto.*,
          COALESCE(${valorPagoInformado}::numeric, gasto.valor_previsto) AS valor_pago_final
        FROM gasto
      ),
      novo_lancamento AS (
        INSERT INTO lancamentos
          (usuario_id, data, tipo, descricao, categoria, valor, pagamento, origem, import_hash)
        SELECT
          dp.usuario_id,
          ${dataBanco}::date,
          'Despesa',
          dp.descricao,
          dp.categoria,
          dp.valor_pago_final * -1,
          dp.pagamento,
          'gasto_fixo',
          ${importHash}
        FROM dados_pagamento dp
        WHERE dp.valor_pago_final > 0
          AND NOT EXISTS (
            SELECT 1
            FROM gastos_fixos_pagamentos gfp
            WHERE gfp.usuario_id = ${usuarioId}
              AND gfp.gasto_fixo_id = ${gastoFixoIdFinal}
              AND gfp.mes_referencia = ${mesReferenciaFinal}
          )
        RETURNING
          id,
          usuario_id,
          data,
          tipo,
          descricao,
          categoria,
          valor,
          pagamento,
          origem
      ),
      novo_pagamento AS (
        INSERT INTO gastos_fixos_pagamentos
          (usuario_id, gasto_fixo_id, mes_referencia, data_pagamento, valor_pago, lancamento_id)
        SELECT
          dp.usuario_id,
          dp.id,
          ${mesReferenciaFinal},
          ${dataBanco}::date,
          dp.valor_pago_final,
          nl.id
        FROM dados_pagamento dp
        INNER JOIN novo_lancamento nl
          ON nl.usuario_id = dp.usuario_id
        RETURNING
          id,
          usuario_id,
          gasto_fixo_id,
          mes_referencia,
          data_pagamento,
          valor_pago,
          lancamento_id
      )
      SELECT
        (SELECT COUNT(*) FROM gasto)::int AS gasto_encontrado,
        (SELECT COUNT(*) FROM novo_pagamento)::int AS pagamento_criado,

        (SELECT id FROM novo_pagamento LIMIT 1) AS pagamento_id,
        (SELECT lancamento_id FROM novo_pagamento LIMIT 1) AS lancamento_id,
        (SELECT mes_referencia FROM novo_pagamento LIMIT 1) AS mes_referencia,
        TO_CHAR((SELECT data_pagamento FROM novo_pagamento LIMIT 1), 'DD/MM/YYYY') AS data_pagamento,
        REPLACE((SELECT valor_pago FROM novo_pagamento LIMIT 1)::text, '.', ',') AS valor_pago,

        (SELECT descricao FROM dados_pagamento LIMIT 1) AS descricao,
        (SELECT categoria FROM dados_pagamento LIMIT 1) AS categoria,
        (SELECT pagamento FROM dados_pagamento LIMIT 1) AS pagamento,
        (SELECT valor_pago_final FROM dados_pagamento LIMIT 1) AS valor_pago_final,

        (SELECT tipo FROM novo_lancamento LIMIT 1) AS tipo_lancamento,
        REPLACE((SELECT valor FROM novo_lancamento LIMIT 1)::text, '.', ',') AS valor_lancamento,
        TO_CHAR((SELECT data FROM novo_lancamento LIMIT 1), 'DD/MM/YYYY') AS data_lancamento
    `;

    const dados = resultado[0];

    if (!dados || Number(dados.gasto_encontrado) === 0) {
      return res.status(404).json({
        erro: "Gasto fixo não encontrado ou não válido para este mês"
      });
    }

    if (Number(dados.valor_pago_final || 0) <= 0) {
      return res.status(400).json({
        erro: "O valor do gasto fixo precisa ser maior que zero"
      });
    }

    if (Number(dados.pagamento_criado) === 0) {
      const pagamentoExistente = await sql`
        SELECT
          id,
          lancamento_id,
          TO_CHAR(data_pagamento, 'DD/MM/YYYY') AS data_pagamento,
          REPLACE(valor_pago::text, '.', ',') AS valor_pago
        FROM gastos_fixos_pagamentos
        WHERE usuario_id = ${usuarioId}
          AND gasto_fixo_id = ${gastoFixoIdFinal}
          AND mes_referencia = ${mesReferenciaFinal}
        LIMIT 1
      `;

      if (pagamentoExistente.length > 0) {
        return res.status(409).json({
          erro: "Esse gasto fixo já foi marcado como pago neste mês",
          pagamento: pagamentoExistente[0]
        });
      }

      return res.status(400).json({
        erro: "Não foi possível marcar este gasto fixo como pago"
      });
    }

    return res.status(201).json({
      mensagem: "Gasto fixo marcado como pago com sucesso",
      pagamento: {
        id: dados.pagamento_id,
        gasto_fixo_id: gastoFixoIdFinal,
        lancamento_id: dados.lancamento_id,
        mes_referencia: dados.mes_referencia,
        data_pagamento: dados.data_pagamento,
        valor_pago: dados.valor_pago
      },
      lancamento: {
        id: dados.lancamento_id,
        data: dados.data_lancamento,
        tipo: dados.tipo_lancamento,
        descricao: dados.descricao,
        categoria: dados.categoria,
        valor: dados.valor_lancamento,
        pagamento: dados.pagamento,
        origem: "gasto_fixo"
      }
    });
  } catch (erro) {
    return tratarErro(res, erro);
  }
}
