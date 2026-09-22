/* Fluxo progressivo. Desabilitar uma etapa não apaga o que já foi digitado. */
let salvandoLancamentoGuiado=false, tentativaCompraGuiada=null, edicaoCartaoGuiada=null, chaveSugestaoFatura='';
const campoFluxo=id=>document.getElementById(id);
function compraNoCartaoGuiada() { return lancamentoEmEdicaoId===null && form.tipo.value==='Despesa' && campoFluxo('compraCartao').value==='sim'; }
function dataCompraISO() { const d=parseDataBR(form.data.value);return d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`:''; }
function atualizarListaCartoesGuiada() {
  const select=campoFluxo('cartaoCompra'),atual=select.value;
  select.replaceChildren(new Option(obterCartoes().length?'Selecione um cartão':'Cadastre seu primeiro cartão',''));
  obterCartoes().forEach(c=>select.add(new Option(c.nome,c.id)));select.value=atual;
}
function inicializarLancamentoGuiado() {
  atualizarListaCartoesGuiada();
  if(!form.financeForm.dataset.guiado) {
    form.financeForm.dataset.guiado='true';
    ['input','change'].forEach(evento=>form.financeForm.addEventListener(evento,atualizarFluxoGuiado));
    campoFluxo('cadastrarCartaoNoFluxo').addEventListener('click',()=>abrirCadastroCartao(null,id=>{
      atualizarListaCartoesGuiada();campoFluxo('cartaoCompra').value=id;atualizarFluxoGuiado();
    }));
  }
  atualizarFluxoGuiado();
}
function resetarFluxoGuiado() {
  edicaoCartaoGuiada=null;tentativaCompraGuiada=null;chaveSugestaoFatura='';
  ['compraCartao','modalidadeCompra','cartaoCompra','quantidadeParcelas','primeiraFatura'].forEach(id=>campoFluxo(id).value='');
  atualizarFluxoGuiado();
}
function prepararEdicaoGuiada(item) { edicaoCartaoGuiada=item.cartao || (item.origem==='cartao'?{}:null);atualizarFluxoGuiado(); }
function dadosCompraGuiada() {
  return {cartaoId:campoFluxo('cartaoCompra').value,dataCompra:dataCompraISO(),primeiraFatura:campoFluxo('primeiraFatura').value,descricao:form.descricao.value.trim(),categoria:formatarCategoriaVisual(form.categoria.value),totalCentavos:Math.round(converterValor(form.valor.value)*100),parcelas:campoFluxo('modalidadeCompra').value==='parcelada'?Number(campoFluxo('quantidadeParcelas').value):1};
}
function etapasFluxo() {
  const editando=lancamentoEmEdicaoId!==null,cartao=compraNoCartaoGuiada();
  const etapas=[['tipo',()=>!!form.tipo.value],['data',()=>dataValida(form.data.value)]];
  if(form.tipo.value==='Despesa'&&!editando) etapas.push(['compraCartao',()=>['sim','nao'].includes(campoFluxo('compraCartao').value)]);
  if(cartao) etapas.push(['modalidadeCompra',()=>['avista','parcelada'].includes(campoFluxo('modalidadeCompra').value)],['cartaoCompra',()=>obterCartoes().some(c=>c.id===campoFluxo('cartaoCompra').value)]);
  etapas.push(['descricao',()=>editando||!!form.descricao.value.trim()],['categoria',()=>!!form.categoria.value.trim()&&categoriaValida(form.categoria.value)],['valor',()=>converterValor(form.valor.value)>0]);
  if(cartao) {
    if(campoFluxo('modalidadeCompra').value==='parcelada') etapas.push(['quantidadeParcelas',()=>{const n=Number(campoFluxo('quantidadeParcelas').value);return Number.isInteger(n)&&n>=2&&n<=120&&n<=Math.round(converterValor(form.valor.value)*100);}]);
    etapas.push(['primeiraFatura',()=>{const c=obterCartoes().find(c=>c.id===campoFluxo('cartaoCompra').value),mes=campoFluxo('primeiraFatura').value;return !!c&&CartaoCalculos.mesValido(mes)&&CartaoCalculos.vencimentoNoMes(mes,c.vencimento)>=dataCompraISO();}]);
  } else etapas.push(['pagamento',()=>!!form.pagamento.value]);
  return etapas;
}
function validarFluxoGuiado() {
  const invalidas=etapasFluxo().filter(([,valido])=>!valido());
  return invalidas.length?['Preencha corretamente: '+campoFluxo(invalidas[0][0]).closest('label').querySelector('span').textContent+'.']:[];
}
function atualizarFluxoGuiado() {
  if(typeof lancamentoEmEdicaoId==='undefined') return;
  const editando=lancamentoEmEdicaoId!==null,cartao=compraNoCartaoGuiada(),parcelada=cartao&&campoFluxo('modalidadeCompra').value==='parcelada';
  const visibilidade={compraCartao:form.tipo.value==='Despesa'&&!editando,modalidadeCompra:cartao,cartaoCompra:cartao,quantidadeParcelas:parcelada,primeiraFatura:cartao,pagamento:!cartao};
  for(const [id,visivel] of Object.entries(visibilidade)) {campoFluxo(id).closest('label').hidden=!visivel;campoFluxo(id).disabled=!visivel;}
  campoFluxo('ajudaValorCompra').hidden=!cartao;
  campoFluxo('valorLabelText').textContent=parcelada?'Valor total parcelado':cartao?'Valor total da compra':'Valor';
  campoFluxo('dataLabelText').textContent=cartao?'Data da compra':edicaoCartaoGuiada?'Vencimento desta parcela':'Data';
  campoFluxo('primeiraFaturaLabel').textContent=parcelada?'Primeira fatura':'Fatura da compra';
  const c=obterCartoes().find(c=>c.id===campoFluxo('cartaoCompra').value);
  if(cartao&&c&&dataCompraISO()&&globalThis.CartaoCalculos) {
    const chave=c.id+':'+dataCompraISO()+':'+c.fechamento+':'+c.vencimento;
    if(chave!==chaveSugestaoFatura) {campoFluxo('primeiraFatura').value=CartaoCalculos.sugerirFatura(dataCompraISO(),c);chaveSugestaoFatura=chave;}
    campoFluxo('primeiraFatura').min=dataCompraISO().slice(0,7);
    atualizarPagamentosCartoes();form.pagamento.value=c.pagamento;
  }
  const semCartao=!editando&&form.tipo.value==='Despesa'&&campoFluxo('compraCartao').value==='nao';
  for(const option of form.pagamento.options) {
    const ehCartao=['Credito','Cartão A','Cartão P'].includes(option.value)||obterCartoes().some(c=>c.pagamento===option.value);
    option.disabled=semCartao&&ehCartao;option.hidden=option.disabled;
  }
  if(semCartao&&form.pagamento.selectedOptions[0]?.disabled)form.pagamento.value='';
  let liberado=true,proximo='',concluidas=0;
  const etapas=etapasFluxo();
  for(const [id,valido] of etapas) {
    const el=campoFluxo(id),ok=!!valido();el.disabled=!liberado||salvandoLancamentoGuiado;
    if(editando&&edicaoCartaoGuiada&&['tipo','pagamento'].includes(id))el.disabled=true;
    el.closest('label').classList.toggle('etapa-bloqueada',el.disabled);
    if(liberado&&ok)concluidas++;else if(!proximo)proximo=el.closest('label').querySelector('span').textContent;
    liberado=liberado&&ok;
  }
  campoFluxo('cadastrarCartaoNoFluxo').disabled=campoFluxo('cartaoCompra').disabled;
  const orientacao=campoFluxo('fluxoOrientacao');
  orientacao.textContent=salvandoLancamentoGuiado?'Salvando, aguarde…':editando&&edicaoCartaoGuiada?'Você está editando somente esta parcela. As outras parcelas serão mantidas.':proximo?`${concluidas}/${etapas.length} etapas • Próximo: ${proximo.replace(/^\d+\. /,'')}`:cartao?'Confira a prévia abaixo e salve a compra.':'Tudo pronto para salvar.';
  campoFluxo('btnSalvar').disabled=!liberado||salvandoLancamentoGuiado;
  campoFluxo('btnSalvar').textContent=salvandoLancamentoGuiado?'Salvando…':editando?'Atualizar lançamento':cartao?'Salvar compra':'Salvar lançamento';
  campoFluxo('btnAgendarLancamento').hidden=cartao||!!edicaoCartaoGuiada;
  campoFluxo('btnAgendarLancamento').disabled=!liberado||salvandoLancamentoGuiado;
  campoFluxo('btnResetarFormulario').disabled=salvandoLancamentoGuiado;
  campoFluxo('btnAtualizar').disabled=salvandoLancamentoGuiado;
  if(cartao) { const painel=campoFluxo('painelAgendamento');if(painel)painel.style.display='none'; }
  renderPreviaCompra(cartao&&liberado?c:null);
}
function renderPreviaCompra(cartao) {
  const preview=campoFluxo('previaCompra');preview.replaceChildren();preview.hidden=!cartao;
  if(!cartao)return;
  let linhas;const dados=dadosCompraGuiada();
  try {linhas=CartaoCalculos.montarParcelas(dados,cartao.vencimento);}catch(e){preview.append(elementoCartao('p',e.message));campoFluxo('btnSalvar').disabled=true;return;}
  preview.append(elementoCartao('div','Confira antes de salvar','previa-eyebrow'),elementoCartao('h3',cartao.nome+' · '+(linhas.length>1?linhas.length+' parcelas':'à vista')));
  const soma=elementoCartao('p',`${formatarMoeda(dados.totalCentavos/100)} no total · ${linhas.length>1?'primeira parcela de ':'uma cobrança de '}${formatarMoeda(linhas[0].centavos/100)}`,'previa-total');preview.append(soma);
  preview.append(elementoCartao('p','Cada cobrança aparecerá em Lançamentos na data de vencimento e na fatura correspondente. Pagar a fatura não cria outra despesa.'));
  const lista=elementoCartao('div','','previa-parcelas');
  for(const p of linhas) {
    const row=elementoCartao('div','','previa-parcela');row.append(elementoCartao('span',`${p.numero}/${p.total}`),elementoCartao('span',p.data.split('-').reverse().join('/')),elementoCartao('strong',formatarMoeda(p.centavos/100)));lista.append(row);
  }
  preview.append(lista);
  if(dados.totalCentavos%linhas.length)preview.append(elementoCartao('small','Os centavos foram distribuídos entre as primeiras parcelas para fechar o total exato.'));
  if(!cartao.fechamento)preview.append(elementoCartao('small','Este cartão ainda não tem fechamento configurado. Confira a primeira fatura ou edite o cartão.'));
}
async function salvarCompraGuiada() {
  const dados=dadosCompraGuiada(),assinatura=JSON.stringify(dados);
  if(!tentativaCompraGuiada||tentativaCompraGuiada.assinatura!==assinatura) tentativaCompraGuiada={assinatura,id:crypto.randomUUID()};
  const id=tentativaCompraGuiada.id;
  salvandoLancamentoGuiado=true;atualizarFluxoGuiado();
  try {
    const r=await fetch('/api/lancamentos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...dados,requisicaoId:id,acao:'compra-cartao'})});
    const resposta=await r.json();if(!r.ok)throw Error(resposta.erro||'Não foi possível salvar. Tente novamente.');
    limparFormularioSegura();preencherDataAtualNoFormulario();
    mesLancamentosSelecionado=dados.primeiraFatura.slice(5)+'/'+dados.primeiraFatura.slice(0,4);mesCartoes=mesLancamentosSelecionado;
    await carregarDados();
    setStatus(`Compra salva: ${dados.parcelas===1?'uma cobrança':dados.parcelas+' parcelas'} nas faturas do cartão.`);
  } catch(e) {setStatus(e.message+' Se houve falha de conexão, tente salvar novamente sem mudar os campos; a mesma compra não será duplicada.',true);}
  finally {salvandoLancamentoGuiado=false;atualizarFluxoGuiado();}
}
