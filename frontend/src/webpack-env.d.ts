declare module 'webpack-env' {
  interface WebpackEnv {
    NODE_ENV?: 'development' | 'production'
    ANALYZE?: string
  }

  const env: WebpackEnv
  export = env
}
