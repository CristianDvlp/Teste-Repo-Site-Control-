import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { validarTokenSessao, protegerPost, senhaValida, emitirSessao } from "../lib/conta.js";

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
    protegerPost(req);
    const token = pegarCookie(req, "session");

    if (!token) {
      return res.status(401).json({ erro: "Você precisa estar logado" });
    }

    const dadosToken = await validarTokenSessao(token);

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

    senhaValida(novaSenha);
    const novaSenhaHash = await bcrypt.hash(novaSenha, 12);

    const [atualizado] = await sql`
      UPDATE usuarios
      SET senha_hash = ${novaSenhaHash}, versao_sessao = versao_sessao + 1
      WHERE id = ${dadosToken.id} AND versao_sessao = ${dadosToken.versao_sessao}
      RETURNING *
    `;
    if (!atualizado) return res.status(409).json({ erro: "Sua sessão mudou. Entre novamente." });
    emitirSessao(res, atualizado);

    return res.status(200).json({
      mensagem: "Senha alterada com sucesso"
    });
  } catch (erro) {
    if (erro.status) return res.status(erro.status).json({ erro: erro.message === "NAO_LOGADO" ? "Entre novamente." : erro.message });
    console.error("Erro ao alterar senha");
    return res.status(500).json({ erro: "Erro ao alterar senha" });
  }
}
