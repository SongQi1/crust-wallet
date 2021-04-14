import {ApiPromise} from "@polkadot/api";
import {cryptoWaitReady, mnemonicGenerate} from '@polkadot/util-crypto';
import {Keyring} from '@polkadot/keyring';
import {jsonToBase64} from "../util/string_utils";
import {NextFunction, Request, Response} from "express";
import {withApiReady} from "./services";

/**
 * 服务
 */
export const wallet = {
    generate: (req: Request, res: Response, next: NextFunction) => {
        withApiReady(async (api: ApiPromise) => {
            res.json(await generate(api));
        }, next)
    },
    balance: (req: Request, res: Response, next: NextFunction) => {
        withApiReady(async (api: ApiPromise) => {
            res.json(await balance(api, req.body['address']));
        }, next)
    },
}

interface GenerateResult {
    address: string,
    // 将KeyringPair$Json转换成json字符串后，然后进行base64加密
    privateKey: string
}

/**
 * 创建钱包地址
 *
 * @param api
 */
async function generate(api: ApiPromise) {
    // 等待库加载
    await cryptoWaitReady();
    // 生成助记词
    const mnemonic = mnemonicGenerate();
    // 实例化一个Keying
    const keyring = new Keyring({type: 'sr25519'});
    // 获取密码对
    const pair = keyring.addFromUri(mnemonic);
    // 获取CRU地址
    keyring.setSS58Format(42);
    return <GenerateResult>{
        address: pair.address,
        privateKey: jsonToBase64(pair.toJson()),
    }
}

interface BalanceResult {
    address: string,
    availableBalance: number
}

/**
 * 余额查询
 *
 * @param api
 * @param address
 */
async function balance(api: ApiPromise, address: string) {
    return api.query.system.account(address).then(function (r) {
        return <BalanceResult>{
            address: address,
            availableBalance: r.data.free.toNumber()
        }
    });
}