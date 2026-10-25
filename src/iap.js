// "PunchPulse Pro" in-app purchase via Meta's Digital Goods API.
// Only works when the app is installed from the Meta Horizon Store (incl. ALPHA/BETA channels).
// Docs: https://developers.meta.com/horizon/documentation/web/ps-iap/
import { CONFIG } from './config.js';
import { Storage } from './storage.js';

const BILLING = 'https://quest.meta.com/billing';

export const IAP = {
  available: false,   // store billing reachable
  pro: false,         // user owns Pro
  price: '',          // localized price string, e.g. "$4.99"

  async init() {
    if (CONFIG.DEV_UNLOCK) { this.pro = true; return; }
    this.pro = Storage.proCached; // works offline after first check

    if (!('getDigitalGoodsService' in window)) return;
    try {
      this.service = await window.getDigitalGoodsService(BILLING);
      this.available = true;
      const purchases = await this.service.listPurchases();
      const owned = purchases.some((p) => p.itemId === CONFIG.PRO_SKU);
      this.pro = owned;
      Storage.proCached = owned;
      const details = await this.service.getDetails([CONFIG.PRO_SKU]);
      const d = details.find((x) => x.itemId === CONFIG.PRO_SKU);
      if (d?.price) {
        this.price = new Intl.NumberFormat(undefined, { style: 'currency', currency: d.price.currency })
          .format(Number(d.price.value));
      }
    } catch (e) {
      console.warn('IAP unavailable:', e);
    }
  },

  async buyPro() {
    if (!this.available) return false;
    try {
      const request = new PaymentRequest(
        [{ supportedMethods: BILLING, data: { sku: CONFIG.PRO_SKU } }],
        { total: { label: 'Total', amount: { currency: 'USD', value: '0' } } } // values unused by Meta
      );
      const response = await request.show();
      await response.complete('success'); // must call, or input can freeze
      this.pro = true;
      Storage.proCached = true;
      return true;
    } catch (e) {
      console.warn('Purchase cancelled/failed:', e);
      return false;
    }
  },
};
