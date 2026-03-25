const ANO_DASHBOARD_ANUAL = 2026;

const VENDEDORES_FIXOS = [
  "George Nunes",
  "Lucas Gottqtroy",
  "Diego Pinto",
  "Bernardo Jorge"
];

const PASTA_AUDITORIA_ID = "1tOdToGJelmhNaTmTEqa5Ke0zybKYqQm2";

const SIGLAS_VENDEDORES = {
  "Lucas Gottqtroy": "LG",
  "Bernardo Jorge": "BJ",
  "George Nunes": "GN",
  "Diego Pinto": "DP"
};

function onOpen() {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("Auditoria")
      .addItem("Atualizar Dashboard", "atualizarTudo")
      .addItem("Atualizar Sistema Completo", "atualizarTudoCompleto")
      .addSeparator()
      .addItem("Gerar PDFs antigos", "processarPDFsAntigos")
      .addToUi();
  } catch (e) {
    Logger.log("onOpen executado fora da interface da planilha: " + e.message);
  }
}

function getPlanilha() {
  try {
    const form = FormApp.getActiveForm();
    const destinoId = form.getDestinationId();
    if (destinoId) {
      return SpreadsheetApp.openById(destinoId);
    }
  } catch (e) {}

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;

  throw new Error("Não foi possível localizar a planilha vinculada.");
}

function getFormulario() {
  try {
    return FormApp.getActiveForm();
  } catch (e) {}

  const ss = getPlanilha();
  const formUrl = ss.getFormUrl();
  if (!formUrl) {
    throw new Error("Não foi possível localizar o formulário vinculado à planilha.");
  }

  return FormApp.openByUrl(formUrl);
}

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function obterChaveMes(data) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  return `${mes}-${ano}`;
}

function limparGraficos(sheet) {
  const charts = sheet.getCharts();
  charts.forEach(chart => sheet.removeChart(chart));
}

function criarResumoVazioVendedor() {
  return {
    auditorias: 0,
    erros: 0,
    itensAuditados: 0,
    contratosComErro: 0,
    contratosOk: 0
  };
}

function obterNomesVendedoresFixos() {
  return VENDEDORES_FIXOS.slice();
}

function normalizarVendedorParaBase(nomeBruto) {
  const nome = String(nomeBruto || "").trim();

  if (VENDEDORES_FIXOS.includes(nome)) {
    return nome;
  }

  return "Vendedor não mapeado";
}

function obterVendedoresOrdenados(mapaVendedores) {
  const fixos = obterNomesVendedoresFixos();
  const existentes = Object.keys(mapaVendedores || {});
  const extras = existentes.filter(nome => !fixos.includes(nome)).sort();

  if (extras.includes("Vendedor não mapeado")) {
    const semNaoMapeado = extras.filter(nome => nome !== "Vendedor não mapeado");
    return fixos.concat(semNaoMapeado).concat(["Vendedor não mapeado"]);
  }

  return fixos.concat(extras);
}

function ehRespostaAuditavel(valor) {
  const texto = normalizarTexto(valor);
  return (
    texto === "conforme" ||
    texto === "nao conforme" ||
    texto === "nao foram sequer passados"
  );
}

function ehNaoConforme(valor) {
  const texto = normalizarTexto(valor);
  return (
    texto === "nao conforme" ||
    texto === "nao foram sequer passados"
  );
}

function contarNaoConformesNaLinha(linha) {
  let total = 0;

  for (let i = 0; i < linha.length; i++) {
    if (ehNaoConforme(linha[i])) {
      total++;
    }
  }

  return total;
}

function contarItensAuditadosNaLinha(linha) {
  let total = 0;

  for (let i = 0; i < linha.length; i++) {
    if (ehRespostaAuditavel(linha[i])) {
      total++;
    }
  }

  return total;
}

function detectarErrosDaLinha(linha) {
  const erros = [];
  const texto = normalizarTexto(linha.join(" | "));
  const naoConformeCount = contarNaoConformesNaLinha(linha);

  if (naoConformeCount === 0) return erros;

  function add(nome) {
    if (!erros.includes(nome)) erros.push(nome);
  }

  if (
    texto.includes("faltando os documentos") ||
    texto.includes("documento faltando") ||
    texto.includes("falta") ||
    texto.includes("nao esta completa") ||
    texto.includes("nao está completa") ||
    texto.includes("pasta incompleta")
  ) {
    add("Documento faltando");
  }

  if (
    texto.includes("renomeado errado") ||
    texto.includes("renomeacao sugerida") ||
    texto.includes("scan0001") ||
    texto.includes(".jpg") ||
    texto.includes("arquivo generico") ||
    texto.includes("arquivo genérico")
  ) {
    add("Arquivo renomeado incorretamente");
  }

  if (
    (texto.includes("nome") ||
      texto.includes("cpf") ||
      texto.includes("endereco") ||
      texto.includes("cep") ||
      texto.includes("telefone") ||
      texto.includes("email")) &&
    (texto.includes("errado") ||
      texto.includes("incorreto") ||
      texto.includes("divergente") ||
      texto.includes("nao conforme"))
  ) {
    add("Dados do cliente incorretos");
  }

  if (
    texto.includes("plano incorreto") ||
    (texto.includes("plano") &&
      (texto.includes("errado") ||
        texto.includes("incorreto") ||
        texto.includes("divergente")))
  ) {
    add("Plano incorreto");
  }

  if (
    texto.includes("bitrix") ||
    texto.includes("informacao divergente no sistema") ||
    texto.includes("informacao divergente no bitrix")
  ) {
    add("Informação divergente no Bitrix/Sistema");
  }

  if (
    texto.includes("contrato") &&
    (texto.includes("errado") ||
      texto.includes("incorreto") ||
      texto.includes("corrigir contrato") ||
      texto.includes("campos"))
  ) {
    add("Erro no contrato");
  }

  if (
    texto.includes("planner") ||
    texto.includes("tarefa") ||
    texto.includes("tarefas")
  ) {
    if (texto.includes("nao conforme")) {
      add("Tarefas não criadas/cadastradas corretamente");
    }
  }

  if (
    texto.includes("whatsapp") ||
    texto.includes("grupo") ||
    texto.includes("participantes")
  ) {
    if (texto.includes("nao conforme")) {
      add("Erro no grupo/contato de WhatsApp");
    }
  }

  if (texto.includes("prazo") || texto.includes("prazos")) {
    if (
      texto.includes("nao conforme") ||
      texto.includes("nao foram sequer passados")
    ) {
      add("Prazos informados incorretamente");
    }
  }

  if (erros.length > naoConformeCount) {
    return erros.slice(0, naoConformeCount);
  }

  while (erros.length < naoConformeCount) {
    add("Outro erro identificado");
    if (erros.length === naoConformeCount) break;
  }

  return erros;
}

