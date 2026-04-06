import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

/* ── Noto Sans KR 폰트 (@fontsource NPM 패키지) ──────────────────
 * Google Fonts CDN 대신 NPM 패키지를 사용합니다.
 * Vite 빌드 시 /assets/ 경로로 복사되어 오프라인에서도 동작합니다.
 * weight: 300(얇게) 400(기본) 500(중간) 600(약간 굵게) — AGENTS.md 폰트 규칙
 * ──────────────────────────────────────────────────────────────── */
import '@fontsource/noto-sans-kr/300.css'
import '@fontsource/noto-sans-kr/400.css'
import '@fontsource/noto-sans-kr/500.css'
import '@fontsource/noto-sans-kr/600.css'

import './index.css'
import AppRouter from './router/index.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
)
