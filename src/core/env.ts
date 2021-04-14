/**
 * 定义环境变量
 */
import {config} from "dotenv";
import {logger} from "../util/logger";
import {toJsonString} from "../util/string_utils";

config();

const env = {
    SUBSTRATE_URL: process.env.SUBSTRATE_URL,

    PORT: process.env.PORT,
    HTTP_TIMEOUT: process.env.HTTP_TIMEOUT,
    HTTP_PARAMETER_LIMIT: process.env.HTTP_PARAMETER_LIMIT,

    LOCUS_RECORD_FILE: process.env.LOCUS_RECORD_FILE,
    LOCUS_RECORD_NONE_THEN_READ_HEIGHT_BEFORE: process.env.LOCUS_RECORD_NONE_THEN_READ_HEIGHT_BEFORE,
    LOCUS_HANDLE_HEIGHT_GAP: process.env.LOCUS_HANDLE_HEIGHT_GAP,
    LOCUS_HANDLE_SIZE_EACH: process.env.LOCUS_HANDLE_SIZE_EACH,
    NOTIFY_CRON: process.env.NOTIFY_CRON
};

logger.info(`配置加载完成:${toJsonString(env)}`);

export {env};