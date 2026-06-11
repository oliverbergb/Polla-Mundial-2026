// /api/poll.js — Poller automático, sin librerías externas
// Solo usa fetch. No necesita firebase-admin ni package.json.
//
// Variables de entorno en Vercel:
//  - BALLDONTLIE_KEY     (ya la tienes)
//  - CRON_SECRET         (ya la tienes)
//  - FIREBASE_DB_URL     (ya la tienes, ej: https://tupolla-xxxx-default-rtdb.firebaseio.com)
//  - FIREBASE_DB_SECRET  (nueva — ver instrucciones)

const BDL = "https://api.balldontlie.io/fifa/worldcup/v1";

function mapEvents(rows) {
  return (rows || [])
    .filter(e => ["goal","red_card","own_goal","penalty","yellow_card","substitution"].includes(e.type))
    .map(e => ({
      min: e.minute ?? e.time ?? 0,
      type: e.type,
      player: e.player?.name || e.player?.short_name || "",
      pin: e.player_in?.name || e.player_in?.short_name || e.in?.name || e.substitute?.name || "",
      pout: e.player_out?.name || e.player_out?.short_name || e.out?.name || "",
      team: e.team?.abbreviation || "",
    }))
    .sort((a, b) => a.min - b.min);
}

async function fbGet(path, secret, dbUrl) {
  const r = await fetch(`${dbUrl}/${path}.json?auth=${secret}`);
  if (!r.ok) throw new Error(`Firebase GET ${path} → ${r.status}`);
  return r.json();
}

async function fbPatch(path, data, secret, dbUrl) {
  const r = await fetch(`${dbUrl}/${path}.json?auth=${secret}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`Firebase PATCH ${path} → ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  // 1) Token secreto del cron
  const token = req.query.key || req.headers["x-cron-key"] || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  // 2) Variables de entorno
  const bdlKey   = process.env.BALLDONTLIE_KEY;
  const dbUrl    = (process.env.FIREBASE_DB_URL || "").replace(/\/$/, "");
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!bdlKey)   return res.status(500).json({ error: "Falta BALLDONTLIE_KEY" });
  if (!dbUrl)    return res.status(500).json({ error: "Falta FIREBASE_DB_URL" });
  if (!dbSecret) return res.status(500).json({ error: "Falta FIREBASE_DB_SECRET — ve a Firebase → Configuración → Cuentas de servicio → Secrets de base de datos" });

  try {
    // 3) Leer mapa apiId → localId
    const apiIdMap = await fbGet("apiIdMap", dbSecret, dbUrl) || {};
    if (!Object.keys(apiIdMap).length) {
      return res.status(200).json({ ok: true, note: "apiIdMap vacío — abre la app del admin una vez para publicarlo" });
    }

    // 4) Scores y eventos previos
    const [prevScores, prevEvents] = await Promise.all([
      fbGet("liveScores", dbSecret, dbUrl).catch(() => ({})),
      fbGet("liveEvents", dbSecret, dbUrl).catch(() => ({})),
    ]);

    // 5) Traer partidos de BallDontLie
    const r = await fetch(`${BDL}/matches?seasons[]=2026&per_page=200`, {
      headers: { Authorization: bdlKey },
    });
    const data = await r.json();
    if (!data.data) return res.status(502).json({ error: "Respuesta inesperada de BallDontLie", detail: data });

    const scoreUpdates = {};
    const eventFetches = [];
    let touched = 0;

    for (const m of data.data) {
      if (m.status !== "completed" && m.status !== "in_progress") continue;
      if (m.home_score == null || m.away_score == null) continue;
      const localId = apiIdMap[String(m.id)];
      if (localId == null) continue;

      const h = String(m.home_score), a = String(m.away_score);
      const prev = prevScores[localId];
      const changed = !prev || prev.h !== h || prev.a !== a;

      scoreUpdates[localId] = { h, a, status: m.status || "in_progress" };
      touched++;

      if (changed || m.status === "in_progress" || !prevEvents[localId]) {
        const apiId = m.id;
        eventFetches.push(
          fetch(`${BDL}/match_events?match_id=${apiId}`, { headers: { Authorization: bdlKey } })
            .then(er => er.ok ? er.json() : null)
            .then(async ed => {
              if (ed && ed.data) {
                await fbPatch(`liveEvents`, { [localId]: mapEvents(ed.data) }, dbSecret, dbUrl);
              }
            })
            .catch(() => {})
        );
      }
    }

    await Promise.all(eventFetches);

    if (touched > 0) {
      scoreUpdates["_lastUpdated"] = Date.now();
      await fbPatch("liveScores", scoreUpdates, dbSecret, dbUrl);
    }

    return res.status(200).json({ ok: true, partidosActualizados: touched });

  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
