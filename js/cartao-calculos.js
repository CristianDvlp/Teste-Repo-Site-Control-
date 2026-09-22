/* Regras compartilhadas pelo formulário e pelo servidor. Valores em centavos. */
export function dataISOValida(texto) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(texto))) return false;
  const [a,m,d]=texto.split('-').map(Number),data=new Date(Date.UTC(a,m-1,d));
  return a>=2026 && a<=2100 && data.getUTCFullYear()===a && data.getUTCMonth()===m-1 && data.getUTCDate()===d;
}
export function mesValido(mes) { return /^20\d{2}-(0[1-9]|1[0-2])$/.test(String(mes)) || mes==='2100-01'; }
export function adicionarMes(mes, quantidade) {
  const [a,m]=mes.split('-').map(Number),data=new Date(Date.UTC(a,m-1+quantidade,1));
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth()+1).padStart(2,'0')}`;
}
export function vencimentoNoMes(mes, dia) {
  const [a,m]=mes.split('-').map(Number),fim=new Date(Date.UTC(a,m,0)).getUTCDate();
  return `${mes}-${String(Math.min(dia,fim)).padStart(2,'0')}`;
}
export function sugerirFatura(dataCompra, cartao) {
  if (!dataISOValida(dataCompra)) return '';
  const mes=dataCompra.slice(0,7);
  if (!cartao.fechamento) return vencimentoNoMes(mes,cartao.vencimento)>=dataCompra ? mes : adicionarMes(mes,1);
  // Compras no próprio fechamento entram no ciclo seguinte.
  const fecha=vencimentoNoMes(mes,cartao.fechamento);
  const ciclo=dataCompra>=fecha ? adicionarMes(mes,1) : mes;
  return adicionarMes(ciclo,cartao.vencimento<=cartao.fechamento?1:0);
}
export function montarParcelas({totalCentavos,parcelas,primeiraFatura}, vencimento) {
  if (!Number.isSafeInteger(totalCentavos) || totalCentavos<1 || totalCentavos>100000000000 || !Number.isInteger(parcelas) || parcelas<1 || parcelas>120 || totalCentavos<parcelas || !mesValido(primeiraFatura) || !Number.isInteger(vencimento) || vencimento<1 || vencimento>31) throw Error('Confira o valor total, as parcelas e a primeira fatura.');
  const base=Math.floor(totalCentavos/parcelas),resto=totalCentavos%parcelas;
  return Array.from({length:parcelas},(_,i)=>({numero:i+1,total:parcelas,centavos:base+(i<resto?1:0),data:vencimentoNoMes(adicionarMes(primeiraFatura,i),vencimento)}));
}
export const CartaoCalculos=Object.freeze({dataISOValida,mesValido,adicionarMes,vencimentoNoMes,sugerirFatura,montarParcelas});
globalThis.CartaoCalculos=CartaoCalculos;
