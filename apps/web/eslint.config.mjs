import nextConfig from 'eslint-config-next/core-web-vitals';

const configs = nextConfig.map((config) => {
  if (!config.rules) return config;
  const rules = { ...config.rules };
  if ('react-hooks/refs' in rules) rules['react-hooks/refs'] = 'warn';
  if ('react-hooks/set-state-in-effect' in rules) rules['react-hooks/set-state-in-effect'] = 'warn';
  if ('react-hooks/preserve-manual-memoization' in rules) rules['react-hooks/preserve-manual-memoization'] = 'warn';
  return { ...config, rules };
});

export default [
  ...configs,
  {
    ignores: ['.next/', 'node_modules/'],
  },
];
