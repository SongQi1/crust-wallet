import {NextFunction, Request, Response} from "express";
import {getScanner, withApiReady} from "./services";
import {ApiPromise} from "@polkadot/api";
import {cryptoWaitReady} from "@polkadot/util-crypto";
import {Keyring} from "@polkadot/keyring";
import {base64ToJson, isEmpty} from "../util/string_utils";
import {SubmittableExtrinsic} from "@polkadot/api/promise/types";
import {AddressOrPair} from "@polkadot/api/submittable/types";
import {logger} from "../util/logger";
import {ExtrinsicStatus} from "@polkadot/types/interfaces/author";
import {asyncGetBlockTrades, asyncSaveRecord} from "./sync_block";

export const trade = {
    transfer: (req: Request, res: Response, next: NextFunction) => {
        withApiReady(async (api: ApiPromise) => {
            res.json(await transfer(api, <TransferRequest>{
                from: req.body['from'],
                to: req.body['to'],
                amount: req.body['amount'],
                privateKey: req.body['privateKey']
            }));
        }, next)
    },
    recovery: (req: Request, res: Response, next: NextFunction) => {
        withApiReady(async (api: ApiPromise) => {
            res.json(await recovery({
                startHeight: req.body['startHeight'],
                endHeight: req.body['endHeight']
            }));
        }, next)
    }
}

interface RecoveryRequest {
    startHeight: number,
    endHeight: number
}

interface RecoveryResult {
    startHeight: number,
    endHeight: number,
    status: string,
    message: string
}

/**
 * 根据高度区间段查询交易并保存
 *
 * @param request
 */
async function recovery(request: RecoveryRequest): Promise<RecoveryResult> {
    return new Promise<any>((resolve, reject) => {
        const startHeight = request.startHeight
            , endHeight = request.endHeight;

        if (startHeight > endHeight) {
            reject(new Error('请求报文异常，startHeight必须小于等于endHeight'));
            return;
        }

        const scanner = getScanner();
        if (scanner && !scanner.wsProvider.isConnected) {
            reject(new Error('CRU链的连接状态异常，请联系管理员'));
            return;
        }

        scanner.wsProvider.isReady.then(() => {
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
                    if (startHeight == endHeight) {
                        resolve(<RecoveryResult>{
                            startHeight: startHeight,
                            endHeight: endHeight,
                            status: 'success',
                            message: `同步区块${startHeight}交易列表并保存到数据库成功，保存交易笔数${array.length}`
                        });
                    } else {
                        resolve(<RecoveryResult>{
                            startHeight: startHeight,
                            endHeight: endHeight,
                            status: 'success',
                            message: `同步${startHeight}~${endHeight}区间区块交易列表并保存到数据库成功，保存交易笔数${array.length}`
                        });
                    }
                }).catch((error) => {
                    reject(error);
                });
            }).catch((error) => {
                reject(new Error(error));
            });
        }).catch((error) => {
            reject(error);
        })
    });
}

interface TransferRequest {
    from: string,
    to: string,
    amount: number,
    privateKey: string
}

interface TransferResult {
    from: string,
    to: string,
    amount: number,
    txnHash: string,
    blockHash: string,
    status?: string,
    message?: string,
    detail?: any
}

/**
 * 转账
 *
 * @param api
 * @param request
 */
async function transfer(api: ApiPromise, request: TransferRequest): Promise<TransferResult> {
    await cryptoWaitReady();
    const keyring = new Keyring({type: 'sr25519'});
    const pair = keyring.addFromJson(base64ToJson(request.privateKey));
    if (pair.address != request.from) {
        throw new Error('发起转账者的密钥与地址不匹配');
    }
    pair.unlock();

    const tx = api.tx.balances.transfer(request.to, request.amount);
    return sendTx(tx, pair)
        .then(function (txnRlt) {
            if (!txnRlt) {
                throw new Error('发起交易异常，CRU链未返回任何信息');
            }
            return <TransferResult>{
                from: request.from,
                to: request.to,
                amount: request.amount,
                txnHash: tx.hash.toHex(),
                blockHash: txnRlt.blockHash,
                status: txnRlt.status,
                message: txnRlt.message,
                detail: txnRlt
            };
        });
}

interface SendTxResult {
    status: string,
    message?: string,
    txnHash: string,
    txnCode: ExtrinsicStatus,
    blockHash?: string,
    type: number
}

/**
 * 发送交易tx到cru链
 *
 * @param {SubmittableExtrinsic} tx
 * @param krp
 */
async function sendTx(
    tx: SubmittableExtrinsic,
    krp: AddressOrPair
): Promise<SendTxResult> {
    return new Promise((resolve, reject) => {
        tx.signAndSend(krp, ({events = [], status}) => {
            const txnHash = tx.hash.toHex();
            logger.info(`交易hash：${txnHash}，交易状态：${status.type},nonce：${tx.nonce}`);

            if (status.isInvalid ||
                status.isDropped ||
                status.isUsurped ||
                status.isRetracted) {
                logger.warn(`交易hash：${txnHash}，交易上链失败`);
                resolve({
                    status: 'failure',
                    message: '交易请求上链失败',
                    txnHash: txnHash,
                    txnCode: status,
                    type: tx.type
                });
            } else {
                if (status.isInBlock) {
                    events.forEach(({event: {method, section}}) => {
                        if (section === 'system' && method === 'ExtrinsicFailed') {
                            logger.warn(`交易hash：${txnHash}，交易失败`);
                            resolve({
                                status: 'failure',
                                message: '交易失败',
                                txnHash: txnHash,
                                txnCode: status,
                                type: tx.type,
                                blockHash: status?.asInBlock?.hash?.toHex()
                            });
                        } else if (method === 'ExtrinsicSuccess') {
                            logger.warn(`交易hash：${txnHash}，交易成功`);
                            resolve({
                                status: 'success',
                                message: '交易成功',
                                txnHash: txnHash,
                                txnCode: status,
                                type: tx.type,
                                blockHash: status?.asInBlock?.hash?.toHex()
                            });
                        }
                    });
                } else {
                    resolve({
                        status: 'unknown',
                        message: '交易上链过程中，请稍后查询或者监听CRU链获取交易结果',
                        txnHash: txnHash,
                        txnCode: status,
                        type: tx.type
                    });
                }
            }
        }).catch(e => {
            reject(e);
        });
    });
}
