/**
 * Every feature module of RUET Chottor. Names must match CLAUDE.md §4 exactly,
 * because they are used for folder names, feature flags and routes.
 */
export const MODULE_KEYS = [
  'auth',
  'users',
  'directory',
  'chat',
  'news',
  'clubs',
  'events',
  'lost-found',
  'marketplace',
  'bus',
  'moderation',
  'admin',
  'notifications',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/** `lost-found` -> `FEATURE_LOST_FOUND` */
export function featureEnvVar(key: ModuleKey): string {
  return `FEATURE_${key.toUpperCase().replace(/-/g, '_')}`;
}

/** Modules are off unless their flag is exactly "true". */
export function enabledModules(env: Record<string, string | undefined>): ModuleKey[] {
  return MODULE_KEYS.filter((key) => env[featureEnvVar(key)] === 'true');
}
