export interface EnvVariable {
  name: string;
  value: string;
  type: 'user' | 'system';
}

export interface EnvApi {
  getAll: () => Promise<EnvVariable[]>;
  set: (
    name: string,
    value: string,
    type: 'user' | 'system',
  ) => Promise<boolean>;
  delete: (name: string, type: 'user' | 'system') => Promise<boolean>;
  backup: () => Promise<{ success: boolean; path?: string }>;
  restore: () => Promise<{ success: boolean; variables: EnvVariable[] }>;
}

declare global {
  interface Window {
    envApi: EnvApi;
  }
}
