import store, { RootState } from './index';
export interface IStoreConnector {
    connect: (state: RootState) => void;
}

store.subscribe( () => {
    let s = store.getState();
    callbacks.forEach(c => c(s));
});

let callbacks: ((s: RootState) => void)[] = [];
export const connect = (callback: (s: RootState) => void) => {
    callbacks.push(callback);
}