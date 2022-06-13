import { formatJsonRpcRequest, isJsonRpcError } from "@walletconnect/jsonrpc-utils";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { IJsonRpcHistory } from "@walletconnect/types";
import { ERROR } from "@walletconnect/utils";
import { EventEmitter } from "events";
import { SIGN_CLIENT_STORAGE_PREFIX, HISTORY_CONTEXT, HISTORY_EVENTS, HISTORY_STORAGE_VERSION, } from "../constants";
export class JsonRpcHistory extends IJsonRpcHistory {
    constructor(core, logger) {
        super(core, logger);
        this.core = core;
        this.logger = logger;
        this.records = new Map();
        this.events = new EventEmitter();
        this.name = HISTORY_CONTEXT;
        this.version = HISTORY_STORAGE_VERSION;
        this.cached = [];
        this.initialized = false;
        this.storagePrefix = SIGN_CLIENT_STORAGE_PREFIX;
        this.init = async () => {
            if (!this.initialized) {
                this.logger.trace(`Initialized`);
                await this.restore();
                this.cached.forEach(record => this.records.set(record.id, record));
                this.cached = [];
                this.registerEventListeners();
                this.initialized = true;
            }
        };
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
            this.events.emit(HISTORY_EVENTS.created, record);
        };
        this.resolve = async (response) => {
            this.isInitialized();
            this.logger.debug(`Updating JSON-RPC response history record`);
            this.logger.trace({ type: "method", method: "update", response });
            if (!this.records.has(response.id))
                return;
            const record = await this.getRecord(response.id);
            if (typeof record.response !== "undefined")
                return;
            record.response = isJsonRpcError(response)
                ? { error: response.error }
                : { result: response.result };
            this.records.set(record.id, record);
            this.events.emit(HISTORY_EVENTS.updated, record);
        };
        this.get = async (topic, id) => {
            this.isInitialized();
            this.logger.debug(`Getting record`);
            this.logger.trace({ type: "method", method: "get", topic, id });
            const record = await this.getRecord(id);
            if (record.topic !== topic) {
                const error = ERROR.MISMATCHED_TOPIC.format({
                    context: this.name,
                    id,
                });
                throw new Error(error.message);
            }
            return record;
        };
        this.delete = (topic, id) => {
            this.isInitialized();
            this.logger.debug(`Deleting record`);
            this.logger.trace({ type: "method", method: "delete", id });
            this.values.forEach((record) => {
                if (record.topic === topic) {
                    if (typeof id !== "undefined" && record.id !== id)
                        return;
                    this.records.delete(record.id);
                    this.events.emit(HISTORY_EVENTS.deleted, record);
                }
            });
        };
        this.exists = async (topic, id) => {
            this.isInitialized();
            if (!this.records.has(id))
                return false;
            const record = await this.getRecord(id);
            return record.topic === topic;
        };
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
        this.logger = generateChildLogger(logger, this.name);
    }
    get context() {
        return getLoggerContext(this.logger);
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
                request: formatJsonRpcRequest(record.request.method, record.request.params, record.id),
                chainId: record.chainId,
            };
            return requests.push(requestEvent);
        });
        return requests;
    }
    async setJsonRpcRecords(records) {
        await this.core.storage.setItem(this.storageKey, records);
    }
    async getJsonRpcRecords() {
        const records = await this.core.storage.getItem(this.storageKey);
        return records;
    }
    getRecord(id) {
        this.isInitialized();
        const record = this.records.get(id);
        if (!record) {
            const error = ERROR.NO_MATCHING_ID.format({
                context: this.name,
                id,
            });
            throw new Error(error.message);
        }
        return record;
    }
    async persist() {
        await this.setJsonRpcRecords(this.values);
        this.events.emit(HISTORY_EVENTS.sync);
    }
    async restore() {
        try {
            const persisted = await this.getJsonRpcRecords();
            if (typeof persisted === "undefined")
                return;
            if (!persisted.length)
                return;
            if (this.records.size) {
                const error = ERROR.RESTORE_WILL_OVERRIDE.format({
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
    }
    registerEventListeners() {
        this.events.on(HISTORY_EVENTS.created, (record) => {
            const eventName = HISTORY_EVENTS.created;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, record });
            this.persist();
        });
        this.events.on(HISTORY_EVENTS.updated, (record) => {
            const eventName = HISTORY_EVENTS.updated;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, record });
            this.persist();
        });
        this.events.on(HISTORY_EVENTS.deleted, (record) => {
            const eventName = HISTORY_EVENTS.deleted;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, record });
            this.persist();
        });
    }
    isInitialized() {
        if (!this.initialized) {
            throw new Error(ERROR.NOT_INITIALIZED.stringify(this.name));
        }
    }
}
//# sourceMappingURL=history.js.map