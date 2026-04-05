import { contextBridge, ipcRenderer } from 'electron';

// 환경 변수 타입 정의
export interface EnvVariable {
  name: string;
  value: string;
  type: 'user' | 'system';
}

// 렌더러에서 사용할 API — 메인 프로세스의 IPC 핸들러와 1:1 매핑
const api = {
  getAll: (): Promise<EnvVariable[]> => ipcRenderer.invoke('env:getAll'), // 전체 환경 변수 조회
  set: (
    name: string,
    value: string,
    type: 'user' | 'system',
  ): Promise<boolean> => ipcRenderer.invoke('env:set', name, value, type), // 환경 변수 설정 (추가/수정)
  delete: (name: string, type: 'user' | 'system'): Promise<boolean> =>
    ipcRenderer.invoke('env:delete', name, type), // 환경 변수 삭제
  backup: (): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('env:backup'), // 백업 파일 내보내기
  restore: (): Promise<{ success: boolean; variables: EnvVariable[] }> =>
    ipcRenderer.invoke('env:restore'), // 백업 파일에서 복원
};

// contextBridge를 통해 렌더러에 안전하게 API 노출
contextBridge.exposeInMainWorld('envApi', api);