function contarTopErros(logErros, limite) {
  const contagem = {};

  (logErros || []).forEach(linha => {
    const erro = String(linha[3] || "").trim();
    if (!erro) return;
    contagem[erro] = (contagem[erro] || 0) + 1;
  });

  return Object.keys(contagem)
    .map(erro => [erro, contagem[erro]])
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "pt-BR");
    })
    .slice(0, limite || 3);
}

function definirStatusPorNaoConformidade(qtdErros) {
  if (qtdErros === 0) return "OK";
  if (qtdErros === 1) return "Atenção";
  if (qtdErros >= 2 && qtdErros <= 3) return "Crítico";
  return "Reunião com a gerência";
}

function gerarResumoMensal() {
  const ss = getPlanilha();
  const origem = ss.getSheetByName("Respostas ao formulário 1");

  if (!origem) {
    throw new Error('A aba "Respostas ao formulário 1" não foi encontrada.');
  }

  const dados = origem.getDataRange().getValues();
  if (dados.length < 2) return {};

  const COL_DATA = 0;
  const COL_VENDEDOR = 2;
  const COL_PASTA = 4;

  const resumoPorMes = {};

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const dataResposta = linha[COL_DATA];
    const vendedorBruto = linha[COL_VENDEDOR];
    const vendedor = normalizarVendedorParaBase(vendedorBruto);
    const pasta = linha[COL_PASTA];
    const erros = detectarErrosDaLinha(linha);
    const itensAuditados = contarItensAuditadosNaLinha(linha);

    if (!(dataResposta instanceof Date)) continue;
    if (!vendedor || String(vendedor).trim() === "") continue;

    const chaveMes = obterChaveMes(dataResposta);

    if (!resumoPorMes[chaveMes]) {
      resumoPorMes[chaveMes] = {
        vendedores: {},
        logErros: []
      };
    }

    if (!resumoPorMes[chaveMes].vendedores[vendedor]) {
      resumoPorMes[chaveMes].vendedores[vendedor] = criarResumoVazioVendedor();
    }

    resumoPorMes[chaveMes].vendedores[vendedor].auditorias += 1;
    resumoPorMes[chaveMes].vendedores[vendedor].erros += erros.length;
    resumoPorMes[chaveMes].vendedores[vendedor].itensAuditados += itensAuditados;

    if (erros.length > 0) {
      resumoPorMes[chaveMes].vendedores[vendedor].contratosComErro += 1;
    } else {
      resumoPorMes[chaveMes].vendedores[vendedor].contratosOk += 1;
    }

    erros.forEach(tipo => {
      resumoPorMes[chaveMes].logErros.push([
        dataResposta,
        pasta || "",
        vendedor,
        tipo
      ]);
    });
  }

  return resumoPorMes;
}

function gerarResumoAnual(ano) {
  const ss = getPlanilha();
  const origem = ss.getSheetByName("Respostas ao formulário 1");

  if (!origem) {
    throw new Error('A aba "Respostas ao formulário 1" não foi encontrada.');
  }

  const dados = origem.getDataRange().getValues();
  if (dados.length < 2) {
    return {
      vendedores: {},
      logErros: []
    };
  }

  const COL_DATA = 0;
  const COL_VENDEDOR = 2;
  const COL_PASTA = 4;

  const resumoAno = {
    vendedores: {},
    logErros: []
  };

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const dataResposta = linha[COL_DATA];
    const vendedorBruto = linha[COL_VENDEDOR];
    const vendedor = normalizarVendedorParaBase(vendedorBruto);
    const pasta = linha[COL_PASTA];
    const erros = detectarErrosDaLinha(linha);
    const itensAuditados = contarItensAuditadosNaLinha(linha);

    if (!(dataResposta instanceof Date)) continue;
    if (dataResposta.getFullYear() !== ano) continue;
    if (!vendedor || String(vendedor).trim() === "") continue;

    if (!resumoAno.vendedores[vendedor]) {
      resumoAno.vendedores[vendedor] = criarResumoVazioVendedor();
    }

    resumoAno.vendedores[vendedor].auditorias += 1;
    resumoAno.vendedores[vendedor].erros += erros.length;
    resumoAno.vendedores[vendedor].itensAuditados += itensAuditados;

    if (erros.length > 0) {
      resumoAno.vendedores[vendedor].contratosComErro += 1;
    } else {
      resumoAno.vendedores[vendedor].contratosOk += 1;
    }

    erros.forEach(tipo => {
      resumoAno.logErros.push([
        dataResposta,
        pasta || "",
        vendedor,
        tipo
      ]);
    });
  }

  return resumoAno;
}

