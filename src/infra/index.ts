import {server} from "./server.ts";
import {env} from "../utils/env.ts";

server.listen(env.PORT);
