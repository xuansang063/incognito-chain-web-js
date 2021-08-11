import Validator from '@lib/utils/validator';

const PORTAL_STORAGE_KEYS = {
	PORTAL_BTC_SHIELD_ADDRESS: "$PORTAL_BTC_SHIELD_ADDRESS",
	PORTAL_TXS: "$PORTAL_TXS",
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

function getKeyTxsPortalStorage(params) {
	try {
		const { tokenID, version } = params;
		new Validator("getKeyTxsPortalStorage-tokenID", tokenID)
			.required()
			.string();
		new Validator("getKeyTxsPortalStorage-version", version)
			.required()
			.number();
		return this.getKeySetKeysStorageByTokenId({
			tokenID,
			prefixName: `${PORTAL_STORAGE_KEYS.PORTAL_TXS}`,
			version,
		});
	} catch (error) {
		throw error;
	}
}

function setTxsPortalStorage(params, portalTxs) {
	try {
		const { tokenID, version } = params;
		new Validator("setTxsPortalStorage-tokenID", tokenID)
			.required()
			.string();
		new Validator("setTxsPortalStorage-version", version)
			.required()
			.number();
		new Validator("setTxsPortalStorage-portalTxs", portalTxs)
			.required()
			.array();
		const key = this.getKeyTxsPortalStorage(params);
		return this.setAccountStorage(key, portalTxs);
	} catch (error) {
		throw error;
	}
}

function getTxsPortalStorage(params) {
	try {
		const { tokenID, version } = params;
		new Validator("setTxsPortalStorage-tokenID", tokenID)
			.required()
			.string();
		new Validator("setTxsPortalStorage-version", version)
			.required()
			.number();
		const key = this.getKeyTxsPortalStorage(params);
		return this.getSetKeysStorage({ key });
	} catch (error) {
		throw error;
	}
}

export default {
	getKeyStoragePortalShieldAddress,
	getStoragePortalShieldAddress,
	setStoragePortalShieldAddress,
	getKeyTxsPortalStorage,
	getTxsPortalStorage,
	setTxsPortalStorage,
};
