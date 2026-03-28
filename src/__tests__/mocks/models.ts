/**
 * Replaces src/models/index.ts during tests.
 *
 * The real index.ts calls mongoose.connect(process.env.MONGO) as a side-effect
 * at module load time. In tests we manage the DB connection through db.ts, so
 * we re-export only the real model definitions and omit the connect call.
 */
export * from '@/models/User'
export * from '@/models/Quiz'
