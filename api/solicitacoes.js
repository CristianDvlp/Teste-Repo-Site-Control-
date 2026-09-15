// Endpoint mantido para o sininho: agora apenas avisos, nunca aprovação de contas.
import {sql,sessao,protegerPost,responderErro,falha} from '../lib/conta.js';
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 try {
  const admin=await sessao(req);
  if(!admin.admin) throw falha(403,'Sem permissão.');
  if(req.method === 'GET') {
   const avisos=await sql`SELECT n.id,coalesce(u.nome,u.usuario) AS usuario,u.email,n.criado_em,
    (l.notificacao_id IS NOT NULL) AS lida FROM conta_notificacoes n JOIN usuarios u ON u.id=n.usuario_id
    LEFT JOIN conta_notificacoes_lidas l ON l.notificacao_id=n.id AND l.admin_id=${admin.id}
    ORDER BY (l.notificacao_id IS NOT NULL),n.criado_em DESC LIMIT 100`;
   const [contagem]=await sql`SELECT count(*)::int AS total FROM conta_notificacoes n
    WHERE NOT EXISTS(SELECT 1 FROM conta_notificacoes_lidas l WHERE l.notificacao_id=n.id AND l.admin_id=${admin.id})`;
   return res.status(200).json({avisos,naoLidas:contagem.total});
  }
  protegerPost(req);
  if(req.body?.acao !== 'ler' || !/^\d+$/.test(String(req.body?.id))) throw falha(400,'Ação inválida.');
  await sql`INSERT INTO conta_notificacoes_lidas(notificacao_id,admin_id)
   SELECT id,${admin.id} FROM conta_notificacoes WHERE id=${req.body.id} ON CONFLICT DO NOTHING`;
  return res.status(200).json({mensagem:'Notificação marcada como lida.'});
 } catch(erro) { return responderErro(res,erro); }
}
