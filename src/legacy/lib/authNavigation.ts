export function isAuthLocation(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('signup') || params.get('auth') === '1';
}

export function authLocation(href: string, open: boolean): string {
  const url = new URL(href);
  if (open) url.searchParams.set('auth', '1');
  else {
    url.searchParams.delete('auth');
    url.searchParams.delete('signup');
    url.pathname = '/';
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function updateAuthLocation(open: boolean) {
  const next = authLocation(window.location.href, open);
  if (open && !isAuthLocation(window.location.search)) {
    window.history.pushState({}, '', next);
  } else {
    window.history.replaceState(window.history.state, '', next);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}