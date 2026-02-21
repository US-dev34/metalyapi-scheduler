import axios from 'axios';
import { supabase } from '@/lib/supabase';
import type {
  Project,
  ProjectCreate,
  WBSItem,
  DailyMatrixResponse,
  AllocationBatchUpdate,
  AllocationBatchResponse,
  Baseline,
  BaselineCreate,
  ChatParseResponse,
  ForecastResponse,
  DateRange,
} from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token from Supabase session to every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// =============================================================
// Projects -- /api/v1/projects/
// =============================================================

export const projectsApi = {
  getAll: async (): Promise<Project[]> => {
    const res = await api.get('/api/v1/projects/');
    return res.data;
  },

  getById: async (id: string): Promise<Project> => {
    const res = await api.get(`/api/v1/projects/${id}`);
    return res.data;
  },

  create: async (data: ProjectCreate): Promise<Project> => {
    const res = await api.post('/api/v1/projects/', data);
    return res.data;
  },
};

// =============================================================
// WBS -- /api/v1/wbs/{project_id}/items
// =============================================================

export const wbsApi = {
  getByProject: async (projectId: string): Promise<WBSItem[]> => {
    const res = await api.get(`/api/v1/wbs/${projectId}/items`);
    return res.data;
  },

  create: async (projectId: string, data: Partial<WBSItem>): Promise<WBSItem> => {
    const res = await api.post(`/api/v1/wbs/${projectId}/items`, data);
    return res.data;
  },

  update: async (projectId: string, wbsId: string, data: Partial<WBSItem>): Promise<WBSItem> => {
    const res = await api.put(`/api/v1/wbs/${projectId}/items/${wbsId}`, data);
    return res.data;
  },

  importWBS: async (projectId: string, file: File): Promise<{ imported: number; errors: any[] }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post(`/api/v1/wbs/${projectId}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};

// =============================================================
// Allocations -- /api/v1/allocations/{project_id}/daily
// =============================================================

export const allocationsApi = {
  getDailyMatrix: async (
    projectId: string,
    dateRange: DateRange,
  ): Promise<DailyMatrixResponse> => {
    const res = await api.get(`/api/v1/allocations/${projectId}/daily`, {
      params: { from: dateRange.from, to: dateRange.to },
    });
    return res.data;
  },

  batchUpdate: async (
    projectId: string,
    updates: AllocationBatchUpdate,
  ): Promise<AllocationBatchResponse> => {
    const res = await api.put(`/api/v1/allocations/${projectId}/daily`, updates);
    return res.data;
  },

  getWeekly: async (projectId: string): Promise<unknown> => {
    const res = await api.get(`/api/v1/allocations/${projectId}/weekly`);
    return res.data;
  },

  getSummary: async (projectId: string): Promise<unknown> => {
    const res = await api.get(`/api/v1/allocations/${projectId}/summary`);
    return res.data;
  },
};

// =============================================================
// Baselines -- /api/v1/baselines/{project_id}/
// =============================================================

export const baselinesApi = {
  getAll: async (projectId: string): Promise<Baseline[]> => {
    const res = await api.get(`/api/v1/baselines/${projectId}/`);
    return res.data;
  },

  create: async (projectId: string, data: BaselineCreate): Promise<Baseline> => {
    const res = await api.post(`/api/v1/baselines/${projectId}/`, data);
    return res.data;
  },
};

// =============================================================
// Chat -- /api/v1/chat/{project_id}/
// =============================================================

export const chatApi = {
  sendMessage: async (projectId: string, message: string): Promise<ChatParseResponse> => {
    const res = await api.post(`/api/v1/chat/${projectId}/message`, { message });
    return res.data;
  },

  applyActions: async (projectId: string, messageId: string): Promise<void> => {
    await api.post(`/api/v1/chat/${projectId}/apply`, { message_id: messageId });
  },

  getHistory: async (projectId: string): Promise<unknown[]> => {
    const res = await api.get(`/api/v1/chat/${projectId}/history`);
    return res.data;
  },
};

// =============================================================
// AI -- /api/v1/ai/{project_id}/
// =============================================================

export const aiApi = {
  getForecast: async (projectId: string): Promise<ForecastResponse> => {
    const res = await api.post(`/api/v1/ai/${projectId}/forecast`);
    return res.data;
  },

  getOptimization: async (projectId: string): Promise<{ suggestions: any[]; total: number }> => {
    const res = await api.post(`/api/v1/ai/${projectId}/optimize`);
    return res.data;
  },

  getDailyDigest: async (projectId: string): Promise<any> => {
    const res = await api.post(`/api/v1/ai/${projectId}/daily-digest`);
    return res.data;
  },

  getReport: async (projectId: string): Promise<{ markdown: string; metrics: any; generated_at: string }> => {
    const res = await api.get(`/api/v1/ai/${projectId}/report`);
    return res.data;
  },
};

// =============================================================
// Reports -- /api/v1/reports/{project_id}/
// =============================================================

export const reportsApi = {
  exportExcel: async (projectId: string): Promise<void> => {
    const res = await api.get(`/api/v1/reports/${projectId}/excel`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `WBS_Export.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  downloadSample: async (projectId: string): Promise<void> => {
    const res = await api.get(`/api/v1/reports/${projectId}/sample`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `WBS_Import_Template.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  exportPdf: async (projectId: string): Promise<void> => {
    const res = await api.get(`/api/v1/reports/${projectId}/pdf`, { responseType: 'blob' });
    const contentType = res.headers['content-type'] || 'application/pdf';
    const ext = contentType.includes('html') ? 'html' : 'pdf';
    const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Daily_Report.${ext}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  exportProgress: async (projectId: string): Promise<void> => {
    const res = await api.get(`/api/v1/reports/${projectId}/progress`, { responseType: 'blob' });
    const contentType = res.headers['content-type'] || 'application/pdf';
    const ext = contentType.includes('html') ? 'html' : 'pdf';
    const url = window.URL.createObjectURL(new Blob([res.data], { type: contentType }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Progress_Report.${ext}`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default api;
