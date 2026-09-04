/*
  Pasta: js
  Arquivo: api.js

  Comunicação com o banco de dados PostgreSQL.
*/

function normalizarTipoParaAPI(tipo) {
  const valor = String(tipo || "").trim().toLowerCase();

  if (valor === "receita") return "Receita";
  if (valor === "despesa") return "Despesa";
  if (valor === "vales" || valor === "vale") return "Vales";

  return String(tipo || "").trim();
}

function normalizarPagamentoParaAPI(pagamento) {
  const valor = String(pagamento || "").trim().toLowerCase();

  if (valor === "pix") return "PIX";
  if (valor === "debito" || valor === "débito") return "Debito";
  if (valor === "credito" || valor === "crédito") return "Credito";
  if (valor === "cartao a" || valor === "cartão a") return "Cartão A";
  if (valor === "cartao p" || valor === "cartão p") return "Cartão P";

  return String(pagamento || "").trim();
}

function montarPayloadLancamento(dados) {
  const payload = {
    data: String(dados.data || "").trim(),
    tipo: normalizarTipoParaAPI(dados.tipo),
    descricao: String(dados.descricao || "").trim(),
    categoria: String(dados.categoria || "").trim(),
    valor: dados.valor,
    pagamento: normalizarPagamentoParaAPI(dados.pagamento || dados.FormaPagamento),
    parcelado: !!dados.parcelado
  };

  if (dados.parcelado && Array.isArray(dados.parcelas)) {
    payload.valorTotalCompra = dados.valorTotalCompra ?? dados.valor;
    payload.totalParcelas = Number(dados.totalParcelas);
    payload.modoParcelas = dados.modoParcelas || "iguais";
    payload.parcelas = dados.parcelas.map((parcela, indice) => ({
      parcelaAtual: indice + 1,
      data: String(parcela.data || "").trim(),
      valor: Number(parcela.valor),
      paga: !!parcela.paga
    }));
  }

  return payload;
}

async function buscarLancamentosBanco() {
  const resposta = await fetch("/api/lancamentos");

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao buscar lançamentos do banco");
  }

  return Array.isArray(dados) ? dados : [];
}

async function salvarLancamentoBanco(lancamento) {
  const resposta = await fetch("/api/lancamentos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(lancamento)
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao salvar lançamento no banco");
  }

  return dados;
}

async function atualizarLancamentoBanco(lancamento) {
  const resposta = await fetch("/api/lancamentos", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(lancamento)
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao atualizar lançamento no banco");
  }

  return dados;
}

async function excluirLancamentoBanco(id) {
  const resposta = await fetch("/api/lancamentos", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id })
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao excluir lançamento no banco");
  }

  return dados;
}

async function atualizarStatusParcelaAPI(id, parcelaPaga) {
  const resposta = await fetch("/api/lancamentos", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, parcelaPaga: !!parcelaPaga })
  });

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || "Erro ao atualizar status da parcela");
  return dados;
}

async function excluirParcelamentoAPI(grupoParcelamento) {
  const resposta = await fetch("/api/lancamentos", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grupoParcelamento })
  });

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || "Erro ao excluir parcelamento");
  return dados;
}

/*
  Estas funções mantêm os mesmos nomes antigos.
  Assim o restante do site continua chamando carregarDadosAPI(),
  salvarLancamentoAPI(), atualizarLancamentoAPI() e excluirLancamentoAPI().
*/

async function carregarDadosAPI() {
  const dados = await buscarLancamentosBanco();

  return dados.map((item, indice) => {
    const normalizado = typeof normalizarLancamento === "function"
      ? normalizarLancamento(item, indice)
      : item;

    return {
      ...normalizado,
      origem: item.origem || normalizado.origem || "site"
    };
  });
}

async function salvarLancamentoAPI(novo) {
  const payload = montarPayloadLancamento(novo);

  console.log("Salvando lançamento no banco:", payload);

  const salvo = await salvarLancamentoBanco(payload);

  return {
    success: true,
    dados: salvo,
    message: novo.parcelado ? "Parcelamento criado com sucesso" : "Lançamento salvo com sucesso"
  };
}

