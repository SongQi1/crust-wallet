import {createPool, Factory, Options, Pool} from 'generic-pool';
import {MongoClient} from "mongodb";
import {env} from "../core/env";

/**
 * mongodb数据库连接池工厂
 */
class MongodbFactory implements Factory<MongoClient> {

    create(): PromiseLike<MongoClient> {
        return new Promise<MongoClient>((resolve, reject) => {
            MongoClient.connect(env.MONGODB_URL,
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
    return createPool(new MongodbFactory(), <Options>{
        max: env.MONGODB_POLL_MAX_SIZE,
        min: env.MONGODB_POLL_MIN_SIZE,
        maxWaitingClients: env.MONGODB_POOL_MAX_WAITING_SIZE,
        acquireTimeoutMillis: env.MONGODB_POLL_ACQUIRE_TIMEOUT,
        idleTimeoutMillis: env.MONGODB_POLL_IDLE_TIMEOUT
    })
}
