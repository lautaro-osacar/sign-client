"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Expirer = void 0;
const tslib_1 = require("tslib");
const heartbeat_1 = require("@walletconnect/heartbeat");
const logger_1 = require("@walletconnect/logger");
const time_1 = require("@walletconnect/time");
const types_1 = require("@walletconnect/types");
const utils_1 = require("@walletconnect/utils");
const events_1 = require("events");
const constants_1 = require("../constants");
class Expirer extends types_1.IExpirer {
    constructor(core, logger) {
        super(core, logger);
        this.core = core;
        this.logger = logger;
        this.expirations = new Map();
        this.events = new events_1.EventEmitter();
        this.name = constants_1.EXPIRER_CONTEXT;
        this.version = constants_1.EXPIRER_STORAGE_VERSION;
        this.cached = [];
        this.initialized = false;
        this.storagePrefix = constants_1.SIGN_CLIENT_STORAGE_PREFIX;
        this.init = () => tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.initialized) {
                this.logger.trace(`Initialized`);
                yield this.restore();
                this.cached.forEach(expiration => this.expirations.set(expiration.target, expiration));
                this.cached = [];
                this.registerEventListeners();
                this.initialized = true;
            }
        });
        this.has = key => {
            try {
                const target = this.formatTarget(key);
                const expiration = this.getExpiration(target);
                return typeof expiration !== "undefined";
            }
            catch (e) {
                return false;
            }
        };
        this.set = (key, expiry) => {
            this.isInitialized();
            const target = this.formatTarget(key);
            const expiration = { target, expiry };
            this.expirations.set(target, expiration);
            this.checkExpiry(target, expiration);
            this.events.emit(constants_1.EXPIRER_EVENTS.created, {
                target,
                expiration,
            });
        };
        this.get = key => {
            this.isInitialized();
            const target = this.formatTarget(key);
            return this.getExpiration(target);
        };
        this.del = key => {
            this.isInitialized();
            const target = this.formatTarget(key);
            const exists = this.has(target);
            if (exists) {
                const expiration = this.getExpiration(target);
                this.expirations.delete(target);
                this.events.emit(constants_1.EXPIRER_EVENTS.deleted, {
                    target,
                    expiration,
                });
            }
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
        this.core;
        this.logger = logger_1.generateChildLogger(logger, this.name);
    }
    get context() {
        return logger_1.getLoggerContext(this.logger);
    }
    get storageKey() {
        return this.storagePrefix + this.version + "//" + this.name;
    }
    get length() {
        return this.expirations.size;
    }
    get keys() {
        return Array.from(this.expirations.keys());
    }
    get values() {
        return Array.from(this.expirations.values());
    }
    formatTarget(key) {
        if (typeof key === "string") {
            return utils_1.formatTopicTarget(key);
        }
        else if (typeof key === "number") {
            return utils_1.formatIdTarget(key);
        }
        throw new Error(`Unknown expirer target type: ${typeof key}`);
    }
    setExpirations(expirations) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.core.storage.setItem(this.storageKey, expirations);
        });
    }
    getExpirations() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const expirations = yield this.core.storage.getItem(this.storageKey);
            return expirations;
        });
    }
    persist() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            yield this.setExpirations(this.values);
            this.events.emit(constants_1.EXPIRER_EVENTS.sync);
        });
    }
    restore() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                const persisted = yield this.getExpirations();
                if (typeof persisted === "undefined")
                    return;
                if (!persisted.length)
                    return;
                if (this.expirations.size) {
                    const error = utils_1.ERROR.RESTORE_WILL_OVERRIDE.format({
                        context: this.name,
                    });
                    this.logger.error(error.message);
                    throw new Error(error.message);
                }
                this.cached = persisted;
                this.logger.debug(`Successfully Restored expirations for ${this.name}`);
                this.logger.trace({ type: "method", method: "restore", expirations: this.values });
            }
            catch (e) {
                this.logger.debug(`Failed to Restore expirations for ${this.name}`);
                this.logger.error(e);
            }
        });
    }
    getExpiration(target) {
        const expiration = this.expirations.get(target);
        if (!expiration) {
            const error = utils_1.ERROR.NO_MATCHING_ID.format({
                context: this.name,
                target,
            });
            throw new Error(error.message);
        }
        return expiration;
    }
    checkExpiry(target, expiration) {
        const { expiry } = expiration;
        const msToTimeout = time_1.toMiliseconds(expiry) - Date.now();
        if (msToTimeout <= 0)
            this.expire(target, expiration);
    }
    expire(target, expiration) {
        this.expirations.delete(target);
        this.events.emit(constants_1.EXPIRER_EVENTS.expired, {
            target,
            expiration,
        });
    }
    checkExpirations() {
        this.expirations.forEach((expiration, target) => this.checkExpiry(target, expiration));
    }
    registerEventListeners() {
        this.core.heartbeat.on(heartbeat_1.HEARTBEAT_EVENTS.pulse, () => this.checkExpirations());
        this.events.on(constants_1.EXPIRER_EVENTS.created, (createdEvent) => {
            const eventName = constants_1.EXPIRER_EVENTS.created;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, data: createdEvent });
            this.persist();
        });
        this.events.on(constants_1.EXPIRER_EVENTS.expired, (expiredEvent) => {
            const eventName = constants_1.EXPIRER_EVENTS.expired;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, data: expiredEvent });
            this.persist();
        });
        this.events.on(constants_1.EXPIRER_EVENTS.deleted, (deletedEvent) => {
            const eventName = constants_1.EXPIRER_EVENTS.deleted;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
            this.persist();
        });
    }
    isInitialized() {
        if (!this.initialized) {
            throw new Error(utils_1.ERROR.NOT_INITIALIZED.stringify(this.name));
        }
    }
}
exports.Expirer = Expirer;
//# sourceMappingURL=expirer.js.map