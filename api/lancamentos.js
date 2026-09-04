import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

const sql = neon(process.env.DATABASE_URL);
const MAX_PARCELAS = 60;

function pegarCookie(req, nome) {
    const cookies = req.headers.cookie || "";
    const partes = cookies.split(";").map(cookie => cookie.trim());

    for (const parte of partes) {
        const [chave, valor] = parte.split("=");
        if (chave === nome) return valor;
    }
    return null;
}

function obterUsuarioLogado(req) {
    const token = pegarCookie(req, "session");
    if (!token) throw new Error("NAO_LOGADO");

    const dados = jwt.verify(token, process.env.JWT_SECRET);
    return { id: dados.id, usuario: dados.usuario };
}

function converterDataParaBanco(data) {
    if (!data) return null;
    const texto = String(data).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

    const partes = texto.split(/[/-]/);
    if (partes.length !== 3) return null;

    let [dia, mes, ano] = partes;
    dia = dia.padStart(2, "0");
    mes = mes.padStart(2, "0");
    if (ano.length === 2) ano = `20${ano}`;

    const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia));
    if (
        Number.isNaN(dataObj.getTime()) ||
        dataObj.getFullYear() !== Number(ano) ||
        dataObj.getMonth() !== Number(mes) - 1 ||
        dataObj.getDate() !== Number(dia)
    ) return null;

    return `${ano}-${mes}-${dia}`;
}

function converterValorParaNumero(valor) {
    if (valor === undefined || valor === null || valor === "") return null;
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;

    const limpo = String(valor)
        .replace("R$", "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");

    const numero = Number(limpo);
    return Number.isFinite(numero) ? numero : null;
}

function ajustarValorPorTipo(tipo, valor) {
    let numero = Number(valor);
    if (tipo === "Despesa" && numero > 0) numero *= -1;
    if ((tipo === "Receita" || tipo === "Vales") && numero < 0) numero = Math.abs(numero);
    return numero;
}

