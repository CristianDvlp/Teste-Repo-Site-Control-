/*
  Pasta: js
  Arquivo: charts.js

  Este arquivo cuida dos gráficos do dashboard.
*/

let chartResumoMes;
let chartCategoriasMes;
let chartSaldoMes;
let chartReceitasCategoriaMes;
let chartTiposMes;
let chartInvestidoMes;

let chartComparativoResumo;
let chartComparativoSaldo;
let chartComparativoPatrimonio;
let chartComparativoVales;
let chartComparativoInvestido;

let visaoDashboardAtiva = 'resumo';
let visaoComparativoAtiva = 'resumo';
let contextoDashboardAtual = {
  lancamentos: [],
  mesSelecionado: ''
};
let contextoComparativoAtual = {
  lancamentos: [],
  contasPorMes: {}
};

const VISOES_DASHBOARD = [
  {
    id: 'resumo',
    titulo: 'Visão geral',
    descricao: 'Receitas, despesas e vales',
    canvasId: 'chartResumoMes'
  },
  {
    id: 'despesas',
    titulo: 'Despesas por categoria',
    descricao: 'Veja onde mais gastou',
    canvasId: 'chartCategoriasMes'
  },
  {
    id: 'saldo',
    titulo: 'Saldo do mês',
    descricao: 'Resultado entre entradas e saídas',
    canvasId: 'chartSaldoMes'
  },
  {
    id: 'investimentos',
    titulo: 'Investimentos',
    descricao: 'Total aplicado no mês',
    canvasId: 'chartInvestidoMes'
  }
];

const VISOES_COMPARATIVO = [
  {
    id: 'resumo',
    titulo: 'Receitas x despesas',
    descricao: 'Comparação mês a mês',
    canvasId: 'chartComparativoResumo'
  },
  {
    id: 'saldo',
    titulo: 'Saldo mensal',
    descricao: 'Evolução do resultado',
    canvasId: 'chartComparativoSaldo'
  },
  {
    id: 'patrimonio',
    titulo: 'Patrimônio acumulado',
    descricao: 'Crescimento ao longo do tempo',
    canvasId: 'chartComparativoPatrimonio'
  }
];

const pluginRotuloDados = {
  id: 'pluginRotuloDados',
  afterDatasetsDraw(chart) {
    const { ctx, chartArea } = chart;
    const tipoGrafico = chart.config.type;

    if (!chartArea) return;

    const limiteEsquerda = chartArea.left + 12;
    const limiteDireita = chartArea.right - 12;
    const limiteTopo = chartArea.top + 16;
    const limiteBase = chartArea.bottom - 8;

    ctx.save();
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);

      if (!meta || meta.hidden) return;

      meta.data.forEach((elemento, index) => {
        const valor = dataset.data[index];

        if (valor === null || valor === undefined || Number(valor) === 0) {
          return;
        }

        let x = 0;
        let y = 0;

        if (typeof elemento.tooltipPosition === 'function') {
          const pos = elemento.tooltipPosition();
          x = pos.x;
          y = pos.y;
        } else if (elemento.x !== undefined && elemento.y !== undefined) {
          x = elemento.x;
          y = elemento.y;
        } else {
          return;
        }

        const texto = formatarMoedaCurta(valor);

        if (tipoGrafico === 'pie' || tipoGrafico === 'doughnut') {
          x = Math.max(limiteEsquerda, Math.min(x, limiteDireita));
          y = Math.max(limiteTopo, Math.min(y, limiteBase));

          ctx.fillStyle = '#111827';
          ctx.textBaseline = 'middle';
          ctx.fillText(texto, x, y);
        } else {
          x = Math.max(limiteEsquerda, Math.min(x, limiteDireita));
          y = Math.max(limiteTopo, Math.min(y - 8, limiteBase));

          ctx.fillStyle = '#111827';
          ctx.textBaseline = 'bottom';
          ctx.fillText(texto, x, y);
        }
      });
    });

    ctx.restore();
  }
};

