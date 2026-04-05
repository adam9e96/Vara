import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { execSync, exec } from 'node:child_process';

// 앱 경로 설정
const APP_ROOT = path.join(__dirname, '..');
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const MAIN_DIST = path.join(APP_ROOT, 'dist-electron');
const RENDERER_DIST = path.join(APP_ROOT, 'dist');

// 환경 변수 타입 정의
interface EnvVariable {
  name: string;
  value: string;
  type: 'user' | 'system';
}

// 레지스트리 경로 (사용자 변수, 시스템 변수)
const REG_USER = 'HKCU\\Environment';
const REG_SYSTEM =
  'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment';

/** 레지스트리에서 환경 변수 목록을 조회한다 */
function queryRegistry(regPath: string): Record<string, string> {
  try {
    const output = execSync(`reg query "${regPath}"`, { encoding: 'utf-8' });
    const vars: Record<string, string> = {};
    for (const line of output.split('\r\n')) {
      const match = line.match(
        /^\s{4}(\S+)\s+REG_(SZ|EXPAND_SZ|MULTI_SZ)\s+(.*)$/,
      );
      if (match) {
        vars[match[1]] = match[3];
      }
    }
    return vars;
  } catch {
    return {};
  }
}

/** 사용자 및 시스템 환경 변수를 모두 가져온다 */
function getEnvironmentVariables(): EnvVariable[] {
  const result: EnvVariable[] = [];

  for (const [name, value] of Object.entries(queryRegistry(REG_USER))) {
    result.push({ name, value, type: 'user' });
  }
  for (const [name, value] of Object.entries(queryRegistry(REG_SYSTEM))) {
    result.push({ name, value, type: 'system' });
  }

  return result;
}

/** WM_SETTINGCHANGE를 비동기로 브로드캐스트하여 다른 프로세스에 변경 사항을 알린다 */
function broadcastEnvironmentChange(): void {
  const ps = `Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition '[DllImport("user32.dll",SetLastError=true,CharSet=CharSet.Auto)]public static extern IntPtr SendMessageTimeout(IntPtr hWnd,uint Msg,UIntPtr wParam,string lParam,uint fuFlags,uint uTimeout,out UIntPtr lpdwResult);';$r=[UIntPtr]::Zero;[Win32.NativeMethods]::SendMessageTimeout([IntPtr]0xffff,0x1a,[UIntPtr]::Zero,'Environment',0x2,5000,[ref]$r)`;
  exec(`powershell -NoProfile -Command "${ps}"`);
}

/** 레지스트리에 환경 변수를 설정하고 변경 사항을 브로드캐스트한다 */
function setEnvironmentVariable(
  name: string,
  value: string,
  type: 'user' | 'system',
): boolean {
  try {
    const regPath = type === 'user' ? REG_USER : REG_SYSTEM;
    execSync(
      `reg add "${regPath}" /v "${name}" /t REG_EXPAND_SZ /d "${value}" /f`,
      { encoding: 'utf-8' },
    );
    broadcastEnvironmentChange();
    return true;
  } catch {
    return false;
  }
}

/** 레지스트리에서 환경 변수를 삭제한다 */
function deleteEnvironmentVariable(
  name: string,
  type: 'user' | 'system',
): boolean {
  try {
    const regPath = type === 'user' ? REG_USER : REG_SYSTEM;
    execSync(`reg delete "${regPath}" /v "${name}" /f`, { encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

let mainWindow: BrowserWindow | null = null;

/** 메인 윈도우를 생성한다 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 500,
    webPreferences: {
      preload: path.join(MAIN_DIST, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'Vara - Variables Dashboard',
    icon: path.join(APP_ROOT, 'public', 'icon.ico'),
  });

  mainWindow.setMenuBarVisibility(false);

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// IPC 핸들러 — 렌더러 프로세스와의 통신 처리
ipcMain.handle('env:getAll', () => getEnvironmentVariables());

ipcMain.handle(
  'env:set',
  (_event, name: string, value: string, type: 'user' | 'system') => {
    return setEnvironmentVariable(name, value, type);
  },
);

ipcMain.handle(
  'env:delete',
  (_event, name: string, type: 'user' | 'system') => {
    return deleteEnvironmentVariable(name, type);
  },
);

// 환경 변수 백업 — JSON 파일로 내보내기
ipcMain.handle('env:backup', async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: '환경 변수 백업',
    defaultPath: `env-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (result.canceled || !result.filePath) return { success: false };

  const vars = getEnvironmentVariables();
  const backup = { timestamp: new Date().toISOString(), variables: vars };
  fs.writeFileSync(result.filePath, JSON.stringify(backup, null, 2), 'utf-8');
  return { success: true, path: result.filePath };
});

// 환경 변수 복원 — JSON 백업 파일에서 불러오기
ipcMain.handle('env:restore', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '환경 변수 복원',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths.length)
    return { success: false, variables: [] };

  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');
    const backup = JSON.parse(content);
    return { success: true, variables: backup.variables as EnvVariable[] };
  } catch {
    return { success: false, variables: [] };
  }
});
