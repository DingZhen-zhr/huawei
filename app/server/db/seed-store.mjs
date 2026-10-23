import "dotenv/config";
import { addStore } from "../refactor/store-repo.mjs";

const code = process.env.SEED_STORE_CODE;
const name = process.env.SEED_STORE_NAME;
const pin = process.env.SEED_STORE_PIN;

if (!code || !name || !pin) {
  console.error("请配置 SEED_STORE_CODE、SEED_STORE_NAME、SEED_STORE_PIN");
  process.exit(1);
}

const store = await addStore({ code, name, pin });
console.log(`✅ 门店已创建：${store.code} / ${store.name}`);
