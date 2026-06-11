// /api/poll.js — Poller automático de resultados en vivo
// Sin librerías externas. Solo fetch.
// Construye su propio mapa de partidos — no depende de que el frontend publique nada.
//
// Variables de entorno en Vercel:
//  - BALLDONTLIE_KEY
//  - CRON_SECRET
//  - FIREBASE_DB_URL     (ej: https://tupolla-xxxx-default-rtdb.firebaseio.com)
//  - FIREBASE_DB_SECRET  (Firebase → Configuración → Cuentas de servicio → Secrets de base de datos)

const BDL = "https://api.balldontlie.io/fifa/worldcup/v1";

// ── Partidos de la app (mismo orden que el frontend) ──────────────────────
const MATCHES = [
 {id:1,home:"México",away:"Sudáfrica"},{id:2,home:"Corea del Sur",away:"Rep. Checa"},
 {id:3,home:"Canadá",away:"Bosnia"},{id:4,home:"Estados Unidos",away:"Paraguay"},
 {id:5,home:"Brasil",away:"Marruecos"},{id:6,home:"Haití",away:"Escocia"},
 {id:7,home:"Qatar",away:"Suiza"},{id:8,home:"Australia",away:"Turquía"},
 {id:9,home:"Alemania",away:"Curazao"},{id:10,home:"Costa de Marfil",away:"Ecuador"},
 {id:11,home:"Países Bajos",away:"Japón"},{id:12,home:"Suecia",away:"Túnez"},
 {id:13,home:"España",away:"Cabo Verde"},{id:14,home:"Arabia Saudita",away:"Uruguay"},
 {id:15,home:"Bélgica",away:"Egipto"},{id:16,home:"Irán",away:"Nueva Zelanda"},
 {id:17,home:"Francia",away:"Senegal"},{id:18,home:"Irak",away:"Noruega"},
 {id:19,home:"Argentina",away:"Argelia"},{id:20,home:"Austria",away:"Jordania"},
 {id:21,home:"Inglaterra",away:"Croacia"},{id:22,home:"Ghana",away:"Panamá"},
 {id:23,home:"Portugal",away:"RD Congo"},{id:24,home:"Uzbekistán",away:"Colombia"},
 {id:25,home:"Rep. Checa",away:"Sudáfrica"},{id:26,home:"Suiza",away:"Bosnia"},
 {id:27,home:"Canadá",away:"Qatar"},{id:28,home:"México",away:"Corea del Sur"},
 {id:29,home:"Estados Unidos",away:"Australia"},{id:30,home:"Escocia",away:"Marruecos"},
 {id:31,home:"Brasil",away:"Haití"},{id:32,home:"Turquía",away:"Paraguay"},
 {id:33,home:"Alemania",away:"Costa de Marfil"},{id:34,home:"Ecuador",away:"Curazao"},
 {id:35,home:"Países Bajos",away:"Suecia"},{id:36,home:"Túnez",away:"Japón"},
 {id:37,home:"España",away:"Arabia Saudita"},{id:38,home:"Uruguay",away:"Cabo Verde"},
 {id:39,home:"Bélgica",away:"Irán"},{id:40,home:"Nueva Zelanda",away:"Egipto"},
 {id:41,home:"Francia",away:"Irak"},{id:42,home:"Noruega",away:"Senegal"},
 {id:43,home:"Argentina",away:"Austria"},{id:44,home:"Jordania",away:"Argelia"},
 {id:45,home:"Inglaterra",away:"Ghana"},{id:46,home:"Panamá",away:"Croacia"},
 {id:47,home:"Portugal",away:"Uzbekistán"},{id:48,home:"Colombia",away:"RD Congo"},
 {id:49,home:"Escocia",away:"Brasil"},{id:50,home:"Marruecos",away:"Haití"},
 {id:51,home:"Suiza",away:"Canadá"},{id:52,home:"Bosnia",away:"Qatar"},
 {id:53,home:"Rep. Checa",away:"México"},{id:54,home:"Sudáfrica",away:"Corea del Sur"},
 {id:55,home:"Ecuador",away:"Alemania"},{id:56,home:"Curazao",away:"Costa de Marfil"},
 {id:57,home:"Túnez",away:"Países Bajos"},{id:58,home:"Japón",away:"Suecia"},
 {id:59,home:"Turquía",away:"Estados Unidos"},{id:60,home:"Paraguay",away:"Australia"},
 {id:61,home:"Noruega",away:"Francia"},{id:62,home:"Senegal",away:"Irak"},
 {id:63,home:"Nueva Zelanda",away:"Bélgica"},{id:64,home:"Egipto",away:"Irán"},
 {id:65,home:"Uruguay",away:"España"},{id:66,home:"Cabo Verde",away:"Arabia Saudita"},
 {id:67,home:"Panamá",away:"Inglaterra"},{id:68,home:"Croacia",away:"Ghana"},
 {id:69,home:"Jordania",away:"Argentina"},{id:70,home:"Argelia",away:"Austria"},
 {id:71,home:"Colombia",away:"Portugal"},{id:72,home:"RD Congo",away:"Uzbekistán"},
];

