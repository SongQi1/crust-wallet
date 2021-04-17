/**
 * 定义环境变量
 */
import {config} from "dotenv";
import {logger} from "../util/logger";
import {toJsonString} from "../util/string_utils";
import minimist from "minimist";

config();

enum ConfigType {
    STRING,
    NUMBER,
    BOOLEAN
}

export interface Configs {
    [x: string]: any
}

/**
 * 定义配置变量
 */
const configKeys = [
    ['SUBSTRATE_URL'],

    ['PORT', ConfigType.NUMBER],
    ['HTTP_TIMEOUT'],
    ['HTTP_PARAMETER_LIMIT'],

    ['LOCUS_RECORD_FILE'],
    ['LOCUS_RECORD_NONE_THEN_READ_HEIGHT_BEFORE', ConfigType.NUMBER],
    ['LOCUS_HANDLE_HEIGHT_GAP', ConfigType.NUMBER],
    ['LOCUS_HANDLE_SIZE_EACH', ConfigType.NUMBER],
    ['NOTIFY_CRON'],

    ['MONGODB_URL'],
    ['MONGODB_POLL_MAX_SIZE', ConfigType.NUMBER],
    ['MONGODB_POLL_MIN_SIZE', ConfigType.NUMBER],

    ['CRU_TXN_RECORD_DB'],
    ['CRU_TXN_RECORD_COLLECTION']
];

/**
 * 配置参数来源可以是args，
 * 也可以是env，其中arg优先级高于env
 */
const args = minimist(process.argv.slice(2));
const envs = process.env;

let configs: Configs = {};
for (let paramKey of configKeys) {
    const key = paramKey[0];
    const type = paramKey[1] || ConfigType.STRING;
    const value: any = args[key] || envs[key];
    switch (type) {
        case ConfigType.STRING:
            configs[key] = String(value);
            break;
        case ConfigType.NUMBER:
            configs[key] = Number(value);
            break;
        case ConfigType.BOOLEAN:
            configs[key] = Boolean(value);
            break;
        default:
            logger.warn(`未定义应用启动参数类型:${type}，忽略配置:${key}`);
    }
}

logger.info(`配置加载完成:${toJsonString(configs)}`);
export {configs};