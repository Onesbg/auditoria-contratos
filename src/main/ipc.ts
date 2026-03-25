import { BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import bcrypt from 'bcryptjs';
import { Prisma, RespostaTipo } from '@prisma/client';
import { prisma } from './prisma';
import { calcularStatus, respostaToDb } from './auditoria-rules';
import { gerarPdfAuditoria } from './pdf-service';

function whereFromFilters(filters: any): Prisma.AuditoriaWhereInput {
  return {
    vendedorId: filters.vendedorId || undefined,
    auditorId: filters.auditorId || undefined,
    mesReferencia: filters.mes || undefined,
    anoReferencia: filters.ano || undefined,
    contratoComErroFlag: typeof filters.contratoComErro === 'boolean' ? filters.contratoComErro : undefined,
    statusAuditoria: filters.status
      ? (filters.status === 'Atenção'
          ? 'Atencao'
          : filters.status === 'Crítico'
            ? 'Critico'
            : filters.status === 'Reunião com a gerência'
              ? 'Reuniao_com_a_gerencia'
              : 'OK')
      : undefined,
    dataAuditoria:
      filters.dataInicial || filters.dataFinal
        ? {
            gte: filters.dataInicial ? new Date(filters.dataInicial) : undefined,
            lte: filters.dataFinal ? new Date(filters.dataFinal) : undefined
          }
        : undefined,
    errosDetectados: filters.tipoErroId ? { some: { tipoErroId: filters.tipoErroId } } : undefined
  };
}

export function registerIpcHandlers(win: BrowserWindow) {
  ipcMain.handle('auth:login', async (_, payload) => {
    const user = await prisma.usuario.findUnique({ where: { email: payload.email } });
    if (!user || !user.ativo) throw new Error('Usuário não encontrado ou inativo');
    const valid = await bcrypt.compare(payload.senha, user.senhaHash);
    if (!valid) throw new Error('Senha inválida');
    return { id: user.id, nome: user.nome, email: user.email, perfil: user.perfil };
  });

  ipcMain.handle('crud:list', async (_, entity) => {
    switch (entity) {
      case 'vendedores': return prisma.vendedor.findMany({ orderBy: { ordemExibicao: 'asc' } });
      case 'perguntas': return prisma.pergunta.findMany({ orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }] });
      case 'tiposErro': return prisma.tipoErro.findMany({ orderBy: { nome: 'asc' } });
      case 'usuarios': return prisma.usuario.findMany({ select: { id: true, nome: true, email: true, perfil: true, ativo: true, createdAt: true } });
      case 'contratos': return prisma.contrato.findMany({ include: { vendedor: true }, orderBy: { createdAt: 'desc' } });
      case 'auditorias':
        return prisma.auditoria.findMany({ include: { vendedor: true, contrato: true, auditor: true, pdfGerado: true }, orderBy: { dataAuditoria: 'desc' } });
      default: return [];
    }
  });

  ipcMain.handle('crud:save', async (_, { entity, data }) => {
    if (entity === 'vendedores') return data.id ? prisma.vendedor.update({ where: { id: data.id }, data }) : prisma.vendedor.create({ data });
    if (entity === 'perguntas') return data.id ? prisma.pergunta.update({ where: { id: data.id }, data }) : prisma.pergunta.create({ data });
    if (entity === 'tiposErro') return data.id ? prisma.tipoErro.update({ where: { id: data.id }, data }) : prisma.tipoErro.create({ data });
    if (entity === 'usuarios') {
      const payload = { ...data };
      if (payload.senha) payload.senhaHash = await bcrypt.hash(payload.senha, 10);
      delete payload.senha;
      return payload.id ? prisma.usuario.update({ where: { id: payload.id }, data: payload }) : prisma.usuario.create({ data: payload });
    }
    if (entity === 'contratos') return data.id ? prisma.contrato.update({ where: { id: data.id }, data: { ...data, dataContrato: new Date(data.dataContrato) } }) : prisma.contrato.create({ data: { ...data, dataContrato: new Date(data.dataContrato) } });
  });

  ipcMain.handle('crud:delete', async (_, { entity, id }) => {
    if (entity === 'vendedores') return prisma.vendedor.delete({ where: { id } });
    if (entity === 'perguntas') return prisma.pergunta.delete({ where: { id } });
    if (entity === 'tiposErro') return prisma.tipoErro.delete({ where: { id } });
    if (entity === 'usuarios') return prisma.usuario.delete({ where: { id } });
    if (entity === 'contratos') return prisma.contrato.delete({ where: { id } });
  });

  ipcMain.handle('auditoria:create', async (_, payload) => {
    const respostas = payload.respostas ?? [];
    const totalItensAuditados = respostas.length;
    const totalNaoConformes = respostas.filter((r: any) => r.respostaTipo !== 'Conforme').length;
    const totalErrosDetectados = (payload.errosDetectados ?? []).length;
    const contratoComErroFlag = totalNaoConformes > 0 || totalErrosDetectados > 0;
    const statusAuditoria = calcularStatus(totalNaoConformes);

    return prisma.auditoria.create({
      data: {
        contratoId: payload.contratoId,
        auditorId: payload.auditorId,
        vendedorId: payload.vendedorId,
        dataAuditoria: new Date(payload.dataAuditoria),
        mesReferencia: payload.mesReferencia,
        anoReferencia: payload.anoReferencia,
        totalItensAuditados,
        totalNaoConformes,
        totalErrosDetectados,
        contratoComErroFlag,
        statusAuditoria,
        observacoesGerais: payload.observacoesGerais,
        respostas: {
          create: respostas.map((r: any) => ({
            perguntaId: r.perguntaId,
            respostaTipo: respostaToDb(r.respostaTipo) as RespostaTipo,
            respostaTexto: r.respostaTexto,
            observacao: r.observacao
          }))
        },
        errosDetectados: {
          create: (payload.errosDetectados ?? []).map((e: any) => ({
            tipoErroId: e.tipoErroId,
            perguntaIdOpcional: e.perguntaIdOpcional,
            descricaoLivre: e.descricaoLivre
          }))
        }
      }
    });
  });

  ipcMain.handle('auditoria:detail', (_, id) => prisma.auditoria.findUnique({
    where: { id },
    include: {
      contrato: true,
      auditor: true,
      vendedor: true,
      respostas: { include: { pergunta: true } },
      errosDetectados: { include: { tipoErro: true, pergunta: true } },
      evidencias: true,
      pdfGerado: true
    }
  }));

  ipcMain.handle('auditoria:dashboard', async (_, filters) => {
    const where = whereFromFilters(filters ?? {});
    const auditorias = await prisma.auditoria.findMany({ where, include: { vendedor: true, errosDetectados: { include: { tipoErro: true } } } });
    const totalAuditorias = auditorias.length;
    const contratosComErro = auditorias.filter((a) => a.contratoComErroFlag).length;
    const contratosOk = totalAuditorias - contratosComErro;
    const totalItens = auditorias.reduce((acc, a) => acc + a.totalItensAuditados, 0);
    const totalErros = auditorias.reduce((acc, a) => acc + a.totalErrosDetectados, 0);
    const taxaErroContrato = totalAuditorias ? contratosComErro / totalAuditorias : 0;
    const taxaErroItem = totalItens ? totalErros / totalItens : 0;
    const aproveitamento = totalAuditorias ? contratosOk / totalAuditorias : 0;

    const byVendedor = Object.values(auditorias.reduce((acc: any, a) => {
      const key = a.vendedor.nome;
      if (!acc[key]) acc[key] = { vendedor: key, auditorias: 0, erros: 0 };
      acc[key].auditorias += 1;
      acc[key].erros += a.totalErrosDetectados;
      return acc;
    }, {}));

    const monthly = Object.values(auditorias.reduce((acc: any, a) => {
      const key = `${a.anoReferencia}-${String(a.mesReferencia).padStart(2, '0')}`;
      if (!acc[key]) acc[key] = { periodo: key, auditorias: 0, contratosComErro: 0, erros: 0 };
      acc[key].auditorias += 1;
      acc[key].erros += a.totalErrosDetectados;
      if (a.contratoComErroFlag) acc[key].contratosComErro += 1;
      return acc;
    }, {})).sort((a: any, b: any) => a.periodo.localeCompare(b.periodo));

    const topErrosMap: Record<string, number> = {};
    auditorias.forEach((a) => a.errosDetectados.forEach((e) => { topErrosMap[e.tipoErro.nome] = (topErrosMap[e.tipoErro.nome] || 0) + 1; }));
    const topErros = Object.entries(topErrosMap).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total).slice(0, 3);

    return { totalAuditorias, contratosComErro, contratosOk, taxaErroContrato, taxaErroItem, aproveitamento, totalVendedoresAuditados: new Set(auditorias.map((a) => a.vendedorId)).size, byVendedor, monthly, topErros };
  });

  ipcMain.handle('auditoria:history', async (_, filters) => {
    const where = whereFromFilters(filters ?? {});
    return prisma.auditoria.findMany({
      where,
      include: { vendedor: true, contrato: true, pdfGerado: true },
      orderBy: { dataAuditoria: 'desc' }
    });
  });

  ipcMain.handle('evidencia:upload', async (_, { auditoriaId, perguntaId }) => {
    const chosen = await dialog.showOpenDialog(win, { properties: ['openFile'] });
    if (chosen.canceled || chosen.filePaths.length === 0) return null;
    const original = chosen.filePaths[0];
    const evidDir = path.join(app.getPath('documents'), 'auditoria-pos-venda', 'evidencias');
    fs.mkdirSync(evidDir, { recursive: true });
    const name = `${Date.now()}-${path.basename(original)}`;
    const dest = path.join(evidDir, name);
    fs.copyFileSync(original, dest);
    return prisma.evidencia.create({
      data: {
        auditoriaId,
        perguntaId,
        nomeArquivo: path.basename(original),
        caminhoArquivo: dest,
        tipoArquivo: path.extname(original)
      }
    });
  });

  ipcMain.handle('pdf:generate', (_, auditoriaId) => gerarPdfAuditoria(auditoriaId));
}
