const SUBSCRIPTION_CHECKOUT_STORAGE_KEY = 'ai_interview_subscription_checkout';

/**
 * 援щ룆 寃곗젣 吏곸쟾 ?좏깮 ?뺣낫瑜??몄뀡 ?⑥쐞濡???ν빀?덈떎.
 *
 * [二쇱쓽]
 * 釉뚮씪?곗? ??쓣 ?レ쑝硫??먯뿰?ㅻ읇寃?珥덇린?붾릺?꾨줉 sessionStorage瑜??ъ슜?⑸땲??
 * 二쇰Ц ?뺣낫泥섎읆 ?κ린媛??④만 ?꾩슂媛 ?녿뒗 ?꾩떆 寃곗젣 ?먮쫫?닿린 ?뚮Ц?낅땲??
 */
export function saveSubscriptionCheckoutDraft(subscriptionCheckoutDraft) {
  sessionStorage.setItem(
    SUBSCRIPTION_CHECKOUT_STORAGE_KEY,
    JSON.stringify(subscriptionCheckoutDraft)
  );
}

/**
 * ??λ맂 援щ룆 寃곗젣 珥덉븞??遺덈윭?듬땲??
 */
export function loadSubscriptionCheckoutDraft() {
  const rawValue = sessionStorage.getItem(SUBSCRIPTION_CHECKOUT_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    /**
     * ????뺤떇??諛붾뚯뿀嫄곕굹 媛믪씠 源⑥죱?????댁쟾 ?곗씠?곕? 踰꾨━怨?     * ??援щ룆 ?먮쫫???ㅼ떆 ?쒖옉?????덇쾶 ?뺣━?⑸땲??
     */
    sessionStorage.removeItem(SUBSCRIPTION_CHECKOUT_STORAGE_KEY);
    return null;
  }
}

/**
 * 寃곗젣媛 ?앸궃 ??援щ룆 寃곗젣 珥덉븞??鍮꾩썎?덈떎.
 */
export function clearSubscriptionCheckoutDraft() {
  sessionStorage.removeItem(SUBSCRIPTION_CHECKOUT_STORAGE_KEY);
}