function formatarMoedaCurta(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function obterMesesOrdenados(mapaMensal) {
  return Object.keys(mapaMensal).sort((a, b) => {
    const [mesA, anoA] = a.split('/').map(Number);
    const [mesB, anoB] = b.split('/').map(Number);
    return new Date(anoA, mesA - 1, 1) - new Date(anoB, mesB - 1, 1);
  });
}
function obterChaveCategoriaGrafico(texto) {
  return String(texto || 'Sem categoria')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function formatarCategoriaGrafico(texto) {
  const valor = String(texto || 'Sem categoria')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

  return valor.replace(/\b\p{L}/gu, letra => letra.toUpperCase());
}


function agruparPorCategoriaETipo(lancamentos, tipoDesejado) {
  const mapa = {};

  lancamentos
    .filter(item => !categoriaIgnoradaNoDashboard(item))
    .filter(item => obterTipoLancamento(item) === tipoDesejado)
    .forEach(item => {
      const categoriaOriginal = item.categoria || 'Sem categoria';
      const chave = obterChaveCategoriaGrafico(categoriaOriginal);
      const label = formatarCategoriaGrafico(categoriaOriginal);

      if (!mapa[chave]) {
        mapa[chave] = {
          label,
          total: 0
        };
      }

      mapa[chave].total += obterValorAbsoluto(item);
    });

  return Object.fromEntries(
    Object.values(mapa)
      .sort((a, b) => b.total - a.total)
      .map(item => [item.label, item.total])
  );
}

function agruparPorTipo(lancamentos) {
  const totais = {
    Receita: 0,
    Despesa: 0,
    Vales: 0
  };

  lancamentos
    .filter(item => !categoriaIgnoradaNoDashboard(item))
    .forEach(item => {
      const tipo = obterTipoLancamento(item);
      const valor = obterValorAbsoluto(item);

      if (tipo === 'Receita') totais.Receita += valor;
      if (tipo === 'Despesa') totais.Despesa += valor;
      if (tipo === 'Vales') totais.Vales += valor;
    });

  return totais;
}

function calcularTotaisSemValesNoSaldo(lancamentos = []) {
  const totais = {
    receitas: 0,
    despesas: 0,
    vales: 0,
    saldo: 0
  };

  lancamentos
    .filter(item => !categoriaIgnoradaNoDashboard(item))
    .forEach(item => {
      const tipo = obterTipoLancamento(item);
      const valor = obterValorAbsoluto(item);

      if (tipo === 'Receita') {
        totais.receitas += valor;
      }

      if (tipo === 'Despesa') {
        totais.despesas += valor;
      }

      if (tipo === 'Vales') {
        totais.vales += valor;
      }
    });

  totais.saldo = totais.receitas - totais.despesas;

  return totais;
}

function normalizarTextoInvestimento(texto) {
  return String(texto || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function ehLancamentoInvestimento(item) {
  const categoria = normalizarTextoInvestimento(item.categoria);
  return categoria === 'INVESTIMENTO';
}

function calcularTotalInvestido(lancamentos = []) {
  return lancamentos
    .filter(item => !categoriaIgnoradaNoDashboard(item))
    .filter(item => ehLancamentoInvestimento(item))
    .reduce((acc, item) => acc + obterValorAbsoluto(item), 0);
}

function opcoesPadrao() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    resizeDelay: 120,
    normalized: true,
    layout: {
      padding: {
        top: 24,
        right: 18,
        bottom: 10,
        left: 10
      }
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 18,
          boxHeight: 10,
          padding: 12,
          font: {
            size: 11
          }
        }
      }
    },
    scales: {
      x: {
        ticks: {
          padding: 6,
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          font: {
            size: 11
          }
        },
        grid: {
          display: true
        }
      },
      y: {
        beginAtZero: true,
        grace: '18%',
        ticks: {
          padding: 8,
          font: {
            size: 11
          }
        }
      }
    }
  };
}

