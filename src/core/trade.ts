import {NextFunction, Request, Response} from "express";
import {withApiReady} from "./services";
import {ApiPromise} from "@polkadot/api";
import {cryptoWaitReady} from "@polkadot/util-crypto";
import {Keyring} from "@polkadot/keyring";
import {base64ToJson} from "../util/string_utils";
import {SubmittableExtrinsic} from "@polkadot/api/promise/types";
import {AddressOrPair} from "@polkadot/api/submittable/types";
import {logger} from "../util/logger";
import {ExtrinsicStatus} from "@polkadot/types/interfaces/author";

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
}

export interface TransferRequest {
    from: string,
    to: string,
    amount: number,
    privateKey: string
}

export interface TransferResult {
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
export async function transfer(api: ApiPromise, request: TransferRequest): Promise<TransferResult> {
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

export interface SendTxResult {
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
export async function sendTx(
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
