# Auditoria de Contratos / Pós-venda (Electron)

Aplicativo desktop completo com Electron + React + TypeScript + Prisma + SQLite.

## Estrutura

```txt
src/
  main/
  preload/
  renderer/
    pages/
    components/
    layouts/
    modules/
    hooks/
    lib/
    styles/
  shared/
prisma/
resources/
```

## Instalação

```bash
npm install
```

## Banco de dados

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

## Rodar em desenvolvimento

```bash
npm run dev
```

## Build

```bash
npm run build
npm run start
```

## Login seed

- **admin@auditoria.local**
- **admin123**

## Observações

- Evidências e PDFs são salvos em `Documentos/auditoria-pos-venda`.
- PDF possui controle de duplicidade por hash por auditoria.
