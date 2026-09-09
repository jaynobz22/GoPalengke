import { useState, useEffect, useCallback } from 'react';

export function navigate(path: string) {
  if (path.startsWith('#')) path = path.slice(1);
  if (!path.startsWith('/')) path = '/' + path;
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

export function usePath(): string {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    function onPop() { setPath(window.location.pathname); }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return path;
}

export function useRoute(): { type: string; slug: string } | null {
  const path = usePath();
  return parsePublicRoute(path);
}

export function parsePublicRoute(path: string): { type: string; slug: string } | null {
  const parts = path.split('/');
  if (parts.length >= 3 && parts[0] === '' && (parts[1] === 's' || parts[1] === 'u')) {
    return { type: parts[1], slug: decodeURIComponent(parts[2]) };
  }
  return null;
}

export function useLegalRoute(): string | null {
  const path = usePath();
  const parts = path.split('/');
  if (parts.length >= 2 && parts[0] === '' && parts[1] === 'legal') {
    const page = parts[2];
    if (page === 'terms' || page === 'disclaimer' || page === 'privacy' || page === 'faq') {
      return page;
    }
  }
  return null;
}

export function useNavigate() {
  return useCallback(navigate, []);
}
