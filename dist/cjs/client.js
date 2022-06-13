"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignClient = void 0;
const tslib_1 = require("tslib");
const core_1 = require("@walletconnect/core");
const logger_1 = require("@walletconnect/logger");
const types_1 = require("@walletconnect/types");
const utils_1 = require("@walletconnect/utils");
const events_1 = require("events");
const pino_1 = tslib_1.__importDefault(require("pino"));
const constants_1 = require("./constants");
const controllers_1 = require("./controllers");
class SignClient extends types_1.ISignClient {
    constructor(opts) {
        super(opts);
        this.protocol = constants_1.SIGN_CLIENT_PROTOCOL;
        this.version = constants_1.SIGN_CLIENT_VERSION;
        this.name = constants_1.SIGN_CLIENT_DEFAULT.name;
        this.events = new events_1.EventEmitter();
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
        this.connect = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.connect(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.pair = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.pair(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.approve = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.approve(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.reject = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.reject(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.update = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.update(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.extend = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.extend(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.request = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.request(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.respond = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.respond(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.ping = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.ping(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.emit = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.emit(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.disconnect = (params) => tslib_1.__awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.engine.disconnect(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        });
        this.find = params => {
            try {
                return this.engine.find(params);
            }
            catch (error) {
                this.logger.error(error.message);
                throw error;
            }
        };
        this.name = (opts === null || opts === void 0 ? void 0 : opts.name) || constants_1.SIGN_CLIENT_DEFAULT.name;
        this.metadata = (opts === null || opts === void 0 ? void 0 : opts.metadata) || utils_1.getAppMetadata();
        const logger = typeof (opts === null || opts === void 0 ? void 0 : opts.logger) !== "undefined" && typeof (opts === null || opts === void 0 ? void 0 : opts.logger) !== "string"
            ? opts.logger
            : pino_1.default(logger_1.getDefaultLoggerOptions({ level: (opts === null || opts === void 0 ? void 0 : opts.logger) || constants_1.SIGN_CLIENT_DEFAULT.logger }));
        this.core = (opts === null || opts === void 0 ? void 0 : opts.core) || new core_1.Core(opts);
        this.logger = logger_1.generateChildLogger(logger, this.name);
        this.pairing = new controllers_1.Pairing(this.core, this.logger);
        this.session = new controllers_1.Session(this.core, this.logger);
        this.proposal = new controllers_1.Proposal(this.core, this.logger);
        this.history = new controllers_1.JsonRpcHistory(this.core, this.logger);
        this.expirer = new controllers_1.Expirer(this.core, this.logger);
        this.engine = new controllers_1.Engine(this);
    }
    static init(opts) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const client = new SignClient(opts);
            yield client.initialize();
            return client;
        });
    }
    get context() {
        return logger_1.getLoggerContext(this.logger);
    }
    initialize() {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this.logger.trace(`Initialized`);
            try {
                yield this.core.start();
                yield this.pairing.init();
                yield this.session.init();
                yield this.proposal.init();
                yield this.history.init();
                yield this.expirer.init();
                yield this.engine.init();
                this.logger.info(`SignClient Initilization Success`);
            }
            catch (error) {
                this.logger.info(`SignClient Initilization Failure`);
                this.logger.error(error.message);
                throw error;
            }
        });
    }
}
exports.SignClient = SignClient;
//# sourceMappingURL=client.js.map