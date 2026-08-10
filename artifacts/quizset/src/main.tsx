import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { setApiAuthTokenGetter } from '@/services/api/http';
import { getSession } from '@/services/supabase';

import './index.css';

// Wire the real API client's bearer-token seam to the current Supabase
// session, once, at startup. When Supabase isn't configured (no
// VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY), `getSession()` resolves to
// `null` and every request simply goes out with no Authorization header —
// exactly today's behaviour, so this is safe to wire unconditionally.
setApiAuthTokenGetter(async () => {
  const session = await getSession();
  return session?.access_token ?? null;
});

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
