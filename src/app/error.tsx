"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="id">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white border border-red-200 rounded-xl p-8 max-w-md mx-auto text-center shadow-lg">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-red-800 mb-2">Terjadi Kesalahan</h2>
            <p className="text-gray-600 mb-4">
              Mohon maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.
            </p>
            {process.env.NODE_ENV === "development" && error.message && (
              <p className="text-xs text-red-400 mb-4 font-mono bg-red-50 p-2 rounded">
                {error.message}
              </p>
            )}
            <button
              onClick={reset}
              className="px-6 py-2 bg-[var(--primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
