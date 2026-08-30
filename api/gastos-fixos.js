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

  return Number.isFinite(numero) ? numero : null;
}

function normalizarTexto(valor) {
  return String(valor || "").trim();
}

function normalizarPagamento(pagamento) {
  const valor = String(pagamento || "").trim().toLowerCase();

  if (valor === "pix") return "Pix";
  if (valor === "debito" || valor === "débito") return "Debito";
  if (valor === "credito" || valor === "crédito") return "Credito";
  if (valor === "cartao a" || valor === "cartão a") return "Cartão A";
  if (valor === "cartao p" || valor === "cartão p") return "Cartão P";

  return String(pagamento || "").trim();
}

function obterMesReferenciaAtual() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ano = String(hoje.getFullYear());

  return `${mes}/${ano}`;
}

function validarMesReferencia(mesReferencia) {
  const texto = String(mesReferencia || "").trim();

  if (!/^\d{2}\/\d{4}$/.test(texto)) {
    return false;
  }

  const [mes, ano] = texto.split("/").map(Number);

  return mes >= 1 && mes <= 12 && ano >= 2020 && ano <= 2100;
}

function obterMesAnterior(mesReferencia) {
  const [mes, ano] = String(mesReferencia).split("/").map(Number);
  const data = new Date(ano, mes - 2, 1);

  return `${String(data.getMonth() + 1).padStart(2, "0")}/${data.getFullYear()}`;
}

function montarMesReferencia(req) {
  const mesReferencia = req.query?.mesReferencia || req.query?.mes || "";

  if (validarMesReferencia(mesReferencia)) {
    return String(mesReferencia).trim();
  }

  return obterMesReferenciaAtual();
}

function normalizarDiaVencimento(valor) {
  const dia = Number(valor);

  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    return null;
  }

  return dia;
}

function tratarErro(res, erro) {
  console.error(erro);

  if (erro.message === "NAO_LOGADO") {
    return res.status(401).json({
      erro: "Você precisa estar logado"
    });
  }

  if (
    erro.name === "JsonWebTokenError" ||
    erro.name === "TokenExpiredError"
  ) {
    return res.status(401).json({
      erro: "Sessão inválida ou expirada"
    });
  }

  return res.status(500).json({
    erro: "Erro ao processar gastos fixos"
  });
}