function destruirChartsMes() {
  if (chartResumoMes) chartResumoMes.destroy();
  if (chartCategoriasMes) chartCategoriasMes.destroy();
  if (chartSaldoMes) chartSaldoMes.destroy();
  if (chartReceitasCategoriaMes) chartReceitasCategoriaMes.destroy();
  if (chartTiposMes) chartTiposMes.destroy();
  if (chartInvestidoMes) chartInvestidoMes.destroy();

  chartResumoMes = null;
  chartCategoriasMes = null;
  chartSaldoMes = null;
  chartReceitasCategoriaMes = null;
  chartTiposMes = null;
  chartInvestidoMes = null;
}

function destruirChartsComparativo() {
  if (chartComparativoResumo) chartComparativoResumo.destroy();
  if (chartComparativoSaldo) chartComparativoSaldo.destroy();
  if (chartComparativoPatrimonio) chartComparativoPatrimonio.destroy();
  if (chartComparativoVales) chartComparativoVales.destroy();
  if (chartComparativoInvestido) chartComparativoInvestido.destroy();

  chartComparativoResumo = null;
  chartComparativoSaldo = null;
  chartComparativoPatrimonio = null;
  chartComparativoVales = null;
  chartComparativoInvestido = null;
}

function adicionarEstilosDashboardInterativo() {
  if (document.getElementById('dashboardInterativoStyles')) return;

  const style = document.createElement('style');
  style.id = 'dashboardInterativoStyles';
  style.textContent = `
    .dashboard-view-menu {
      margin-bottom: 18px;
    }

    .dashboard-view-menu__header {
      margin-bottom: 14px;
    }

    .dashboard-view-menu__header h2 {
      margin: 0 0 5px;
      font-size: 19px;
    }

    .dashboard-view-menu__header p {
      margin: 0;
      color: var(--muted);
      font-size: 14px;
    }

    .dashboard-view-menu__options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
      gap: 10px;
    }

    .dashboard-view-option {
      min-height: 76px;
      padding: 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--card);
      color: var(--text);
      cursor: pointer;
      text-align: left;
      transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
    }

    .dashboard-view-option:hover,
    .dashboard-view-option:focus-visible {
      border-color: var(--primary);
      box-shadow: 0 5px 15px rgba(37, 99, 235, .12);
      outline: none;
      transform: translateY(-1px);
    }

    .dashboard-view-option.active {
      border-color: var(--primary);
      background: #eff6ff;
      box-shadow: inset 0 0 0 1px var(--primary);
    }

    .dashboard-view-option strong,
    .dashboard-view-option span {
      display: block;
    }

    .dashboard-view-option strong {
      margin-bottom: 5px;
      font-size: 14px;
    }

    .dashboard-view-option span {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }

    .dashboard-single-chart {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .dashboard-single-chart > .card {
      grid-column: 1 / -1;
    }

    #dashboard .grid > .card[hidden],
    #comparativo .grid > .card[hidden] {
      display: none !important;
    }

    #dashboard .summary .card[data-dashboard-view] {
      cursor: pointer;
      transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
    }

    #dashboard .summary .card[data-dashboard-view]:hover,
    #dashboard .summary .card[data-dashboard-view]:focus-visible {
      border-color: var(--primary);
      box-shadow: 0 6px 18px rgba(37, 99, 235, .14);
      outline: none;
      transform: translateY(-1px);
    }

    @media (max-width: 640px) {
      .dashboard-view-menu__options {
        grid-template-columns: 1fr 1fr;
      }

      .dashboard-view-option {
        min-height: 70px;
        padding: 12px;
      }
    }
  `;

  document.head.appendChild(style);
}

