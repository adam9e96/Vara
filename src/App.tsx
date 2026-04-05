import { useState, useEffect, useMemo } from 'react';
import type { EnvVariable } from './types';
import s from './App.module.css';
import m from './Modal.module.css';

// 탭 필터 타입
type TabType = 'all' | 'user' | 'system';

const APP_VERSION = '1.0.0';
const GITHUB_URL = 'https://github.com/your-account/Vara';

function App() {
  // 환경 변수 목록 및 로딩 상태
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  // 검색 및 탭 필터
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabType>('all');

  // 새 변수 추가 폼
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<'user' | 'system'>('user');

  // 변수 수정 모달
  const [editingVar, setEditingVar] = useState<EnvVariable | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editParts, setEditParts] = useState<string[]>([]); // 세미콜론(;) 구분 다중 값 편집용
  const [newPartValue, setNewPartValue] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null); // 드래그 앤 드롭 순서 변경용

  // 백업 복원 미리보기
  const [restorePreview, setRestorePreview] = useState<EnvVariable[] | null>(
    null,
  );
  const [showMenu, setShowMenu] = useState(false);
  const [showAppInfo, setShowAppInfo] = useState(false);

  /** 환경 변수 목록을 다시 불러온다 */
  const loadVariables = async () => {
    setLoading(true);
    try {
      const vars = await window.envApi.getAll();
      setVariables(vars);
    } catch {
      setStatus('환경 변수를 불러오는데 실패했습니다.');
    }
    setLoading(false);
  };

  // 앱 마운트 시 환경 변수 초기 로딩
  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const vars = await window.envApi.getAll();
        if (!ignore) setVariables(vars);
      } catch {
        if (!ignore) setStatus('환경 변수를 불러오는데 실패했습니다.');
      }
      if (!ignore) setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // 탭 및 검색어 기반 필터링 + 이름순 정렬
  const filtered = useMemo(() => {
    return variables
      .filter((v) => tab === 'all' || v.type === tab)
      .filter(
        (v) =>
          v.name.toLowerCase().includes(search.toLowerCase()) ||
          v.value.toLowerCase().includes(search.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [variables, tab, search]);

  /** 상태 메시지를 3초간 표시한다 */
  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 3000);
  };

  /** 새 환경 변수 추가 */
  const handleAdd = async () => {
    if (!newName.trim()) return;
    const ok = await window.envApi.set(newName.trim(), newValue, newType);
    if (ok) {
      showStatus(`"${newName}" 추가 완료`);
      setNewName('');
      setNewValue('');
      setShowAdd(false);
      await loadVariables();
    } else {
      showStatus('추가 실패 (관리자 권한이 필요할 수 있습니다)');
    }
  };

  /** 환경 변수 삭제 (확인 후 진행) */
  const handleDelete = async (v: EnvVariable) => {
    if (!confirm(`"${v.name}" 변수를 삭제하시겠습니까?`)) return;
    const ok = await window.envApi.delete(v.name, v.type);
    if (ok) {
      showStatus(`"${v.name}" 삭제 완료`);
      await loadVariables();
    } else {
      showStatus('삭제 실패 (관리자 권한이 필요할 수 있습니다)');
    }
  };

  /** 세미콜론(;)이 포함된 값인지 확인 (PATH 등 다중 값 변수) */
  const isMultiValue = (value: string) => value.includes(';');

  /** 수정 모달 열기 — 다중 값이면 개별 항목으로 분리 */
  const handleEdit = (v: EnvVariable) => {
    setEditingVar(v);
    if (isMultiValue(v.value)) {
      setEditParts(v.value.split(';').filter((p) => p.length > 0));
      setEditValue('');
    } else {
      setEditParts([]);
      setEditValue(v.value);
    }
    setNewPartValue('');
  };

  /** 수정된 환경 변수를 저장한다 */
  const handleEditSave = async () => {
    if (!editingVar) return;
    const finalValue = editParts.length > 0 ? editParts.join(';') : editValue;
    const ok = await window.envApi.set(
      editingVar.name,
      finalValue,
      editingVar.type,
    );
    if (ok) {
      showStatus(`"${editingVar.name}" 수정 완료`);
      setEditingVar(null);
      await loadVariables();
    } else {
      showStatus('수정 실패 (관리자 권한이 필요할 수 있습니다)');
    }
  };

  // 다중 값 편집 — 개별 항목 수정, 삭제, 추가, 순서 변경
  const editPartUpdate = (index: number, value: string) => {
    setEditParts((prev) => prev.map((p, i) => (i === index ? value : p)));
  };

  const editPartDelete = (index: number) => {
    setEditParts((prev) => prev.filter((_, i) => i !== index));
  };

  const editPartAdd = () => {
    if (!newPartValue.trim()) return;
    setEditParts((prev) => [...prev, newPartValue.trim()]);
    setNewPartValue('');
  };

  const editPartMoveUp = (index: number) => {
    if (index === 0) return;
    setEditParts((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const editPartMoveDown = (index: number) => {
    setEditParts((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  // 드래그 앤 드롭으로 다중 값 순서 변경
  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setEditParts((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(index, 0, removed);
      return next;
    });
    setDragIndex(index);
  };

  const handleDragEnd = () => setDragIndex(null);

  /** 환경 변수를 JSON 파일로 백업 */
  const handleBackup = async () => {
    const result = await window.envApi.backup();
    if (result.success) showStatus(`백업 완료: ${result.path}`);
  };

  /** 백업 파일을 선택하여 복원 미리보기를 연다 */
  const handleRestore = async () => {
    const result = await window.envApi.restore();
    if (result.success && result.variables.length > 0)
      setRestorePreview(result.variables);
  };

  /** 미리보기된 백업 데이터를 실제로 복원한다 */
  const applyRestore = async () => {
    if (!restorePreview) return;
    let successCount = 0;
    for (const v of restorePreview) {
      const ok = await window.envApi.set(v.name, v.value, v.type);
      if (ok) successCount++;
    }
    showStatus(`${successCount}/${restorePreview.length}개 변수 복원 완료`);
    setRestorePreview(null);
    await loadVariables();
  };

  return (
    <div className={s.app}>
      <header className={s.header}>
        <h1 className={s.title}>Vara</h1>
        <div className={s.headerRight}>
          <div className={s.headerActions}>
            <button className={s.btn} onClick={handleBackup}>
              백업
            </button>
            <button className={s.btn} onClick={handleRestore}>
              복원
            </button>
            <button className={s.btn} onClick={loadVariables}>
              새로고침
            </button>
          </div>
          <div className={s.menuWrap}>
            <button
              className={s.menuButton}
              onClick={() => setShowMenu((prev) => !prev)}
              title="메뉴"
              aria-label="메뉴"
            >
              ☰
            </button>
            {showMenu && (
              <>
                <button
                  className={s.menuBackdrop}
                  onClick={() => setShowMenu(false)}
                  aria-label="메뉴 닫기"
                />
                <div className={s.menuDropdown}>
                  <button
                    className={s.menuItem}
                    onClick={() => {
                      setShowMenu(false);
                      setShowAppInfo(true);
                    }}
                  >
                    앱 정보
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {status && <div className={s.statusBar}>{status}</div>}

      <div className={s.toolbar}>
        <div className={s.tabs}>
          <button
            className={`${s.tab} ${tab === 'all' ? s.tabActive : ''}`}
            onClick={() => setTab('all')}
          >
            전체 ({variables.length})
          </button>
          <button
            className={`${s.tab} ${tab === 'user' ? s.tabActive : ''}`}
            onClick={() => setTab('user')}
          >
            사용자 ({variables.filter((v) => v.type === 'user').length})
          </button>
          <button
            className={`${s.tab} ${tab === 'system' ? s.tabActive : ''}`}
            onClick={() => setTab('system')}
          >
            시스템 ({variables.filter((v) => v.type === 'system').length})
          </button>
        </div>
        <div className={s.toolbarRight}>
          <input
            className={s.searchInput}
            type="text"
            placeholder="검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className={s.btnAdd} onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? '취소' : '+ 추가'}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className={s.addForm}>
          <input
            className={s.addFormName}
            placeholder="변수 이름"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className={s.addFormValue}
            placeholder="값"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as 'user' | 'system')}
          >
            <option value="user">사용자</option>
            <option value="system">시스템</option>
          </select>
          <button className={s.btnConfirm} onClick={handleAdd}>
            추가
          </button>
        </div>
      )}

      {/* 변수 수정 모달 */}
      {editingVar && (
        <div className={m.overlay} onClick={() => setEditingVar(null)}>
          <div
            className={editParts.length > 0 ? m.modalWide : m.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={m.title}>변수 수정</h3>
            <div className={m.headerInfo}>
              <div className={m.fieldInline}>
                <label>이름</label>
                <input value={editingVar.name} disabled />
              </div>
              <div className={m.fieldInline}>
                <label>타입</label>
                <span
                  className={
                    editingVar.type === 'user' ? s.badgeUser : s.badgeSystem
                  }
                >
                  {editingVar.type === 'user' ? '사용자' : '시스템'}
                </span>
              </div>
            </div>

            {editParts.length > 0 ? (
              <div className={m.multiEditor}>
                <label>값 ({editParts.length}개 항목)</label>
                <div className={m.multiList}>
                  {editParts.map((part, i) => (
                    <div
                      key={i}
                      className={
                        dragIndex === i ? m.multiRowDragging : m.multiRow
                      }
                      draggable
                      onDragStart={() => handleDragStart(i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDragEnd={handleDragEnd}
                    >
                      <span className={m.multiIndex}>{i + 1}</span>
                      <span
                        className={m.multiGrip}
                        title="드래그하여 순서 변경"
                      >
                        ⠿
                      </span>
                      <input
                        className={m.multiInput}
                        value={part}
                        onChange={(e) => editPartUpdate(i, e.target.value)}
                      />
                      <button
                        className={m.multiBtnIcon}
                        onClick={() => editPartMoveUp(i)}
                        disabled={i === 0}
                        title="위로"
                      >
                        ▲
                      </button>
                      <button
                        className={m.multiBtnIcon}
                        onClick={() => editPartMoveDown(i)}
                        disabled={i === editParts.length - 1}
                        title="아래로"
                      >
                        ▼
                      </button>
                      <button
                        className={m.multiBtnDelete}
                        onClick={() => editPartDelete(i)}
                        title="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className={m.multiAddRow}>
                  <input
                    className={m.multiInput}
                    placeholder="새 값 입력..."
                    value={newPartValue}
                    onChange={(e) => setNewPartValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && editPartAdd()}
                  />
                  <button className={m.btnAddSmall} onClick={editPartAdd}>
                    추가
                  </button>
                </div>
              </div>
            ) : (
              <div className={m.field}>
                <label>값</label>
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={5}
                />
              </div>
            )}

            <div className={m.actions}>
              <button className={s.btnConfirm} onClick={handleEditSave}>
                저장
              </button>
              <button className={s.btn} onClick={() => setEditingVar(null)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 복원 미리보기 모달 */}
      {restorePreview && (
        <div className={m.overlay} onClick={() => setRestorePreview(null)}>
          <div className={m.modalWide} onClick={(e) => e.stopPropagation()}>
            <h3 className={m.title}>
              복원 미리보기 ({restorePreview.length}개 변수)
            </h3>
            <div className={m.restoreList}>
              {restorePreview.map((v, i) => (
                <div key={i} className={m.restoreItem}>
                  <span
                    className={v.type === 'user' ? s.badgeUser : s.badgeSystem}
                  >
                    {v.type === 'user' ? '사용자' : '시스템'}
                  </span>
                  <span className={m.restoreName}>{v.name}</span>
                  <span className={m.restoreValue}>{v.value}</span>
                </div>
              ))}
            </div>
            <div className={m.actions}>
              <button className={s.btnConfirm} onClick={applyRestore}>
                모두 복원
              </button>
              <button className={s.btn} onClick={() => setRestorePreview(null)}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {showAppInfo && (
        <div className={m.overlay} onClick={() => setShowAppInfo(false)}>
          <div className={m.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={m.title}>앱 정보</h3>
            <div className={m.infoBlock}>
              <div className={m.infoRow}>
                <span className={m.infoLabel}>앱 이름</span>
                <strong className={m.infoValue}>Vara</strong>
              </div>
              <div className={m.infoRow}>
                <span className={m.infoLabel}>버전</span>
                <span className={m.infoValue}>{APP_VERSION}</span>
              </div>
              <div className={m.infoRow}>
                <span className={m.infoLabel}>GitHub</span>
                <a
                  className={m.infoLink}
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {GITHUB_URL}
                </a>
              </div>
            </div>
            <div className={m.actions}>
              <button className={s.btn} onClick={() => setShowAppInfo(false)}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 환경 변수 테이블 */}
      <div className={s.tableContainer}>
        {loading ? (
          <div className={s.loading}>불러오는 중...</div>
        ) : (
          <table className={s.varTable}>
            <thead>
              <tr>
                <th className={s.colType}>타입</th>
                <th className={s.colName}>이름</th>
                <th>값</th>
                <th className={s.colActions}>작업</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr key={`${v.type}-${v.name}-${i}`}>
                  <td>
                    <span
                      className={
                        v.type === 'user' ? s.badgeUser : s.badgeSystem
                      }
                    >
                      {v.type === 'user' ? '사용자' : '시스템'}
                    </span>
                  </td>
                  <td className={s.cellName}>{v.name}</td>
                  <td className={s.cellValue} title={v.value}>
                    {v.value}
                  </td>
                  <td className={s.cellActions}>
                    <button
                      className={s.btnEdit}
                      onClick={() => handleEdit(v)}
                      title="수정"
                    >
                      &#9998;
                    </button>
                    <button
                      className={s.btnDelete}
                      onClick={() => handleDelete(v)}
                      title="삭제"
                    >
                      &#10005;
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className={s.empty}>
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default App;
