/**
 * 变成json字符串
 *
 * @param obj
 */
export function toStringJson(obj: any) {
    return !obj ? '' : JSON.stringify(obj);
}

/**
 * 将str变成hext
 *
 * @param str
 */
export function strToHex(str: string): string {
    return '0x' + Buffer.from(str).toString('hex');
}

/**
 * 将str变成base64字符串
 *
 * @param str
 */
export function strToBase64(str: string): string {
    return Buffer.from(str).toString('base64');
}

/**
 * 将json对象转换成base64字符串
 *
 * @param obj
 */
export function jsonToBase64(obj: any): string {
    let str;
    if (typeof obj == 'object') {
        str = JSON.stringify(obj);
    } else {
        str = obj.toString();
    }
    return strToBase64(str);
}

/**
 * base64字符串反解析成字符串
 *
 * @param base64
 */
export function base64ToStr(base64: string): string {
    return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * 将base64字符串反解析成json对象
 *
 * @param base64
 */
export function base64ToJson(base64: string): any {
    const jsonStr = base64ToStr(base64);
    return JSON.parse(jsonStr);
}
