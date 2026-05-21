import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Inject required env vars before config.ts is evaluated
    env: {
      ATC_API_TOKEN: 'test-secret-token',
      DB_NAME: 'atc_test',
      DB_USER: 'atc_test',
      DB_PASSWORD: 'test_password',
    },
  },
})
