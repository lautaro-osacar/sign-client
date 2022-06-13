"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Engine = void 0;
const tslib_1 = require("tslib");
const events_1 = tslib_1.__importDefault(require("events"));
const core_1 = require("@walletconnect/core");
const constants_1 = require("../constants");
const jsonrpc_utils_1 = require("@walletconnect/jsonrpc-utils");
const time_1 = require("@walletconnect/time");
const types_1 = require("@walletconnect/types");
const utils_1 = require("@walletconnect/utils");
class Engine extends types_1.IEngine {
    constructor(client) {
        super(client);
        this.events = new events_1.default();
        this.initialized = false;
        this.name = constants_1.ENGINE_CONTEXT;
        this.init = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.initialized) {
                yield this.cleanup();
                this.registerRelayerEvents();
                this.registerExpirerEvents();
                this.initialized = true;
            }
        });
        this.connect = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            yield this.isValidConnect(params);
            const { pairingTopic, requiredNamespaces, relays } = params;
            let topic = pairingTopic;
            let uri = undefined;
            let active = false;
            if (topic) {
                const pairing = this.client.pairing.get(topic);
                active = pairing.active;
            }
            if (!topic || !active) {
                const { topic: newTopic, uri: newUri } = yield this.createPairing();
                topic = newTopic;
                uri = newUri;
            }
            const publicKey = yield this.client.core.crypto.generateKeyPair();
            const proposal = {
                requiredNamespaces,
                relays: relays !== null && relays !== void 0 ? relays : [{ protocol: core_1.RELAYER_DEFAULT_PROTOCOL }],
                proposer: {
                    publicKey,
                    metadata: this.client.metadata,
                },
            };
            const { reject, resolve, done: approval } = utils_1.createDelayedPromise();
            this.events.once(utils_1.engineEvent("session_connect"), ({ error, session }) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                if (error)
                    reject(error);
                else if (session) {
                    session.self.publicKey = publicKey;
                    const completeSession = Object.assign(Object.assign({}, session), { requiredNamespaces });
                    yield this.client.session.set(session.topic, completeSession);
                    yield this.setExpiry(session.topic, session.expiry);
                    if (topic)
                        yield this.client.pairing.update(topic, { peerMetadata: session.peer.metadata });
                    resolve(completeSession);
                }
            }));
            if (!topic)
                throw new Error(utils_1.ERROR.MISSING_OR_INVALID.stringify({ name: "topic" }));
            const id = yield this.sendRequest(topic, "wc_sessionPropose", proposal);
            const expiry = utils_1.calcExpiry(time_1.FIVE_MINUTES);
            yield this.setProposal(id, Object.assign({ id, expiry }, proposal));
            return { uri, approval };
        });
        this.pair = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            this.isValidPair(params);
            const { topic, symKey, relay } = utils_1.parseUri(params.uri);
            const expiry = utils_1.calcExpiry(time_1.FIVE_MINUTES);
            const pairing = { topic, relay, expiry, active: false };
            yield this.client.pairing.set(topic, pairing);
            yield this.client.core.crypto.setSymKey(symKey, topic);
            yield this.client.core.relayer.subscribe(topic, { relay });
            yield this.setExpiry(topic, expiry);
            return pairing;
        });
        this.approve = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            this.isValidApprove(params);
            const { id, relayProtocol, namespaces } = params;
            const { pairingTopic, proposer, requiredNamespaces } = this.client.proposal.get(id);
            const selfPublicKey = yield this.client.core.crypto.generateKeyPair();
            const peerPublicKey = proposer.publicKey;
            const sessionTopic = yield this.client.core.crypto.generateSharedKey(selfPublicKey, peerPublicKey);
            const sessionSettle = {
                relay: { protocol: relayProtocol !== null && relayProtocol !== void 0 ? relayProtocol : "waku" },
                namespaces,
                requiredNamespaces,
                controller: { publicKey: selfPublicKey, metadata: this.client.metadata },
                expiry: constants_1.SESSION_EXPIRY,
            };
            yield this.client.core.relayer.subscribe(sessionTopic);
            const requestId = yield this.sendRequest(sessionTopic, "wc_sessionSettle", sessionSettle);
            const { done: acknowledged, resolve, reject } = utils_1.createDelayedPromise();
            this.events.once(utils_1.engineEvent("session_approve", requestId), ({ error }) => {
                if (error)
                    reject(error);
                else
                    resolve(this.client.session.get(sessionTopic));
            });
            const session = Object.assign(Object.assign({}, sessionSettle), { topic: sessionTopic, acknowledged: false, self: sessionSettle.controller, peer: {
                    publicKey: proposer.publicKey,
                    metadata: proposer.metadata,
                }, controller: selfPublicKey });
            yield this.client.session.set(sessionTopic, session);
            yield this.setExpiry(sessionTopic, constants_1.SESSION_EXPIRY);
            if (pairingTopic)
                yield this.client.pairing.update(pairingTopic, { peerMetadata: session.peer.metadata });
            if (pairingTopic && id) {
                yield this.sendResult(id, pairingTopic, {
                    relay: {
                        protocol: relayProtocol !== null && relayProtocol !== void 0 ? relayProtocol : "waku",
                    },
                    responderPublicKey: selfPublicKey,
                });
                yield this.client.proposal.delete(id, utils_1.ERROR.DELETED.format());
                yield this.activatePairing(pairingTopic);
            }
            return { topic: sessionTopic, acknowledged };
        });
        this.reject = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            this.isValidReject(params);
            const { id, reason } = params;
            const { pairingTopic } = this.client.proposal.get(id);
            if (pairingTopic) {
                yield this.sendError(id, pairingTopic, reason);
                yield this.client.proposal.delete(id, utils_1.ERROR.DELETED.format());
            }
        });
        this.update = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            yield this.isValidUpdate(params);
            const { topic, namespaces } = params;
            const id = yield this.sendRequest(topic, "wc_sessionUpdate", { namespaces });
            const { done: acknowledged, resolve, reject } = utils_1.createDelayedPromise();
            this.events.once(utils_1.engineEvent("session_update", id), ({ error }) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
            yield this.client.session.update(topic, { namespaces });
            return { acknowledged };
        });
        this.extend = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            yield this.isValidExtend(params);
            const { topic } = params;
            const id = yield this.sendRequest(topic, "wc_sessionExtend", {});
            const { done: acknowledged, resolve, reject } = utils_1.createDelayedPromise();
            this.events.once(utils_1.engineEvent("session_extend", id), ({ error }) => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
            yield this.setExpiry(topic, constants_1.SESSION_EXPIRY);
            return { acknowledged };
        });
        this.request = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            yield this.isValidRequest(params);
            const { chainId, request, topic } = params;
            const id = yield this.sendRequest(topic, "wc_sessionRequest", { request, chainId });
            const { done, resolve, reject } = utils_1.createDelayedPromise();
            this.events.once(utils_1.engineEvent("session_request", id), ({ error, result }) => {
                if (error)
                    reject(error);
                else
                    resolve(result);
            });
            return yield done();
        });
        this.respond = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            yield this.isValidRespond(params);
            const { topic, response } = params;
            const { id } = response;
            if (jsonrpc_utils_1.isJsonRpcResult(response)) {
                yield this.sendResult(id, topic, response.result);
            }
            else if (jsonrpc_utils_1.isJsonRpcError(response)) {
                yield this.sendError(id, topic, response.error);
            }
        });
        this.ping = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            yield this.isValidPing(params);
            const { topic } = params;
            if (this.client.session.keys.includes(topic)) {
                const id = yield this.sendRequest(topic, "wc_sessionPing", {});
                const { done, resolve, reject } = utils_1.createDelayedPromise();
                this.events.once(utils_1.engineEvent("session_ping", id), ({ error }) => {
                    if (error)
                        reject(error);
                    else
                        resolve();
                });
                yield done();
            }
            else if (this.client.pairing.keys.includes(topic)) {
                const id = yield this.sendRequest(topic, "wc_pairingPing", {});
                const { done, resolve, reject } = utils_1.createDelayedPromise();
                this.events.once(utils_1.engineEvent("pairing_ping", id), ({ error }) => {
                    if (error)
                        reject(error);
                    else
                        resolve();
                });
                yield done();
            }
        });
        this.emit = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            yield this.isValidEmit(params);
            const { topic, event, chainId } = params;
            yield this.sendRequest(topic, "wc_sessionEvent", { event, chainId });
        });
        this.disconnect = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            yield this.isValidDisconnect(params);
            const { topic } = params;
            if (this.client.session.keys.includes(topic)) {
                yield this.sendRequest(topic, "wc_sessionDelete", utils_1.ERROR.DELETED.format());
                yield this.deleteSession(topic);
            }
            else if (this.client.pairing.keys.includes(topic)) {
                yield this.sendRequest(topic, "wc_pairingDelete", utils_1.ERROR.DELETED.format());
                yield this.deletePairing(topic);
            }
        });
        this.find = params => {
            this.isInitialized();
            return this.client.session.getAll().filter(session => utils_1.isSessionCompatible(session, params));
        };
        this.activatePairing = (topic) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.client.pairing.update(topic, { active: true, expiry: constants_1.PROPOSAL_EXPIRY });
            yield this.setExpiry(topic, constants_1.PROPOSAL_EXPIRY);
        });
        this.deleteSession = (topic) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { self } = this.client.session.get(topic);
            yield Promise.all([
                this.client.core.relayer.unsubscribe(topic),
                this.client.session.delete(topic, utils_1.ERROR.DELETED.format()),
                this.client.core.crypto.deleteKeyPair(self.publicKey),
                this.client.core.crypto.deleteSymKey(topic),
                this.client.expirer.del(topic),
            ]);
        });
        this.deletePairing = (topic) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield Promise.all([
                this.client.core.relayer.unsubscribe(topic),
                this.client.pairing.delete(topic, utils_1.ERROR.DELETED.format()),
                this.client.core.crypto.deleteSymKey(topic),
                this.client.expirer.del(topic),
            ]);
        });
        this.deleteProposal = (id) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield Promise.all([
                this.client.proposal.delete(id, utils_1.ERROR.DELETED.format()),
                this.client.expirer.del(id),
            ]);
        });
        this.setExpiry = (topic, expiry) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.client.pairing.keys.includes(topic)) {
                yield this.client.pairing.update(topic, { expiry });
            }
            else if (this.client.session.keys.includes(topic)) {
                yield this.client.session.update(topic, { expiry });
            }
            this.client.expirer.set(topic, expiry);
        });
        this.setProposal = (id, proposal) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.client.proposal.set(id, proposal);
            this.client.expirer.set(id, proposal.expiry);
        });
        this.sendRequest = (topic, method, params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const payload = jsonrpc_utils_1.formatJsonRpcRequest(method, params);
            const message = this.client.core.crypto.encode(topic, payload);
            yield this.client.core.relayer.publish(topic, message);
            this.client.history.set(topic, payload);
            return payload.id;
        });
        this.sendResult = (id, topic, result) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const payload = jsonrpc_utils_1.formatJsonRpcResult(id, result);
            const message = this.client.core.crypto.encode(topic, payload);
            yield this.client.core.relayer.publish(topic, message);
            yield this.client.history.resolve(payload);
        });
        this.sendError = (id, topic, error) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const payload = jsonrpc_utils_1.formatJsonRpcError(id, error);
            const message = this.client.core.crypto.encode(topic, payload);
            yield this.client.core.relayer.publish(topic, message);
            yield this.client.history.resolve(payload);
        });
        this.cleanup = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const sessionTopics = [];
            const pairingTopics = [];
            const proposalIds = [];
            this.client.session.getAll().forEach(session => {
                if (utils_1.isExpired(session.expiry))
                    sessionTopics.push(session.topic);
            });
            this.client.pairing.getAll().forEach(pairing => {
                if (utils_1.isExpired(pairing.expiry))
                    pairingTopics.push(pairing.topic);
            });
            this.client.proposal.getAll().forEach(proposal => {
                if (utils_1.isExpired(proposal.expiry))
                    proposalIds.push(proposal.id);
            });
            yield Promise.all([
                ...sessionTopics.map(this.deleteSession),
                ...pairingTopics.map(this.deletePairing),
                ...proposalIds.map(this.deleteProposal),
            ]);
        });
        this.onRelayEventRequest = event => {
            const { topic, payload } = event;
            const reqMethod = payload.method;
            switch (reqMethod) {
                case "wc_sessionPropose":
                    return this.onSessionProposeRequest(topic, payload);
                case "wc_sessionSettle":
                    return this.onSessionSettleRequest(topic, payload);
                case "wc_sessionUpdate":
                    return this.onSessionUpdateRequest(topic, payload);
                case "wc_sessionExtend":
                    return this.onSessionExtendRequest(topic, payload);
                case "wc_sessionPing":
                    return this.onSessionPingRequest(topic, payload);
                case "wc_pairingPing":
                    return this.onPairingPingRequest(topic, payload);
                case "wc_sessionDelete":
                    return this.onSessionDeleteRequest(topic, payload);
                case "wc_pairingDelete":
                    return this.onPairingDeleteRequest(topic, payload);
                case "wc_sessionRequest":
                    return this.onSessionRequest(topic, payload);
                case "wc_sessionEvent":
                    return this.onSessionEventRequest(topic, payload);
                default:
                    return;
            }
        };
        this.onRelayEventResponse = (event) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { topic, payload } = event;
            const record = yield this.client.history.get(topic, payload.id);
            const resMethod = record.request.method;
            switch (resMethod) {
                case "wc_sessionPropose":
                    return this.onSessionProposeResponse(topic, payload);
                case "wc_sessionSettle":
                    return this.onSessionSettleResponse(topic, payload);
                case "wc_sessionUpdate":
                    return this.onSessionUpdateResponse(topic, payload);
                case "wc_sessionExtend":
                    return this.onSessionExtendResponse(topic, payload);
                case "wc_sessionPing":
                    return this.onSessionPingResponse(topic, payload);
                case "wc_pairingPing":
                    return this.onPairingPingResponse(topic, payload);
                case "wc_sessionRequest":
                    return this.onSessionRequestResponse(topic, payload);
                default:
                    return;
            }
        });
        this.onSessionProposeRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { params, id } = payload;
            try {
                this.isValidConnect(Object.assign({}, payload.params));
                const expiry = utils_1.calcExpiry(time_1.FIVE_MINUTES);
                const proposal = Object.assign({ id, pairingTopic: topic, expiry }, params);
                yield this.setProposal(id, proposal);
                this.client.events.emit("session_proposal", { id, params: proposal });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.onSessionProposeResponse = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id: id } = payload;
            if (jsonrpc_utils_1.isJsonRpcResult(payload)) {
                const { result } = payload;
                this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", result });
                const proposal = this.client.proposal.get(id);
                this.client.logger.trace({ type: "method", method: "onSessionProposeResponse", proposal });
                const selfPublicKey = proposal.proposer.publicKey;
                this.client.logger.trace({
                    type: "method",
                    method: "onSessionProposeResponse",
                    selfPublicKey,
                });
                const peerPublicKey = result.responderPublicKey;
                this.client.logger.trace({
                    type: "method",
                    method: "onSessionProposeResponse",
                    peerPublicKey,
                });
                const sessionTopic = yield this.client.core.crypto.generateSharedKey(selfPublicKey, peerPublicKey);
                this.client.logger.trace({
                    type: "method",
                    method: "onSessionProposeResponse",
                    sessionTopic,
                });
                const subscriptionId = yield this.client.core.relayer.subscribe(sessionTopic);
                this.client.logger.trace({
                    type: "method",
                    method: "onSessionProposeResponse",
                    subscriptionId,
                });
                yield this.activatePairing(topic);
            }
            else if (jsonrpc_utils_1.isJsonRpcError(payload)) {
                yield this.client.proposal.delete(id, utils_1.ERROR.DELETED.format());
                this.events.emit(utils_1.engineEvent("session_connect"), { error: payload.error });
            }
        });
        this.onSessionSettleRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id, params } = payload;
            try {
                this.isValidApprove(Object.assign({ id }, params));
                const { relay, controller, expiry, namespaces } = payload.params;
                const session = {
                    topic,
                    relay,
                    expiry,
                    namespaces,
                    acknowledged: true,
                    controller: controller.publicKey,
                    self: {
                        publicKey: "",
                        metadata: this.client.metadata,
                    },
                    peer: {
                        publicKey: controller.publicKey,
                        metadata: controller.metadata,
                    },
                };
                yield this.sendResult(payload.id, topic, true);
                this.events.emit(utils_1.engineEvent("session_connect"), { session });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.onSessionSettleResponse = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id } = payload;
            if (jsonrpc_utils_1.isJsonRpcResult(payload)) {
                yield this.client.session.update(topic, { acknowledged: true });
                this.events.emit(utils_1.engineEvent("session_approve", id), {});
            }
            else if (jsonrpc_utils_1.isJsonRpcError(payload)) {
                yield this.client.session.delete(topic, utils_1.ERROR.DELETED.format());
                this.events.emit(utils_1.engineEvent("session_approve", id), { error: payload.error });
            }
        });
        this.onSessionUpdateRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { params, id } = payload;
            try {
                this.isValidUpdate(Object.assign({ topic }, params));
                yield this.client.session.update(topic, { namespaces: params.namespaces });
                yield this.sendResult(id, topic, true);
                this.client.events.emit("session_update", { id, topic, params });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.onSessionUpdateResponse = (_topic, payload) => {
            const { id } = payload;
            if (jsonrpc_utils_1.isJsonRpcResult(payload)) {
                this.events.emit(utils_1.engineEvent("session_update", id), {});
            }
            else if (jsonrpc_utils_1.isJsonRpcError(payload)) {
                this.events.emit(utils_1.engineEvent("session_update", id), { error: payload.error });
            }
        };
        this.onSessionExtendRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id } = payload;
            try {
                this.isValidExtend({ topic });
                yield this.setExpiry(topic, constants_1.SESSION_EXPIRY);
                yield this.sendResult(id, topic, true);
                this.client.events.emit("session_extend", { id, topic });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.onSessionExtendResponse = (_topic, payload) => {
            const { id } = payload;
            if (jsonrpc_utils_1.isJsonRpcResult(payload)) {
                this.events.emit(utils_1.engineEvent("session_extend", id), {});
            }
            else if (jsonrpc_utils_1.isJsonRpcError(payload)) {
                this.events.emit(utils_1.engineEvent("session_extend", id), { error: payload.error });
            }
        };
        this.onSessionPingRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id } = payload;
            try {
                this.isValidPing({ topic });
                yield this.sendResult(id, topic, true);
                this.client.events.emit("session_ping", { id, topic });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.onSessionPingResponse = (_topic, payload) => {
            const { id } = payload;
            if (jsonrpc_utils_1.isJsonRpcResult(payload)) {
                this.events.emit(utils_1.engineEvent("session_ping", id), {});
            }
            else if (jsonrpc_utils_1.isJsonRpcError(payload)) {
                this.events.emit(utils_1.engineEvent("session_ping", id), { error: payload.error });
            }
        };
        this.onPairingPingRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id } = payload;
            try {
                this.isValidPing({ topic });
                yield this.sendResult(id, topic, true);
                this.client.events.emit("pairing_ping", { id, topic });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.onPairingPingResponse = (_topic, payload) => {
            const { id } = payload;
            if (jsonrpc_utils_1.isJsonRpcResult(payload)) {
                this.events.emit(utils_1.engineEvent("pairing_ping", id), {});
            }
            else if (jsonrpc_utils_1.isJsonRpcError(payload)) {
                this.events.emit(utils_1.engineEvent("pairing_ping", id), { error: payload.error });
            }
        };
        this.onSessionDeleteRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id } = payload;
            try {
                this.isValidDisconnect({ topic, reason: payload.params });
                yield this.sendResult(id, topic, true);
                yield this.deleteSession(topic);
                this.client.events.emit("session_delete", { id, topic });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.onPairingDeleteRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id } = payload;
            try {
                this.isValidDisconnect({ topic, reason: payload.params });
                yield this.sendResult(id, topic, true);
                yield this.deletePairing(topic);
                this.client.events.emit("pairing_delete", { id, topic });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.onSessionRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id, params } = payload;
            try {
                this.isValidRequest(Object.assign({ topic }, params));
                this.client.events.emit("session_request", { id, topic, params });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.onSessionRequestResponse = (_topic, payload) => {
            const { id } = payload;
            if (jsonrpc_utils_1.isJsonRpcResult(payload)) {
                this.events.emit(utils_1.engineEvent("session_request", id), { result: payload.result });
            }
            else if (jsonrpc_utils_1.isJsonRpcError(payload)) {
                this.events.emit(utils_1.engineEvent("session_request", id), { error: payload.error });
            }
        };
        this.onSessionEventRequest = (topic, payload) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { id, params } = payload;
            try {
                this.isValidEmit(Object.assign({ topic }, params));
                this.client.events.emit("session_event", { id, topic, params });
            }
            catch (err) {
                yield this.sendError(id, topic, err);
                this.client.logger.error(err);
            }
        });
        this.isValidConnect = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "connect params" });
            const { pairingTopic, requiredNamespaces, relays } = params;
            if (!utils_1.isUndefined(pairingTopic))
                yield this.isValidPairingTopic(pairingTopic);
            if (!utils_1.isValidRequiredNamespaces(requiredNamespaces, false))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "connect requiredNamespaces" });
            if (!utils_1.isValidRelays(relays, true))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "connect relays" });
        });
        this.isValidPair = params => {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "pair params" });
            if (!utils_1.isValidUrl(params.uri))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "pair uri" });
        };
        this.isValidApprove = params => {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "approve params" });
            const { id, namespaces, relayProtocol } = params;
            if (!utils_1.isValidId(id))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "approve id" });
            if (!utils_1.isValidNamespaces(namespaces, false))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "approve namespaces" });
            if (!utils_1.isValidString(relayProtocol, true))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "approve relayProtocol" });
        };
        this.isValidReject = params => {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "reject params" });
            const { id, reason } = params;
            if (!utils_1.isValidId(id))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "reject id" });
            if (!utils_1.isValidErrorReason(reason))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "reject reason" });
        };
        this.isValidUpdate = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "update params" });
            const { topic, namespaces } = params;
            yield this.isValidSessionTopic(topic);
            const session = this.client.session.get(topic);
            if (!utils_1.isValidNamespaces(namespaces, false))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "update namespaces" });
            if (!utils_1.isValidNamespacesChange(session.requiredNamespaces, namespaces))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "update namespaces" });
        });
        this.isValidExtend = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "extend params" });
            const { topic } = params;
            yield this.isValidSessionTopic(topic);
        });
        this.isValidRequest = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "request params" });
            const { topic, request, chainId } = params;
            yield this.isValidSessionTopic(topic);
            const { namespaces } = this.client.session.get(topic);
            if (!utils_1.isValidNamespacesChainId(namespaces, chainId))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "request chainId" });
            if (!utils_1.isValidRequest(request))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "request method" });
            if (!utils_1.isValidNamespacesRequest(namespaces, chainId, request.method))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "request method" });
        });
        this.isValidRespond = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "respond params" });
            const { topic, response } = params;
            yield this.isValidSessionTopic(topic);
            if (!utils_1.isValidResponse(response))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "respond response" });
        });
        this.isValidPing = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "ping params" });
            const { topic } = params;
            yield this.isValidSessionOrPairingTopic(topic);
        });
        this.isValidEmit = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "emit params" });
            const { topic, event, chainId } = params;
            yield this.isValidSessionTopic(topic);
            const { namespaces } = this.client.session.get(topic);
            if (!utils_1.isValidNamespacesChainId(namespaces, chainId))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "emit chainId" });
            if (!utils_1.isValidEvent(event))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "emit event" });
            if (!utils_1.isValidNamespacesEvent(namespaces, chainId, event.name))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "emit event" });
        });
        this.isValidDisconnect = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidParams(params))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "disconnect params" });
            const { topic } = params;
            yield this.isValidSessionOrPairingTopic(topic);
        });
    }
    createPairing() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const symKey = utils_1.generateRandomBytes32();
            const topic = yield this.client.core.crypto.setSymKey(symKey);
            const expiry = utils_1.calcExpiry(time_1.FIVE_MINUTES);
            const relay = { protocol: core_1.RELAYER_DEFAULT_PROTOCOL };
            const pairing = { topic, expiry, relay, active: false };
            const uri = utils_1.formatUri({
                protocol: this.client.protocol,
                version: this.client.version,
                topic,
                symKey,
                relay,
            });
            yield this.client.pairing.set(topic, pairing);
            yield this.client.core.relayer.subscribe(topic);
            yield this.setExpiry(topic, expiry);
            return { topic, uri };
        });
    }
    isInitialized() {
        if (!this.initialized)
            throw new Error(utils_1.ERROR.NOT_INITIALIZED.stringify(this.name));
    }
    registerRelayerEvents() {
        this.client.core.relayer.on(core_1.RELAYER_EVENTS.message, (event) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { topic, message } = event;
            const payload = this.client.core.crypto.decode(topic, message);
            if (jsonrpc_utils_1.isJsonRpcRequest(payload)) {
                this.client.history.set(topic, payload);
                this.onRelayEventRequest({ topic, payload });
            }
            else if (jsonrpc_utils_1.isJsonRpcResponse(payload)) {
                yield this.client.history.resolve(payload);
                this.onRelayEventResponse({ topic, payload });
            }
        }));
    }
    registerExpirerEvents() {
        this.client.expirer.on(constants_1.EXPIRER_EVENTS.expired, (event) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            const { topic, id } = utils_1.parseExpirerTarget(event.target);
            if (topic) {
                if (this.client.session.keys.includes(topic)) {
                    yield this.deleteSession(topic);
                    this.client.events.emit("session_expire", { topic });
                }
                else if (this.client.pairing.keys.includes(topic)) {
                    yield this.deletePairing(topic);
                    this.client.events.emit("pairing_expire", { topic });
                }
            }
            else if (id) {
                yield this.deleteProposal(id);
            }
        }));
    }
    isValidPairingTopic(topic) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidString(topic, false))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: `pairing topic` });
            if (!this.client.pairing.keys.includes(topic))
                throw utils_1.ERROR.NO_MATCHING_TOPIC.format({ context: "pairing", topic });
            if (utils_1.isExpired(this.client.pairing.get(topic).expiry)) {
                yield this.deletePairing(topic);
                throw utils_1.ERROR.EXPIRED.format({ context: "pairing", topic });
            }
        });
    }
    isValidSessionTopic(topic) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!utils_1.isValidString(topic, false))
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: `session topic` });
            if (!this.client.session.keys.includes(topic))
                throw utils_1.ERROR.NO_MATCHING_TOPIC.format({ context: "session", topic });
            if (utils_1.isExpired(this.client.session.get(topic).expiry)) {
                yield this.deleteSession(topic);
                throw utils_1.ERROR.EXPIRED.format({ context: "session", topic });
            }
        });
    }
    isValidSessionOrPairingTopic(topic) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (this.client.session.keys.includes(topic))
                yield this.isValidSessionTopic(topic);
            else if (this.client.pairing.keys.includes(topic))
                yield this.isValidPairingTopic(topic);
            else
                throw utils_1.ERROR.MISSING_OR_INVALID.format({ name: "topic" });
        });
    }
}
exports.Engine = Engine;
//# sourceMappingURL=engine.js.map