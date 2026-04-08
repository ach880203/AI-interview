import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as interviewApi from '../../api/interview';
import * as profileApi from '../../api/profile';
import AiWorkStatusCard from '../../components/common/AiWorkStatusCard';
import UsageLimitBanner from '../../components/common/UsageLimitBanner';
import Button from '../../components/ui/Button';

/**
 * 면접 설정 페이지
 *
 * [역할]
 * 면접에 참고할 이력서, 자기소개서, 채용공고를 선택하고
 * 실제 면접 세션을 시작하는 화면입니다.
 *
 * [동작 방식]
 * 1. 페이지 진입 시 프로필 관련 문서 목록을 병렬로 조회합니다.
 * 2. 사용자가 각 문서를 선택합니다.
 * 3. "면접 시작" 버튼을 누르면 세션 시작 API를 호출합니다.
 * 4. 받은 첫 질문과 세션 정보를 면접 진행 페이지로 전달합니다.
 */
export default function InterviewSetupPage() {
  const navigate = useNavigate();

  const [resumes, setResumes] = useState([]);
  const [coverLetters, setCoverLetters] = useState([]);
  const [jobPostings, setJobPostings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState({
    resumeId: '',
    coverLetterId: '',
    jobPostingId: '',
    questionType: '',
  });

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [usageLimitExceeded, setUsageLimitExceeded] = useState(false);

  /**
   * 문서 목록 조회
   *
   * [역할]
   * 이력서, 자기소개서, 채용공고를 한 번에 불러옵니다.
   *
   * [주의]
   * 채용공고 응답 DTO는 `title`이 아니라 `company`, `position`을 사용하므로
   * 화면 표시용 라벨도 별도로 만들어야 합니다.
   */
  useEffect(() => {
    async function fetchDocuments() {
      setLoading(true);

      const [resumeResult, coverLetterResult, jobPostingResult] = await Promise.allSettled([
        profileApi.getResumes(),
        profileApi.getCoverLetters(),
        profileApi.getJobPostings(),
      ]);

      if (resumeResult.status === 'fulfilled') {
        setResumes(resumeResult.value.data.data ?? []);
      }

      if (coverLetterResult.status === 'fulfilled') {
        setCoverLetters(coverLetterResult.value.data.data ?? []);
      }

      if (jobPostingResult.status === 'fulfilled') {
        setJobPostings(jobPostingResult.value.data.data ?? []);
      }

      setLoading(false);
    }

    fetchDocuments();
  }, []);

  /**
   * 선택값 변경 처리
   *
   * [역할]
   * select의 name 속성을 기준으로 상태를 갱신합니다.
   */
  const handleSelect = (event) => {
    const { name, value } = event.target;
    setSelected((previous) => ({ ...previous, [name]: value }));

    if (error) {
      setError('');
    }
  };

  /**
   * 면접 시작 처리
   *
   * [동작 방식]
   * 선택되지 않은 값은 null로 변환해 백엔드에 전달합니다.
   * 이렇게 해야 Optional 문서 없이도 면접 세션을 시작할 수 있습니다.
   */
  const handleStart = async () => {
    setStarting(true);
    setError('');
    setUsageLimitExceeded(false);

    try {
      const requestBody = {
        resumeId: selected.resumeId ? Number(selected.resumeId) : null,
        coverLetterId: selected.coverLetterId ? Number(selected.coverLetterId) : null,
        jobPostingId: selected.jobPostingId ? Number(selected.jobPostingId) : null,
        questionType: selected.questionType || null,
      };

      const { data } = await interviewApi.startSession(requestBody);
      const session = data.data;

      // sessionId를 URL에 포함하여 새로고침 시에도 세션 복구 가능
      navigate(`/interview/session/${session.sessionId}`, {
        state: {
          sessionId: session.sessionId,
          firstQuestion: session.firstQuestion,
          totalQuestions: 5,
        },
      });
    } catch (requestError) {
      const errorCode = requestError.response?.data?.error?.code;
      if (errorCode === 'DAILY_USAGE_LIMIT_EXCEEDED') {
        setUsageLimitExceeded(true);
      } else {
        const message =
          requestError.code === 'ECONNABORTED'
            ? '면접 질문 생성 시간이 길어지고 있습니다. 잠시 후 다시 시도해주세요.'
            : requestError.response?.data?.error?.message ??
              '면접 세션 생성에 실패했습니다.';
        setError(message);
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-mentor-bg px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-mentor-accent">
            <span className="text-3xl" aria-hidden="true">🎤</span>
          </div>
          <h1 className="text-2xl font-bold text-mentor-text">AI 면접 시작</h1>
          <p className="mt-2 text-sm text-mentor-muted">
            면접에 참고할 문서를 선택하면 AI가 맞춤형 질문을 생성합니다.
            <br />
            모든 항목은 선택 사항입니다.
          </p>
        </div>

        <div className="rounded-2xl bg-mentor-surface p-8 shadow-lg">
          {loading ? (
            <div className="flex justify-center py-12">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-mentor-accent border-t-mentor-primary" />
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <SelectField
                label="이력서"
                name="resumeId"
                value={selected.resumeId}
                onChange={handleSelect}
                options={resumes}
                getLabel={(resume) => resume.title}
                emptyText="이력서를 선택해주세요. (선택 사항)"
              />

              <SelectField
                label="자기소개서"
                name="coverLetterId"
                value={selected.coverLetterId}
                onChange={handleSelect}
                options={coverLetters}
                getLabel={(coverLetter) => coverLetter.title}
                emptyText="자기소개서를 선택해주세요. (선택 사항)"
              />

              <SelectField
                label="채용공고"
                name="jobPostingId"
                value={selected.jobPostingId}
                onChange={handleSelect}
                options={jobPostings}
                getLabel={(jobPosting) => `${jobPosting.company} - ${jobPosting.position}`}
                emptyText="채용공고를 선택해주세요. (선택 사항)"
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-mentor-text">면접 유형</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {QUESTION_TYPE_OPTIONS.map(({ value, label, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setSelected((prev) => ({
                          ...prev,
                          questionType: prev.questionType === value ? '' : value,
                        }));
                        if (error) setError('');
                      }}
                      className={`rounded-xl border-2 px-3 py-3 text-center transition active:scale-95 ${
                        selected.questionType === value
                          ? 'border-mentor-primary bg-mentor-accent'
                          : 'border-mentor-border bg-mentor-surface hover:border-mentor-primary-light'
                      }`}
                    >
                      <p className={`text-sm font-semibold ${selected.questionType === value ? 'text-mentor-primary' : 'text-mentor-text'}`}>
                        {label}
                      </p>
                      <p className="mt-0.5 text-xs text-mentor-muted">{desc}</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-mentor-muted">선택하지 않으면 AI가 자동으로 질문 유형을 선택합니다.</p>
              </div>

              {usageLimitExceeded && (
                <UsageLimitBanner featureName="면접" />
              )}

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div className="rounded-lg bg-mentor-accent px-4 py-3 text-xs text-mentor-primary">
                면접은 총 5개의 질문으로 진행되며, AI가 답변 내용을 바탕으로 다음 질문을 이어서 생성합니다.
              </div>

              {starting && (
                <AiWorkStatusCard
                  compact
                  title="AI가 면접 질문을 준비하고 있습니다."
                  description="선택한 문서를 바탕으로 첫 질문을 만들고 있습니다."
                  hint="처음 질문은 문서 길이에 따라 조금 더 오래 걸릴 수 있습니다."
                />
              )}

              <Button onClick={handleStart} loading={starting} className="mt-2">
                {starting ? 'AI 면접 질문 생성 중...' : '면접 시작하기'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const QUESTION_TYPE_OPTIONS = [
  { value: '기술', label: '기술', desc: 'CS·프로젝트' },
  { value: '인성', label: '인성', desc: '가치관·협업' },
  { value: '압박', label: '압박', desc: '단점·실패' },
  { value: '상황', label: '상황', desc: '시나리오' },
];

/**
 * 공통 선택 필드
 *
 * [역할]
 * 라벨, 드롭다운, 빈 목록 안내 문구를 한 세트로 묶어
 * 이 페이지에서 반복되는 select UI를 재사용합니다.
 */
function SelectField({ label, name, value, onChange, options, getLabel, emptyText }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-mentor-text">{label}</label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-lg border border-mentor-border bg-mentor-surface px-3 py-2.5 text-sm text-mentor-text outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
      >
        <option value="">{emptyText}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {getLabel(option)}
          </option>
        ))}
      </select>

      {options.length === 0 && (
        <p className="text-xs text-mentor-muted">
          등록된 {label}이(가) 없습니다.
        </p>
      )}
    </div>
  );
}