function criarSeletorGraficos({
  sectionId,
  selectorId,
  titulo,
  descricao,
  visoes,
  obterVisaoAtiva,
  selecionarVisao
}) {
  adicionarEstilosDashboardInterativo();

  const section = document.getElementById(sectionId);
  const grid = section?.querySelector('.grid');
  if (!section || !grid) return;

  grid.classList.add('dashboard-single-chart');

  if (!document.getElementById(selectorId)) {
    const menu = document.createElement('div');
    menu.id = selectorId;
    menu.className = 'dashboard-view-menu card';

    const header = document.createElement('div');
    header.className = 'dashboard-view-menu__header';

    const heading = document.createElement('h2');
    heading.textContent = titulo;

    const texto = document.createElement('p');
    texto.textContent = descricao;

    const opcoes = document.createElement('div');
    opcoes.className = 'dashboard-view-menu__options';

    visoes.forEach(visao => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'dashboard-view-option';
      botao.dataset.view = visao.id;
      botao.setAttribute('aria-pressed', 'false');

      const nome = document.createElement('strong');
      nome.textContent = visao.titulo;

      const detalhe = document.createElement('span');
      detalhe.textContent = visao.descricao;

      botao.append(nome, detalhe);
      botao.addEventListener('click', () => selecionarVisao(visao.id));
      opcoes.appendChild(botao);
    });

    header.append(heading, texto);
    menu.append(header, opcoes);
    grid.before(menu);
  }

  const visaoAtiva = obterVisaoAtiva();

  section.querySelectorAll(`#${selectorId} .dashboard-view-option`).forEach(botao => {
    const ativo = botao.dataset.view === visaoAtiva;
    botao.classList.toggle('active', ativo);
    botao.setAttribute('aria-pressed', String(ativo));
  });

  section.querySelectorAll('.grid > .card').forEach(card => {
    card.hidden = true;
  });

  const canvasAtivo = document.getElementById(
    visoes.find(visao => visao.id === visaoAtiva)?.canvasId || ''
  );
  const cardAtivo = canvasAtivo?.closest('.card');
  if (cardAtivo) cardAtivo.hidden = false;
}

function prepararCardsResumoDashboard() {
  const atalhos = [
    ['totalReceitas', 'resumo', 'Abrir visão geral do mês'],
    ['totalDespesas', 'despesas', 'Abrir despesas por categoria'],
    ['resumoVales', 'resumo', 'Abrir visão geral do mês'],
    ['saldoFinal', 'saldo', 'Abrir saldo do mês']
  ];

  atalhos.forEach(([campoId, visao, ariaLabel]) => {
    const card = document.getElementById(campoId)?.closest('.card');
    if (!card || card.dataset.dashboardShortcutReady === 'true') return;

    card.dataset.dashboardView = visao;
    card.dataset.dashboardShortcutReady = 'true';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', ariaLabel);
    card.title = `${ariaLabel}. Clique para abrir.`;

    const abrirVisao = () => selecionarVisaoDashboard(visao);
    card.addEventListener('click', abrirVisao);
    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      abrirVisao();
    });
  });
}

function selecionarVisaoDashboard(visao) {
  if (!VISOES_DASHBOARD.some(item => item.id === visao)) return;
  visaoDashboardAtiva = visao;
  renderChartsMes(
    contextoDashboardAtual.lancamentos,
    contextoDashboardAtual.mesSelecionado
  );
}

function selecionarVisaoComparativo(visao) {
  if (!VISOES_COMPARATIVO.some(item => item.id === visao)) return;
  visaoComparativoAtiva = visao;
  renderChartsComparativo(
    contextoComparativoAtual.lancamentos,
    contextoComparativoAtual.contasPorMes
  );
}

