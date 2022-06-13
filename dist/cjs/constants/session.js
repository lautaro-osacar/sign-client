"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_EXPIRY = exports.SESSION_DEFAULT_TTL = exports.SESSION_CONTEXT = void 0;
const time_1 = require("@walletconnect/time");
const utils_1 = require("@walletconnect/utils");
exports.SESSION_CONTEXT = "session";
exports.SESSION_DEFAULT_TTL = time_1.SEVEN_DAYS;
exports.SESSION_EXPIRY = utils_1.calcExpiry(exports.SESSION_DEFAULT_TTL);
//# sourceMappingURL=session.js.map