function onFormSubmit(e) {
  atualizarTudo();

  try {
    gerarPDFDaRespostaDoEvento(e);
  } catch (erro) {
    Logger.log("Erro ao gerar PDF da auditoria: " + erro.message);
  }
}

function organizarPorVendedor() {
  const ss = getPlanilha();
  const origem = ss.getSheetByName("Respostas ao formulário 1");

  if (!origem) {
    throw new Error('A aba "Respostas ao formulário 1" não foi encontrada.');
  }

  const dados = origem.getDataRange().getValues();
  if (dados.length < 2) return;

  const cabecalho = dados[0];
  const COL_VENDEDOR = 2;
  const linhasPorVendedor = {};

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const vendedorBruto = linha[COL_VENDEDOR];
    const vendedor = normalizarVendedorParaBase(vendedorBruto);

    if (!vendedor || String(vendedor).trim() === "") continue;

    if (!linhasPorVendedor[vendedor]) {
      linhasPorVendedor[vendedor] = [];
    }
    linhasPorVendedor[vendedor].push(linha);
  }

  const abasFixas = [
    "Respostas ao formulário 1",
    "Histórico Geral",
    `Dashboard Anual ${ANO_DASHBOARD_ANUAL}`
  ];

  const resumoPorMes = gerarResumoMensal();
  Object.keys(resumoPorMes).forEach(chaveMes => abasFixas.push(`Dashboard ${chaveMes}`));

  const abasAtuais = ss.getSheets().map(s => s.getName());
  abasAtuais.forEach(nomeAba => {
    if (!abasFixas.includes(nomeAba) && !linhasPorVendedor[nomeAba]) {
      const sheet = ss.getSheetByName(nomeAba);
      if (sheet) ss.deleteSheet(sheet);
    }
  });

  Object.keys(linhasPorVendedor).forEach(vendedor => {
    let aba = ss.getSheetByName(vendedor);

    if (!aba) {
      aba = ss.insertSheet(vendedor);
    } else {
      aba.clear();
      limparGraficos(aba);
    }

    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);

    const linhas = linhasPorVendedor[vendedor];
    if (linhas.length > 0) {
      aba.getRange(2, 1, linhas.length, linhas[0].length).setValues(linhas);
    }

    formatarAbaVendedor(aba, cabecalho.length, linhas.length + 1);
  });
}

function atualizarDashboardMensal() {
  const resumoPorMes = gerarResumoMensal();
  const hoje = new Date();
  const chaveMesAtual = obterChaveMes(hoje);
  const resumoMesAtual = resumoPorMes[chaveMesAtual] || { vendedores: {}, logErros: [] };
  criarOuAtualizarDashboardDoMes(chaveMesAtual, resumoMesAtual);
}

function atualizarTodosDashboardsMensais() {
  const resumoPorMes = gerarResumoMensal();
  const meses = Object.keys(resumoPorMes).sort();

  if (meses.length === 0) {
    const hoje = new Date();
    const chaveMesAtual = obterChaveMes(hoje);
    criarOuAtualizarDashboardDoMes(chaveMesAtual, { vendedores: {}, logErros: [] });
    return;
  }

  meses.forEach(chaveMes => {
    criarOuAtualizarDashboardDoMes(chaveMes, resumoPorMes[chaveMes]);
  });
}

function atualizarDashboardAnual() {
  const resumoAno = gerarResumoAnual(ANO_DASHBOARD_ANUAL);
  criarOuAtualizarDashboardAnual(ANO_DASHBOARD_ANUAL, resumoAno);
}

function escreverTop3Erros(sheet, logErros) {
  const top3 = contarTopErros(logErros, 3);

  sheet.getRange("I2:J2").breakApart();
  sheet.getRange("I2:J2").merge();
  sheet.getRange("I2").setValue("TOP 3 ERROS");

  const linhas = [
    ["🥇", ""],
    ["🥈", ""],
    ["🥉", ""]
  ];

  for (let i = 0; i < top3.length; i++) {
    linhas[i] = [`${["🥇", "🥈", "🥉"][i]} ${top3[i][0]}`, top3[i][1]];
  }

  sheet.getRange(3, 9, 3, 2).setValues(linhas);

  sheet.getRange("I2:J2")
    .setBackground("#1F4E78")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange(3, 9, 3, 2)
    .setBackground("#D9EAF7")
    .setFontWeight("bold")
    .setVerticalAlignment("middle");

  sheet.getRange(3, 9, 3, 1).setHorizontalAlignment("left");
  sheet.getRange(3, 10, 3, 1).setHorizontalAlignment("center");

  sheet.setColumnWidth(9, 260);
  sheet.setColumnWidth(10, 60);
}