export default async function handler(req, res) {
  try {
    const usuarioLogado = obterUsuarioLogado(req);
    const usuarioId = usuarioLogado.id;

 if (req.method === "GET") {
  const mesReferencia = montarMesReferencia(req);

  const gastos = await sql`
    SELECT
      gf.id,
      gf.descricao,
      gf.categoria,
      REPLACE(gf.valor_previsto::text, '.', ',') AS valor_previsto,
      gf.dia_vencimento,
      gf.pagamento,
      gf.ativo,
      gf.mes_referencia,
      gf.mes_fim,
      TO_CHAR(gf.criado_em, 'DD/MM/YYYY HH24:MI') AS criado_em,
      gfp.id AS pagamento_id,
      gfp.lancamento_id,
      TO_CHAR(gfp.data_pagamento, 'DD/MM/YYYY') AS data_pagamento,
      REPLACE(gfp.valor_pago::text, '.', ',') AS valor_pago,
      CASE
        WHEN gfp.id IS NOT NULL THEN 'Pago'
        WHEN gf.dia_vencimento < EXTRACT(DAY FROM CURRENT_DATE)
          AND ${mesReferencia} = TO_CHAR(CURRENT_DATE, 'MM/YYYY')
          THEN 'Atrasado'
        ELSE 'Pendente'
      END AS status
    FROM gastos_fixos gf
    LEFT JOIN gastos_fixos_pagamentos gfp
      ON gfp.gasto_fixo_id = gf.id
      AND gfp.usuario_id = ${usuarioId}
      AND gfp.mes_referencia = ${mesReferencia}
    WHERE gf.usuario_id = ${usuarioId}
      AND COALESCE(
        TO_DATE(NULLIF(TRIM(gf.mes_referencia::text), ''), 'MM/YYYY'),
        DATE_TRUNC('month', gf.criado_em)::date
      ) <= TO_DATE(${mesReferencia}, 'MM/YYYY')
      AND (
        (
          gf.ativo = TRUE
          AND NULLIF(TRIM(gf.mes_fim::text), '') IS NULL
        )
        OR (
          NULLIF(TRIM(gf.mes_fim::text), '') IS NOT NULL
          AND TO_DATE(gf.mes_fim::text, 'MM/YYYY')
              >= TO_DATE(${mesReferencia}, 'MM/YYYY')
        )
      )
    ORDER BY gf.dia_vencimento ASC, gf.descricao ASC
  `;

  return res.status(200).json({
    mesReferencia,
    gastos
  });
}

    if (req.method === "POST") {
      const {
        descricao,
        categoria,
        valor_previsto,
        valorPrevisto,
        dia_vencimento,
        diaVencimento,
        pagamento,
        mes_referencia,
        mesReferencia
      } = req.body || {};

      const descricaoFinal = normalizarTexto(descricao);
      const categoriaFinal = normalizarTexto(categoria);
      const pagamentoFinal = normalizarPagamento(pagamento);
      const valorFinal = converterValorParaNumero(
        valor_previsto ?? valorPrevisto
      );
      const diaFinal = normalizarDiaVencimento(
        dia_vencimento ?? diaVencimento
      );

      const mesReferenciaFinal = validarMesReferencia(
        mes_referencia || mesReferencia
      )
        ? String(mes_referencia || mesReferencia).trim()
        : obterMesReferenciaAtual();

      if (
        !descricaoFinal ||
        !categoriaFinal ||
        valorFinal === null ||
        !diaFinal ||
        !pagamentoFinal
      ) {
        return res.status(400).json({
          erro: "Preencha descrição, categoria, valor previsto, dia de vencimento e pagamento"
        });
      }

      if (valorFinal <= 0) {
        return res.status(400).json({
          erro: "O valor previsto precisa ser maior que zero"
        });
      }

      const gastoDuplicado = await sql`
        SELECT id
        FROM gastos_fixos
        WHERE usuario_id = ${usuarioId}
          AND ativo = TRUE
          AND LOWER(TRIM(descricao)) = LOWER(TRIM(${descricaoFinal}))
          AND LOWER(TRIM(categoria)) = LOWER(TRIM(${categoriaFinal}))
          AND dia_vencimento = ${diaFinal}
          AND (
            NULLIF(TRIM(mes_fim::text), '') IS NULL
            OR TO_DATE(mes_fim::text, 'MM/YYYY')
               >= TO_DATE(${mesReferenciaFinal}, 'MM/YYYY')
          )
        LIMIT 1
      `;

      if (gastoDuplicado.length > 0) {
        return res.status(409).json({
          erro: "Esse gasto fixo já está cadastrado. Use Editar para alterar valor ou pagamento."
        });
      }

      const novoGasto = await sql`
        INSERT INTO gastos_fixos
          (
            usuario_id,
            descricao,
            categoria,
            valor_previsto,
            dia_vencimento,
            pagamento,
            ativo,
            tipo_controle,
            total_parcelas,
            parcela_inicial,
            mes_inicio,
            mes_referencia
          )
        VALUES
          (
            ${usuarioId},
            ${descricaoFinal},
            ${categoriaFinal},
            ${valorFinal},
            ${diaFinal},
            ${pagamentoFinal},
            TRUE,
            'fixo',
            NULL,
            NULL,
            NULL,
            ${mesReferenciaFinal}
          )
        RETURNING
          id,
          descricao,
          categoria,
          REPLACE(valor_previsto::text, '.', ',') AS valor_previsto,
          dia_vencimento,
          pagamento,
          ativo,
          tipo_controle,
          total_parcelas,
          parcela_inicial,
          mes_inicio,
          mes_referencia,
          TO_CHAR(criado_em, 'DD/MM/YYYY HH24:MI') AS criado_em
      `;

      return res.status(201).json(novoGasto[0]);
    }

    if (req.method === "PUT") {
      const {
        id,
        descricao,
        categoria,
        valor_previsto,
        valorPrevisto,
        dia_vencimento,
        diaVencimento,
        pagamento,
        ativo,
        mes_referencia,
        mesReferencia
      } = req.body || {};

      if (!id) {
        return res.status(400).json({
          erro: "ID do gasto fixo é obrigatório"
        });
      }

      const descricaoFinal = normalizarTexto(descricao);
      const categoriaFinal = normalizarTexto(categoria);
      const pagamentoFinal = normalizarPagamento(pagamento);
      const valorFinal = converterValorParaNumero(
        valor_previsto ?? valorPrevisto
      );
      const diaFinal = normalizarDiaVencimento(
        dia_vencimento ?? diaVencimento
      );
      const ativoFinal = ativo === undefined ? true : Boolean(ativo);

      const mesReferenciaFinal = validarMesReferencia(
        mes_referencia || mesReferencia
      )
        ? String(mes_referencia || mesReferencia).trim()
        : obterMesReferenciaAtual();

      if (
        !descricaoFinal ||
        !categoriaFinal ||
        valorFinal === null ||
        !diaFinal ||
        !pagamentoFinal
      ) {
        return res.status(400).json({
          erro: "Preencha descrição, categoria, valor previsto, dia de vencimento e pagamento"
        });
      }

      if (valorFinal <= 0) {
        return res.status(400).json({
          erro: "O valor previsto precisa ser maior que zero"
        });
      }

      const gastoDuplicado = await sql`
        SELECT id
        FROM gastos_fixos
        WHERE usuario_id = ${usuarioId}
          AND id <> ${id}
          AND ativo = TRUE
          AND LOWER(TRIM(descricao)) = LOWER(TRIM(${descricaoFinal}))
          AND LOWER(TRIM(categoria)) = LOWER(TRIM(${categoriaFinal}))
          AND dia_vencimento = ${diaFinal}
          AND (
            NULLIF(TRIM(mes_fim::text), '') IS NULL
            OR TO_DATE(mes_fim::text, 'MM/YYYY')
               >= TO_DATE(${mesReferenciaFinal}, 'MM/YYYY')
          )
        LIMIT 1
      `;

      if (gastoDuplicado.length > 0) {
        return res.status(409).json({
          erro: "Já existe outro gasto fixo igual ativo. Edite o cadastro existente."
        });
      }

      const atualizado = await sql`
        UPDATE gastos_fixos
        SET
          descricao = ${descricaoFinal},
          categoria = ${categoriaFinal},
          valor_previsto = ${valorFinal},
          dia_vencimento = ${diaFinal},
          pagamento = ${pagamentoFinal},
          ativo = ${ativoFinal},
          tipo_controle = 'fixo',
          total_parcelas = NULL,
          parcela_inicial = NULL,
          mes_inicio = NULL
        WHERE id = ${id}
          AND usuario_id = ${usuarioId}
        RETURNING
          id,
          descricao,
          categoria,
          REPLACE(valor_previsto::text, '.', ',') AS valor_previsto,
          dia_vencimento,
          pagamento,
          ativo,
          tipo_controle,
          total_parcelas,
          parcela_inicial,
          mes_inicio,
          mes_referencia,
          TO_CHAR(criado_em, 'DD/MM/YYYY HH24:MI') AS criado_em
      `;

      if (atualizado.length === 0) {
        return res.status(404).json({
          erro: "Gasto fixo não encontrado para este usuário"
        });
      }

      return res.status(200).json(atualizado[0]);
    }

    if (req.method === "DELETE") {
      const {
        id,
        mes_referencia,
        mesReferencia
      } = req.body || {};

      if (!id) {
        return res.status(400).json({
          erro: "ID do gasto fixo é obrigatório"
        });
      }

      const mesReferenciaFinal = validarMesReferencia(
        mes_referencia || mesReferencia
      )
        ? String(mes_referencia || mesReferencia).trim()
        : obterMesReferenciaAtual();

      const mesFimFinal = obterMesAnterior(mesReferenciaFinal);

      const resultado = await sql`
        UPDATE gastos_fixos
        SET
          ativo = FALSE,
          mes_fim = ${mesFimFinal}
        WHERE id = ${id}
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
        RETURNING id
      `;

      const dados = resultado[0];

      if (!dados || !dados.id) {
        return res.status(404).json({
          erro: "Gasto fixo não encontrado para este usuário neste mês"
        });
      }

      return res.status(200).json({
        id: dados.id,
        mesFim: mesFimFinal,
        mensagem: "Gasto fixo encerrado. Os pagamentos anteriores foram mantidos."
      });
    }

    return res.status(405).json({
      erro: "Método não permitido"
    });
  } catch (erro) {
    return tratarErro(res, erro);
  }
}
