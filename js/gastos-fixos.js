/*
  Pasta: js
  Arquivo: gastos-fixos.js

  Controle de gastos fixos, faturas e assinaturas.
*/

let gastosFixosCache = [];
let gastoFixoEmEdicaoId = null;
let mesGastosFixosSelecionado = obterMesReferenciaAtualGF();

function obterMesReferenciaAtualGF() {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = String(hoje.getFullYear());

    return `${mes}/${ano}`;
}

function formatarDataHojeGF() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = String(hoje.getFullYear());

    return `${dia}/${mes}/${ano}`;
}

function obterDataPagamentoPadraoGF(gasto) {
    if (mesGastosFixosSelecionado === obterMesReferenciaAtualGF()) {
        return formatarDataHojeGF();
    }

    const [mes, ano] = mesGastosFixosSelecionado.split('/').map(Number);
    const ultimoDiaDoMes = new Date(ano, mes, 0).getDate();
    const dia = Math.min(Number(gasto?.dia_vencimento) || 1, ultimoDiaDoMes);

    return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function mudarMesReferenciaGF(chaveMes, direcao) {
    const [mes, ano] = String(chaveMes || obterMesReferenciaAtualGF()).split('/').map(Number);
    const data = new Date(ano, mes - 1 + direcao, 1);

    const novoMes = String(data.getMonth() + 1).padStart(2, '0');
    const novoAno = String(data.getFullYear());

    return `${novoMes}/${novoAno}`;
}

function normalizarTextoGF(texto) {
    return String(texto || '').trim();
}

function converterValorGF(valor) {
    if (typeof converterValor === 'function') {
        return converterValor(valor);
    }

    if (typeof valor === 'number') {
        return Number.isFinite(valor) ? valor : 0;
    }

    const texto = String(valor || '')
        .replace(/\s/g, '')
        .replace('R$', '')
        .replace(/\./g, '')
        .replace(',', '.');

    return Number(texto) || 0;
}

function formatarMoedaGF(valor) {
    if (typeof formatarMoeda === 'function') {
        return formatarMoeda(valor);
    }

    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarTextoGF(texto) {
    if (typeof formatarTextoPadrao === 'function') {
        return formatarTextoPadrao(texto);
    }

    const valor = String(texto || '').trim();
    return valor || '-';
}

function aplicarMascaraMoedaGF(texto) {
    const apenasDigitos = String(texto || '').replace(/\D/g, '');

    if (!apenasDigitos) {
        return '';
    }

    const valor = Number(apenasDigitos) / 100;
    return formatarMoedaGF(valor);
}

function mostrarStatusGastosFixos(mensagem, erro = false) {
    const status = document.getElementById('gastosFixosStatus');

    if (status) {
        status.textContent = mensagem;
        status.style.background = erro ? '#fee2e2' : '#dcfce7';
        status.style.color = erro ? '#991b1b' : '#166534';
    }

    if (typeof setStatus === 'function') {
        setStatus(mensagem, erro);
    }
}

function obterCampoGF(id) {
    return document.getElementById(id);
}

function aplicarMascaraMesReferenciaGF(texto) {
    const numeros = String(texto || '').replace(/\D/g, '').slice(0, 6);

    if (numeros.length <= 2) return numeros;

    return `${numeros.slice(0, 2)}/${numeros.slice(2, 6)}`;
}

function validarMesReferenciaGF(texto) {
    const valor = String(texto || '').trim();

    if (!/^\d{2}\/\d{4}$/.test(valor)) return false;

    const [mes, ano] = valor.split('/').map(Number);

    return mes >= 1 && mes <= 12 && ano >= 2020 && ano <= 2100;
}

function obterRotuloTipoControleGF(item) {
    return item.tipo_controle === 'parcelado' ? 'Parcelado' : 'Fixo mensal';
}

function obterRotuloParcelaGF(item) {
    if (item.tipo_controle !== 'parcelado') return '-';

    if (item.rotulo_parcela) return item.rotulo_parcela;

    if (item.parcela_atual && item.total_parcelas) {
        return `${item.parcela_atual}/${item.total_parcelas}`;
    }

    return '-';
}

function obterDadosFormularioGastoFixo() {
    return {
        id: gastoFixoEmEdicaoId,
        descricao: normalizarTextoGF(obterCampoGF('gfDescricao')?.value),
        categoria: normalizarTextoGF(obterCampoGF('gfCategoria')?.value),
        valorPrevisto: obterCampoGF('gfValorPrevisto')?.value || '',
        diaVencimento: Number(obterCampoGF('gfDiaVencimento')?.value || 0),
        pagamento: obterCampoGF('gfPagamento')?.value || '',
        mesReferencia: mesGastosFixosSelecionado
    };
}

function validarGastoFixo(dados) {
    const erros = [];

    if (!dados.descricao) {
        erros.push('Informe a descrição.');
    }

    if (!dados.categoria) {
        erros.push('Informe a categoria.');
    }

    if (converterValorGF(dados.valorPrevisto) <= 0) {
        erros.push('Informe um valor previsto maior que zero.');
    }

    if (!Number.isInteger(dados.diaVencimento) || dados.diaVencimento < 1 || dados.diaVencimento > 31) {
        erros.push('Informe um dia de vencimento entre 1 e 31.');
    }

    if (!dados.pagamento) {
        erros.push('Informe o tipo de pagamento.');
    }
    return erros;
}

function limparFormularioGastoFixo() {
    gastoFixoEmEdicaoId = null;

    const form = obterCampoGF('gastosFixosForm');
    if (form) form.reset();

    const titulo = obterCampoGF('tituloFormularioGastoFixo');
    if (titulo) titulo.textContent = 'Novo gasto fixo';

    const btnSalvar = obterCampoGF('btnSalvarGastoFixo');
    if (btnSalvar) {
        btnSalvar.textContent = 'Salvar gasto fixo';
        btnSalvar.classList.remove('btn-warning');
        btnSalvar.classList.add('btn-primary');
    }

    const btnResetar = obterCampoGF('btnResetarGastoFixo');
    if (btnResetar) btnResetar.textContent = 'Resetar campos';
}

function preencherFormularioGastoFixo(gasto) {
    gastoFixoEmEdicaoId = gasto.id;

    if (obterCampoGF('gfDescricao')) obterCampoGF('gfDescricao').value = gasto.descricao || '';
    if (obterCampoGF('gfCategoria')) obterCampoGF('gfCategoria').value = gasto.categoria || '';
    if (obterCampoGF('gfValorPrevisto')) obterCampoGF('gfValorPrevisto').value = formatarMoedaGF(converterValorGF(gasto.valor_previsto));
    if (obterCampoGF('gfDiaVencimento')) obterCampoGF('gfDiaVencimento').value = gasto.dia_vencimento || '';
    if (obterCampoGF('gfPagamento')) obterCampoGF('gfPagamento').value = gasto.pagamento || '';

    const titulo = obterCampoGF('tituloFormularioGastoFixo');
    if (titulo) titulo.textContent = 'Editar gasto fixo';

    const btnSalvar = obterCampoGF('btnSalvarGastoFixo');
    if (btnSalvar) {
        btnSalvar.textContent = 'Atualizar gasto fixo';
        btnSalvar.classList.remove('btn-primary');
        btnSalvar.classList.add('btn-warning');
    }

    const btnResetar = obterCampoGF('btnResetarGastoFixo');
    if (btnResetar) btnResetar.textContent = 'Cancelar edição';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function salvarGastoFixo() {
    const dados = obterDadosFormularioGastoFixo();
    const erros = validarGastoFixo(dados);

    if (erros.length) {
        mostrarStatusGastosFixos(erros.join(' '), true);
        return;
    }

    try {
        if (gastoFixoEmEdicaoId !== null) {
            mostrarStatusGastosFixos('Atualizando gasto fixo...');
            await atualizarGastoFixoAPI(dados);
            limparFormularioGastoFixo();
            await carregarGastosFixos();
            mostrarStatusGastosFixos('Gasto fixo atualizado com sucesso.');
            return;
        }

        mostrarStatusGastosFixos('Salvando gasto fixo...');
        await salvarGastoFixoAPI(dados);
        limparFormularioGastoFixo();
        await carregarGastosFixos();
        mostrarStatusGastosFixos('Gasto fixo salvo com sucesso.');
    } catch (error) {
        console.error(error);
        mostrarStatusGastosFixos(error.message, true);
    }
}

function atualizarResumoGastosFixos(lista) {
    const totalPrevisto = lista.reduce((acc, item) => acc + converterValorGF(item.valor_previsto), 0);

    const totalPago = lista
        .filter(item => String(item.status || '').toLowerCase() === 'pago')
        .reduce((acc, item) => acc + converterValorGF(item.valor_pago || item.valor_previsto), 0);

    const totalPendente = lista
        .filter(item => String(item.status || '').toLowerCase() !== 'pago')
        .reduce((acc, item) => acc + converterValorGF(item.valor_previsto), 0);

    if (obterCampoGF('gfTotalPrevisto')) obterCampoGF('gfTotalPrevisto').textContent = formatarMoedaGF(totalPrevisto);
    if (obterCampoGF('gfTotalPago')) obterCampoGF('gfTotalPago').textContent = formatarMoedaGF(totalPago);
    if (obterCampoGF('gfTotalPendente')) obterCampoGF('gfTotalPendente').textContent = formatarMoedaGF(totalPendente);
}

function obterClasseStatusGastoFixo(status) {
    const texto = String(status || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    if (texto === 'pago') return 'status-conta--pago';
    if (texto === 'atrasado') return 'status-conta--atrasado';

    return 'status-conta--pendente';
}

function renderTabelaGastosFixos(lista = gastosFixosCache) {
    const tbody = obterCampoGF('gastosFixosTableBody');
    if (!tbody) return;

    if (obterCampoGF('mesAtualGastosFixos')) {
        obterCampoGF('mesAtualGastosFixos').textContent = mesGastosFixosSelecionado;
    }

    atualizarResumoGastosFixos(lista);

    if (!lista.length) {
        tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; color:#6b7280;">
          Nenhum gasto fixo cadastrado neste mês.
        </td>
      </tr>
    `;
        return;
    }

    tbody.innerHTML = [...lista]
        .sort((a, b) => Number(a.dia_vencimento || 0) - Number(b.dia_vencimento || 0))
        .map((item) => {
            const status = item.status || 'Pendente';
            const pago = String(status).toLowerCase() === 'pago';
            const classeStatus = obterClasseStatusGastoFixo(status);

            return `
        <tr>
          <td>Dia ${item.dia_vencimento}</td>
          <td>${formatarTextoGF(item.descricao)}</td>
          <td>${formatarTextoGF(item.categoria)}</td>
          <td class="col-valor">${formatarMoedaGF(converterValorGF(item.valor_previsto))}</td>
          <td>${formatarTextoGF(item.pagamento)}</td>
          <td>
            <span class="status-conta ${classeStatus}">
              ${status}
            </span>
          </td>
          <td>${item.data_pagamento || '-'}</td>
          <td>
            <div class="acoes-linha">
              <button class="btn-success btn-pagar-gasto-fixo" type="button" data-id="${item.id}" ${pago ? 'disabled' : ''}>
                ${pago ? 'Pago' : 'Marcar como pago'}
              </button>
              <button class="btn-warning btn-editar-gasto-fixo" type="button" data-id="${item.id}">
                Editar
              </button>
              <button class="btn-danger btn-excluir-gasto-fixo" type="button" data-id="${item.id}">
                Encerrar
              </button>
            </div>
          </td>
        </tr>
      `;
        })
        .join('');
}

async function carregarGastosFixos() {
    try {
        mostrarStatusGastosFixos('Carregando gastos fixos...');

        const resposta = await buscarGastosFixosAPI(mesGastosFixosSelecionado);

        mesGastosFixosSelecionado = resposta.mesReferencia || mesGastosFixosSelecionado;
        gastosFixosCache = Array.isArray(resposta.gastos) ? resposta.gastos : [];

        renderTabelaGastosFixos(gastosFixosCache);
        mostrarStatusGastosFixos('Gastos fixos carregados com sucesso.');
    } catch (error) {
        console.error(error);
        mostrarStatusGastosFixos(error.message, true);
    }
}

async function excluirGastoFixo(id) {
    const confirmar = confirm(
        `Deseja encerrar este gasto fixo a partir de ${mesGastosFixosSelecionado}? Os pagamentos anteriores serão mantidos.`
    );

    if (!confirmar) return;

    try {
        mostrarStatusGastosFixos('Encerrando gasto fixo...');
        await excluirGastoFixoAPI(id, mesGastosFixosSelecionado);

        if (String(gastoFixoEmEdicaoId) === String(id)) {
            limparFormularioGastoFixo();
        }

        await carregarGastosFixos();
        if (typeof carregarDados === 'function') {
            await carregarDados();
        }
        mostrarStatusGastosFixos('Gasto fixo encerrado. O histórico anterior foi mantido.');
    } catch (error) {
        console.error(error);
        mostrarStatusGastosFixos(error.message, true);
    }
}

async function pagarGastoFixo(id) {
    const gasto = gastosFixosCache.find(item => String(item.id) === String(id));

    if (!gasto) {
        mostrarStatusGastosFixos('Gasto fixo não encontrado.', true);
        return;
    }

    const dataPagamento = prompt('Data de pagamento:', obterDataPagamentoPadraoGF(gasto));
    if (dataPagamento === null) return;

    const valorPago = prompt('Valor pago:', formatarMoedaGF(converterValorGF(gasto.valor_previsto)));
    if (valorPago === null) return;

    try {
        mostrarStatusGastosFixos('Marcando gasto fixo como pago...');

        await pagarGastoFixoAPI({
            id,
            dataPagamento,
            valorPago,
            mesReferencia: mesGastosFixosSelecionado
        });

        await carregarGastosFixos();

        if (typeof carregarDados === 'function') {
            await carregarDados();
        }

        mostrarStatusGastosFixos('Gasto fixo marcado como pago e lançado automaticamente.');
    } catch (error) {
        console.error(error);
        mostrarStatusGastosFixos(error.message, true);
    }
}

function mudarMesGastosFixos(direcao) {
    mesGastosFixosSelecionado = mudarMesReferenciaGF(mesGastosFixosSelecionado, direcao);
    carregarGastosFixos();
}

function registrarEventosGastosFixos() {
    const btnSalvar = obterCampoGF('btnSalvarGastoFixo');
    const btnResetar = obterCampoGF('btnResetarGastoFixo');
    const btnAtualizar = obterCampoGF('btnAtualizarGastosFixos');
    const btnAnterior = obterCampoGF('btnGFMesAnterior');
    const btnProximo = obterCampoGF('btnGFMesProximo');
    const form = obterCampoGF('gastosFixosForm');
    const valor = obterCampoGF('gfValorPrevisto');
    const tbody = obterCampoGF('gastosFixosTableBody');

    if (btnSalvar && !btnSalvar.dataset.configurado) {
        btnSalvar.addEventListener('click', salvarGastoFixo);
        btnSalvar.dataset.configurado = 'true';
    }

    if (btnResetar && !btnResetar.dataset.configurado) {
        btnResetar.addEventListener('click', () => {
            limparFormularioGastoFixo();
            mostrarStatusGastosFixos('Campos resetados.');
        });
        btnResetar.dataset.configurado = 'true';
    }

    if (btnAtualizar && !btnAtualizar.dataset.configurado) {
        btnAtualizar.addEventListener('click', carregarGastosFixos);
        btnAtualizar.dataset.configurado = 'true';
    }

    if (btnAnterior && !btnAnterior.dataset.configurado) {
        btnAnterior.addEventListener('click', () => mudarMesGastosFixos(-1));
        btnAnterior.dataset.configurado = 'true';
    }

    if (btnProximo && !btnProximo.dataset.configurado) {
        btnProximo.addEventListener('click', () => mudarMesGastosFixos(1));
        btnProximo.dataset.configurado = 'true';
    }

    if (form && !form.dataset.configurado) {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            salvarGastoFixo();
        });
        form.dataset.configurado = 'true';
    }

    if (valor && !valor.dataset.configurado) {
        valor.addEventListener('input', (event) => {
            event.target.value = aplicarMascaraMoedaGF(event.target.value);
        });

        valor.addEventListener('blur', () => {
            const numero = converterValorGF(valor.value);
            valor.value = numero > 0 ? formatarMoedaGF(numero) : '';
        });

        valor.dataset.configurado = 'true';
    }

    if (tbody && !tbody.dataset.configurado) {
        tbody.addEventListener('click', (event) => {
            const btnPagar = event.target.closest('.btn-pagar-gasto-fixo');
            if (btnPagar) {
                pagarGastoFixo(btnPagar.dataset.id);
                return;
            }

            const btnEditar = event.target.closest('.btn-editar-gasto-fixo');
            if (btnEditar) {
                const gasto = gastosFixosCache.find(item => String(item.id) === String(btnEditar.dataset.id));
                if (gasto) preencherFormularioGastoFixo(gasto);
                return;
            }

            const btnExcluir = event.target.closest('.btn-excluir-gasto-fixo');
            if (btnExcluir) {
                excluirGastoFixo(btnExcluir.dataset.id);
            }
        });

        tbody.dataset.configurado = 'true';
    }
}

function inicializarGastosFixos() {
    registrarEventosGastosFixos();
    renderTabelaGastosFixos([]);
}
