/*
  Pasta: js
  Arquivo: main.js
*/

let lancamentos = [];
let mesDashboardSelecionado = '';
let mesLancamentosSelecionado = '';
let lancamentoEmEdicaoId = null;
const AGENDAMENTOS_STORAGE_KEY = 'lancamentos_agendados_v1';
let tabAtiva = 'lancamentos';
let revisaoDados = 0;
let chaveDashboardRenderizada = '';
let revisaoComparativoRenderizada = -1;

function ajustarMesDashboardSelecionado() {
  const lancamentosAnaliticos = obterLancamentosAnaliticos();
  const mesesDisponiveis = obterMesesDisponiveis(lancamentosAnaliticos);

  if (mesesDisponiveis.length === 0) {
    mesDashboardSelecionado = '';
    return;
  }

  if (!mesDashboardSelecionado || !mesesDisponiveis.includes(mesDashboardSelecionado)) {
    mesDashboardSelecionado = mesesDisponiveis[mesesDisponiveis.length - 1];
  }
}

function ajustarMesLancamentosSelecionado() {
  const mesesDisponiveis = obterMesesDisponiveis(lancamentos);

  if (mesesDisponiveis.length === 0) {
    mesLancamentosSelecionado = '';
    return;
  }

  if (!mesLancamentosSelecionado || !mesesDisponiveis.includes(mesLancamentosSelecionado)) {
    mesLancamentosSelecionado = mesesDisponiveis[mesesDisponiveis.length - 1];
  }
}

function atualizarTextoBotaoSalvar() {
  const btnSalvar = document.getElementById('btnSalvar');
  const btnResetarFormulario = document.getElementById('btnResetarFormulario');
  const tituloFormularioLancamento = document.getElementById('tituloFormularioLancamento');

  if (!btnSalvar || !btnResetarFormulario) return;

  if (lancamentoEmEdicaoId !== null) {
    btnSalvar.textContent = 'Atualizar lançamento';
    btnSalvar.classList.remove('btn-primary');
    btnSalvar.classList.add('btn-warning');
    btnResetarFormulario.textContent = 'Cancelar edição';

    if (tituloFormularioLancamento) {
      tituloFormularioLancamento.textContent = 'Editar lançamento';
    }
  } else {
    btnSalvar.textContent = 'Salvar lançamento';
    btnSalvar.classList.remove('btn-warning');
    btnSalvar.classList.add('btn-primary');
    btnResetarFormulario.textContent = 'Resetar campos';

    if (tituloFormularioLancamento) {
      tituloFormularioLancamento.textContent = 'Novo lançamento';
    }
  }
}

function limparFormularioSegura() {
  if (typeof limparFormulario === 'function') {
    limparFormulario();
    return;
  }

  if (typeof form !== 'undefined' && form.financeForm) {
    form.financeForm.reset();
  }
}

function preencherDataAtualNoFormulario() {
  if (typeof form === 'undefined' || !form.data) return;
  if (form.data.value) return;

  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, '0');
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano = hoje.getFullYear();

  form.data.value = `${dia}/${mes}/${ano}`;
}

function gerarIdAgendamento() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `ag_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function obterAgendamentosSalvos() {
  try {
    const dados = JSON.parse(localStorage.getItem(AGENDAMENTOS_STORAGE_KEY) || '[]');
    return Array.isArray(dados) ? dados : [];
  } catch (error) {
    console.error('Erro ao ler agendamentos:', error);
    return [];
  }
}

function salvarAgendamentosSalvos(lista) {
  try {
    localStorage.setItem(AGENDAMENTOS_STORAGE_KEY, JSON.stringify(lista));
  } catch (error) {
    console.error('Erro ao salvar agendamentos:', error);
    setStatus('Não foi possível salvar o agendamento no navegador.', true);
  }
}

function formatarDataBRLocal(data) {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = String(data.getFullYear());
  return `${dia}/${mes}/${ano}`;
}

function parseDataAgendada(texto) {
  if (typeof parseDataBR === 'function') {
    return parseDataBR(texto);
  }

  const valor = String(texto || '').trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(valor)) return null;

  const [dia, mes, ano] = valor.split('/').map(Number);
  const data = new Date(ano, mes - 1, dia);

  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return null;
  }

  return data;
}

function aplicarMascaraDataAgendamento(texto) {
  if (typeof aplicarMascaraData === 'function') {
    return aplicarMascaraData(texto);
  }

  const numeros = String(texto || '').replace(/\D/g, '').slice(0, 8);

  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 4) return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4, 8)}`;
}

