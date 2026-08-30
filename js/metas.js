/*
  Pasta: js
  Arquivo: metas.js
*/

const METAS_STORAGE_PREFIX = 'metas_v3_config';

function obterChaveStorageMetas() {
  const usuario = String(window.usuarioAtualChave || '').trim();

  if (!usuario) {
    return `${METAS_STORAGE_PREFIX}_sem_usuario`;
  }

  return `${METAS_STORAGE_PREFIX}_${usuario}`;
}

const METAS_V3_CONFIG = {
  mensal: {
    receita: 2500,
    investido: 1000,
    despesas: 1300
  }
};

const PALAVRAS_INVESTIMENTO = [
  'invest',
  'tesouro',
  'cdb',
  'lci',
  'lca',
  'acoes',
  'acao',
  'fii',
  'cripto',
  'bitcoin',
  'reserva'
];

let metasLancamentosCache = [];
let metaMesSelecionado = '';
let metaVisualizacaoAtual = 'mensal';
let metasEventosRegistrados = false;

function formatarMoedaMeta(valor) {
  if (typeof formatarMoeda === 'function') {
    return formatarMoeda(valor);
  }

  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function normalizarTextoMeta(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function obterValorNumericoMeta(valor) {
  if (typeof valor === 'number') return valor;

  const texto = String(valor || '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');

  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function obterTipoMeta(lancamento) {
  if (typeof obterTipoLancamento === 'function') {
    return obterTipoLancamento(lancamento);
  }

  return String(lancamento?.tipo || '').trim();
}

function obterValorMeta(lancamento) {
  if (typeof obterValorAbsoluto === 'function') {
    return obterValorAbsoluto(lancamento);
  }

  return Math.abs(obterValorNumericoMeta(lancamento?.valor));
}

function obterChaveMesAtualMeta() {
  const hoje = new Date();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = String(hoje.getFullYear());
  return `${mes}/${ano}`;
}

function obterMesesDisponiveisMeta(lancamentos = []) {
  const mapa = new Set();

  if (typeof obterMesesDisponiveis === 'function') {
    (obterMesesDisponiveis(lancamentos) || []).forEach((mes) => mapa.add(mes));
  } else {
    lancamentos.forEach((item) => {
      const data = String(item?.data || '').trim();
      const match = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (match) {
        const [, , mes, ano] = match;
        mapa.add(`${mes}/${ano}`);
      }
    });
  }

  mapa.add(obterChaveMesAtualMeta());

  return Array.from(mapa).sort((a, b) => {
    const [mesA, anoA] = a.split('/').map(Number);
    const [mesB, anoB] = b.split('/').map(Number);
    return new Date(anoA, mesA - 1) - new Date(anoB, mesB - 1);
  });
}

function filtrarLancamentosPorMesMeta(lancamentos = [], chaveMes = '') {
  if (typeof filtrarLancamentosPorMes === 'function') {
    return filtrarLancamentosPorMes(lancamentos, chaveMes);
  }

  return lancamentos.filter((item) => {
    const data = String(item?.data || '').trim();
    const match = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;
    const [, , mes, ano] = match;
    return `${mes}/${ano}` === chaveMes;
  });
}

function filtrarLancamentosPorAnoMeta(lancamentos = [], ano = '') {
  return lancamentos.filter((item) => {
    const data = String(item?.data || '').trim();
    const match = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return false;
    const [, , , anoData] = match;
    return String(anoData) === String(ano);
  });
}

function formatarMesExtenso(chaveMes) {
  if (!/^\d{2}\/\d{4}$/.test(String(chaveMes || ''))) return '--/----';

  const [mes, ano] = chaveMes.split('/');
  const data = new Date(Number(ano), Number(mes) - 1, 1);

  return data.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  }).replace(/^\w/, (letra) => letra.toUpperCase());
}

function ehInvestimento(lancamento) {
  const tipo = obterTipoMeta(lancamento);
  const categoria = normalizarTextoMeta(lancamento?.categoria);

  return tipo === 'Despesa' && categoria === 'investimento';
}

function somarReceitasMeta(lancamentos = []) {
  return lancamentos
    .filter((item) => obterTipoMeta(item) === 'Receita')
    .reduce((acc, item) => acc + obterValorMeta(item), 0);
}

function somarDespesasMeta(lancamentos = []) {
  return lancamentos
    .filter((item) => obterTipoMeta(item) === 'Despesa' && !ehInvestimento(item))
    .reduce((acc, item) => acc + obterValorMeta(item), 0);
}

function somarInvestimentosMeta(lancamentos = []) {
  return lancamentos
    .filter((item) => ehInvestimento(item))
    .reduce((acc, item) => acc + obterValorMeta(item), 0);
}

function obterResumoMensal(lancamentos = [], chaveMes = '') {
  const dadosMes = filtrarLancamentosPorMesMeta(lancamentos, chaveMes);

  return {
    receita: somarReceitasMeta(dadosMes),
    investido: somarInvestimentosMeta(dadosMes),
    despesas: somarDespesasMeta(dadosMes)
  };
}

function obterResumoAnual(lancamentos = [], chaveMes = '') {
  const ano = /^\d{2}\/\d{4}$/.test(chaveMes) ? chaveMes.split('/')[1] : '';
  const dadosAno = filtrarLancamentosPorAnoMeta(lancamentos, ano);

  return {
    ano: ano || '----',
    receita: somarReceitasMeta(dadosAno),
    investido: somarInvestimentosMeta(dadosAno),
    despesas: somarDespesasMeta(dadosAno)
  };
}

function obterMetasMensais() {
  return { ...METAS_V3_CONFIG.mensal };
}

function obterMetasAnuais() {
  const mensal = obterMetasMensais();

  return {
    receita: mensal.receita * 12,
    investido: mensal.investido * 12,
    despesas: mensal.despesas * 12
  };
}

function carregarMetasSalvas() {
  try {
    const salvo = localStorage.getItem(obterChaveStorageMetas());
    if (!salvo) return;

    const dados = JSON.parse(salvo);

    if (dados?.mensal) {
      METAS_V3_CONFIG.mensal.receita = Number(dados.mensal.receita || 0);
      METAS_V3_CONFIG.mensal.investido = Number(dados.mensal.investido || 0);
      METAS_V3_CONFIG.mensal.despesas = Number(dados.mensal.despesas || 0);
    }
  } catch (error) {
    console.error('Erro ao carregar metas salvas:', error);
  }
}

function salvarMetasSalvas() {
  try {
    localStorage.setItem(
  obterChaveStorageMetas(),
  JSON.stringify(METAS_V3_CONFIG)
);
  } catch (error) {
    console.error('Erro ao salvar metas:', error);
  }
}

function atualizarPainelEdicaoMetas() {
  const tituloPainel = document.getElementById('tituloPainelMetas');
  const labelMetaReceita = document.getElementById('labelMetaReceita');
  const labelMetaInvestido = document.getElementById('labelMetaInvestido');
  const labelMetaDespesas = document.getElementById('labelMetaDespesas');

  const mostrandoAnual = metaVisualizacaoAtual === 'anual';
  const textoPeriodo = mostrandoAnual ? 'anual' : 'mensal';

  if (tituloPainel) tituloPainel.textContent = `Editar metas ${textoPeriodo}s`;
  if (labelMetaReceita) labelMetaReceita.textContent = `Meta ${textoPeriodo} de Receita`;
  if (labelMetaInvestido) labelMetaInvestido.textContent = `Meta ${textoPeriodo} de Investido`;
  if (labelMetaDespesas) labelMetaDespesas.textContent = `Meta ${textoPeriodo} de Despesas`;
}

function preencherFormularioMetas() {
  const inputReceita = document.getElementById('inputMetaReceita');
  const inputInvestido = document.getElementById('inputMetaInvestido');
  const inputDespesas = document.getElementById('inputMetaDespesas');

  atualizarPainelEdicaoMetas();

  if (metaVisualizacaoAtual === 'anual') {
    const metasAnuais = obterMetasAnuais();
    if (inputReceita) inputReceita.value = metasAnuais.receita;
    if (inputInvestido) inputInvestido.value = metasAnuais.investido;
    if (inputDespesas) inputDespesas.value = metasAnuais.despesas;
    return;
  }

  if (inputReceita) inputReceita.value = METAS_V3_CONFIG.mensal.receita;
  if (inputInvestido) inputInvestido.value = METAS_V3_CONFIG.mensal.investido;
  if (inputDespesas) inputDespesas.value = METAS_V3_CONFIG.mensal.despesas;
}

function salvarEdicaoMetas() {
  const inputReceita = document.getElementById('inputMetaReceita');
  const inputInvestido = document.getElementById('inputMetaInvestido');
  const inputDespesas = document.getElementById('inputMetaDespesas');

const receita = obterValorNumericoMeta(inputReceita?.value);
const investido = obterValorNumericoMeta(inputInvestido?.value);
const despesas = obterValorNumericoMeta(inputDespesas?.value);

if (receita < 0 || investido < 0 || despesas < 0) {
  alert('As metas não podem possuir valores negativos.');
  return;
}

  if (metaVisualizacaoAtual === 'anual') {
    METAS_V3_CONFIG.mensal.receita = receita / 12;
    METAS_V3_CONFIG.mensal.investido = investido / 12;
    METAS_V3_CONFIG.mensal.despesas = despesas / 12;
  } else {
    METAS_V3_CONFIG.mensal.receita = receita;
    METAS_V3_CONFIG.mensal.investido = investido;
    METAS_V3_CONFIG.mensal.despesas = despesas;
  }

  salvarMetasSalvas();
  atualizarMetasPorTipo(metasLancamentosCache);
}

function atualizarCardPrincipal(sufixo, atual, meta, modo = 'mensal') {
  const percentual = meta > 0 ? (atual / meta) * 100 : 0;
  const percentualLimitado = Math.max(0, Math.min(100, percentual));

  const mapa = {
    Receita: {
      percent: 'metaReceitaPercent',
      bar: 'metaReceitaBar',
      atual: 'metaReceitaAtual',
      meta: 'metaReceitaMeta',
      badge: 'metaReceitaBadge'
    },
    Investido: {
      percent: 'metaInvestidoPercent',
      bar: 'metaInvestidoBar',
      atual: 'metaInvestidoAtual',
      meta: 'metaInvestidoMeta',
      badge: 'metaInvestidoBadge'
    },
    Despesas: {
      percent: 'metaDespesasPercent',
      bar: 'metaDespesasBar',
      atual: 'metaDespesasAtual',
      meta: 'metaDespesasMeta',
      badge: 'metaDespesasBadge'
    }
  };

  const ids = mapa[sufixo];
  if (!ids) return;

  const elPercent = document.getElementById(ids.percent);
  const elBar = document.getElementById(ids.bar);
  const elAtual = document.getElementById(ids.atual);
  const elMeta = document.getElementById(ids.meta);
  const elBadge = document.getElementById(ids.badge);

  if (elPercent) elPercent.textContent = `${percentualLimitado.toFixed(1)}%`;
  if (elBar) elBar.style.width = `${percentualLimitado}%`;
  if (elAtual) elAtual.textContent = formatarMoedaMeta(atual);
  if (elMeta) elMeta.textContent = formatarMoedaMeta(meta);
  if (elBadge) elBadge.textContent = modo === 'anual' ? 'Anual' : 'Mensal';
}
;
function atualizarComparativo(resumo, metas, modo = 'mensal') {
  const comparativoTitulo = document.getElementById('metaComparativoTitulo');
  const comparativoSubtitulo = document.getElementById('metaComparativoSubtitulo');

  if (comparativoTitulo) {
comparativoTitulo.textContent =
  modo === 'anual' ? 'Comparativo anual' : 'Comparativo mensal';
  }

  if (comparativoSubtitulo) {
    comparativoSubtitulo.textContent =
      modo === 'anual'
        ? 'Comparação entre valores atuais e metas anuais para cada categoria.'
        : 'Comparação entre valores atuais e metas para cada categoria.';
  }

  const maximo = Math.max(
    1,
    resumo.receita, resumo.investido, resumo.despesas,
    metas.receita, metas.investido, metas.despesas
  );

  const linhas = [
    {
      atualBar: 'compReceitaAtualBar',
      metaBar: 'compReceitaMetaBar',
      atualValor: 'compReceitaAtualValor',
      metaValor: 'compReceitaMetaValor',
      atual: resumo.receita,
      meta: metas.receita
    },
    {
      atualBar: 'compInvestidoAtualBar',
      metaBar: 'compInvestidoMetaBar',
      atualValor: 'compInvestidoAtualValor',
      metaValor: 'compInvestidoMetaValor',
      atual: resumo.investido,
      meta: metas.investido
    },
    {
      atualBar: 'compDespesasAtualBar',
      metaBar: 'compDespesasMetaBar',
      atualValor: 'compDespesasAtualValor',
      metaValor: 'compDespesasMetaValor',
      atual: resumo.despesas,
      meta: metas.despesas
    }
  ];

  linhas.forEach((linha) => {
    const elAtualBar = document.getElementById(linha.atualBar);
    const elMetaBar = document.getElementById(linha.metaBar);
    const elAtualValor = document.getElementById(linha.atualValor);
    const elMetaValor = document.getElementById(linha.metaValor);

    const larguraAtual = (linha.atual / maximo) * 100;
    const larguraMeta = (linha.meta / maximo) * 100;

    if (elAtualBar) elAtualBar.style.width = `${larguraAtual}%`;
    if (elMetaBar) elMetaBar.style.width = `${larguraMeta}%`;
    if (elAtualValor) elAtualValor.textContent = formatarMoedaMeta(linha.atual);
    if (elMetaValor) elMetaValor.textContent = formatarMoedaMeta(linha.meta);
  });
}

function atualizarResumoLateral(resumo, metas, modo = 'mensal') {
  const tipoLabel = modo === 'anual' ? 'anual' : 'mensal';

  const receitaPercent = metas.receita > 0 ? (resumo.receita / metas.receita) * 100 : 0;
  const investidoPercent = metas.investido > 0 ? (resumo.investido / metas.investido) * 100 : 0;
  const despesasPercent = metas.despesas > 0 ? (resumo.despesas / metas.despesas) * 100 : 0;

  const sumReceitaTitulo = document.getElementById('sumReceitaTitulo');
  const sumReceitaValor = document.getElementById('sumReceitaValor');
  const sumReceitaSub = document.getElementById('sumReceitaSub');

  const sumInvestidoTitulo = document.getElementById('sumInvestidoTitulo');
  const sumInvestidoValor = document.getElementById('sumInvestidoValor');
  const sumInvestidoSub = document.getElementById('sumInvestidoSub');

  const sumDespesasTitulo = document.getElementById('sumDespesasTitulo');
  const sumDespesasValor = document.getElementById('sumDespesasValor');
  const sumDespesasSub = document.getElementById('sumDespesasSub');

  if (sumReceitaTitulo) sumReceitaTitulo.textContent = modo === 'anual' ? 'Receita do ano' : 'Receita do mês';
  if (sumReceitaValor) sumReceitaValor.textContent = formatarMoedaMeta(resumo.receita);
  if (sumReceitaSub) sumReceitaSub.textContent = `${Math.max(0, Math.min(100, receitaPercent)).toFixed(1)}% da meta ${tipoLabel}`;

  if (sumInvestidoTitulo) sumInvestidoTitulo.textContent = modo === 'anual' ? 'Total investido no ano' : 'Total investido';
  if (sumInvestidoValor) sumInvestidoValor.textContent = formatarMoedaMeta(resumo.investido);
  if (sumInvestidoSub) sumInvestidoSub.textContent = `${Math.max(0, Math.min(100, investidoPercent)).toFixed(1)}% da meta ${tipoLabel}`;

  if (sumDespesasTitulo) sumDespesasTitulo.textContent = modo === 'anual' ? 'Despesas do ano' : 'Despesas do mês';
  if (sumDespesasValor) sumDespesasValor.textContent = formatarMoedaMeta(resumo.despesas);
  if (sumDespesasSub) sumDespesasSub.textContent = `${Math.max(0, Math.min(100, despesasPercent)).toFixed(1)}% da meta ${tipoLabel}`;
}

function atualizarCabecalhoMetas() {
  const labelMes = document.getElementById('metaMesAtualLabel');
  const navMensal = document.getElementById('metaNavegacaoMensal');
  const labelAno = document.getElementById('metaAnoAtualLabel');
  const btnToggle = document.getElementById('btnToggleVisaoMetas');
  const btnAnterior = document.getElementById('btnMetaMesAnterior');
  const btnProximo = document.getElementById('btnMetaMesProximo');

  const meses = obterMesesDisponiveisMeta(metasLancamentosCache);
  const indiceAtual = meses.indexOf(metaMesSelecionado);
  const mostrandoAnual = metaVisualizacaoAtual === 'anual';
  const anoAtual = /^\d{2}\/\d{4}$/.test(metaMesSelecionado)
    ? metaMesSelecionado.split('/')[1]
    : '----';

  if (labelMes) labelMes.textContent = formatarMesExtenso(metaMesSelecionado);

  if (navMensal) navMensal.style.display = mostrandoAnual ? 'none' : 'grid';

  if (labelAno) {
    labelAno.style.display = mostrandoAnual ? 'inline-flex' : 'none';
    labelAno.textContent = anoAtual;
  }

  if (btnToggle) {
    btnToggle.textContent = mostrandoAnual ? '📅 Ver metas mensais' : '📅 Ver metas anuais';
  }

  if (btnAnterior) {
    const desabilitado = mostrandoAnual || indiceAtual <= 0;
    btnAnterior.disabled = desabilitado;
    btnAnterior.classList.toggle('is-disabled', desabilitado);
  }

  if (btnProximo) {
    const desabilitado = mostrandoAnual || indiceAtual === -1 || indiceAtual >= meses.length - 1;
    btnProximo.disabled = desabilitado;
    btnProximo.classList.toggle('is-disabled', desabilitado);
  }
}

function renderizarMetas() {
  const mostrandoAnual = metaVisualizacaoAtual === 'anual';

  if (mostrandoAnual) {
    const resumoAnual = obterResumoAnual(metasLancamentosCache, metaMesSelecionado);
    const metasAnuais = obterMetasAnuais();

    atualizarCardPrincipal('Receita', resumoAnual.receita, metasAnuais.receita, 'anual');
    atualizarCardPrincipal('Investido', resumoAnual.investido, metasAnuais.investido, 'anual');
    atualizarCardPrincipal('Despesas', resumoAnual.despesas, metasAnuais.despesas, 'anual');
    atualizarComparativo(resumoAnual, metasAnuais, 'anual');
    atualizarResumoLateral(resumoAnual, metasAnuais, 'anual');
  } else {
    const resumoMensal = obterResumoMensal(metasLancamentosCache, metaMesSelecionado);
    const metasMensais = obterMetasMensais();

    atualizarCardPrincipal('Receita', resumoMensal.receita, metasMensais.receita, 'mensal');
    atualizarCardPrincipal('Investido', resumoMensal.investido, metasMensais.investido, 'mensal');
    atualizarCardPrincipal('Despesas', resumoMensal.despesas, metasMensais.despesas, 'mensal');
    atualizarComparativo(resumoMensal, metasMensais, 'mensal');
    atualizarResumoLateral(resumoMensal, metasMensais, 'mensal');
  }

  preencherFormularioMetas();
  atualizarCabecalhoMetas();
}

function atualizarMetasPorTipo(lancamentos = []) {
  metasLancamentosCache = Array.isArray(lancamentos) ? [...lancamentos] : [];

  const meses = obterMesesDisponiveisMeta(metasLancamentosCache);
  const mesAtual = obterChaveMesAtualMeta();

  if (!meses.length) {
    metaMesSelecionado = mesAtual;
  } else if (!metaMesSelecionado || !meses.includes(metaMesSelecionado)) {
    metaMesSelecionado = meses.includes(mesAtual) ? mesAtual : meses[meses.length - 1];
  }

  renderizarMetas();
}

function mudarMesMetas(direcao) {
  if (metaVisualizacaoAtual === 'anual') return;

  const meses = obterMesesDisponiveisMeta(metasLancamentosCache);
  if (!meses.length) return;

  const indiceAtual = meses.indexOf(metaMesSelecionado);

  if (indiceAtual === -1) {
    metaMesSelecionado = meses[meses.length - 1];
  } else {
    const novoIndice = indiceAtual + direcao;
    if (novoIndice < 0 || novoIndice >= meses.length) return;
    metaMesSelecionado = meses[novoIndice];
  }

  renderizarMetas();
}

function toggleVisualizacaoMetas() {
  metaVisualizacaoAtual = metaVisualizacaoAtual === 'mensal' ? 'anual' : 'mensal';
  renderizarMetas();
}

function registrarEventosMetasV3() {
  if (metasEventosRegistrados) return;

  const btnMetaMesAnterior = document.getElementById('btnMetaMesAnterior');
  const btnMetaMesProximo = document.getElementById('btnMetaMesProximo');
  const btnToggleVisaoMetas = document.getElementById('btnToggleVisaoMetas');
  const btnSalvarMetasConfig = document.getElementById('btnSalvarMetasConfig');

  if (btnMetaMesAnterior) btnMetaMesAnterior.addEventListener('click', () => mudarMesMetas(-1));
  if (btnMetaMesProximo) btnMetaMesProximo.addEventListener('click', () => mudarMesMetas(1));
  if (btnToggleVisaoMetas) btnToggleVisaoMetas.addEventListener('click', toggleVisualizacaoMetas);
  if (btnSalvarMetasConfig) btnSalvarMetasConfig.addEventListener('click', salvarEdicaoMetas);

  metasEventosRegistrados = true;
}

function inicializarPainelMetas(lancamentos = []) {
  metasLancamentosCache = Array.isArray(lancamentos) ? [...lancamentos] : [];
  carregarMetasSalvas();
  registrarEventosMetasV3();
  preencherFormularioMetas();
  atualizarMetasPorTipo(metasLancamentosCache);
}

window.inicializarPainelMetas = inicializarPainelMetas;
window.atualizarPainelMetas = atualizarMetasPorTipo;
window.atualizarMetasPorTipo = atualizarMetasPorTipo;
window.mudarMesMetas = mudarMesMetas;
window.toggleVisualizacaoMetas = toggleVisualizacaoMetas;