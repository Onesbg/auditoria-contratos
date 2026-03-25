/// <reference types="vite/client" />

declare global {
  interface Window {
    api: {
      login: (payload: any) => Promise<any>;
      list: (entity: string) => Promise<any[]>;
      save: (entity: string, data: any) => Promise<any>;
      remove: (entity: string, id: string) => Promise<any>;
      createAuditoria: (payload: any) => Promise<any>;
      getAuditoria: (id: string) => Promise<any>;
      dashboard: (filters: any) => Promise<any>;
      history: (filters: any) => Promise<any[]>;
      uploadEvidencia: (payload: any) => Promise<any>;
      generatePdf: (auditoriaId: string) => Promise<any>;
    };
  }
}

export {};
