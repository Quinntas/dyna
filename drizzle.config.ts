import {defineConfig} from "drizzle-kit";

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/modules/**/infra/*.table.ts',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    verbose: true,
    strict: true,
})