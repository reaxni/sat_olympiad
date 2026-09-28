/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_API_MODE?: 'mock' | 'unavailable';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DESMOS_API_KEY?: string;
  readonly VITE_MOCK_SCENARIO?: 'countdown' | 'exam' | 'released' | 'expired-code' | 'network-error';
  readonly VITE_MOCK_OPEN_DELAY_SECONDS?: string;
  readonly VITE_MOCK_CLOCK_RATE?: string;
}
