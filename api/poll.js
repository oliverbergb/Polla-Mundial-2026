// /api/poll.js — Poller automático de resultados en vivo
// Corre desde un cron externo (cron-job.org) cada 1-2 min durante los partidos.
// Así los goles se actualizan AUNQUE nadie tenga la app abierta.
//
// Seguridad:
//  - Protegido por un token secreto (CRON_SECRET). Sin el token, responde 401.
//  - Escribe en Firebase con una cuenta de servicio (Admin SDK) que vive SOLO
//    en las variables de entorno de Vercel. La clave nunca toca el navegador.
//
// Variables de entorno requeridas en Vercel:
//  - BALLDONTLIE_KEY        (ya la tienes)
//  - CRON_SECRET            (inventa una cadena larga y aleatoria)
//  - FIREBASE_DB_URL        (ej: https://tupolla-xxxx-default-rtdb.firebaseio.com)
//  - FIREBASE_SERVICE_ACCOUNT  (el JSON COMPLETO de la cuenta de servicio, en una línea)

import admin from "firebase-admin";

// Inicializar Admin SDK una sola vez (se reutiliza entre invocaciones "calientes")
function getDb() {
  if (!admin.apps.length) {
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(svc),
      databaseURL: process.env.FIREBASE_DB_URL,
    });
  }
  return admin.database();
}

// Misma normalización/filtrado de eventos que usa el frontend
function mapEvents(rows) {
  return (rows || [])
    .filter((e) =>
      ["goal", "red_card", "own_goal", "penalty", "yellow_card", "substitution"].includes(e.type)
    )
    .map((e) => ({
      min: e.minute ?? e.time ?? 0,
      type: e.type,
      player: e.player?.name || e.player?.short_name || "",
      pin: e.player_in?.name || e.player_in?.short_name || e.in?.name || e.substitute?.name || "",
      pout: e.player_out?.name || e.player_out?.short_name || e.out?.name || "",
      team: e.team?.abbreviation || "",
    }))
    .sort((a, b) => a.min - b.min);
}

const BDL = "https://api.balldontlie.io/fifa/worldcup/v1";

export default async function handler(req, res) {
  // 1) Validar token secreto
  const token = req.query.key || req.headers["x-cron-key"] || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const key = process.env.BALLDONTLIE_KEY;
  if (!key) return res.status(500).json({ error: "BALLDONTLIE_KEY no configurada" });

  try {
    const db = getDb();

    // 2) Leer el mapa apiId -> localId que publica la app del admin
    const mapSnap = await db.ref("apiIdMap").get();
    const apiIdMap = mapSnap.val() || {}; // { "<apiId>": <localId>, ... }
    if (!Object.keys(apiIdMap).length) {
      return res.status(200).json({ ok: true, note: "apiIdMap vacío — abre la app del admin una vez para publicarlo" });
    }

    // 3) Leer scores/eventos previos para detectar cambios
    const [scoreSnap, evSnap] = await Promise.all([
      db.ref("liveScores").get(),
      db.ref("liveEvents").get(),
    ]);
    const prevScores = scoreSnap.val() || {};
    const prevEvents = evSnap.val() || {};

    // 4) Traer todos los partidos de la temporada
    const r = await fetch(`${BDL}/matches?seasons[]=2026&per_page=200`, {
      headers: { Authorization: key },
    });
    const data = await r.json();
    if (!data.data) return res.status(502).json({ error: "Respuesta inesperada de BallDontLie" });

    const updates = {};
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

      updates[`liveScores/${localId}`] = { h, a, status: m.status || "in_progress" };
      touched++;

      // Bajar eventos si: el marcador cambió, el partido está en juego (tarjetas/cambios),
      // o aún no tenemos eventos guardados para un partido terminado.
      const needEvents =
        changed || m.status === "in_progress" || !prevEvents[localId];
      if (needEvents) {
        eventFetches.push(
          fetch(`${BDL}/match_events?match_id=${m.id}`, { headers: { Authorization: key } })
            .then((er) => (er.ok ? er.json() : null))
            .then((ed) => {
              if (ed && ed.data) updates[`liveEvents/${localId}`] = mapEvents(ed.data);
            })
            .catch(() => {})
        );
      }
    }

    await Promise.all(eventFetches);

    if (touched > 0) {
      updates["liveScores/_lastUpdated"] = Date.now();
      await db.ref().update(updates);
    }

    return res.status(200).json({ ok: true, partidosActualizados: touched });
  } catch (e) {
    return res.status(500).json({ error: "Fallo en el poller", detail: String(e.message || e) });
  }
}
