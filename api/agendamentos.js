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

function normalizarId(valor) {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
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
  if (!data) return null;

  const texto = String(data).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split("-");
    return dataExiste(ano, mes, dia) ? texto : null;
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split("/");

    return dataExiste(ano, mes, dia)
      ? `${ano}-${mes}-${dia}`
      : null;
  }

  return null;
}

function converterValorParaNumero(valor) {
  if (valor === undefined || valor === null || valor === "") {
    return null;
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? Math.abs(valor) : null;
  }

  let texto = String(valor)
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/-/g, "")
    .replace(/[^\d.,]/g, "");

  if (texto.includes(",") && texto.includes(".")) {
    if (texto.lastIndexOf(",") > texto.lastIndexOf(".")) {
      texto = texto.replace(/\./g, "").replace(",", ".");
    } else {
      texto = texto.replace(/,/g, "");
    }
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  const numero = Number(texto);

  return Number.isFinite(numero)
    ? Math.abs(numero)
    : null;
}

function normalizarTipo(tipo) {
  const texto = String(tipo || "").trim().toLowerCase();

  if (texto === "receita") return "Receita";
  if (texto === "despesa") return "Despesa";
  if (texto === "vale" || texto === "vales") return "Vales";

  return "";
}

function normalizarPagamento(pagamento) {
  const texto = String(pagamento || "").trim().toLowerCase();

  if (texto === "pix") return "Pix";
  if (texto === "debito" || texto === "débito") return "Debito";
  if (texto === "credito" || texto === "crédito") return "Credito";
  if (texto === "cartao a" || texto === "cartão a") return "Cartão A";
  if (texto === "cartao p" || texto === "cartão p") return "Cartão P";

  return String(pagamento || "").trim();
}

async function listarAgendamentos(res, usuarioId) {
  const agendamentos = await sql`
    SELECT
      id,
      TO_CHAR(data_agendada, 'DD/MM/YYYY') AS data,
      tipo,
      descricao,
      categoria,
      REPLACE(valor::text, '.', ',') AS valor,
      pagamento,
      status,
      TO_CHAR(criado_em, 'DD/MM/YYYY HH24:MI') AS criado_em
    FROM agendamentos
    WHERE usuario_id = ${usuarioId}
      AND status = 'pendente'
    ORDER BY data_agendada ASC, id ASC
  `;

  return res.status(200).json(agendamentos);
}

async function criarAgendamento(req, res, usuarioId) {
  const {
    data,
    data_agendada,
    dataAgendada,
    tipo,
    descricao,
    categoria,
    valor,
    pagamento
  } = req.body || {};

  const dataBanco = converterDataParaBanco(
    data_agendada || dataAgendada || data
  );

  const tipoFinal = normalizarTipo(tipo);
  const descricaoFinal = String(descricao || "").trim();
  const categoriaFinal = String(categoria || "").trim();
  const valorFinal = converterValorParaNumero(valor);
  const pagamentoFinal = normalizarPagamento(pagamento);

  if (
    !dataBanco ||
    !tipoFinal ||
    !categoriaFinal ||
    valorFinal === null ||
    !pagamentoFinal
  ) {
    return res.status(400).json({
      erro: "Preencha data, tipo, categoria, valor e pagamento"
    });
  }

  if (valorFinal <= 0) {
    return res.status(400).json({
      erro: "O valor precisa ser maior que zero"
    });
  }

  if (dataBanco < dataAtualBrasil()) {
    return res.status(400).json({
      erro: "A data do agendamento não pode estar no passado"
    });
  }

  const criado = await sql`
    INSERT INTO agendamentos (
      usuario_id,
      data_agendada,
      tipo,
      descricao,
      categoria,
      valor,
      pagamento,
      status
    )
    VALUES (
      ${usuarioId},
      ${dataBanco}::date,
      ${tipoFinal},
      ${descricaoFinal},
      ${categoriaFinal},
      ${valorFinal},
      ${pagamentoFinal},
      'pendente'
    )
    RETURNING
      id,
      TO_CHAR(data_agendada, 'DD/MM/YYYY') AS data,
      tipo,
      descricao,
      categoria,
      REPLACE(valor::text, '.', ',') AS valor,
      pagamento,
      status
  `;

  return res.status(201).json(criado[0]);
}

