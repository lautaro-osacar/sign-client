import { Store } from "@walletconnect/core";
import { SIGN_CLIENT_STORAGE_PREFIX, SESSION_CONTEXT } from "../constants";
export class Session extends Store {
    constructor(core, logger) {
        super(core, logger, SESSION_CONTEXT, SIGN_CLIENT_STORAGE_PREFIX);
        this.core = core;
        this.logger = logger;
    }
}
//# sourceMappingURL=session.js.map