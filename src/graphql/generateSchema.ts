import {createWriteStream} from 'node:fs';
import {schema} from './schema';
import {printSchema} from 'graphql';

const start = performance.now()
console.log('Generating schema');

const f = createWriteStream('./schema.graphql');
f.write(printSchema(schema));

const end = performance.now()

console.log(`Schema generated in ${(end - start).toFixed(4)} ms`)