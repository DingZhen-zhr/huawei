// Supabase Postgres 存取：会话与消息（device_id 匿名标识，不收集个人信息）
import "dotenv/config";
import pg from "pg";

const URL = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL;
export const dbEnabled = Boolean(URL);

let pool = null;
function getPool() {
  if (!pool && URL) {
    pool = new pg.Pool({ connectionString: URL, ssl: { rejectUnauthorized: false }, max: 3 });
  }
  return pool;
}

export async function getSession(deviceId) {
  if (!dbEnabled || !deviceId) return null;
  const { rows } = await getPool().query(
    `insert into sessions (device_id) values ($1)
     on conflict (device_id) do update set updated_at = now()
     returning id, slots, summary, updated_at`,
    [deviceId],
  );
  return rows[0];
}

export async function loadHistory(deviceId, limit = 20) {
  if (!dbEnabled || !deviceId) return { messages: [], slots: {}, updatedAt: null };
  const { rows } = await getPool().query(
    `select m.role, m.content, m.facts, m.options, m.created_at, s.slots, s.updated_at
       from messages m
       join sessions s on s.id = m.session_id
      where s.device_id = $1
      order by m.created_at desc, m.id desc
      limit $2`,
    [deviceId, limit],
  );
  if (!rows.length) return { messages: [], slots: {}, updatedAt: null };
  return {
    messages: rows.reverse().map((r) => ({
      role: r.role,
      content: r.content,
      facts: r.facts || [],
      options: r.options || [],
    })),
    slots: rows[rows.length - 1].slots || {},
    updatedAt: rows[rows.length - 1].updated_at,
  };
}

export async function saveTurn({ deviceId, userText, assistant }) {
  if (!dbEnabled || !deviceId || !assistant?.reply) return;
  const session = await getSession(deviceId);
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(`insert into messages (session_id, role, content) values ($1,'user',$2)`, [
      session.id,
      userText,
    ]);
    await client.query(
      `insert into messages (session_id, role, content, facts, options) values ($1,'assistant',$2,$3,$4)`,
      [session.id, assistant.reply, JSON.stringify(assistant.facts || []), JSON.stringify(assistant.options || [])],
    );
    await client.query(`update sessions set slots = $2, updated_at = now() where id = $1`, [
      session.id,
      JSON.stringify(assistant.slots || {}),
    ]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function clearSession(deviceId) {
  if (!dbEnabled || !deviceId) return;
  await getPool().query(`delete from sessions where device_id = $1`, [deviceId]);
}
