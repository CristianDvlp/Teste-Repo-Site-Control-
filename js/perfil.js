/* Resumo somente de leitura: reutiliza os dados autenticados já carregados. */
let perfilDados = [];
let perfilEstado = 'carregando';
let perfilOculto = true;
const perfilCatalogo = [
  ['resultado', 'Resultado do período', 'Ganhos realizados menos despesas realizadas.', 'Valores', true],
  ['ganhos', 'Total de ganhos realizados', 'Receitas no período selecionado.', 'Valores', true],
  ['gastos', 'Total de despesas realizadas', 'Despesas no período selecionado.', 'Valores', true],
  ['vales', 'Vales', 'Valor separado dos ganhos e despesas.', 'Valores', true],
  ['mediaDespesa', 'Média por despesa', 'Total de despesas dividido pela quantidade de despesas realizadas.', 'Valores', false],
  ['maiorDespesa', 'Maior despesa', 'Valor e categoria do maior registro de despesa realizado.', 'Valores', false],
  ['maiorGanho', 'Maior ganho', 'Valor do maior registro de receita realizado.', 'Valores', false],
  ['percentualGasto', 'Percentual dos ganhos gasto', 'Despesas realizadas divididas pelos ganhos realizados.', 'Valores', false],
  ['quantidade', 'Lançamentos no período', 'Quantidade de registros no período.', 'Atividade', true],
  ['historico', 'Lançamentos no histórico', 'Todos os registros existentes com data até hoje, independentemente do filtro.', 'Atividade', false],
  ['realizados', 'Lançamentos realizados', 'Quantidade de registros considerados pagos ou recebidos.', 'Atividade', false],
  ['qtdDespesas', 'Quantidade de despesas realizadas', 'Número de despesas realizadas no período.', 'Atividade', false],
  ['qtdGanhos', 'Quantidade de ganhos realizados', 'Número de receitas realizadas no período.', 'Atividade', false],
  ['categoria', 'Categoria com maior despesa', 'Categoria com o maior total de despesas realizadas.', 'Hábitos e datas', true],
  ['pagamento', 'Forma de pagamento mais usada', 'Forma mais frequente entre as despesas realizadas; empates exibem todas.', 'Hábitos e datas', false],
  ['ultimo', 'Data mais recente no período', 'Data do lançamento, não a data de cadastro.', 'Hábitos e datas', true],
  ['comparacao', 'Comparação com o mês anterior', 'Disponível em Este mês: despesas até hoje versus o mês anterior completo.', 'Hábitos e datas', true]
];
const perfilPadrao = () => perfilCatalogo.filter(item => item[4]).map(item => item[0]);
let perfilSelecionados = perfilPadrao();

function carregarOpcoesPerfil() {
  const salvo = preferenciasBanco.perfilIndicadores;
  perfilSelecionados = Array.isArray(salvo) ? perfilCatalogo.filter(item => salvo.includes(item[0])).map(item => item[0]) : perfilPadrao();
}

function fecharEditorPerfil() {
  document.getElementById('perfilEditor').hidden = true;
  document.getElementById('perfilPersonalizar').setAttribute('aria-expanded', 'false');
}

function abrirEditorPerfil() {
  const editor = document.getElementById('perfilEditor');
  if (!editor.hidden) { fecharEditorPerfil(); return; }
  const opcoes = document.getElementById('perfilOpcoes');
  opcoes.replaceChildren();
  const grupos = new Map();
  perfilCatalogo.forEach(([id, titulo, descricao, grupo]) => {
    if (!grupos.has(grupo)) {
      const fieldset = document.createElement('fieldset');
      const legend = document.createElement('legend');
      legend.textContent = grupo;
      fieldset.appendChild(legend);
      opcoes.appendChild(fieldset);
      grupos.set(grupo, fieldset);
    }
    const label = document.createElement('label');
    label.className = 'perfil-opcao';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = id;
    input.checked = perfilSelecionados.includes(id);
    const texto = document.createElement('span');
    const nome = document.createElement('strong');
    nome.textContent = titulo;
    const ajuda = document.createElement('small');
    ajuda.textContent = descricao;
    texto.appendChild(nome);
    texto.appendChild(ajuda);
    label.appendChild(input);
    label.appendChild(texto);
    grupos.get(grupo).appendChild(label);
  });
  document.getElementById('perfilPreferenciasStatus').textContent = '';
  editor.hidden = false;
  document.getElementById('perfilPersonalizar').setAttribute('aria-expanded', 'true');
  opcoes.querySelector('input').focus();
}

