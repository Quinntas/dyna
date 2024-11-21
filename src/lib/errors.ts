export class HttpError extends Error {
    private readonly _status: number;
    private readonly _data: Record<string, unknown>

    get data() {
        return this._data;
    }

    get status() {
        return this._status;
    }

    constructor(status: number, message: string, data: Record<string, unknown> = {}) {
        super(message);
        this._status = status;
        this._data = {
            message,
            ...data
        };
    }
}

export const notFound = new HttpError(404, 'not found');
export const internalServerError = new HttpError(500, 'internal server error');