function atualizarCamposPainelAgendamento() {
  const modo = document.getElementById('agendamentoModo')?.value || 'data_especifica';
  const wrapData = document.getElementById('agendamentoDataWrap');
  const wrapDia = document.getElementById('agendamentoDiaWrap');

  if (wrapData) {
    wrapData.style.display = modo === 'data_especifica' ? '' : 'none';
  }

  if (wrapDia) {
    wrapDia.style.display = modo === 'mes_que_vem_dia' ? '' : 'none';
  }
}

function togglePainelAgendamento() {
  const painel = document.getElementById('painelAgendamento');
  if (!painel) return;

  const aberto = painel.style.display !== 'none';
  painel.style.display = aberto ? 'none' : 'block';

  if (!aberto) {
    atualizarCamposPainelAgendamento();
    renderListaAgendamentos();
  }
}

function calcularDataAgendada() {
  const modo = document.getElementById('agendamentoModo')?.value || 'data_especifica';
  const dataTexto = document.getElementById('agendamentoData')?.value.trim() || '';
  const diaMes = Number(document.getElementById('agendamentoDiaMes')?.value || 0);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  if (modo === 'data_especifica') {
    const data = parseDataAgendada(dataTexto);
    if (!data) return '';
    return formatarDataBRLocal(data);
  }

  if (modo === 'proxima_semana') {
    const data = new Date(hoje);
    data.setDate(data.getDate() + 7);
    return formatarDataBRLocal(data);
  }

  if (modo === 'mes_que_vem_dia') {
    if (!Number.isInteger(diaMes) || diaMes < 1 || diaMes > 31) return '';

    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    const base = new Date(ano, mes, 1);
    const ultimoDia = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();

    base.setDate(Math.min(diaMes, ultimoDia));
    return formatarDataBRLocal(base);
  }

  return '';
}

function obterDadosBaseParaAgendamento() {
  if (typeof obterDadosFormulario === 'function') {
    return obterDadosFormulario();
  }

  return {
    data: '',
    tipo: document.getElementById('tipo')?.value || '',
    descricao: document.getElementById('descricao')?.value.trim() || '',
    categoria: document.getElementById('categoria')?.value.trim() || '',
    valor: document.getElementById('valor')?.value || '',
    pagamento: document.getElementById('pagamento')?.value || ''
  };
}

function salvarAgendamentoLancamento() {
  const dataAgendada = calcularDataAgendada();

  if (!dataAgendada) {
    setStatus('Informe uma data válida para o agendamento.', true);
    return;
  }

  const dadosBase = obterDadosBaseParaAgendamento();
  const novoAgendamento = {
    ...dadosBase,
    id: gerarIdAgendamento(),
    data: dataAgendada,
    criadoEm: formatarDataBRLocal(new Date())
  };

  const erros = typeof validarFormularioAvancado === 'function'
    ? validarFormularioAvancado(novoAgendamento)
    : [];

  if (erros.length) {
    setStatus(erros.join(' '), true);
    return;
  }

  const lista = obterAgendamentosSalvos();
  lista.push(novoAgendamento);
  salvarAgendamentosSalvos(lista);
  renderListaAgendamentos();
  setStatus(`Lançamento agendado para ${dataAgendada}.`);
}

function excluirAgendamento(id) {
  const lista = obterAgendamentosSalvos().filter(item => String(item.id) !== String(id));
  salvarAgendamentosSalvos(lista);
  renderListaAgendamentos();
  setStatus('Agendamento removido com sucesso.');
}

function renderListaAgendamentos() {
  const container = document.getElementById('listaAgendamentos');
  if (!container) return;

  const lista = obterAgendamentosSalvos();

  if (!lista.length) {
    container.innerHTML = `<div class="agendamento-vazio">Nenhum lançamento agendado.</div>`;
    return;
  }

  const ordenada = [...lista].sort((a, b) => {
    const dataA = parseDataAgendada(a.data);
    const dataB = parseDataAgendada(b.data);
    return dataA - dataB;
  });

  container.innerHTML = ordenada.map((item) => `
    <div class="agendamento-item">
      <div class="agendamento-item__info">
        <div class="agendamento-item__titulo">${item.descricao || 'Sem descrição'}</div>
        <div class="agendamento-item__sub">
          ${item.data} • ${item.tipo} • ${item.categoria} • ${item.valor}
        </div>
      </div>

      <button
        class="btn-danger btn-excluir-agendamento"
        type="button"
        data-id="${item.id}"
      >
        Excluir
      </button>
    </div>
  `).join('');
}

