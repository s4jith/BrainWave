import type { AxiosInstance, AxiosRequestConfig } from "axios";
import { httpClient } from "@core/http/httpClient";

/**
 * Base repository — thin wrapper around the shared axios instance.
 * Feature repositories extend this and expose typed methods so feature
 * services never speak axios directly. This is the only layer that
 * knows about HTTP transport details.
 */
export abstract class BaseRepository {
  protected readonly client: AxiosInstance;

  protected constructor(client: AxiosInstance = httpClient) {
    this.client = client;
  }

  protected async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  protected async post<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.post<T>(url, body, config);
    return response.data;
  }

  protected async patch<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.patch<T>(url, body, config);
    return response.data;
  }

  protected async put<T>(
    url: string,
    body?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.put<T>(url, body, config);
    return response.data;
  }

  protected async delete<T>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}