// Mismo mapeo de nombres que usa el frontend (API_CODE + API_NAME)
const API_CODE = {"México":"MEX","Sudáfrica":"RSA","Corea del Sur":"KOR","Rep. Checa":"CZE","Brasil":"BRA","Marruecos":"MAR","Haití":"HAI","Escocia":"SCO","Canadá":"CAN","Qatar":"QAT","Suiza":"SUI","Bosnia":"BIH","Estados Unidos":"USA","Paraguay":"PAR","Australia":"AUS","Turquía":"TUR","Alemania":"GER","Costa de Marfil":"CIV","Ecuador":"ECU","Curazao":"CUW","Países Bajos":"NED","Japón":"JPN","Túnez":"TUN","Suecia":"SWE","Bélgica":"BEL","Egipto":"EGY","Irán":"IRN","Nueva Zelanda":"NZL","España":"ESP","Cabo Verde":"CPV","Arabia Saudita":"KSA","Uruguay":"URU","Francia":"FRA","Senegal":"SEN","Noruega":"NOR","Irak":"IRQ","Argentina":"ARG","Argelia":"ALG","Austria":"AUT","Jordania":"JOR","Portugal":"POR","Uzbekistán":"UZB","Colombia":"COL","RD Congo":"COD","Inglaterra":"ENG","Croacia":"CRO","Ghana":"GHA","Panamá":"PAN"};
const API_NAME = {"México":"mexico","Sudáfrica":"southafrica","Corea del Sur":"southkorea","Rep. Checa":"czechia","Brasil":"brazil","Marruecos":"morocco","Haití":"haiti","Escocia":"scotland","Canadá":"canada","Qatar":"qatar","Suiza":"switzerland","Bosnia":"bosnia","Estados Unidos":"unitedstates","Paraguay":"paraguay","Australia":"australia","Turquía":"turkiye","Alemania":"germany","Costa de Marfil":"ivorycoast","Ecuador":"ecuador","Curazao":"curacao","Países Bajos":"netherlands","Japón":"japan","Túnez":"tunisia","Suecia":"sweden","Bélgica":"belgium","Egipto":"egypt","Irán":"iran","Nueva Zelanda":"newzealand","España":"spain","Cabo Verde":"capeverde","Arabia Saudita":"saudiarabia","Uruguay":"uruguay","Francia":"france","Senegal":"senegal","Noruega":"norway","Irak":"iraq","Argentina":"argentina","Argelia":"algeria","Austria":"austria","Jordania":"jordan","Portugal":"portugal","Uzbekistán":"uzbekistan","Colombia":"colombia","RD Congo":"congo","Inglaterra":"england","Croacia":"croatia","Ghana":"ghana","Panamá":"panama"};

const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z]/g,"");

function apiTeamEq(appName, apiTeam) {
  if (!apiTeam) return false;
  const code = API_CODE[appName];
  const abbr = (apiTeam.abbreviation||"").toUpperCase();
  if (code && abbr === code) return true;
  const apiNorm = norm(apiTeam.name||apiTeam.full_name||"");
  const appNorm = API_NAME[appName] || norm(appName);
  return apiNorm === appNorm || apiNorm.includes(appNorm) || appNorm.includes(apiNorm);
}

