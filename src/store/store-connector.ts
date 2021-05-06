import store, { RootState } from './index';

let callbacks: ((s: RootState) => void)[] = [];
export const connect = (callback: (s: RootState) => void): (()=>void) => {
    callbacks.push(callback);
    return () => callbacks.splice(callbacks.indexOf(callback), 1);
}

store.subscribe( () => {
    let s = store.getState();
    callbacks.forEach(c => c(s));
});