function criarOuAtualizarDashboardDoMes(chaveMes, resumoMes) {
  const ss = getPlanilha();
  const nomeAba = `Dashboard ${chaveMes}`;

  let dashboard = ss.getSheetByName(nomeAba);
  if (!dashboard) {
    dashboard = ss.insertSheet(nomeAba);
  } else {
    dashboard.clear();
    limparGraficos(dashboard);
  }

  dashboard.setTabColor("#1F4E78");

  dashboard.getRange("A1:H1").breakApart();
  dashboard.getRange("A1:H1").merge();
  dashboard.getRange("A1").setValue(`Dashboard de Auditoria Pós-Venda | ${chaveMes}`);

  const cabecalhoResumo = [
    "Vendedor",
    "Auditorias do mês",
    "Erros do mês",
    "Taxa de erro",
    "Contratos OK",
    "Contratos com erro",
    "Aproveitamento",
    "Status"
  ];
  dashboard.getRange(2, 1, 1, 8).setValues([cabecalhoResumo]);

  const vendedores = obterVendedoresOrdenados(resumoMes.vendedores || {});
  const saidaResumo = vendedores.map(vendedor => {
    const base = resumoMes.vendedores[vendedor] || criarResumoVazioVendedor();
    const auditorias = base.auditorias;
    const erros = base.erros;
    const itensAuditados = base.itensAuditados || 0;
    const contratosOk = base.contratosOk || 0;
    const contratosComErro = base.contratosComErro || 0;

    const taxa = itensAuditados > 0 ? erros / itensAuditados : 0;
    const aproveitamento = auditorias > 0 ? contratosOk / auditorias : 0;
    const status = auditorias === 0 ? "Sem auditoria" : definirStatusPorNaoConformidade(erros);

    return [
      vendedor,
      auditorias,
      erros,
      taxa,
      contratosOk,
      contratosComErro,
      aproveitamento,
      status
    ];
  });

  if (saidaResumo.length > 0) {
    dashboard.getRange(3, 1, saidaResumo.length, 8).setValues(saidaResumo);
  }

  escreverTop3Erros(dashboard, resumoMes.logErros || []);

  const logInicioLinha = 22;
  const logInicioColuna = 1;

  dashboard.getRange(logInicioLinha, logInicioColuna, 1, 4).breakApart();
  dashboard.getRange(logInicioLinha, logInicioColuna, 1, 4).merge();
  dashboard.getRange(logInicioLinha, logInicioColuna).setValue("Não Conformidades Detectadas");

  dashboard.getRange(logInicioLinha + 1, logInicioColuna, 1, 4).setValues([[
    "Data",
    "Pasta Bitrix",
    "Vendedor",
    "Não conformidade"
  ]]);

  const logErros = resumoMes.logErros || [];
  if (logErros.length > 0) {
    dashboard.getRange(logInicioLinha + 2, logInicioColuna, logErros.length, 4).setValues(logErros);
    dashboard.getRange(logInicioLinha + 2, logInicioColuna, logErros.length, 1).setNumberFormat("dd/MM/yyyy");
  }

  formatarAbaDashboard(
    dashboard,
    saidaResumo.length + 2,
    logInicioLinha,
    logErros.length
  );

  criarGraficosDashboard(dashboard, saidaResumo.length);
  criarBotaoVisualDashboard(dashboard);
}

function criarOuAtualizarDashboardAnual(ano, resumoAno) {
  const ss = getPlanilha();
  const nomeAba = `Dashboard Anual ${ano}`;

  let dashboard = ss.getSheetByName(nomeAba);
  if (!dashboard) {
    dashboard = ss.insertSheet(nomeAba);
  } else {
    dashboard.clear();
    limparGraficos(dashboard);
  }

  dashboard.setTabColor("#1F4E78");

  dashboard.getRange("A1:H1").breakApart();
  dashboard.getRange("A1:H1").merge();
  dashboard.getRange("A1").setValue(`Dashboard Anual de Auditoria Pós-Venda | ${ano}`);

  const cabecalhoResumo = [
    "Vendedor",
    "Auditorias do ano",
    "Erros do ano",
    "Taxa de erro",
    "Contratos OK",
    "Contratos com erro",
    "Aproveitamento",
    "Status"
  ];
  dashboard.getRange(2, 1, 1, 8).setValues([cabecalhoResumo]);

  const vendedores = obterVendedoresOrdenados(resumoAno.vendedores || {});
  const saidaResumo = vendedores.map(vendedor => {
    const base = resumoAno.vendedores[vendedor] || criarResumoVazioVendedor();
    const auditorias = base.auditorias;
    const erros = base.erros;
    const itensAuditados = base.itensAuditados || 0;
    const contratosOk = base.contratosOk || 0;
    const contratosComErro = base.contratosComErro || 0;

    const taxa = itensAuditados > 0 ? erros / itensAuditados : 0;
    const aproveitamento = auditorias > 0 ? contratosOk / auditorias : 0;
    const status = auditorias === 0 ? "Sem auditoria" : definirStatusPorNaoConformidade(erros);

    return [
      vendedor,
      auditorias,
      erros,
      taxa,
      contratosOk,
      contratosComErro,
      aproveitamento,
      status
    ];
  });

  if (saidaResumo.length > 0) {
    dashboard.getRange(3, 1, saidaResumo.length, 8).setValues(saidaResumo);
  }

  escreverTop3Erros(dashboard, resumoAno.logErros || []);

  const logInicioLinha = 22;
  const logInicioColuna = 1;

  dashboard.getRange(logInicioLinha, logInicioColuna, 1, 4).breakApart();
  dashboard.getRange(logInicioLinha, logInicioColuna, 1, 4).merge();
  dashboard.getRange(logInicioLinha, logInicioColuna).setValue("Não Conformidades Detectadas");

  dashboard.getRange(logInicioLinha + 1, logInicioColuna, 1, 4).setValues([[
    "Data",
    "Pasta Bitrix",
    "Vendedor",
    "Não conformidade"
  ]]);

  const logErros = resumoAno.logErros || [];
  if (logErros.length > 0) {
    dashboard.getRange(logInicioLinha + 2, logInicioColuna, logErros.length, 4).setValues(logErros);
    dashboard.getRange(logInicioLinha + 2, logInicioColuna, logErros.length, 1).setNumberFormat("dd/MM/yyyy");
  }

  formatarAbaDashboard(
    dashboard,
    saidaResumo.length + 2,
    logInicioLinha,
    logErros.length
  );

  criarGraficosDashboard(dashboard, saidaResumo.length);
  criarBotaoVisualDashboard(dashboard);
}

function criarGraficosDashboard(sheet, quantidadeLinhasDados) {
  if (quantidadeLinhasDados <= 0) return;

  const chart1 = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange(2, 1, quantidadeLinhasDados + 1, 3))
    .setPosition(10, 7, 0, 0)
    .setOption("title", "Auditorias x Erros por vendedor")
    .setOption("legend", { position: "top" })
    .setOption("height", 280)
    .setOption("width", 620)
    .build();

  sheet.insertChart(chart1);
}

