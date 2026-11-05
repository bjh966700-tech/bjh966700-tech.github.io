// 작품별 응원 수를 Supabase에 저장/조회하는 Netlify Function
// 필요한 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Netlify 사이트 설정에서 입력)
const WORKS = ["snake", "profile", "next"];

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(500, { error: "서버 환경 변수가 설정되지 않았습니다." });

  // 새 secret 키(sb_secret_...)는 apikey 헤더로만 보내고,
  // 예전 service_role 키(eyJ...)는 Authorization 헤더에도 함께 보냅니다.
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  try {
    if (event.httpMethod === "GET") {
      const r = await fetch(`${url}/rest/v1/cheers?select=work_id,count`, { headers });
      if (!r.ok) return json(502, { error: "조회 실패" });
      const rows = await r.json();
      const out = Object.fromEntries(WORKS.map((w) => [w, 0]));
      rows.forEach((row) => { if (row.work_id in out) out[row.work_id] = row.count; });
      return json(200, out);
    }

    if (event.httpMethod === "POST") {
      let work;
      try { work = JSON.parse(event.body || "{}").work; } catch { /* 아래에서 처리 */ }
      if (!WORKS.includes(work)) return json(400, { error: "알 수 없는 작품입니다." });
      const r = await fetch(`${url}/rest/v1/rpc/increment_cheer`, {
        method: "POST", headers, body: JSON.stringify({ p_work_id: work }),
      });
      if (!r.ok) return json(502, { error: "저장 실패" });
      return json(200, { work, count: await r.json() });
    }

    return json(405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    return json(500, { error: "서버 오류" });
  }
};
