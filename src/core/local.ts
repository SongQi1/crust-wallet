import {NextFunction, Request, Response} from "express";
import {acquireDBConnection, releaseDBConnection, withSimple} from "./services";
import {env} from "./env";
import {readRecord} from "../util/record";
import {logger} from "../util/logger";
import {isEmpty, toJson} from "../util/string_utils";

export const local = {
    queryTxnByHash: (req: Request, res: Response, next: NextFunction) => {
        withSimple(async () => {
            res.json(await queryTxnByHash(req.body['txnHash']));
        }, next)
    },
    queryTxnList: (req: Request, res: Response, next: NextFunction) => {
        withSimple(async () => {
            res.json(await queryTxnList(req.body['queryParams']));
        }, next)
    },
    queryCurrentLocus: (req: Request, res: Response, next: NextFunction) => {
        withSimple(async () => {
            res.json(await queryCurrentLocus());
        }, next)
    },
}

/**
 * 获取当前同步到本地的位点
 */
async function queryCurrentLocus(): Promise<number> {
    return new Promise((resolve, reject) => {
        readRecord(env.LOCUS_RECORD_FILE).then((record) => {
            if (isEmpty(record)) {
                // 文件不存在
                reject(new Error('同步位点信息不存在，请确认钱包服务正常启动，若正常启动，请稍后再试!'));
                return;
            }
            let recordJson;
            try {
                recordJson = toJson(<string>record);
            } catch (error) {
                // 解析同步位点文件格式错误
                reject(new Error('同步位点信息格式不正确，获取位点失败'));
                return;
            }
            if (!recordJson || !recordJson.locus) {
                reject(new Error('同步位点信息记录为空，请稍后再试'));
                return;
            }
            // 比较保守，记录的位点是等待消费的，因此同步的位点记录为-1
            resolve(recordJson.locus - 1);
        }).catch((error) => {
            reject(error);
        })
    });
}

/**
 * 根据查询参数获取交易列表
 *
 * @param queryParams
 */
async function queryTxnList(queryParams: any): Promise<any> {
    if (!queryParams || (!queryParams.hash && !queryParams.blockNumber)) {
        throw new Error('查询交易列表必须包含交易hash或者区块高度信息');
    }
    return new Promise((resolve, reject) => {
        acquireDBConnection().then(function (client) {
            client.db(env.CRU_TXN_RECORD_DB)
                .collection(env.CRU_TXN_RECORD_COLLECTION)
                .find(queryParams || {})
                .toArray((err, docs) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(docs);
                    }
                    releaseDBConnection(client);
                });
        }, function (err) {
            reject(err);
        });
    });
}

/**
 * 根据交易hash获取交易详情
 *
 * @param txnHash
 */
async function queryTxnByHash(txnHash: string): Promise<any> {
    return new Promise((resolve, reject) => {
        acquireDBConnection().then(function (client) {
            client.db(env.CRU_TXN_RECORD_DB)
                .collection(env.CRU_TXN_RECORD_COLLECTION)
                .findOne({hash: txnHash}, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(new Error('交易未找到，交易hash不存在或者交易暂时未同步到线下，请耐心等待'));
                        }
                    }
                    releaseDBConnection(client);
                });
        }, function (err) {
            reject(err);
        });
    });
}