function parcelasValidas(parcelas, totalParcelas, valorTotal) {
    if (!Array.isArray(parcelas) || parcelas.length !== totalParcelas) {
        return { ok: false, erro: "A quantidade de parcelas geradas não confere" };
    }

    const tratadas = [];
    let somaCentavos = 0;

    for (let indice = 0; indice < parcelas.length; indice += 1) {
        const parcela = parcelas[indice] || {};
        const dataBanco = converterDataParaBanco(parcela.data);
        const valorNumero = converterValorParaNumero(parcela.valor);

        if (!dataBanco) return { ok: false, erro: `Data inválida na parcela ${indice + 1}` };
        if (!(valorNumero > 0)) return { ok: false, erro: `Valor inválido na parcela ${indice + 1}` };

        somaCentavos += Math.round(valorNumero * 100);
        tratadas.push({
            data: dataBanco,
            valor: ajustarValorPorTipo("Despesa", valorNumero),
            paga: Boolean(parcela.paga),
            parcelaAtual: indice + 1
        });
    }

    const totalCentavos = Math.round(valorTotal * 100);
    if (somaCentavos !== totalCentavos) {
        return { ok: false, erro: "A soma das parcelas precisa ser igual ao valor total da compra" };
    }

    return { ok: true, parcelas: tratadas };
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
                    parcelado,
                    parcela_atual AS "parcelaAtual",
                    total_parcelas AS "totalParcelas",
                    grupo_parcelamento AS "grupoParcelamento",
                    REPLACE(COALESCE(valor_total_compra, 0)::text, '.', ',') AS "valorTotalCompra",
                    parcela_paga AS "parcelaPaga",
                    CASE WHEN data_pagamento IS NULL THEN NULL ELSE TO_CHAR(data_pagamento, 'DD/MM/YYYY') END AS "dataPagamento",
                    origem
                FROM lancamentos
                WHERE usuario_id = ${usuarioId}
                ORDER BY data DESC, id DESC
            `;

            return res.status(200).json(lancamentos);
        }

        if (req.method === "POST") {
            const body = req.body || {};

            // Nova compra parcelada: todas as parcelas são criadas em uma única operação SQL.
            if (body.parcelado && Array.isArray(body.parcelas)) {
                const descricao = String(body.descricao || "").trim();
                const categoria = String(body.categoria || "").trim();
                const pagamentoFinal = body.pagamento || body.FormaPagamento;
                const valorTotal = converterValorParaNumero(body.valorTotalCompra ?? body.valor);
                const totalParcelas = Number(body.totalParcelas);

                if (!categoria || !pagamentoFinal || !(valorTotal > 0)) {
                    return res.status(400).json({ erro: "Preencha categoria, valor total e pagamento" });
                }

                if (!Number.isInteger(totalParcelas) || totalParcelas < 2 || totalParcelas > MAX_PARCELAS) {
                    return res.status(400).json({ erro: `Informe entre 2 e ${MAX_PARCELAS} parcelas` });
                }

                const validacao = parcelasValidas(body.parcelas, totalParcelas, valorTotal);
                if (!validacao.ok) return res.status(400).json({ erro: validacao.erro });

                const grupoParcelamento = randomUUID();
                const parcelasJson = JSON.stringify(validacao.parcelas);

                const novos = await sql`
                    WITH dados AS (
                        SELECT item, ordinality
                        FROM jsonb_array_elements(${parcelasJson}::jsonb) WITH ORDINALITY AS t(item, ordinality)
                    )
                    INSERT INTO lancamentos (
                        usuario_id, data, tipo, descricao, categoria, valor, pagamento,
                        parcelado, parcela_atual, total_parcelas, grupo_parcelamento,
                        valor_total_compra, parcela_paga, data_pagamento, origem
                    )
                    SELECT
                        ${usuarioId},
                        (item->>'data')::date,
                        'Despesa',
                        ${descricao},
                        ${categoria},
                        (item->>'valor')::numeric,
                        ${pagamentoFinal},
                        true,
                        (item->>'parcelaAtual')::integer,
                        ${totalParcelas},
                        ${grupoParcelamento},
                        ${valorTotal},
                        (item->>'paga')::boolean,
                        CASE WHEN (item->>'paga')::boolean THEN (item->>'data')::date ELSE NULL END,
                        'site'
                    FROM dados
                    ORDER BY ordinality
                    RETURNING
                        id,
                        TO_CHAR(data, 'DD/MM/YYYY') AS data,
                        tipo,
                        descricao,
                        categoria,
                        REPLACE(valor::text, '.', ',') AS valor,
                        pagamento AS "FormaPagamento",
                        parcelado,
                        parcela_atual AS "parcelaAtual",
                        total_parcelas AS "totalParcelas",
                        grupo_parcelamento AS "grupoParcelamento",
                        REPLACE(valor_total_compra::text, '.', ',') AS "valorTotalCompra",
                        parcela_paga AS "parcelaPaga",
                        CASE WHEN data_pagamento IS NULL THEN NULL ELSE TO_CHAR(data_pagamento, 'DD/MM/YYYY') END AS "dataPagamento",
                        origem
                `;

                return res.status(201).json({
                    grupoParcelamento,
                    totalParcelas,
                    valorTotalCompra: valorTotal,
                    lancamentos: novos
                });
            }

            const { data, tipo, descricao, categoria, valor, pagamento, FormaPagamento } = body;
            const dataBanco = converterDataParaBanco(data);
            let valorBanco = converterValorParaNumero(valor);
            const pagamentoFinal = pagamento || FormaPagamento;

            if (!dataBanco || !tipo || !categoria || valorBanco === null || !pagamentoFinal) {
                return res.status(400).json({ erro: "Preencha data, tipo, categoria, valor e pagamento" });
            }

            valorBanco = ajustarValorPorTipo(tipo, valorBanco);

            const novoLancamento = await sql`
                INSERT INTO lancamentos
                    (usuario_id, data, tipo, descricao, categoria, valor, pagamento, parcelado, parcela_atual, total_parcelas, grupo_parcelamento, valor_total_compra, parcela_paga, data_pagamento, origem)
                VALUES
                    (${usuarioId}, ${dataBanco}, ${tipo}, ${descricao || ""}, ${categoria}, ${valorBanco}, ${pagamentoFinal}, false, NULL, NULL, NULL, NULL, true, ${dataBanco}, 'site')
                RETURNING
                    id,
                    TO_CHAR(data, 'DD/MM/YYYY') AS data,
                    tipo,
                    descricao,
                    categoria,
                    REPLACE(valor::text, '.', ',') AS valor,
                    pagamento AS "FormaPagamento",
                    parcelado,
                    parcela_atual AS "parcelaAtual",
                    total_parcelas AS "totalParcelas",
                    grupo_parcelamento AS "grupoParcelamento",
                    REPLACE(COALESCE(valor_total_compra, 0)::text, '.', ',') AS "valorTotalCompra",
                    parcela_paga AS "parcelaPaga",
                    CASE WHEN data_pagamento IS NULL THEN NULL ELSE TO_CHAR(data_pagamento, 'DD/MM/YYYY') END AS "dataPagamento",
                    origem
            `;

            return res.status(201).json(novoLancamento[0]);
        }

        if (req.method === "PATCH") {
            const { id, parcelaPaga } = req.body || {};
            if (!id || typeof parcelaPaga !== "boolean") {
                return res.status(400).json({ erro: "Informe o lançamento e o novo status da parcela" });
            }

            const atualizado = await sql`
                UPDATE lancamentos
                SET
                    parcela_paga = ${parcelaPaga},
                    data_pagamento = CASE
                        WHEN ${parcelaPaga} THEN COALESCE(data_pagamento, CURRENT_DATE)
                        ELSE NULL
                    END
                WHERE id = ${id}
                  AND usuario_id = ${usuarioId}
                  AND parcelado = true
                RETURNING
                    id,
                    parcela_paga AS "parcelaPaga",
                    CASE WHEN data_pagamento IS NULL THEN NULL ELSE TO_CHAR(data_pagamento, 'DD/MM/YYYY') END AS "dataPagamento"
            `;

            if (!atualizado.length) return res.status(404).json({ erro: "Parcela não encontrada" });
            return res.status(200).json(atualizado[0]);
        }

        if (req.method === "PUT") {
            const { id, data, tipo, descricao, categoria, valor, pagamento, FormaPagamento } = req.body || {};
            if (!id) return res.status(400).json({ erro: "ID do lançamento é obrigatório" });

            const atual = await sql`
                SELECT parcelado, grupo_parcelamento
                FROM lancamentos
                WHERE id = ${id} AND usuario_id = ${usuarioId}
                LIMIT 1
            `;

            if (!atual.length) return res.status(404).json({ erro: "Lançamento não encontrado para este usuário" });
            if (atual[0].parcelado && atual[0].grupo_parcelamento) {
                return res.status(400).json({ erro: "Gerencie compras parceladas pela aba Parcelamentos" });
            }

            const dataBanco = converterDataParaBanco(data);
            let valorBanco = converterValorParaNumero(valor);
            const pagamentoFinal = pagamento || FormaPagamento;

            if (!dataBanco || !tipo || !categoria || valorBanco === null || !pagamentoFinal) {
                return res.status(400).json({ erro: "Preencha data, tipo, categoria, valor e pagamento" });
            }

            valorBanco = ajustarValorPorTipo(tipo, valorBanco);

            const atualizado = await sql`
                UPDATE lancamentos
                SET data = ${dataBanco}, tipo = ${tipo}, descricao = ${descricao || ""},
                    categoria = ${categoria}, valor = ${valorBanco}, pagamento = ${pagamentoFinal}
                WHERE id = ${id} AND usuario_id = ${usuarioId}
                RETURNING
                    id,
                    TO_CHAR(data, 'DD/MM/YYYY') AS data,
                    tipo,
                    descricao,
                    categoria,
                    REPLACE(valor::text, '.', ',') AS valor,
                    pagamento AS "FormaPagamento",
                    parcelado,
                    parcela_atual AS "parcelaAtual",
                    total_parcelas AS "totalParcelas",
                    grupo_parcelamento AS "grupoParcelamento",
                    REPLACE(COALESCE(valor_total_compra, 0)::text, '.', ',') AS "valorTotalCompra",
                    parcela_paga AS "parcelaPaga",
                    CASE WHEN data_pagamento IS NULL THEN NULL ELSE TO_CHAR(data_pagamento, 'DD/MM/YYYY') END AS "dataPagamento",
                    origem
            `;

            return res.status(200).json(atualizado[0]);
        }

        if (req.method === "DELETE") {
            const { id, grupoParcelamento } = req.body || {};

            if (grupoParcelamento) {
                const excluidos = await sql`
                    DELETE FROM lancamentos
                    WHERE usuario_id = ${usuarioId}
                      AND grupo_parcelamento = ${grupoParcelamento}
                    RETURNING id
                `;

                if (!excluidos.length) return res.status(404).json({ erro: "Parcelamento não encontrado" });
                return res.status(200).json({ grupoParcelamento, quantidadeExcluida: excluidos.length });
            }

            if (!id) return res.status(400).json({ erro: "ID do lançamento é obrigatório" });

            const resultado = await sql`
                WITH lancamento_alvo AS (
                    SELECT id
                    FROM lancamentos
                    WHERE id = ${id} AND usuario_id = ${usuarioId}
                    LIMIT 1
                ),
                pagamento_excluido AS (
                    DELETE FROM gastos_fixos_pagamentos gfp
                    USING lancamento_alvo la
                    WHERE gfp.lancamento_id = la.id AND gfp.usuario_id = ${usuarioId}
                    RETURNING gfp.id
                ),
                lancamento_excluido AS (
                    DELETE FROM lancamentos l
                    USING lancamento_alvo la
                    WHERE l.id = la.id AND l.usuario_id = ${usuarioId}
                    RETURNING l.id
                )
                SELECT
                    (SELECT id FROM lancamento_excluido LIMIT 1) AS id,
                    (SELECT COUNT(*) FROM pagamento_excluido)::int AS pagamentos_excluidos
            `;

            const dados = resultado[0];
            if (!dados || !dados.id) return res.status(404).json({ erro: "Lançamento não encontrado para este usuário" });

            return res.status(200).json({
                id: dados.id,
                pagamentosExcluidos: dados.pagamentos_excluidos,
                mensagem: "Lançamento excluído com sucesso"
            });
        }

        return res.status(405).json({ erro: "Método não permitido" });
    } catch (erro) {
        console.error(erro);
        if (erro.message === "NAO_LOGADO") return res.status(401).json({ erro: "Você precisa estar logado" });
        return res.status(500).json({ erro: "Erro ao processar lançamentos" });
    }
}
