import Validator from '@lib/utils/validator';

const PORTAL_STORAGE_KEYS = {
    PORTAL_BTC_SHIELD_ADDRESS: "$PORTAL_BTC_SHIELD_ADDRESS",
}

function getKeyStoragePortalShieldAddress() {
    return `${PORTAL_STORAGE_KEYS.PORTAL_BTC_SHIELD_ADDRESS}-${this.getPaymentAddress()}`;
}

async function getStoragePortalShieldAddress() {
    try {
        const key = this.getKeyStoragePortalShieldAddress();
        return this.getAccountStorage(key) || "";
    } catch (e) {
        throw e;
    }
}

async function setStoragePortalShieldAddress({ shieldAddress }) {
    new Validator("setStoragePortalShieldAddress-shieldAddress", shieldAddress).required().string();

    try {
        const key = this.getKeyStoragePortalShieldAddress();
        await this.setAccountStorage(key, shieldAddress);
    } catch (e) {
        throw e;
    }
}

export default {
    getKeyStoragePortalShieldAddress,
    getStoragePortalShieldAddress,
    setStoragePortalShieldAddress,
};
