import store, { RootState } from './index';

let callbacks: ((s: RootState) => void)[] = [];
export const connect = (callback: (s: RootState) => void) => {
    callbacks.push(callback);
}

store.subscribe( () => {
    let s = store.getState();
    callbacks.forEach(c => c(s));
});