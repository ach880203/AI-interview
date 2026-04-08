import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import * as profileApi from '../../api/profile';
import ContentViewModal from '../../components/profile/ContentViewModal';

/**
 * 이력서 관리 페이지입니다.
 *
 * [역할]
 * 사용자가 이력서를 등록, 수정, 삭제하고 기존 작성 내역을 확인할 수 있는 화면입니다.
 * 파일 첨부가 가능한 문서라서 JSON이 아니라 multipart/form-data 전송까지 함께 처리합니다.
 */
export default function ResumePage() {
  const [resumes, setResumes] = useState([]);
  const [form, setForm] = useState({ title: '', content: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [viewingResume, setViewingResume] = useState(null);

  /**
   * 페이지 첫 진입 시 내 이력서 목록을 조회합니다.
   *
   * [동작 방식]
   * 최초 1회만 실행되고, 응답 성공 시 목록 상태를 갱신합니다.
   */
  useEffect(() => {
    fetchResumes();
  }, []);

  /**
   * 이력서 목록을 서버에서 다시 불러옵니다.
   *
   * [주의]
   * 등록, 수정, 삭제 직후에는 화면과 서버 상태를 맞추기 위해 반드시 다시 조회합니다.
   */
  async function fetchResumes() {
    setLoading(true);

    try {
      const { data } = await profileApi.getResumes();
      setResumes(data.data ?? []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '이력서 목록을 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }

  /**
   * 입력 폼을 초기 상태로 되돌립니다.
   *
   * [동작 방식]
   * 작성 모드와 수정 모드가 같은 폼을 공유하므로,
   * 작업이 끝난 뒤에는 선택 파일과 수정 대상 ID까지 함께 초기화해야 합니다.
   */
  function resetForm() {
    setForm({ title: '', content: '' });
    setSelectedFile(null);
    setEditingId(null);
  }

  /**
   * 텍스트 입력값을 상태에 반영합니다.
   *
   * @param {React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} event 입력 이벤트
   */
  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));

    if (error) {
      setError('');
    }
  }

  /**
   * 첨부 파일 선택 상태를 갱신합니다.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event 파일 입력 이벤트
   */
  function handleFileChange(event) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  /**
   * 수정할 이력서를 폼에 채워 넣습니다.
   *
   * [동작 방식]
   * 목록 카드의 값을 그대로 폼으로 복사해서 사용자가 필요한 부분만 수정할 수 있게 합니다.
   */
  function handleEditClick(resume) {
    setEditingId(resume.id);
    setForm({
      title: resume.title ?? '',
      content: resume.content ?? '',
    });
    setSelectedFile(null);
    setSuccessMessage('');
    setError('');
  }

  /**
   * 이력서를 등록하거나 수정합니다.
   *
   * [동작 방식]
   * 1. 제목 공백 여부를 먼저 검사합니다.
   * 2. 수정 중이면 update API, 아니면 create API를 호출합니다.
   * 3. 성공 후에는 목록 재조회와 폼 초기화를 함께 수행합니다.
   */
  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError('이력서 제목을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const request = {
        title: form.title.trim(),
        content: form.content.trim(),
      };

      if (editingId) {
        await profileApi.updateResume(editingId, request, selectedFile);
        setSuccessMessage('이력서를 수정했습니다.');
      } else {
        await profileApi.createResume(request, selectedFile);
        setSuccessMessage('이력서를 등록했습니다.');
      }

      resetForm();
      await fetchResumes();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '이력서 저장 중 오류가 발생했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 이력서를 삭제합니다.
   *
   * [주의]
   * 삭제는 되돌리기 어려우므로 사용자 확인 후 요청을 보냅니다.
   */
  async function handleDelete(id) {
    const shouldDelete = window.confirm('이 이력서를 삭제하시겠습니까?');
    if (!shouldDelete) {
      return;
    }

    setError('');
    setSuccessMessage('');

    try {
      await profileApi.deleteResume(id);
      setSuccessMessage('이력서를 삭제했습니다.');

      if (editingId === id) {
        resetForm();
      }

      await fetchResumes();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '이력서 삭제 중 오류가 발생했습니다.'
      );
    }
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      {viewingResume && (
        <ContentViewModal
          title={viewingResume.title}
          content={viewingResume.content}
          originalFileName={viewingResume.originalFileName}
          fileUrl={viewingResume.fileUrl}
          onClose={() => setViewingResume(null)}
        />
      )}
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* 폼 섹션 — mentor-surface 카드 */}
        <section className="rounded-2xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-mentor-text">이력서 관리</h1>
            <p className="mt-2 text-sm text-mentor-muted">
              면접에 활용할 이력서를 등록하고 최신 상태로 관리합니다.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              id="resume-title"
              label="이력서 제목"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="예: 백엔드 개발자 이력서"
            />

            <div className="flex flex-col gap-1">
              {/* 이력서 내용 레이블 — mentor-text */}
              <label htmlFor="resume-content" className="text-sm font-medium text-mentor-text">
                이력서 내용
                <span className="ml-1 text-mentor-muted font-normal">(파일 업로드 시 자동 입력)</span>
              </label>
              {/* 텍스트에리어 — mentor 토큰 */}
              <textarea
                id="resume-content"
                name="content"
                value={form.content}
                onChange={handleChange}
                rows={10}
                placeholder="주요 경력, 기술 스택, 프로젝트 경험을 입력해 주세요."
                className="w-full rounded-lg border border-mentor-border px-3 py-2.5 text-sm text-mentor-text outline-none transition placeholder:text-mentor-muted focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-mentor-text">
                파일 업로드 <span className="text-mentor-muted font-normal">(PDF / 이미지 — 선택)</span><br />
                <span className="text-mentor-muted font-normal">(이미지 파일은 인식이 잘 안될 수 있습니다.)</span>
              </label>
              {/* 파일 업로드 드래그 영역 — mentor-border, mentor-accent hover */}
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-mentor-border px-4 py-3 text-sm text-mentor-muted transition hover:border-mentor-primary hover:bg-mentor-accent">
                <svg className="h-5 w-5 shrink-0 text-mentor-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5V19a1 1 0 001 1h16a1 1 0 001-1v-2.5M16 10l-4-4m0 0L8 10m4-4v12" />
                </svg>
                <span className="truncate">
                  {selectedFile ? selectedFile.name : 'PDF 또는 이미지를 업로드하면 AI가 텍스트를 자동 추출합니다.'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {selectedFile && (
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="self-start text-xs text-mentor-muted hover:text-red-500"
                >
                  파일 제거
                </button>
              )}
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
                {successMessage}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" loading={submitting}>
                {editingId ? '이력서 수정하기' : '이력서 등록하기'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
                disabled={submitting}
                className="max-w-32"
              >
                초기화
              </Button>
            </div>
          </form>
        </section>

        {/* 목록 섹션 — mentor-surface 카드 */}
        <section className="rounded-2xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-mentor-text">등록한 이력서</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                최신순으로 정렬되며, 면접 설정 화면에서 바로 선택할 수 있습니다.
              </p>
            </div>
            {/* 총 개수 배지 — mentor-accent */}
            <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
              총 {resumes.length}개
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              {/* 로딩 스피너 — mentor 색상 */}
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          ) : resumes.length === 0 ? (
            <EmptyState
              title="등록한 이력서가 없습니다."
              description="왼쪽 폼에서 첫 번째 이력서를 등록해 주세요."
            />
          ) : (
            <div className="space-y-4">
              {resumes.map((resume) => (
                <article key={resume.id} className="rounded-2xl border border-mentor-border p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-mentor-text">{resume.title}</h3>
                      <p className="mt-1 text-xs text-mentor-muted">
                        수정일 {formatDateTime(resume.updatedAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {/* 수정 버튼 — mentor-accent */}
                      <button
                        type="button"
                        onClick={() => handleEditClick(resume)}
                        className="rounded-lg bg-mentor-accent px-3 py-2 text-sm font-medium text-mentor-primary transition hover:bg-mentor-primary/10"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(resume.id)}
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {resume.originalFileName && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-mentor-border bg-mentor-bg px-3 py-2">
                      <svg className="h-4 w-4 shrink-0 text-mentor-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="truncate text-xs text-mentor-text">{resume.originalFileName}</span>
                    </div>
                  )}

                  {resume.content ? (
                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-mentor-muted">
                      {resume.content}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-mentor-muted">
                      {resume.originalFileName ? '파일 텍스트 추출 중 오류가 발생했습니다.' : '내용이 없는 이력서입니다.'}
                    </p>
                  )}

                  {resume.content && (
                    <button
                      type="button"
                      onClick={() => setViewingResume(resume)}
                      className="mt-3 rounded-lg border border-mentor-border px-3 py-1.5 text-xs font-medium text-mentor-primary transition hover:bg-mentor-accent"
                    >
                      내용 전체 보기
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * 비어 있는 목록에 안내 문구를 보여 주는 보조 컴포넌트입니다.
 *
 * @param {object} props 컴포넌트 속성
 * @param {string} props.title 빈 상태 제목
 * @param {string} props.description 빈 상태 설명
 */
function EmptyState({ title, description }) {
  return (
    /* 빈 상태 — mentor-border 점선 */
    <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
      <p className="text-base font-semibold text-mentor-text">{title}</p>
      <p className="mt-2 text-sm text-mentor-muted">{description}</p>
    </div>
  );
}

/**
 * 서버 시간을 읽기 쉬운 한글 날짜 문자열로 바꿉니다.
 *
 * @param {string | null} value 날짜 문자열
 * @returns {string} 화면 표시용 날짜
 */
function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ko-KR');
}
