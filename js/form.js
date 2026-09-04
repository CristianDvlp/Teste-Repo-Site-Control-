/*
  Pasta: js
  Arquivo: form.js

  Formulário de lançamentos e criação de compras parceladas.
*/

const ANO_MINIMO = 2026;
const MAX_PARCELAS = 60;
const TIPOS_PAGAMENTO = ['Pix', 'Debito', 'Credito', 'Dinheiro', 'Cartão A', 'Cartão P'];
const TIPOS_LANCAMENTO = ['Receita', 'Despesa', 'Vales'];

const form = {
  get data() { return document.getElementById('data'); },
  get tipo() { return document.getElementById('tipo'); },
  get descricao() { return document.getElementById('descricao'); },
  get categoria() { return document.getElementById('categoria'); },
  get valor() { return document.getElementById('valor'); },
  get pagamento() { return document.getElementById('pagamento'); },
  get categoriaSugestoes() { return document.getElementById('categoriaSugestoes'); },
  get parcelado() { return document.getElementById('parcelado'); },
  get totalParcelas() { return document.getElementById('totalParcelas'); },
  get modoParcelas() { return document.getElementById('modoParcelas'); },
  get parcelamentoPainel() { return document.getElementById('parcelamentoPainel'); },
  get parcelasPreview() { return document.getElementById('parcelasPreview'); },
  get parcelasResumo() { return document.getElementById('parcelasResumo'); },
  get valorLabelText() { return document.getElementById('valorLabelText'); },
  get dataLabelText() { return document.getElementById('dataLabelText'); },
  get financeForm() { return document.getElementById('financeForm'); }
};

