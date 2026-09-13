import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const prismaClientSingleton = () => {
  // Prisma 7 connects through a driver adapter; the URL no longer comes from
  // the schema. Read it here, at construction, so a test can point DATABASE_URL
  // at a throwaway file before importing this module.
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
  });
  const client = new PrismaClient({ adapter });
  // ponytail: WAL so readers don't block the writer. Fine for one team on one
  // container. Move to Postgres if you ever run multiple replicas.
  client.$executeRawUnsafe('PRAGMA journal_mode=WAL;').catch(() => {});
  return client;
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
