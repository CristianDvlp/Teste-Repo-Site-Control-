/*
  Pasta: js
  Arquivo: utils.js

  Funções auxiliares.
*/

function converterValor(numeroOuTexto) {
  if (typeof numeroOuTexto === 'number') {
    return Number.isFinite(numeroOuTexto) ? numeroOuTexto : 0;
  }

  if (
    numeroOuTexto === null ||
    numeroOuTexto === undefined ||
    numeroOuTexto === ''
  ) {
    return 0;
  }

  const valorOriginal = String(numeroOuTexto).trim();
  const negativo = valorOriginal.includes('-');

  let texto = valorOriginal
    .replace(/R\$/gi, '')
    .replace(/\s/g, '')
    .replace(/-/g, '')
    .replace(/[^\d.,]/g, '');

  if (!texto) return 0;

  const possuiVirgula = texto.includes(',');
  const possuiPonto = texto.includes('.');

  if (possuiVirgula && possuiPonto) {
    const ultimaVirgula = texto.lastIndexOf(',');
    const ultimoPonto = texto.lastIndexOf('.');

    if (ultimaVirgula > ultimoPonto) {
      // Formato brasileiro: 1.799,48
      texto = texto.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato americano: 1,799.48
      texto = texto.replace(/,/g, '');
    }
  } else if (possuiVirgula) {
    texto = texto.replace(/\./g, '').replace(',', '.');
  } else if (possuiPonto) {
    // Identifica pontos usados somente como milhar: 1.799 ou 1.234.567
    if (/^\d{1,3}(\.\d{3})+$/.test(texto)) {
      texto = texto.replace(/\./g, '');
    } else {
      const partes = texto.split('.');

      if (partes.length > 2) {
        const decimal = partes.pop();
        texto = `${partes.join('')}.${decimal}`;
      }
    }
  }

  const numero = Number(texto);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return negativo ? -numero : numero;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function formatarDataParaTela(data) {
  if (!data) return '';

  const texto = String(data).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    return texto;
  }

  if (texto.includes('T')) {
    const dataParte = texto.split('T')[0];
    const partes = dataParte.split('-');

    if (partes.length === 3) {
      const [ano, mes, dia] = partes;
      return `${dia}/${mes}/${ano}`;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  return texto;
}

function normalizarDataParaOrdenacao(data) {
  if (!data) return new Date(0);

  const texto = String(data).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
    const [dia, mes, ano] = texto.split('/').map(Number);
    return new Date(ano, mes - 1, dia);
  }

  if (texto.includes('T')) {
    const dataParte = texto.split('T')[0];
    const [ano, mes, dia] = dataParte.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split('-').map(Number);
    return new Date(ano, mes - 1, dia);
  }

  return new Date(texto);
}

function obterChaveMes(data) {
  const dataObj = normalizarDataParaOrdenacao(data);

  if (!(dataObj instanceof Date) || isNaN(dataObj.getTime())) {
    return '';
  }

  const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
  const ano = String(dataObj.getFullYear());
  return `${mes}/${ano}`;
}

function obterMesesDisponiveis(lancamentos) {
  return Array.from(
    new Set(
      lancamentos
        .map(item => obterChaveMes(item.data))
        .filter(Boolean)
    )
  ).sort((a, b) => {
    const [mesA, anoA] = a.split('/').map(Number);
    const [mesB, anoB] = b.split('/').map(Number);
    return new Date(anoA, mesA - 1, 1) - new Date(anoB, mesB - 1, 1);
  });
}

function filtrarLancamentosPorMes(lancamentos, mesSelecionado) {
  if (!mesSelecionado) return [...lancamentos];
  return lancamentos.filter(item => obterChaveMes(item.data) === mesSelecionado);
}

function obterTipoLancamento(item) {
  const tipoOriginal = String(item.tipo || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (tipoOriginal === 'VALES' || tipoOriginal === 'VALE') return 'Vales';
  if (tipoOriginal === 'DESPESA') return 'Despesa';
  if (tipoOriginal === 'RECEITA') return 'Receita';

  const valor = converterValor(item.valor);

  if (valor < 0) return 'Despesa';
  if (valor > 0) return 'Receita';

  return 'Receita';
}

function obterValorAbsoluto(item) {
  return Math.abs(converterValor(item.valor));
}

function categoriaIgnoradaNoDashboard(item) {
  return false;

  /*
  const categoria = String(item.categoria || '').trim().toUpperCase();
  const tipo = obterTipoLancamento(item);

  if (tipo === 'Vales') {
    return false;
  }

  return categoria === 'VA' || categoria === 'VP';
  */
}

function normalizarLancamento(item, indice = 0) {
  return {
    id: item.id ?? item.ID ?? item.linha ?? item.Linha ?? indice + 2,
    data: item.data ?? item.Data ?? '',
    tipo: item.tipo ?? item.Tipo ?? '',
    descricao: item.descricao ?? item.Descricao ?? item.DESCRICAO ?? '',
    categoria: item.categoria ?? item.Categoria ?? '',
    valor: item.valor ?? item.Valor ?? 0,
    pagamento: item.pagamento ?? item.Pagamento ?? item.FormaPagamento ?? item['Tipo de Pagamento'] ?? '',
    parcelado: Boolean(item.parcelado),
    parcelaAtual: item.parcelaAtual ?? item.parcela_atual ?? null,
    totalParcelas: item.totalParcelas ?? item.total_parcelas ?? null,
    grupoParcelamento: item.grupoParcelamento ?? item.grupo_parcelamento ?? null,
    valorTotalCompra: item.valorTotalCompra ?? item.valor_total_compra ?? null,
    parcelaPaga: item.parcelaPaga ?? item.parcela_paga ?? true,
    dataPagamento: item.dataPagamento ?? item.data_pagamento ?? null,
    origem: item.origem ?? item.Origem ?? item.ORIGEM ?? 'site'
  };
}

function ehSaldoInicial(item) {
  const texto = `${item?.categoria || ""} ${item?.descricao || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

  return texto.includes("saldoinicial");
}

function agruparDespesasPorCategoria(lancamentos) {
  const mapa = {};

  lancamentos
    .filter(item => !categoriaIgnoradaNoDashboard(item))
    .filter(item => obterTipoLancamento(item) === 'Despesa')
    .forEach(item => {
      const categoria = item.categoria || 'Sem categoria';
      mapa[categoria] = (mapa[categoria] || 0) + obterValorAbsoluto(item);
    });

  return mapa;
}

function agruparMovimentacaoPorMes(lancamentos) {
  const mapa = {};

  lancamentos
    .filter(item => !categoriaIgnoradaNoDashboard(item))
    .forEach(item => {
      if (!item.data) return;

      const chave = obterChaveMes(item.data);
      if (!chave) return;

if (!mapa[chave]) {
  mapa[chave] = { receitas: 0, despesas: 0, Vales: 0, saldoInicial: 0 };
}

const tipo = obterTipoLancamento(item);
const valor = obterValorAbsoluto(item);

if (typeof ehSaldoInicial === "function" && ehSaldoInicial(item)) {
  mapa[chave].saldoInicial += valor;
  return;
}

if (tipo === "Receita") {
  mapa[chave].receitas += valor;
} else if (tipo === "Despesa") {
  mapa[chave].despesas += valor;
} else if (tipo === "Vales") {
  mapa[chave].Vales += valor;
}
    });

  return mapa;
}

function agruparGanhosAcumuladosPorMes(lancamentos) {
  const mapaMensal = {};

  lancamentos
    .filter(item => !categoriaIgnoradaNoDashboard(item))
    .forEach(item => {
      if (!item.data) return;

      const chaveMes = obterChaveMes(item.data);
      if (!chaveMes) return;

      if (!mapaMensal[chaveMes]) {
        mapaMensal[chaveMes] = 0;
      }

      if (obterTipoLancamento(item) === 'Receita') {
        mapaMensal[chaveMes] += obterValorAbsoluto(item);
      }
    });

  const mesesOrdenados = Object.keys(mapaMensal).sort((a, b) => {
    const [mesA, anoA] = a.split('/').map(Number);
    const [mesB, anoB] = b.split('/').map(Number);
    return new Date(anoA, mesA - 1, 1) - new Date(anoB, mesB - 1, 1);
  });

  let acumulado = 0;
  return mesesOrdenados.map(mes => {
    acumulado += mapaMensal[mes];
    return {
      mes,
      valor: acumulado
    };
  });
}