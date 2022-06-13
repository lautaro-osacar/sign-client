import { Core } from "@walletconnect/core";
import { generateChildLogger, getDefaultLoggerOptions, getLoggerContext, } from "@walletconnect/logger";
import { ISignClient } from "@walletconnect/types";
import { getAppMetadata } from "@walletconnect/utils";
import { EventEmitter } from "events";
import pino from "pino";
import { SIGN_CLIENT_DEFAULT, SIGN_CLIENT_PROTOCOL, SIGN_CLIENT_VERSION } from "./constants";
import { Engine, Expirer, JsonRpcHistory, Pairing, Proposal, Session } from "./controllers";
export class SignClient extends ISignClient {
    constructor(opts) {
        super(opts);
        this.protocol = SIGN_CLIENT_PROTOCOL;
        this.version = SIGN_CLIENT_VERSION;
        this.name = SIGN_CLIENT_DEFAULT.name;
        this.events = new EventEmitter();
        this.on = (name, listener) => {
            return this.events.on(name, listener);
        };
        this.once = (name, listener) => {
            return this.events.once(name, listener);
        };
        this.off = (name, listener) => {
            return this.events.off(name, listener);
        };
        this.removeListener = (name, listener) => {
            return this.events.removeListener(name, listener);
        };
        this.connect = async (params) => {
            try {
                return await this.engine.connect(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.pair = async (params) => {
            try {
                return await this.engine.pair(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.approve = async (params) => {
            try {
                return await this.engine.approve(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.reject = async (params) => {
            try {
                return await this.engine.reject(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.update = async (params) => {
            try {
                return await this.engine.update(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.extend = async (params) => {
            try {
                return await this.engine.extend(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.request = async (params) => {
            try {
                return await this.engine.request(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.respond = async (params) => {
            try {
                return await this.engine.respond(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.ping = async (params) => {
            try {
                return await this.engine.ping(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.emit = async (params) => {
            try {
                return await this.engine.emit(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.disconnect = async (params) => {
            try {
                return await this.engine.disconnect(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.find = params => {
            try {
                return this.engine.find(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.name = (opts === null || opts === void 0 ? void 0 : opts.name) || SIGN_CLIENT_DEFAULT.name;
        this.metadata = (opts === null || opts === void 0 ? void 0 : opts.metadata) || getAppMetadata();
        const logger = typeof (opts === null || opts === void 0 ? void 0 : opts.logger) !== "undefined" && typeof (opts === null || opts === void 0 ? void 0 : opts.logger) !== "string"
            ? opts.logger
            : pino(getDefaultLoggerOptions({ level: (opts === null || opts === void 0 ? void 0 : opts.logger) || SIGN_CLIENT_DEFAULT.logger }));
        this.core = (opts === null || opts === void 0 ? void 0 : opts.core) || new Core(opts);
        this.logger = generateChildLogger(logger, this.name);
        this.pairing = new Pairing(this.core, this.logger);
        this.session = new Session(this.core, this.logger);
        this.proposal = new Proposal(this.core, this.logger);
        this.history = new JsonRpcHistory(this.core, this.logger);
        this.expirer = new Expirer(this.core, this.logger);
        this.engine = new Engine(this);
    }
    static async init(opts) {
        const client = new SignClient(opts);
        await client.initialize();
        return client;
    }
    get context() {
        return getLoggerContext(this.logger);
    }
    async initialize() {
        this.logger.trace(`Initialized`);
        try {
            await this.core.start();
            await this.pairing.init();
            await this.session.init();
            await this.proposal.init();
            await this.history.init();
            await this.expirer.init();
            await this.engine.init();
            this.logger.info(`SignClient Initilization Success`);
        }
        catch (error) {
            this.logger.info(`SignClient Initilization Failure`);
            this.logger.error(error.message);
            throw error;
        }
    }
}
//# sourceMappingURL=client.js.map