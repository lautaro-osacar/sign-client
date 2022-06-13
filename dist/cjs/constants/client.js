"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SIGN_CLIENT_STORAGE_OPTIONS = exports.SIGN_CLIENT_EVENTS = exports.SIGN_CLIENT_DEFAULT = exports.SIGN_CLIENT_STORAGE_PREFIX = exports.SIGN_CLIENT_CONTEXT = exports.SIGN_CLIENT_VERSION = exports.SIGN_CLIENT_PROTOCOL = void 0;
exports.SIGN_CLIENT_PROTOCOL = "wc";
exports.SIGN_CLIENT_VERSION = 2;
exports.SIGN_CLIENT_CONTEXT = "client";
exports.SIGN_CLIENT_STORAGE_PREFIX = `${exports.SIGN_CLIENT_PROTOCOL}@${exports.SIGN_CLIENT_VERSION}:${exports.SIGN_CLIENT_CONTEXT}:`;
exports.SIGN_CLIENT_DEFAULT = {
    name: exports.SIGN_CLIENT_CONTEXT,
    logger: "error",
    controller: false,
    relayUrl: "wss://relay.walletconnect.com",
};
exports.SIGN_CLIENT_EVENTS = {
    session_proposal: "session_proposal",
    session_update: "session_update",
    session_extend: "session_extend",
    session_ping: "session_ping",
    pairing_ping: "pairing_ping",
    session_delete: "session_delete",
    session_expire: "session_expire",
    pairing_delete: "pairing_delete",
    pairing_expire: "pairing_expire",
    session_request: "session_request",
    session_event: "session_event",
    proposal_expire: "proposal_expire",
};
exports.SIGN_CLIENT_STORAGE_OPTIONS = {
    database: ":memory:",
};
//# sourceMappingURL=client.js.map