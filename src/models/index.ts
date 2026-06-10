import * as mongoose from 'mongoose'

// Connect to mongoose
mongoose.connect(process.env.MONGO).catch(err => {
    console.error('MongoDB connection failed', err)
    process.exit(1)
})

// Export models
export * from '@/models/User'
export * from '@/models/Quiz'
