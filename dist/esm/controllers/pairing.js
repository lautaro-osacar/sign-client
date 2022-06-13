import { Store } from "@walletconnect/core";
import { SIGN_CLIENT_STORAGE_PREFIX, PAIRING_CONTEXT } from "../constants";
export class Pairing extends Store {
    constructor(core, logger) {
        super(core, logger, PAIRING_CONTEXT, SIGN_CLIENT_STORAGE_PREFIX);
        this.core = core;
        this.logger = logger;
    }
}
//# sourceMappingURL=pairing.js.map