function renderChartsMes(lancamentos, mesSelecionado = '') {
  contextoDashboardAtual = {
    lancamentos,
    mesSelecionado
  };

  const dadosDashboard = lancamentos.filter(item => !categoriaIgnoradaNoDashboard(item));
  const dadosMes = filtrarLancamentosPorMes(dadosDashboard, mesSelecionado);

  const totais = calcularTotaisSemValesNoSaldo(dadosMes);

  const receitasMes = totais.receitas;
  const despesasMes = totais.despesas;
  const valesMes = totais.vales;
  const saldoMes = totais.saldo;

  document.getElementById('totalReceitas').textContent = formatarMoeda(receitasMes);
  document.getElementById('totalDespesas').textContent = formatarMoeda(despesasMes);
  document.getElementById('resumoVales').textContent = formatarMoeda(valesMes);
  document.getElementById('saldoFinal').textContent = formatarMoeda(saldoMes);

  prepararCardsResumoDashboard();
  criarSeletorGraficos({
    sectionId: 'dashboard',
    selectorId: 'dashboardViewSelector',
    titulo: 'Escolha o que deseja analisar',
    descricao: 'Somente o gráfico selecionado é carregado.',
    visoes: VISOES_DASHBOARD,
    obterVisaoAtiva: () => visaoDashboardAtiva,
    selecionarVisao: selecionarVisaoDashboard
  });

  destruirChartsMes();

  if (visaoDashboardAtiva === 'resumo') {
    chartResumoMes = new Chart(document.getElementById('chartResumoMes'), {
      type: 'bar',
      data: {
        labels: ['Receitas', 'Despesas', 'Vales'],
        datasets: [{
          label: mesSelecionado || 'Mês',
          data: [receitasMes, despesasMes, valesMes],
          backgroundColor: ['#16a34a', '#dc2626', '#f59e0b']
        }]
      },
      options: opcoesPadrao(),
      plugins: [pluginRotuloDados]
    });
    return;
  }

  if (visaoDashboardAtiva === 'despesas') {
    const despesasPorCategoria = agruparPorCategoriaETipo(dadosMes, 'Despesa');
    const labels = Object.keys(despesasPorCategoria);
    const valores = Object.values(despesasPorCategoria);

    chartCategoriasMes = new Chart(document.getElementById('chartCategoriasMes'), {
      type: 'pie',
      data: {
        labels: labels.length ? labels : ['Sem dados'],
        datasets: [{
          data: valores.length ? valores : [1],
          backgroundColor: labels.length
            ? ['#2563eb', '#7c3aed', '#ea580c', '#0891b2', '#db2777', '#65a30d', '#d97706', '#0f766e']
            : ['#e5e7eb']
        }]
      },
      options: opcoesPadrao(),
      plugins: [pluginRotuloDados]
    });
    return;
  }

  if (visaoDashboardAtiva === 'saldo') {
    chartSaldoMes = new Chart(document.getElementById('chartSaldoMes'), {
      type: 'bar',
      data: {
        labels: ['Saldo do mês'],
        datasets: [{
          label: mesSelecionado || 'Mês',
          data: [saldoMes],
          backgroundColor: [saldoMes >= 0 ? '#2563eb' : '#dc2626']
        }]
      },
      options: opcoesPadrao(),
      plugins: [pluginRotuloDados]
    });
    return;
  }

  if (visaoDashboardAtiva === 'investimentos') {
    const investidoMes = calcularTotalInvestido(dadosMes);
    chartInvestidoMes = new Chart(document.getElementById('chartInvestidoMes'), {
      type: 'bar',
      data: {
        labels: [mesSelecionado || 'Mês selecionado'],
        datasets: [{
          label: 'Investido',
          data: [investidoMes],
          backgroundColor: ['#0ea5e9']
        }]
      },
      options: opcoesPadrao(),
      plugins: [pluginRotuloDados]
    });
  }
}

