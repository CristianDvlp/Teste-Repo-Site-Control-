import { neon } from "@neondatabase/serverless";
import { validarTokenSessao } from "../lib/conta.js";

const sql = neon(process.env.DATABASE_URL);

function pegarCookie(req, nome) {
    const cookies = req.headers.cookie || "";
    const partes = cookies.split(";").map(cookie => cookie.trim());

    for (const parte of partes) {
        const [chave, valor] = parte.split("=");
        if (chave === nome) return valor;
    }
    return null;
}

async function obterUsuarioLogado(req) {
    const token = pegarCookie(req, "session");
    if (!token) throw new Error("NAO_LOGADO");

    const dados = await validarTokenSessao(token);
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

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
    const usuarioLogado = await obterUsuarioLogado(req);
        const usuarioId = usuarioLogado.id;
        if (['POST', 'PUT'].includes(req.method)) {
            const campos = ['id','data','tipo','descricao','categoria','valor','pagamento','FormaPagamento'];
            if (Object.keys(req.body || {}).some(k => !campos.includes(k))) return res.status(400).json({ erro: 'Formulário desatualizado. Recarregue a página antes de salvar.' });
        }

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

                    origem, import_hash
                FROM lancamentos
                WHERE usuario_id = ${usuarioId}
                ORDER BY data DESC, id DESC
            `;

            const [conta] = await sql`SELECT preferencias_app->'comprasCartao' AS compras FROM usuarios WHERE id=${usuarioId}`;
            const vinculos = new Map();
            for (const c of Object.values(conta?.compras || {})) {
                if (!Array.isArray(c?.hashes)) continue;
                c.hashes.forEach((hash,i)=>vinculos.set(hash,{cartaoId:c.cartaoId,compraId:c.compraId,numero:i+1,total:c.total,dataCompra:c.dataCompra}));
            }
            return res.status(200).json(lancamentos.map(({import_hash,...item})=>({...item,cartao:vinculos.get(import_hash)||null})));
        }

        if (req.method === "POST") {
            const body = req.body || {};

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
                    pagamento AS "FormaPagamento",

                    origem
            `;

            return res.status(201).json(novoLancamento[0]);
        }

        if (req.method === "PUT") {
            const { id, data, tipo, descricao, categoria, valor, pagamento, FormaPagamento } = req.body || {};
            if (!id) return res.status(400).json({ erro: "ID do lançamento é obrigatório" });

            const dataBanco = converterDataParaBanco(data);
            let valorBanco = converterValorParaNumero(valor);
            const pagamentoFinal = pagamento || FormaPagamento;

            if (!dataBanco || !tipo || !categoria || valorBanco === null || !pagamentoFinal) {
                return res.status(400).json({ erro: "Preencha data, tipo, categoria, valor e pagamento" });
            }

            const [original] = await sql`SELECT tipo,pagamento,origem FROM lancamentos WHERE id=${id} AND usuario_id=${usuarioId}`;
            if (!original) return res.status(404).json({erro:'Lançamento não encontrado.'});
            if (original.origem === 'cartao' && (tipo !== 'Despesa' || String(pagamentoFinal).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase() !== String(original.pagamento).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase())) return res.status(400).json({erro:'O tipo e o cartão de uma parcela não podem ser trocados. Edite apenas o valor, data, descrição ou categoria.'});
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

                    origem
            `;

            if (!atualizado.length) return res.status(404).json({ erro: "Lançamento não encontrado para este usuário" });
            return res.status(200).json(atualizado[0]);
        }

        if (req.method === "DELETE") {
            const { id } = req.body || {};

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
