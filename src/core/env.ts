/**
 * 定义环境变量
 */
import {config} from "dotenv";
import {logger} from "../util/logger";
import {toJsonString} from "../util/string_utils";

config();

const env = {
    SUBSTRATE_URL: String(process.env.SUBSTRATE_URL),

    PORT: Number(process.env.PORT),
    HTTP_TIMEOUT: String(process.env.HTTP_TIMEOUT),
    HTTP_PARAMETER_LIMIT: String(process.env.HTTP_PARAMETER_LIMIT),

    LOCUS_RECORD_FILE: String(process.env.LOCUS_RECORD_FILE),
    LOCUS_RECORD_NONE_THEN_READ_HEIGHT_BEFORE: Number(process.env.LOCUS_RECORD_NONE_THEN_READ_HEIGHT_BEFORE),
    LOCUS_HANDLE_HEIGHT_GAP: Number(process.env.LOCUS_HANDLE_HEIGHT_GAP),
    LOCUS_HANDLE_SIZE_EACH: Number(process.env.LOCUS_HANDLE_SIZE_EACH),
    NOTIFY_CRON: String(process.env.NOTIFY_CRON),

    MONGODB_URL: String(process.env.MONGODB_URL),
    MONGODB_POLL_MAX_SIZE: Number(process.env.MONGODB_POLL_MAX_SIZE),
    MONGODB_POLL_MIN_SIZE: Number(process.env.MONGODB_POLL_MIN_SIZE),
    MONGODB_POOL_MAX_WAITING_SIZE: Number(process.env.MONGODB_POOL_MAX_WAITING_SIZE),
    MONGODB_POLL_ACQUIRE_TIMEOUT: Number(process.env.MONGODB_POLL_ACQUIRE_TIMEOUT),
    MONGODB_POLL_IDLE_TIMEOUT: Number(process.env.MONGODB_POLL_IDLE_TIMEOUT),

    CRU_TXN_RECORD_DB: String(process.env.CRU_TXN_RECORD_DB),
    CRU_TXN_RECORD_COLLECTION: String(process.env.CRU_TXN_RECORD_COLLECTION),

    SHOW_INSERT_RECORD: Boolean(process.env.SHOW_INSERT_RECORD)
};

logger.info(`配置加载完成:${toJsonString(env)}`);

export {env};