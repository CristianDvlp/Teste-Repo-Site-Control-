/* Faturas são uma visão das despesas existentes. Quitar não gera outra despesa. */
let mesCartoes = obterMesReferenciaAtualGF();
function obterCartoes() { return Array.isArray(preferenciasBanco.cartoes) ? preferenciasBanco.cartoes : []; }
function pagamentosCartoes() { return [...new Set([...TIPOS_PAGAMENTO, ...obterCartoes().map(c => c.pagamento)])]; }
function atualizarPagamentosCartoes() {
  const campo = document.getElementById('pagamento');
  if (!campo) return;
  const atual = campo.value;
  for (const nome of pagamentosCartoes()) {
    if (![...campo.options].some(o => o.value === nome)) campo.add(new Option(nome, nome));
  }
  campo.value = atual;
}
function despesasCartao(cartao, dados, mes) {
  return dados.filter(i => obterTipoLancamento(i) === 'Despesa' && obterChaveMes(i.data) === mes &&
    (i.cartao ? i.cartao.cartaoId === cartao.id : normalizarPagamento(i.pagamento || i.FormaPagamento) === cartao.pagamento));
}
function assinaturaFatura(lista) {
  return JSON.stringify(lista.map(i => [String(i.id), obterValorAbsoluto(i)]).sort((a,b)=>a[0].localeCompare(b[0])));
}
function elementoCartao(tag, texto, classe) {
  const el = document.createElement(tag); if (texto) el.textContent = texto; if (classe) el.className = classe; return el;
}
function botaoCartao(texto, acao, classe='btn-secondary') {
  const b = elementoCartao('button', texto, classe); b.type = 'button';
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { await acao(); } catch (e) { document.getElementById('cartoesStatus').textContent = e.message; }
    finally { b.disabled = false; }
  }); return b;
}
async function quitarCartao(id, mes, assinatura) {
  const copia = JSON.parse(JSON.stringify(obterCartoes()));
  const c = copia.find(c => c.id === id); if (!c) throw Error('Cartão não encontrado. Atualize a página.');
  c.quitacoes ||= {};
  if (assinatura === null) delete c.quitacoes[mes];
  else c.quitacoes[mes] = { assinatura, data: new Date().toLocaleDateString('pt-BR') };
  await salvarPreferenciaBanco('cartoes', copia); renderCartoes();
}
function renderCartoes() {
  const painel = document.getElementById('cartoesPainel'); painel.replaceChildren();
  const header = elementoCartao('div', '', 'card cartoes-header');
  header.append(elementoCartao('h2', 'Cartões e faturas'), elementoCartao('p', 'Suas compras, parcelas e vencimentos em um só lugar. As novas compras entram nas faturas automaticamente.'));
  const nav = elementoCartao('div', '', 'lancamentos-controls');
  nav.append(botaoCartao('← Mês anterior', () => { mesCartoes = mudarMesReferenciaGF(mesCartoes, -1); renderCartoes(); }), elementoCartao('strong', mesCartoes), botaoCartao('Mês seguinte →', () => { mesCartoes = mudarMesReferenciaGF(mesCartoes, 1); renderCartoes(); }));
  header.append(nav, botaoCartao('Cadastrar cartão', abrirCadastroCartao, 'btn-primary'));
  const status = elementoCartao('p'); status.id = 'cartoesStatus'; status.setAttribute('role', 'status'); header.append(status); painel.append(header);
  if (!preferenciasProntas) { status.textContent = 'Recarregue a página para carregar suas preferências.'; return; }
  if (!obterCartoes().length) { header.append(elementoCartao('p', 'Cadastre um cartão e escolha a forma de pagamento usada nos seus lançamentos. As contas antigas continuam disponíveis abaixo.')); return; }
  const resumo=elementoCartao('div','','cartoes-resumo');
  let totalMes=0,aberto=0,parcelasMes=0;
  for(const c of obterCartoes()) {const itens=despesasCartao(c,lancamentos,mesCartoes),total=itens.reduce((s,i)=>s+obterValorAbsoluto(i),0);totalMes+=total;if(c.quitacoes?.[mesCartoes]?.assinatura!==assinaturaFatura(itens))aberto+=total;parcelasMes+=itens.filter(i=>i.cartao?.total>1).length;}
  for(const [titulo,valor] of [['Faturas do mês',formatarMoeda(totalMes)],['Em aberto',formatarMoeda(aberto)],['Parcelas neste mês',String(parcelasMes)]]) {const item=elementoCartao('div','','cartoes-metrica');item.append(elementoCartao('span',titulo),elementoCartao('strong',valor));resumo.append(item);}painel.append(resumo);
  const grid = elementoCartao('div', '', 'cartoes-grid'); painel.append(grid);
  for (const c of obterCartoes()) {
    const lista = despesasCartao(c, lancamentos, mesCartoes);
    const total = lista.reduce((s,i)=>s+obterValorAbsoluto(i),0), assinatura = assinaturaFatura(lista);
    const quitacao = c.quitacoes?.[mesCartoes], pago = quitacao?.assinatura === assinatura;
    const card = elementoCartao('article', '', 'card cartao-fatura');
    const [mes, ano] = mesCartoes.split('/').map(Number);
    const dia = Math.min(c.vencimento, new Date(ano, mes, 0).getDate());
    const topo=elementoCartao('div','','cartao-topo');topo.append(elementoCartao('span','CRÉDITO','cartao-eyebrow'),elementoCartao('span',pago?'Quitada':lista.length?'Em aberto':'Sem compras','cartao-situacao'));card.append(topo);
    card.append(elementoCartao('h3', c.nome), elementoCartao('div',formatarMoeda(total),'value'));
    const datas=elementoCartao('div','','cartao-datas');datas.append(elementoCartao('span',`Fecha: ${c.fechamento?'dia '+c.fechamento:'não informado'}`),elementoCartao('span',`Vence: ${String(dia).padStart(2,'0')}/${mesCartoes}`));card.append(datas);
    card.append(elementoCartao('p', pago ? 'Quitada em '+quitacao.data : quitacao ? 'Fatura alterada após a quitação. Confira os lançamentos e confirme novamente.' : lista.length ? 'Em aberto' : 'Sem despesas neste mês'));
    const details = elementoCartao('details');details.className='cartao-detalhes';details.append(elementoCartao('summary', `${lista.length} lançamento(s) nesta fatura`));
    const ul = elementoCartao('ul');
    for (const i of [...lista].sort((a,b)=>normalizarDataParaOrdenacao(a.data)-normalizarDataParaOrdenacao(b.data))) {
      const item=elementoCartao('li');item.append(elementoCartao('strong',i.descricao||i.categoria),elementoCartao('span',formatarMoeda(obterValorAbsoluto(i))));
      item.append(elementoCartao('small',i.cartao ? `${i.cartao.total>1?'Parcela '+i.cartao.numero+'/'+i.cartao.total:'À vista'} · compra em ${i.cartao.dataCompra.split('-').reverse().join('/')} · vence em ${formatarDataParaTela(i.data)}` : 'Lançamento anterior · '+formatarDataParaTela(i.data)));
      item.append(botaoCartao('Editar lançamento',()=>{ativarTab('lancamentos');iniciarEdicaoLancamento(i.id);},'fluxo-link'));ul.append(item);
    }details.append(ul);card.append(details);
    const chaveMes=mesCartoes.slice(3)+'-'+mesCartoes.slice(0,2);
    const futuras=lancamentos.filter(i=>i.cartao?.cartaoId===c.id&&obterChaveMes(i.data).split('/').reverse().join('-')>chaveMes);
    card.append(elementoCartao('p',`${futuras.length} cobrança(s) nos próximos meses · ${formatarMoeda(futuras.reduce((s,i)=>s+obterValorAbsoluto(i),0))}`,'cartao-futuro'));
    if (lista.some(i=>i.origem==='gasto_fixo')) card.append(elementoCartao('p','Inclui pagamentos de contas anteriores. Não lance novamente essas mesmas despesas.'));
    const actions = elementoCartao('div','','actions');
    actions.append(botaoCartao(pago?'Desfazer quitação':'Marcar fatura como paga',async()=>{
      if (confirm(pago?'Desfazer a quitação? Seus lançamentos serão mantidos.':'Confirmar o pagamento da fatura? Nenhum lançamento será criado.')) await quitarCartao(c.id,mesCartoes,pago?null:assinatura);
    },'btn-success'));
    actions.firstChild.disabled = !lista.length;
    actions.append(botaoCartao('Nova compra',()=>novaCompraNoCartao(c.id),'btn-primary'));
    actions.append(botaoCartao('Editar cartão',()=>abrirCadastroCartao(c)));
    card.append(actions);grid.append(card);
  }
}
function abrirCadastroCartao(cartao=null, aoSalvar=null) {
  const dialog=elementoCartao('dialog','','conta-dialog cartao-dialog');
  dialog.append(elementoCartao('h2',cartao?'Editar cartão':'Cadastrar cartão'));
  const formEl=elementoCartao('form','','form-grid');
  function campo(titulo, tipo, valor) { const label=elementoCartao('label',titulo);const input=elementoCartao('input');input.type=tipo;input.required=true;input.value=valor||'';label.append(input);formEl.append(label);return input; }
  const nome=campo('Nome do cartão','text',cartao?.nome);nome.maxLength=80;
  const pagamento=campo('Nome nos lançamentos','text',cartao?.pagamento);pagamento.maxLength=80;pagamento.setAttribute('list','cartoesFormas');
  const sugestoes=elementoCartao('datalist');sugestoes.id='cartoesFormas';
  const nomes=new Set([...pagamentosCartoes(),...lancamentos.map(i=>i.pagamento).filter(Boolean)]);for(const n of nomes)sugestoes.append(new Option(n,n));formEl.append(sugestoes);
  // A associação permanece estável para que edições de nome não mudem faturas anteriores.
  pagamento.disabled=!!cartao;
  const fechamento=campo('Dia do fechamento','number',cartao?.fechamento);fechamento.min=1;fechamento.max=31;
  nome.addEventListener('input',()=>{if(!cartao&&!pagamento.dataset.editado)pagamento.value=nome.value;});
  pagamento.addEventListener('input',()=>pagamento.dataset.editado='true');
  const dia=campo('Dia do vencimento','number',cartao?.vencimento);dia.min=1;dia.max=31;
  dialog.append(elementoCartao('p','Informe fechamento e vencimento para sugerirmos a primeira fatura. Se já usa este cartão, mantenha em “Nome nos lançamentos” a forma de pagamento antiga para exibir seu histórico. Alterações de datas valem para novas compras; parcelas já salvas mantêm suas datas.'), formEl);
  const erro=elementoCartao('p');erro.setAttribute('role','status');dialog.append(erro);
  const actions=elementoCartao('div','','actions'),cancel=botaoCartao('Cancelar',()=>dialog.close()),save=elementoCartao('button','Salvar cartão','btn-primary');save.type='submit';formEl.append(actions);actions.append(cancel,save);
  formEl.addEventListener('submit',async event=>{
    event.preventDefault();const forma=normalizarPagamento(pagamento.value);
    if (!nome.value.trim() || !forma || !Number.isInteger(Number(dia.value)) || Number(dia.value)<1 || Number(dia.value)>31 || !Number.isInteger(Number(fechamento.value)) || Number(fechamento.value)<1 || Number(fechamento.value)>31) { erro.textContent='Preencha os dados do cartão.';return; }
    if(obterCartoes().some(c=>c.id!==cartao?.id&&c.pagamento===forma)){erro.textContent='Essa forma de pagamento já está associada a um cartão.';return;}
    save.disabled=true;cancel.disabled=true;
    try { const copia=JSON.parse(JSON.stringify(obterCartoes()));const novo={id:cartao?.id||crypto.randomUUID(),nome:nome.value.trim(),pagamento:forma,vencimento:Number(dia.value),fechamento:Number(fechamento.value),quitacoes:cartao?.quitacoes||{}};const index=copia.findIndex(c=>c.id===novo.id);if(index<0)copia.push(novo);else copia[index]=novo;
      await salvarPreferenciaBanco('cartoes',copia);atualizarPagamentosCartoes();atualizarListaCartoesGuiada();atualizarFluxoGuiado();renderCartoes();dialog.close();if(aoSalvar)aoSalvar(novo.id);
    } catch(e) {erro.textContent=e.message;} finally {save.disabled=false;cancel.disabled=false;}
  });
  dialog.addEventListener('cancel',event=>{if(save.disabled)event.preventDefault();});dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
}

function novaCompraNoCartao(id) {
  if (salvandoLancamentoGuiado) return;
  if (form.descricao.value.trim() && !confirm('Iniciar uma nova compra? O formulário atual será limpo.')) return;
  if (lancamentoEmEdicaoId!==null) cancelarEdicao();else resetarFormulario();
  form.tipo.value='Despesa';campoFluxo('compraCartao').value='sim';campoFluxo('cartaoCompra').value=id;
  ativarTab('lancamentos');atualizarFluxoGuiado();campoFluxo('modalidadeCompra').focus();
}