function normalizarTextoCategoria(texto) {
  return String(texto || '')
    .replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function categoriaValida(categoria) {
  return /^[A-Za-zÀ-ÖØ-öø-ÿ\s]+$/.test(categoria);
}

function formatarCategoriaVisual(texto) {
  return normalizarTextoCategoria(texto)
    .toLowerCase()
    .replace(/\b\p{L}/gu, letra => letra.toUpperCase());
}

function criarOuAjustarCampoPagamento() {
  const campoAtual = form.pagamento;
  if (!campoAtual) return;

  const opcoes = `
    <option value="">Selecione</option>
    <option value="Pix">Pix</option>
    <option value="Debito">Debito</option>
    <option value="Dinheiro">Dinheiro</option>
    <option value="Credito">Credito</option>
    <option value="Cartão A">Cartão A</option>
    <option value="Cartão P">Cartão P</option>
  `;

  if (campoAtual.tagName === 'SELECT') {
    campoAtual.innerHTML = opcoes;
    return;
  }

  const select = document.createElement('select');
  select.id = 'pagamento';
  select.required = true;
  select.innerHTML = opcoes;
  campoAtual.replaceWith(select);
}

function aplicarMascaraData(texto) {
  const numeros = String(texto || '').replace(/\D/g, '').slice(0, 8);
  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 4) return `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
  return `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4, 8)}`;
}

function parseDataBR(dataTexto) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(dataTexto || '').trim())) return null;

  const [dia, mes, ano] = String(dataTexto).split('/').map(Number);
  if (ano < ANO_MINIMO || mes < 1 || mes > 12) return null;

  const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
  if (dia < 1 || dia > ultimoDiaDoMes) return null;

  const data = new Date(ano, mes - 1, dia);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  return data;
}

function dataValida(dataTexto) {
  return !!parseDataBR(String(dataTexto || '').trim());
}

function formatarDataBRFormulario(data) {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

function adicionarMesesMantendoDia(dataBase, quantidadeMeses) {
  const diaOriginal = dataBase.getDate();
  const primeiroDiaDestino = new Date(dataBase.getFullYear(), dataBase.getMonth() + quantidadeMeses, 1);
  const ultimoDiaDestino = new Date(
    primeiroDiaDestino.getFullYear(),
    primeiroDiaDestino.getMonth() + 1,
    0
  ).getDate();

  primeiroDiaDestino.setDate(Math.min(diaOriginal, ultimoDiaDestino));
  return primeiroDiaDestino;
}

function configurarCampoData() {
  if (!form.data || form.data.dataset.configurado) return;

  form.data.addEventListener('input', (event) => {
    event.target.value = aplicarMascaraData(event.target.value);
  });

  form.data.addEventListener('blur', () => {
    const valor = form.data.value.trim();
    if (!valor) return;

    if (!dataValida(valor)) {
      setStatus(`Digite uma data válida no formato dd/mm/aaaa com ano a partir de ${ANO_MINIMO}.`, true);
      form.data.focus();
      return;
    }

    if (form.parcelado?.checked) renderizarParcelasPreview();
  });

  form.data.dataset.configurado = 'true';
}

function configurarCampoCategoria() {
  if (!form.categoria || form.categoria.dataset.configurado) return;

  form.categoria.setAttribute('autocomplete', 'off');
  form.categoria.addEventListener('input', (event) => {
    const valorLimpo = normalizarTextoCategoria(event.target.value);
    if (event.target.value !== valorLimpo) event.target.value = valorLimpo;
  });
  form.categoria.addEventListener('blur', () => {
    form.categoria.value = formatarCategoriaVisual(form.categoria.value);
  });
  form.categoria.dataset.configurado = 'true';
}

function formatarMoedaDigitada(texto) {
  const apenasDigitos = String(texto || '').replace(/\D/g, '');
  if (!apenasDigitos) return '';
  return formatarMoeda(Number(apenasDigitos) / 100);
}

function configurarCampoValor() {
  if (!form.valor || form.valor.dataset.configurado) return;

  form.valor.addEventListener('input', (event) => {
    event.target.value = formatarMoedaDigitada(event.target.value);
  });

  form.valor.addEventListener('blur', () => {
    const valorNumerico = converterValor(form.valor.value);
    form.valor.value = valorNumerico > 0 ? formatarMoeda(valorNumerico) : '';
    if (form.parcelado?.checked) renderizarParcelasPreview();
  });

  form.valor.dataset.configurado = 'true';
}

function gerarValoresIguais(valorTotal, quantidade) {
  const totalCentavos = Math.round(Number(valorTotal) * 100);
  const base = Math.floor(totalCentavos / quantidade);
  const resto = totalCentavos - (base * quantidade);

  return Array.from({ length: quantidade }, (_, indice) => (
    (base + (indice < resto ? 1 : 0)) / 100
  ));
}

function obterParcelasAtuaisDoPreview() {
  if (!form.parcelasPreview) return [];

  return Array.from(form.parcelasPreview.querySelectorAll('.parcela-preview-row')).map((linha, indice) => ({
    parcelaAtual: indice + 1,
    data: linha.querySelector('.parcela-data')?.value || '',
    valor: converterValor(linha.querySelector('.parcela-valor')?.value || 0),
    paga: !!linha.querySelector('.parcela-paga')?.checked
  }));
}

function atualizarResumoParcelasPreview() {
  if (!form.parcelasResumo) return;

  const valorTotal = converterValor(form.valor?.value || 0);
  const parcelas = obterParcelasAtuaisDoPreview();
  const soma = parcelas.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  const pagas = parcelas.filter(item => item.paga).reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
  const diferenca = Math.round((soma - valorTotal) * 100) / 100;
  const ok = parcelas.length > 0 && Math.abs(diferenca) <= 0.01;

  form.parcelasResumo.innerHTML = `
    <div><span>Total da compra</span><strong>${formatarMoeda(valorTotal || 0)}</strong></div>
    <div><span>Soma das parcelas</span><strong>${formatarMoeda(soma)}</strong></div>
    <div><span>Já marcado como pago</span><strong>${formatarMoeda(pagas)}</strong></div>
    <div class="parcelas-diferenca ${ok ? 'ok' : 'erro'}">
      <span>${ok ? 'Valores conferem' : 'Diferença'}</span>
      <strong>${ok ? '✓' : formatarMoeda(Math.abs(diferenca))}</strong>
    </div>
  `;
}

function renderizarParcelasPreview() {
  if (!form.parcelasPreview || !form.parcelado?.checked) return;

  const quantidade = Number(form.totalParcelas?.value || 0);
  const valorTotal = converterValor(form.valor?.value || 0);
  const dataInicial = parseDataBR(form.data?.value || '');
  const modo = form.modoParcelas?.value || 'iguais';
  const anteriores = obterParcelasAtuaisDoPreview();
  const dataBaseAlterada = anteriores.length > 0 && String(anteriores[0]?.data || '') !== String(form.data?.value || '');

  if (!Number.isInteger(quantidade) || quantidade < 2 || quantidade > MAX_PARCELAS || !(valorTotal > 0) || !dataInicial) {
    form.parcelasPreview.innerHTML = `
      <div class="parcelamento-placeholder">
        Informe o valor total, o vencimento da 1ª parcela e a quantidade para gerar as parcelas.
      </div>
    `;
    if (form.parcelasResumo) form.parcelasResumo.innerHTML = '';
    return;
  }

  const valoresIguais = gerarValoresIguais(valorTotal, quantidade);
  const linhas = [];

  for (let indice = 0; indice < quantidade; indice += 1) {
    const anterior = anteriores[indice];
    const dataPadrao = formatarDataBRFormulario(adicionarMesesMantendoDia(dataInicial, indice));
    const dataParcela = !dataBaseAlterada && anterior?.data && dataValida(anterior.data) ? anterior.data : dataPadrao;
    const valorParcela = modo === 'personalizadas' && anterior && anterior.valor > 0
      ? anterior.valor
      : valoresIguais[indice];
    const paga = anterior?.paga || false;

    linhas.push(`
      <div class="parcela-preview-row" data-parcela="${indice + 1}">
        <div class="parcela-numero">${indice + 1}/${quantidade}</div>
        <label>
          <span>Vencimento</span>
          <input class="parcela-data" type="text" inputmode="numeric" maxlength="10" value="${dataParcela}" aria-label="Vencimento parcela ${indice + 1}" />
        </label>
        <label>
          <span>Valor</span>
          <input class="parcela-valor" type="text" inputmode="decimal" value="${formatarMoeda(valorParcela)}" ${modo === 'iguais' ? 'readonly' : ''} aria-label="Valor parcela ${indice + 1}" />
        </label>
        <label class="parcela-status-check">
          <span>Status</span>
          <span class="parcela-check-wrap">
            <input class="parcela-paga" type="checkbox" ${paga ? 'checked' : ''} />
            <span>Pago</span>
          </span>
        </label>
      </div>
    `);
  }

  form.parcelasPreview.innerHTML = linhas.join('');
  atualizarResumoParcelasPreview();
}

function configurarEventosPreviewParcelas() {
  if (!form.parcelasPreview || form.parcelasPreview.dataset.configurado) return;

  form.parcelasPreview.addEventListener('input', (event) => {
    if (event.target.classList.contains('parcela-data')) {
      event.target.value = aplicarMascaraData(event.target.value);
    }
    atualizarResumoParcelasPreview();
  });

  form.parcelasPreview.addEventListener('blur', (event) => {
    if (event.target.classList.contains('parcela-valor')) {
      const valor = converterValor(event.target.value);
      event.target.value = valor > 0 ? formatarMoeda(valor) : '';
      atualizarResumoParcelasPreview();
    }
  }, true);

  form.parcelasPreview.addEventListener('change', atualizarResumoParcelasPreview);
  form.parcelasPreview.dataset.configurado = 'true';
}

function atualizarCamposParcelamento() {
  const parcelado = !!form.parcelado?.checked;

  if (form.parcelamentoPainel) form.parcelamentoPainel.hidden = !parcelado;
  if (form.totalParcelas) form.totalParcelas.required = parcelado;
  if (form.modoParcelas) form.modoParcelas.required = parcelado;
  if (form.valorLabelText) form.valorLabelText.textContent = parcelado ? 'Valor total da compra' : 'Valor';
  if (form.dataLabelText) form.dataLabelText.textContent = parcelado ? 'Vencimento da 1ª parcela' : 'Data';

  if (form.tipo) {
    if (parcelado) form.tipo.value = 'Despesa';
    form.tipo.disabled = parcelado;
  }

  const btnAgendar = document.getElementById('btnAgendarLancamento');
  if (btnAgendar) {
    btnAgendar.disabled = parcelado;
    btnAgendar.title = parcelado ? 'Compras parceladas já geram os lançamentos futuros automaticamente.' : '';
  }

  if (!parcelado) {
    if (form.totalParcelas) form.totalParcelas.value = '';
    if (form.modoParcelas) form.modoParcelas.value = 'iguais';
    if (form.parcelasPreview) form.parcelasPreview.innerHTML = '';
    if (form.parcelasResumo) form.parcelasResumo.innerHTML = '';
    return;
  }

  renderizarParcelasPreview();
}

function configurarParcelamento() {
  if (!form.parcelado || form.parcelado.dataset.configurado) return;

  form.parcelado.addEventListener('change', atualizarCamposParcelamento);
  form.totalParcelas?.addEventListener('input', renderizarParcelasPreview);
  form.modoParcelas?.addEventListener('change', renderizarParcelasPreview);
  configurarEventosPreviewParcelas();

  form.parcelado.dataset.configurado = 'true';
  atualizarCamposParcelamento();
}

function atualizarSugestoesCategoria(lancamentos = []) {
  if (!form.categoriaSugestoes) return;

  const categorias = Array.from(new Set(
    lancamentos
      .map(item => formatarCategoriaVisual(item.categoria))
      .filter(categoria => categoria && categoriaValida(categoria))
  )).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  form.categoriaSugestoes.innerHTML = categorias
    .map(categoria => `<option value="${categoria}"></option>`)
    .join('');
}

function inicializarFormulario(lancamentos = []) {
  criarOuAjustarCampoPagamento();
  configurarCampoData();
  configurarCampoCategoria();
  configurarCampoValor();
  configurarParcelamento();
  atualizarSugestoesCategoria(lancamentos);
}

function preencherFormularioParaEdicao(lancamento) {
  if (!lancamento) return;

  const tipoNormalizado = normalizarTipoLancamento(obterTipoLancamento(lancamento) || lancamento.tipo);

  form.data.value = formatarDataParaTela(lancamento.data);
  form.tipo.disabled = false;
  form.tipo.value = tipoNormalizado;
  form.descricao.value = lancamento.descricao || '';
  form.categoria.value = lancamento.categoria || '';
  form.valor.value = formatarMoeda(obterValorAbsoluto(lancamento));
  form.pagamento.value = normalizarPagamento(lancamento.pagamento || '');
  if (form.parcelado) form.parcelado.checked = false;
  atualizarCamposParcelamento();
}

function normalizarTextoSemAcento(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizarTipoLancamento(tipo) {
  const valor = normalizarTextoSemAcento(tipo);
  const mapa = { receita: 'Receita', despesa: 'Despesa', vales: 'Vales', vale: 'Vales' };
  return mapa[valor] || '';
}

function normalizarPagamento(pagamento) {
  const valor = normalizarTextoSemAcento(pagamento);
  const mapa = {
    pix: 'Pix',
    debito: 'Debito',
    dinheiro: 'Dinheiro',
    credito: 'Credito',
    'cartao a': 'Cartão A',
    'cartao p': 'Cartão P'
  };
  return mapa[valor] || String(pagamento || '').trim();
}

function obterDadosFormulario() {
  const categoria = formatarCategoriaVisual(form.categoria.value);
  const valorNumerico = converterValor(form.valor.value);
  const pagamento = normalizarPagamento(form.pagamento.value);
  const tipo = normalizarTipoLancamento(form.tipo.value);
  const data = String(form.data.value || '').trim();
  const descricao = String(form.descricao.value || '').trim();
  const parcelado = !!form.parcelado?.checked;
  const totalParcelas = parcelado ? Number(form.totalParcelas?.value || 0) : null;
  const modoParcelas = parcelado ? (form.modoParcelas?.value || 'iguais') : null;
  const parcelas = parcelado ? obterParcelasAtuaisDoPreview() : [];

  return {
    data,
    tipo,
    descricao,
    categoria,
    valor: valorNumerico,
    pagamento,
    parcelado,
    valorTotalCompra: parcelado ? valorNumerico : null,
    totalParcelas,
    modoParcelas,
    parcelas
  };
}

function validarFormulario(novo) {
  return validarFormularioAvancado(novo).length === 0;
}

function validarFormularioAvancado(novo) {
  const erros = [];

  if (!novo.data || !dataValida(novo.data)) {
    erros.push(`Data inválida. Use dd/mm/aaaa com ano a partir de ${ANO_MINIMO}.`);
  }
  if (!novo.tipo || !TIPOS_LANCAMENTO.includes(novo.tipo)) erros.push('Tipo de lançamento inválido.');
  if (!novo.categoria || !categoriaValida(novo.categoria)) erros.push('Categoria obrigatória e somente com letras.');
  if (!(novo.valor > 0)) erros.push('Informe um valor maior que zero.');
  if (!TIPOS_PAGAMENTO.includes(novo.pagamento)) erros.push('Tipo de pagamento inválido.');

  if (novo.parcelado) {
    if (novo.tipo !== 'Despesa') erros.push('Compra parcelada deve ser uma despesa.');
    if (!Number.isInteger(novo.totalParcelas) || novo.totalParcelas < 2 || novo.totalParcelas > MAX_PARCELAS) {
      erros.push(`Informe entre 2 e ${MAX_PARCELAS} parcelas.`);
    }

    if (!Array.isArray(novo.parcelas) || novo.parcelas.length !== novo.totalParcelas) {
      erros.push('Gere todas as parcelas antes de salvar.');
    } else {
      novo.parcelas.forEach((parcela, indice) => {
        if (!dataValida(parcela.data)) erros.push(`Data inválida na parcela ${indice + 1}.`);
        if (!(Number(parcela.valor) > 0)) erros.push(`Valor inválido na parcela ${indice + 1}.`);
      });

      const soma = novo.parcelas.reduce((acc, parcela) => acc + (Number(parcela.valor) || 0), 0);
      if (Math.abs(soma - novo.valorTotalCompra) > 0.01) {
        erros.push('A soma das parcelas precisa ser igual ao valor total da compra.');
      }
    }
  }

  return [...new Set(erros)];
}

function limparFormulario() {
  if (form.financeForm) form.financeForm.reset();

  if (form.data) form.data.value = '';
  if (form.tipo) {
    form.tipo.disabled = false;
    form.tipo.value = 'Receita';
  }
  if (form.descricao) form.descricao.value = '';
  if (form.categoria) form.categoria.value = '';
  if (form.valor) form.valor.value = '';
  if (form.pagamento) form.pagamento.value = '';
  if (form.parcelado) form.parcelado.checked = false;
  if (form.totalParcelas) form.totalParcelas.value = '';
  if (form.modoParcelas) form.modoParcelas.value = 'iguais';
  if (form.parcelasPreview) form.parcelasPreview.innerHTML = '';
  if (form.parcelasResumo) form.parcelasResumo.innerHTML = '';
  atualizarCamposParcelamento();
}