function criarBotaoVisualDashboard(sheet) {
  sheet.getRange("K1:L2").breakApart();
  sheet.getRange("K1:L2").clearContent();
  sheet.getRange("K1:L2").merge();
  sheet.getRange("K1").setValue("🔄 ATUALIZAR AUDITORIA");

  sheet.getRange("K1:L2")
    .setBackground("#0B5394")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setBorder(true, true, true, true, true, true);

  sheet.getRange("M1:M2").breakApart();
  sheet.getRange("M1:M2").clearContent();
  sheet.getRange("M1:M2")
    .setBackground(null)
    .setBorder(false, false, false, false, false, false);

  sheet.setColumnWidth(11, 130);
  sheet.setColumnWidth(12, 130);
  sheet.setColumnWidth(13, 40);
}

function atualizarHistoricoGeral() {
  const ss = getPlanilha();
  const resumoPorMes = gerarResumoMensal();

  let historico = ss.getSheetByName("Histórico Geral");
  if (!historico) {
    historico = ss.insertSheet("Histórico Geral");
  } else {
    historico.clear();
    limparGraficos(historico);
  }

  historico.setTabColor("#5B3F8C");

  historico.getRange("A1:E1").breakApart();
  historico.getRange("A1:E1").merge();
  historico.getRange("A1").setValue("Histórico Geral de Auditoria");

  const cabecalho = [
    "Mês",
    "Vendedor",
    "Auditorias",
    "Erros",
    "Taxa de erro"
  ];
  historico.getRange(2, 1, 1, 5).setValues([cabecalho]);

  const meses = Object.keys(resumoPorMes).sort();
  const saida = [];

  meses.forEach(mes => {
    const vendedores = obterVendedoresOrdenados(resumoPorMes[mes].vendedores || {});
    vendedores.forEach(vendedor => {
      const base = resumoPorMes[mes].vendedores[vendedor] || criarResumoVazioVendedor();
      const auditorias = base.auditorias;
      const erros = base.erros;
      const itensAuditados = base.itensAuditados || 0;
      const taxa = itensAuditados > 0 ? erros / itensAuditados : 0;
      saida.push([mes, vendedor, auditorias, erros, taxa]);
    });
  });

  if (saida.length > 0) {
    historico.getRange(3, 1, saida.length, 5).setValues(saida);
  }

  formatarHistoricoGeral(historico, saida.length + 2);
}

function formatarAbaDashboard(sheet, ultimaLinhaPrincipal, logInicioLinha, quantidadeLogs) {
  sheet.setFrozenRows(2);

  sheet.getRange("A1:H1")
    .setBackground("#1F4E78")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(14)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange("A2:H2")
    .setBackground("#D9EAF7")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange(`A${logInicioLinha}:D${logInicioLinha}`)
    .setBackground("#0B5394")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange(logInicioLinha + 1, 1, 1, 4)
    .setBackground("#D9EAF7")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  if (ultimaLinhaPrincipal >= 3) {
    sheet.getRange(3, 1, ultimaLinhaPrincipal - 2, 8)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");

    sheet.getRange(3, 4, ultimaLinhaPrincipal - 2, 1)
      .setNumberFormat("0.00%");

    sheet.getRange(3, 7, ultimaLinhaPrincipal - 2, 1)
      .setNumberFormat("0.00%");

    sheet.getRange(3, 1, ultimaLinhaPrincipal - 2, 8)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);

    sheet.getRange(3, 5, ultimaLinhaPrincipal - 2, 1)
      .setFontColor("#0B8043")
      .setFontWeight("bold");

    sheet.getRange(3, 6, ultimaLinhaPrincipal - 2, 1)
      .setFontColor("#C62828")
      .setFontWeight("bold");

    const statusRange = sheet.getRange(3, 8, ultimaLinhaPrincipal - 2, 1);
    const statusValues = statusRange.getValues();

    for (let i = 0; i < statusValues.length; i++) {
      const celula = statusRange.getCell(i + 1, 1);
      const valor = normalizarTexto(statusValues[i][0]);

      if (valor === "sem auditoria") {
        celula.setBackground("#EDEDED").setFontColor("#666666").setFontWeight("bold");
      } else if (valor === "reuniao com a gerencia") {
        celula.setBackground("#D9D2E9").setFontColor("#4C1130").setFontWeight("bold");
      } else if (valor === "critico") {
        celula.setBackground("#F4CCCC").setFontColor("#990000").setFontWeight("bold");
      } else if (valor === "atencao") {
        celula.setBackground("#FCE5CD").setFontColor("#B45F06").setFontWeight("bold");
      } else if (valor === "ok") {
        celula.setBackground("#D9EAD3").setFontColor("#274E13").setFontWeight("bold");
      }
    }
  }

  if (quantidadeLogs > 0) {
    sheet.getRange(logInicioLinha + 2, 1, quantidadeLogs, 4)
      .setVerticalAlignment("middle")
      .applyRowBanding(SpreadsheetApp.BandingTheme.TEAL);

    sheet.getRange(logInicioLinha + 2, 1, quantidadeLogs, 1)
      .setHorizontalAlignment("center");

    sheet.getRange(logInicioLinha + 2, 2, quantidadeLogs, 2)
      .setHorizontalAlignment("center");

    sheet.getRange(logInicioLinha + 2, 4, quantidadeLogs, 1)
      .setHorizontalAlignment("left")
      .setWrap(true);

    for (let i = 0; i < quantidadeLogs; i++) {
      sheet.setRowHeight(logInicioLinha + 2 + i, 28);
    }
  }

  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 140);
  sheet.setColumnWidth(4, 320);
  sheet.setColumnWidth(5, 115);
  sheet.setColumnWidth(6, 135);
  sheet.setColumnWidth(7, 120);
  sheet.setColumnWidth(8, 180);

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }

  const linhasFiltro = Math.max(quantidadeLogs + 1, 1);
  sheet.getRange(logInicioLinha + 1, 1, linhasFiltro, 4).createFilter();
}

