import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Todo types
export interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface TodoCreate {
  title: string;
  description?: string;
  completed?: boolean;
}

export interface TodoUpdate {
  title?: string;
  description?: string;
  completed?: boolean;
}

export interface Suggestion {
  id: string;
  title: string;
  description: string;
  reasoning: string;
}

// Todo API
export const todosApi = {
  getAll: () => api.get<Todo[]>('/todos'),
  get: (id: string) => api.get<Todo>(`/todos/${id}`),
  create: (todo: TodoCreate) => api.post<Todo>('/todos', todo),
  update: (id: string, todo: TodoUpdate) => api.patch<Todo>(`/todos/${id}`, todo),
  delete: (id: string) => api.delete(`/todos/${id}`),
};

// Suggestions API
export const suggestionsApi = {
  accept: (id: string) => api.post(`/chat/suggestions/${id}/accept`),
  reject: (id: string) => api.post(`/chat/suggestions/${id}/reject`),
  getPending: () => api.get<{ suggestions: Suggestion[] }>('/chat/suggestions'),
};

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
}

export interface StreamEvent {
  type: string;
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  data?: Suggestion;
}
