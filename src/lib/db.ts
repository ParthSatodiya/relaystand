import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  const client = new PrismaClient();
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
