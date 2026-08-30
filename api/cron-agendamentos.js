import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function dataAtualBrasil() {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo"
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const autorizacao = req.headers.authorization;

  if (
    !process.env.CRON_SECRET ||
    autorizacao !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ erro: "Não autorizado" });
  }

  try {
    const hojeBrasil = dataAtualBrasil();

    const resultado = await sql`
      WITH pendentes AS MATERIALIZED (
        SELECT
          a.id,
          a.usuario_id,
          a.data_agendada,
          a.tipo,
          a.descricao,
          a.categoria,
          a.valor,
          a.pagamento,
          'agendamento:' || a.id::text AS import_hash
        FROM agendamentos a
        INNER JOIN usuarios u
          ON u.id = a.usuario_id
          AND u.status = 'aprovado'
        WHERE a.status = 'pendente'
          AND a.data_agendada <= ${hojeBrasil}::date
        ORDER BY a.data_agendada, a.id
        LIMIT 500
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
            WHEN p.tipo = 'Despesa' THEN ABS(p.valor) * -1
            ELSE ABS(p.valor)
          END,
          p.pagamento,
          'agendamento',
          p.import_hash
        FROM pendentes p
        ON CONFLICT (usuario_id, import_hash) DO NOTHING
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
      processados AS (
        UPDATE agendamentos a
        SET
          status = 'processado',
          processado_em = NOW(),
          lancamento_id = v.lancamento_id,
          mensagem_erro = NULL
        FROM vinculos v
        WHERE a.id = v.agendamento_id
          AND v.lancamento_id IS NOT NULL
        RETURNING a.id
      )
      SELECT
        (SELECT COUNT(*) FROM pendentes)::int AS encontrados,
        (SELECT COUNT(*) FROM novos_lancamentos)::int AS criados,
        (SELECT COUNT(*) FROM processados)::int AS processados
    `;

    return res.status(200).json(resultado[0]);
  } catch (erro) {
    console.error("Erro no cron de agendamentos:", erro);

    return res.status(500).json({
      erro: "Erro ao processar agendamentos automáticos"
    });
  }
}