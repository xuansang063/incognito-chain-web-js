const g = global || window || self;
async function sleep(sleepTime) {
    return new Promise(resolve => setTimeout(resolve, sleepTime));
}

let getProxy = () => {
    let temp = new Proxy({}, {
        get: (_, key) => {
            return (...args) => {
                return new Promise(async(resolve, reject) => {
                    let run = () => {
                        let cb = (err, ...msg) => (err ? reject(err) : resolve(...msg));
                        g.__gobridge__[key].apply(undefined, [...args, cb]);
                    };
                    while (!g.__gobridge__ || !g.__gobridge__.ready) {
                        await sleep(250);
                    }
                    if (!(key in g.__gobridge__)) {
                        reject(`There is nothing defined with the name "${key.toString()}"`);
                        return;
                    }
                    if (typeof g.__gobridge__[key] !== 'function') {
                        resolve(g.__gobridge__[key]);
                        return;
                    }
                    run();
                });
            };
        }
    });
    return temp;
}

let wasm = getProxy();
export {
    wasm,
};