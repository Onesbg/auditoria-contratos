import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from 'electron';
import { prisma } from './prisma';
import { normalizeStatus } from './auditoria-rules';

export async function gerarPdfAuditoria(auditoriaId: string) {
  const auditoria = await prisma.auditoria.findUnique({
    where: { id: auditoriaId },
    include: {
      vendedor: true,
      contrato: true,
      respostas: { include: { pergunta: true } },
      evidencias: true
    }
  });
  if (!auditoria) throw new Error('Auditoria não encontrada');

  const hash = crypto.createHash('sha256').update(auditoria.id).digest('hex');
  const existente = await prisma.pdfGerado.findUnique({ where: { hashDuplicidade: hash } });
  if (existente) return existente;

  const pdfDir = path.join(app.getPath('documents'), 'auditoria-pos-venda', 'pdfs');
  fs.mkdirSync(pdfDir, { recursive: true });
  const nomeArquivo = `auditoria-${auditoria.id}.pdf`;
  const caminhoArquivo = path.join(pdfDir, nomeArquivo);

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(caminhoArquivo);
  doc.pipe(stream);

  doc.fontSize(20).text('Auditoria Pós-Venda', { align: 'center' }).moveDown();
  doc.fontSize(12)
    .text(`Vendedor: ${auditoria.vendedor.nome}`)
    .text(`Cliente: ${auditoria.contrato.nomeCliente}`)
    .text(`Pasta Bitrix: ${auditoria.contrato.numeroPastaBitrix}`)
    .text(`Data da auditoria: ${auditoria.dataAuditoria.toISOString().slice(0, 10)}`)
    .text(`Não conformidades: ${auditoria.totalNaoConformes}`)
    .text(`Status: ${normalizeStatus(auditoria.statusAuditoria)}`)
    .moveDown();

  doc.fontSize(14).text('Perguntas e respostas').moveDown(0.5);
  auditoria.respostas.forEach((r) => {
    const bad = r.respostaTipo !== 'Conforme';
    doc.fillColor(bad ? '#C0392B' : '#2C3E50')
      .fontSize(11)
      .text(`${r.pergunta.codigo} - ${r.pergunta.titulo}`)
      .fontSize(10)
      .text(`Resposta: ${r.respostaTipo.replaceAll('_', ' ')}`)
      .text(`Observação: ${r.observacao ?? '-'}`)
      .moveDown(0.4);
  });

  doc.fillColor('#2C3E50').fontSize(14).text('Evidências').moveDown(0.5);
  if (!auditoria.evidencias.length) {
    doc.fontSize(10).text('Sem evidências cadastradas.');
  } else {
    auditoria.evidencias.forEach((e) => doc.fontSize(10).text(`• ${e.nomeArquivo} (${e.caminhoArquivo})`));
  }

  doc.end();
  await new Promise((resolve) => stream.on('finish', resolve));

  return prisma.pdfGerado.create({
    data: { auditoriaId, nomeArquivo, caminhoArquivo, hashDuplicidade: hash }
  });
}
