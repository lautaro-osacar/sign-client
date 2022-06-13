import { HEARTBEAT_EVENTS } from "@walletconnect/heartbeat";
import { generateChildLogger, getLoggerContext } from "@walletconnect/logger";
import { toMiliseconds } from "@walletconnect/time";
import { IExpirer } from "@walletconnect/types";
import { ERROR, formatIdTarget, formatTopicTarget } from "@walletconnect/utils";
import { EventEmitter } from "events";
import { SIGN_CLIENT_STORAGE_PREFIX, EXPIRER_CONTEXT, EXPIRER_EVENTS, EXPIRER_STORAGE_VERSION, } from "../constants";
export class Expirer extends IExpirer {
    constructor(core, logger) {
        super(core, logger);
        this.core = core;
        this.logger = logger;
        this.expirations = new Map();
        this.events = new EventEmitter();
        this.name = EXPIRER_CONTEXT;
        this.version = EXPIRER_STORAGE_VERSION;
        this.cached = [];
        this.initialized = false;
        this.storagePrefix = SIGN_CLIENT_STORAGE_PREFIX;
        this.init = async () => {
            if (!this.initialized) {
                this.logger.trace(`Initialized`);
                await this.restore();
                this.cached.forEach(expiration => this.expirations.set(expiration.target, expiration));
                this.cached = [];
                this.registerEventListeners();
                this.initialized = true;
            }
        };
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
            this.events.emit(EXPIRER_EVENTS.created, {
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
                this.events.emit(EXPIRER_EVENTS.deleted, {
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
        this.logger = generateChildLogger(logger, this.name);
    }
    get context() {
        return getLoggerContext(this.logger);
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
            return formatTopicTarget(key);
        }
        else if (typeof key === "number") {
            return formatIdTarget(key);
        }
        throw new Error(`Unknown expirer target type: ${typeof key}`);
    }
    async setExpirations(expirations) {
        await this.core.storage.setItem(this.storageKey, expirations);
    }
    async getExpirations() {
        const expirations = await this.core.storage.getItem(this.storageKey);
        return expirations;
    }
    async persist() {
        await this.setExpirations(this.values);
        this.events.emit(EXPIRER_EVENTS.sync);
    }
    async restore() {
        try {
            const persisted = await this.getExpirations();
            if (typeof persisted === "undefined")
                return;
            if (!persisted.length)
                return;
            if (this.expirations.size) {
                const error = ERROR.RESTORE_WILL_OVERRIDE.format({
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
    }
    getExpiration(target) {
        const expiration = this.expirations.get(target);
        if (!expiration) {
            const error = ERROR.NO_MATCHING_ID.format({
                context: this.name,
                target,
            });
            throw new Error(error.message);
        }
        return expiration;
    }
    checkExpiry(target, expiration) {
        const { expiry } = expiration;
        const msToTimeout = toMiliseconds(expiry) - Date.now();
        if (msToTimeout <= 0)
            this.expire(target, expiration);
    }
    expire(target, expiration) {
        this.expirations.delete(target);
        this.events.emit(EXPIRER_EVENTS.expired, {
            target,
            expiration,
        });
    }
    checkExpirations() {
        this.expirations.forEach((expiration, target) => this.checkExpiry(target, expiration));
    }
    registerEventListeners() {
        this.core.heartbeat.on(HEARTBEAT_EVENTS.pulse, () => this.checkExpirations());
        this.events.on(EXPIRER_EVENTS.created, (createdEvent) => {
            const eventName = EXPIRER_EVENTS.created;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, data: createdEvent });
            this.persist();
        });
        this.events.on(EXPIRER_EVENTS.expired, (expiredEvent) => {
            const eventName = EXPIRER_EVENTS.expired;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, data: expiredEvent });
            this.persist();
        });
        this.events.on(EXPIRER_EVENTS.deleted, (deletedEvent) => {
            const eventName = EXPIRER_EVENTS.deleted;
            this.logger.info(`Emitting ${eventName}`);
            this.logger.debug({ type: "event", event: eventName, data: deletedEvent });
            this.persist();
        });
    }
    isInitialized() {
        if (!this.initialized) {
            throw new Error(ERROR.NOT_INITIALIZED.stringify(this.name));
        }
    }
}
//# sourceMappingURL=expirer.js.map