import sugestoes from '../lib/sugestoes.js';
import bcrypt from 'bcryptjs';
import {sql,protegerPost,emailValido,senhaValida,limitarIP,limitar,exigirEmailConfigurado,enviarLink,responderErro,falha,sessao,conferirSenha,hashToken} from '../lib/conta.js';

function validarCartoes(valor) {
 if (!Array.isArray(valor) || valor.length > 50) return false;
 const ids = new Set(), formas = new Set();
 return valor.every(c => {
  if (!c || typeof c.id !== 'string' || !/^[a-zA-Z0-9-]{1,60}$/.test(c.id) || ids.has(c.id)) return false;
  if (![c.nome,c.pagamento].every(v=>typeof v==='string' && v.trim().length>0 && v.length<=80) || formas.has(c.pagamento)) return false;
  if (c.fechamento != null && (!Number.isInteger(c.fechamento) || c.fechamento<1 || c.fechamento>31)) return false;
  if (!Number.isInteger(c.vencimento) || c.vencimento<1 || c.vencimento>31) return false;
  if (!c.quitacoes || typeof c.quitacoes !== 'object' || Array.isArray(c.quitacoes) || Object.keys(c.quitacoes).length>1200) return false;
  if (!Object.entries(c.quitacoes).every(([mes,q])=>/^(0[1-9]|1[0-2])\/\d{4}$/.test(mes) && q && typeof q.assinatura==='string' && q.assinatura.length<=100000 && typeof q.data==='string' && /^\d{2}\/\d{2}\/\d{4}$/.test(q.data))) return false;
  ids.add(c.id);formas.add(c.pagamento);return true;
 });
}

export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 try {
  protegerPost(req);
  const {acao}=req.body || {};
  if (typeof acao==='string' && acao.startsWith('sugestoes-')) return await sugestoes(req,res);
  if (['app-carregar', 'app-salvar', 'app-importar'].includes(acao)) {
   const u = await sessao(req);
   if (acao !== 'app-carregar') {
    const { secao, valor } = req.body;
    const valido = secao === 'metas'
      ? valor && valor.mensal && ['receita','investido','despesas'].every(k => typeof valor.mensal[k] === 'number' && Number.isFinite(valor.mensal[k]) && valor.mensal[k] >= 0 && valor.mensal[k] <= 1e12)
      : secao === 'perfilIndicadores'
        ? Array.isArray(valor) && valor.length <= 40 && valor.every(k => typeof k === 'string' && /^[a-zA-Z]{1,40}$/.test(k))
        : secao === 'cartoes' ? validarCartoes(valor) : ['perfilOculto', 'valesAtivos'].includes(secao) && typeof valor === 'boolean';
    if (!valido) throw falha(400, 'Configuração inválida.');
    const patch = JSON.stringify({ [secao]: secao === 'metas' ? { mensal: { receita: valor.mensal.receita, investido: valor.mensal.investido, despesas: valor.mensal.despesas } } : valor });
    if (acao === 'app-importar') {
     await sql`UPDATE usuarios SET preferencias_app = COALESCE(preferencias_app, '{}'::jsonb) || ${patch}::jsonb
       WHERE id = ${u.id} AND NOT (COALESCE(preferencias_app, '{}'::jsonb) ? ${secao})`;
    } else {
     await sql`UPDATE usuarios SET preferencias_app = COALESCE(preferencias_app, '{}'::jsonb) || ${patch}::jsonb WHERE id = ${u.id}`;
    }
   }
   await sql`UPDATE usuarios SET preferencias_app = COALESCE(preferencias_app, '{}'::jsonb) || jsonb_build_object('valesAtivos',
     EXISTS (SELECT 1 FROM lancamentos WHERE usuario_id = ${u.id} AND lower(trim(tipo)) IN ('vale','vales'))
     OR EXISTS (SELECT 1 FROM agendamentos WHERE usuario_id = ${u.id} AND lower(trim(tipo)) IN ('vale','vales')))
     WHERE id = ${u.id} AND NOT (COALESCE(preferencias_app, '{}'::jsonb) ? 'valesAtivos')`;
   const [row] = await sql`SELECT preferencias_app - 'sugestoes' AS preferencias_app FROM usuarios WHERE id = ${u.id}`;
   return res.status(200).json({ preferencias: row.preferencias_app || {} });
  }
  if(acao === 'preferencias-carregar' || acao === 'preferencias-salvar') {
   const u=await sessao(req);
   if(acao === 'preferencias-salvar') {
    const v=req.body.preferencias;
    if(!v || !['dashboard','comparativo'].every(k=>Array.isArray(v[k]) && v[k].length<=40 && v[k].every(x=>typeof x==='string' && /^[a-z_]{1,40}$/.test(x)))) throw falha(400,'Seleção inválida.');
    await sql`UPDATE usuarios SET dashboard_preferencias=${JSON.stringify({dashboard:v.dashboard,comparativo:v.comparativo})}::jsonb WHERE id=${u.id}`;
   }
   const [row]=await sql`SELECT dashboard_preferencias FROM usuarios WHERE id=${u.id}`;
   return res.status(200).json({preferencias:row.dashboard_preferencias});
  }
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
   if(finalidade === 'senha') {
    const [anterior]=await sql`SELECT u.senha_hash FROM usuarios u JOIN conta_tokens t ON t.usuario_id=u.id WHERE t.token_hash=${hashToken(token)} AND t.finalidade='senha' AND t.usado_em IS NULL AND t.expira_em>now() AND t.versao_sessao=u.versao_sessao`;
    if(anterior && await bcrypt.compare(senha,anterior.senha_hash)) throw falha(400,'A nova senha deve ser diferente da atual.');
   }
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
  return res.status(200).json({mensagem:finalidade === 'senha' ? 'Senha redefinida. Entre com seu usuário ou e-mail e a nova senha.' : 'E-mail confirmado! Você já pode entrar com seu usuário ou e-mail e senha.'});
 } catch(erro) {
  if(erro.code === '23505') return responderErro(res,falha(409,'Este e-mail não pode ser vinculado. Solicite um link para outro endereço.'));
  return responderErro(res,erro);
 }
}
