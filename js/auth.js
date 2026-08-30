function mostrarMensagemLogin(texto) {
  const status = document.getElementById("loginStatus");

  if (status) {
    status.textContent = texto;
  } else {
    alert(texto);
  }
}

async function cadastrarConta() {
  const usuario = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if (!usuario || !senha) {
    mostrarMensagemLogin("Digite usuário e senha para cadastrar.");
    return;
  }

  const resposta = await fetch("/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ usuario, senha })
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagemLogin(dados.erro || "Erro ao cadastrar.");
    return;
  }

  mostrarMensagemLogin("Solicitação enviada. Aguarde até sua conta ser aceita.");
}

async function entrarConta() {
  const usuario = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if (!usuario || !senha) {
    mostrarMensagemLogin("Digite usuário e senha.");
    return;
  }

  const resposta = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ usuario, senha })
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    mostrarMensagemLogin(dados.erro || "Usuário ou senha inválidos.");
    return;
  }

  window.location.href = "index.html";
}

async function verificarLogin() {
  try {
    const resposta = await fetch("/api/me");
    const dados = await resposta.json();

    if (!resposta.ok || !dados.logado) {
      window.location.href = "login.html";
      return false;
    }

    window.usuarioAtualChave = encodeURIComponent(
      String(dados.id ?? dados.usuario)
    );

    const nomeUsuarioHeader = document.getElementById("nomeUsuarioHeader");

    if (nomeUsuarioHeader) {
      nomeUsuarioHeader.textContent = dados.usuario;
    }

    if (dados.admin) {
      const solicitacoesWrap = document.getElementById("solicitacoesWrap");

      if (solicitacoesWrap) {
        solicitacoesWrap.style.display = "block";
        carregarSolicitacoesPendentes();
      }
    }

    return true;
  } catch (error) {
    console.error("Erro ao verificar login:", error);
    window.location.href = "login.html";
    return false;
  }
}

async function sairConta() {
  await fetch("/api/logout");
  window.location.href = "login.html";
}

function togglePainelSolicitacoes() {
  const painel = document.getElementById("painelSolicitacoes");

  if (!painel) return;

  painel.style.display = painel.style.display === "block" ? "none" : "block";
}

async function carregarSolicitacoesPendentes() {
  const resposta = await fetch("/api/solicitacoes");

  if (!resposta.ok) {
    return;
  }

  const solicitacoes = await resposta.json();

  const qtdSolicitacoes = document.getElementById("qtdSolicitacoes");
  const listaSolicitacoes = document.getElementById("listaSolicitacoes");

  if (qtdSolicitacoes) {
    qtdSolicitacoes.textContent = solicitacoes.length;
    qtdSolicitacoes.style.display = solicitacoes.length > 0 ? "inline-flex" : "none";
  }

  if (!listaSolicitacoes) return;

  if (solicitacoes.length === 0) {
    listaSolicitacoes.innerHTML = `<p class="sem-solicitacoes">Nenhuma solicitação pendente.</p>`;
    return;
  }

  listaSolicitacoes.innerHTML = solicitacoes.map(solicitacao => `
    <div class="solicitacao-item">
      <div>
        <strong>${solicitacao.usuario}</strong>
        <span>Solicitado em ${solicitacao.solicitado_em}</span>
      </div>

      <div class="solicitacao-actions">
        <button type="button" class="btn-aprovar" onclick="responderSolicitacao(${solicitacao.id}, 'aprovar')">
          Aceitar
        </button>

        <button type="button" class="btn-recusar" onclick="responderSolicitacao(${solicitacao.id}, 'recusar')">
          Recusar
        </button>
      </div>
    </div>
  `).join("");
}

async function responderSolicitacao(id, acao) {
  const resposta = await fetch("/api/solicitacoes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id, acao })
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    alert(dados.erro || "Erro ao responder solicitação.");
    return;
  }

  carregarSolicitacoesPendentes();
}

function toggleMenuUsuario() {
  const menu = document.getElementById("menuUsuario");

  if (!menu) {
    alert("Menu do usuário não encontrado.");
    return;
  }

  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function abrirModalSenha() {
  const modal = document.getElementById("modalSenha");
  const menu = document.getElementById("menuUsuario");

  if (menu) {
    menu.style.display = "none";
  }

  if (!modal) {
    alert("Modal de senha não encontrado.");
    return;
  }

  modal.style.display = "flex";
  limparCamposSenha();
}

function fecharModalSenha() {
  const modal = document.getElementById("modalSenha");

  if (modal) {
    modal.style.display = "none";
  }

  limparCamposSenha();
}

function limparCamposSenha() {
  const senhaAtual = document.getElementById("senhaAtualReset");
  const novaSenha = document.getElementById("novaSenhaReset");
  const confirmarSenha = document.getElementById("confirmarSenhaReset");
  const status = document.getElementById("statusResetSenha");

  if (senhaAtual) senhaAtual.value = "";
  if (novaSenha) novaSenha.value = "";
  if (confirmarSenha) confirmarSenha.value = "";
  if (status) status.textContent = "";
}

async function alterarSenha() {
  const senhaAtual = document.getElementById("senhaAtualReset").value.trim();
  const novaSenha = document.getElementById("novaSenhaReset").value.trim();
  const confirmarSenha = document.getElementById("confirmarSenhaReset").value.trim();
  const status = document.getElementById("statusResetSenha");

  if (!senhaAtual || !novaSenha || !confirmarSenha) {
    status.textContent = "Preencha todos os campos.";
    return;
  }

  if (novaSenha.length < 6) {
    status.textContent = "A nova senha precisa ter pelo menos 6 caracteres.";
    return;
  }

  if (novaSenha !== confirmarSenha) {
    status.textContent = "As senhas não conferem.";
    return
  }

  const resposta = await fetch("/api/alterar-senha", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      senhaAtual,
      novaSenha,
      confirmarSenha
    })
  });

  const dados = await resposta.json();

  if (!resposta.ok) {
    status.textContent = dados.erro || "Erro ao alterar senha.";
    return;
  }

  status.textContent = "Senha alterada com sucesso!";

  setTimeout(() => {
    fecharModalSenha();
  }, 1200);
}
