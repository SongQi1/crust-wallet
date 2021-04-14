export function toStringJson(obj: any) {
    return !obj ? '' : JSON.stringify(obj);
}