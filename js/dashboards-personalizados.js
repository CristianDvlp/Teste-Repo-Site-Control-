/* Catálogo único para o mês e o ano. Só um Chart fica ativo em cada aba. */
(() => {
 const catalogo=[
 ['resumo','Receitas × despesas','Entradas, despesas e vales por período. Vales não compõem o resultado.'],
 ['saldo','Resultado por período','Receitas menos despesas, sem saldo inicial nem vales.'],
 ['acumulado','Resultado acumulado','Soma do resultado desde o início do período selecionado; não representa patrimônio.'],
 ['receitas','Evolução das receitas','Receitas registradas ao longo do período, sem saldo inicial.'],
 ['despesas','Evolução das despesas','Despesas registradas ao longo do período.'],
 ['vales','Evolução dos vales','Vales registrados, separados das receitas e despesas.'],
 ['investimentos','Investimentos registrados','Lançamentos classificados como investimento; não estima rendimento.'],
 ['categoria_despesa','Despesas por categoria','Categorias ordenadas do maior para o menor gasto.'],
 ['categoria_receita','Receitas por categoria','Origem das receitas, sem contar saldo inicial.'],
 ['categoria_vale','Vales por categoria','Distribuição dos vales registrados.'],
 ['pagamento_despesa','Despesas por pagamento','Gastos por forma de pagamento informada no lançamento.'],
 ['pagamento_receita','Receitas por pagamento','Recebimentos por forma de pagamento.'],
 ['quantidade','Quantidade de lançamentos','Número de lançamentos considerados em cada período.'],
 ['media_despesa','Média por despesa','Total de despesas dividido pela quantidade de despesas em cada período.'],
 ['comprometimento','Percentual da receita gasto','Despesas ÷ receitas × 100. Sem receita, o percentual não é calculado.'],
 ['top_despesas','Maiores despesas','Dez maiores lançamentos de despesa do período.'],
 ['top_receitas','Maiores receitas','Dez maiores receitas do período.'],
 ['dias_semana','Despesas por dia da semana','Distribuição de despesas pela data do lançamento.'],
 ['categoria_quantidade','Frequência das categorias','Número de despesas por categoria.'],
 ['acumulado_despesa','Despesas acumuladas','Soma progressiva das despesas no período.'],
 ['acumulado_receita','Receitas acumuladas','Soma progressiva das receitas no período.']
 ].map(([id,titulo,descricao])=>({id,titulo,descricao}));
 const disponivel=c=>valesAtivos() || !['vales','categoria_vale'].includes(c.id);
 const descricao=c=>!valesAtivos() && c.id==='resumo'?'Entradas e despesas por período.':!valesAtivos() && c.id==='saldo'?'Receitas menos despesas, sem saldo inicial.':c.descricao;
 const padrao=['resumo','saldo','categoria_despesa','investimentos'];
 let prefs={dashboard:[...padrao],comparativo:[...padrao]},carregado=false,carregando=false,ano=new Date().getFullYear();
 const estados={};const cores=['#16a34a','#dc2626','#f59e0b','#2563eb','#7c3aed','#0891b2'];
 const tipo=i=>obterTipoLancamento(i),valor=i=>obterValorAbsoluto(i);
 const soma=a=>a.reduce((s,i)=>s+valor(i),0);
 const rec=a=>a.filter(i=>tipo(i)==='Receita'&&!ehSaldoInicial(i));
 const desp=a=>a.filter(i=>tipo(i)==='Despesa');
 const chave=i=>obterChaveMes(i.data);
 const pertence=(i,e)=>e.id==='comparativo'?chave(i).endsWith('/'+ano):chave(i)===e.mes;
 const button=(txt,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=txt;b.onclick=fn;return b;};
 async function api(acao,preferencias){const r=await fetch('/api/conta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao,preferencias})});const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível salvar.');return d;}
 async function carregar(){if(carregado||carregando)return;carregando=true;try{const d=await api('preferencias-carregar');if(d.preferencias)for(const id of Object.keys(prefs))if(Array.isArray(d.preferencias[id]))prefs[id]=d.preferencias[id].filter(x=>catalogo.some(c=>c.id===x));carregado=true;Object.values(estados).forEach(montar);}catch{Object.values(estados).forEach(e=>e.aviso.textContent='Não foi possível carregar sua seleção. Confira a migração de dashboards e reabra esta aba.');}finally{carregando=false;}}
 function construir(id){
  if(estados[id])return estados[id];
  const section=document.getElementById(id);section.querySelector('.grid')?.remove();
  const e={id,section,dados:[],mes:'',ativo:'resumo',chart:null};estados[id]=e;
  if(id==='comparativo'){
   const head=document.createElement('div');head.className='card painel-ano cabecalho-anual';
   const h=document.createElement('h2');h.textContent='Comparativo anual';
   const label=document.createElement('label');label.textContent='Ano ';e.select=document.createElement('select');e.select.setAttribute('aria-label','Ano do comparativo');label.append(e.select);
   e.select.onchange=()=>{ano=Number(e.select.value);montar(e);};head.append(h,label);section.prepend(head);
  }
  e.menu=document.createElement('div');e.menu.className='card escolhas-dashboard';
  const header=document.createElement('div');header.className='painel-ano';const h=document.createElement('h2');h.textContent='Meus dashboards';header.append(h,button('Personalizar dashboards',()=>personalizar(e)));
  const info=document.createElement('p');info.textContent='Escolha um dos seus dashboards para abrir. Apenas o selecionado é carregado.';
  e.aviso=document.createElement('p');e.aviso.className='senha-campo-erro';e.aviso.setAttribute('role','status');
  e.opcoes=document.createElement('div');e.opcoes.className='catalogo-opcoes';e.menu.append(header,info,e.opcoes,e.aviso);
  e.card=document.createElement('div');e.card.className='card';e.titulo=document.createElement('h3');e.desc=document.createElement('p');e.nota=document.createElement('p');e.box=document.createElement('div');e.box.className='grafico-personalizado';e.canvas=document.createElement('canvas');e.canvas.setAttribute('role','img');e.box.append(e.canvas);e.card.append(e.titulo,e.desc,e.nota,e.box);section.append(e.menu,e.card);return e;
 }
 function montar(e){
  if(e.select){const anos=new Set([new Date().getFullYear(),ano]);for(const i of [...e.dados,...(typeof lancamentos!=='undefined'?lancamentos:[])]){const y=Number(chave(i).split('/')[1]);if(y)anos.add(y);}e.select.replaceChildren(...[...anos].sort((a,b)=>b-a).map(y=>{const o=document.createElement('option');o.value=y;o.textContent=y;return o;}));e.select.value=ano;}
  const lista=e.dados.filter(i=>!categoriaIgnoradaNoDashboard(i)&&pertence(i,e)&&dataAteHoje(i.data));
  e.lista=lista;
  const totais=[soma(rec(lista)),soma(desp(lista)),soma(lista.filter(i=>tipo(i)==='Vales')),soma(rec(lista))-soma(desp(lista))];
  const ids=e.id==='comparativo'?['comparativoReceitasTotal','comparativoDespesasTotal','comparativoValesTotal','comparativoSaldoTotal']:['totalReceitas','totalDespesas','resumoVales','saldoFinal'];ids.forEach((id,n)=>document.getElementById(id).textContent=formatarMoeda(totais[n]));
  const visiveis=prefs[e.id].filter(id=>catalogo.some(c=>c.id===id&&disponivel(c)));
  if(!visiveis.includes(e.ativo))e.ativo=visiveis[0];
  e.opcoes.replaceChildren();for(const c of catalogo.filter(c=>disponivel(c)&&prefs[e.id].includes(c.id))){const b=button('',()=>{e.ativo=c.id;montar(e);});b.className='opcao-dashboard';b.setAttribute('aria-pressed',String(e.ativo===c.id));const t=document.createElement('strong'),d=document.createElement('span');t.textContent=c.titulo;d.textContent=descricao(c);b.append(t,d);e.opcoes.append(b);}
  if(!visiveis.length)e.opcoes.textContent='Nenhum dashboard selecionado. Use Personalizar dashboards para escolher.';
  desenhar(e);
 }
 function personalizar(e){
  const dialog=document.createElement('dialog');dialog.className='conta-dialog catalogo-dialog';
  const head=document.createElement('div');head.className='conta-cabecalho';const h=document.createElement('h2');h.textContent='Escolha seus dashboards';const close=button('×',()=>dialog.close());close.className='conta-fechar';close.setAttribute('aria-label','Fechar');head.append(h,close);dialog.append(head);
  const texto=document.createElement('p');texto.textContent='A seleção aparece na tela imediatamente. Salve para usar também em outros aparelhos.';dialog.append(texto);
  const antes=[...prefs[e.id]],checks=[];let salvo=false;
  const toolbar=document.createElement('div');toolbar.className='painel-ano';
  function marcar(ids){prefs[e.id]=[...ids,...antes.filter(id=>catalogo.some(c=>c.id===id&&!disponivel(c)))];checks.forEach(x=>x.checked=ids.includes(x.value));montar(e);}
  toolbar.append(button('Marcar todos',()=>marcar(catalogo.filter(disponivel).map(c=>c.id))),button('Limpar',()=>marcar([])),button('Restaurar padrão',()=>marcar(padrao)));dialog.append(toolbar);
  const lista=document.createElement('div');lista.className='catalogo-lista';
  catalogo.filter(disponivel).forEach(c=>{const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span'),t=document.createElement('strong'),d=document.createElement('small');input.type='checkbox';input.value=c.id;input.checked=prefs[e.id].includes(c.id);checks.push(input);input.onchange=()=>{prefs[e.id]=[...checks.filter(x=>x.checked).map(x=>x.value),...antes.filter(id=>catalogo.some(c=>c.id===id&&!disponivel(c)))];montar(e);};t.textContent=c.titulo;d.textContent=descricao(c);text.append(t,d);label.append(input,text);lista.append(label);});dialog.append(lista);
  const status=document.createElement('p');status.className='senha-campo-erro';status.setAttribute('role','status');const actions=document.createElement('div');actions.className='painel-ano';const save=button('Salvar seleção',async()=>{save.disabled=true;close.disabled=true;cancel.disabled=true;try{await api('preferencias-salvar',prefs);salvo=true;carregado=true;dialog.close();}catch(err){status.textContent=err.message;}finally{save.disabled=false;close.disabled=false;cancel.disabled=false;}}),cancel=button('Cancelar',()=>dialog.close());actions.append(cancel,save);dialog.append(status,actions);dialog.addEventListener('cancel',event=>{if(save.disabled)event.preventDefault();});dialog.addEventListener('close',()=>{if(!salvo){prefs[e.id]=antes;montar(e);}dialog.remove();});document.body.append(dialog);dialog.showModal();
 }
 function dadosGrafico(e){
  const a=e.lista.filter(lancamentoVisivel),id=e.ativo;const anual=e.id==='comparativo';
  const n=anual?12:new Date(Number(e.mes.split('/')[1]),Number(e.mes.split('/')[0]),0).getDate();
  const labels=Array.from({length:n||31},(_,i)=>anual?['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i]:String(i+1));
  const indice=i=>{const d=normalizarDataParaOrdenacao(i.data);return anual?d.getMonth():d.getDate()-1;};
  const grupos=labels.map((_,j)=>a.filter(i=>indice(i)===j));
  let datasets=[],unidade='moeda',type='bar';
  const ds=(label,data,color=cores[datasets.length%cores.length])=>datasets.push({label,data,backgroundColor:color,borderColor:color,tension:.2});
  const acum=arr=>{let s=0;return arr.map(x=>s+=x);};
  const receitas=grupos.map(x=>soma(rec(x))),despesas=grupos.map(x=>soma(desp(x)));
  const grupo=(items,field,count=false)=>{const m={};items.forEach(i=>{const k=String(i[field]||'Não informado');m[k]=(m[k]||0)+(count?1:valor(i));});const entries=Object.entries(m).sort((a,b)=>b[1]-a[1]);labels.splice(0,labels.length,...entries.map(x=>x[0]));ds('Total',entries.map(x=>x[1]));};
  if(id==='resumo'){ds('Receitas',receitas);ds('Despesas',despesas);if(valesAtivos())ds('Vales',grupos.map(x=>soma(x.filter(i=>tipo(i)==='Vales'))));}
  else if(id==='saldo'||id==='acumulado'){const v=receitas.map((x,i)=>x-despesas[i]);ds('Resultado',id==='acumulado'?acum(v):v,'#2563eb');type='line';}
  else if(['receitas','despesas','acumulado_receita','acumulado_despesa'].includes(id)){let v=id.includes('receita')?receitas:despesas;if(id.startsWith('acumulado'))v=acum(v);ds('Total',v);type='line';}
  else if(id==='vales')ds('Vales',grupos.map(x=>soma(x.filter(i=>tipo(i)==='Vales'))));
  else if(id==='investimentos')ds('Investimentos',grupos.map(x=>soma(x.filter(ehLancamentoInvestimento))));
  else if(id.startsWith('categoria_')||id.startsWith('pagamento_')){const items=id.endsWith('receita')?rec(a):id.endsWith('vale')?a.filter(i=>tipo(i)==='Vales'):desp(a);const count=id==='categoria_quantidade';grupo(items,id.startsWith('pagamento')?'pagamento':'categoria',count);if(count)unidade='quantidade';}
  else if(id==='quantidade'){unidade='quantidade';ds('Lançamentos',grupos.map(x=>x.length));}
  else if(id==='media_despesa')ds('Média',grupos.map(x=>desp(x).length?soma(desp(x))/desp(x).length:0));
  else if(id==='comprometimento'){unidade='percentual';ds('Receita gasta',receitas.map((r,i)=>r?despesas[i]/r*100:null));}
  else if(id.startsWith('top_')){const top=(id==='top_despesas'?desp(a):rec(a)).slice().sort((a,b)=>valor(b)-valor(a)).slice(0,10);labels.splice(0,labels.length,...top.map(i=>String(i.descricao||'Sem descrição')));ds('Valor',top.map(valor));}
  else if(id==='dias_semana'){labels.splice(0,labels.length,...['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']);ds('Despesas',labels.map((_,n)=>soma(desp(a).filter(i=>normalizarDataParaOrdenacao(i.data).getDay()===n))));}
  return {labels,datasets,type,unidade};
 }
 function desenhar(e){if(e.chart){e.chart.destroy();e.chart=null;}const c=catalogo.find(c=>c.id===e.ativo);e.card.hidden=!c;if(!c)return;
  e.titulo.textContent=c.titulo;e.desc.textContent=descricao(c);e.canvas.setAttribute('aria-label',c.titulo);e.nota.textContent='Período: '+(e.id==='comparativo'?ano:e.mes)+'. Totais e gráficos realizados consideram lançamentos até hoje. Resultado = receitas − despesas; '+(valesAtivos()?'saldo inicial e vales ficam fora.':'saldo inicial fica fora.');
  const d=dadosGrafico(e);if(!d.datasets.some(s=>s.data.some(x=>x!==null&&x!==0)))e.nota.textContent+=' Sem valores para esta análise.';
  if(typeof Chart==='undefined'){e.nota.textContent+=' Não foi possível carregar o gráfico. Verifique sua conexão.';return;}
  const fmt=x=>d.unidade==='moeda'?formatarMoeda(x):d.unidade==='percentual'?Number(x).toFixed(1)+'%':String(x);
  e.chart=new Chart(e.canvas,{type:d.type,data:{labels:d.labels,datasets:d.datasets},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{tooltip:{callbacks:{label:ctx=>ctx.dataset.label+': '+fmt(ctx.parsed.y)}}},scales:{y:{beginAtZero:true,ticks:{callback:fmt}}}}});
 }
 window.renderChartsMes=function(dados,mes){const e=construir('dashboard');e.dados=dados;e.mes=mes;montar(e);carregar();};
 window.renderChartsComparativo=function(dados){const e=construir('comparativo');e.dados=dados;montar(e);carregar();};
 window.addEventListener('recursos:alterados',()=>Object.values(estados).forEach(montar));
 // Exporta apenas cálculo puro para testes locais.
 window.catalogoDashboardCalcular=dadosGrafico;
})();
