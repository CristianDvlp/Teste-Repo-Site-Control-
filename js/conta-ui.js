// Interface de e-mail; nenhum token ou senha é salvo no navegador.
(function () {
  const dialog = document.createElement('dialog');
  dialog.className = 'conta-dialog';
  dialog.setAttribute('aria-labelledby', 'contaTitulo');
  dialog.innerHTML = `<div class="conta-cabecalho"><h2 id="contaTitulo"></h2><button type="button" class="conta-fechar" aria-label="Fechar">×</button></div>
    <p id="contaAjuda" class="conta-ajuda"></p>
    <form class="conta-form" id="contaForm">
      <label id="contaNomeWrap">Nome<input id="contaNome" autocomplete="name" minlength="2" maxlength="60"></label>
      <label id="contaEmailWrap">E-mail<input id="contaEmail" type="email" autocomplete="email" maxlength="254" required></label>
      <label id="contaSenhaWrap"><span id="contaSenhaLabel">Senha</span><input id="contaSenha" type="password" autocomplete="new-password"></label>
      <label id="contaConfirmarWrap">Confirmar senha<input id="contaConfirmar" type="password" autocomplete="new-password"></label>
      <button id="contaEnviar" type="submit"></button>
      <p id="contaStatus" class="conta-status" role="status"></p>
    </form>`;
  document.body.appendChild(dialog);
  const el = id => document.getElementById(id);
  let modo = 'cadastro';
  dialog.querySelector('.conta-fechar').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => el('contaForm').reset());

  async function pedir(url, dados) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.erro || 'Não foi possível concluir. Tente novamente.');
    return body;
  }

  window.abrirContaDialog = function (acao) {
    modo = acao;
    const cadastro = modo === 'cadastro', vincular = modo === 'vincular';
    el('contaForm').reset();
    el('contaStatus').classList.toggle('mensagem-erro', false); el('contaStatus').textContent = '';
    el('contaEnviar').disabled = false;
    el('contaNomeWrap').hidden = !cadastro;
    el('contaNome').required = cadastro;
    el('contaSenhaWrap').hidden = !cadastro && !vincular;
    el('contaSenha').required = cadastro || vincular;
    el('contaSenha').minLength = cadastro ? 8 : 1;
    el('contaSenha').autocomplete = cadastro ? 'new-password' : 'current-password';
    el('contaSenhaLabel').textContent = vincular ? 'Senha atual' : 'Senha (mínimo de 8 caracteres)';
    el('contaConfirmarWrap').hidden = !cadastro;
    el('contaConfirmar').required = cadastro;
    el('contaEmailWrap').hidden = false;
    el('contaEmail').required = true;
    el('contaEnviar').hidden = false;
    const titulos = { cadastro: 'Criar conta', recuperar: 'Esqueci minha senha', reenviar: 'Reenviar confirmação', vincular: 'E-mail da conta' };
    el('contaTitulo').textContent = titulos[modo];
    el('contaEnviar').textContent = cadastro ? 'Criar conta e enviar confirmação' : 'Enviar link por e-mail';
    el('contaAjuda').textContent = cadastro ? 'Você recebe um link para confirmar o e-mail e ativar sua conta. Não é necessária aprovação do administrador.' : vincular ? 'Vincule um e-mail para recuperar sua senha e entrar com ele. Confirme sua senha atual e depois o link recebido.' : 'Informe seu e-mail cadastrado. O link de recuperação vale por 30 minutos; o de confirmação, por 24 horas.';
    if (vincular && window.contaAtual?.emailConfirmado) {
      el('contaAjuda').textContent = `E-mail confirmado: ${window.contaAtual.email}. Você pode entrar com ele ou com seu usuário cadastrado. Use o e-mail para recuperar sua senha.`;
      el('contaEmailWrap').hidden = true;
      el('contaEmail').required = false;
      el('contaSenhaWrap').hidden = true;
      el('contaSenha').required = false;
      el('contaEnviar').hidden = true;
    }
    dialog.showModal();
  };

  el('contaForm').addEventListener('submit', async event => {
    event.preventDefault();
    const btn = el('contaEnviar');
    if (btn.disabled) return;
    const senha = el('contaSenha').value;
    if (modo === 'cadastro' && senha !== el('contaConfirmar').value) { el('contaStatus').classList.toggle('mensagem-erro', true); el('contaStatus').textContent = 'As senhas não conferem.'; return; }
    btn.disabled = true;
    el('contaStatus').classList.toggle('mensagem-erro', false); el('contaStatus').textContent = 'Enviando…';
    try {
      const body = await pedir(modo === 'cadastro' ? '/api/register' : '/api/conta', {
        acao: modo, nome: el('contaNome').value.trim(), email: el('contaEmail').value.trim(), senha
      });
      el('contaStatus').classList.toggle('mensagem-erro', false); el('contaStatus').textContent = body.mensagem;
      el('contaSenha').value = '';
      el('contaConfirmar').value = '';
    } catch (erro) { el('contaStatus').classList.toggle('mensagem-erro', true); el('contaStatus').textContent = erro.message; }
    finally { btn.disabled = false; }
  });

  window.entrarContaEmail = async function (event) {
    event.preventDefault();
    const btn = event.target.querySelector('[type=submit]');
    if (btn.disabled) return;
    btn.disabled = true;
    el('loginStatus').classList.toggle('mensagem-erro', false); el('loginStatus').textContent = 'Entrando…';
    try {
      await pedir('/api/login', { usuario: el('usuario').value.trim(), senha: el('senha').value });
      window.location.href = 'index.html';
    } catch (erro) { el('loginStatus').classList.toggle('mensagem-erro', true); el('loginStatus').textContent = erro.message; }
    finally { btn.disabled = false; }
  };

  window.carregarSolicitacoesPendentes = async function () {
    const lista = el('listaSolicitacoes');
    if (!lista) return;
    try {
      const resposta = await fetch('/api/solicitacoes', { cache: 'no-store' });
      if (!resposta.ok) throw new Error('Não foi possível carregar os avisos. Tente atualizar.');
      const { avisos, naoLidas } = await resposta.json();
      lista.replaceChildren();
      el('qtdSolicitacoes').textContent = naoLidas;
      el('qtdSolicitacoes').style.display = naoLidas ? 'inline-flex' : 'none';
      if (!avisos.length) lista.textContent = 'Nenhum cadastro confirmado por enquanto.';
      avisos.forEach(aviso => {
        const item = document.createElement('div');
        item.className = 'solicitacao-item' + (aviso.lida ? ' conta-lida' : '');
        const conteudo = document.createElement('div');
        const titulo = document.createElement('strong');
        titulo.textContent = `${aviso.usuario} confirmou o cadastro`;
        const detalhe = document.createElement('span');
        detalhe.textContent = `${aviso.email} · ${new Date(aviso.criado_em).toLocaleString('pt-BR')}`;
        conteudo.append(titulo, detalhe);
        item.appendChild(conteudo);
        if (!aviso.lida) {
          const botao = document.createElement('button');
          botao.type = 'button'; botao.textContent = 'Marcar como lida';
          botao.addEventListener('click', async () => {
            botao.disabled = true;
            try { await pedir('/api/solicitacoes', { acao: 'ler', id: aviso.id }); await window.carregarSolicitacoesPendentes(); }
            catch (erro) { botao.textContent = erro.message; botao.disabled = false; }
          });
          item.appendChild(botao);
        }
        lista.appendChild(item);
      });
    } catch (erro) { lista.textContent = erro.message; }
  };
  window.togglePainelSolicitacoes = function () {
    const painel = el('painelSolicitacoes');
    painel.style.display = painel.style.display === 'block' ? 'none' : 'block';
    if (painel.style.display === 'block') window.carregarSolicitacoesPendentes();
  };
  if (el('listaSolicitacoes')) setInterval(() => {
    if (window.contaAtual?.admin && !document.hidden) window.carregarSolicitacoesPendentes();
  }, 60000);
})();
