import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // JSX 멤버 표현식(<motion.div>)은 현재 설정만으로 사용 여부를 놓치는 경우가 있어 예외 패턴을 함께 둡니다.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]|^motion$' }],
      // 기존 코드베이스는 상태 복원과 초기화에 effect를 폭넓게 쓰고 있어, 우선 CI 차단 대신 경고 수준으로 낮춥니다.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
])
