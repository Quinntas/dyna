import {createWriteStream} from 'node:fs';
import {schema} from './schema';
import {printSchema} from 'graphql';

console.log('Generating schema');

const f = createWriteStream('./schema.graphql');
f.write(printSchema(schema));

console.log('Schema generated');
