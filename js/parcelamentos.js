/*
  Pasta: js
  Arquivo: parcelamentos.js

  Painel de acompanhamento das compras parceladas.
*/

const parcelamentosAbertos = new Set();

function escaparHtmlParcelamento(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function chaveMesAtualParcelamentos() {
  const hoje = new Date();
  return `${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
}

function obterParcelamentosAgrupados(lista = []) {
  const grupos = new Map();

  lista
    .filter(item => item.parcelado && item.grupoParcelamento)
    .forEach(item => {
      const grupo = String(item.grupoParcelamento);
      if (!grupos.has(grupo)) grupos.set(grupo, []);
      grupos.get(grupo).push(item);
    });

  return Array.from(grupos.entries()).map(([grupo, parcelas]) => {
    const ordenadas = [...parcelas].sort((a, b) => {
      const numeroA = Number(a.parcelaAtual || 0);
      const numeroB = Number(b.parcelaAtual || 0);
      if (numeroA !== numeroB) return numeroA - numeroB;
      return normalizarDataParaOrdenacao(a.data) - normalizarDataParaOrdenacao(b.data);
    });

    const totalOriginal = ordenadas.reduce((acc, parcela) => acc + obterValorAbsoluto(parcela), 0);
    const totalPago = ordenadas
      .filter(parcela => parcela.parcelaPaga)
      .reduce((acc, parcela) => acc + obterValorAbsoluto(parcela), 0);
    const saldoAberto = ordenadas
      .filter(parcela => !parcela.parcelaPaga)
      .reduce((acc, parcela) => acc + obterValorAbsoluto(parcela), 0);
    const qtdPagas = ordenadas.filter(parcela => parcela.parcelaPaga).length;
    const pendentes = ordenadas.filter(parcela => !parcela.parcelaPaga);
    const proxima = [...pendentes].sort((a, b) => normalizarDataParaOrdenacao(a.data) - normalizarDataParaOrdenacao(b.data))[0] || null;
    const percentual = totalOriginal > 0 ? Math.min(100, Math.round((totalPago / totalOriginal) * 100)) : 0;

    return {
      grupo,
      parcelas: ordenadas,
      descricao: ordenadas[0]?.descricao || 'Compra parcelada',
      categoria: ordenadas[0]?.categoria || '',
      pagamento: ordenadas[0]?.pagamento || '',
      totalParcelas: Number(ordenadas[0]?.totalParcelas || ordenadas.length),
      totalOriginal,
      totalPago,
      saldoAberto,
      qtdPagas,
      percentual,
      proxima,
      quitado: pendentes.length === 0
    };
  }).sort((a, b) => {
    if (a.quitado !== b.quitado) return a.quitado ? 1 : -1;
    const dataA = a.proxima ? normalizarDataParaOrdenacao(a.proxima.data) : new Date(8640000000000000);
    const dataB = b.proxima ? normalizarDataParaOrdenacao(b.proxima.data) : new Date(8640000000000000);
    return dataA - dataB;
  });
}

function parcelaEstaAtrasada(parcela) {
  if (parcela.parcelaPaga) return false;
  const vencimento = normalizarDataParaOrdenacao(parcela.data);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return vencimento < hoje;
}

function renderResumoParcelamentos(grupos) {
  const totalOriginal = grupos.reduce((acc, grupo) => acc + grupo.totalOriginal, 0);
  const totalPago = grupos.reduce((acc, grupo) => acc + grupo.totalPago, 0);
  const saldoAberto = grupos.reduce((acc, grupo) => acc + grupo.saldoAberto, 0);
  const mesAtual = chaveMesAtualParcelamentos();
  const pendenteMes = grupos.reduce((acc, grupo) => (
    acc + grupo.parcelas
      .filter(parcela => !parcela.parcelaPaga && obterChaveMes(parcela.data) === mesAtual)
      .reduce((sub, parcela) => sub + obterValorAbsoluto(parcela), 0)
  ), 0);

  const campos = {
    parcelamentosTotalOriginal: totalOriginal,
    parcelamentosTotalPago: totalPago,
    parcelamentosSaldoAberto: saldoAberto,
    parcelamentosPendenteMes: pendenteMes
  };

  Object.entries(campos).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = formatarMoeda(valor);
  });

  const label = document.getElementById('parcelamentosPendenteMesLabel');
  if (label) label.textContent = `Parcelas pendentes em ${mesAtual}`;
}

function montarLinhasParcelas(grupo) {
  return grupo.parcelas.map(parcela => {
    const atrasada = parcelaEstaAtrasada(parcela);
    const statusClasse = parcela.parcelaPaga ? 'pago' : (atrasada ? 'atrasado' : 'pendente');
    const statusTexto = parcela.parcelaPaga ? 'Pago' : (atrasada ? 'Atrasada' : 'Pendente');
    const acaoTexto = parcela.parcelaPaga ? 'Desfazer pagamento' : 'Marcar como pago';
    const acaoClasse = parcela.parcelaPaga ? 'btn-secondary' : 'btn-success';

    return `
      <tr>
        <td><strong>${Number(parcela.parcelaAtual || 0)}/${grupo.totalParcelas}</strong></td>
        <td>${escaparHtmlParcelamento(formatarDataParaTela(parcela.data))}</td>
        <td>${formatarMoeda(obterValorAbsoluto(parcela))}</td>
        <td><span class="status-parcela ${statusClasse}">${statusTexto}</span></td>
        <td>
          <button class="${acaoClasse} btn-status-parcela" type="button" data-id="${escaparHtmlParcelamento(parcela.id)}" data-paga="${parcela.parcelaPaga ? 'false' : 'true'}">
            ${acaoTexto}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function montarCardParcelamento(grupo) {
  const aberto = parcelamentosAbertos.has(grupo.grupo);
  const proximaTexto = grupo.proxima
    ? `${grupo.proxima.parcelaAtual}/${grupo.totalParcelas} • ${formatarDataParaTela(grupo.proxima.data)} • ${formatarMoeda(obterValorAbsoluto(grupo.proxima))}`
    : 'Todas as parcelas foram pagas';

  return `
    <article class="parcelamento-card ${grupo.quitado ? 'quitado' : ''}" data-grupo="${escaparHtmlParcelamento(grupo.grupo)}">
      <div class="parcelamento-card__topo">
        <div class="parcelamento-card__titulo-wrap">
          <div class="parcelamento-card__icone">${grupo.quitado ? '✅' : '🧾'}</div>
          <div>
            <h3>${escaparHtmlParcelamento(grupo.descricao)}</h3>
            <p>${escaparHtmlParcelamento(grupo.categoria)} • ${escaparHtmlParcelamento(grupo.pagamento)} • ${grupo.totalParcelas}x</p>
          </div>
        </div>
        <span class="parcelamento-card__status ${grupo.quitado ? 'quitado' : 'aberto'}">${grupo.quitado ? 'Quitado' : 'Em aberto'}</span>
      </div>

      <div class="parcelamento-card__metricas">
        <div><span>Valor total</span><strong>${formatarMoeda(grupo.totalOriginal)}</strong></div>
        <div><span>Pago</span><strong>${formatarMoeda(grupo.totalPago)}</strong></div>
        <div class="saldo"><span>Restante</span><strong>${formatarMoeda(grupo.saldoAberto)}</strong></div>
        <div><span>Parcelas pagas</span><strong>${grupo.qtdPagas}/${grupo.totalParcelas}</strong></div>
      </div>

      <div class="parcelamento-progresso">
        <div class="parcelamento-progresso__linha">
          <span>Progresso por valor pago</span>
          <strong>${grupo.percentual}%</strong>
        </div>
        <div class="parcelamento-progresso__trilho"><div style="width:${grupo.percentual}%"></div></div>
      </div>

      <div class="parcelamento-card__rodape">
        <div>
          <span class="parcelamento-card__proxima-label">${grupo.quitado ? 'Situação' : 'Próxima parcela'}</span>
          <strong>${escaparHtmlParcelamento(proximaTexto)}</strong>
        </div>
        <button class="btn-secondary btn-toggle-parcelamento" type="button" data-grupo="${escaparHtmlParcelamento(grupo.grupo)}">
          ${aberto ? 'Ocultar parcelas' : 'Ver parcelas'}
        </button>
      </div>

      <div class="parcelamento-detalhes" ${aberto ? '' : 'hidden'}>
        <div class="table-wrapper">
          <table>
            <thead><tr><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead>
            <tbody>${montarLinhasParcelas(grupo)}</tbody>
          </table>
        </div>
        <div class="parcelamento-detalhes__acoes">
          <button class="btn-danger btn-excluir-parcelamento" type="button" data-grupo="${escaparHtmlParcelamento(grupo.grupo)}">Excluir compra parcelada</button>
        </div>
      </div>
    </article>
  `;
}

function renderParcelamentos(lista = []) {
  const container = document.getElementById('listaParcelamentos');
  if (!container) return;

  const grupos = obterParcelamentosAgrupados(lista);
  renderResumoParcelamentos(grupos);

  const filtro = document.getElementById('filtroParcelamentos')?.value || 'abertos';
  const filtrados = grupos.filter(grupo => {
    if (filtro === 'quitados') return grupo.quitado;
    if (filtro === 'abertos') return !grupo.quitado;
    return true;
  });

  if (!grupos.length) {
    container.innerHTML = `
      <div class="parcelamentos-vazio card">
        <div class="parcelamentos-vazio__icone">🧾</div>
        <h3>Nenhuma compra parcelada ainda</h3>
        <p>Crie uma em Lançamentos e acompanhe aqui o saldo restante e o progresso de pagamento.</p>
      </div>
    `;
    return;
  }

  if (!filtrados.length) {
    container.innerHTML = `<div class="parcelamentos-vazio card"><h3>Nenhum parcelamento neste filtro.</h3></div>`;
    return;
  }

  container.innerHTML = filtrados.map(montarCardParcelamento).join('');
}

async function abrirParcelamento(grupoParcelamento) {
  if (!grupoParcelamento) return;
  parcelamentosAbertos.add(String(grupoParcelamento));
  await ativarTab('parcelamentos');
  renderParcelamentos(typeof lancamentos !== 'undefined' ? lancamentos : []);

  const card = Array.from(document.querySelectorAll('.parcelamento-card'))
    .find(item => String(item.dataset.grupo || '') === String(grupoParcelamento));
  card?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function configurarEventosParcelamentos() {
  const filtro = document.getElementById('filtroParcelamentos');
  const lista = document.getElementById('listaParcelamentos');
  const btnNovo = document.getElementById('btnNovoParcelamento');

  if (filtro && !filtro.dataset.configurado) {
    filtro.addEventListener('change', () => renderParcelamentos(typeof lancamentos !== 'undefined' ? lancamentos : []));
    filtro.dataset.configurado = 'true';
  }

  if (btnNovo && !btnNovo.dataset.configurado) {
    btnNovo.addEventListener('click', async () => {
      await ativarTab('lancamentos');
      cancelarEdicao?.();
      const campo = document.getElementById('parcelado');
      if (campo) {
        campo.checked = true;
        atualizarCamposParcelamento();
      }
      document.getElementById('descricao')?.focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    btnNovo.dataset.configurado = 'true';
  }

  if (lista && !lista.dataset.configurado) {
    lista.addEventListener('click', async (event) => {
      const toggle = event.target.closest('.btn-toggle-parcelamento');
      if (toggle) {
        const grupo = String(toggle.dataset.grupo || '');
        if (parcelamentosAbertos.has(grupo)) parcelamentosAbertos.delete(grupo);
        else parcelamentosAbertos.add(grupo);
        renderParcelamentos(typeof lancamentos !== 'undefined' ? lancamentos : []);
        return;
      }

      const status = event.target.closest('.btn-status-parcela');
      if (status) {
        const id = status.dataset.id;
        const paga = status.dataset.paga === 'true';
        status.disabled = true;
        try {
          setStatus(paga ? 'Marcando parcela como paga...' : 'Atualizando parcela...');
          await atualizarStatusParcelaAPI(id, paga);
          await carregarDados();
          setStatus(paga ? 'Parcela marcada como paga.' : 'Pagamento desfeito.');
        } catch (error) {
          console.error(error);
          status.disabled = false;
          setStatus(`Erro ao atualizar parcela: ${error.message}`, true);
        }
        return;
      }

      const excluir = event.target.closest('.btn-excluir-parcelamento');
      if (excluir) {
        const grupo = String(excluir.dataset.grupo || '');
        const confirmar = confirm('Excluir esta compra parcelada e todas as parcelas vinculadas?');
        if (!confirmar) return;

        excluir.disabled = true;
        try {
          setStatus('Excluindo parcelamento...');
          await excluirParcelamentoAPI(grupo);
          parcelamentosAbertos.delete(grupo);
          await carregarDados();
          setStatus('Parcelamento excluído com sucesso.');
        } catch (error) {
          console.error(error);
          excluir.disabled = false;
          setStatus(`Erro ao excluir parcelamento: ${error.message}`, true);
        }
      }
    });
    lista.dataset.configurado = 'true';
  }
}
