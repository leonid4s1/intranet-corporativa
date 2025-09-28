/* eslint-disable @typescript-eslint/no-unused-vars */
import 'axios';

declare module 'axios' {
  interface InternalAxiosRequestConfig<D = unknown> {
    _retry?: boolean;
  }
  interface AxiosRequestConfig<D = unknown> {
    _retry?: boolean;
    timeoutErrorMessage?: string;
  }
  interface AxiosDefaults<D = unknown> {
    timeoutErrorMessage?: string;
  }
}
