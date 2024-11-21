import {GraphQLSchema, parse} from 'graphql';
import {IncomingMessage, ServerResponse} from 'http';
import {HttpError, internalServerError, notFound} from "./errors.ts";
import {jsonResponse} from "./responses.ts";
import type {Json} from "./types.ts";
import {type CompiledQuery, compileQuery, isCompiledQuery} from "graphql-jit";
 
export function handleError(res: ServerResponse, error: Error) {
    // TODO: move this later
    console.error(error.message);

    switch (true) {
        case error instanceof HttpError:
            return jsonResponse(res, error.status, error.data);

        default:
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

    return jsonResponse(res, 200, result as Json);
}

function checkForValidEndpoint(url: string | undefined, endpoint: string) {
    if (!url) throw notFound;
    if (url != endpoint) throw notFound;
}

export function httpHandler(schema: GraphQLSchema, req: IncomingMessage, res: ServerResponse) {
    try {
        checkForValidEndpoint(req.url, '/graphql');
    } catch (e: unknown) {
        if (e instanceof HttpError)
            return handleError(res, e);
        throw e;
    }

    let payload = '';

    req.on('data', (chunk: Buffer) => {
        try {
            payload += chunk.toString();
        } catch (e: unknown) {
            if (e instanceof HttpError)
                return handleError(res, e);
            throw e;
        }
    });

    req.on('end', async () => {
        try {
            return await handleQuery(schema, payload, req, res);
        } catch (e: unknown) {
            if (e instanceof HttpError)
                return handleError(res, e);
            throw e
        }
    });
}
