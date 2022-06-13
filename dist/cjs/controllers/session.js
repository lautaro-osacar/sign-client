"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Session = void 0;
const core_1 = require("@walletconnect/core");
const constants_1 = require("../constants");
class Session extends core_1.Store {
    constructor(core, logger) {
        super(core, logger, constants_1.SESSION_CONTEXT, constants_1.SIGN_CLIENT_STORAGE_PREFIX);
        this.core = core;
        this.logger = logger;
    }
}
exports.Session = Session;
//# sourceMappingURL=session.js.map