"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonRpcHistory = void 0;
const tslib_1 = require("tslib");
const jsonrpc_utils_1 = require("@walletconnect/jsonrpc-utils");
const logger_1 = require("@walletconnect/logger");
const types_1 = require("@walletconnect/types");
const utils_1 = require("@walletconnect/utils");
const events_1 = require("events");
const constants_1 = require("../constants");
class JsonRpcHistory extends types_1.IJsonRpcHistory {
    constructor(core, logger) {
        super(core, logger);
        this.core = core;
        this.logger = logger;
        this.records = new Map();
        this.events = new events_1.EventEmitter();
        this.name = constants_1.HISTORY_CONTEXT;
        this.version = constants_1.HISTORY_STORAGE_VERSION;
        this.cached = [];
        this.initialized = false;
        this.storagePrefix = constants_1.SIGN_CLIENT_STORAGE_PREFIX;
        this.init = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.initialized) {
                this.logger.trace(`Initialized`);
                yield this.restore();
                this.cached.forEach(record => this.records.set(record.id, record));
                this.cached = [];
                this.registerEventListeners();
                this.initialized = true;
            }
        });
        this.set = (topic, request, chainId) => {
            this.isInitialized();
            this.logger.debug(`Setting JSON-RPC request history record`);
            this.logger.trace({ type: "method", method: "set", topic, request, chainId });
            if (this.records.has(request.id))
                return;
            const record = {
                id: request.id,
                topic,
                request: { method: request.method, params: request.params || null },
                chainId,
            };
            this.records.set(record.id, record);
            this.events.emit(constants_1.HISTORY_EVENTS.created, record);
        };
        this.resolve = (response) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            this.logger.debug(`Updating JSON-RPC response history record`);
            this.logger.trace({ type: "method", method: "update", response });
            if (!this.records.has(response.id))
                return;
            const record = yield this.getRecord(response.id);
            if (typeof record.response !== "undefined")
                return;
            record.response = jsonrpc_utils_1.isJsonRpcError(response)
                ? { error: response.error }
                : { result: response.result };
            this.records.set(record.id, record);
            this.events.emit(constants_1.HISTORY_EVENTS.updated, record);
        });
        this.get = (topic, id) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            this.logger.debug(`Getting record`);
            this.logger.trace({ type: "method", method: "get", topic, id });
            const record = yield this.getRecord(id);
            if (record.topic !== topic) {
                const error = utils_1.ERROR.MISMATCHED_TOPIC.format({
                    context: this.name,
                    id,
                });
                throw new Error(error.message);
            }
            return record;
        });
        this.delete = (topic, id) => {
            this.isInitialized();
            this.logger.debug(`Deleting record`);
            this.logger.trace({ type: "method", method: "delete", id });
            this.values.forEach((record) => {
                if (record.topic === topic) {
                    if (typeof id !== "undefined" && record.id !== id)
                        return;
                    this.records.delete(record.id);
                    this.events.emit(constants_1.HISTORY_EVENTS.deleted, record);
                }
            });
        };
        this.exists = (topic, id) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.isInitialized();
            if (!this.records.has(id))
                return false;
            const record = yield this.getRecord(id);
            return record.topic === topic;
        });
        this.on = (event, listener) => {
            this.events.on(event, listener);
        };
        this.once = (event, listener) => {
            this.events.once(event, listener);
        };
        this.off = (event, listener) => {
            this.events.off(event, listener);
        };
        this.removeListener = (event, listener) => {
            this.events.removeListener(event, listener);
        };
        this.logger = logger_1.generateChildLogger(logger, this.name);
    }
    get context() {
        return logger_1.getLoggerContext(this.logger);
    }
    get storageKey() {
        return this.storagePrefix + this.version + "//" + this.name;
    }
    get size() {
        return this.records.size;
    }
    get keys() {
        return Array.from(this.records.keys());
    }
    get values() {
        return Array.from(this.records.values());
    }
    get pending() {
        const requests = [];
        this.values.forEach(record => {
            if (typeof record.response !== "undefined")
                return;
            const requestEvent = {
                topic: record.topic,
                request: jsonrpc_utils_1.formatJsonRpcRequest(record.request.method, record.request.params, record.id),
                chainId: record.chainId,
            };
            return requests.push(requestEvent);
        });
        return requests;
    }
    setJsonRpcRecords(records) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.core.storage.setItem(this.storageKey, records);
        });
    }
    getJsonRpcRecords() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const records = yield this.core.storage.getItem(this.storageKey);
            return records;
        });
    }
    getRecord(id) {
        this.isInitialized();
        const record = this.records.get(id);
        if (!record) {
            const error = utils_1.ERROR.NO_MATCHING_ID.format({
                context: this.name,
                id,
            });
            throw new Error(error.message);
        }
        return record;
    }
    persist() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.setJsonRpcRecords(this.values);
            this.events.emit(constants_1.HISTORY_EVENTS.sync);
        });
    }
    restore() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const persisted = yield this.getJsonRpcRecords();
                if (typeof persisted === "undefined")
                    return;
                if (!persisted.length)
                    return;
                if (this.records.size) {
                    const error = utils_1.ERROR.RESTORE_WILL_OVERRIDE.format({
                        context: this.name,
                    });
                    this.logger.error(error.message);
                    throw new Error(error.message);
                }
                this.cached = persisted;
                this.logger.debug(`Successfully Restored records for ${this.name}`);
                this.logger.trace({ type: "method", method: "restore", records: this.values });
            }
            catch (e) {
                this.logger.debug(`Failed to Restore records for ${this.name}`);
                this.logger.error(e);
            }
        });
    }
    registerEventListeners() {
        this.events.on(constants_1.HISTORY_EVENTS.created, (record) => {
            const eventName = constants_1.HISTORY_EVENTS.created;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, record });
            this.persist();
        });
        this.events.on(constants_1.HISTORY_EVENTS.updated, (record) => {
            const eventName = constants_1.HISTORY_EVENTS.updated;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, record });
            this.persist();
        });
        this.events.on(constants_1.HISTORY_EVENTS.deleted, (record) => {
            const eventName = constants_1.HISTORY_EVENTS.deleted;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, record });
            this.persist();
        });
    }
    isInitialized() {
        if (!this.initialized) {
            throw new Error(utils_1.ERROR.NOT_INITIALIZED.stringify(this.name));
        }
    }
}
exports.JsonRpcHistory = JsonRpcHistory;
//# sourceMappingURL=history.js.map