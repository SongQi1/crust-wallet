import {logger} from "../util/logger";
import {env} from "./env";
import {scheduleJob} from 'node-schedule';
import {acquireDBConnection, getScanner, releaseDBConnection} from "./services";
import {readRecord, writeRecord} from "../util/record";
import {isEmpty, toJson, toJsonString} from "../util/string_utils";

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
        logger.info(`CRU链上最新高度为:${blockAt.blockNumber}`);

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

        const requestArray: Array<Promise<any>> = [];
        for (let i = startHeight; i <= endHeight; ++i) {
            requestArray.push(scanner.getBlockDetail({blockNumber: startHeight}).then((block) =>
                block.extrinsics?.map((extrinsic) =>
                    Object.assign(extrinsic, {
                        blockNumber: block.number,
                        blockHash: block.hash,
                        blockTimestamp: block.timestamp,
                        author: block.author
                    })
                )
            ));
        }

        Promise.all(requestArray).then(([...array]) => {
            // 二维降为一维
            const records = [].concat(...array);

            const saveArray: Array<Promise<any>> = [];
            for (let i = 0; i <= records.length; ++i) {
                const record: any = records[i];
                if (!record || isEmpty(record.hash)) {
                    continue;
                }
                saveArray.push(asyncSaveRecord(record));
            }

            Promise.all(saveArray).then(([...array]) => {
                logger.info(`数据库插入成功，更新CRU同步位点：${endHeight + 1}`);
                writeRecord(env.LOCUS_RECORD_FILE, toJsonString(<LocusRecord>{
                    locus: endHeight + 1
                }));
            }).catch((error) => {
                logger.error(`交易记录保存失败，不更新位点，错误信息：${error}`);
            });
        });
    });
};

/**
 * 位点记录结构
 */
interface LocusRecord {
    locus: number
}

/**
 * 异步保存到数据库
 *
 * @param record
 */
async function asyncSaveRecord(record: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        acquireDBConnection().then(function (client) {
            client.db(env.CRU_TXN_RECORD_DB)
                .collection(env.CRU_TXN_RECORD_COLLECTION)
                .updateOne({hash: record.hash},
                    {$set: record},
                    {upsert: true},
                    (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                            releaseDBConnection(client);
                        }
                    });
        }, function (err) {
            reject(err);
        });
    });
}