function renderChartsComparativo(lancamentos, contasPorMes = {}) {
  contextoComparativoAtual = {
    lancamentos,
    contasPorMes
  };

  const dadosDashboard = lancamentos.filter(item => !categoriaIgnoradaNoDashboard(item));
  const mapaMensal = {};

  dadosDashboard.forEach(item => {
    const chaveMes = obterChaveMes(item.data);
    if (!chaveMes) return;

    if (!mapaMensal[chaveMes]) {
      mapaMensal[chaveMes] = {
        receitas: 0,
        despesas: 0,
        Vales: 0,
        investido: 0,
        saldoInicial: 0
      };
    }

    const tipo = obterTipoLancamento(item);
    const valor = obterValorAbsoluto(item);

    if (typeof ehSaldoInicial === "function" && ehSaldoInicial(item)) {
      mapaMensal[chaveMes].saldoInicial += valor;
      return;
    }

    if (tipo === 'Receita') mapaMensal[chaveMes].receitas += valor;
    if (tipo === 'Despesa') mapaMensal[chaveMes].despesas += valor;
    if (tipo === 'Vales') mapaMensal[chaveMes].Vales += valor;
    if (ehLancamentoInvestimento(item)) mapaMensal[chaveMes].investido += valor;
  });

  Object.entries(contasPorMes).forEach(([chaveMes, total]) => {
    if (!mapaMensal[chaveMes]) {
      mapaMensal[chaveMes] = {
        receitas: 0,
        despesas: 0,
        Vales: 0,
        investido: 0,
        saldoInicial: 0
      };
    }

    mapaMensal[chaveMes].despesas += Number(total || 0);
  });

  const meses = obterMesesOrdenados(mapaMensal);

  criarSeletorGraficos({
    sectionId: 'comparativo',
    selectorId: 'comparativoViewSelector',
    titulo: 'Escolha o comparativo',
    descricao: 'Apenas uma análise é exibida por vez.',
    visoes: VISOES_COMPARATIVO,
    obterVisaoAtiva: () => visaoComparativoAtiva,
    selecionarVisao: selecionarVisaoComparativo
  });

  destruirChartsComparativo();

  if (visaoComparativoAtiva === 'resumo') {
    const receitas = meses.map(mes => mapaMensal[mes].receitas || 0);
    const despesas = meses.map(mes => mapaMensal[mes].despesas || 0);
    const vales = meses.map(mes => mapaMensal[mes].Vales || 0);

    chartComparativoResumo = new Chart(document.getElementById('chartComparativoResumo'), {
      type: 'bar',
      data: {
        labels: meses.length ? meses : ['Sem dados'],
        datasets: [
          {
            label: 'Receitas',
            data: meses.length ? receitas : [0],
            backgroundColor: '#16a34a'
          },
          {
            label: 'Despesas',
            data: meses.length ? despesas : [0],
            backgroundColor: '#dc2626'
          },
          {
            label: 'Vales',
            data: meses.length ? vales : [0],
            backgroundColor: '#f59e0b'
          }
        ]
      },
      options: opcoesPadrao(),
      plugins: [pluginRotuloDados]
    });
    return;
  }

  const saldos = meses.map(mes =>
    (mapaMensal[mes].saldoInicial || 0) +
    (mapaMensal[mes].receitas || 0) -
    (mapaMensal[mes].despesas || 0)
  );

  if (visaoComparativoAtiva === 'saldo') {
    chartComparativoSaldo = new Chart(document.getElementById('chartComparativoSaldo'), {
      type: 'line',
      data: {
        labels: meses.length ? meses : ['Sem dados'],
        datasets: [{
          label: 'Saldo mensal',
          data: meses.length ? saldos : [0],
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.18)',
          fill: true,
          tension: 0.25
        }]
      },
      options: opcoesPadrao(),
      plugins: [pluginRotuloDados]
    });
    return;
  }

  if (visaoComparativoAtiva === 'patrimonio') {
    let acumulado = 0;
    const patrimonio = saldos.map(saldo => {
      acumulado += saldo;
      return acumulado;
    });

    chartComparativoPatrimonio = new Chart(document.getElementById('chartComparativoPatrimonio'), {
      type: 'line',
      data: {
        labels: meses.length ? meses : ['Sem dados'],
        datasets: [{
          label: 'Patrimônio acumulado',
          data: meses.length ? patrimonio : [0],
          borderColor: '#7c3aed',
          backgroundColor: 'rgba(124, 58, 237, 0.16)',
          fill: true,
          tension: 0.25
        }]
      },
      options: opcoesPadrao(),
      plugins: [pluginRotuloDados]
    });
  }
}
