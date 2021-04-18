import {logger} from "../util/logger";
import {configs} from "./configs";
import {scheduleJob} from 'node-schedule';
import {acquireDBConnection, getScanner, releaseDBConnection} from "./services";
import {readRecord, writeRecord} from "../util/record";
import {isEmpty, toJson, toJsonString} from "../util/string_utils";
import Scanner from "@open-web3/scanner";

/**
 * 开启监听CRU链交易信息
 */
export const startSyncBlockSchedule = (): void => {
    logger.info(`启动监听CRU链交易信息定时任务，监听地址:${configs.SUBSTRATE_URL}，监听CRON:${configs.NOTIFY_CRON}`);

    scheduleJob(configs.NOTIFY_CRON, async () => {
        const scanner = getScanner();
        if (scanner && !scanner.wsProvider.isConnected) {
            logger.error(`监听CRU链的连接状态异常，请联系管理员`);
            return;
        }
        await scanner.wsProvider.isReady;

        // 读取位点
        let record: string | null;
        try {
            record = await readRecord(configs.LOCUS_RECORD_FILE);
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
            startHeight = blockAt.blockNumber - configs.LOCUS_RECORD_NONE_THEN_READ_HEIGHT_BEFORE;
        } else {
            const locusRecord = <LocusRecord>toJson(record);
            startHeight = locusRecord.locus;
        }

        // 每次轮询加载几个
        const size = configs.LOCUS_HANDLE_SIZE_EACH;
        // 消费截止位置
        const posMax = blockAt.blockNumber - configs.LOCUS_HANDLE_HEIGHT_GAP;
        // 该轮次消费结束节点
        let endHeight: number;
        if (startHeight + size <= posMax) {
            endHeight = startHeight + size;
        } else {
            endHeight = posMax;
        }

        if (startHeight > endHeight) {
            logger.info(`CRU链跟踪消费已经到最新高度${startHeight}，本伦次不处理`);
            return;
        }

        asyncGetBlockTrades(scanner, startHeight, endHeight).then((records) => {
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
                writeRecord(configs.LOCUS_RECORD_FILE, toJsonString(<LocusRecord>{
                    locus: endHeight + 1
                }));
            }).catch((error) => {
                logger.error(`交易记录保存失败，不更新位点，错误信息：${error}`);
            });
        }).catch((error) => {
            logger.error(`同步区块交易信息失败，错误信息：${error}`);
        });
    });
};

/**
 * 根据指定start、end同步数据
 * 如果start和end相同，则仅同步该索引块数据
 * 若start大于end，则返回[]
 *
 * @param scanner
 * @param startHeight
 * @param endHeight
 */
export async function asyncGetBlockTrades(scanner: Scanner, startHeight: number, endHeight: number): Promise<[]> {
    if (startHeight > endHeight) {
        return [];
    }

    if (startHeight == endHeight) {
        logger.info(`CRU开始加载${startHeight}区块的交易消息`);
    } else {
        logger.info(`CRU开始加载${startHeight}~${endHeight}之间区块的交易消息`);
    }

    return new Promise<any>((resolve, reject) => {
        scanner.wsProvider.isReady.then(function () {
            const requestArray: Array<Promise<any>> = [];
            for (let i = startHeight; i <= endHeight; ++i) {
                requestArray.push(scanner.getBlockDetail({blockNumber: i}).then((block) =>
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
                resolve([].concat(...array));
            }).catch((error) => {
                reject(error);
            });
        }).catch((error) => {
            reject(error);
        });
    });
}

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
export async function asyncSaveRecord(record: any): Promise<any> {
    return new Promise<any>((resolve, reject) => {
        acquireDBConnection().then(function (client) {
            client.db(configs.CRU_TXN_RECORD_DB)
                .collection(configs.CRU_TXN_RECORD_COLLECTION)
                .updateOne({hash: record.hash},
                    {$set: record},
                    {upsert: true},
                    (err, result) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(result);
                        }
                        releaseDBConnection(client);
                    });
        }, function (err) {
            reject(err);
        });
    });
}