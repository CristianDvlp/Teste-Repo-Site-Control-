/*
  Pasta: js
  Arquivo: ui.js

  Interface visual.
*/
const financeTableBody = document.getElementById('financeTableBody');
const filtroTipo = document.getElementById('filtroTipo');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroOrigem = document.getElementById('filtroOrigem');
const statusBox = document.getElementById('statusBox');

function setStatus(msg, isError = false) {
  if (!statusBox) return;

  statusBox.textContent = msg;
  statusBox.style.background = isError ? '#fee2e2' : '#dcfce7';
  statusBox.style.color = isError ? '#991b1b' : '#166534';

  clearTimeout(statusBox._timer);
  statusBox._timer = setTimeout(() => {
    if (statusBox.textContent === msg) {
      statusBox.textContent = '';
    }
  }, 4000);
}

function formatarTextoPadrao(texto) {
  const valor = String(texto || '').trim();

  if (!valor) {
    return '-';
  }

  return valor
    .toLowerCase()
    .split(/\s+/)
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ');
}

function formatarTipoVisual(tipo) {
  const tipoNormalizado = String(tipo || '').trim().toUpperCase();

  if (tipoNormalizado === 'VALES' || tipoNormalizado === 'VALE') return 'Vales';
  if (tipoNormalizado === 'RECEITA') return 'Receita';
  if (tipoNormalizado === 'DESPESA') return 'Despesa';

  return formatarTextoPadrao(tipo);
}

