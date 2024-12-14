import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    API_URL: z.string().url(),
    DISCORD_TOKEN: z.string().min(1),
    DISCORD_CLIENT_ID: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    RAPIDAPI_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
});
