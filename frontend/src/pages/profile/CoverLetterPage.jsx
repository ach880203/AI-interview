import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import * as profileApi from '../../api/profile';
import ContentViewModal from '../../components/profile/ContentViewModal';

/**
 * 자기소개서 관리 페이지입니다.
 *
 * [역할]
 * 사용자가 자기소개서를 등록, 수정, 삭제하고
 * 면접에 사용할 문서를 한곳에서 관리할 수 있게 합니다.
 */
export default function CoverLetterPage() {
  const [coverLetters, setCoverLetters] = useState([]);
  const [form, setForm] = useState({ title: '', content: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [viewingCoverLetter, setViewingCoverLetter] = useState(null);

  /**
   * 페이지 진입 시 자기소개서 목록을 조회합니다.
   */
  useEffect(() => {
    fetchCoverLetters();
  }, []);

  /**
   * 자기소개서 목록을 서버에서 조회합니다.
   */
  async function fetchCoverLetters() {
    setLoading(true);

    try {
      const { data } = await profileApi.getCoverLetters();
      setCoverLetters(data.data ?? []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '자기소개서 목록을 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }

  /**
   * 입력 폼을 초기 상태로 되돌립니다.
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
   * 수정할 자기소개서를 폼에 채웁니다.
   *
   * @param {object} coverLetter 수정 대상 자기소개서
   */
  function handleEditClick(coverLetter) {
    setEditingId(coverLetter.id);
    setForm({
      title: coverLetter.title ?? '',
      content: coverLetter.content ?? '',
    });
    setSelectedFile(null);
    setError('');
    setSuccessMessage('');
  }

  function handleFileChange(event) {
    setSelectedFile(event.target.files[0] ?? null);
    if (error) setError('');
  }

  /**
   * 자기소개서를 등록하거나 수정합니다.
   *
   * [동작 방식]
   * 파일 첨부가 없는 문서라서 일반 JSON 요청으로 처리합니다.
   */
  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      setError('자기소개서 제목을 입력해 주세요.');
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
        await profileApi.updateCoverLetter(editingId, request, selectedFile);
        setSuccessMessage('자기소개서를 수정했습니다.');
      } else {
        await profileApi.createCoverLetter(request, selectedFile);
        setSuccessMessage('자기소개서를 등록했습니다.');
      }

      resetForm();
      await fetchCoverLetters();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '자기소개서 저장 중 오류가 발생했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 자기소개서를 삭제합니다.
   *
   * @param {number} id 삭제 대상 ID
   */
  async function handleDelete(id) {
    const shouldDelete = window.confirm('이 자기소개서를 삭제하시겠습니까?');
    if (!shouldDelete) {
      return;
    }

    setError('');
    setSuccessMessage('');

    try {
      await profileApi.deleteCoverLetter(id);
      setSuccessMessage('자기소개서를 삭제했습니다.');

      if (editingId === id) {
        resetForm();
      }

      await fetchCoverLetters();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '자기소개서 삭제 중 오류가 발생했습니다.'
      );
    }
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      {viewingCoverLetter && (
        <ContentViewModal
          title={viewingCoverLetter.title}
          content={viewingCoverLetter.content}
          originalFileName={viewingCoverLetter.originalFileName}
          fileUrl={viewingCoverLetter.fileUrl}
          onClose={() => setViewingCoverLetter(null)}
        />
      )}
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-2xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-mentor-text">자기소개서 관리</h1>
            <p className="mt-2 text-sm text-mentor-muted">
              면접에서 강조하고 싶은 경험과 지원 동기를 문서로 정리합니다.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              id="cover-letter-title"
              label="자기소개서 제목"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="예: 플랫폼 백엔드 지원 자기소개서"
            />

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-mentor-text">
                파일 업로드 <span className="text-mentor-muted font-normal">(PDF / 이미지 — 선택)</span><br/>                <span className="text-mentor-muted font-normal">(이미지 파일은 인식이 잘 안될 수 있습니다.)</span>
              </label>
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

            <div className="flex flex-col gap-1">
              <label htmlFor="cover-letter-content" className="text-sm font-medium text-mentor-text">
                자기소개서 내용
                <span className="ml-1 text-mentor-muted font-normal">(파일 업로드 시 자동 입력)</span>
              </label>
              <textarea
                id="cover-letter-content"
                name="content"
                value={form.content}
                onChange={handleChange}
                rows={10}
                placeholder="지원 동기, 강점, 프로젝트 경험, 입사 후 포부를 작성해 주세요."
                className="w-full rounded-lg border border-mentor-border px-3 py-2.5 text-sm text-mentor-text outline-none transition placeholder:text-mentor-muted focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
              />
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
                {editingId ? '자기소개서 수정하기' : '자기소개서 등록하기'}
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

        <section className="rounded-2xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-mentor-text">등록한 자기소개서</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                작성한 문서를 면접 설정에서 바로 불러올 수 있습니다.
              </p>
            </div>
            <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
              총 {coverLetters.length}개
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          ) : coverLetters.length === 0 ? (
            <EmptyState
              title="등록한 자기소개서가 없습니다."
              description="왼쪽 폼에서 첫 번째 자기소개서를 작성해 주세요."
            />
          ) : (
            <div className="space-y-4">
              {coverLetters.map((coverLetter) => (
                <article key={coverLetter.id} className="rounded-2xl border border-mentor-border p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-mentor-text">{coverLetter.title}</h3>
                      <p className="mt-1 text-xs text-mentor-muted">
                        수정일 {formatDateTime(coverLetter.updatedAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(coverLetter)}
                        className="rounded-lg bg-mentor-accent px-3 py-2 text-sm font-medium text-mentor-primary transition hover:bg-mentor-primary/10"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(coverLetter.id)}
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {coverLetter.originalFileName && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-mentor-border bg-mentor-bg px-3 py-2">
                      <svg className="h-4 w-4 shrink-0 text-mentor-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="truncate text-xs text-mentor-text">{coverLetter.originalFileName}</span>
                    </div>
                  )}

                  {coverLetter.content ? (
                    <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-mentor-muted">
                      {coverLetter.content}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-mentor-muted">
                      {coverLetter.originalFileName ? '파일 텍스트 추출 중 오류가 발생했습니다.' : '내용이 없는 자기소개서입니다.'}
                    </p>
                  )}

                  {coverLetter.content && (
                    <button
                      type="button"
                      onClick={() => setViewingCoverLetter(coverLetter)}
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
 * 빈 목록 안내용 보조 컴포넌트입니다.
 *
 * @param {object} props 컴포넌트 속성
 * @param {string} props.title 제목
 * @param {string} props.description 설명
 */
function EmptyState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-mentor-border px-6 py-14 text-center">
      <p className="text-base font-semibold text-mentor-text">{title}</p>
      <p className="mt-2 text-sm text-mentor-muted">{description}</p>
    </div>
  );
}

/**
 * 날짜 문자열을 한글 표시 형식으로 변환합니다.
 *
 * @param {string | null} value 날짜 문자열
 * @returns {string} 화면용 날짜
 */
function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('ko-KR');
}
