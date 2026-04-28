export function getLegalRobots() {
  const isProd =
    process.env.GRABIT_ENV === 'production' ||
    (process.env.GRABIT_ENV == null && process.env.NODE_ENV === 'production');

  return {
    index: isProd,
    follow: isProd,
  };
}
