import {ApiPromise, WsProvider} from "@polkadot/api";
import {env} from "./env";
import {types, typesBundleForPolkadot} from "@crustio/type-definitions";
import Scanner from "@open-web3/scanner";
import {logger} from "../util/logger";
import {NextFunction} from "express";

let provider: WsProvider = newWsProvider();
let api: ApiPromise = newApiPromise(provider);
let scanner: Scanner = newScanner(provider);

/**
 * 初始化websocket服务
 */
export const init = () => {
    if (provider && provider.disconnect) {
        logger.warn(`重新连接cru节点，连接地址:${env.SUBSTRATE_URL}`);
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
    return new WsProvider(env.SUBSTRATE_URL);
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