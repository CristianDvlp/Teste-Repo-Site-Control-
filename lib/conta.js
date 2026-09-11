import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createHash, createHmac, randomBytes } from 'node:crypto';
export const sql = neon(process.env.DATABASE_URL);
export const hashToken = token => createHash('sha256').update(token).digest('hex');
export function falha(status, mensagem) { return Object.assign(new Error(mensagem), { status }); }
export function emailValido(valor) {
 const email = typeof valor === 'string' ? valor.trim().toLowerCase() : '';
 if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw falha(400,'Informe um e-mail válido.');
 return email;
}
export function senhaValida(senha) {
 if (typeof senha !== 'string' || senha.length < 8 || Buffer.byteLength(senha,'utf8') > 72) throw falha(400,'Use pelo menos 8 caracteres e no máximo 72 bytes na senha.');
 return senha;
}
export function origemApp() {
 let u;
 try { u = new URL(process.env.APP_URL); } catch { throw falha(503,'O envio de e-mail ainda não foi configurado.'); }
 if (u.protocol !== 'https:' || u.username || u.password || u.pathname !== '/' || u.search || u.hash) throw falha(503,'Configure a URL HTTPS do site.');
 return u.origin;
}
export function exigirEmailConfigurado() {
 origemApp();
 if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw falha(503,'O envio de e-mail ainda não foi configurado.');
}
export function protegerPost(req) {
 if (req.method !== 'POST') throw falha(405,'Método não permitido.');
 if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw falha(415,'Envie dados em JSON.');
 if (req.headers.origin && req.headers.origin !== origemApp()) throw falha(403,'Origem não permitida.');
}
export function cookie(req) { return (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('session='))?.slice(8); }
export async function validarTokenSessao(token) {
 let dados;
 try { dados = jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']}); } catch { throw falha(401,'NAO_LOGADO'); }
 const [u] = await sql`SELECT id, usuario, nome, email, email_confirmado, admin, status, versao_sessao FROM usuarios WHERE id = ${dados.id}`;
 if (!u || u.status !== 'aprovado' || (u.email && !u.email_confirmado) || Number(dados.versao ?? 0) !== u.versao_sessao) throw falha(401,'NAO_LOGADO');
 return {...u,usuario:u.nome || u.usuario};
}
export async function sessao(req) { return validarTokenSessao(cookie(req)); }
export function emitirSessao(res,u) {
 const token = jwt.sign({id:u.id,usuario:u.nome || u.usuario,admin:u.admin,versao:u.versao_sessao},process.env.JWT_SECRET,{expiresIn:'30d',algorithm:'HS256'});
 res.setHeader('Set-Cookie',`session=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax; Secure`);
}
export async function limitar(chave,maximo,segundos=900) {
 const digest = createHmac('sha256',process.env.JWT_SECRET).update(chave).digest('hex');
 const [r] = await sql`INSERT INTO conta_limites(chave) VALUES (${digest}) ON CONFLICT(chave) DO UPDATE SET
 quantidade = CASE WHEN conta_limites.inicio < now() - ${segundos} * interval '1 second' THEN 1 ELSE conta_limites.quantidade + 1 END,
 inicio = CASE WHEN conta_limites.inicio < now() - ${segundos} * interval '1 second' THEN now() ELSE conta_limites.inicio END RETURNING quantidade`;
 if (r.quantidade > maximo) throw falha(429,'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
}
export async function limitarIP(req,acao,maximo=20) {
 const ip = String(req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'desconhecido').split(',')[0].trim();
 await limitar(`ip:${acao}:${ip}`,maximo);
}
export async function enviarLink(u,finalidade,email) {
 exigirEmailConfigurado();
 const token = randomBytes(32).toString('hex'), hash = hashToken(token);
 const minutos = finalidade === 'senha' ? 30 : 1440;
 await sql`INSERT INTO conta_tokens(usuario_id,finalidade,token_hash,email,versao_sessao,expira_em)
 VALUES (${u.id},${finalidade},${hash},${email},${u.versao_sessao},now() + ${minutos} * interval '1 minute')
 ON CONFLICT(usuario_id,finalidade) DO UPDATE SET token_hash=EXCLUDED.token_hash,email=EXCLUDED.email,
 versao_sessao=EXCLUDED.versao_sessao,expira_em=EXCLUDED.expira_em,usado_em=NULL`;
 const link = `${origemApp()}/acesso.html#${new URLSearchParams({token,finalidade})}`;
 const titulo = finalidade === 'senha' ? 'Redefinir sua senha' : 'Confirmar seu e-mail';
 try {
  const resposta = await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(12000),
   headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':hash},
   body:JSON.stringify({from:process.env.EMAIL_FROM,to:[email],subject:`${titulo} — Controle Financeiro`,
    text:`${titulo}\n\nAbra o link para continuar:\n${link}\n\nValidade: ${finalidade === 'senha' ? '30 minutos' : '24 horas'}. Uso único. Se não fez esta solicitação, ignore este e-mail. Nunca compartilhe este link.`})});
  if (!resposta.ok) throw new Error('ENVIO_RECUSADO');
 } catch {
  console.error('Falha ao enviar e-mail de conta; confira o provedor de envio.');
  throw falha(503,'Não foi possível enviar o e-mail. Tente reenviar em alguns minutos.');
 }
}
export async function conferirSenha(u,senha) {
 const [r] = await sql`SELECT senha_hash FROM usuarios WHERE id=${u.id}`;
 if (typeof senha !== 'string' || senha.length > 200 || !await bcrypt.compare(senha,r.senha_hash)) throw falha(401,'Senha atual incorreta.');
}
export function responderErro(res,erro) {
 res.setHeader('Cache-Control','no-store');
 if (!erro.status) console.error('Erro na operação de conta:',erro.code || 'INTERNAL');
 return res.status(erro.status || 500).json({erro:erro.status ? (erro.message === 'NAO_LOGADO' ? 'Entre novamente na sua conta.' : erro.message) : 'Não foi possível concluir. Tente novamente.'});
}