function marcarOpcoesPerfil(ids) {
  document.querySelectorAll('#perfilOpcoes input').forEach(input => { input.checked = ids.includes(input.value); });
}

async function salvarOpcoesPerfil() {
  const ids = [...document.querySelectorAll('#perfilOpcoes input:checked')].map(input => input.value);
  const botao = document.getElementById('perfilSalvar');
  botao.disabled = true;
  try {
    await salvarPreferenciaBanco('perfilIndicadores', ids);
    perfilSelecionados = ids;
    fecharEditorPerfil();
    renderResumoPerfil();
    document.getElementById('perfilPreferenciasStatus').textContent = 'Preferências salvas na sua conta.';
  } catch (e) { document.getElementById('perfilPreferenciasStatus').textContent = 'Não foi possível salvar: ' + e.message; }
  finally { botao.disabled = false; }
}

function fecharMenuPerfil() {
  document.getElementById('menuUsuario').style.display = 'none';
  document.getElementById('botaoPerfil').setAttribute('aria-expanded', 'false');
  document.querySelector('.sidebar-hover').classList.remove('perfil-aberto');
}

// Substitui apenas a abertura do menu; o fluxo de senha original não muda.
window.toggleMenuUsuario = function () {
  const menu = document.getElementById('menuUsuario');
  const abrir = menu.style.display !== 'block';
  fecharMenuPerfil();
  if (abrir) {
    menu.style.display = 'block';
    document.getElementById('botaoPerfil').setAttribute('aria-expanded', 'true');
    document.querySelector('.sidebar-hover').classList.add('perfil-aberto');
    menu.querySelector('button').focus();
  }
};

function abrirResumoPerfil() {
  fecharMenuPerfil();
  carregarOpcoesPerfil();
  fecharEditorPerfil();
  document.getElementById('perfilPreferenciasStatus').textContent = '';
  perfilOculto = preferenciasBanco.perfilOculto !== false;
  document.getElementById('perfilNomeResumo').textContent = document.getElementById('nomeUsuarioHeader').textContent;
  renderResumoPerfil();
  document.getElementById('resumoPerfil').showModal();
}

function calcularResumoPerfil(dados, periodo, agora = new Date()) {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
  let inicio = new Date(0);
  if (periodo === 'mes') inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  if (periodo === 'ano') inicio = new Date(hoje.getFullYear(), 0, 1);
  if (periodo === '30dias') inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 29);
  const data = item => normalizarDataParaOrdenacao(item.data);
  const valido = item => Number.isFinite(data(item).getTime()) && data(item).getTime() > 0;
  const ateHoje = dados.filter(item => valido(item) && data(item) <= hoje);
  const selecionados = ateHoje.filter(item => data(item) >= inicio);
  const realizados = selecionados;
  const tipo = item => obterTipoLancamento(item);
  const soma = itens => itens.reduce((total, item) => total + Math.round(obterValorAbsoluto(item) * 100), 0) / 100;
  const porTipo = (itens, nome) => itens.filter(item => tipo(item) === nome);
  const despesas = porTipo(realizados, 'Despesa');
  const categorias = new Map();
  despesas.forEach(item => {
    const categoria = String(item.categoria || 'Sem categoria');
    categorias.set(categoria, (categorias.get(categoria) || 0) + obterValorAbsoluto(item));
  });
  const maior = [...categorias].sort((a, b) => b[1] - a[1])[0];
  const ultimo = [...selecionados].sort((a, b) => data(b) - data(a))[0];
  const inicioAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const fimAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const despesasAnteriores = soma(dados.filter(item => valido(item) && data(item) >= inicioAnterior && data(item) < fimAnterior && tipo(item) === 'Despesa'));
  const ganhos = soma(porTipo(realizados, 'Receita'));
  const gastos = soma(despesas);
  const receitas = porTipo(realizados, 'Receita');
  const pagamentos = new Map();
  despesas.forEach(item => {
    const nome = String(item.pagamento || 'Não informado').trim() || 'Não informado';
    pagamentos.set(nome, (pagamentos.get(nome) || 0) + 1);
  });
  const frequencia = Math.max(0, ...pagamentos.values());
  const pagamento = [...pagamentos].filter(item => item[1] === frequencia).map(item => item[0]).join(', ');
  const maiorValor = itens => [...itens].sort((a, b) => obterValorAbsoluto(b) - obterValorAbsoluto(a))[0];
  return {
    totalHistorico: ateHoje.length, quantidade: selecionados.length, ganhos, gastos, resultado: ganhos - gastos,
    vales: soma(porTipo(realizados, 'Vales')), realizados: realizados.length,
    maior, ultimo, despesasAnteriores, soma,
    qtdDespesas: despesas.length, qtdGanhos: receitas.length,
    mediaDespesa: despesas.length ? gastos / despesas.length : null,
    maiorDespesa: maiorValor(despesas), maiorGanho: maiorValor(receitas),
    percentualGasto: ganhos > 0 ? gastos / ganhos * 100 : null,
    pagamento, frequencia,
  };
}

