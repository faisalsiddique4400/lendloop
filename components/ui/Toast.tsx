"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 3500);
  }, []);
  return (
    <ToastContext value={show}>
      {children}
      <div role="status" aria-live="polite">
        {message && <div className="toast">{message}</div>}
      </div>
    </ToastContext>
  );
}

export const useToast = () => useContext(ToastContext);
