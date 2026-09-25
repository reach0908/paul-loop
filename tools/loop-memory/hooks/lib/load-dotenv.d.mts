export const ALLOWED_KEYS: readonly string[];
export function loadDotenv(root: string, configured?: string, target?: NodeJS.ProcessEnv): string | null;
export function trustedDatabaseConfig(root: string): {
  host: string; port: number; user: string; password: string; database: string; ssl: boolean; options: string;
};
