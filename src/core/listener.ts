import {logger} from "../util/logger";
import {env} from "./env";
import {scheduleJob} from 'node-schedule';
import {getScanner} from "./services";
import {readRecord} from "../util/record";
import {isEmpty, toJson, toJsonString} from "../util/string_utils";
import {ApiPromise} from "@polkadot/api";
import {Block} from "@open-web3/scanner/types";

/**
 * 开启监听CRU链交易信息
 */
export const startBlocksSchedule = (): void => {
    logger.info(`启动监听CRU链交易信息定时任务，监听地址:${env.SUBSTRATE_URL}，监听CRON:${env.NOTIFY_CRON}`);

    scheduleJob(String(env.NOTIFY_CRON), async () => {
        const scanner = getScanner();
        if (scanner && !scanner.wsProvider.isConnected) {
            logger.error(`监听CRU链的连接状态异常，请联系管理员`);
            return;
        }
        await scanner.wsProvider.isReady;

        // 读取位点
        let record: string | null;
        try {
            record = await readRecord(String(env.LOCUS_RECORD_FILE));
        } catch (error) {
            // 读取位点异常
            logger.warn('CRU位点记录文件状态异常，读取失败，本轮次不进行任何操作');
            return;
        }

        // 当前CRU最新高度
        const blockAt = await scanner.getBlockAt();

        let startHeight: number;
        // 1）文件不存在，2）文件内容为空
        if (record == null || isEmpty(record)) {
            // 读取最新的位点-指定高度作为消费开始
            startHeight = blockAt.blockNumber - Number(env.LOCUS_RECORD_NONE_THEN_READ_HEIGHT_BEFORE);
        } else {
            const locusRecord = <LocusRecord>toJson(record);
            startHeight = locusRecord.locus;
        }

        // 每次轮询加载几个
        const size = Number(env.LOCUS_HANDLE_SIZE_EACH);
        // 消费截止位置
        const posMax = blockAt.blockNumber - Number(env.LOCUS_HANDLE_HEIGHT_GAP);
        // 该轮次消费结束节点
        let endHeight: number;
        if (startHeight + size <= posMax) {
            endHeight = startHeight + size;
        } else {
            endHeight = posMax;
        }

        // 消费到最新高度
        if (startHeight > endHeight) {
            logger.info(`CRU链跟踪消费已经到最新高度${startHeight}，本伦次不处理`);
            return;
        }

        logger.info(`CRU开始加载${startHeight}~${endHeight}之间的交易消息`);

        const requestArray: any = [];
        for (let i = startHeight; i <= endHeight; ++i) {
            requestArray.push(scanner.getBlockDetail({blockNumber: startHeight}));
        }
        // 获取多个block信息
        const blocks = await Promise.all(requestArray as [Promise<Block>]);
        blocks.forEach((block) => {
            logger.info(toJsonString(block));
        });
    });
}

interface BlockInfo {
    blockNumber: number,
    blockHash: string,
    blockTimestamp: number
}

/**
 * 位点记录结构
 */
interface LocusRecord {
    locus: number
}

/**
 * 最新高度
 *
 * @param api
 */
async function getBlockHeight(api: ApiPromise): Promise<number> {
    const header = await api.rpc.chain.getHeader();
    return header.number.toNumber();
}