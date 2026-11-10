/* 💬 플레이 소감
   소감은 Supabase(ongo-gamedev2026 프로젝트)의 reviews 표에 저장해요. 열쇠(코드)가 필요 없어요.
   - 받는 정보: 내 게임 번호(from_repo), 학번, 이름, 별점(1~5), 재미있던 요소(fun), 추가되면 좋을 요소(wish)
   - 학번·이름은 선생님만 Supabase 화면(Table Editor → reviews)에서 볼 수 있어요.
     사이트에는 학번을 내보내지 않고, 이름은 가려서(김*수) 보여 줘요. (list_reviews 함수)
   - 쓰기는 submit_review 함수로만 돼요. 고치기·지우기는 선생님이 Supabase 화면에서 해요.
   - versions.html: Reviews.mount(상자, 게임 저장소)
   - 작성하기(5주차): Reviews.all() / received() / given() / average() */
(function(){
const SB_URL = "https://xmoyfriilljgdkfivtum.supabase.co";
const SB_KEY = "sb_publishable_NpqGjoZUSd4pfzcGUb1Xvw_oWfLi2U7";   // 공개용 키 (브라우저에 넣어도 되는 키)
const MAX = 400;
const R = { org:"Ongo-gamedev2026", students:null };

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmt = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
const who = repo => { const s = (R.students || []).find(x => x.repo === repo); return s ? `학생 ${s.no}` + (s.nickname ? ` · ${s.nickname}` : "") : (repo || ""); };
const starTxt = n => "★".repeat(n) + "☆".repeat(5 - n);
/* 예전 코드와 맞추려고 남겨 둔 함수 (소감에는 더 이상 열쇠가 필요 없어요) */
function getKey(repo){ try{ return sessionStorage.getItem("ghkey:" + repo) || localStorage.getItem("ghkey:" + repo) || ""; }catch(_){ return ""; } }

/* ---------- Supabase ---------- */
async function rpc(fn, args){
  let r;
  try{
    r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, { method:"POST", cache:"no-store",
      headers:{ apikey:SB_KEY, "Content-Type":"application/json" }, body:JSON.stringify(args || {}) });
  }catch(_){ throw new Error("인터넷 연결을 확인해 주세요."); }
  const j = await r.json().catch(() => null);
  if(!r.ok){
    const m = (j && j.message) || "";
    if(/[가-힣]/.test(m)) throw new Error(m);
    if(/student_id/.test(m)) throw new Error("학번은 숫자로만 써 주세요.");
    if(/check constraint/.test(m)) throw new Error("빈칸이나 너무 긴 칸이 있어요. 다시 확인해 주세요.");
    throw new Error("저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
  }
  return j;
}
/* 화면·작성하기에서 쓰는 모양으로 바꿔요 (good = 재미있던 요소, idea = 추가되면 좋을 요소) */
const norm = x => ({ id:x.id, to:x.game_repo, from:x.from_repo || "", ver:x.ver || "", name:x.name || "", stars:x.stars,
  good:x.fun || "", idea:x.wish || "", at:x.created_at, latest:x.latest !== false });

/* ---------- 읽기 ---------- */
async function init(){
  if(R.students) return;
  try{ const c = await fetch("/config.json?t=" + Date.now()).then(r => r.json()); if(c.org) R.org = c.org; }catch(_){}
  try{ R.students = (await fetch("/students.json?t=" + Date.now()).then(r => r.json())).students || []; }catch(_){ R.students = []; }
}
/* 모든 소감 (최신 순) */
async function all(){
  await init();
  try{ return (await rpc("list_reviews", {})).map(norm); }catch(_){ return []; }
}
/* 이 게임에 달린 소감 */
const received = (A, repo) => (A || []).filter(x => x.to === repo).sort((a, b) => b.at.localeCompare(a.at));
/* 이 학생(게임 번호)이 친구 게임에 남긴 소감 */
const given = (A, repo) => (A || []).filter(x => x.from === repo && x.to !== repo).sort((a, b) => b.at.localeCompare(a.at));
/* 평균 별점: 한 사람(학번)은 그 게임에 남긴 마지막 별점만 세요 */
function average(tops){
  const v = tops.filter(t => t.stars && t.latest).map(t => t.stars);
  return v.length ? { avg:v.reduce((a, b) => a + b, 0) / v.length, n:v.length } : null;
}

/* ---------- 게임 페이지 화면 ---------- */
const RV_CSS = `
.rv{margin:34px 0 0}
.rv h2{font-size:19px;margin:0 0 6px}.rv h2 b{color:var(--cyan,#3ee6ff)}
.rv-sum{color:var(--muted,#9a96c8);font-size:14px;margin:0 0 14px}.rv-sum .st{color:#ffd166;font-size:17px;letter-spacing:1px}
.rv-box{background:var(--panel,#18153a);border:2px solid var(--line,#2e2a63);padding:14px 18px;margin:0 0 12px}
.rv-box.form{border-color:var(--pink,#ff4fa3)}
.rv-lbl{display:block;font-weight:700;font-size:14px;margin:10px 0 4px}.rv-lbl span{font-weight:400;color:var(--muted,#9a96c8);font-size:13px}
.rv textarea,.rv input,.rv select{font:inherit;font-size:14.5px;width:100%;background:#0d0b1e;color:var(--text,#ecebff);border:1px solid var(--line,#2e2a63);padding:8px 10px;border-radius:0;box-sizing:border-box}
.rv textarea{resize:vertical;min-height:58px}
.rv-id{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.rv-id .rv-lbl{margin-top:6px}
.rv-stars{display:flex;gap:2px}.rv-stars button{font-size:28px;line-height:1;background:none;border:0;color:#4a4680;cursor:pointer;padding:0 2px}.rv-stars button.on{color:#ffd166}
.rv-btn{font:inherit;font-size:14px;font-weight:700;cursor:pointer;background:var(--pink,#ff4fa3);color:#0d0b1e;border:0;padding:8px 16px}
.rv-btn:disabled{opacity:.6;cursor:default}
.rv-btn.ghost{background:none;color:var(--cyan,#3ee6ff);border:1px solid var(--line,#2e2a63);font-weight:400;padding:5px 12px}
.rv-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
.rv-msg{font-size:13.5px;color:var(--muted,#9a96c8);margin:8px 0 0}.rv-msg.err{color:#ff8a8a}.rv-msg.ok{color:var(--green,#4ade80)}
.rv-card{background:var(--panel,#18153a);border:2px solid var(--line,#2e2a63);padding:12px 16px;margin:0 0 10px}
.rv-head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}.rv-head b{font-size:15px}.rv-head .st{color:#ffd166;letter-spacing:1px}
.rv-head small{color:var(--muted,#9a96c8);font-size:12.5px}
.rv-p{margin:6px 0 0;font-size:14.5px;white-space:pre-wrap;word-break:break-word}.rv-p i{font-style:normal;color:var(--muted,#9a96c8);font-size:13px;margin-right:4px}
.rv-none{color:var(--muted,#9a96c8);font-size:14px}
.rv-tip{font-size:13px;color:var(--muted,#9a96c8);margin:4px 0 0;line-height:1.6}
.rv-dist{display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;align-items:center;max-width:320px;font-size:13px;color:var(--muted,#9a96c8);margin:0 0 14px}
.rv-dist .bar{height:8px;background:#0d0b1e;border:1px solid var(--line,#2e2a63)}.rv-dist .bar i{display:block;height:100%;background:#ffd166}
@media(max-width:560px){.rv-id{grid-template-columns:1fr}}`;

function mount(box, gameRepo){
  if(!document.getElementById("rvCss")){ const s = document.createElement("style"); s.id = "rvCss"; s.textContent = RV_CSS; document.head.appendChild(s); }
  const st = { stars:0, A:null, sent:false };
  const saved = (() => { try{ return JSON.parse(sessionStorage.getItem("rvId") || "{}"); }catch(_){ return {}; } })();

  function formHtml(){
    const opts = (R.students || []).map(s => `<option value="${esc(s.repo)}"${s.repo === saved.from ? " selected" : ""}>${esc(who(s.repo))}</option>`).join("");
    return `<div class="rv-box form">
      <div style="font-weight:800">✍️ 플레이 소감 남기기</div>
      <p class="rv-tip">학번과 이름은 선생님만 볼 수 있어요. 다른 친구에게는 이름 가운데가 가려져서(예: 김*수) 보여요.</p>
      <div class="rv-id">
        <div><label class="rv-lbl" for="rvFrom">🎮 내 게임 번호</label><select id="rvFrom" data-from><option value="">골라요</option>${opts}</select></div>
        <div><label class="rv-lbl" for="rvSid">🪪 학번</label><input id="rvSid" data-sid inputmode="numeric" maxlength="10" placeholder="예: 10101" autocomplete="off" value="${esc(saved.sid || "")}"></div>
        <div><label class="rv-lbl" for="rvName">🙂 이름</label><input id="rvName" data-name maxlength="20" placeholder="예: 홍길동" autocomplete="off" value="${esc(saved.name || "")}"></div>
      </div>
      <label class="rv-lbl">⭐ 별점 <span>5점 만점 · 재미있었던 만큼</span></label>
      <div class="rv-stars">${[1,2,3,4,5].map(n => `<button type="button" data-star="${n}" aria-label="별 ${n}개">★</button>`).join("")}</div>
      <label class="rv-lbl">👍 재미있던 요소 <span>어떤 순간이, 왜 재미있었나요?</span></label>
      <textarea data-good maxlength="${MAX}" placeholder="예: 적이 점점 빨라져서 마지막 10초가 정말 긴장됐어요"></textarea>
      <label class="rv-lbl">💡 추가되면 좋을 요소 <span>무엇을, 어떻게</span></label>
      <textarea data-idea maxlength="${MAX}" placeholder="예: 시작 화면에 ← → 키 그림이 있으면 조작법을 바로 알 것 같아요"></textarea>
      <div class="rv-row"><button class="rv-btn" type="button" data-send>소감 올리기</button><span class="rv-tip" data-ver></span></div>
      <p class="rv-msg" data-msg></p>
    </div>`;
  }
  function distHtml(tops){
    const v = tops.filter(t => t.stars && t.latest); if(!v.length) return "";
    const c = [5,4,3,2,1].map(n => v.filter(t => t.stars === n).length), mx = Math.max(...c);
    return `<div class="rv-dist">${[5,4,3,2,1].map((n, i) => `<span>${"★".repeat(n)}</span><span class="bar"><i style="width:${mx ? c[i] / mx * 100 : 0}%"></i></span><span>${c[i]}명</span>`).join("")}</div>`;
  }
  function cardHtml(t){
    return `<article class="rv-card">
      <div class="rv-head"><b>${esc(t.name || "익명")}</b><span class="st">${starTxt(t.stars || 0)}</span><small>${fmt(t.at)}${t.ver ? " · " + esc(t.ver) + " 플레이" : ""}</small></div>
      ${t.good ? `<p class="rv-p"><i>👍 재미있던 요소</i>\n${esc(t.good)}</p>` : ""}
      ${t.idea ? `<p class="rv-p"><i>💡 추가되면 좋을 요소</i>\n${esc(t.idea)}</p>` : ""}
    </article>`;
  }

  async function draw(reload){
    if(reload || !st.A){ box.innerHTML = `<section class="rv" id="reviews"><h2>💬 <b>플레이 소감</b></h2><p class="rv-none">불러오는 중…</p></section>`;
      await init(); try{ st.A = (await rpc("list_reviews", { p_game:gameRepo })).map(norm); }catch(e){ st.A = []; st.err = e.message; } }
    const tops = received(st.A, gameRepo), av = average(tops);
    box.innerHTML = `<section class="rv" id="reviews">
      <h2>💬 <b>플레이 소감</b></h2>
      <p class="rv-sum">${av ? `<span class="st">${starTxt(Math.round(av.avg))}</span> 평균 <b>${av.avg.toFixed(1)}</b>점 · ${av.n}명이 평가했어요 · ` : ""}소감 ${tops.length}개 <button class="rv-btn ghost" type="button" data-reload style="margin-left:6px">↻ 새로고침</button></p>
      ${distHtml(tops)}
      ${formHtml()}
      <div>${tops.length ? tops.map(cardHtml).join("") : `<p class="rv-none">${st.err ? esc(st.err) : "아직 소감이 없어요. 플레이해 보고 첫 소감을 남겨 주세요!"}</p>`}</div>
    </section>`;
    wire();
  }
  function wire(){
    const $ = s => box.querySelector(s);
    $("[data-reload]").onclick = () => draw(true);
    box.querySelectorAll("[data-star]").forEach(b => b.onclick = () => { st.stars = +b.dataset.star; box.querySelectorAll("[data-star]").forEach(x => x.classList.toggle("on", +x.dataset.star <= st.stars)); });
    const verEl = $("[data-ver]"); if(verEl) verEl.textContent = window.rvVersion ? `지금 플레이 중: ${window.rvVersion}` : "";
    box.querySelectorAll("textarea,input").forEach(t => t.addEventListener("keydown", e => e.stopPropagation()));
    const msg = $("[data-msg]");
    if(st.sent){ msg.textContent = "✅ 소감을 올렸어요. 고마워요!"; msg.className = "rv-msg ok"; st.sent = false; }
    $("[data-send]").onclick = async () => {
      const send = $("[data-send]"), from = $("[data-from]").value, sid = $("[data-sid]").value.replace(/\s/g, ""), name = $("[data-name]").value.trim();
      const good = $("[data-good]").value.trim(), idea = $("[data-idea]").value.trim();
      const err = t => { msg.textContent = t; msg.className = "rv-msg err"; };
      if(!from) return err("🎮 내 게임 번호를 골라 주세요.");
      if(from === gameRepo) return err("🙋 내 게임이에요! 내 게임에는 소감을 남길 수 없어요.");
      if(!/^\d{3,10}$/.test(sid)) return err("🪪 학번을 숫자로 써 주세요.");
      if(!name) return err("🙂 이름을 써 주세요.");
      if(!st.stars) return err("⭐ 별점을 골라 주세요.");
      if(good.length < 5) return err("👍 재미있던 요소를 한 문장 이상 써 주세요.");
      if(idea.length < 5) return err("💡 추가되면 좋을 요소를 한 문장 이상 써 주세요.");
      send.disabled = true; msg.textContent = "올리는 중…"; msg.className = "rv-msg";
      try{
        const row = await rpc("submit_review", { p_game:gameRepo, p_from:from, p_ver:window.rvVersion || "", p_student_id:sid, p_name:name,
          p_stars:st.stars, p_fun:good.slice(0, MAX), p_wish:idea.slice(0, MAX) });
        try{ sessionStorage.setItem("rvId", JSON.stringify({ from, sid, name })); Object.assign(saved, { from, sid, name }); }catch(_){}
        st.stars = 0; st.sent = true; draw(true);
      }catch(e){ err(e.message); send.disabled = false; }
    };
  }
  init().then(() => draw(true));
}

window.Reviews = { mount, all, received, given, average, who, init, starTxt, getKey };
})();
