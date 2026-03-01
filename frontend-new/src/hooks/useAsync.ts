import { useCallback, useRef, useState } from 'react';

interface AsyncState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

interface UseAsyncReturn<T> extends AsyncState<T> {
    run: (...args: unknown[]) => Promise<T | null>;
    reset: () => void;
    setData: (data: T) => void;
}

/**
 * useAsync — reduces the loading/error/data boilerplate that appears in every page.
 *
 * @example
 * const { data, loading, error, run } = useAsync(fetchGroups);
 * useEffect(() => { run(); }, []);
 */
export function useAsync<T = unknown>(
    asyncFn: (...args: unknown[]) => Promise<T>
): UseAsyncReturn<T> {
    const [state, setState] = useState<AsyncState<T>>({
        data: null,
        loading: false,
        error: null,
    });

    const mountedRef = useRef(true);

    const run = useCallback(
        async (...args: unknown[]): Promise<T | null> => {
            setState((s) => ({ ...s, loading: true, error: null }));
            try {
                const result = await asyncFn(...args);
                if (mountedRef.current) {
                    setState({ data: result, loading: false, error: null });
                }
                return result;
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : 'An unexpected error occurred';
                if (mountedRef.current) {
                    setState((s) => ({ ...s, loading: false, error: message }));
                }
                return null;
            }
        },
        [asyncFn]
    );

    const reset = useCallback(() => {
        setState({ data: null, loading: false, error: null });
    }, []);

    const setData = useCallback((data: T) => {
        setState((s) => ({ ...s, data }));
    }, []);

    return { ...state, run, reset, setData };
}
