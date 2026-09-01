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

function criarCookie(token) {
  return `session=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
}

async function fazerLoginAutomatico(res) {
  // Só funciona quando ativado explicitamente no Vercel
  if (process.env.TEST_AUTO_LOGIN !== "true") {
    return false;
  }

  const usuarioAuto = process.env.TEST_AUTO_LOGIN_USER || "Cristian";

  const resultado = await sql`
    SELECT id, usuario, status, admin
    FROM usuarios
    WHERE LOWER(usuario) = LOWER(${usuarioAuto})
    LIMIT 1
  `;

  if (resultado.length === 0) {
    return false;
  }

  const usuarioBanco = resultado[0];

  if (usuarioBanco.status !== "aprovado") {
    return false;
  }

  const token = jwt.sign(
    {
      id: usuarioBanco.id,
      usuario: usuarioBanco.usuario,
      admin: usuarioBanco.admin
    },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  res.setHeader("Set-Cookie", criarCookie(token));

  res.status(200).json({
    logado: true,
    id: usuarioBanco.id,
    usuario: usuarioBanco.usuario,
    admin: usuarioBanco.admin,
    autoLogin: true
  });

  return true;
}

export default async function handler(req, res) {
  const token = pegarCookie(req, "session");

  // Se já existe uma sessão normal, usa ela.
  if (token) {
    try {
      const dados = jwt.verify(token, process.env.JWT_SECRET);

      const resultado = await sql`
        SELECT id, usuario, status, admin
        FROM usuarios
        WHERE id = ${dados.id}
      `;

      if (resultado.length > 0) {
        const usuarioBanco = resultado[0];

        if (usuarioBanco.status === "aprovado") {
          return res.status(200).json({
            logado: true,
            id: usuarioBanco.id,
            usuario: usuarioBanco.usuario,
            admin: usuarioBanco.admin
          });
        }
      }
    } catch {
      // Se o token estiver vencido/inválido,
      // tenta o login automático abaixo.
    }
  }

  try {
    const entrouAutomaticamente = await fazerLoginAutomatico(res);

    if (entrouAutomaticamente) {
      return;
    }

    return res.status(401).json({ logado: false });
  } catch (erro) {
    console.error("Erro no login automático:", erro);
    return res.status(500).json({
      logado: false,
      erro: "Erro ao verificar usuário"
    });
  }
}