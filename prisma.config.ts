import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer reads .env itself, and the URL is no longer allowed in the
// schema. Node's own loader does the job — no dotenv dependency. In CI and in
// the container there is no .env file, only real environment variables.
try {
  process.loadEnvFile();
} catch {
  // no .env — the environment already has what it needs
}

// This is for the CLI (migrate, studio). The app connects through the driver
// adapter in src/lib/db.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
