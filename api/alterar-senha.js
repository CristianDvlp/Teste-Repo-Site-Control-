import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
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
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  try {
    const token = pegarCookie(req, "session");

    if (!token) {
      return res.status(401).json({ erro: "Você precisa estar logado" });
    }

    const dadosToken = jwt.verify(token, process.env.JWT_SECRET);

    const { senhaAtual, novaSenha, confirmarSenha } = req.body;

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      return res.status(400).json({ erro: "Preencha todos os campos" });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ erro: "A nova senha precisa ter pelo menos 6 caracteres" });
    }

    if (novaSenha !== confirmarSenha) {
      return res.status(400).json({ erro: "A confirmação da senha não confere" });
    }

    const resultado = await sql`
      SELECT id, senha_hash
      FROM usuarios
      WHERE id = ${dadosToken.id}
    `;

    if (resultado.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    const usuario = resultado[0];

    const senhaAtualCorreta = await bcrypt.compare(senhaAtual, usuario.senha_hash);

    if (!senhaAtualCorreta) {
      return res.status(401).json({ erro: "Senha atual incorreta" });
    }

    const novaSenhaHash = await bcrypt.hash(novaSenha, 10);

    await sql`
      UPDATE usuarios
      SET senha_hash = ${novaSenhaHash}
      WHERE id = ${dadosToken.id}
    `;

    return res.status(200).json({
      mensagem: "Senha alterada com sucesso"
    });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: "Erro ao alterar senha" });
  }
}