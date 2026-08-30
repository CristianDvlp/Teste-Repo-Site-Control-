import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  try {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      return res.status(400).json({ erro: "Usuário e senha são obrigatórios" });
    }

    if (senha.length < 6) {
      return res.status(400).json({ erro: "A senha precisa ter pelo menos 6 caracteres" });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    await sql`
      INSERT INTO usuarios (usuario, senha_hash, status, admin, solicitado_em)
      VALUES (${usuario}, ${senhaHash}, 'pendente', false, NOW())
      RETURNING id, usuario
    `;

    return res.status(201).json({
      mensagem: "Solicitação enviada. Aguarde até sua conta ser aceita."
    });
  } catch (erro) {
    console.error(erro);

    if (String(erro.message).includes("duplicate key")) {
      return res.status(400).json({ erro: "Esse usuário já existe" });
    }

    return res.status(500).json({ erro: "Erro ao cadastrar usuário" });
  }
}