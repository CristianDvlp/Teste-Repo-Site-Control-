(function () {
 const params = new URLSearchParams(location.hash.slice(1));
 let token = params.get('token');
 const finalidade = params.get('finalidade');
 // Fragmento não é enviado ao servidor; remover também do histórico visível.
 history.replaceState(null, '', location.pathname);
 const el = id => document.getElementById(id);
 if (!/^[a-f0-9]{64}$/.test(token || '') || !['cadastro','vincular','senha'].includes(finalidade)) {
  el('acessoForm').hidden = true;
  el('acessoStatus').textContent = 'Link inválido. Solicite outro pelo login ou pelo perfil.';
  return;
 }
 const vincular = finalidade === 'vincular';
 el('acessoSenhas').hidden = vincular;
 el('acessoSenha').required = !vincular;
 el('acessoConfirmar').required = !vincular;
 el('acessoTitulo').textContent = finalidade === 'senha' ? 'Redefinir senha' : 'Confirmar e-mail';
 el('acessoAjuda').textContent = vincular ? 'Clique abaixo para confirmar o e-mail que você solicitou vincular à sua conta.' : finalidade === 'cadastro' ? 'Para ativar sua conta, confirme sua senha abaixo (ou escolha uma nova). A senha definida aqui será a senha de acesso.' : 'Escolha uma nova senha com pelo menos 8 caracteres. Seus acessos anteriores serão encerrados.';
 el('acessoForm').addEventListener('submit', async event => {
  event.preventDefault();
  const btn = el('acessoEnviar');
  if (btn.disabled) return;
  const senha = el('acessoSenha').value, confirmarSenha = el('acessoConfirmar').value;
  if (!vincular && senha !== confirmarSenha) { el('acessoStatus').textContent = 'As senhas não conferem.'; return; }
  btn.disabled = true;
  el('acessoStatus').textContent = 'Confirmando…';
  try {
   const r = await fetch('/api/conta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao: 'confirmar', token, finalidade, senha, confirmarSenha }) });
   const dados = await r.json().catch(() => ({}));
   if (!r.ok) throw new Error(dados.erro || 'Não foi possível confirmar. Tente novamente.');
   token = null;
   el('acessoForm').reset();
   el('acessoForm').hidden = true;
   el('acessoStatus').textContent = dados.mensagem;
  } catch (erro) { el('acessoStatus').textContent = erro.message; btn.disabled = false; }
 });
})();
