// Supabase Postgres 持久化：门店、内容任务、事实运行时状态。
// 未启用时（本地测试/无 DATABASE_URL）走各模块原有的 JSON 运行时。
import "dotenv/config";
import pg from "pg";

const CONNECTION = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL;
const FORCED_LOCAL = process.env.HC_PERSISTENCE === "local" || process.env.NODE_ENV === "test" || Boolean(process.env.HC_RUNTIME_DIR);
const ENABLED =
  !FORCED_LOCAL &&
  Boolean(CONNECTION) &&
  (process.env.HC_PERSISTENCE === "supabase" || process.env.NODE_ENV === "production");

let pool = null;

if (process.env.HC_PERSISTENCE === "supabase" && !CONNECTION) {
  console.warn("[db] HC_PERSISTENCE=supabase 但没有 SUPABASE_POOLER_URL / SUPABASE_DB_URL，已回退本地 JSON");
}

export function dbEnabled() {
  return ENABLED;
}

export async function dbPing() {
  if (!ENABLED) return { ok: false, reason: "not-configured" };
  try {
    await query("select 1");
    return { ok: true };
  } catch (error) {
    console.error("[db] ping failed:", error.message);
    return { ok: false, reason: "down" };
  }
}

function getPool() {
  if (!ENABLED) throw new Error("Supabase 持久化未启用");
  if (!pool) {
    pool = new pg.Pool({
      connectionString: CONNECTION,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      query_timeout: 15_000,
      allowExitOnIdle: true,
    });
    pool.on("error", (error) => console.error("[db] pool error:", error.message));
  }
  return pool;
}

export async function query(text, params = []) {
  const result = await getPool().query(text, params);
  return result;
}

export async function withClient(fn) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/* ---------------- 门店 ---------------- */

