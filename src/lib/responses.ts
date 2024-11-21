import {ServerResponse} from "http";
import type {Json} from "./types.ts";

export function jsonResponse<T extends Json>(res: ServerResponse, status: number, data: T) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
}