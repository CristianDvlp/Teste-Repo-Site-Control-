import bcrypt from 'bcryptjs';
import {sql,protegerPost,emailValido,senhaValida,limitarIP,limitar,exigirEmailConfigurado,enviarLink,responderErro,falha,sessao,conferirSenha,hashToken} from '../lib/conta.js';

export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 try {
  protegerPost(req);
  const {acao}=req.body || {};
  if(acao === 'recuperar' || acao === 'reenviar') {
   exigirEmailConfigurado();
   const email=emailValido(req.body.email);
   await limitarIP(req,'envio'); await limitar(`email:envio:${email}`,3);
   const [u]=await sql`SELECT id,email,email_confirmado,status,versao_sessao FROM usuarios WHERE lower(email)=${email}`;
   const elegivel = u && (acao === 'recuperar' ? u.status === 'aprovado' && u.email_confirmado : u.status === 'pendente' && !u.email_confirmado);
   if(elegivel) {
    // Mesmo retorno público para conta inexistente, bloqueada ou falha de entrega.
    try { await enviarLink(u,acao === 'recuperar' ? 'senha' : 'cadastro',email); } catch { /* erro de envio já registrado sem dados sensíveis */ }
   }
   return res.status(200).json({mensagem:'Se houver uma conta elegível para este e-mail, enviaremos um link. Confira também o spam. Se não chegar, tente novamente em alguns minutos.'});
  }
  if(acao === 'vincular') {
   exigirEmailConfigurado();
   const u=await sessao(req), email=emailValido(req.body.email);
   await limitarIP(req,'vincular'); await limitar(`vincular:${u.id}`,5);
   await conferirSenha(u,req.body.senha);
   if(u.email) throw falha(409,'Sua conta já tem um e-mail vinculado.');
   await limitar(`email:envio:${email}`,3);
   const [ocupado]=await sql`SELECT id FROM usuarios WHERE lower(email)=${email}`;
   if(ocupado) throw falha(409,'Não foi possível vincular este e-mail. Use outro endereço.');
   await enviarLink(u,'vincular',email);
   return res.status(200).json({mensagem:'Enviamos o link. Seu e-mail só será vinculado após a confirmação. Até lá, continue entrando com seu usuário.'});
  }
  if(acao !== 'confirmar') throw falha(400,'Ação inválida.');
  await limitarIP(req,'confirmar',30);
  const {token,finalidade}=req.body;
  if(typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !['cadastro','vincular','senha'].includes(finalidade)) throw falha(400,'Link inválido ou expirado. Solicite um novo link.');
  let senhaHash=null;
  if(finalidade !== 'vincular') {
   const senha=senhaValida(req.body.senha);
   if(senha !== req.body.confirmarSenha) throw falha(400,'As senhas não conferem.');
   senhaHash=await bcrypt.hash(senha,12);
  }
  // Uma única instrução garante uso único e atualização/notificação atômicos.
  const [atualizado]=await sql`WITH consumido AS (
   UPDATE conta_tokens t SET usado_em=now() FROM usuarios u
   WHERE t.token_hash=${hashToken(token)} AND t.finalidade=${finalidade} AND t.usado_em IS NULL AND t.expira_em>now()
    AND u.id=t.usuario_id AND u.versao_sessao=t.versao_sessao
    AND ((t.finalidade='cadastro' AND u.status='pendente' AND NOT u.email_confirmado AND u.email=t.email)
      OR (t.finalidade='senha' AND u.status='aprovado' AND u.email_confirmado AND u.email=t.email)
      OR (t.finalidade='vincular' AND u.status='aprovado' AND u.email IS NULL))
   RETURNING t.usuario_id,t.email,t.finalidade,t.versao_sessao
  ), atualizado AS (
   UPDATE usuarios u SET email=c.email,email_confirmado=true,
    status=CASE WHEN c.finalidade='cadastro' THEN 'aprovado' ELSE u.status END,
    aprovado_em=CASE WHEN c.finalidade='cadastro' THEN now() ELSE u.aprovado_em END,
    senha_hash=CASE WHEN c.finalidade IN ('cadastro','senha') THEN ${senhaHash} ELSE u.senha_hash END,
    versao_sessao=u.versao_sessao+1
   FROM consumido c WHERE u.id=c.usuario_id AND u.versao_sessao=c.versao_sessao RETURNING u.id,c.finalidade
  ), aviso AS (
   INSERT INTO conta_notificacoes(usuario_id) SELECT id FROM atualizado WHERE finalidade='cadastro'
   ON CONFLICT(usuario_id) DO NOTHING RETURNING id
  ) SELECT id FROM atualizado`;
  if(!atualizado) throw falha(400,'Link inválido, já utilizado ou expirado. Solicite um novo link.');
  res.setHeader('Set-Cookie','session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure');
  return res.status(200).json({mensagem:finalidade === 'senha' ? 'Senha redefinida. Entre com seu e-mail e a nova senha.' : 'E-mail confirmado! Você já pode entrar com seu e-mail e senha.'});
 } catch(erro) {
  if(erro.code === '23505') return responderErro(res,falha(409,'Este e-mail não pode ser vinculado. Solicite um link para outro endereço.'));
  return responderErro(res,erro);
 }
}
