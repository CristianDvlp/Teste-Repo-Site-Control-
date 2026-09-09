/* Resumo somente de leitura: reutiliza os dados autenticados já carregados. */
let perfilDados = [];
let perfilEstado = 'carregando';
let perfilOculto = true;

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

function chavePrivacidadePerfil() {
  return 'perfil_valores_ocultos_v1_' + (window.usuarioAtualChave || 'sessao');
}

function abrirResumoPerfil() {
  fecharMenuPerfil();
  perfilOculto = true;
  try { perfilOculto = localStorage.getItem(chavePrivacidadePerfil()) !== 'false'; } catch { /* armazenamento opcional */ }
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
  const pendente = item => !!item.parcelado && !!item.grupoParcelamento && item.parcelaPaga !== true;
  const realizados = selecionados.filter(item => !pendente(item));
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
  const despesasAnteriores = soma(dados.filter(item => valido(item) && data(item) >= inicioAnterior && data(item) < fimAnterior && !pendente(item) && tipo(item) === 'Despesa'));
  const ganhos = soma(porTipo(realizados, 'Receita'));
  const gastos = soma(despesas);
  return {
    totalHistorico: ateHoje.length, quantidade: selecionados.length, ganhos, gastos, resultado: ganhos - gastos,
    vales: soma(porTipo(realizados, 'Vales')), realizados: realizados.length,
    pagar: porTipo(selecionados.filter(pendente), 'Despesa'), receber: porTipo(selecionados.filter(pendente), 'Receita'),
    maior, ultimo, despesasAnteriores, soma
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
  status.textContent = `${resumo.totalHistorico} lançamentos no histórico até hoje · ${resumo.quantidade} no período selecionado, até hoje.`;
  const card = (titulo, valor, detalhe = '') => {
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
  card('Resultado do período', moeda(resumo.resultado), 'Ganhos menos despesas; não é saldo bancário.');
  card('Lançamentos no período', String(resumo.quantidade), `${resumo.realizados} considerados realizados`);
  card('Total de ganhos realizados', moeda(resumo.ganhos));
  card('Total de despesas realizadas', moeda(resumo.gastos));
  card('Parcelas a pagar no período', moeda(resumo.soma(resumo.pagar)), `${resumo.pagar.length} pendentes`);
  card('Parcelas a receber no período', moeda(resumo.soma(resumo.receber)), `${resumo.receber.length} pendentes`);
  card('Vales no período', moeda(resumo.vales), 'Separados dos ganhos e despesas.');
  card('Categoria com maior despesa', resumo.maior ? resumo.maior[0] : 'Sem despesas', resumo.maior ? moeda(resumo.maior[1]) : 'Nenhuma despesa realizada neste período.');
  card('Data mais recente no período', resumo.ultimo ? formatarDataParaTela(resumo.ultimo.data) : 'Sem lançamentos');
  if (periodo === 'mes') {
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
document.getElementById('perfilOlho').addEventListener('click', () => {
  perfilOculto = !perfilOculto;
  try { localStorage.setItem(chavePrivacidadePerfil(), String(perfilOculto)); } catch { /* sem persistência */ }
  renderResumoPerfil();
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
