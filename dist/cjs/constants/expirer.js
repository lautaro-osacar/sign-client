"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXPIRER_DEFAULT_TTL = exports.EXPIRER_STORAGE_VERSION = exports.EXPIRER_EVENTS = exports.EXPIRER_CONTEXT = void 0;
const time_1 = require("@walletconnect/time");
exports.EXPIRER_CONTEXT = "expirer";
exports.EXPIRER_EVENTS = {
    created: "expirer_created",
    deleted: "expirer_deleted",
    expired: "expirer_expired",
    sync: "expirer_sync",
};
exports.EXPIRER_STORAGE_VERSION = "0.3";
exports.EXPIRER_DEFAULT_TTL = time_1.ONE_DAY;
//# sourceMappingURL=expirer.js.map