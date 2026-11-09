// 방명록: 목록 조회는 누구나, 글쓰기는 GitHub 로그인 또는 손님(이름만 입력) 둘 다 가능,
// 삭제는 로그인한 사람이 자기 글만 (사이트 주인은 모든 글, 손님 글은 주인만)
// 필요한 환경 변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const PUBLISHABLE_KEY = "sb_publishable_JfUcCrmNwvuEAmWzZjJu1g_5IPCPRDJ"; // 공개용 키 (브라우저에도 노출되는 값)
const OWNER_GITHUB_ID = process.env.OWNER_GITHUB_ID || "321423967";     // bjh966700-tech 의 GitHub 숫자 ID

const json = (status, body) => ({
  statusCode: status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

// 브라우저가 보낸 로그인 토큰을 Supabase Auth에 확인해 사용자 정보를 얻는다.
// 이름·아이디는 사용자가 바꿀 수 없는 GitHub 연결 정보(identity)에서만 가져온다.
async function getUser(url, event) {
  const auth = event.headers.authorization || event.headers.Authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const user = await r.json();
  const gh = (user.identities || []).find((i) => i.provider === "github");
  if (!gh) return null;
  const d = gh.identity_data || {};
  return {
    id: user.id,
    githubId: String(gh.provider_id || d.provider_id || d.sub || gh.id || ""),
    login: d.user_name || d.preferred_username || d.name || "GitHub 사용자",
    avatar: d.avatar_url || null,
  };
}

exports.handler = async (event) => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json(500, { error: "서버 환경 변수가 설정되지 않았습니다." });

  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  try {
    if (event.httpMethod === "GET") {
      const r = await fetch(
        `${url}/rest/v1/guestbook?select=id,name,message,avatar_url,user_id,created_at&order=created_at.desc&limit=50`,
        { headers }
      );
      if (!r.ok) return json(502, { error: "조회 실패" });
      return json(200, await r.json());
    }

    if (event.httpMethod === "POST") {
      let body;
      try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "잘못된 요청입니다." }); }
      const message = String(body.message || "").trim();
      if (!message || message.length > 300) return json(400, { error: "남길 말은 1~300자로 적어 주세요." });

      const hasToken = /^Bearer\s+\S+/.test(event.headers.authorization || event.headers.Authorization || "");
      let row;
      if (hasToken) { // GitHub 로그인한 사람: 이름·사진은 GitHub 정보로
        const user = await getUser(url, event);
        if (!user) return json(401, { error: "로그인이 만료됐어요. 다시 로그인하거나, 로그아웃한 뒤 이름을 적어 손님으로 남겨 주세요." });
        row = { name: user.login.slice(0, 40), message, user_id: user.id, avatar_url: user.avatar };
      } else { // 손님: 이름만 입력
        if (body.website) return json(200, { ok: true }); // 숨은 칸을 채우는 스팸 봇은 조용히 무시
        const name = String(body.name || "").trim();
        if (!name || name.length > 20) return json(400, { error: "이름은 1~20자로 적어 주세요." });
        if (name.toLowerCase().replace(/\s/g, "") === "bjh966700-tech") return json(400, { error: "이 이름은 사이트 주인 이름이라 쓸 수 없어요." });
        row = { name, message, user_id: null, avatar_url: null };
      }

      const r = await fetch(`${url}/rest/v1/guestbook`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
      if (!r.ok) return json(502, { error: "저장 실패" });
      const [saved] = await r.json();
      return json(200, saved);
    }

    if (event.httpMethod === "DELETE") {
      const user = await getUser(url, event);
      if (!user) return json(401, { error: "GitHub로 로그인해야 글을 삭제할 수 있어요." });
      const id = Number((event.queryStringParameters || {}).id);
      if (!Number.isInteger(id) || id <= 0) return json(400, { error: "잘못된 글 번호입니다." });
      const isOwner = user.githubId === OWNER_GITHUB_ID;
      // 주인이 아니면 "글 번호 + 내 계정" 둘 다 맞는 글만 지워진다
      const filter = isOwner ? `id=eq.${id}` : `id=eq.${id}&user_id=eq.${user.id}`;
      const r = await fetch(`${url}/rest/v1/guestbook?${filter}`, {
        method: "DELETE",
        headers: { ...headers, Prefer: "return=representation" },
      });
      if (!r.ok) return json(502, { error: "삭제 실패" });
      const rows = await r.json();
      if (!rows.length) return json(isOwner ? 404 : 403, { error: isOwner ? "이미 지워진 글입니다." : "내가 쓴 글만 삭제할 수 있어요." });
      return json(200, { deleted: id });
    }

    return json(405, { error: "허용되지 않는 요청입니다." });
  } catch (e) {
    return json(500, { error: "서버 오류" });
  }
};
