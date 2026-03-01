import axios, {
    type InternalAxiosRequestConfig,
    type AxiosResponse,
    type AxiosError,
} from 'axios';
import { env } from '../config/env';
import { JWT_STORAGE_KEY, USER_STORAGE_KEY } from '../constants';

// ── Core client ──────────────────────────────────────────────────────────────
const apiClient = axios.create({
    baseURL: env.API_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30_000,
    withCredentials: true, // send refresh-token cookie automatically
});

// Track ongoing refresh so concurrent 401s don't spam the refresh endpoint
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function flushQueue(token: string) {
    refreshQueue.forEach((cb) => cb(token));
    refreshQueue = [];
}

// ── Request interceptor – attach Bearer token ─────────────────────────────────
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem(JWT_STORAGE_KEY);
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response interceptor – silent token refresh on 401 ───────────────────────
apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Attempt refresh once; skip for auth routes to avoid infinite loops
        if (
            error.response?.status === 401 &&
            !original._retry &&
            original.url &&
            !original.url.includes('/api/auth/')
        ) {
            if (isRefreshing) {
                // Queue this request until a refresh resolves
                return new Promise((resolve, reject) => {
                    refreshQueue.push((token) => {
                        original.headers.Authorization = `Bearer ${token}`;
                        resolve(apiClient(original));
                    });
                });
            }

            original._retry = true;
            isRefreshing = true;

            try {
                // Refresh endpoint uses httpOnly cookie — no body needed
                const { data } = await axios.post<{ access_token: string }>(
                    `${env.API_URL}/api/auth/refresh`,
                    {},
                    { withCredentials: true }
                );
                const newToken = data.access_token;
                localStorage.setItem(JWT_STORAGE_KEY, newToken);
                apiClient.defaults.headers.common.Authorization = `Bearer ${newToken}`;
                flushQueue(newToken);
                original.headers.Authorization = `Bearer ${newToken}`;
                return apiClient(original);
            } catch {
                // Refresh failed – wipe session and redirect to login
                console.warn('[auth] Token refresh failed. Redirecting to login.');
                refreshQueue = [];
                localStorage.removeItem(JWT_STORAGE_KEY);
                localStorage.removeItem(USER_STORAGE_KEY);
                if (typeof window !== 'undefined') window.location.href = '/login';
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default apiClient;
