/**
 * 우편번호와 기본 주소를 함께 묶어 화면에 보여주는 함수입니다.
 *
 * [의도]
 * 주문서, 주문 결과, 마이페이지가 모두 같은 형식으로 주소를 보여줘야
 * 사용자가 화면마다 다른 주소 형식으로 혼동하지 않습니다.
 */
export function formatPostalAddress(postalCode, address) {
  const trimmedPostalCode = postalCode?.trim() ?? '';
  const trimmedAddress = address?.trim() ?? '';

  if (trimmedPostalCode && trimmedAddress) {
    return `(${trimmedPostalCode}) ${trimmedAddress}`;
  }

  if (trimmedAddress) {
    return trimmedAddress;
  }

  return trimmedPostalCode ? `(${trimmedPostalCode})` : '';
}

/**
 * 우편번호, 기본 주소, 상세 주소를 한 줄로 합쳐 보여주는 함수입니다.
 *
 * [주의]
 * 상세 주소는 주문 저장용 원본 값이 아니라 화면 표시용으로만 뒤에 붙입니다.
 * 백엔드에는 우편번호와 주소를 분리해서 보내야 이후 주소 검색 공급자 교체가 쉬워집니다.
 */
export function formatFullAddress(postalCode, address, detailAddress) {
  const formattedBaseAddress = formatPostalAddress(postalCode, address);
  const trimmedDetailAddress = detailAddress?.trim() ?? '';

  if (formattedBaseAddress && trimmedDetailAddress) {
    return `${formattedBaseAddress} ${trimmedDetailAddress}`;
  }

  if (formattedBaseAddress) {
    return formattedBaseAddress;
  }

  return trimmedDetailAddress;
}
