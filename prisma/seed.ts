import { PrismaClient, PerfilUsuario, RespostaTipo, StatusAuditoria } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@auditoria.local' },
    update: {},
    create: {
      nome: 'Administrador Padrão',
      email: 'admin@auditoria.local',
      senhaHash: adminHash,
      perfil: PerfilUsuario.administrador,
      ativo: true
    }
  });

  await prisma.usuario.upsert({
    where: { email: 'auditor@auditoria.local' },
    update: {},
    create: {
      nome: 'Auditor Demo',
      email: 'auditor@auditoria.local',
      senhaHash: await bcrypt.hash('auditor123', 10),
      perfil: PerfilUsuario.auditor
    }
  });

  const sellers = [
    ['George Nunes', 'GN'],
    ['Lucas Gottqtroy', 'LG'],
    ['Diego Pinto', 'DP'],
    ['Bernardo Jorge', 'BJ']
  ];

  const vendedores = [];
  for (const [idx, [nome, sigla]] of sellers.entries()) {
    vendedores.push(
      await prisma.vendedor.upsert({
        where: { id: `seed-vendedor-${sigla}` },
        update: {},
        create: {
          id: `seed-vendedor-${sigla}`,
          nome,
          sigla,
          ordemExibicao: idx + 1
        }
      })
    );
  }

  const tipos = [
    'Documento faltando',
    'Arquivo renomeado incorretamente',
    'Dados do cliente incorretos',
    'Plano incorreto',
    'Informação divergente no Bitrix/Sistema',
    'Erro no contrato',
    'Tarefas não criadas/cadastradas corretamente',
    'Erro no grupo/contato de WhatsApp',
    'Prazos informados incorretamente',
    'Outro erro identificado'
  ];

  for (const nome of tipos) {
    await prisma.tipoErro.upsert({
      where: { nome },
      update: {},
      create: { nome }
    });
  }

  const perguntas = [
    ['Q1', 'Contrato assinado corretamente?', 'Validação da assinatura', 'Documentação', 1],
    ['Q2', 'Documentos anexados estão completos?', 'Checklist de documentos', 'Documentação', 2],
    ['Q3', 'Plano cadastrado no sistema confere?', 'Comparar plano contratado', 'Sistema', 1],
    ['Q4', 'Prazos informados ao cliente estão corretos?', 'SLA pós-venda', 'Atendimento', 1]
  ] as const;

  for (const [codigo, titulo, descricao, categoria, ordem] of perguntas) {
    await prisma.pergunta.upsert({
      where: { codigo },
      update: {},
      create: { codigo, titulo, descricao, categoria, ordem }
    });
  }

  const existing = await prisma.auditoria.count();
  if (existing === 0) {
    const contrato = await prisma.contrato.create({
      data: {
        numeroPastaBitrix: 'BIT-2026-0001',
        nomeCliente: 'Empresa Exemplo Ltda',
        vendedorId: vendedores[0].id,
        dataContrato: new Date('2026-02-10'),
        statusContrato: 'Ativo'
      }
    });

    const perguntasDb = await prisma.pergunta.findMany({ orderBy: { ordem: 'asc' } });
    const tipoErro = await prisma.tipoErro.findFirstOrThrow();

    await prisma.auditoria.create({
      data: {
        contratoId: contrato.id,
        auditorId: admin.id,
        vendedorId: vendedores[0].id,
        dataAuditoria: new Date('2026-03-05'),
        mesReferencia: 3,
        anoReferencia: 2026,
        totalItensAuditados: 4,
        totalNaoConformes: 2,
        totalErrosDetectados: 1,
        contratoComErroFlag: true,
        statusAuditoria: StatusAuditoria.Critico,
        observacoesGerais: 'Auditoria inicial de demonstração',
        respostas: {
          create: perguntasDb.map((p, idx) => ({
            perguntaId: p.id,
            respostaTipo:
              idx === 0 ? RespostaTipo.Conforme : idx === 1 ? RespostaTipo.Nao_conforme : RespostaTipo.Conforme
          }))
        },
        errosDetectados: {
          create: [{ tipoErroId: tipoErro.id, descricaoLivre: 'Erro de exemplo' }]
        }
      }
    });
  }

  console.log('Seed finalizada. Login admin@auditoria.local / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
