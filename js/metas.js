/* Metas mensais por conta, com visão anual e edição confirmada no banco. */
const GOAL_FIELDS = ['receita', 'investido', 'despesas'];
let goalData = [], goalMonth = '', goalMode = 'mensal', goalEventsReady = false, goalSaving = false;
const goalMoney = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const goalInputMoney = value => Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const goalEl = id => document.getElementById(id);
const goalTodayMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
// Máscara de reais: os dois últimos dígitos representam os centavos.
function maskGoalInput(input) {
  const raw = input.value;
  const position = input.selectionStart ?? raw.length;
  const digitsOnRight = raw.slice(position).replace(/\D/g, '').length;
  const digits = raw.replace(/\D/g, '').slice(0, 15);
  input.value = digits ? goalInputMoney(Number(digits) / 100) : '';
  let caret = input.value.length;
  let remaining = digitsOnRight;
  while (caret > 0 && remaining > 0) {
    caret--;
    if (/\d/.test(input.value[caret])) remaining--;
  }
  input.setSelectionRange(caret, caret);
}
function setupGoalMoneyInput(input) {
  input.addEventListener('input', () => {
    maskGoalInput(input);
    input.removeAttribute('aria-invalid');
    previewGoalDraft();
  });
  // Ao apagar junto de um separador, apaga o dígito vizinho em vez de travar.
  input.addEventListener('beforeinput', event => {
    const start = input.selectionStart, end = input.selectionEnd;
    if (start !== end || start === null) return;
    const backward = event.inputType === 'deleteContentBackward';
    const forward = event.inputType === 'deleteContentForward';
    if (!backward && !forward) return;
    let i = backward ? start - 1 : start;
    if (i < 0 || i >= input.value.length || /\d/.test(input.value[i])) return;
    while (i >= 0 && i < input.value.length && !/\d/.test(input.value[i])) i += backward ? -1 : 1;
    if (i < 0 || i >= input.value.length) return;
    event.preventDefault();
    input.value = input.value.slice(0, i) + input.value.slice(i + 1);
    input.setSelectionRange(backward ? i : start, backward ? i : start);
    maskGoalInput(input);
    previewGoalDraft();
  });
  input.addEventListener('blur', () => {
    if (!input.value) input.value = '0,00';
    previewGoalDraft();
  });
}
function parseGoalMoney(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 ? raw : NaN;
  const s = String(raw ?? '').trim().replace(/^R\$\s*/, '').replace(/\s/g, '');
  if (!s || s.startsWith('-')) return NaN;
  let normalized;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) normalized = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+(,\d{1,2})?$/.test(s)) normalized = s.replace(',', '.');
  else if (/^\d+\.\d{1,2}$/.test(s)) normalized = s;
  else return NaN;
  const value = Number(normalized);
  return Number.isFinite(value) && value <= 1e12 ? value : NaN;
}
function goalTargets() {
  const saved = preferenciasBanco.metas?.mensal || {};
  return Object.fromEntries(GOAL_FIELDS.map(k => [k, Number.isFinite(Number(saved[k])) ? Math.max(0, Number(saved[k])) : 0]));
}
function goalRecordDate(item) {
  const s = String(item.data || '');
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!br && !iso) return null;
  const [y,m,d] = br ? [Number(br[3]),Number(br[2]),Number(br[1])] : [Number(iso[1]),Number(iso[2]),Number(iso[3])];
  const date = new Date(y,m-1,d);
  return date.getFullYear()===y && date.getMonth()===m-1 && date.getDate()===d ? date : null;
}
function goalSummarize(data, month, annual = false, today = new Date()) {
  const total = { receita: 0, investido: 0, despesas: 0, quantidade: 0 };
  const [year, m] = month.split('-').map(Number);
  const limit = new Date(today.getFullYear(),today.getMonth(),today.getDate(),23,59,59,999);
  for (const item of data) {
    const date = goalRecordDate(item);
    if (!date || date > limit || date.getFullYear() !== year || (!annual && date.getMonth() !== m-1)) continue;
    const tipo = obterTipoLancamento(item);
    const value = Math.round(obterValorAbsoluto(item)*100);
    if (!Number.isFinite(value)) continue;
    const category = String(item.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
    if (tipo === 'Receita' && !(typeof ehSaldoInicial === 'function' && ehSaldoInicial(item))) { total.receita += value; total.quantidade++; }
    if (tipo === 'Despesa') { total[category === 'investimento' ? 'investido' : 'despesas'] += value; total.quantidade++; }
  }
  GOAL_FIELDS.forEach(k => total[k] /= 100);
  return total;
}
function goalProgress(actual, target, expense = false) {
  if (!(target > 0)) return { percent: 0, text: 'Defina sua meta', state: 'neutral', detail: 'Escolha um valor para acompanhar o progresso.' };
  const percent = actual / target * 100;
  if (expense) return { percent, state: actual > target ? 'danger' : 'good', text: actual > target ? 'Acima do limite' : actual === target ? 'Limite atingido' : 'Dentro do limite', detail: actual > target ? `${goalMoney(actual-target)} acima do planejado` : `${goalMoney(target-actual)} disponíveis no limite` };
  return { percent, state: actual >= target ? 'good' : 'neutral', text: actual >= target ? 'Meta alcançada' : 'Em progresso', detail: actual >= target ? `${goalMoney(actual-target)} além da meta` : `Faltam ${goalMoney(target-actual)}` };
}
function renderGoalBudget(targets) {
  const rest = targets.receita-targets.investido-targets.despesas;
  goalEl('goalBudget').innerHTML = `<dl><div><dt>Receita planejada</dt><dd>${goalMoney(targets.receita)}</dd></div><div><dt>Para investir</dt><dd>${goalMoney(targets.investido)}</dd></div><div><dt>Limite de despesas</dt><dd>${goalMoney(targets.despesas)}</dd></div><div class="goals-budget-rest ${rest < 0 ? 'is-negative' : ''}"><dt>${rest < 0 ? 'Falta no plano' : 'Margem planejada'}</dt><dd>${goalMoney(Math.abs(rest))}</dd></div></dl>`;
}
function renderGoalHistory(targets) {
  const metric = goalEl('goalMetric').value, year = Number(goalMonth.slice(0,4));
  const months = Array.from({length:12}, (_,i) => `${year}-${String(i+1).padStart(2,'0')}`);
  const values = months.map(m=>goalSummarize(goalData,m)[metric]);
  const target = targets[metric];
  const max = Math.max(...values,target,1)*1.12;
  const container = goalEl('goalHistory');
  container.innerHTML = '';
  const line = document.createElement('div');line.className='goals-target-line';line.style.bottom=`${target/max*100}%`;line.hidden=target===0;line.setAttribute('aria-hidden','true');container.append(line);
  months.forEach((m,i)=>{
    const button = document.createElement('button');button.type='button';button.className='goals-month-bar';button.classList.toggle('is-selected',m===goalMonth);
    const label=new Date(year,i,1).toLocaleDateString('pt-BR',{month:'short'}).replace('.','');
    button.setAttribute('aria-label',`${label} de ${year}: ${goalMoney(values[i])}. Meta: ${goalMoney(target)}. Abrir mês.`);
    button.title=`${label}: ${goalMoney(values[i])}`;
    const bar=document.createElement('span');bar.className='goals-bar';bar.style.height=`${Math.max(values[i]>0?1:0,values[i]/max*100)}%`;
    const name=document.createElement('span');name.className='goals-month-name';name.textContent=label;
    button.append(bar,name);button.onclick=()=>{goalMonth=m;goalMode='mensal';renderGoals();};container.append(button);
  });
  goalEl('goalHistoryTitle').textContent=`Seu progresso em ${year}`;
}
function renderGoals() {
  if (!goalMonth) goalMonth = goalTodayMonth();
  goalEl('goalMonth').value=goalMonth;
  goalEl('goalMonthly').setAttribute('aria-pressed',String(goalMode==='mensal'));
  goalEl('goalAnnual').setAttribute('aria-pressed',String(goalMode==='anual'));
  const targets=goalTargets(), multiple=goalMode==='anual'?12:1;
  const values=goalSummarize(goalData,goalMonth,goalMode==='anual');
  const current = goalMonth === goalTodayMonth();
  const label=goalMode==='anual'?goalMonth.slice(0,4):new Date(Number(goalMonth.slice(0,4)),Number(goalMonth.slice(5))-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
  goalEl('goalPeriodLabel').textContent=label.toUpperCase();
  const configured=GOAL_FIELDS.filter(k=>targets[k]>0).length;
  const inPath=GOAL_FIELDS.filter(k=>targets[k]>0 && (k==='despesas'?values[k]<=targets[k]*multiple:values[k]>=targets[k]*multiple)).length;
  goalEl('goalOverviewCount').textContent=`${values.quantidade ? inPath : 0}/${configured || 3}`;
  goalEl('goalOverviewTitle').textContent=!configured?'Dê uma direção ao seu dinheiro.':!values.quantidade?'Um período pronto para começar.':inPath===configured?'Seu plano está no caminho.':'Cada avanço conta.';
  goalEl('goalOverviewText').textContent=!configured?'Defina quanto quer receber, investir e gastar por mês.':!values.quantidade?'Ainda não há receitas ou despesas registradas até hoje neste período.':`${values.quantidade} registros neste período. Veja o que já alcançou e o que ainda falta.`;
  const notices = !preferenciasProntas ? 'Não foi possível carregar suas metas. Recarregue a página após conferir a conexão e a atualização do banco.' : !configured ? 'Você ainda não definiu metas. Clique em “Editar minhas metas” para começar.' : '';
  goalEl('goalNotice').textContent=notices;goalEl('goalNotice').hidden=!notices;
  goalEl('btnEditarMetas').disabled=!preferenciasProntas;goalEl('goalAdjust').disabled=!preferenciasProntas;
  const cards=goalEl('goalCards');cards.innerHTML='';
  const config=[['receita','Receitas','Quanto entrou','↗'],['investido','Investimentos','Construindo seu futuro','✦'],['despesas','Despesas','Cuidando do seu limite','≋']];
  for (const [key,title,subtitle,icon] of config) {
    const actual=values[key],target=targets[key]*multiple,state=goalProgress(actual,target,key==='despesas');
    const article=document.createElement('article');article.className=`goals-goal goals-${key}`;
    let daily='';
    if(key==='despesas' && current && goalMode==='mensal' && target>actual) {const now=new Date();const days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate()-now.getDate()+1;daily=`<p class="goals-daily">${goalMoney((target-actual)/days)} por dia até o fim do mês, dentro do limite.</p>`;}
    article.innerHTML=`<div class="goals-card-heading"><span class="goals-icon" aria-hidden="true">${icon}</span><div><h3>${title}</h3><p>${subtitle}</p></div><button type="button" class="goals-edit-icon" aria-label="Editar meta de ${title}">↗</button></div><div class="goals-actual">${goalMoney(actual)}</div><div class="goals-target">${key==='despesas'?'Limite':'Meta'} ${goalMode==='anual'?'anual':'mensal'} <strong>${target>0?goalMoney(target):'Não definida'}</strong></div><div class="goals-progress-label"><span class="goals-badge ${state.state}">${state.text}</span><strong>${target>0?Math.round(state.percent)+'%':'—'}</strong></div><div class="goals-progress" role="progressbar" aria-label="${title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100,Math.round(state.percent))}" aria-valuetext="${target>0?Math.round(state.percent)+'%':'Meta não definida'}"><span style="width:${Math.min(100,state.percent)}%"></span></div><p class="goals-remaining ${state.state}">${state.detail}</p>${daily}`;
    const edit=article.querySelector('button');edit.disabled=!preferenciasProntas;edit.onclick=()=>openGoalEditor(key);cards.append(article);
  }
  renderGoalBudget(targets);renderGoalHistory(targets);
}
function goalFieldId(key) { return {receita:'inputMetaReceita',investido:'inputMetaInvestido',despesas:'inputMetaDespesas'}[key]; }
function readGoalDraft() { return Object.fromEntries(GOAL_FIELDS.map(k=>[k,parseGoalMoney(goalEl(goalFieldId(k)).value)])); }
function previewGoalDraft() {
  const v=readGoalDraft(),valid=GOAL_FIELDS.every(k=>Number.isFinite(v[k]));
  if(!valid){goalEl('goalEditPreview').textContent='Preencha os três valores para ver o resumo do plano.';return;}
  const rest=v.receita-v.investido-v.despesas;
  goalEl('goalEditPreview').textContent=rest<0?`Seu plano ultrapassa a receita em ${goalMoney(-rest)} por mês. Você pode ajustar os valores antes de salvar.`:`Margem planejada: ${goalMoney(rest)}/mês. Sua meta anual de investimento será ${goalMoney(v.investido*12)}.`;
}
function openGoalEditor(field='receita') {
  if(!preferenciasProntas)return;
  const targets=goalTargets();GOAL_FIELDS.forEach(k=>{const input=goalEl(goalFieldId(k));input.value=goalInputMoney(targets[k]);input.removeAttribute('aria-invalid');});
  goalEl('goalFormStatus').textContent='';previewGoalDraft();goalEl('goalEditor').showModal();goalEl(goalFieldId(field)).focus();goalEl(goalFieldId(field)).select();
}
async function saveGoalDraft(event) {
  event.preventDefault();if(goalSaving)return;
  const draft=readGoalDraft();let invalid;
  GOAL_FIELDS.forEach(k=>{const bad=!Number.isFinite(draft[k])||draft[k]<0||draft[k]>1e12;goalEl(goalFieldId(k)).setAttribute('aria-invalid',String(bad));if(bad&&!invalid)invalid=k;});
  if(invalid){goalEl('goalFormStatus').textContent='Informe valores válidos, sem negativos e com até duas casas decimais.';goalEl(goalFieldId(invalid)).focus();return;}
  goalSaving=true;const buttons=[...goalEl('goalForm').querySelectorAll('button, input')];buttons.forEach(b=>b.disabled=true);goalEl('btnSalvarMetasConfig').textContent='Salvando…';goalEl('goalFormStatus').textContent='';
  try {
    await salvarPreferenciaBanco('metas',{mensal:draft});
    goalEl('goalEditor').close();renderGoals();goalEl('goalNotice').hidden=false;goalEl('goalNotice').textContent='Metas salvas na sua conta. Você pode acessá-las em outros aparelhos.';
  } catch(e) {goalEl('goalFormStatus').textContent='Não foi possível salvar. Seus valores continuam aqui para tentar novamente. '+e.message;}
  finally {goalSaving=false;buttons.forEach(b=>b.disabled=false);goalEl('btnSalvarMetasConfig').textContent='Salvar metas';}
}
function moveGoalPeriod(direction) {
  const [year,month]=goalMonth.split('-').map(Number),date=new Date(year,month-1+(goalMode==='anual'?12:1)*direction,1);
  if(date.getFullYear()<2000||date.getFullYear()>2100)return;
  goalMonth=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;renderGoals();
}
function inicializarPainelMetas(data=[]) {
  goalData=Array.isArray(data)?data:[];
  if(!goalEventsReady){
    goalEl('btnEditarMetas').onclick=()=>openGoalEditor();goalEl('goalAdjust').onclick=()=>openGoalEditor();
    goalEl('goalForm').addEventListener('submit',saveGoalDraft);
    ['goalClose','goalCancel'].forEach(id=>goalEl(id).onclick=()=>{if(!goalSaving)goalEl('goalEditor').close();});
    goalEl('goalEditor').addEventListener('cancel',event=>{if(goalSaving)event.preventDefault();});
    goalEl('goalPrev').onclick=()=>moveGoalPeriod(-1);goalEl('goalNext').onclick=()=>moveGoalPeriod(1);
    goalEl('goalToday').onclick=()=>{goalMonth=goalTodayMonth();renderGoals();};
    goalEl('goalMonth').onchange=()=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(goalEl('goalMonth').value)){goalMonth=goalEl('goalMonth').value;renderGoals();}};
    goalEl('goalMonthly').onclick=()=>{goalMode='mensal';renderGoals();};goalEl('goalAnnual').onclick=()=>{goalMode='anual';renderGoals();};
    goalEl('goalMetric').onchange=()=>renderGoalHistory(goalTargets());
    GOAL_FIELDS.forEach(k=>setupGoalMoneyInput(goalEl(goalFieldId(k))));
    goalEl('goalUseCurrent').onclick=()=>{const v=goalSummarize(goalData,goalMonth);GOAL_FIELDS.forEach(k=>goalEl(goalFieldId(k)).value=goalInputMoney(v[k]));previewGoalDraft();};goalEventsReady=true;
  }
  renderGoals();
}
function atualizarPainelMetas(data=[]) { goalData=Array.isArray(data)?data:[];renderGoals(); }
