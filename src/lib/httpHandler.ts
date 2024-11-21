import {GraphQLSchema, parse} from 'graphql';
import {compileQuery, isCompiledQuery} from 'graphql-jit';
import {type CompiledQuery} from 'graphql-jit/dist/execution';
import {IncomingMessage, ServerResponse} from 'http';

export class HttpError extends Error {
    public status: number;
    public data: object | undefined;

    constructor(status: number, message: string, data?: object) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

export const notFound = new HttpError(404, 'not found');
export const internalServerError = new HttpError(500, 'internal server error');

export function jsonResponse<T extends object>(res: ServerResponse, status: number, data: T) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
}

export function handleError(res: ServerResponse, error: Error) {
    switch (true) {
        case error instanceof HttpError:
            return jsonResponse(res, error.status, {
                message: error.message,
                ...error.data,
            });

        default:
            console.error(error.message);
            return handleError(res, internalServerError);
    }
}

// TODO move this to redis
interface Cache {
    [key: string]: CompiledQuery<any, any>;
}

let cache: Cache = {};

async function handleQuery(
    schema: GraphQLSchema,
    payload: string,
    req: IncomingMessage,
    res: ServerResponse,
) {
    if (payload.length === 0) throw new HttpError(400, 'no query provided');

    const inp = JSON.parse(payload);
    const query = inp.query;

    cache[query] = cache[query] || compileQuery(schema, parse(query));

    if (!isCompiledQuery(cache[query])) throw new HttpError(400, "query couldn't be compiled");

    const result = await cache[query].query({}, {req}, inp.variables);

    return jsonResponse(res, 200, result);
}

function checkForValidEndpoint(url: string | undefined, endpoint: string) {
    if (!url) throw notFound;
    if (url != endpoint) throw notFound;
}

export function httpHandler(schema: GraphQLSchema, req: IncomingMessage, res: ServerResponse) {
    try {
        checkForValidEndpoint(req.url, '/graphql');
    } catch (e: any) {
        return handleError(res, e);
    }

    let payload = '';

    req.on('data', (chunk: Buffer) => {
        payload += chunk.toString();
    });

    req.on('end', async () => {
        try {
            return await handleQuery(schema, payload, req, res);
        } catch (e: any) {
            return handleError(res, e);
        }
    });
}
