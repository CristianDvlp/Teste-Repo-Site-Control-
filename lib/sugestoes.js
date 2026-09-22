import {createHash} from 'node:crypto';
import {sql,sessao,falha} from './conta.js';
const AREAS=['Lançamentos','Gastos fixos','Dashboards','Metas','Perfil e acesso','Outro'];
const TIPOS=['melhoria','problema','recurso'];
const IMPACTOS=['baixo','medio','alto'];
const STATUS=['nova','em_analise','planejada','concluida','nao_prevista'];
function texto(v,min,max,nome) { if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)throw falha(400,`${nome}: informe de ${min} a ${max} caracteres.`);return v.trim(); }
function validarId(id) {if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))throw falha(400,'Identificador inválido.');return id;}
export function validarSugestao(b) {
 const id=validarId(b.id),titulo=texto(b.titulo,5,100,'Título'),descricao=texto(b.descricao,15,2000,'Descrição'),beneficio=texto(b.beneficio,5,1000,'Resultado esperado');
 if(!AREAS.includes(b.area)||!TIPOS.includes(b.tipo)||!IMPACTOS.includes(b.impacto))throw falha(400,'Selecione a área, o tipo e o impacto.');
 return {id,titulo,descricao,beneficio,area:b.area,tipo:b.tipo,impacto:b.impacto};
}
export default async function sugestoes(req,res) {
 const u=await sessao(req),b=req.body||{};
 if(b.acao==='sugestoes-enviar') {
  const dados=validarSugestao(b),assinatura=createHash('sha256').update(JSON.stringify(dados)).digest('hex');
  const nova={...dados,status:'nova',resposta:'',criadaEm:new Date().toISOString(),assinatura};
  const [salva]=await sql`UPDATE usuarios SET preferencias_app=jsonb_set(COALESCE(preferencias_app,'{}'::jsonb),'{sugestoes}',
    COALESCE(preferencias_app->'sugestoes','{}'::jsonb)||jsonb_build_object(${dados.id}::text,${JSON.stringify(nova)}::jsonb))
    WHERE id=${u.id} AND NOT (COALESCE(preferencias_app->'sugestoes','{}'::jsonb)?${dados.id})
    AND (SELECT count(*) FROM jsonb_object_keys(COALESCE(preferencias_app->'sugestoes','{}'::jsonb)))<100
    RETURNING id`;
  if(!salva) {
   const [atual]=await sql`SELECT preferencias_app->'sugestoes'->${dados.id} AS sugestao FROM usuarios WHERE id=${u.id}`;
   if(atual?.sugestao?.assinatura===assinatura)return res.status(200).json({mensagem:'Sugestão já recebida.',id:dados.id});
   if(atual?.sugestao)throw falha(409,'Esta tentativa já foi enviada com outro conteúdo. Feche e reabra o formulário.');
   throw falha(400,'Você atingiu o limite de 100 sugestões cadastradas nesta conta.');
  }
  return res.status(201).json({mensagem:'Sugestão enviada! Acompanhe em Minhas sugestões.',id:dados.id});
 }
 if(b.acao==='sugestoes-listar') {
  const admin=b.todos===true;if(admin&&!u.admin)throw falha(403,'Acesso exclusivo do administrador.');
  const status=b.status||'',pagina=b.pagina??0;
  if((status&&!STATUS.includes(status))||!Number.isInteger(pagina)||pagina<0||pagina>10000)throw falha(400,'Filtro inválido.');
  const itens=await sql`SELECT u.id AS usuario_id,COALESCE(NULLIF(u.nome,''),u.usuario) AS autor,s.value-'assinatura' AS sugestao
    FROM usuarios u CROSS JOIN LATERAL jsonb_each(COALESCE(u.preferencias_app->'sugestoes','{}'::jsonb)) s
    WHERE (${admin}::boolean OR u.id=${u.id}) AND (${status}='' OR s.value->>'status'=${status})
    ORDER BY s.value->>'criadaEm' DESC,u.id,s.key LIMIT 51 OFFSET ${pagina*50}`;
  return res.status(200).json({itens:itens.slice(0,50),temMais:itens.length>50});
 }
 if(b.acao==='sugestoes-atualizar') {
  if(!u.admin)throw falha(403,'Acesso exclusivo do administrador.');
  const id=validarId(b.id),usuarioId=Number(b.usuarioId);
  if(!Number.isSafeInteger(usuarioId)||usuarioId<=0||!STATUS.includes(b.status))throw falha(400,'Sugestão ou situação inválida.');
  const resposta=texto(b.resposta??'',0,1000,'Resposta');
  const patch=JSON.stringify({status:b.status,resposta,atualizadaEm:new Date().toISOString()});
  const [salva]=await sql`UPDATE usuarios SET preferencias_app=jsonb_set(preferencias_app,ARRAY['sugestoes',${id}]::text[],
    (preferencias_app->'sugestoes'->${id})||${patch}::jsonb)
    WHERE id=${usuarioId} AND (preferencias_app->'sugestoes'?${id}) RETURNING id`;
  if(!salva)throw falha(404,'Sugestão não encontrada.');
  return res.status(200).json({mensagem:'Situação e resposta atualizadas.'});
 }
 throw falha(400,'Ação de sugestões inválida.');
}
