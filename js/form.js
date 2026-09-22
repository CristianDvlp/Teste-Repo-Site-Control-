/*
  Pasta: js
  Arquivo: form.js

  Formulário de lançamentos.
*/

const ANO_MINIMO = 2026;
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

function opcoesPagamentoExistentes() {
  return [...new Set([...TIPOS_PAGAMENTO,
    ...(typeof lancamentos !== 'undefined' ? lancamentos.map(i=>normalizarPagamento(i.pagamento)) : [])].filter(Boolean))];
}
function completarOpcoesPagamento(campo) {
  for (const nome of opcoesPagamentoExistentes()) {
    if (![...campo.options].some(o=>o.value===nome)) campo.add(new Option(nome,nome));
  }
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
    completarOpcoesPagamento(campoAtual);
    return;
  }

  const select = document.createElement('select');
  select.id = 'pagamento';
  select.required = true;
  select.innerHTML = opcoes;
  campoAtual.replaceWith(select);
  completarOpcoesPagamento(select);
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
  });

  form.valor.dataset.configurado = 'true';
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
  atualizarSugestoesCategoria(lancamentos.filter(lancamentoVisivel));
}

function preencherFormularioParaEdicao(lancamento) {
  if (!lancamento) return;

  const tipoNormalizado = normalizarTipoLancamento(obterTipoLancamento(lancamento) || lancamento.tipo);

  form.data.value = formatarDataParaTela(lancamento.data);
  form.tipo.disabled = false;
  form.pagamento.disabled = false;
  form.tipo.value = tipoNormalizado;
  form.descricao.value = lancamento.descricao || '';
  form.categoria.value = lancamento.categoria || '';
  form.valor.value = formatarMoeda(obterValorAbsoluto(lancamento));
  const pagamento = normalizarPagamento(lancamento.pagamento || '');
  if (pagamento && ![...form.pagamento.options].some(o=>o.value===pagamento)) form.pagamento.add(new Option(pagamento,pagamento));
  form.pagamento.value = pagamento;
  if (lancamento.cartao || lancamento.origem === 'cartao') { form.tipo.disabled=true; form.pagamento.disabled=true; }
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
  return {
    data,
    tipo,
    descricao,
    categoria,
    valor: valorNumerico,
    pagamento
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
  if (!novo.tipo || !TIPOS_LANCAMENTO.includes(novo.tipo) || (!valesAtivos() && novo.tipo === 'Vales')) erros.push('Tipo de lançamento inválido.');
  if (!novo.categoria || !categoriaValida(novo.categoria)) erros.push('Categoria obrigatória e somente com letras.');
  if (!(novo.valor > 0)) erros.push('Informe um valor maior que zero.');
  if (!opcoesPagamentoExistentes().includes(novo.pagamento)) erros.push('Tipo de pagamento inválido.');

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
  if (form.pagamento) { form.pagamento.value = ''; form.pagamento.disabled = false; }
}
