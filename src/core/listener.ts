import {logger} from "../util/logger";
import {env} from "./env";
import {scheduleJob} from 'node-schedule';
import {getDBConnection, getScanner} from "./services";
import {readRecord, writeRecord} from "../util/record";
import {isEmpty, toJson, toJsonString} from "../util/string_utils";
import {Block} from "@open-web3/scanner/types";

/**
 * 开启监听CRU链交易信息
 */
export const startBlocksSchedule = (): void => {
    logger.info(`启动监听CRU链交易信息定时任务，监听地址:${env.SUBSTRATE_URL}，监听CRON:${env.NOTIFY_CRON}`);

    scheduleJob(env.NOTIFY_CRON, async () => {
        const scanner = getScanner();
        if (scanner && !scanner.wsProvider.isConnected) {
            logger.error(`监听CRU链的连接状态异常，请联系管理员`);
            return;
        }
        await scanner.wsProvider.isReady;

        // 读取位点
        let record: string | null;
        try {
            record = await readRecord(env.LOCUS_RECORD_FILE);
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
            startHeight = blockAt.blockNumber - env.LOCUS_RECORD_NONE_THEN_READ_HEIGHT_BEFORE;
        } else {
            const locusRecord = <LocusRecord>toJson(record);
            startHeight = locusRecord.locus;
        }

        // 每次轮询加载几个
        const size = env.LOCUS_HANDLE_SIZE_EACH;
        // 消费截止位置
        const posMax = blockAt.blockNumber - env.LOCUS_HANDLE_HEIGHT_GAP;
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
            requestArray.push(scanner.getBlockDetail({blockNumber: startHeight}))
                .then((block: Block) => {
                    return new Promise((resolve, reject) => {
                        // 遍历交易列表
                        block.extrinsics?.forEach((extrinsic) => {
                            // 准备好记录
                            const record = Object.assign(extrinsic, {
                                blockNumber: block.number,
                                blockHash: block.hash,
                                blockTimestamp: block.timestamp,
                                author: block.author
                            })
                            // 获取数据库连接
                            const connection = getDBConnection();
                            connection.then(function (client) {
                                // 获取连接成功
                                const conn = client.db(env.CRU_TXN_RECORD_DB).collection(env.CRU_TXN_RECORD_COLLECTION);
                                conn.updateOne({hash: record.hash}, {$set: record}, (err, result) => {
                                    if (err) {
                                        reject(err)
                                    }
                                });
                            }, function () {
                                const error = '获取mongodb数据库连接失败，本次写入会失败，不更新位点，下次继续消费（连接池中已经处理了连接获取失败后的重试，根据生产运行情况调整连接池参数）';
                                logger.warn(error);
                                reject(new Error(error));
                            });
                        });
                        // 所有处理成功才会OK
                        resolve(true);
                    });
                });
        }
        await Promise.all(requestArray as [Promise<void>]).then(() => {
            // 所有执行成功，更新位点
            writeRecord(env.LOCUS_RECORD_FILE, toJsonString(<LocusRecord>{
                locus: endHeight + 1
            }));
        });
    });
}

/**
 * 位点记录结构
 */
interface LocusRecord {
    locus: number
}