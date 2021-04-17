import {ApiPromise, WsProvider} from "@polkadot/api";
import {configs} from "./configs";
import {types, typesBundleForPolkadot} from "@crustio/type-definitions";
import Scanner from "@open-web3/scanner";
import {logger} from "../util/logger";
import {NextFunction} from "express";
import {MongoClient} from "mongodb";
import {Pool} from "generic-pool";
import {createMongodbPool} from "../util/db";

let provider: WsProvider = newWsProvider();

/**
 * CRU链API调用
 */
let api: ApiPromise = newApiPromise(provider);
/**
 * CRU链浏览使用
 */
let scanner: Scanner = newScanner(provider);
/**
 * MONGODB数据库连接池
 */
let dbPool: Pool<MongoClient> = createMongodbPool();

/**
 * 初始化websocket服务
 */
export const init = () => {
    if (provider && provider.disconnect) {
        logger.warn(`重新连接cru节点，连接地址:${configs.SUBSTRATE_URL}`);
        provider.disconnect()
            .then(() => {
            })
            .catch(() => {
            });
    }

    provider = newWsProvider();
    api = newApiPromise(provider);
    scanner = newScanner(provider);

    api.isReady.then(api => {
        logger.info(`当前CRU链信息：${api.runtimeChain}, ${api.runtimeVersion}`);
    });
};

export const getApi = (): ApiPromise => {
    return api;
}

export const getScanner = (): Scanner => {
    return scanner;
}

export const acquireDBConnection = (): PromiseLike<MongoClient> => {
    return dbPool.acquire();
}

export const releaseDBConnection = (client: MongoClient): PromiseLike<any> => {
    return dbPool.release(client);
}

export async function withSimple(fn: Function, next: NextFunction) {
    try {
        await fn();
        next();
    } catch (err) {
        next(err);
    }
}

export async function withApiReady(fn: Function, next: NextFunction) {
    const api = getApi();
    if (!api || !api.isConnected) {
        next(new Error('CRU连接失效，请重新连接一个启动的链.'));
        return;
    }
    try {
        const matureApi = await api.isReady;
        await fn(matureApi);
        next();
    } catch (err) {
        next(err);
    }
}

function newWsProvider() {
    return new WsProvider(configs.SUBSTRATE_URL);
}

function newApiPromise(provider: WsProvider) {
    return new ApiPromise({
        provider: provider,
        types: types,
        typesBundle: typesBundleForPolkadot
    });
}

function newScanner(provider: WsProvider) {
    return new Scanner({wsProvider: provider, types});
}