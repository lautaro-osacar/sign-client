import { Store } from "@walletconnect/core";
import { SIGN_CLIENT_STORAGE_PREFIX, PROPOSAL_CONTEXT } from "../constants";
export class Proposal extends Store {
    constructor(core, logger) {
        super(core, logger, PROPOSAL_CONTEXT, SIGN_CLIENT_STORAGE_PREFIX);
        this.core = core;
        this.logger = logger;
    }
}
//# sourceMappingURL=proposal.js.map