async function processarAgendamentos(res, usuarioId) {
  const hojeBrasil = dataAtualBrasil();

  const resultado = await sql`
    WITH pendentes AS MATERIALIZED (
      SELECT
        id,
        usuario_id,
        data_agendada,
        tipo,
        descricao,
        categoria,
        valor,
        pagamento,
        'agendamento:' || id::text AS import_hash
      FROM agendamentos
      WHERE usuario_id = ${usuarioId}
        AND status = 'pendente'
        AND data_agendada <= ${hojeBrasil}::date
      ORDER BY data_agendada ASC, id ASC
      LIMIT 100
    ),

    novos_lancamentos AS (
      INSERT INTO lancamentos (
        usuario_id,
        data,
        tipo,
        descricao,
        categoria,
        valor,
        pagamento,
        origem,
        import_hash
      )
      SELECT
        p.usuario_id,
        p.data_agendada,
        p.tipo,
        p.descricao,
        p.categoria,
        CASE
          WHEN p.tipo = 'Despesa' THEN p.valor * -1
          ELSE ABS(p.valor)
        END,
        p.pagamento,
        'agendamento',
        p.import_hash
      FROM pendentes p
      ON CONFLICT DO NOTHING
      RETURNING id, usuario_id, import_hash
    ),

    vinculos AS (
      SELECT
        p.id AS agendamento_id,
        COALESCE(nl.id, l.id) AS lancamento_id
      FROM pendentes p

      LEFT JOIN novos_lancamentos nl
        ON nl.usuario_id = p.usuario_id
        AND nl.import_hash = p.import_hash

      LEFT JOIN lancamentos l
        ON l.usuario_id = p.usuario_id
        AND l.import_hash = p.import_hash
    ),

    atualizados AS (
      UPDATE agendamentos a
      SET
        status = 'processado',
        processado_em = NOW(),
        lancamento_id = v.lancamento_id,
        mensagem_erro = NULL
      FROM vinculos v
      WHERE a.id = v.agendamento_id
        AND a.usuario_id = ${usuarioId}
        AND v.lancamento_id IS NOT NULL
      RETURNING a.id, a.lancamento_id
    )

    SELECT
      (SELECT COUNT(*) FROM pendentes)::int AS encontrados,
      (SELECT COUNT(*) FROM novos_lancamentos)::int AS lancamentos_criados,
      (SELECT COUNT(*) FROM atualizados)::int AS processados
  `;

  const dados = resultado[0] || {};

  return res.status(200).json({
    encontrados: Number(dados.encontrados || 0),
    lancamentosCriados: Number(dados.lancamentos_criados || 0),
    processados: Number(dados.processados || 0)
  });
}

async function cancelarAgendamento(req, res, usuarioId) {
  const id = normalizarId(req.body?.id);

  if (!id) {
    return res.status(400).json({
      erro: "ID do agendamento é obrigatório"
    });
  }

  const cancelado = await sql`
    UPDATE agendamentos
    SET status = 'cancelado'
    WHERE id = ${id}
      AND usuario_id = ${usuarioId}
      AND status = 'pendente'
    RETURNING id
  `;

  if (cancelado.length === 0) {
    return res.status(404).json({
      erro: "Agendamento pendente não encontrado para este usuário"
    });
  }

  return res.status(200).json({
    id: cancelado[0].id,
    mensagem: "Agendamento cancelado com sucesso"
  });
}

export default async function handler(req, res) {
  try {
    const usuarioLogado = obterUsuarioLogado(req);
    const usuarioId = usuarioLogado.id;

    if (req.method === "GET") {
      return listarAgendamentos(res, usuarioId);
    }

    if (req.method === "POST") {
      const acao = String(req.body?.acao || "")
        .trim()
        .toLowerCase();

      if (acao === "processar") {
        return processarAgendamentos(res, usuarioId);
      }

      return criarAgendamento(req, res, usuarioId);
    }

    if (req.method === "DELETE") {
      return cancelarAgendamento(req, res, usuarioId);
    }

    return res.status(405).json({
      erro: "Método não permitido"
    });
  } catch (erro) {
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
      erro: "Erro ao processar agendamentos"
    });
  }
}