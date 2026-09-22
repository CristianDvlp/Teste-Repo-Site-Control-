(() => {
 const $=id=>document.getElementById(id),dialog=$('sugestoesDialog'),form=$('sugestoesForm');
 const nomes={nova:'Nova',em_analise:'Em análise',planejada:'Planejada',concluida:'Concluída',nao_prevista:'Não prevista'};
 const tipos={melhoria:'Melhoria',recurso:'Novo recurso',problema:'Problema'};
 const impactos={baixo:'Baixo',medio:'Médio',alto:'Alto'};
 let aba='enviar',pagina=0,versao=0,enviando=false,tentativa=null,origemFoco=$('abrirSugestoes');
 const el=(tag,texto,classe)=>{const e=document.createElement(tag);if(texto)e.textContent=texto;if(classe)e.className=classe;return e;};
 const mensagem=(texto,erro=false)=>{$('sugestoesStatus').textContent=texto;$('sugestoesStatus').classList.toggle('sugestoes-erro',erro);};
 async function api(acao,dados={}) {
  const r=await fetch('/api/conta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao,...dados})});
  const d=await r.json();if(!r.ok)throw Error(d.erro||'Não foi possível concluir. Tente novamente.');return d;
 }
 function bloquearEnvio(valor) {
  enviando=valor;for(const e of form.elements)e.disabled=valor;
  for(const id of ['fecharSugestoes','sugestoesAbaEnviar','sugestoesAbaMinhas','sugestoesAbaAdmin'])$(id).disabled=valor;
  $('enviarSugestao').textContent=valor?'Enviando…':'Enviar sugestão';
 }
 function trocarAba(nova) {
  if(enviando)return;if(nova==='admin'&&!window.contaAtual?.admin)return;
  aba=nova;pagina=0;versao++;mensagem('');
  $('sugestoesEnvio').hidden=aba!=='enviar';$('sugestoesAcompanhamento').hidden=aba==='enviar';
  for(const [id,valor] of [['sugestoesAbaEnviar','enviar'],['sugestoesAbaMinhas','minhas'],['sugestoesAbaAdmin','admin']])$(id).setAttribute('aria-pressed',String(aba===valor));
  if(aba!=='enviar')carregar();
 }
 function abrir(event) {
  origemFoco=event.currentTarget;
  if(!window.contaAtual){alert('Aguarde o carregamento da sua conta.');return;}
  $('sugestoesAbaAdmin').hidden=!window.contaAtual.admin;
  if(!dialog.open)dialog.showModal();trocarAba('enviar');
 }
 $('abrirSugestoes').addEventListener('click',abrir);
 $('abrirSugestoesTopo').addEventListener('click',abrir);
 $('fecharSugestoes').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('cancel',e=>{if(enviando)e.preventDefault();});
 dialog.addEventListener('close',()=>{versao++;origemFoco.focus();});
 for(const [id,nova] of [['sugestoesAbaEnviar','enviar'],['sugestoesAbaMinhas','minhas'],['sugestoesAbaAdmin','admin']])$(id).addEventListener('click',()=>trocarAba(nova));
 form.elements.tipo.addEventListener('change',()=>{
  const problema=form.elements.tipo.value==='problema';
  $('sugestoesDescricaoLabel').textContent=problema?'O que aconteceu e como repetir o problema? *':'O que você sugere? *';
  form.elements.descricao.placeholder=problema?'Informe os passos, a mensagem de erro e se aconteceu no celular ou computador.':'Descreva a ideia e dê um exemplo de uso.';
 });
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(enviando||!form.reportValidity())return;
  const dados=Object.fromEntries(new FormData(form));for(const k of Object.keys(dados))dados[k]=dados[k].trim();
  const assinatura=JSON.stringify(dados);
  if(!tentativa||tentativa.assinatura!==assinatura)tentativa={assinatura,id:crypto.randomUUID()};
  bloquearEnvio(true);mensagem('Enviando sua sugestão…');
  try {await api('sugestoes-enviar',{...dados,id:tentativa.id});form.reset();tentativa=null;
   $('sugestoesDescricaoLabel').textContent='O que você sugere? *';form.elements.descricao.placeholder='Descreva a ideia e dê um exemplo de uso.';
   mensagem('Sugestão enviada! Acompanhe a situação e a resposta em Minhas sugestões.');
  }catch(e){mensagem(e.message,true);}finally{bloquearEnvio(false);}
 });
 function data(texto) {const d=new Date(texto);return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});}
 function renderItem(item) {
  const s=item.sugestao,card=el('article','', 'sugestao-card'),topo=el('div','','sugestao-topo');
  topo.append(el('h3',s.titulo),el('span',nomes[s.status]||s.status,'sugestao-badge'));card.append(topo);
  card.append(el('p',`${tipos[s.tipo]||s.tipo} · ${s.area} · Impacto ${impactos[s.impacto]||s.impacto}`,'sugestao-meta'));
  card.append(el('p',`${aba==='admin'?item.autor+' · ':''}Enviada em ${data(s.criadaEm)}`,'sugestao-meta'));
  const detalhes=el('details');detalhes.append(el('summary','Ver detalhes'),el('h4','Descrição'),el('p',s.descricao,'sugestao-texto'),el('h4','Resultado esperado'),el('p',s.beneficio,'sugestao-texto'));
  if(s.resposta) {const resposta=el('div','','sugestao-resposta');resposta.append(el('strong','Resposta da administração'),el('p',s.resposta,'sugestao-texto'));detalhes.append(resposta);}
  if(s.atualizadaEm)detalhes.append(el('small','Atualizada em '+data(s.atualizadaEm)));
  if(aba==='admin') {
   const editor=el('form','','sugestao-editor'),label=el('label','Situação'),select=el('select');
   for(const [v,n]of Object.entries(nomes))select.add(new Option(n,v));select.value=s.status;label.append(select);
   const respostaLabel=el('label','Resposta ao usuário (opcional)'),resposta=el('textarea');resposta.maxLength=1000;resposta.rows=3;resposta.value=s.resposta||'';respostaLabel.append(resposta);
   const botao=el('button','Salvar acompanhamento','btn-primary');botao.type='submit';const status=el('p');status.setAttribute('role','status');
   editor.append(label,respostaLabel,botao,status);detalhes.append(editor);
   editor.addEventListener('submit',async event=>{event.preventDefault();if(botao.disabled)return;botao.disabled=true;select.disabled=true;resposta.disabled=true;status.textContent='Salvando…';
    try {await api('sugestoes-atualizar',{id:s.id,usuarioId:item.usuario_id,status:select.value,resposta:resposta.value.trim()});status.textContent='Acompanhamento salvo.';if(aba==='admin'&&dialog.open)await carregar();}
    catch(e){status.textContent=e.message;}finally{botao.disabled=false;select.disabled=false;resposta.disabled=false;}
   });
  }
  card.append(detalhes);return card;
 }
 async function carregar() {
  const atual=++versao,todos=aba==='admin';$('sugestoesLista').replaceChildren(el('p','Carregando sugestões…'));
  $('sugestoesAnterior').disabled=true;$('sugestoesProxima').disabled=true;$('sugestoesPagina').textContent='';mensagem('');
  try {
   const d=await api('sugestoes-listar',{todos,status:$('sugestoesFiltro').value,pagina});if(atual!==versao||!dialog.open)return;
   $('sugestoesLista').replaceChildren(...d.itens.map(renderItem));
   if(!d.itens.length)$('sugestoesLista').append(el('p','Nenhuma sugestão encontrada para este filtro.','sugestoes-vazio'));
   $('sugestoesPagina').textContent='Página '+(pagina+1);$('sugestoesAnterior').disabled=pagina===0;$('sugestoesProxima').disabled=!d.temMais;
  } catch(e){if(atual===versao&&dialog.open){$('sugestoesLista').replaceChildren();mensagem(e.message,true);$('sugestoesAnterior').disabled=pagina===0;}}
 }
 $('sugestoesFiltro').addEventListener('change',()=>{pagina=0;carregar();});
 $('recarregarSugestoes').addEventListener('click',carregar);
 $('sugestoesAnterior').addEventListener('click',()=>{if(pagina>0){pagina--;carregar();}});
 $('sugestoesProxima').addEventListener('click',()=>{pagina++;carregar();});
})();
