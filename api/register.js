import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import {sql,protegerPost,emailValido,senhaValida,limitarIP,limitar,exigirEmailConfigurado,enviarLink,responderErro,falha} from '../lib/conta.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 try {
  protegerPost(req); exigirEmailConfigurado();
  const email=emailValido(req.body?.email), senha=senhaValida(req.body?.senha);
  const nome=typeof req.body?.nome === 'string' ? req.body.nome.trim() : '';
  if (nome.length<2 || nome.length>60) throw falha(400,'Informe seu nome, entre 2 e 60 caracteres.');
  await limitarIP(req,'cadastro',10); await limitar(`email:envio:${email}`,3);
  const hash=await bcrypt.hash(senha,12);
  const [novo]=await sql`INSERT INTO usuarios(usuario,nome,email,senha_hash,status,admin,solicitado_em)
   VALUES (${`u_${randomUUID()}`},${nome},${email},${hash},'pendente',false,now())
   ON CONFLICT DO NOTHING RETURNING id,versao_sessao`;
  if (!novo) throw falha(409,'Não foi possível criar a conta com esses dados. Se já tem conta, entre ou use a recuperação de senha; se aguarda confirmação, use Reenviar confirmação.');
  await enviarLink(novo,'cadastro',email);
  return res.status(200).json({mensagem:'Se este e-mail puder ser cadastrado, você receberá um link de confirmação. Se já iniciou o cadastro, use Reenviar confirmação.'});
 } catch(erro) { return responderErro(res,erro); }
}
