import { Component } from 'react';

/**
 * 전역 에러 경계 컴포넌트입니다.
 *
 * [역할]
 * 자식 컴포넌트에서 렌더링 중 예외가 발생했을 때 전체 앱이 화이트스크린으로
 * 다운되지 않도록 폴백 UI를 보여줍니다.
 *
 * [사용법]
 * <ErrorBoundary>
 *   <SomeComponent />
 * </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-sm text-center">
          <p className="text-4xl">⚠️</p>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            예기치 않은 오류가 발생했습니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            일시적인 문제일 수 있습니다. 홈으로 돌아가 다시 시도해 주세요.
          </p>
          {this.state.error && (
            <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-600 text-left">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => this.handleReset()}
            className="mt-6 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }
}
