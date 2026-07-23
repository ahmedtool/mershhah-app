import { useLocation, useParams as wouterUseParams } from 'wouter';

export function useRouter() {
  const [, navigate] = useLocation();
  return {
    push: (path: string) => navigate(path),
    replace: (path: string) => navigate(path, { replace: true }),
    back: () => window.history.back(),
    refresh: () => window.location.reload(),
  };
}

export function usePathname(): string {
  const [location] = useLocation();
  return location;
}

export function useParams<T extends Record<string, string> = Record<string, string>>(): T {
  return wouterUseParams() as T;
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

export function notFound(): never {
  throw new Error('NOT_FOUND');
}

export { Link } from 'wouter';
