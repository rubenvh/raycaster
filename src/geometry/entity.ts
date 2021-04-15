import { Guid } from "guid-typescript";

export type IEntityKey = string;
export type IEntity = {id?: IEntityKey};
export const giveIdentity = <T extends IEntity>(e : T): T => e.id ? e : ({...e, id: createEntityKey()});
export const createEntityKey = (): IEntityKey => Guid.create().toString();
export const cloneKey = (x: IEntityKey) => x?.toString();