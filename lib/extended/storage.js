import { Interface } from './interface';

let IMapStorage = new Interface('IMapStorage', ['setItem', 'getItem']);
let IListStorage = new Interface('IListStorage', ['add', 'list', 'remove']);

class DefaultMapStorage {
    constructor() {
        this.Data = {}
        Interface.ensureImplements(this, IMapStorage);
    }

    async setItem(key, value) {
        this.Data[key] = value
        return Promise.resolve()
    }

    async getItem(key) {
        return this.Data[key];
    }
}

class DefaultListStorage {
    constructor(id) {
        this.Data = [];
        // `key`` field for dup checking
        this.id = id;
        Interface.ensureImplements(this, IListStorage);
    }

    list() {
        return this.Data;
    };

    add(...items) {
        if (items.constructor === Array) {
            const dupMap = this.Data.map(t => t[this.id]);
            const itemSet = {};
            items.forEach(t => {
                if (!dupMap.includes(t[this.id])) {
                    itemSet[t[this.id]] = t;
                }
            });

            const tokens = Object.values(itemSet);
            this.Data.unshift(...tokens);
        }
    };

    removeFollowingToken(tokenId) {
        const removedIndex = this.Data.findIndex(token => token[this.id] === tokenId);
        if (removedIndex !== -1) {
            this.Data.splice(removedIndex, 1);
        }
    }
}