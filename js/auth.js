function mostrarMensagemLogin(texto) {
  const status = document.getElementById("loginStatus");

  if (status) {
    status.textContent = texto;
  } else {
    alert(texto);
  }
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
    window.contaAtual = dados;

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

// Sininho e cadastro por e-mail são gerenciados em conta-ui.js.

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
  const senhaAtual = document.getElementById("senhaAtualReset").value;
  const novaSenha = document.getElementById("novaSenhaReset").value;
  const confirmarSenha = document.getElementById("confirmarSenhaReset").value;
  const status = document.getElementById("statusResetSenha");

  status.classList.add('mensagem-erro');
  if (!senhaAtual || !novaSenha || !confirmarSenha) {
    status.textContent = "Preencha todos os campos.";
    return;
  }

  if (novaSenha.length < 8) {
    status.textContent = "A nova senha precisa ter pelo menos 8 caracteres.";
    return;
  }

  if (novaSenha !== confirmarSenha) {
    status.textContent = "As senhas não conferem.";
    return
  }

  try {
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

  status.classList.remove("mensagem-erro");
  status.textContent = "Senha alterada com sucesso!";

  setTimeout(() => {
    fecharModalSenha();
  }, 1200);
  } catch {
    status.textContent = "Não foi possível alterar a senha. Tente novamente.";
  }
}
