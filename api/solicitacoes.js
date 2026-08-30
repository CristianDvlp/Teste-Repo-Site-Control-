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

async function obterAdmin(req) {
  const token = pegarCookie(req, "session");

  if (!token) {
    throw new Error("NAO_LOGADO");
  }

  const dados = jwt.verify(token, process.env.JWT_SECRET);

  const resultado = await sql`
    SELECT id, usuario, admin, status
    FROM usuarios
    WHERE id = ${dados.id}
  `;

  if (resultado.length === 0) {
    throw new Error("NAO_LOGADO");
  }

  const usuario = resultado[0];

  if (!usuario.admin || usuario.status !== "aprovado") {
    throw new Error("SEM_PERMISSAO");
  }

  return usuario;
}

export default async function handler(req, res) {
  try {
    const admin = await obterAdmin(req);

    if (req.method === "GET") {
      const pendentes = await sql`
        SELECT id, usuario, TO_CHAR(solicitado_em, 'DD/MM/YYYY HH24:MI') AS solicitado_em
        FROM usuarios
        WHERE status = 'pendente'
        ORDER BY solicitado_em ASC
      `;

      return res.status(200).json(pendentes);
    }

    if (req.method === "POST") {
      const { id, acao } = req.body;

      if (!id || !acao) {
        return res.status(400).json({ erro: "Informe o usuário e a ação" });
      }

      if (acao === "aprovar") {
        const aprovado = await sql`
          UPDATE usuarios
          SET status = 'aprovado',
              aprovado_em = NOW(),
              aprovado_por = ${admin.id}
          WHERE id = ${id}
            AND status = 'pendente'
          RETURNING id, usuario
        `;

        if (aprovado.length === 0) {
          return res.status(404).json({ erro: "Solicitação não encontrada" });
        }

        return res.status(200).json({
          mensagem: "Usuário aprovado com sucesso",
          usuario: aprovado[0].usuario
        });
      }

      if (acao === "recusar") {
        const recusado = await sql`
          UPDATE usuarios
          SET status = 'recusado'
          WHERE id = ${id}
            AND status = 'pendente'
          RETURNING id, usuario
        `;

        if (recusado.length === 0) {
          return res.status(404).json({ erro: "Solicitação não encontrada" });
        }

        return res.status(200).json({
          mensagem: "Usuário recusado",
          usuario: recusado[0].usuario
        });
      }

      return res.status(400).json({ erro: "Ação inválida" });
    }

    return res.status(405).json({ erro: "Método não permitido" });
  } catch (erro) {
    console.error(erro);

    if (erro.message === "NAO_LOGADO") {
      return res.status(401).json({ erro: "Você precisa estar logado" });
    }

    if (erro.message === "SEM_PERMISSAO") {
      return res.status(403).json({ erro: "Você não tem permissão" });
    }

    return res.status(500).json({ erro: "Erro ao processar solicitações" });
  }
}