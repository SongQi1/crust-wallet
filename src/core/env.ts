/**
 * 定义环境变量
 */
import {config} from "dotenv";
import {logger} from "../util/logger";
import {toStringJson} from "../util/string_utils";

config();

const env = {
    SUBSTRATE_URL: process.env.SUBSTRATE_URL,
    PORT: process.env.PORT,
    HTTP_TIMEOUT: process.env.HTTP_TIMEOUT,
    HTTP_PARAMETER_LIMIT: process.env.HTTP_PARAMETER_LIMIT
};

logger.info(`配置加载完成:${toStringJson(env)}`);

export {env};