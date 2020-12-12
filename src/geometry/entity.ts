import { Guid } from "guid-typescript";

export type IEntity = {id?: Guid};
export const giveIdentity = <T extends IEntity>(e : T): T => e.id ? e : ({...e, id: Guid.create()});