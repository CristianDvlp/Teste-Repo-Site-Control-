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

function converterDataParaBanco(data) {
    if (!data) return null;

    const texto = String(data).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return texto;
    }

    const partes = texto.split(/[/-]/);

    if (partes.length !== 3) {
        return null;
    }

    let [dia, mes, ano] = partes;

    dia = dia.padStart(2, "0");
    mes = mes.padStart(2, "0");

    if (ano.length === 2) {
        ano = `20${ano}`;
    }

    return `${ano}-${mes}-${dia}`;
}

function converterValorParaNumero(valor) {
    if (valor === undefined || valor === null || valor === "") {
        return null;
    }

    if (typeof valor === "number") {
        return valor;
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

function ajustarValorPorTipo(tipo, valor) {
    let numero = Number(valor);

    if (tipo === "Despesa" && numero > 0) {
        numero = numero * -1;
    }

    if ((tipo === "Receita" || tipo === "Vales") && numero < 0) {
        numero = Math.abs(numero);
    }

    return numero;
}

export default async function handler(req, res) {
    try {
        const usuarioLogado = obterUsuarioLogado(req);
        const usuarioId = usuarioLogado.id;

        if (req.method === "GET") {
            const lancamentos = await sql`
                SELECT
                    id,
                    TO_CHAR(data, 'DD/MM/YYYY') AS data,
                    tipo,
                    descricao,
                    categoria,
                    REPLACE(valor::text, '.', ',') AS valor,
                    pagamento AS "FormaPagamento",
                    origem
                FROM lancamentos
                WHERE usuario_id = ${usuarioId}
                ORDER BY data DESC, id DESC
                `;

            return res.status(200).json(lancamentos);
        }

        if (req.method === "POST") {
            const { data, tipo, descricao, categoria, valor, pagamento, FormaPagamento } = req.body;

            const dataBanco = converterDataParaBanco(data);
            let valorBanco = converterValorParaNumero(valor);
            const pagamentoFinal = pagamento || FormaPagamento;

            if (!dataBanco || !tipo || !categoria || valorBanco === null || !pagamentoFinal) {
                return res.status(400).json({
                    erro: "Preencha data, tipo, categoria, valor e pagamento"
                });
            }

            valorBanco = ajustarValorPorTipo(tipo, valorBanco);

            const novoLancamento = await sql`
        INSERT INTO lancamentos
          (usuario_id, data, tipo, descricao, categoria, valor, pagamento, origem)
        VALUES
          (${usuarioId}, ${dataBanco}, ${tipo}, ${descricao || ""}, ${categoria}, ${valorBanco}, ${pagamentoFinal}, 'site')
        RETURNING
          id,
          TO_CHAR(data, 'DD/MM/YYYY') AS data,
          tipo,
          descricao,
          categoria,
          REPLACE(valor::text, '.', ',') AS valor,
          pagamento AS "FormaPagamento"
      `;

            return res.status(201).json(novoLancamento[0]);
        }

        if (req.method === "PUT") {
            const { id, data, tipo, descricao, categoria, valor, pagamento, FormaPagamento } = req.body;

            if (!id) {
                return res.status(400).json({ erro: "ID do lançamento é obrigatório" });
            }

            const dataBanco = converterDataParaBanco(data);
            let valorBanco = converterValorParaNumero(valor);
            const pagamentoFinal = pagamento || FormaPagamento;

            if (!dataBanco || !tipo || !categoria || valorBanco === null || !pagamentoFinal) {
                return res.status(400).json({
                    erro: "Preencha data, tipo, categoria, valor e pagamento"
                });
            }

            valorBanco = ajustarValorPorTipo(tipo, valorBanco);

            const atualizado = await sql`
        UPDATE lancamentos
        SET
          data = ${dataBanco},
          tipo = ${tipo},
          descricao = ${descricao || ""},
          categoria = ${categoria},
          valor = ${valorBanco},
          pagamento = ${pagamentoFinal}
        WHERE id = ${id}
          AND usuario_id = ${usuarioId}
        RETURNING
          id,
          TO_CHAR(data, 'DD/MM/YYYY') AS data,
          tipo,
          descricao,
          categoria,
          REPLACE(valor::text, '.', ',') AS valor,
          pagamento AS "FormaPagamento"
      `;

            if (atualizado.length === 0) {
                return res.status(404).json({
                    erro: "Lançamento não encontrado para este usuário"
                });
            }

            return res.status(200).json(atualizado[0]);
        }

        if (req.method === "DELETE") {
            const { id } = req.body || {};

            if (!id) {
                return res.status(400).json({ erro: "ID do lançamento é obrigatório" });
            }

            const resultado = await sql`
    WITH lancamento_alvo AS (
      SELECT id
      FROM lancamentos
      WHERE id = ${id}
        AND usuario_id = ${usuarioId}
      LIMIT 1
    ),
    pagamento_excluido AS (
      DELETE FROM gastos_fixos_pagamentos gfp
      USING lancamento_alvo la
      WHERE gfp.lancamento_id = la.id
        AND gfp.usuario_id = ${usuarioId}
      RETURNING gfp.id, gfp.gasto_fixo_id, gfp.mes_referencia
    ),
    lancamento_excluido AS (
      DELETE FROM lancamentos l
      USING lancamento_alvo la
      WHERE l.id = la.id
        AND l.usuario_id = ${usuarioId}
      RETURNING l.id
    )
    SELECT
      (SELECT id FROM lancamento_excluido LIMIT 1) AS id,
      (SELECT COUNT(*) FROM pagamento_excluido)::int AS pagamentos_excluidos,
      0::int AS gastos_fixos_excluidos
  `;

            const dados = resultado[0];

            if (!dados || !dados.id) {
                return res.status(404).json({
                    erro: "Lançamento não encontrado para este usuário"
                });
            }

            return res.status(200).json({
                id: dados.id,
                pagamentosExcluidos: dados.pagamentos_excluidos,
                gastosFixosExcluidos: dados.gastos_fixos_excluidos,
                mensagem: "Lançamento excluído com sucesso"
            });
        }

        return res.status(405).json({ erro: "Método não permitido" });
    } catch (erro) {
        console.error(erro);

        if (erro.message === "NAO_LOGADO") {
            return res.status(401).json({ erro: "Você precisa estar logado" });
        }

        return res.status(500).json({ erro: "Erro ao processar lançamentos" });
    }
}