import { Guid } from "guid-typescript";

export type IEntityKey = string;
export type IEntity = {id?: IEntityKey};
export const giveIdentity = <T extends IEntity>(e : T): T => e.id ? ({...e, id: asString(e.id)}) : ({...e, id: createEntityKey()});
export const createEntityKey = (): IEntityKey => Guid.create().toString();
export const same = (a: IEntityKey, b: IEntityKey): boolean => asString(a) === asString(b);
const asString = (x: any): string => x.value ? x.value : x;
export const cloneKey = (x: IEntityKey) => asString(x);