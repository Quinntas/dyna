import "dotenv/config"

interface Env {
    DATABASE_URL: string
    PORT: number
    NODE_ENV: 'development' | 'production'
}

function getEnv(key: string): string {
    const value = process.env[key]
    if (!value) throw new Error(`Missing env variable: ${key}`)
    return value
}

export const env: Env = {
    DATABASE_URL: getEnv('DATABASE_URL'),
    PORT: parseInt(getEnv('PORT')),
    NODE_ENV: getEnv('NODE_ENV') as 'development' | 'production',
}
