import 'dotenv/config';

function optionalInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }
  return value;
}

function requiredInProduction(name: string, fallback: string): string {
  const value = process.env[name]?.trim() || fallback;
  if (process.env.NODE_ENV === 'production' && value === fallback) {
    throw new Error(`${name} must be configured in production`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.API_HOST?.trim() || '127.0.0.1',
  port: optionalInteger('API_PORT', 8091),
  mysqlHost: process.env.MYSQL_HOST?.trim() || '127.0.0.1',
  mysqlPort: optionalInteger('MYSQL_PORT', 3306),
  mysqlDatabase: requiredInProduction('MYSQL_DATABASE', 'koshit'),
  mysqlUser: requiredInProduction('MYSQL_USER', 'koshit_app'),
  mysqlPassword: process.env.MYSQL_PASSWORD ?? '',
  mysqlConnectionLimit: optionalInteger('MYSQL_CONNECTION_LIMIT', 10),
  gstProviderKey: process.env.GST_API_PROVIDER_KEY?.trim() || '',
  gstApiBaseUrl:
    process.env.GST_API_BASE_URL?.trim() || 'https://www.gstinapi.in',
  gstApiTimeoutMs: optionalInteger('GST_API_TIMEOUT_MS', 10_000),
};

if (env.nodeEnv === 'production' && !env.mysqlPassword) {
  throw new Error('MYSQL_PASSWORD must be configured in production');
}
