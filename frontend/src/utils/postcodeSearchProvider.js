/**
 * 카카오 우편번호 서비스(Daum Postcode v2) 공급자 모듈
 *
 * [역할]
 * index.html에서 스크립트를 미리 로드하지만,
 * 네트워크 차단 등으로 로드 실패 시에도 동적 로드를 재시도합니다.
 * 로드 성공 여부와 무관하게 onFallback 콜백을 통해 폴백 UI로 이어집니다.
 *
 * [사용 화면]
 * - 주문서(OrderCheckoutPage) → 배송지 주소 찾기
 * - 마이페이지(MyPage) ProfileSection → 기본 배송지 찾기
 */

const DAUM_POSTCODE_SCRIPT_URL =
  'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';

/** 동적 로드 요청이 중복 발생하지 않도록 Promise를 전역으로 관리합니다. */
let postcodeScriptPromise = null;

/**
 * 다음 우편번호 스크립트를 한 번만 불러옵니다.
 *
 * [이유]
 * index.html에서 미리 로드했다면 window.daum.Postcode가 이미 있어서 즉시 반환됩니다.
 * 스크립트가 없는 경우에만 동적으로 추가하고, 전역 Promise로 중복 요청을 막습니다.
 */
function loadDaumPostcodeScript() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('브라우저 환경에서만 주소 검색을 사용할 수 있습니다.'));
  }

  if (window.daum?.Postcode) {
    return Promise.resolve();
  }

  if (postcodeScriptPromise) {
    return postcodeScriptPromise;
  }

  postcodeScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[data-daum-postcode="true"]');

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('다음 우편번호 스크립트를 불러오지 못했습니다.')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = DAUM_POSTCODE_SCRIPT_URL;
    script.async = true;
    script.dataset.daumPostcode = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('다음 우편번호 스크립트를 불러오지 못했습니다.'));
    document.body.appendChild(script);
  });

  return postcodeScriptPromise;
}

/**
 * 다음 우편번호 응답을 현재 프로젝트의 공통 주소 구조로 맞춥니다.
 *
 * [의도]
 * 마이페이지와 주문서가 같은 shape을 쓰면
 * 나중에 다른 주소 공급자로 바꿔도 화면 쪽 코드는 거의 그대로 둘 수 있습니다.
 */
function mapDaumAddressToPreset(addressData) {
  const regionLabel = [addressData.sido, addressData.sigungu].filter(Boolean).join(' ') || '주소 검색';

  return {
    postalCode: addressData.zonecode ?? '',
    roadAddress: addressData.roadAddress || addressData.address || '',
    buildingName: addressData.buildingName || '건물명 없음',
    regionLabel,
  };
}

/**
 * 실제 우편번호 공급자를 먼저 열고, 실패하면 호출한 화면이 자체 대안을 보여주게 합니다.
 *
 * [주의]
 * 외부 스크립트 로드가 실패해도 기능이 완전히 막히지 않도록
 * onFallback을 통해 현재 프로젝트의 프리셋 주소 대화상자로 자연스럽게 내려갑니다.
 */
export async function openPostcodeSearchProvider({ onSelect, onFallback }) {
  try {
    await loadDaumPostcodeScript();

    if (!window.daum?.Postcode) {
      throw new Error('다음 우편번호 객체를 찾지 못했습니다.');
    }

    new window.daum.Postcode({
      oncomplete(addressData) {
        onSelect?.(mapDaumAddressToPreset(addressData));
      },
    }).open();

    return true;
  } catch (error) {
    console.error('다음 우편번호 서비스를 열지 못해 준비된 주소 목록으로 전환합니다.', error);
    onFallback?.();
    return false;
  }
}
