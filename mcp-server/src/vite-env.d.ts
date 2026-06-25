interface ImportMetaEnv {
  readonly VITE_WCL_API_BASE: string;
  readonly VITE_WCL_DIRECT: string;
  readonly VITE_SERVER_BASE: string;
  readonly VITE_API_BASE: string;
  readonly PROD: boolean;
  readonly DEV: boolean;
  readonly MODE: string;
  readonly LOCALE: string;
  readonly [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
