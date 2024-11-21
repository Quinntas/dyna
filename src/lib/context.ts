import {IncomingMessage} from 'http';

export interface Context {
    req: IncomingMessage;
}