function renderResumoPerfil() {
  const grid = document.getElementById('perfilIndicadores');
  const status = document.getElementById('perfilStatus');
  const comparacao = document.getElementById('perfilComparacao');
  grid.replaceChildren();
  comparacao.textContent = '';
  document.getElementById('perfilTentar').hidden = perfilEstado !== 'erro';
  const olho = document.getElementById('perfilOlho');
  olho.setAttribute('aria-label', perfilOculto ? 'Mostrar valores' : 'Esconder valores');
  olho.setAttribute('title', perfilOculto ? 'Mostrar valores' : 'Esconder valores');
  olho.setAttribute('aria-pressed', String(!perfilOculto));
  olho.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>' + (perfilOculto ? '<path d="m3 3 18 18"/>' : '') + '</svg>';
  if (perfilEstado !== 'pronto') {
    status.textContent = perfilEstado === 'erro' ? 'Não foi possível carregar o resumo. Tente novamente.' : 'Carregando seus lançamentos…';
    return;
  }
  const periodo = document.getElementById('perfilPeriodo').value;
  const resumo = calcularResumoPerfil(perfilDados, periodo);
  const moeda = valor => perfilOculto ? 'R$ •••••' : formatarMoeda(valor);
  status.textContent = perfilSelecionados.length ? 'Período selecionado até hoje. O indicador de histórico considera todos os registros até hoje.' : 'Seu resumo está vazio. Clique em Personalizar resumo para escolher as informações.';
  const card = (id, titulo, valor, detalhe = '') => {
    if (!perfilSelecionados.includes(id)) return;
    const caixa = document.createElement('div');
    caixa.className = 'perfil-card';
    [['span', titulo], ['strong', valor], ['small', detalhe]].forEach(([tag, texto]) => {
      if (!texto) return;
      const el = document.createElement(tag);
      el.textContent = texto;
      caixa.appendChild(el);
    });
    grid.appendChild(caixa);
  };
  card('resultado', 'Resultado do período', moeda(resumo.resultado), 'Ganhos menos despesas; não é saldo bancário.');
  card('quantidade', 'Lançamentos no período', String(resumo.quantidade));
  card('historico', 'Lançamentos no histórico', String(resumo.totalHistorico), 'Todos os registros existentes com data até hoje.');
  card('realizados', 'Lançamentos realizados', String(resumo.realizados));
  card('qtdDespesas', 'Quantidade de despesas realizadas', String(resumo.qtdDespesas));
  card('qtdGanhos', 'Quantidade de ganhos realizados', String(resumo.qtdGanhos));
  card('ganhos', 'Total de ganhos realizados', moeda(resumo.ganhos));
  card('gastos', 'Total de despesas realizadas', moeda(resumo.gastos));
  card('vales', 'Vales no período', moeda(resumo.vales), 'Separados dos ganhos e despesas.');
  card('mediaDespesa', 'Média por despesa', resumo.mediaDespesa === null ? 'Sem despesas' : moeda(resumo.mediaDespesa));
  card('maiorDespesa', 'Maior despesa realizada', resumo.maiorDespesa ? moeda(obterValorAbsoluto(resumo.maiorDespesa)) : 'Sem despesas', resumo.maiorDespesa ? String(resumo.maiorDespesa.categoria || 'Sem categoria') : '');
  card('maiorGanho', 'Maior ganho realizado', resumo.maiorGanho ? moeda(obterValorAbsoluto(resumo.maiorGanho)) : 'Sem ganhos');
  card('percentualGasto', 'Percentual dos ganhos gasto', perfilOculto ? '•••••' : resumo.percentualGasto === null ? 'Sem ganhos para calcular' : `${resumo.percentualGasto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
  card('pagamento', 'Forma de pagamento mais usada', resumo.pagamento || 'Sem despesas', resumo.frequencia ? `${resumo.frequencia} despesas por forma indicada.` : '');
  card('categoria', 'Categoria com maior despesa', resumo.maior ? resumo.maior[0] : 'Sem despesas', resumo.maior ? moeda(resumo.maior[1]) : 'Nenhuma despesa realizada neste período.');
  card('ultimo', 'Data mais recente no período', resumo.ultimo ? formatarDataParaTela(resumo.ultimo.data) : 'Sem lançamentos');
  if (perfilSelecionados.includes('comparacao') && periodo !== 'mes') comparacao.textContent = 'Selecione Este mês para ver a comparação com o mês anterior.';
  if (perfilSelecionados.includes('comparacao') && periodo === 'mes') {
    if (perfilOculto) comparacao.textContent = 'Mostre os valores para ver a comparação de despesas.';
    else if (resumo.despesasAnteriores > 0) {
      const variacao = (resumo.gastos / resumo.despesasAnteriores - 1) * 100;
      comparacao.textContent = `Despesas deste mês até hoje: ${Math.abs(variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% ${variacao < 0 ? 'menores' : 'maiores'} que o mês anterior completo.`;
    } else comparacao.textContent = 'Sem despesas no mês anterior para calcular a comparação.';
  }
}

window.addEventListener('perfil:dados', event => {
  perfilEstado = event.detail.estado;
  if (perfilEstado === 'pronto') perfilDados = event.detail.dados;
  if (document.getElementById('resumoPerfil').open) renderResumoPerfil();
});
document.getElementById('perfilPeriodo').addEventListener('change', renderResumoPerfil);
document.getElementById('perfilPersonalizar').addEventListener('click', abrirEditorPerfil);
document.getElementById('perfilSalvar').addEventListener('click', salvarOpcoesPerfil);
document.getElementById('perfilCancelar').addEventListener('click', () => {
  fecharEditorPerfil();
  document.getElementById('perfilPersonalizar').focus();
});
document.getElementById('perfilMarcarTodos').addEventListener('click', () => marcarOpcoesPerfil(perfilCatalogo.map(item => item[0])));
document.getElementById('perfilDesmarcarTodos').addEventListener('click', () => marcarOpcoesPerfil([]));
document.getElementById('perfilRestaurar').addEventListener('click', () => marcarOpcoesPerfil(perfilPadrao()));
document.getElementById('perfilOlho').addEventListener('click', async () => {
  const botao = document.getElementById('perfilOlho');
  const proximo = !perfilOculto;
  botao.disabled = true;
  try {
    await salvarPreferenciaBanco('perfilOculto', proximo);
    perfilOculto = proximo;
    renderResumoPerfil();
  } catch (e) { document.getElementById('perfilPreferenciasStatus').textContent = 'Não foi possível salvar: ' + e.message; }
  finally { botao.disabled = false; }
});
document.getElementById('perfilTentar').addEventListener('click', () => carregarDados());
document.addEventListener('click', event => {
  if (!event.target.closest('.perfil-sidebar')) fecharMenuPerfil();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.getElementById('menuUsuario').style.display === 'block') {
    fecharMenuPerfil();
    document.getElementById('botaoPerfil').focus();
  }
});
document.querySelector('.perfil-sidebar').addEventListener('focusout', event => {
  if (!event.currentTarget.contains(event.relatedTarget)) fecharMenuPerfil();
});
document.getElementById('resumoPerfil').addEventListener('close', () => document.getElementById('botaoPerfil').focus());
