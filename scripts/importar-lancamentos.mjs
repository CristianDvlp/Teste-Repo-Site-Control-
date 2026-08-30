import fs from "node:fs";
import crypto from "node:crypto";
import dotenv from "dotenv";
import { parse } from "csv-parse/sync";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const sql = neon(process.env.DATABASE_URL);

const usuario = process.argv[2];
const caminhoCsv = process.argv[3] || "./backup-lancamentos.csv";

if (!process.env.DATABASE_URL) {
    console.log("Erro: DATABASE_URL não encontrada.");
    console.log("Crie o arquivo .env.local com sua DATABASE_URL do Neon.");
    process.exit(1);
}

if (!usuario) {
    console.log("Use assim:");
    console.log("node scripts/importar-lancamentos.mjs SEU_USUARIO ./backup-lancamentos.csv");
    process.exit(1);
}

function converterDataBR(valor) {
    if (!valor) return null;

    const texto = String(valor).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return texto;
    }

    const partes = texto.split(/[/-]/);

    if (partes.length !== 3) {
        throw new Error(`Data inválida: ${valor}`);
    }

    let [dia, mes, ano] = partes;

    dia = dia.padStart(2, "0");
    mes = mes.padStart(2, "0");

    if (ano.length === 2) {
        ano = `20${ano}`;
    }

    return `${ano}-${mes}-${dia}`;
}

function converterValorBR(valor) {
    if (valor === undefined || valor === null || valor === "") {
        return null;
    }

    const limpo = String(valor)
        .replace("R$", "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(",", ".");

    const numero = Number(limpo);

    if (!Number.isFinite(numero)) {
        throw new Error(`Valor inválido: ${valor}`);
    }

    return numero;
}

function pegarCampo(linha, nomes) {
    for (const nome of nomes) {
        if (linha[nome] !== undefined && linha[nome] !== "") {
            return linha[nome];
        }
    }

    return "";
}

const usuarios = await sql`
  SELECT id, usuario
  FROM usuarios
  WHERE usuario = ${usuario}
`;

if (usuarios.length === 0) {
    console.log(`Usuário "${usuario}" não encontrado no banco.`);
    console.log("Crie essa conta pelo site primeiro.");
    process.exit(1);
}

const usuarioId = usuarios[0].id;

const arquivo = fs.readFileSync(caminhoCsv, "utf8").replace(/^\uFEFF/, "");

const linhas = parse(arquivo, {
    columns: true,
    skip_empty_lines: true,
    trim: true
});

let importados = 0;
let duplicados = 0;
let pulados = 0;

for (const linha of linhas) {
    try {
const dataOriginal = pegarCampo(linha, [
  "Data",
  "data",
  "DataLancamento",
  "Data Lançamento",
  "Data de Lançamento"
]);

const tipo = pegarCampo(linha, [
  "Tipo",
  "tipo"
]);

const descricao = pegarCampo(linha, [
  "Descrição",
  "Descricao",
  "descricao",
  "Descrição ",
  "Descricao "
]);

const categoria = pegarCampo(linha, [
  "Categoria",
  "categoria"
]);

const valorOriginal = pegarCampo(linha, [
  "Valor",
  "valor"
]);

const pagamento = pegarCampo(linha, [
  "Tipo de Pagamento",
  "Tipo de pagamento",
  "TipoPagamento",
  "Forma de Pagamento",
  "FormaPagamento",
  "Pagamento",
  "pagamento"
]);
        const data = converterDataBR(dataOriginal);
        const valor = converterValorBR(valorOriginal);

if (!data || !tipo || !categoria || valor === null || !pagamento) {
  console.log("Linha pulada:");
  console.log(linha);

  console.log("Motivo:");
  if (!data) console.log("- Data faltando ou inválida");
  if (!tipo) console.log("- Tipo faltando");
  if (!categoria) console.log("- Categoria faltando");
  if (valor === null) console.log("- Valor faltando ou inválido");
  if (!pagamento) console.log("- Forma de pagamento faltando");

  pulados++;
  continue;
}

        const importHash = crypto
            .createHash("sha256")
            .update(`${usuarioId}|${data}|${tipo}|${descricao}|${categoria}|${valor}|${pagamento}`)
            .digest("hex");

        const resultado = await sql`
      INSERT INTO lancamentos
        (usuario_id, data, tipo, descricao, categoria, valor, pagamento, origem, import_hash)
      VALUES
        (${usuarioId}, ${data}, ${tipo}, ${descricao}, ${categoria}, ${valor}, ${pagamento}, 'planilha', ${importHash})
      ON CONFLICT (usuario_id, import_hash) DO NOTHING
      RETURNING id
    `;

        if (resultado.length > 0) {
            importados++;
        } else {
            duplicados++;
        }
    } catch (erro) {
        console.log("Erro ao importar linha:", linha);
        console.log(erro.message);
        pulados++;
    }
}

console.log("Importação finalizada!");
console.log(`Usuário: ${usuario}`);
console.log(`ID do usuário: ${usuarioId}`);
console.log(`Importados: ${importados}`);
console.log(`Duplicados ignorados: ${duplicados}`);
console.log(`Pulados: ${pulados}`);