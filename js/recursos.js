/* Preferência por conta; nunca remove ou regrava lançamentos. */
function valesAtivos() { return preferenciasBanco.valesAtivos === true; }
function lancamentoVisivel(item) { return valesAtivos() || !['vale', 'vales'].includes(String(item.tipo || item.Tipo || '').trim().toLowerCase()); }
function aplicarRecursosUsuario() {
  const ativo = valesAtivos();
  document.querySelectorAll('[data-recurso-vales]').forEach(el => { el.hidden = !ativo; if (el.tagName === 'OPTION') el.disabled = !ativo; });
  document.querySelectorAll('[data-texto-sem-vales]').forEach(el => {
    if (!el.dataset.textoVales) el.dataset.textoVales = el.textContent.trim();
    el.textContent = ativo ? el.dataset.textoVales : el.dataset.textoSemVales;
  });
  for (const id of ['tipo', 'filtroTipo']) {
    const el = document.getElementById(id);
    if (!ativo && el?.value === 'Vales') el.value = id === 'tipo' ? '' : 'Todos';
  }
  const toggle = document.getElementById('perfilVales');
  toggle.checked = ativo; toggle.disabled = !preferenciasProntas;
  if(typeof atualizarFluxoGuiado==='function')atualizarFluxoGuiado();
}
document.getElementById('perfilVales').addEventListener('change', async event => {
  const el = event.target, anterior = valesAtivos(), proximo = el.checked;
  const status = document.getElementById('perfilValesStatus');
  if (!proximo && typeof lancamentoEmEdicaoId !== 'undefined' && lancamentoEmEdicaoId !== null && form.tipo.value === 'Vales') {
    el.checked = anterior; status.textContent = 'Conclua ou cancele a edição do vale antes de desativar.'; return;
  }
  el.disabled = true; status.textContent = 'Salvando…';
  try {
    await salvarPreferenciaBanco('valesAtivos', proximo);
    aplicarRecursosUsuario();
    fecharEditorPerfil();
    renderResumoPerfil(); renderTabela(lancamentos); renderListaAgendamentos();
    atualizarSugestoesCategoria(lancamentos.filter(lancamentoVisivel));
    window.dispatchEvent(new Event('recursos:alterados'));
    status.textContent = 'Preferência salva na sua conta.';
  } catch (e) { el.checked = anterior; status.textContent = 'Não foi possível salvar: ' + e.message; }
  finally { el.disabled = !preferenciasProntas; }
});
document.getElementById('contasAnteriores').addEventListener('toggle', event => {
  if (event.target.open) carregarGastosFixos();
});
