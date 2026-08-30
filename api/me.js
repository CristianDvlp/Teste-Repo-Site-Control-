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

export default async function handler(req, res) {
  const token = pegarCookie(req, "session");

  if (!token) {
    return res.status(401).json({ logado: false });
  }

  try {
    const dados = jwt.verify(token, process.env.JWT_SECRET);

    const resultado = await sql`
      SELECT id, usuario, status, admin
      FROM usuarios
      WHERE id = ${dados.id}
    `;

    if (resultado.length === 0) {
      return res.status(401).json({ logado: false });
    }

    const usuarioBanco = resultado[0];

    if (usuarioBanco.status !== "aprovado") {
      return res.status(401).json({
        logado: false,
        status: usuarioBanco.status
      });
    }

    return res.status(200).json({
      logado: true,
      id: usuarioBanco.id,
      usuario: usuarioBanco.usuario,
      admin: usuarioBanco.admin
    });
  } catch {
    return res.status(401).json({ logado: false });
  }
}