function atualizarFiltroCategorias(lancamentos) {
  if (!filtroCategoria) return;

  const valorAtual = filtroCategoria.value;

  const categorias = Array.from(
    new Set(
      lancamentos
        .map(item => String(item.categoria || '').trim())
        .filter(Boolean)
        .map(categoria => formatarTextoPadrao(categoria))
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  filtroCategoria.innerHTML = `
    <option value="">Todas</option>
    ${categorias.map(categoria => `<option value="${categoria}">${categoria}</option>`).join('')}
  `;

  filtroCategoria.value = categorias.includes(valorAtual) ? valorAtual : '';
}

function obterLancamentosFiltrados(lancamentos) {
  const tipo = filtroTipo ? filtroTipo.value : 'Todos';
  const categoriaSelecionada = filtroCategoria ? filtroCategoria.value : '';
  const origemSelecionada = filtroOrigem ? filtroOrigem.value : '';

  const dadosMes = typeof mesLancamentosSelecionado !== 'undefined' && mesLancamentosSelecionado
    ? filtrarLancamentosPorMes(lancamentos, mesLancamentosSelecionado)
    : [...lancamentos];

  return dadosMes.filter(item => {
    const tipoItem = obterTipoLancamento(item);
    const categoriaItem = formatarTextoPadrao(item.categoria);

    const origemItem = String(item.origem || 'site')
      .trim()
      .toLowerCase();

    const okTipo = tipo === 'Todos' || tipoItem === tipo;
    const okCategoria = !categoriaSelecionada || categoriaItem === categoriaSelecionada;

const origensManuais = ['site', 'planilha', 'manual'];

const okOrigem =
  !origemSelecionada ||
  (origemSelecionada === 'manual' && origensManuais.includes(origemItem)) ||
  (origemSelecionada === 'gasto_fixo' && origemItem === 'gasto_fixo');

    return okTipo && okCategoria && okOrigem;
  });
}

function renderTabela(lancamentos) {
  const dadosBase = typeof mesLancamentosSelecionado !== 'undefined' && mesLancamentosSelecionado
    ? filtrarLancamentosPorMes(lancamentos, mesLancamentosSelecionado)
    : [...lancamentos];

  atualizarFiltroCategorias(dadosBase);

  const dados = obterLancamentosFiltrados(lancamentos);
  financeTableBody.innerHTML = '';

  if (dados.length === 0) {
    financeTableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; color:#6b7280;">
          Nenhum lançamento encontrado.
        </td>
      </tr>
    `;
    return;
  }

  const fragmento = document.createDocumentFragment();

  dados
    .sort((a, b) => normalizarDataParaOrdenacao(a.data) - normalizarDataParaOrdenacao(b.data))
    .forEach(item => {
      const identificador = item.id ?? item.ID ?? item.Id ?? item.indice ?? '';
      const tipo = formatarTipoVisual(obterTipoLancamento(item));
      const descricao = formatarTextoPadrao(item.descricao);
      const categoria = formatarTextoPadrao(item.categoria);
      const pagamento = formatarTextoPadrao(item.pagamento);
      const parcela = item.parcelado && item.parcelaAtual && item.totalParcelas
        ? `${item.parcelaAtual}/${item.totalParcelas}`
        : '—';
      const statusParcela = item.parcelado
        ? (item.parcelaPaga ? '<span class="status-parcela pago">Pago</span>' : '<span class="status-parcela pendente">Pendente</span>')
        : '—';
      const ehParcelamentoGerenciado = !!(item.parcelado && item.grupoParcelamento);
      const estaEditando = typeof lancamentoEmEdicaoId !== 'undefined' &&
        String(lancamentoEmEdicaoId) === String(identificador);

      const tr = document.createElement('tr');

      if (identificador === '') {
        console.warn('Lançamento sem id:', item);
      }

      if (estaEditando) {
        tr.classList.add('linha-editando');
      }

      tr.innerHTML = `
        <td>${formatarDataParaTela(item.data)}</td>
        <td>${tipo}</td>
        <td>${descricao}</td>
        <td>${categoria}</td>
        <td>${formatarMoeda(obterValorAbsoluto(item))}</td>
        <td>${pagamento}</td>
        <td><span class="parcela-badge${item.parcelado ? ' ativa' : ''}">${parcela}</span></td>
        <td>${statusParcela}</td>
        <td>
          <div class="acoes-linha">
            ${ehParcelamentoGerenciado
              ? `<button class="btn-primary btn-gerenciar-parcelamento" data-grupo="${item.grupoParcelamento}" type="button">Gerenciar</button>`
              : `<button class="btn-warning btn-editar" data-id="${identificador}" type="button">Editar</button>
                 <button class="btn-danger btn-excluir" data-id="${identificador}" type="button">Excluir</button>`}
          </div>
        </td>
      `;
      fragmento.appendChild(tr);
    });

  financeTableBody.appendChild(fragmento);
}

function atualizarResumo(lancamentos, mesSelecionado = '') {
  const dadosDashboard = lancamentos.filter(item => !categoriaIgnoradaNoDashboard(item));
  const dadosMes = filtrarLancamentosPorMes(dadosDashboard, mesSelecionado);

  const receitas = dadosMes
    .filter(item => obterTipoLancamento(item) === 'Receita')
    .reduce((acc, item) => acc + obterValorAbsoluto(item), 0);

  const despesas = dadosMes
    .filter(item => obterTipoLancamento(item) === 'Despesa')
    .reduce((acc, item) => acc + obterValorAbsoluto(item), 0);

  const Vales = dadosMes
    .filter(item => obterTipoLancamento(item) === 'Vales')
    .reduce((acc, item) => acc + obterValorAbsoluto(item), 0);

  const saldo = receitas - despesas;

  const campoReceitas = document.getElementById('totalReceitas');
  const campoDespesas = document.getElementById('totalDespesas');
  const campoVales = document.getElementById('resumoVales');
  const campoSaldo = document.getElementById('saldoFinal');

  if (campoReceitas) campoReceitas.textContent = formatarMoeda(receitas);
  if (campoDespesas) campoDespesas.textContent = formatarMoeda(despesas);
  if (campoVales) campoVales.textContent = formatarMoeda(Vales);
  if (campoSaldo) campoSaldo.textContent = formatarMoeda(saldo);
}

function atualizarResumoComparativo(lancamentos, contasPorMes = {}) {
  const dadosDashboard = lancamentos
  .filter(item => !categoriaIgnoradaNoDashboard(item))
  .filter(item => dataAteHoje(item.data));

  const saldoInicial = dadosDashboard
    .filter(ehSaldoInicial)
    .reduce((acc, item) => acc + obterValorAbsoluto(item), 0);

  const receitas = dadosDashboard
    .filter(item =>
      obterTipoLancamento(item) === "Receita" &&
      !ehSaldoInicial(item)
    )
    .reduce((acc, item) => acc + obterValorAbsoluto(item), 0);

  const despesasLancamentos = dadosDashboard
    .filter(item => obterTipoLancamento(item) === "Despesa")
    .reduce((acc, item) => acc + obterValorAbsoluto(item), 0);

const despesas = despesasLancamentos;

  const Vales = dadosDashboard
    .filter(item => obterTipoLancamento(item) === "Vales")
    .reduce((acc, item) => acc + obterValorAbsoluto(item), 0);

const saldo = saldoInicial + receitas - despesas;

  const campoReceitas = document.getElementById("comparativoReceitasTotal");
  const campoDespesas = document.getElementById("comparativoDespesasTotal");
  const campoVales = document.getElementById("comparativoValesTotal");
  const campoSaldo = document.getElementById("comparativoSaldoTotal");

  if (campoReceitas) campoReceitas.textContent = formatarMoeda(receitas);
  if (campoDespesas) campoDespesas.textContent = formatarMoeda(despesas);
  if (campoVales) campoVales.textContent = formatarMoeda(Vales);
  if (campoSaldo) campoSaldo.textContent = formatarMoeda(saldo);
}

function dataAteHoje(data) {
  const dataObj = normalizarDataParaOrdenacao(data);

  if (!(dataObj instanceof Date) || Number.isNaN(dataObj.getTime())) {
    return false;
  }

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  return dataObj <= hoje;
}

async function atualizarComparativoComContas(lancamentos) {
  atualizarResumoComparativo(lancamentos, {});
  renderChartsComparativo(lancamentos, {});
}

function atualizarControleMesDashboard(lancamentos, mesSelecionado = '') {
  const mesesDisponiveis = obterMesesDisponiveis(lancamentos);
  const indiceAtual = mesesDisponiveis.indexOf(mesSelecionado);

  const label = document.getElementById('mesAtualDashboard');
  const btnAnterior = document.getElementById('btnMesAnterior');
  const btnProximo = document.getElementById('btnMesProximo');

  if (!label || !btnAnterior || !btnProximo) return;

  label.textContent = mesSelecionado || 'Sem mês';
  btnAnterior.disabled = indiceAtual <= 0;
  btnProximo.disabled = indiceAtual === -1 || indiceAtual >= mesesDisponiveis.length - 1;
}

function atualizarControleMesLancamentos(lancamentos, mesSelecionado = '') {
  const mesesDisponiveis = obterMesesDisponiveis(lancamentos);
  const indiceAtual = mesesDisponiveis.indexOf(mesSelecionado);

  const label = document.getElementById('mesAtualLancamentos');
  const btnAnterior = document.getElementById('btnLancMesAnterior');
  const btnProximo = document.getElementById('btnLancMesProximo');

  if (!label || !btnAnterior || !btnProximo) return;

  label.textContent = mesSelecionado || 'Todos';

  if (!mesSelecionado) {
    btnAnterior.disabled = mesesDisponiveis.length === 0;
    btnProximo.disabled = true;
    return;
  }

  btnAnterior.disabled = indiceAtual <= 0;
  btnProximo.disabled = indiceAtual === -1 || indiceAtual >= mesesDisponiveis.length - 1;
}