async function atualizarLancamentoAPI(lancamento) {
  const payload = montarPayloadLancamento(lancamento);

  console.log("Atualizando lançamento no banco:", {
    id: lancamento.id,
    dados: payload
  });

  const atualizado = await atualizarLancamentoBanco({
    id: lancamento.id,
    ...payload
  });

  return {
    success: true,
    dados: atualizado,
    message: "Lançamento atualizado com sucesso"
  };
}

async function excluirLancamentoAPI(id) {
  console.log("Excluindo lançamento no banco:", id);

  const excluido = await excluirLancamentoBanco(id);

  return {
    success: true,
    dados: excluido,
    message: "Lançamento excluído com sucesso"
  };
}
function montarPayloadGastoFixo(dados) {
  return {
    id: dados.id,
    descricao: String(dados.descricao || "").trim(),
    categoria: String(dados.categoria || "").trim(),
    valorPrevisto: dados.valorPrevisto ?? dados.valor_previsto,
    diaVencimento: dados.diaVencimento ?? dados.dia_vencimento,
    pagamento: normalizarPagamentoParaAPI(dados.pagamento),
    mesReferencia: dados.mesReferencia ?? dados.mes_referencia ?? ""
  };
}

async function buscarGastosFixosAPI(mesReferencia = "") {
  const params = new URLSearchParams();

  if (mesReferencia) {
    params.set("mesReferencia", mesReferencia);
  }

  const url = params.toString()
    ? `/api/gastos-fixos?${params.toString()}`
    : "/api/gastos-fixos";

const separador = url.includes("?") ? "&" : "?";

const resposta = await fetch(
  `${url}${separador}_=${Date.now()}`,
  {
    cache: "no-store"
  }
);
  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao buscar gastos fixos");
  }

  return dados;
}

async function salvarGastoFixoAPI(gasto) {
  const payload = montarPayloadGastoFixo(gasto);

  const resposta = await fetch("/api/gastos-fixos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao salvar gasto fixo");
  }

  return {
    success: true,
    dados,
    message: "Gasto fixo salvo com sucesso"
  };
}

async function atualizarGastoFixoAPI(gasto) {
  const payload = montarPayloadGastoFixo(gasto);

  const resposta = await fetch("/api/gastos-fixos", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao atualizar gasto fixo");
  }

  return {
    success: true,
    dados,
    message: "Gasto fixo atualizado com sucesso"
  };
}

async function excluirGastoFixoAPI(id, mesReferencia = "") {
  const resposta = await fetch("/api/gastos-fixos", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      id,
      mesReferencia
    })
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao excluir gasto fixo");
  }

  return {
    success: true,
    dados,
    message: "Gasto fixo excluído com sucesso"
  };
}

async function pagarGastoFixoAPI(dadosPagamento) {
  const resposta = await fetch("/api/gastos-fixos-pagar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(dadosPagamento)
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao marcar gasto fixo como pago");
  }

  return {
    success: true,
    dados,
    message: "Gasto fixo marcado como pago"
  };
}
async function buscarAgendamentosAPI() {
  const resposta = await fetch("/api/agendamentos");

  const dados = await resposta.json().catch(() => ([]));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao buscar agendamentos");
  }

  return Array.isArray(dados) ? dados : [];
}

async function salvarAgendamentoAPI(agendamento) {
  const resposta = await fetch("/api/agendamentos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(
      montarPayloadLancamento(agendamento)
    )
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao salvar agendamento");
  }

  return dados;
}

async function excluirAgendamentoAPI(id) {
  const resposta = await fetch("/api/agendamentos", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id })
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(dados.erro || "Erro ao excluir agendamento");
  }

  return dados;
}

async function processarAgendamentosAPI() {
  const resposta = await fetch("/api/agendamentos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      acao: "processar"
    })
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(
      dados.erro || "Erro ao processar agendamentos"
    );
  }

  return dados;
}