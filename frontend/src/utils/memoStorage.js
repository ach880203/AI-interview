/**
 * 메모 localStorage 유틸
 *
 * 저장 구조: { memos: [{ id, text, createdAt, updatedAt }] }
 * 대시보드 위젯은 마지막(최신) 메모를 편집하고,
 * 마이페이지 메모 섹션은 전체 목록을 조회·삭제합니다.
 */
const MEMO_STORAGE_KEY = 'dashboard-memos';

/**
 * 메모는 계정별로 분리 저장해야 하므로 사용자 식별자를 키 뒤에 붙입니다.
 * 로그아웃 상태에서는 anonymous 영역을 사용해 예외 없이 동작하게 둡니다.
 */
function buildMemoStorageKey(userStorageKey = 'anonymous') {
  return `${MEMO_STORAGE_KEY}:${userStorageKey}`;
}

function load(userStorageKey) {
  try {
    const raw = localStorage.getItem(buildMemoStorageKey(userStorageKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(memos, userStorageKey) {
  localStorage.setItem(buildMemoStorageKey(userStorageKey), JSON.stringify(memos));
}

/** 전체 메모 목록 (최신순) */
export function getAllMemos(userStorageKey) {
  return load(userStorageKey).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/** 새 메모 추가 */
export function addMemo(text, userStorageKey) {
  const memos = load(userStorageKey);
  const now = new Date().toISOString();
  const memo = { id: crypto.randomUUID(), text, createdAt: now, updatedAt: now };
  memos.push(memo);
  save(memos, userStorageKey);
  return memo;
}

/** 메모 수정 */
export function updateMemo(id, text, userStorageKey) {
  const memos = load(userStorageKey);
  const target = memos.find((m) => m.id === id);
  if (target) {
    target.text = text;
    target.updatedAt = new Date().toISOString();
    save(memos, userStorageKey);
  }
  return target;
}

/** 메모 삭제 */
export function deleteMemo(id, userStorageKey) {
  const memos = load(userStorageKey).filter((m) => m.id !== id);
  save(memos, userStorageKey);
}

/** 전체 삭제 */
export function deleteAllMemos(userStorageKey) {
  save([], userStorageKey);
}

/**
 * 기존 단일 메모(dashboard-memo) → 새 구조로 마이그레이션
 * 앱 시작 시 한 번만 호출합니다.
 */
export function migrateOldMemo(userStorageKey) {
  const OLD_KEY = 'dashboard-memo';
  try {
    const old = localStorage.getItem(OLD_KEY);
    if (!old) return;
    const existing = load(userStorageKey);
    if (existing.length === 0) {
      const now = new Date().toISOString();
      save([{ id: crypto.randomUUID(), text: old, createdAt: now, updatedAt: now }], userStorageKey);
    }
    localStorage.removeItem(OLD_KEY);
  } catch { /* ignore */ }
}
