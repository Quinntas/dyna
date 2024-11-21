import {createServer} from 'node:http';
import {httpHandler} from '../lib/httpHandler';
import {schema} from '../graphql/schema';
import {server} from "./server.ts";

server.listen(parseInt(process.env.PORT!));
