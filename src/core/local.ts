import {NextFunction, Request, Response} from "express";
import {acquireDBConnection, releaseDBConnection, withSimple} from "./services";
import {env} from "./env";

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
}

/**
 * 根据查询参数获取交易列表
 *
 * @param queryParams
 */
async function queryTxnList(queryParams: any): Promise<any> {
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