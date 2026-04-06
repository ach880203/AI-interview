import { useEffect, useMemo, useState } from 'react';
import { ADDRESS_SEARCH_PRESETS } from '../data/portalConfig';
import { formatPostalAddress } from './addressUtils';

/**
 * 카카오 우편번호 서비스 실패 시 표시하는 폴백 주소 선택 대화상자입니다.
 *
 * [역할]
 * postcodeSearchProvider.js 에서 window.daum.Postcode 실행에 실패하면
 * onFallback 콜백을 통해 이 대화상자가 열립니다.
 * 네트워크 차단 등 외부 스크립트가 로드되지 않는 환경에서도
 * 주소 입력 흐름이 완전히 막히지 않도록 준비해 둡니다.
 */
export default function AddressSearchDialog({
  open,
  title = '주소 찾기',
  description = '도로명 주소나 건물명을 검색해 기본 주소를 선택해주세요.',
  onClose,
  onSelect,
}) {
  const [searchKeyword, setSearchKeyword] = useState('');

  useEffect(() => {
    if (!open) {
      setSearchKeyword('');
    }
  }, [open]);

  const filteredAddressPresets = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return ADDRESS_SEARCH_PRESETS;
    }

    return ADDRESS_SEARCH_PRESETS.filter((addressPreset) =>
      [
        addressPreset.postalCode,
        addressPreset.roadAddress,
        addressPreset.buildingName,
        addressPreset.regionLabel,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedKeyword))
    );
  }, [searchKeyword]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[32px] bg-mentor-surface p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-mentor-primary">{title}</p>
            <h2 className="mt-2 text-2xl font-bold text-mentor-text">주소를 선택해주세요.</h2>
            <p className="mt-2 text-sm leading-6 text-mentor-muted">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-mentor-bg px-4 py-2 text-sm font-semibold text-mentor-muted transition hover:bg-mentor-border"
          >
            닫기
          </button>
        </div>

        <div className="mt-6 rounded-3xl bg-mentor-bg p-4">
          <label className="block">
            <span className="text-sm font-semibold text-mentor-text">주소 검색어</span>
            <input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="예: 테헤란로, 판교역로, AI 멘토"
              className="mt-2 w-full rounded-2xl border border-mentor-border bg-mentor-surface px-4 py-3 text-sm outline-none transition focus:border-mentor-primary focus:ring-2 focus:ring-mentor-accent"
            />
          </label>
          <p className="mt-3 text-xs leading-5 text-mentor-muted">
            카카오 우편번호 서비스를 불러오지 못한 경우에 표시되는 주소 목록입니다. 키워드로 좁혀서 선택해 주세요.
          </p>
        </div>

        <div className="mt-5 max-h-[360px] space-y-3 overflow-y-auto pr-1">
          {filteredAddressPresets.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-mentor-border px-5 py-10 text-center">
              <p className="text-sm font-semibold text-mentor-text">검색 결과가 없습니다.</p>
              <p className="mt-2 text-sm text-mentor-muted">
                다른 도로명, 건물명, 지역명으로 다시 검색해주세요.
              </p>
            </div>
          ) : (
            filteredAddressPresets.map((addressPreset) => (
              <button
                key={`${addressPreset.postalCode}-${addressPreset.roadAddress}`}
                type="button"
                onClick={() => {
                  onSelect(addressPreset);
                  onClose();
                }}
                className="w-full rounded-3xl border border-mentor-border bg-mentor-bg px-5 py-5 text-left transition hover:border-mentor-primary hover:bg-mentor-surface"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-mentor-primary">
                      {addressPreset.regionLabel}
                    </p>
                    <p className="mt-2 text-base font-bold text-mentor-text">
                      {formatPostalAddress(addressPreset.postalCode, addressPreset.roadAddress)}
                    </p>
                    <p className="mt-2 text-sm text-mentor-muted">{addressPreset.buildingName}</p>
                  </div>
                  <span className="rounded-full bg-mentor-surface px-3 py-1 text-xs font-semibold text-mentor-muted">
                    선택
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