function rowToStore(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    demo: Boolean(row.demo),
    pinHash: row.pin_hash,
    profile: {
      city: row.city || "",
      address: row.address || "",
      phone: row.phone || "",
      businessHours: row.business_hours || "",
      qrAssetUrl: row.qr_asset_url || "",
      voiceTone: row.voice_tone || "直接、克制",
      voiceSamples: Array.isArray(row.voice_samples) ? row.voice_samples : [],
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const STORE_SELECT = `
  select s.*, p.city, p.address, p.phone, p.business_hours, p.qr_asset_url,
         p.voice_tone, p.voice_samples
  from public.stores s
  left join public.store_profiles p on p.store_id = s.id
`;

export async function dbFindStoreByCode(code) {
  const result = await query(`${STORE_SELECT} where lower(s.code) = lower($1) limit 1`, [code]);
  return rowToStore(result.rows[0]);
}

export async function dbGetStoreById(id) {
  const result = await query(`${STORE_SELECT} where s.id = $1 limit 1`, [id]);
  return rowToStore(result.rows[0]);
}

export async function dbListStores() {
  const result = await query(`${STORE_SELECT} order by s.created_at asc`);
  return result.rows.map(rowToStore);
}

export async function dbInsertStore(store) {
  const id = await withClient(async (client) => {
    const inserted = await client.query(
      `insert into public.stores (id, code, name, status, pin_hash, demo)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (code) do nothing
       returning id`,
      [store.id, store.code, store.name, store.status, store.pinHash, Boolean(store.demo)],
    );
    const insertedId = inserted.rows[0]?.id;
    if (!insertedId) return null;
    await client.query(
      `insert into public.store_profiles
         (store_id, city, address, phone, business_hours, qr_asset_url, voice_tone, voice_samples)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       on conflict (store_id) do update set
         city = excluded.city, address = excluded.address, phone = excluded.phone,
         business_hours = excluded.business_hours, qr_asset_url = excluded.qr_asset_url,
         voice_tone = excluded.voice_tone, voice_samples = excluded.voice_samples,
         updated_at = now()`,
      [
        insertedId,
        store.profile?.city || "",
        store.profile?.address || "",
        store.profile?.phone || "",
        store.profile?.businessHours || "",
        store.profile?.qrAssetUrl || "",
        store.profile?.voiceTone || "直接、克制",
        JSON.stringify(store.profile?.voiceSamples || []),
      ],
    );
    return insertedId;
  });
  return id ? dbGetStoreById(id) : null;
}

export async function dbUpdateStoreProfile(id, profile) {
  await query(
    `insert into public.store_profiles
       (store_id, city, address, phone, business_hours, qr_asset_url, voice_tone, voice_samples)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     on conflict (store_id) do update set
       city = excluded.city, address = excluded.address, phone = excluded.phone,
       business_hours = excluded.business_hours, qr_asset_url = excluded.qr_asset_url,
       voice_tone = excluded.voice_tone, voice_samples = excluded.voice_samples,
       updated_at = now()`,
    [
      id,
      profile.city || "",
      profile.address || "",
      profile.phone || "",
      profile.businessHours || "",
      profile.qrAssetUrl || "",
      profile.voiceTone || "直接、克制",
      JSON.stringify(profile.voiceSamples || []),
    ],
  );
  return dbGetStoreById(id);
}

export async function dbUpdatePin(id, pinHash) {
  await query("update public.stores set pin_hash = $2, updated_at = now() where id = $1", [id, pinHash]);
}

/* ---------------- 内容任务 ---------------- */

export async function dbSaveTask(task, events) {
  const payload = { ...task, events: (events || []).slice(-100) };
  await withClient(async (client) => {
    await client.query(
      `insert into public.content_tasks
        (id, store_id, product_id, product_name, task_card_id, brief, audience, scene, target,
         real_detail, question_answers, status, progress, evidence, conflicts, errors,
         generation_mode, payload, created_at, updated_at, expires_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18::jsonb,$19,$20,$21)
       on conflict (id) do update set
         status = excluded.status,
         progress = excluded.progress,
         evidence = excluded.evidence,
         conflicts = excluded.conflicts,
         errors = excluded.errors,
         generation_mode = excluded.generation_mode,
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      [
        task.id,
        task.storeId,
        task.productId,
        task.productName,
        task.taskCardId || null,
        task.brief || "",
        task.audience || "",
        task.scene || "",
        task.target || "",
        JSON.stringify(task.realDetail || {}),
        JSON.stringify(task.questionAnswers || {}),
        task.status,
        JSON.stringify(task.progress || {}),
        JSON.stringify(task.evidence || []),
        JSON.stringify(task.conflicts || []),
        JSON.stringify(task.errors || []),
        task.generationMode || null,
        JSON.stringify(payload),
        task.createdAt || new Date().toISOString(),
        task.updatedAt || new Date().toISOString(),
        task.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString(),
      ],
    );
    await client.query("delete from public.content_variants where task_id = $1", [task.id]);
    for (const variant of task.variants || []) {
      await client.query(
        `insert into public.content_variants
          (id, task_id, platform, angle, content, status, verification, copy_quality, edit_burden, selected, created_at, updated_at)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12)`,
        [
          variant.id,
          task.id,
          variant.platform,
          variant.angle,
          JSON.stringify(variant),
          variant.status || "writing",
          JSON.stringify(variant.verification || null),
          JSON.stringify(variant.copyQuality || null),
          variant.editBurden || "light",
          Boolean(variant.selected),
          variant.createdAt || task.createdAt || new Date().toISOString(),
          variant.updatedAt || new Date().toISOString(),
        ],
      );
    }
  });
}

export async function dbLoadTask(id) {
  const result = await query("select payload from public.content_tasks where id = $1 limit 1", [id]);
  if (!result.rows.length) return null;
  const payload = result.rows[0].payload;
  if (!payload || typeof payload !== "object" || !payload.id) return null;
  const events = Array.isArray(payload.events) ? payload.events : [];
  const task = { ...payload };
  delete task.events;
  return { task, events };
}

export async function dbListTasks(storeId, limit = 30) {
  const params = [];
  let where = "";
  if (storeId) {
    params.push(storeId);
    where = "where store_id = $1";
  }
  params.push(limit);
  const result = await query(
    `select payload from public.content_tasks ${where} order by created_at desc limit $${params.length}`,
    params,
  );
  return result.rows
    .map((row) => row.payload)
    .filter((task) => task && task.id)
    .map((task) => ({ ...task, events: undefined }));
}

/* ---------------- 运行时状态（事实候选/冲突确认） ---------------- */

export async function dbLoadState(key) {
  const result = await query("select value from public.runtime_state where key = $1", [key]);
  return result.rows[0]?.value ?? null;
}

export async function dbSaveState(key, value) {
  await query(
    `insert into public.runtime_state (key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export async function closeDb() {
  if (pool) await pool.end().catch(() => {});
  pool = null;
}
