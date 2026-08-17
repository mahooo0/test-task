'use client';

import { useEffect } from 'react';

/**
 * Root error boundary. It replaces the root layout when the layout itself throws,
 * so it must render its own <html>/<body> and cannot rely on the next-intl provider
 * or the app's global stylesheet — Tailwind tokens/utilities are absent here.
 * Copy is therefore kept minimal and bilingual (RU default · EN), styled inline,
 * with the signature CTA gradient hand-copied from the Button `default` variant.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Surface the failure for local debugging / error reporting.
    console.error(error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          color: '#0a0a0a',
          background: '#ffffff',
        }}
      >
        <title>Data Room</title>
        <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>
          Что-то пошло не так
        </h1>
        <p style={{ maxWidth: '28rem', margin: 0, fontSize: '0.875rem', color: '#666666' }}>
          Произошла непредвиденная ошибка. Попробуйте снова. · Something went wrong. Please try
          again.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            appearance: 'none',
            cursor: 'pointer',
            borderRadius: '0.5rem',
            border: '1px solid #eaeaea',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#171717',
            background: 'linear-gradient(to bottom right, #F3F8FF, #ACD1FF)',
          }}
        >
          Попробовать снова · Try again
        </button>
      </body>
    </html>
  );
}
