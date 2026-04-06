import { useState } from 'react';

/**
 * 취소/환불 사유 선택 모달입니다.
 *
 * [역할]
 * 5가지 사유 중 하나를 선택하고, '기타'인 경우 직접 입력할 수 있게 합니다.
 * 확인을 누르면 onConfirm(사유 문자열)을 호출합니다.
 *
 * [의도]
 * 취소/환불 요청 시 관리자가 사유를 확인한 뒤 승인하는 흐름을 지원하기 위해
 * 사유를 반드시 선택하도록 강제합니다.
 */
export default function ReasonSelectModal({ title, options, loading, onConfirm, onClose }) {
  const [selectedKey, setSelectedKey] = useState('');
  const [customReason, setCustomReason] = useState('');

  const isOther = selectedKey === 'other';
  const selectedOption = options.find((opt) => opt.key === selectedKey);
  const finalReason = isOther ? customReason.trim() : (selectedOption?.label ?? '');
  const canSubmit = selectedKey && (!isOther || customReason.trim().length > 0);

  function handleConfirm() {
    if (!canSubmit) return;
    onConfirm(finalReason);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[28px] bg-mentor-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-mentor-text">{title}</h3>
        <p className="mt-2 text-sm text-mentor-muted">
          사유를 선택해주세요. 관리자 확인 후 처리됩니다.
        </p>

        <div className="mt-5 space-y-2">
          {options.map((option) => (
            <label
              key={option.key}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                selectedKey === option.key
                  ? 'border-mentor-primary bg-mentor-accent'
                  : 'border-mentor-border hover:bg-mentor-bg'
              }`}
            >
              <input
                type="radio"
                name="cancel-reason"
                value={option.key}
                checked={selectedKey === option.key}
                onChange={() => setSelectedKey(option.key)}
                className="accent-mentor-primary"
              />
              <span className="text-sm font-semibold text-mentor-text">{option.label}</span>
            </label>
          ))}
        </div>

        {isOther && (
          <textarea
            className="mt-3 w-full rounded-2xl border border-mentor-border px-4 py-3 text-sm text-mentor-text placeholder:text-mentor-muted focus:border-mentor-primary focus:outline-none focus:ring-2 focus:ring-mentor-accent"
            rows={3}
            placeholder="사유를 직접 입력해주세요."
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            maxLength={200}
          />
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-mentor-bg px-4 py-3 text-sm font-semibold text-mentor-muted transition hover:bg-mentor-border"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit || loading}
            className="flex-1 rounded-full bg-mentor-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-mentor-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? '처리 중...' : '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
