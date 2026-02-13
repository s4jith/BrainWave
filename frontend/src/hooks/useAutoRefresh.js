/**
 * useAutoRefresh - Custom hook for automatic data refresh
 * Refreshes data on window focus and optionally on interval
 */

import { useEffect } from 'react';

export const useAutoRefresh = (fetchFunction, dependencies = [], options = {}) => {
  const {
    onFocus = true,
    interval = null, // Set to milliseconds for periodic refresh (e.g., 30000 for 30s)
  } = options;

  // Refresh on window focus
  useEffect(() => {
    if (!onFocus) return;

    const handleFocus = () => {
      fetchFunction();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, dependencies);

  // Periodic refresh
  useEffect(() => {
    if (!interval) return;

    const intervalId = setInterval(() => {
      fetchFunction();
    }, interval);

    return () => clearInterval(intervalId);
  }, dependencies);
};

export default useAutoRefresh;
