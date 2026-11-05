// 방명록 글을 Supabase에 저장/조회하는 Netlify Function
// 필요한 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(500, { error: "서버 환경 변수가 설정되지 않았습니다." });

  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  try {
    if (event.httpMethod === "GET") {
      const r = await fetch(
        `${url}/rest/v1/guestbook?select=id,name,message,created_at&order=created_at.desc&limit=50`,
        { headers }
      );
      if (!r.ok) return json(502, { error: "조회 실패" });
      return json(200, await r.json());
    }

    if (event.httpMethod === "POST") {
      let body;
      try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "잘못된 요청입니다." }); }
      if (body.website) return json(200, { ok: true }); // 스팸 봇이 숨은 칸을 채우면 조용히 무시
      const name = String(body.name || "").trim();
      const message = String(body.message || "").trim();
      if (!name || name.length > 20) return json(400, { error: "이름은 1~20자로 적어 주세요." });
      if (!message || message.length > 300) return json(400, { error: "남길 말은 1~300자로 적어 주세요." });

      const r = await fetch(`${url}/rest/v1/guestbook`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ name, message }),
      });
      if (!r.ok) return json(502, { error: "저장 실패" });
      const [row] = await r.json();
      return json(200, row);
    }

    return json(405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    return json(500, { error: "서버 오류" });
  }
};
