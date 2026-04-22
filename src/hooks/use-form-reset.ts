"use client";

import { useEffect, useRef, useCallback } from "react";

export function useFormReset(formRef: React.RefObject<HTMLFormElement | null>) {
  const previousStatus = useRef<string | null>(null);

  const resetForm = useCallback(() => {
    if (formRef.current) {
      formRef.current.reset();
    }
  }, [formRef]);

  useEffect(() => {
    // This effect watches for status changes in URL and resets form on success
    const checkStatus = () => {
      const params = new URLSearchParams(window.location.search);
      const status = params.get("status");
      const message = params.get("message");

      if (status === "success" && previousStatus.current !== "success") {
        // Delay reset to allow redirect to complete
        setTimeout(() => {
          resetForm();
          // Clean up URL params
          const url = new URL(window.location.href);
          url.searchParams.delete("status");
          url.searchParams.delete("message");
          window.history.replaceState({}, "", url.toString());
        }, 100);
      }

      previousStatus.current = status;
    };

    checkStatus();

    // Watch for URL changes (browser back/forward)
    window.addEventListener("popstate", checkStatus);
    return () => window.removeEventListener("popstate", checkStatus);
  }, [resetForm]);

  return { resetForm };
}

export function useDebounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => fn(...args), delay);
    }) as T,
    [fn, delay]
  );
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const getValue = useCallback((): T => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  }, [key, initialValue]);

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore = value instanceof Function ? value(getValue()) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    },
    [key, getValue]
  );

  return [getValue, setValue] as const;
}

export function useAdminTableState<T>(key: string, defaultValue: T) {
  const [getValue, setValue] = useLocalStorage<T>(`admin_table_${key}`, defaultValue);
  return [getValue(), setValue] as const;
}