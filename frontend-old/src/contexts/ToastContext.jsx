import React, { createContext, useContext, useState, useCallback } from "react";
import { ToastContainer } from "../components/ui/Toast";

const ToastContext = createContext(null);

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message, duration = 4000) => {
    const id = ++toastIdCounter;
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  const toast = {
    success: (msg, duration) => addToast("success", msg, duration),
    error:   (msg, duration) => addToast("error",   msg, duration),
    warning: (msg, duration) => addToast("warning", msg, duration),
    info:    (msg, duration) => addToast("info",    msg, duration),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