function formatarHistoricoGeral(sheet, ultimaLinha) {
  sheet.setFrozenRows(2);

  sheet.getRange("A1:E1")
    .setBackground("#5B3F8C")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setFontSize(14)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  sheet.getRange("A2:E2")
    .setBackground("#EADCF8")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  if (ultimaLinha >= 3) {
    sheet.getRange(3, 1, ultimaLinha - 2, 5)
      .setHorizontalAlignment("center")
      .setVerticalAlignment("middle");

    sheet.getRange(3, 5, ultimaLinha - 2, 1)
      .setNumberFormat("0.00%");

    sheet.getRange(3, 1, ultimaLinha - 2, 5)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }

  sheet.setColumnWidth(1, 100);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 100);
  sheet.setColumnWidth(5, 120);

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.getRange(2, 1, Math.max(ultimaLinha - 1, 1), 5).createFilter();
}

function formatarAbaVendedor(sheet, totalColunas, totalLinhas) {
  sheet.setFrozenRows(1);

  sheet.getRange(1, 1, 1, totalColunas)
    .setBackground("#5B3F8C")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  if (totalLinhas > 1) {
    sheet.getRange(2, 1, totalLinhas - 1, totalColunas)
      .setVerticalAlignment("middle")
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }

  for (let c = 1; c <= totalColunas; c++) {
    sheet.autoResizeColumn(c);
  }

  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.getRange(1, 1, Math.max(totalLinhas, 1), totalColunas).createFilter();
}

function atualizarTudo() {
  organizarPorVendedor();
  atualizarDashboardMensal();
  atualizarDashboardAnual();
  atualizarHistoricoGeral();
}

function atualizarTudoCompleto() {
  organizarPorVendedor();
  atualizarTodosDashboardsMensais();
  atualizarDashboardAnual();
  atualizarHistoricoGeral();
}

/* ===============================
   PDF / GOOGLE DRIVE
================================ */

