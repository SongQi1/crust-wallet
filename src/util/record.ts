import {logger} from "./logger";

const fs = require('fs');

/**
 * 写入记录
 *
 * @param file 文件路径
 * @param record
 */
export function writeRecord(file: string, record: string): void {
    fs.writeFile(file, record, function (err: any) {
        if (err) {
            logger.warn(`记录写入文件${file}失败，失败原因:${err}`);
        }
    });
}

/**
 * 读取记录包含三种情况
 * 1)文件不存在，返回null
 * 2)文件状态异常，抛出异常
 * 3)返回文件具体内容
 */
export function readRecord(file: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
        fs.readFile(file, function (err: any, data: Buffer) {
            if (err && err.code != 'ENOENT') {
                reject(new Error('文件状态读取失败，原因:${err}'));
            } else if (err) {
                // 文件不存在
                resolve(null);
            } else {
                resolve(data.toString('utf8'));
            }
        });
    });
}