async function processarAgendamentosPendentes() {

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const lista = obterAgendamentosSalvos();
  if (!lista.length) return false;

  const restantes = [];
  let processouAlgo = false;

  for (const item of lista) {
    const dataExecucao = parseDataAgendada(item.data);

    if (!dataExecucao || dataExecucao > hoje) {
      restantes.push(item);
      continue;
    }

    try {
      await salvarLancamentoAPI({
        data: item.data,
        tipo: item.tipo,
        descricao: item.descricao,
        categoria: item.categoria,
        valor: item.valor,
        pagamento: item.pagamento
      });

      processouAlgo = true;
    } catch (error) {
      console.error('Erro ao processar agendamento:', error);
      restantes.push(item);
    }
  }

  salvarAgendamentosSalvos(restantes);
  renderListaAgendamentos();

  if (processouAlgo) {
    setStatus('Agendamentos vencidos lançados no banco.');
  }

  return processouAlgo;
}

function iniciarEdicaoLancamento(id) {
  const lancamento = lancamentos.find(item => String(item.id) === String(id));

  if (!lancamento) {
    setStatus('Não foi possível localizar o lançamento para edição.', true);
    return;
  }

  lancamentoEmEdicaoId = id;
  preencherFormularioParaEdicao(lancamento);
  atualizarTextoBotaoSalvar();
  document.body.classList.add('modo-edicao');
  renderTabela(lancamentos);
  setStatus('Modo de edição ativado. Altere os campos e clique em atualizar lançamento.');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {
  lancamentoEmEdicaoId = null;
  limparFormularioSegura();
  preencherDataAtualNoFormulario();
  atualizarTextoBotaoSalvar();
  document.body.classList.remove('modo-edicao');
  renderTabela(lancamentos);
}

async function atualizarDashboardComContas() {
  const lancamentosAnaliticos = obterLancamentosAnaliticos();

  atualizarResumo(lancamentosAnaliticos, mesDashboardSelecionado);
  atualizarControleMesDashboard(lancamentosAnaliticos, mesDashboardSelecionado);
  renderChartsMes(lancamentosAnaliticos, mesDashboardSelecionado);
  chaveDashboardRenderizada = `${revisaoDados}:${mesDashboardSelecionado}`;
}

async function atualizarTelaCompleta() {
  renderTabela(lancamentos);
  atualizarControleMesLancamentos(lancamentos, mesLancamentosSelecionado);

  if (tabAtiva === 'dashboard') {
    await atualizarDashboardComContas();
  }

  if (tabAtiva === 'comparativo') {
    await atualizarComparativoComContas(lancamentos);
    revisaoComparativoRenderizada = revisaoDados;
  }

  if (tabAtiva === 'metas' && typeof atualizarPainelMetas === 'function') {
    atualizarPainelMetas(lancamentos);
  }
}

async function mudarMesDashboard(direcao) {
  const lancamentosAnaliticos = obterLancamentosAnaliticos();
  const mesesDisponiveis = obterMesesDisponiveis(lancamentosAnaliticos);

  if (mesesDisponiveis.length === 0) return;

  const indiceAtual = mesesDisponiveis.indexOf(mesDashboardSelecionado);

  if (indiceAtual === -1) {
    mesDashboardSelecionado = mesesDisponiveis[mesesDisponiveis.length - 1];
  } else {
    const novoIndice = indiceAtual + direcao;
    if (novoIndice < 0 || novoIndice >= mesesDisponiveis.length) return;
    mesDashboardSelecionado = mesesDisponiveis[novoIndice];
  }

  await atualizarDashboardComContas();
}

function mudarMesLancamentos(direcao) {
  const mesesDisponiveis = obterMesesDisponiveis(lancamentos);
  if (mesesDisponiveis.length === 0) return;

  const indiceAtual = mesesDisponiveis.indexOf(mesLancamentosSelecionado);

  if (indiceAtual === -1) {
    mesLancamentosSelecionado = mesesDisponiveis[mesesDisponiveis.length - 1];
  } else {
    const novoIndice = indiceAtual + direcao;
    if (novoIndice < 0 || novoIndice >= mesesDisponiveis.length) return;
    mesLancamentosSelecionado = mesesDisponiveis[novoIndice];
  }
  if (typeof atualizarPainelMetas === 'function') {
    atualizarPainelMetas(lancamentos);
  }

  renderTabela(lancamentos);
  atualizarControleMesLancamentos(lancamentos, mesLancamentosSelecionado);
}

async function carregarDados() {

  try {
    setStatus('Carregando dados...');
    lancamentos = await carregarDadosAPI();
    revisaoDados += 1;
    chaveDashboardRenderizada = '';
    revisaoComparativoRenderizada = -1;

    ajustarMesDashboardSelecionado();
    ajustarMesLancamentosSelecionado();

    if (typeof inicializarFormulario === 'function') {
      inicializarFormulario(lancamentos);
    } else if (typeof atualizarSugestoesCategoria === 'function') {
      atualizarSugestoesCategoria(lancamentos);
    }

    await atualizarTelaCompleta();
    setStatus('Dados carregados com sucesso.');
  } catch (error) {
    console.error(error);
    setStatus(`Erro ao carregar dados: ${error.message}`, true);
  }
}

async function salvarLancamento() {

  const novo = obterDadosFormulario();
  const erros = validarFormularioAvancado(novo);

  if (erros.length) {
    setStatus(erros.join(' '), true);
    return;
  }

  try {
    if (lancamentoEmEdicaoId !== null) {
      setStatus('Atualizando lançamento...');

      await atualizarLancamentoAPI({
        id: lancamentoEmEdicaoId,
        ...novo
      });

      cancelarEdicao();
      await carregarDados();
      setStatus('Lançamento atualizado com sucesso.');
      return;
    }

    setStatus('Salvando lançamento...');
    await salvarLancamentoAPI(novo);
    limparFormularioSegura();
    preencherDataAtualNoFormulario();
    await carregarDados();
    setStatus('Lançamento salvo com sucesso.');
  } catch (error) {
    console.error(error);
    setStatus(`Erro ao salvar: ${error.message}`, true);
  }
}

function resetarFormulario() {
  if (lancamentoEmEdicaoId !== null) {
    cancelarEdicao();
    setStatus('Edição cancelada.');
    return;
  }

  limparFormularioSegura();
  preencherDataAtualNoFormulario();
  setStatus('Campos do formulário resetados.');
}

async function ativarTab(tabId) {
  const lancamentosAnaliticos = obterLancamentosAnaliticos();
  tabAtiva = tabId;

  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.toggle('active', tab.id === tabId);
  });

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.sidebar-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tabTarget === tabId);
  });

  if (tabId === 'dashboard') {
    const chaveAtual = `${revisaoDados}:${mesDashboardSelecionado}`;

    if (chaveDashboardRenderizada !== chaveAtual) {
      await atualizarDashboardComContas();
    }
  }

  if (tabId === 'comparativo' && revisaoComparativoRenderizada !== revisaoDados) {
    await atualizarComparativoComContas(lancamentosAnaliticos);
    revisaoComparativoRenderizada = revisaoDados;
  }

  if (tabId === 'metas' && typeof atualizarPainelMetas === 'function') {
    atualizarPainelMetas(lancamentosAnaliticos);
  }

  if (tabId === 'gastosFixos' && typeof carregarGastosFixos === 'function') {
    await carregarGastosFixos();
  }
}

function registrarEventosTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ativarTab(btn.dataset.tab);
    });
  });

  document.querySelectorAll('.sidebar-link').forEach(btn => {
    btn.addEventListener('click', () => {
      ativarTab(btn.dataset.tabTarget);
    });
  });
}

function registrarEventos() {
  const btnSalvar = document.getElementById('btnSalvar');
  const btnAtualizar = document.getElementById('btnAtualizar');
  const btnResetarFormulario = document.getElementById('btnResetarFormulario');
  const btnMesAnterior = document.getElementById('btnMesAnterior');
  const btnMesProximo = document.getElementById('btnMesProximo');
  const btnLancMesAnterior = document.getElementById('btnLancMesAnterior');
  const btnLancMesProximo = document.getElementById('btnLancMesProximo');
  const financeForm = document.getElementById('financeForm');
  const btnAgendarLancamento = document.getElementById('btnAgendarLancamento');
  const btnConfirmarAgendamento = document.getElementById('btnConfirmarAgendamento');
  const agendamentoModo = document.getElementById('agendamentoModo');
  const agendamentoData = document.getElementById('agendamentoData');
  const listaAgendamentos = document.getElementById('listaAgendamentos');

  if (btnSalvar) btnSalvar.addEventListener('click', salvarLancamento);
  if (btnAtualizar) btnAtualizar.addEventListener('click', carregarDados);
  if (btnResetarFormulario) btnResetarFormulario.addEventListener('click', resetarFormulario);
  if (btnMesAnterior) btnMesAnterior.addEventListener('click', () => mudarMesDashboard(-1));
  if (btnMesProximo) btnMesProximo.addEventListener('click', () => mudarMesDashboard(1));
  if (btnLancMesAnterior) btnLancMesAnterior.addEventListener('click', () => mudarMesLancamentos(-1));
  if (btnLancMesProximo) btnLancMesProximo.addEventListener('click', () => mudarMesLancamentos(1));

  if (btnAgendarLancamento) {
    btnAgendarLancamento.addEventListener('click', togglePainelAgendamento);
  }

  if (btnConfirmarAgendamento) {
    btnConfirmarAgendamento.addEventListener('click', salvarAgendamentoLancamento);
  }

  if (agendamentoModo) {
    agendamentoModo.addEventListener('change', atualizarCamposPainelAgendamento);
  }

  if (agendamentoData) {
    agendamentoData.addEventListener('input', (event) => {
      event.target.value = aplicarMascaraDataAgendamento(event.target.value);
    });
  }

  if (listaAgendamentos) {
    listaAgendamentos.addEventListener('click', (event) => {
      const botaoExcluir = event.target.closest('.btn-excluir-agendamento');
      if (!botaoExcluir) return;

      excluirAgendamento(botaoExcluir.dataset.id);
    });
  }

  if (financeForm) {
    financeForm.addEventListener('submit', (event) => {
      event.preventDefault();
      salvarLancamento();
    });
  }

  if (typeof filtroTipo !== 'undefined' && filtroTipo) {
    filtroTipo.addEventListener('change', () => renderTabela(lancamentos));
  }

  if (typeof filtroCategoria !== 'undefined' && filtroCategoria) {
    filtroCategoria.addEventListener('change', () => renderTabela(lancamentos));
  }

if (typeof filtroOrigem !== 'undefined' && filtroOrigem) {
  filtroOrigem.addEventListener('change', () => renderTabela(lancamentos));
}

  if (typeof financeTableBody !== 'undefined' && financeTableBody) {
    financeTableBody.addEventListener('click', async (event) => {
      const botaoEditar = event.target.closest('.btn-editar');
      if (botaoEditar) {
        iniciarEdicaoLancamento(botaoEditar.dataset.id);
        return;
      }

      const botaoExcluir = event.target.closest('.btn-excluir');
      if (!botaoExcluir) return;

      const id = botaoExcluir.dataset.id;

      if (!id) {
        setStatus('Não foi possível identificar o lançamento para excluir.', true);
        return;
      }

      const confirmar = confirm('Deseja realmente excluir este lançamento?');
      if (!confirmar) return;

      try {
        setStatus('Excluindo lançamento...');
        await excluirLancamentoAPI(id);

        if (String(lancamentoEmEdicaoId) === String(id)) {
          cancelarEdicao();
        }

        await carregarDados();

        if (typeof carregarGastosFixos === 'function') {
          await carregarGastosFixos();
        }

        setStatus('Lançamento excluído com sucesso.');
      } catch (error) {
        console.error(error);
        setStatus(`Erro ao excluir: ${error.message}`, true);
      }
    });
  }

  registrarEventosTabs();
}

document.addEventListener('DOMContentLoaded', async () => {

  const logado = await verificarLogin();

  if (!logado) {
    return;
  }

  if (typeof inicializarFormulario === 'function') {
    inicializarFormulario([]);
  }

  if (typeof inicializarPainelMetas === 'function') {
    inicializarPainelMetas([]);
  }
  if (typeof inicializarGastosFixos === 'function') {
    inicializarGastosFixos();
  }

  preencherDataAtualNoFormulario();
  atualizarTextoBotaoSalvar();
  registrarEventos();
  atualizarCamposPainelAgendamento();
  renderListaAgendamentos();
  ativarTab('lancamentos');

  await carregarDados();

  const processouAgendamentos = await processarAgendamentosPendentes();
  if (processouAgendamentos) {
    await carregarDados();
  }
});
function obterLancamentosAnaliticos() {
  return [...lancamentos];
}
