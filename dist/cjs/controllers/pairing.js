"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pairing = void 0;
const core_1 = require("@walletconnect/core");
const constants_1 = require("../constants");
class Pairing extends core_1.Store {
    constructor(core, logger) {
        super(core, logger, constants_1.PAIRING_CONTEXT, constants_1.SIGN_CLIENT_STORAGE_PREFIX);
        this.core = core;
        this.logger = logger;
    }
}
exports.Pairing = Pairing;
//# sourceMappingURL=pairing.js.map