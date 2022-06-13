"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROPOSAL_EXPIRY = exports.PROPOSAL_CONTEXT = void 0;
const utils_1 = require("@walletconnect/utils");
const time_1 = require("@walletconnect/time");
exports.PROPOSAL_CONTEXT = "proposal";
exports.PROPOSAL_EXPIRY = utils_1.calcExpiry(time_1.THIRTY_DAYS);
//# sourceMappingURL=proposal.js.map