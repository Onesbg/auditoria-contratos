import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  login: (payload: any) => ipcRenderer.invoke('auth:login', payload),
  list: (entity: string) => ipcRenderer.invoke('crud:list', entity),
  save: (entity: string, data: any) => ipcRenderer.invoke('crud:save', { entity, data }),
  remove: (entity: string, id: string) => ipcRenderer.invoke('crud:delete', { entity, id }),
  createAuditoria: (payload: any) => ipcRenderer.invoke('auditoria:create', payload),
  getAuditoria: (id: string) => ipcRenderer.invoke('auditoria:detail', id),
  dashboard: (filters: any) => ipcRenderer.invoke('auditoria:dashboard', filters),
  history: (filters: any) => ipcRenderer.invoke('auditoria:history', filters),
  uploadEvidencia: (payload: any) => ipcRenderer.invoke('evidencia:upload', payload),
  generatePdf: (auditoriaId: string) => ipcRenderer.invoke('pdf:generate', auditoriaId)
});
