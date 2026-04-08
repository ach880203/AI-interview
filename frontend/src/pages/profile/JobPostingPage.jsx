import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import * as profileApi from '../../api/profile';

/**
 * 채용공고 관리 페이지입니다.
 *
 * [역할]
 * 사용자가 지원하려는 회사의 공고 정보를 저장하고,
 * 면접 질문 생성 시 참고 문서로 활용할 수 있게 합니다.
 */
export default function JobPostingPage() {
  const [jobPostings, setJobPostings] = useState([]);
  const [activeTab, setActiveTab] = useState('direct');
  const [form, setForm] = useState({
    company: '',
    position: '',
    description: '',
    location: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlSubmitting, setUrlSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  /**
   * 페이지 진입 시 채용공고 목록을 조회합니다.
   */
  useEffect(() => {
    fetchJobPostings();
  }, []);

  /**
   * 채용공고 목록을 서버에서 조회합니다.
   */
  async function fetchJobPostings() {
    setLoading(true);

    try {
      const { data } = await profileApi.getJobPostings();
      setJobPostings(data.data ?? []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '채용공고 목록을 불러오지 못했습니다.'
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * 입력 폼을 초기 상태로 되돌립니다.
   */
  function resetForm() {
    setForm({
      company: '',
      position: '',
      description: '',
      location: '',
    });
    setSelectedFile(null);
    setEditingId(null);
  }

  /**
   * 입력값을 상태에 반영합니다.
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
   * @param {React.ChangeEvent<HTMLInputElement>} event 파일 이벤트
   */
  function handleFileChange(event) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  /**
   * 수정할 채용공고를 폼에 채워 넣습니다.
   *
   * @param {object} jobPosting 수정 대상 채용공고
   */
  function handleEditClick(jobPosting) {
    setEditingId(jobPosting.id);
    setForm({
      company: jobPosting.company ?? '',
      position: jobPosting.position ?? '',
      description: jobPosting.description ?? '',
      location: jobPosting.location ?? '',
    });
    setSelectedFile(null);
    setError('');
    setSuccessMessage('');
  }

  /**
   * URL을 입력해 AI로 채용공고를 자동 등록합니다.
   */
  async function handleUrlSubmit(event) {
    event.preventDefault();

    if (!urlInput.trim()) {
      setError('URL을 입력해 주세요.');
      return;
    }

    setUrlSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      await profileApi.createJobPostingFromUrl(urlInput.trim());
      setSuccessMessage('AI가 채용공고를 성공적으로 가져왔습니다.');
      setUrlInput('');
      await fetchJobPostings();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          'URL에서 채용공고를 가져오지 못했습니다. 다른 URL을 시도해 보세요.'
      );
    } finally {
      setUrlSubmitting(false);
    }
  }

  /**
   * 채용공고를 등록하거나 수정합니다.
   *
   * [동작 방식]
   * 채용공고는 첨부 파일을 받을 수 있으므로 이력서와 동일하게 multipart 요청을 사용합니다.
   */
  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.company.trim()) {
      setError('회사명을 입력해 주세요.');
      return;
    }

    if (!form.position.trim()) {
      setError('포지션명을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMessage('');

    try {
      const request = {
        company: form.company.trim(),
        position: form.position.trim(),
        description: form.description.trim(),
        location: form.location.trim() || null,
      };

      if (editingId) {
        await profileApi.updateJobPosting(editingId, request, selectedFile);
        setSuccessMessage('채용공고를 수정했습니다.');
      } else {
        await profileApi.createJobPosting(request, selectedFile);
        setSuccessMessage('채용공고를 등록했습니다.');
      }

      resetForm();
      await fetchJobPostings();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '채용공고 저장 중 오류가 발생했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 채용공고를 삭제합니다.
   *
   * @param {number} id 삭제 대상 ID
   */
  async function handleDelete(id) {
    const shouldDelete = window.confirm('이 채용공고를 삭제하시겠습니까?');
    if (!shouldDelete) {
      return;
    }

    setError('');
    setSuccessMessage('');

    try {
      await profileApi.deleteJobPosting(id);
      setSuccessMessage('채용공고를 삭제했습니다.');

      if (editingId === id) {
        resetForm();
      }

      await fetchJobPostings();
    } catch (requestError) {
      setError(
        requestError.response?.data?.error?.message ??
          '채용공고 삭제 중 오류가 발생했습니다.'
      );
    }
  }

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-2xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-mentor-text">채용공고 관리</h1>
            <p className="mt-2 text-sm text-mentor-muted">
              지원 회사와 포지션 정보를 저장해서 면접 질문 생성 품질을 높입니다.
            </p>
          </div>

          {/* 탭 토글 — mentor 색상 */}
          <div className="mb-5 flex rounded-lg border border-mentor-border bg-mentor-bg p-1">
            <button
              type="button"
              onClick={() => { setActiveTab('direct'); setError(''); setSuccessMessage(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                activeTab === 'direct'
                  ? 'bg-mentor-surface text-mentor-primary shadow-sm'
                  : 'text-mentor-muted hover:text-mentor-text'
              }`}
            >
              직접 입력
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('url'); setError(''); setSuccessMessage(''); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                activeTab === 'url'
                  ? 'bg-mentor-surface text-mentor-primary shadow-sm'
                  : 'text-mentor-muted hover:text-mentor-text'
              }`}
            >
              URL로 가져오기
            </button>
          </div>

          {activeTab === 'url' && (
            <form className="space-y-4" onSubmit={handleUrlSubmit}>
              <div className="flex flex-col gap-1">
                <label htmlFor="job-posting-url" className="text-sm font-medium text-mentor-text">
                  채용공고 URL
                </label>
                <input
                  id="job-posting-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); if (error) setError(''); }}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-mentor-border px-3 py-2.5 text-sm text-mentor-text outline-none transition placeholder:text-mentor-muted focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
                />
                <p className="text-xs text-mentor-muted">
                  AI가 페이지를 분석해 회사명·포지션·공고 내용을 자동으로 추출합니다.
                  JavaScript로만 렌더링되는 SPA 페이지는 인식되지 않을 수 있습니다.
                </p>
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

              <Button type="submit" loading={urlSubmitting}>
                {urlSubmitting ? 'AI가 페이지를 분석 중입니다 (10~30초)...' : 'AI로 가져오기'}
              </Button>
            </form>
          )}

          {activeTab === 'direct' && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              id="job-posting-company"
              label="회사명"
              name="company"
              value={form.company}
              onChange={handleChange}
              placeholder="예: 오픈AI 코리아"
            />

            <Input
              id="job-posting-position"
              label="포지션명"
              name="position"
              value={form.position}
              onChange={handleChange}
              placeholder="예: 백엔드 엔지니어"
            />

            <Input
              id="job-posting-location"
              label="근무 지역"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="예: 서울 강남구, 경기 판교 (선택)"
            />

            <div className="flex flex-col gap-1">
              <label htmlFor="job-posting-description" className="text-sm font-medium text-mentor-text">
                채용공고 설명
              </label>
              <textarea
                id="job-posting-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={10}
                placeholder="주요 업무, 자격 요건, 우대 사항을 붙여 넣어 주세요."
                className="w-full rounded-lg border border-mentor-border px-3 py-2.5 text-sm text-mentor-text outline-none transition placeholder:text-mentor-muted focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="job-posting-file" className="text-sm font-medium text-mentor-text">
                첨부 파일
              </label>
              {/* 파일 입력 — mentor 색상 */}
              <input
                id="job-posting-file"
                type="file"
                onChange={handleFileChange}
                className="rounded-lg border border-mentor-border bg-mentor-surface px-3 py-2 text-sm text-mentor-text file:mr-3 file:rounded-md file:border-0 file:bg-mentor-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-mentor-primary"
              />
              <p className="text-xs text-mentor-muted">
                공고 PDF나 캡처 문서를 함께 올리면 참고 자료로 활용할 수 있습니다.
              </p>
              {selectedFile && (
                <p className="text-xs text-mentor-primary">선택한 파일: {selectedFile.name}</p>
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
                {editingId ? '채용공고 수정하기' : '채용공고 등록하기'}
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
          )}
        </section>

        <section className="rounded-2xl bg-mentor-surface p-6 shadow-[var(--shadow-card)]">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-mentor-text">등록한 채용공고</h2>
              <p className="mt-1 text-sm text-mentor-muted">
                면접 질문 생성 시 회사와 포지션 맥락으로 활용됩니다.
              </p>
            </div>
            <span className="rounded-full bg-mentor-accent px-3 py-1 text-xs font-semibold text-mentor-primary">
              총 {jobPostings.length}개
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          ) : jobPostings.length === 0 ? (
            <EmptyState
              title="등록한 채용공고가 없습니다."
              description="왼쪽 폼에서 지원하려는 공고를 먼저 등록해 주세요."
            />
          ) : (
            <div className="space-y-4">
              {jobPostings.map((jobPosting) => {
                const isExpanded = expandedIds.has(jobPosting.id);
                return (
                <article key={jobPosting.id} className="rounded-2xl border border-mentor-border p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-mentor-text">
                          {jobPosting.company} - {jobPosting.position}
                        </h3>
                        {jobPosting.sourceUrl && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            AI 수집
                          </span>
                        )}
                        {jobPosting.dueDate && (
                          <DueDateBadge dueDate={jobPosting.dueDate} />
                        )}
                      </div>
                      {jobPosting.location && (
                        <p className="mt-0.5 text-xs text-mentor-muted">
                          📍 {jobPosting.location}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-mentor-muted">
                        수정일 {formatDateTime(jobPosting.updatedAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(jobPosting)}
                        className="rounded-lg bg-mentor-accent px-3 py-2 text-sm font-medium text-mentor-primary transition hover:bg-mentor-primary/10"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(jobPosting.id)}
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* 아코디언 — 상세 정보 */}
                  {isExpanded && (
                    <>
                      {/* 공고 내용 — 섹션 헤더([주요업무] 등)를 강조 표시합니다 */}
                      <div className="mt-4 space-y-3 text-sm leading-6">
                        {jobPosting.description
                          ? renderDescription(jobPosting.description)
                          : <p className="text-mentor-muted">설명이 없는 채용공고입니다.</p>}
                      </div>

                      {jobPosting.fileUrl && (
                        <a
                          href={jobPosting.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-flex text-sm font-medium text-mentor-primary hover:text-mentor-primary-dark"
                        >
                          첨부 파일 보기
                        </a>
                      )}

                      {jobPosting.sourceUrl && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg border border-mentor-border bg-mentor-bg px-3 py-2">
                          <span className="shrink-0 text-xs font-medium text-mentor-muted">출처 URL</span>
                          <a
                            href={jobPosting.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="min-w-0 flex-1 truncate text-xs text-mentor-primary hover:text-mentor-primary-dark hover:underline"
                            title={jobPosting.sourceUrl}
                          >
                            {jobPosting.sourceUrl}
                          </a>
                        </div>
                      )}
                    </>
                  )}

                  {/* 펼치기/접기 버튼 */}
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => toggleExpand(jobPosting.id)}
                      className="text-xs text-mentor-muted hover:text-mentor-primary transition"
                    >
                      {isExpanded ? '접기 ▲' : '펼치기 ▼'}
                    </button>
                  </div>
                </article>
                );
              })}
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
 * 지원 마감일 뱃지입니다.
 * D-Day가 7일 이하면 빨간색, 14일 이하면 주황색, 그 외에는 파란색으로 표시합니다.
 *
 * @param {object} props
 * @param {string} props.dueDate yyyy-MM-dd 형식 마감일
 */
function DueDateBadge({ dueDate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  const diffMs = due - today;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let label;
  let colorClass;

  if (diffDays < 0) {
    label = '마감';
    colorClass = 'bg-gray-100 text-gray-500';
  } else if (diffDays === 0) {
    label = 'D-Day';
    colorClass = 'bg-red-50 text-red-600';
  } else {
    label = `D-${diffDays} (${dueDate})`;
    if (diffDays <= 7) colorClass = 'bg-red-50 text-red-600';
    else if (diffDays <= 14) colorClass = 'bg-orange-50 text-orange-600';
    else colorClass = 'bg-blue-50 text-blue-600';
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      마감 {label}
    </span>
  );
}

/**
 * 날짜 문자열을 한글 형식으로 변환합니다.
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

/**
 * description 텍스트를 섹션 헤더([주요업무] 등)와 본문으로 나눠 렌더링합니다.
 * [섹션명] 패턴을 만나면 강조 헤더로, 나머지는 일반 텍스트로 표시합니다.
 *
 * @param {string} text description 전체 텍스트
 * @returns {JSX.Element[]}
 */
function renderDescription(text) {
  const lines = text.split('\n');
  const elements = [];
  let currentSection = [];
  let keyIdx = 0;

  function flushSection() {
    if (currentSection.length === 0) return;
    elements.push(
      <p key={`body-${keyIdx++}`} className="whitespace-pre-wrap text-mentor-muted">
        {linkifyText(currentSection.join('\n'))}
      </p>
    );
    currentSection = [];
  }

  for (const line of lines) {
    // [섹션명] 패턴
    if (/^\[.+\]$/.test(line.trim())) {
      flushSection();
      elements.push(
        <p key={`head-${keyIdx++}`} className="font-semibold text-mentor-text">
          {line.trim()}
        </p>
      );
    } else {
      currentSection.push(line);
    }
  }
  flushSection();

  return elements;
}

/**
 * 텍스트 안의 URL을 클릭 가능한 링크로 변환합니다.
 * 공고 설명에 포함된 URL 주소를 하이퍼링크로 바꿔
 * 클릭하면 해당 페이지로 바로 이동할 수 있게 합니다.
 *
 * @param {string} text 원본 텍스트
 * @returns {(string | JSX.Element)[]} 링크가 포함된 React 노드 배열
 */
function linkifyText(text) {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/;
  const parts = text.split(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/g);

  return parts.map((part, index) =>
    urlPattern.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="text-mentor-primary underline hover:text-mentor-primary-dark"
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}
