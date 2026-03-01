import { useState, useCallback } from 'react';

interface PaginationState {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

interface UsePaginationReturn extends PaginationState {
    setPage: (page: number) => void;
    setTotal: (total: number, pageSize?: number) => void;
    reset: () => void;
    /** Offset to pass to API: (page-1)*pageSize */
    offset: number;
}

/**
 * usePagination — replaces the repeated `const [pagination, setPagination] = useState({page 1, limit 10, total 0, pages 1})`
 * pattern in QuestionBank, QuestionPapers, TestManagement, GroupManagement, StudentManagement, TeacherManagement, etc.
 *
 * @example
 * const { page, pageSize, offset, total, totalPages, setPage, setTotal } = usePagination(10);
 * // In fetch callback:
 * setTotal(data.total);
 * // In JSX:
 * <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
 */
export function usePagination(defaultPageSize = 10): UsePaginationReturn {
    const [state, setState] = useState<PaginationState>({
        page: 1,
        pageSize: defaultPageSize,
        total: 0,
        totalPages: 1,
    });

    const setPage = useCallback((page: number) => {
        setState((s) => ({ ...s, page: Math.max(1, Math.min(page, s.totalPages)) }));
    }, []);

    const setTotal = useCallback((total: number, pageSize?: number) => {
        setState((s) => {
            const ps = pageSize ?? s.pageSize;
            const totalPages = Math.max(1, Math.ceil(total / ps));
            return { ...s, total, pageSize: ps, totalPages, page: Math.min(s.page, totalPages) };
        });
    }, []);

    const reset = useCallback(() => {
        setState((s) => ({ ...s, page: 1, total: 0, totalPages: 1 }));
    }, []);

    return {
        ...state,
        offset: (state.page - 1) * state.pageSize,
        setPage,
        setTotal,
        reset,
    };
}
