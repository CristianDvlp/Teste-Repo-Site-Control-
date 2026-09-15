/* Dados persistentes são gravados no banco. localStorage é usado apenas na migração. */
let preferenciasBanco = {};
let preferenciasProntas = false;
let filaPreferencias = Promise.resolve();
async function requisitarPreferencias(acao, secao, valor) {
  const r = await fetch('/api/conta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, secao, valor }) });
  const d = await r.json();
  if (!r.ok) throw new Error(d.erro || 'Não foi possível acessar as configurações no banco.');
  return d.preferencias || {};
}
function salvarPreferenciaBanco(secao, valor) {
  const copia = JSON.parse(JSON.stringify(valor));
  const tarefa = filaPreferencias.catch(() => {}).then(async () => {
    if (!preferenciasProntas) throw new Error('Configurações não carregadas. Recarregue a página para tentar novamente.');
    preferenciasBanco = await requisitarPreferencias('app-salvar', secao, copia);
    return preferenciasBanco;
  });
  filaPreferencias = tarefa;
  return tarefa;
}
async function carregarPreferenciasBanco() {
  preferenciasBanco = await requisitarPreferencias('app-carregar');
  preferenciasProntas = true;
  const usuario = window.usuarioAtualChave;
  if (!usuario) return;
  const chaves = [
    ['metas_v3_config_' + usuario, 'metas'],
    ['perfil_indicadores_v1_' + usuario, 'perfilIndicadores'],
    ['perfil_valores_ocultos_v1_' + usuario, 'perfilOculto']
  ];
  for (const [chave, secao] of chaves) {
    try {
      const original = localStorage.getItem(chave);
      if (original === null) continue;
      let valor = JSON.parse(original);
      if (secao === 'perfilIndicadores' && Array.isArray(valor)) valor = valor.filter(id => perfilCatalogo.some(item => item[0] === id));
      // O servidor importa somente se a seção ainda não existe, inclusive entre abas.
      preferenciasBanco = await requisitarPreferencias('app-importar', secao, valor);
      // Mantém a cópia antiga se diferir do banco, para recuperação manual.
      if (JSON.stringify(preferenciasBanco[secao]) === JSON.stringify(valor) && localStorage.getItem(chave) === original) localStorage.removeItem(chave);
    } catch (e) {
      alert('Uma configuração antiga foi preservada no navegador porque não pôde ser importada: ' + e.message);
    }
  }
}
async function importarAgendamentosLocais() {
  let antigos;
  try { antigos = JSON.parse(localStorage.getItem('lancamentos_agendados_v1') || '[]'); }
  catch { alert('Não foi possível ler os agendamentos antigos. Os dados locais foram preservados.'); return; }
  if (!Array.isArray(antigos)) return;
  for (const item of antigos) {
    if (!item || !item.id) { alert('Há um agendamento antigo sem identificador. Ele foi preservado para revisão.'); continue; }
    const descricao = `${item.data} — ${item.descricao || 'Sem descrição'} — ${item.tipo} — ${item.valor}`;
    if (!confirm(`Importar este agendamento antigo para a conta ${window.contaAtual.usuario}?\n\n${descricao}\n\nConfirme apenas se ele pertence a esta conta e ainda não foi lançado. Se a data já venceu, ele será lançado após a importação. Cancelar mantém o item no navegador.`)) continue;
    try {
      await salvarAgendamentoAPI({ ...item, chaveOrigem: String(item.id), acao: 'importar-local' });
      const atuais = JSON.parse(localStorage.getItem('lancamentos_agendados_v1') || '[]');
      if (Array.isArray(atuais)) {
        const restantes = atuais.filter(x => JSON.stringify(x) !== JSON.stringify(item));
        if (restantes.length) localStorage.setItem('lancamentos_agendados_v1', JSON.stringify(restantes));
        else localStorage.removeItem('lancamentos_agendados_v1');
      }
    } catch (e) { alert('Importação não concluída. O item local foi preservado. ' + e.message); }
  }
}
