import express, {NextFunction} from 'express';
import {Request, Response} from 'express';
import * as bodyParser from 'body-parser';
import timeout from 'connect-timeout';
import {logger} from "./util/logger";
import {env} from "./core/env";
import * as services from './core/services';
import {wallet} from "./core/wallet";
import {trade} from "./core/trade";
import {startBlocksSchedule} from "./core/listener";

async function startHttpServer() {
    const app = express();

    const errorHandler = (
        err: any,
        _req: Request | null,
        res: Response | null,
        _next: any
    ) => {
        const errMsg: string = '' + err ? err.message : '内部错误';
        logger.error(`全局异常: ${errMsg}.`);
        if (res) {
            res.status(400).send({
                status: 'error',
                message: errMsg,
            });
        }

        // 重新初始化服务
        services.init();
        logger.warn('连接重新初始化！');
    };

    const responseHandler = (_: Request, res: Response, next: NextFunction) => {
        const send = res.send;
        res.send = function (...args: any) {
            if (args.length > 0) {
                logger.info(`响应报文：[${res.statusCode}]: ${args[0]}`);
            }
            send.call(res, ...args);
        } as any;
        next();
    };

    app.use(bodyParser.json({limit: String(env.HTTP_PARAMETER_LIMIT)}));
    app.use(bodyParser.urlencoded({limit: String(env.HTTP_PARAMETER_LIMIT), extended: true}));
    app.use(bodyParser.json());
    app.use(responseHandler);

    // 超时处理
    app.use(timeout(String(env.HTTP_TIMEOUT)));

    // 设置路由
    app.post('/api/v1/wallet/generate', wallet.generate);
    app.post('/api/v1/wallet/balance', wallet.balance);
    app.post('/api/v1/trade/transfer', trade.transfer);

    // 异常处理
    app.use(errorHandler);
    process.on('uncaughtException', (err: Error) => {
        logger.error(`未捕获异常：${err.message}`);
        errorHandler(err, null, null, null);
    });

    app.listen(env.PORT, () => {
        logger.info(`crust-wallet启动监听端口:${env.PORT}，连接crust节点地址：${env.SUBSTRATE_URL}`);
    });
}

startHttpServer().then(() => {
    logger.info('HTTP服务启动完成');
    // 开启轮询获取block信息，然后写入到mongodb数据库中
    startBlocksSchedule();
}).catch((error) => {
    logger.error(`HTTP服务启动失败，错误信息:${error}`);
});
