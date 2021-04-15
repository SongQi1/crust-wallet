import {NextFunction, Request, Response} from "express";
import {acquireDBConnection, releaseDBConnection, withSimple} from "./services";
import {env} from "./env";

export const local = {
    queryTxnByHash: (req: Request, res: Response, next: NextFunction) => {
        withSimple(async () => {
            res.json(await queryTxnByHash(req.body['txnHash']));
        }, next)
    },
}

async function queryTxnByHash(txnHash: string): Promise<any> {
    return new Promise((resolve, reject) => {
        acquireDBConnection().then(function (client) {
            client.db(env.CRU_TXN_RECORD_DB)
                .collection(env.CRU_TXN_RECORD_COLLECTION)
                .findOne({hash: txnHash}, (err, result) => {
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