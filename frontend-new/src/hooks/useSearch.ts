import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSearchReturn {
    query: string;
    debouncedQuery: string;
    setQuery: (q: string) => void;
    reset: () => void;
}

/**
 * useSearch — debounced search string. Replaces the repeated search filter state
 * in QuestionBank, GroupManagement, StudentManagement, TeacherManagement, etc.
 *
 * @example
 * const { query, debouncedQuery, setQuery } = useSearch(300);
 * // Bind query to <SearchBar value={query} onValueChange={setQuery} />
 * // Use debouncedQuery in your fetch useEffect dependency array
 */
export function useSearch(debounceMs = 300): UseSearchReturn {
    const [query, setQueryState] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setDebouncedQuery(query), debounceMs);
        return () => clearTimeout(timerRef.current);
    }, [query, debounceMs]);

    const setQuery = useCallback((q: string) => setQueryState(q), []);
    const reset = useCallback(() => { setQueryState(''); setDebouncedQuery(''); }, []);

    return { query, debouncedQuery, setQuery, reset };
}