function sanitizarNomeArquivoOuPasta(texto) {
  return String(texto || "")
    .replace(/[\\\/:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function obterOuCriarSubpasta(pastaPai, nomeSubpasta) {
  const nome = sanitizarNomeArquivoOuPasta(nomeSubpasta);
  const pastas = pastaPai.getFoldersByName(nome);

  if (pastas.hasNext()) {
    return pastas.next();
  }

  return pastaPai.createFolder(nome);
}

function formatarMesReferencia(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function gerarNomePDF(vendedor, pasta, cliente, naoConformes) {
  const sigla = SIGLAS_VENDEDORES[vendedor] || "XX";

  let resultado;
  if (naoConformes === 0) {
    resultado = "OK";
  } else if (naoConformes === 1) {
    resultado = "1 Não Conforme";
  } else {
    resultado = `${naoConformes} Não Conformes`;
  }

  const pastaLimpa = sanitizarNomeArquivoOuPasta(pasta);
  const clienteLimpo = sanitizarNomeArquivoOuPasta(cliente);

  return `${sigla} - ${pastaLimpa} - ${clienteLimpo} - ${resultado}.pdf`;
}

function arquivoJaExisteNaPasta(pasta, nomeArquivo) {
  const arquivos = pasta.getFilesByName(nomeArquivo);
  return arquivos.hasNext();
}

function salvarPDFNaPastaDoVendedorSemDuplicar(nomeArquivo, blobPDF, vendedor, dataReferencia) {
  const pastaRaiz = DriveApp.getFolderById(PASTA_AUDITORIA_ID);

  const nomeVendedor = sanitizarNomeArquivoOuPasta(vendedor || "Vendedor não mapeado");
  const pastaVendedor = obterOuCriarSubpasta(pastaRaiz, nomeVendedor);

  const dataBase = dataReferencia instanceof Date ? dataReferencia : new Date();
  const nomeMes = formatarMesReferencia(dataBase);
  const pastaMes = obterOuCriarSubpasta(pastaVendedor, nomeMes);

  if (arquivoJaExisteNaPasta(pastaMes, nomeArquivo)) {
    return null;
  }

  const arquivo = pastaMes.createFile(blobPDF);
  arquivo.setName(nomeArquivo);

  return arquivo;
}

function localizarIndiceCliente(cabecalho) {
  return cabecalho.findIndex(t => normalizarTexto(t).includes("nome do cliente"));
}

function extrairDadosParaPDF(cabecalho, linha) {
  const dataResposta = linha[0];
  const vendedorBruto = linha[2];
  const vendedor = normalizarVendedorParaBase(vendedorBruto);
  const pastaNumero = linha[4] || "";

  const indiceCliente = localizarIndiceCliente(cabecalho);
  const cliente = indiceCliente !== -1 ? (linha[indiceCliente] || "") : "";

  const naoConformes = contarNaoConformesNaLinha(linha);

  return {
    dataResposta,
    vendedor,
    pastaNumero,
    cliente,
    naoConformes
  };
}

function formatarValorParaPDF(valor) {
  if (valor instanceof Date) {
    return Utilities.formatDate(valor, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  }

  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor).trim();
}

function construirPerguntasERespostas(cabecalho, linha) {
  const itens = [];

  for (let i = 0; i < cabecalho.length; i++) {
    const pergunta = String(cabecalho[i] || "").trim();
    const resposta = formatarValorParaPDF(linha[i]);

    if (!pergunta && !resposta) continue;
    if (!pergunta) continue;

    itens.push({
      pergunta: pergunta,
      resposta: resposta || "-"
    });
  }

  return itens;
}

function obterLinhaDoEventoParaPDF(origem, e) {
  const ultimaColuna = origem.getLastColumn();

  if (e && e.range) {
    const numeroLinha = e.range.getRow();
    if (numeroLinha >= 2) {
      return origem.getRange(numeroLinha, 1, 1, ultimaColuna).getValues()[0];
    }
  }

  if (e && e.values && e.values.length) {
    return e.values;
  }

  const ultimaLinha = origem.getLastRow();
  if (ultimaLinha < 2) return null;

  return origem.getRange(ultimaLinha, 1, 1, ultimaColuna).getValues()[0];
}

function ehLink(valor) {
  const texto = String(valor || "").trim();
  return /^https?:\/\/\S+$/i.test(texto);
}

function extrairLinksDeUmTexto(texto) {
  const valor = String(texto || "");
  const encontrados = valor.match(/https?:\/\/[^\s]+/gi);
  return encontrados ? encontrados : [];
}

function extrairEvidenciasDosItens(perguntasERespostas) {
  const evidencias = [];

  (perguntasERespostas || []).forEach(item => {
    const pergunta = String(item.pergunta || "");
    const resposta = String(item.resposta || "");

    const links = [];

    if (ehLink(resposta)) {
      links.push(resposta);
    } else {
      extrairLinksDeUmTexto(resposta).forEach(link => links.push(link));
    }

    if (links.length > 0) {
      evidencias.push({
        pergunta: pergunta,
        links: links
      });
    }
  });

  return evidencias;
}

function respostaEhNaoConforme(resposta) {
  const texto = normalizarTexto(resposta);
  return texto === "nao conforme" || texto === "nao foram sequer passados";
}

function estilizarTituloPrincipal(paragrafo) {
  paragrafo
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setSpacingAfter(14);

  paragrafo.editAsText()
    .setBold(true)
    .setFontSize(18)
    .setForegroundColor("#1F1F1F");
}

function estilizarSubtitulo(paragrafo) {
  paragrafo
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setSpacingBefore(10)
    .setSpacingAfter(8);

  paragrafo.editAsText()
    .setBold(true)
    .setFontSize(13)
    .setForegroundColor("#1F4E78");
}

function adicionarLinhaResumoBonita(body, rotulo, valor) {
  const tabela = body.appendTable([
    [rotulo, valor || "-"]
  ]);

  tabela.setBorderWidth(0);

  const celulaRotulo = tabela.getCell(0, 0);
  const celulaValor = tabela.getCell(0, 1);

  celulaRotulo.setBackgroundColor("#D9EAF7");
  celulaValor.setBackgroundColor("#F8F9FA");

  celulaRotulo.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(8).setPaddingRight(8);
  celulaValor.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(8).setPaddingRight(8);

  celulaRotulo.getChild(0).asParagraph().editAsText()
    .setBold(true)
    .setFontSize(10)
    .setForegroundColor("#1F1F1F");

  celulaValor.getChild(0).asParagraph().editAsText()
    .setFontSize(10)
    .setForegroundColor("#222222");

  body.appendParagraph("");
}

function adicionarBlocoPerguntaResposta(body, indice, pergunta, resposta) {
  const tabela = body.appendTable([
    [`${indice}. ${pergunta}`],
    [`Resposta: ${resposta || "-"}`]
  ]);

  tabela.setBorderColor("#D9D9D9");
  tabela.setBorderWidth(1);

  const celulaPergunta = tabela.getCell(0, 0);
  const celulaResposta = tabela.getCell(1, 0);

  celulaPergunta.setBackgroundColor("#F3F6FA");
  celulaResposta.setBackgroundColor("#FFFFFF");

  celulaPergunta.setPaddingTop(7).setPaddingBottom(7).setPaddingLeft(8).setPaddingRight(8);
  celulaResposta.setPaddingTop(7).setPaddingBottom(7).setPaddingLeft(8).setPaddingRight(8);

  celulaPergunta.getChild(0).asParagraph().editAsText()
    .setBold(true)
    .setFontSize(10)
    .setForegroundColor("#1F1F1F");

  const textoResposta = celulaResposta.getChild(0).asParagraph().editAsText();
  textoResposta.setFontSize(10);

  if (respostaEhNaoConforme(resposta)) {
    celulaResposta.setBackgroundColor("#FDE9E7");
    textoResposta
      .setBold(true)
      .setForegroundColor("#B00020");
  } else {
    textoResposta
      .setForegroundColor("#222222");
  }

  body.appendParagraph("");
}

function adicionarBotaoDeLink(body, textoBotao, url) {
  const tabela = body.appendTable([[textoBotao]]);
  tabela.setBorderWidth(0);

  const celula = tabela.getCell(0, 0);
  celula.setBackgroundColor("#0B5394");
  celula.setPaddingTop(7).setPaddingBottom(7).setPaddingLeft(12).setPaddingRight(12);

  const paragrafo = celula.getChild(0).asParagraph();
  paragrafo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  const texto = paragrafo.editAsText();
  texto
    .setText(textoBotao)
    .setLinkUrl(url)
    .setBold(true)
    .setFontSize(10)
    .setForegroundColor("#FFFFFF");

  body.appendParagraph("");
}

function adicionarSecaoEvidencias(body, evidencias) {
  if (!evidencias || evidencias.length === 0) return;

  const subtitulo = body.appendParagraph("Evidências");
  estilizarSubtitulo(subtitulo);

  evidencias.forEach((item, idx) => {
    const p = body.appendParagraph(`Item ${idx + 1}: ${item.pergunta}`);
    p.editAsText()
      .setBold(true)
      .setFontSize(10)
      .setForegroundColor("#333333");

    item.links.forEach((link, linkIdx) => {
      adicionarBotaoDeLink(body, `Abrir evidência ${linkIdx + 1}`, link);
    });
  });
}

function criarPDFdeAuditoriaSemDuplicar(vendedor, pastaNumero, cliente, naoConformes, dataReferencia, perguntasERespostas) {
  const nomeArquivo = gerarNomePDF(vendedor, pastaNumero, cliente, naoConformes);

  const pastaRaiz = DriveApp.getFolderById(PASTA_AUDITORIA_ID);
  const nomeVendedor = sanitizarNomeArquivoOuPasta(vendedor || "Vendedor não mapeado");
  const pastaVendedor = obterOuCriarSubpasta(pastaRaiz, nomeVendedor);

  const dataBase = dataReferencia instanceof Date ? dataReferencia : new Date();
  const nomeMes = formatarMesReferencia(dataBase);
  const pastaMes = obterOuCriarSubpasta(pastaVendedor, nomeMes);

  if (arquivoJaExisteNaPasta(pastaMes, nomeArquivo)) {
    return null;
  }

  const doc = DocumentApp.create(nomeArquivo);
  const body = doc.getBody();

  body.setMarginTop(36);
  body.setMarginBottom(36);
  body.setMarginLeft(36);
  body.setMarginRight(36);

  const titulo = body.appendParagraph("AUDITORIA PÓS-VENDA");
  estilizarTituloPrincipal(titulo);

  const subtituloResumo = body.appendParagraph("Resumo da Auditoria");
  estilizarSubtitulo(subtituloResumo);

  adicionarLinhaResumoBonita(body, "Vendedor", vendedor || "-");
  adicionarLinhaResumoBonita(body, "Cliente", cliente || "-");
  adicionarLinhaResumoBonita(body, "Número da Pasta", String(pastaNumero || "-"));
  adicionarLinhaResumoBonita(body, "Não Conformidades", String(naoConformes));

  if (dataReferencia instanceof Date) {
    adicionarLinhaResumoBonita(
      body,
      "Data da Auditoria",
      Utilities.formatDate(dataReferencia, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
    );
  }

  const subtituloPerguntas = body.appendParagraph("Perguntas e Respostas");
  estilizarSubtitulo(subtituloPerguntas);

  const itens = perguntasERespostas || [];
  for (let i = 0; i < itens.length; i++) {
    adicionarBlocoPerguntaResposta(
      body,
      i + 1,
      itens[i].pergunta,
      itens[i].resposta || "-"
    );
  }

  const evidencias = extrairEvidenciasDosItens(itens);
  adicionarSecaoEvidencias(body, evidencias);

  doc.saveAndClose();

  const arquivoDoc = DriveApp.getFileById(doc.getId());
  const pdf = arquivoDoc.getBlob().getAs("application/pdf");
  pdf.setName(nomeArquivo);

  const arquivoFinal = salvarPDFNaPastaDoVendedorSemDuplicar(
    nomeArquivo,
    pdf,
    vendedor,
    dataReferencia
  );

  arquivoDoc.setTrashed(true);

  return arquivoFinal;
}

function gerarPDFDaRespostaDoEvento(e) {
  const ss = getPlanilha();
  const origem = ss.getSheetByName("Respostas ao formulário 1");

  if (!origem) {
    throw new Error('A aba "Respostas ao formulário 1" não foi encontrada.');
  }

  const ultimaColuna = origem.getLastColumn();
  const cabecalho = origem.getRange(1, 1, 1, ultimaColuna).getValues()[0];

  const linha = obterLinhaDoEventoParaPDF(origem, e);
  if (!linha) return;

  const dados = extrairDadosParaPDF(cabecalho, linha);
  const perguntasERespostas = construirPerguntasERespostas(cabecalho, linha);

  if (!(dados.dataResposta instanceof Date)) {
    return;
  }

  criarPDFdeAuditoriaSemDuplicar(
    dados.vendedor,
    dados.pastaNumero,
    dados.cliente,
    dados.naoConformes,
    dados.dataResposta,
    perguntasERespostas
  );
}

function processarPDFsAntigos() {
  const ss = getPlanilha();
  const origem = ss.getSheetByName("Respostas ao formulário 1");

  if (!origem) {
    throw new Error('A aba "Respostas ao formulário 1" não foi encontrada.');
  }

  const dados = origem.getDataRange().getValues();
  if (dados.length < 2) return;

  const cabecalho = dados[0];

  let criados = 0;
  let ignorados = 0;
  let erros = 0;

  for (let i = 1; i < dados.length; i++) {
    try {
      const linha = dados[i];
      const info = extrairDadosParaPDF(cabecalho, linha);
      const perguntasERespostas = construirPerguntasERespostas(cabecalho, linha);

      if (!(info.dataResposta instanceof Date)) {
        ignorados++;
        continue;
      }

      const arquivo = criarPDFdeAuditoriaSemDuplicar(
        info.vendedor,
        info.pastaNumero,
        info.cliente,
        info.naoConformes,
        info.dataResposta,
        perguntasERespostas
      );

      if (arquivo) {
        criados++;
      } else {
        ignorados++;
      }
    } catch (e) {
      erros++;
      Logger.log("Erro na linha " + (i + 1) + ": " + e.message);
    }
  }

  const mensagem =
    "Retroprocessamento concluído.\n" +
    "Criados: " + criados + "\n" +
    "Ignorados: " + ignorados + "\n" +
    "Erros: " + erros;

  Logger.log(mensagem);

  try {
    SpreadsheetApp.getUi().alert(mensagem);
  } catch (e) {
    console.log(mensagem);
  }
}
