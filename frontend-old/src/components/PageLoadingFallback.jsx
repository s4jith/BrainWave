/**
 * Lightweight fallback spinner for React.lazy Suspense boundaries.
 * Intentionally minimal — the full LoadingSpinner component is too heavy for this.
 */
export default function PageLoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg, #f9fafb)',
    }}>
      <div style={{
        width: 40,
        height: 40,
        border: '3px solid #e5e7eb',
        borderTopColor: '#f97316',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
