import {createPool, Factory, Options, Pool} from 'generic-pool';
import {MongoClient} from "mongodb";
import {configs} from "../core/configs";
import {logger} from "./logger";

/**
 * mongodb数据库连接池工厂
 */
class MongodbFactory implements Factory<MongoClient> {

    create(): PromiseLike<MongoClient> {
        return new Promise<MongoClient>((resolve, reject) => {
            MongoClient.connect(configs.MONGODB_URL,
                {useUnifiedTopology: true},
                (err, client) => {
                    if (err) {
                        reject(err)
                    } else {
                        resolve(client)
                    }
                })
        });
    }

    destroy(client: MongoClient): PromiseLike<void> {
        return client.close();
    }
}

/**
 * 创建数据库连接池
 */
export function createMongodbPool(): Pool<MongoClient> {
    const pool = createPool(new MongodbFactory(), <Options>{
        max: configs.MONGODB_POLL_MAX_SIZE,
        min: configs.MONGODB_POLL_MIN_SIZE
    })
    logger.info('初始化MongoDB数据库连接池');
    pool.start();
    return pool;
}
