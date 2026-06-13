import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { env } from "@core/config/env";
import { tokenStorage } from "@core/auth/tokenStorage";
import { ApiError } from "@core/errors/ApiError";

/**
 * Shared HTTP client.
 * - Injects bearer tokens from tokenStorage.
 * - Normalizes axios errors into ApiError so feature code is transport-agnostic.
 * - Triggers global logout on 401 (matches the existing authFetch contract).
 */

function createClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: env.apiUrl,
    timeout: 60_000,
    headers: { "Content-Type": "application/json" },
  });

  instance.interceptors.request.use((config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError<{ detail?: string; error?: string; message?: string }>) => {
      const status = error.response?.status ?? 0;
      if (status === 401) {
        tokenStorage.handleUnauthorized();
      }

      const payload = error.response?.data;
      const detail =
        payload?.detail ?? payload?.error ?? payload?.message ?? error.message;

      return Promise.reject(
        new ApiError({
          message: detail || `Request failed with status ${status}`,
          status,
          detail,
          data: payload,
        }),
      );
    },
  );

  return instance;
}

export const httpClient = createClient();

export type HttpRequestConfig = AxiosRequestConfig;
