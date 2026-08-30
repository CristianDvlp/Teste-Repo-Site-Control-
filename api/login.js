import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const sql = neon(process.env.DATABASE_URL);

function criarCookie(token) {
  return `session=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  try {
    const { usuario, senha } = req.body;

    const usuarioFinal = String(usuario || "").trim();
    const senhaFinal = String(senha || "");

    if (usuarioFinal.length > 60 || senhaFinal.length > 200) {
      return res.status(400).json({
        erro: "Usuário ou senha inválidos"
      });
    }
    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Usuário e senha são obrigatórios" });
    }

    const resultado = await sql`
      SELECT id, usuario, senha_hash, status, admin
      FROM usuarios
      WHERE usuario = ${usuarioFinal}
    `;

    if (resultado.length === 0) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos" });
    }

    const usuarioBanco = resultado[0];

    const senhaCorreta = await bcrypt.compare(senhaFinal, usuarioBanco.senha_hash);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: "Usuário ou senha inválidos" });
    }

    if (usuarioBanco.status !== "aprovado") {
      const mensagens = {
        pendente: "Aguarde até sua solicitação ser aceita.",
        recusado: "Sua solicitação foi recusada."
      };

      return res.status(403).json({
        erro: mensagens[usuarioBanco.status] || "Esta conta não está autorizada.",
        status: usuarioBanco.status
      });
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

    return res.status(200).json({
      mensagem: "Login feito com sucesso",
      usuario: usuarioBanco.usuario,
      admin: usuarioBanco.admin
    });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: "Erro ao fazer login" });
  }
}