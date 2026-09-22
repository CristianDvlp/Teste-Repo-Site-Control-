import { createHash } from 'node:crypto';
import {sql,sessao,protegerPost,falha,responderErro} from './conta.js';
import {dataISOValida,mesValido,montarParcelas} from '../js/cartao-calculos.js';

export function validarCompra(body) {
  if(!body || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.requisicaoId||'')) throw falha(400,'Identificador da compra inválido. Recarregue a página.');
  if(typeof body.cartaoId!=='string'||!/^[a-zA-Z0-9-]{1,60}$/.test(body.cartaoId)) throw falha(400,'Selecione um cartão.');
  if(!dataISOValida(body.dataCompra)||!mesValido(body.primeiraFatura)||body.primeiraFatura<body.dataCompra.slice(0,7)) throw falha(400,'Confira a data da compra e a primeira fatura.');
  if(!['descricao','categoria'].every(k=>typeof body[k]==='string'&&body[k].trim().length>0&&body[k].length<=200)) throw falha(400,'Informe descrição e categoria (até 200 caracteres).');
  const compra={requisicaoId:body.requisicaoId,cartaoId:body.cartaoId,dataCompra:body.dataCompra,primeiraFatura:body.primeiraFatura,descricao:body.descricao.trim(),categoria:body.categoria.trim(),totalCentavos:body.totalCentavos,parcelas:body.parcelas};
  try { montarParcelas(compra,1); } catch(e) {throw falha(400,e.message);}
  return compra;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  try {
    protegerPost(req);const usuario=await sessao(req),compra=validarCompra(req.body);
    const [u]=await sql`SELECT preferencias_app FROM usuarios WHERE id=${usuario.id}`;
    const resumo=createHash('sha256').update(JSON.stringify(compra)).digest('hex').slice(0,24);
    const anterior=u?.preferencias_app?.comprasCartao?.[compra.requisicaoId];
    if(anterior) {
      if(anterior.resumo!==resumo) throw falha(409,'Esta tentativa já foi salva com outros dados. Atualize a lista antes de tentar novamente.');
      return res.status(200).json({salvo:true,repetida:true,parcelas:compra.parcelas});
    }
    const cartao=u?.preferencias_app?.cartoes?.find(c=>c.id===compra.cartaoId);
    if(!cartao) throw falha(400,'Cartão não encontrado na sua conta. Cadastre ou selecione outro cartão.');
    let parcelas;
    try { parcelas=montarParcelas(compra,cartao.vencimento); } catch(e) {throw falha(400,e.message);}
    if(parcelas[0].data<compra.dataCompra) throw falha(400,'O vencimento da primeira fatura não pode ser anterior à compra.');
    const linhas=parcelas.map(p=>({data:p.data,valor:-p.centavos/100,hash:createHash('sha256').update(`cartao-v1:${usuario.id}:${compra.requisicaoId}:${p.numero}`).digest('hex')}));
    const reciboCompra={resumo,cartaoId:cartao.id,compraId:compra.requisicaoId,total:compra.parcelas,dataCompra:compra.dataCompra,hashes:linhas.map(p=>p.hash)};
    // A atualização da conta e TODAS as parcelas são uma única instrução atômica.
    // O recibo impede repetir a compra, inclusive após exclusão manual de uma parcela.
    const resultado=await sql`WITH recibo AS (
      UPDATE usuarios SET preferencias_app=jsonb_set(COALESCE(preferencias_app,'{}'::jsonb),'{comprasCartao}',
        COALESCE(preferencias_app->'comprasCartao','{}'::jsonb) || jsonb_build_object(${compra.requisicaoId}::text,${JSON.stringify(reciboCompra)}::jsonb))
      WHERE id=${usuario.id} AND NOT (COALESCE(preferencias_app->'comprasCartao','{}'::jsonb) ? ${compra.requisicaoId})
      RETURNING id
    ), novas AS (
      INSERT INTO lancamentos(usuario_id,data,tipo,descricao,categoria,valor,pagamento,origem,import_hash)
      SELECT recibo.id,p.data,'Despesa',${compra.descricao},${compra.categoria},p.valor,${cartao.pagamento},'cartao',p.hash
      FROM recibo CROSS JOIN jsonb_to_recordset(${JSON.stringify(linhas)}::jsonb) AS p(data date,valor numeric,hash text)
      RETURNING id
    ) SELECT COUNT(*)::int AS quantidade FROM novas`;
    if(!resultado[0]?.quantidade) {
      const [atual]=await sql`SELECT preferencias_app FROM usuarios WHERE id=${usuario.id}`;
      if(atual?.preferencias_app?.comprasCartao?.[compra.requisicaoId]?.resumo!==resumo) throw falha(409,'Não foi possível confirmar a compra. Atualize os dados.');
    }
    return res.status(201).json({salvo:true,parcelas:compra.parcelas});
  } catch(e) {return responderErro(res,e);}
}
