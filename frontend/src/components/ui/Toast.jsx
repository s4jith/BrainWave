import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

const TOAST_STYLES = {
  success: {
    icon: CheckCircle,
    bg: "bg-gradient-to-r from-emerald-900/90 to-emerald-800/90",
    border: "border-emerald-500/40",
    iconColor: "text-emerald-400",
    titleColor: "text-emerald-200",
    bar: "bg-emerald-400",
  },
  error: {
    icon: XCircle,
    bg: "bg-gradient-to-r from-red-900/90 to-red-800/90",
    border: "border-red-500/40",
    iconColor: "text-red-400",
    titleColor: "text-red-200",
    bar: "bg-red-400",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-gradient-to-r from-amber-900/90 to-amber-800/90",
    border: "border-amber-500/40",
    iconColor: "text-amber-400",
    titleColor: "text-amber-200",
    bar: "bg-amber-400",
  },
  info: {
    icon: Info,
    bg: "bg-gradient-to-r from-blue-900/90 to-blue-800/90",
    border: "border-blue-500/40",
    iconColor: "text-blue-400",
    titleColor: "text-blue-200",
    bar: "bg-blue-400",
  },
};

function ToastItem({ id, type = "info", message, onDismiss, duration = 4000 }) {
  const style = TOAST_STYLES[type] || TOAST_STYLES.info;
  const Icon = style.icon;

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`
        relative flex items-start gap-3 w-80 max-w-xs rounded-xl px-4 py-3.5
        border backdrop-blur-md shadow-2xl overflow-hidden
        ${style.bg} ${style.border}
      `}
    >
      {/* Progress bar */}
      <motion.div
        className={`absolute bottom-0 left-0 h-0.5 ${style.bar}`}
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: duration / 1000, ease: "linear" }}
      />

      <Icon className={`mt-0.5 shrink-0 w-5 h-5 ${style.iconColor}`} />
      <p className={`flex-1 text-sm font-medium leading-snug ${style.titleColor}`}>
        {message}
      </p>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 text-white/40 hover:text-white/80 transition-colors mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} onDismiss={onDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
