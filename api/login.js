import bcrypt from 'bcryptjs';
import {sql,protegerPost,limitarIP,limitar,emitirSessao,responderErro,falha} from '../lib/conta.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 try {
  protegerPost(req);
  const usuario=typeof req.body?.usuario === 'string' ? req.body.usuario.trim() : '', senha=req.body?.senha;
  if (!usuario || usuario.length>254 || typeof senha !== 'string' || !senha || senha.length>200) throw falha(400,'Informe usuário ou e-mail e senha.');
  await limitarIP(req,'login',50); await limitar(`login:${usuario.toLowerCase()}`,20);
  const candidatos=await sql`SELECT * FROM usuarios WHERE lower(email)=${usuario.toLowerCase()} OR usuario=${usuario} LIMIT 2`;
  // Não selecionar uma conta arbitrária se um usuário antigo coincidir com outro e-mail.
  if (candidatos.length > 1) throw falha(409,'Identificação ambígua. Use o outro identificador da sua conta ou contate o administrador.');
  const [u]=candidatos;
  const hash=u?.senha_hash || '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxRwY9LkFgHNMC8ViZ9rJwvE4Ge';
  const correta=await bcrypt.compare(senha,hash);
  if (!u || !correta) throw falha(401,'E-mail/usuário ou senha inválidos.');
  if (u.status === 'recusado') throw falha(403,'Esta conta não está autorizada.');
  if (u.email && !u.email_confirmado) throw falha(403,'Confirme seu e-mail. Se precisar, use Reenviar confirmação.');
  if (u.status !== 'aprovado') throw falha(403,'Conta antiga pendente: entre em contato com o administrador para regularizar o acesso.');
  emitirSessao(res,u); return res.status(200).json({mensagem:'Login feito com sucesso.'});
 } catch(erro) { return responderErro(res,erro); }
}
