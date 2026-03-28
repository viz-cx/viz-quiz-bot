/**
 * Shared MongoDB in-memory server setup.
 * Each test file imports connect/disconnect/clear and calls them
 * in beforeAll / afterAll / afterEach hooks.
 */
import * as mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod: MongoMemoryServer

/**
 * Start an in-memory MongoDB, connect mongoose to it.
 * Call in beforeAll().
 */
export async function connect(): Promise<void> {
    mongod = await MongoMemoryServer.create()
    const uri = mongod.getUri()
    await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
    } as any)
}

/**
 * Drop the database, close the connection and stop the server.
 * Call in afterAll().
 */
export async function disconnect(): Promise<void> {
    await mongoose.connection.dropDatabase()
    await mongoose.connection.close()
    await mongod.stop()
}

/**
 * Delete every document from every collection.
 * Call in afterEach() to keep tests isolated.
 */
export async function clear(): Promise<void> {
    const collections = mongoose.connection.collections
    for (const key in collections) {
        await collections[key].deleteMany({})
    }
}