function mapEvents(rows) {
  return (rows||[])
    .filter(e => ["goal","red_card","own_goal","penalty","yellow_card","substitution"].includes(e.type))
    .map(e => ({
      min: e.minute ?? e.time ?? 0,
      type: e.type,
      player: e.player?.name || e.player?.short_name || "",
      pin: e.player_in?.name || e.player_in?.short_name || e.in?.name || e.substitute?.name || "",
      pout: e.player_out?.name || e.player_out?.short_name || e.out?.name || "",
      team: e.team?.abbreviation || "",
    }))
    .sort((a,b) => a.min - b.min);
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
  if (!r.ok) throw new Error(`Firebase PATCH ${path} → ${r.status}: ${await r.text()}`);
  return r.json();
}

export default async function handler(req, res) {
  // 1) Token secreto
  const token = req.query.key || req.headers["x-cron-key"] || "";
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const bdlKey   = process.env.BALLDONTLIE_KEY;
  const dbUrl    = (process.env.FIREBASE_DB_URL||"").replace(/\/$/,"");
  const dbSecret = process.env.FIREBASE_DB_SECRET;

  if (!bdlKey)   return res.status(500).json({ error: "Falta BALLDONTLIE_KEY" });
  if (!dbUrl)    return res.status(500).json({ error: "Falta FIREBASE_DB_URL" });
  if (!dbSecret) return res.status(500).json({ error: "Falta FIREBASE_DB_SECRET" });

  try {
    // 2) Traer partidos de BallDontLie (paginado, máx 100 por página)
    let allMatches=[], cursor=null, guard=0;
    do {
      const url=`${BDL}/matches?seasons[]=2026&per_page=100${cursor?`&cursor=${cursor}`:""}`;
      const r=await fetch(url,{headers:{Authorization:bdlKey}});
      const page=await r.json();
      if(!page.data) return res.status(502).json({error:"Respuesta inesperada de BallDontLie",detail:page});
      allMatches=allMatches.concat(page.data);
      cursor=page.meta?.next_cursor||null;
      guard++;
    } while(cursor&&guard<5);

    // 3) Construir mapa bdl_id -> local_id usando la misma lógica que el frontend
    const bdlToLocal = {};
    for (const m of allMatches) {
      const match = MATCHES.find(x => apiTeamEq(x.home, m.home_team) && apiTeamEq(x.away, m.away_team));
      if (match) bdlToLocal[m.id] = match.id;
    }

    // 4) Scores previos para detectar cambios
    const prevScores = await fbGet("liveScores", dbSecret, dbUrl).catch(() => ({})) || {};
    const prevEvents = await fbGet("liveEvents", dbSecret, dbUrl).catch(() => ({})) || {};

    const scoreUpdates = {};
    const eventFetches = [];
    let touched = 0;

    for (const m of allMatches) {
      if (m.status !== "completed" && m.status !== "in_progress") continue;
      if (m.home_score == null || m.away_score == null) continue;
      const localId = bdlToLocal[m.id];
      if (!localId) continue;

      const h = String(m.home_score), a = String(m.away_score);
      const prev = prevScores[localId];
      const changed = !prev || prev.h !== h || prev.a !== a;

      scoreUpdates[localId] = { h, a, status: m.status || "in_progress" };
      touched++;

      if (changed || m.status === "in_progress" || !prevEvents[localId]) {
        const bdlId = m.id;
        eventFetches.push(
          fetch(`${BDL}/match_events?match_id=${bdlId}`, { headers: { Authorization: bdlKey } })
            .then(er => er.ok ? er.json() : null)
            .then(async ed => {
              if (ed?.data) await fbPatch(`liveEvents`, { [localId]: mapEvents(ed.data) }, dbSecret, dbUrl);
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

    return res.status(200).json({ ok: true, partidosActualizados: touched, mapeados: Object.keys(bdlToLocal).length });

  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
