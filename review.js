/* 💬 플레이 소감 · 댓글
   소감은 "쓴 사람" 저장소의 reviews/given.json에 저장해요. (자기 열쇠로 자기 저장소에만 쓰니까 새 권한이 필요 없어요)
   게임 페이지는 모든 학생 저장소의 given.json을 모아서 이 게임에 달린 소감만 보여 줘요.
   항목: { id, to(게임 저장소), ver, stars(1~5), good, idea, at }  · 답글: { id, to, reply(부모 id), text, at }
   - versions.html: Reviews.mount(상자, 게임 저장소)
   - 작성하기(5주차): Reviews.all() / received() / given() */
(function(){
const API = "https://api.github.com";
const RV_PATH = "reviews/given.json";
const MAX = 400;
const R = { org:"Ongo-gamedev2026", students:null };

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmt = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`; };
const who = repo => { const s = (R.students || []).find(x => x.repo === repo); return s ? `학생 ${s.no}` + (s.nickname ? ` · ${s.nickname}` : "") : repo; };
const starTxt = n => "★".repeat(n) + "☆".repeat(5 - n);

/* ---------- 열쇠 (write.js와 같은 이름으로 저장해요) ---------- */
const keyName = repo => "ghkey:" + repo;
function getKey(repo){ try{ return sessionStorage.getItem(keyName(repo)) || localStorage.getItem(keyName(repo)) || ""; }catch(_){ return ""; } }
function setKey(repo, k, remember){ try{ sessionStorage.setItem(keyName(repo), k); if(remember) localStorage.setItem(keyName(repo), k); }catch(_){} }
function clearKey(repo){ try{ sessionStorage.removeItem(keyName(repo)); localStorage.removeItem(keyName(repo)); }catch(_){} }
const b64bytes = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
async function codeToKey(repo, code){
  const c = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const r = await fetch("/keys.json?t=" + Date.now()); if(!r.ok) throw new Error("열쇠 목록을 불러오지 못했어요.");
  const j = await r.json(), e = j.keys && j.keys[repo];
  if(!e) throw new Error("이 학생 번호에는 아직 열쇠가 없어요. 선생님께 알려 주세요.");
  try{
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(c), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({ name:"PBKDF2", salt:b64bytes(e.salt), iterations:j.iter || 300000, hash:"SHA-256" }, base, { name:"AES-GCM", length:256 }, false, ["decrypt"]);
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name:"AES-GCM", iv:b64bytes(e.iv) }, key, b64bytes(e.ct)));
  }catch(_){ throw new Error("코드가 맞지 않아요. 내 번호를 골랐는지, 코드를 정확히 넣었는지 확인해 주세요."); }
}
async function connect(repo, input, remember){
  let k = input.trim(); if(!k) throw new Error("코드를 넣어 주세요.");
  if(!/^github_pat_|^ghp_/.test(k)) k = await codeToKey(repo, k);
  const r = await fetch(`${API}/repos/${R.org}/${repo}`, { headers:{ Authorization:"Bearer " + k, Accept:"application/vnd.github+json" }, cache:"no-store" });
  if(r.status === 401) throw new Error("열쇠 기간이 끝났거나 지워졌어요. 선생님께 알려 주세요.");
  if(!r.ok) throw new Error("이 코드로는 들어갈 수 없어요.");
  setKey(repo, k, remember);
}

/* ---------- base64 ---------- */
function b64enc(str){ const b = new TextEncoder().encode(str); let s = ""; for(let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
const b64dec = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), c => c.charCodeAt(0)));

/* ---------- 읽기 ---------- */
async function init(){
  if(R.students) return;
  try{ const c = await fetch("/config.json?t=" + Date.now()).then(r => r.json()); if(c.org) R.org = c.org; }catch(_){}
  try{ R.students = (await fetch("/students.json?t=" + Date.now()).then(r => r.json())).students || []; }catch(_){ R.students = []; }
}
/* 방금 쓴 내 소감은 GitHub 반영(최대 몇 분)을 기다리지 않고 바로 보여 줘요 */
const LOCAL = "rvlocal:";
function localOf(repo){ try{ const j = JSON.parse(sessionStorage.getItem(LOCAL + repo) || "null"); if(j && Date.now() - j.t < 10 * 60e3) return j.data; }catch(_){} return null; }
function keepLocal(repo, data){ try{ sessionStorage.setItem(LOCAL + repo, JSON.stringify({ t:Date.now(), data })); }catch(_){} }
async function readOne(repo){
  const loc = localOf(repo); if(loc) return loc.items || [];
  try{
    const r = await fetch(`https://raw.githubusercontent.com/${R.org}/${repo}/main/${RV_PATH}?t=${Date.now()}`, { cache:"no-store" });
    if(!r.ok) return [];
    const j = await r.json(); return Array.isArray(j.items) ? j.items : [];
  }catch(_){ return []; }
}
/* { "game-01": [그 학생이 쓴 소감·답글…], … } */
async function all(){
  await init();
  const lists = await Promise.all(R.students.map(s => readOne(s.repo)));
  const out = {}; R.students.forEach((s, i) => out[s.repo] = lists[i].filter(x => x && x.id && x.to).map(x => ({ ...x, from:s.repo })));
  return out;
}
const flat = A => Object.values(A).flat();
/* 이 게임에 달린 소감(답글 포함) */
function received(A, repo){
  const items = flat(A).filter(x => x.to === repo);
  const tops = items.filter(x => !x.reply).sort((a, b) => b.at.localeCompare(a.at));
  tops.forEach(t => t.replies = items.filter(x => x.reply === t.id).sort((a, b) => a.at.localeCompare(b.at)));
  return tops;
}
const given = (A, repo) => (A[repo] || []).filter(x => !x.reply && x.to !== repo).sort((a, b) => b.at.localeCompare(a.at));
function average(tops){
  const last = {}; tops.forEach(t => { if(t.stars && t.from !== t.to && !last[t.from]) last[t.from] = t.stars; });   // 한 사람은 마지막 별점만
  const v = Object.values(last); return v.length ? { avg:v.reduce((a, b) => a + b, 0) / v.length, n:v.length } : null;
}

/* ---------- 쓰기 (내 저장소의 given.json만 고쳐요) ---------- */
async function editMine(repo, fn){
  const k = getKey(repo); if(!k) throw new Error("열쇠가 없어요.");
  const H = { Authorization:"Bearer " + k, Accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28" };
  for(let tries = 0; tries < 3; tries++){
    const g = await fetch(`${API}/repos/${R.org}/${repo}/contents/${RV_PATH}?ref=main`, { headers:H, cache:"no-store" });
    let data = { _안내:"내가 친구 게임에 남긴 플레이 소감·답글이에요. 게임 페이지의 💬 칸에서 써요. 직접 고치지 마세요.", items:[] }, sha;
    if(g.status === 401) throw new Error("열쇠 기간이 끝났어요. 선생님께 알려 주세요.");
    if(g.ok){ const j = await g.json(); sha = j.sha; try{ data = JSON.parse(b64dec(j.content)); data.items = data.items || []; }catch(_){} }
    else if(g.status !== 404) throw new Error("저장소를 읽지 못했어요.");
    fn(data);
    const body = { message:"플레이 소감 저장 (게임 페이지에서)", content:b64enc(JSON.stringify(data, null, 2) + "\n"), branch:"main" };
    if(sha) body.sha = sha;
    const p = await fetch(`${API}/repos/${R.org}/${repo}/contents/${RV_PATH}`, { method:"PUT", headers:{ ...H, "Content-Type":"application/json" }, body:JSON.stringify(body) });
    if(p.status === 409 || p.status === 422) continue;
    if(p.status === 401 || p.status === 403 || p.status === 404) throw new Error("저장 권한이 없어요. 열쇠를 확인해 주세요.");
    if(!p.ok) throw new Error("저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
    keepLocal(repo, data); return data;
  }
  throw new Error("저장이 겹쳤어요. 다시 눌러 주세요.");
}
const newId = repo => `${repo}-${Date.now().toString(36)}`;

/* ---------- 게임 페이지 화면 ---------- */
const RV_CSS = `
.rv{margin:34px 0 0}
.rv h2{font-size:19px;margin:0 0 6px}.rv h2 b{color:var(--cyan,#3ee6ff)}
.rv-sum{color:var(--muted,#9a96c8);font-size:14px;margin:0 0 14px}.rv-sum .st{color:#ffd166;font-size:17px;letter-spacing:1px}
.rv-box{background:var(--panel,#18153a);border:2px solid var(--line,#2e2a63);padding:14px 18px;margin:0 0 12px}
.rv-box.form{border-color:var(--pink,#ff4fa3)}
.rv-lbl{display:block;font-weight:700;font-size:14px;margin:10px 0 4px}.rv-lbl span{font-weight:400;color:var(--muted,#9a96c8);font-size:13px}
.rv textarea,.rv input,.rv select{font:inherit;font-size:14.5px;width:100%;background:#0d0b1e;color:var(--text,#ecebff);border:1px solid var(--line,#2e2a63);padding:8px 10px;border-radius:0}
.rv textarea{resize:vertical;min-height:58px}
.rv-stars{display:flex;gap:2px}.rv-stars button{font-size:28px;line-height:1;background:none;border:0;color:#4a4680;cursor:pointer;padding:0 2px}.rv-stars button.on{color:#ffd166}
.rv-btn{font:inherit;font-size:14px;font-weight:700;cursor:pointer;background:var(--pink,#ff4fa3);color:#0d0b1e;border:0;padding:8px 16px}
.rv-btn.ghost{background:none;color:var(--cyan,#3ee6ff);border:1px solid var(--line,#2e2a63);font-weight:400;padding:5px 12px}
.rv-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
.rv-msg{font-size:13.5px;color:var(--muted,#9a96c8);margin:8px 0 0}.rv-msg.err{color:#ff8a8a}.rv-msg.ok{color:var(--green,#4ade80)}
.rv-me{font-size:13.5px;color:var(--muted,#9a96c8)}.rv-me b{color:var(--text,#ecebff)}
.rv-key{display:grid;grid-template-columns:140px 1fr auto;gap:8px;margin-top:6px}.rv-key select,.rv-key input{width:auto;min-width:0}
.rv-card{background:var(--panel,#18153a);border:2px solid var(--line,#2e2a63);padding:12px 16px;margin:0 0 10px}
.rv-card.mine{border-color:#5a4fd0}
.rv-head{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline}.rv-head b{font-size:15px}.rv-head .st{color:#ffd166;letter-spacing:1px}
.rv-head small{color:var(--muted,#9a96c8);font-size:12.5px}.rv-head .sp{margin-left:auto;display:flex;gap:6px}
.rv-p{margin:6px 0 0;font-size:14.5px;white-space:pre-wrap;word-break:break-word}.rv-p i{font-style:normal;color:var(--muted,#9a96c8);font-size:13px;margin-right:4px}
.rv-rep{margin:10px 0 0 14px;padding-left:12px;border-left:3px solid var(--line,#2e2a63)}
.rv-rep .rv-p{margin:2px 0 8px}.rv-rep .owner{color:var(--pink,#ff4fa3)}
.rv-none{color:var(--muted,#9a96c8);font-size:14px}
.rv-tip{font-size:13px;color:var(--muted,#9a96c8);margin:4px 0 0;line-height:1.6}
@media(max-width:560px){.rv-key{grid-template-columns:1fr}}`;

function mount(box, gameRepo){
  if(!document.getElementById("rvCss")){ const s = document.createElement("style"); s.id = "rvCss"; s.textContent = RV_CSS; document.head.appendChild(s); }
  const st = { me:"", stars:0, A:null };
  try{ st.me = sessionStorage.getItem("rvMe") || ""; }catch(_){}

  const mine = () => (R.students || []).filter(s => getKey(s.repo));
  const pickMe = () => { const m = mine(); if(!m.some(s => s.repo === st.me)) st.me = m.length ? m[0].repo : ""; return st.me; };

  function formHtml(){
    const me = pickMe(), owner = me === gameRepo, m = mine();
    const meLine = me ? `<div class="rv-row rv-me">✍️ <b>${esc(who(me))}</b>(으)로 쓰고 있어요
        ${m.length > 1 ? `<select data-me style="width:auto">${m.map(s => `<option value="${esc(s.repo)}"${s.repo === me ? " selected" : ""}>${esc(who(s.repo))}</option>`).join("")}</select>` : ""}
        <button class="rv-btn ghost" type="button" data-other>다른 학생으로</button></div>` : "";
    const keyForm = `<div data-keyform${me ? " hidden" : ""}>
        <p class="rv-tip">소감을 쓰려면 <b>내 번호</b>를 고르고 선생님께 받은 <b>내 코드</b>를 넣어요. (소감은 내 저장소에 저장돼요)</p>
        <div class="rv-key"><select data-kno>${(R.students || []).map(s => `<option value="${esc(s.repo)}">${esc(who(s.repo))}</option>`).join("")}</select>
          <input data-kcode placeholder="ABCD-1234" autocomplete="off" spellcheck="false" aria-label="내 코드"><button class="rv-btn" type="button" data-kok>확인</button></div>
        <label class="rv-tip" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-krem style="width:auto"> 이 컴퓨터에 기억하기 (내 컴퓨터일 때만)</label>
        <p class="rv-msg" data-kmsg></p></div>`;
    if(owner) return `<div class="rv-box">${meLine}<p class="rv-tip" style="margin-top:8px">🙋 내 게임이에요! 별점은 줄 수 없지만, 친구 소감마다 <b>💬 답글</b>로 고마운 마음이나 고칠 계획을 남길 수 있어요.</p>${keyForm}</div>`;
    return `<div class="rv-box form">
      <div style="font-weight:800">✍️ 플레이 소감 남기기</div>
      ${meLine}${keyForm}
      <div data-write${me ? "" : " hidden"}>
        <label class="rv-lbl">⭐ 별점 <span>재미있었던 만큼</span></label>
        <div class="rv-stars">${[1,2,3,4,5].map(n => `<button type="button" data-star="${n}" aria-label="별 ${n}개">★</button>`).join("")}</div>
        <label class="rv-lbl">👍 좋았던 점 <span>(꼭 써요) 어떤 순간이 재미있었나요?</span></label>
        <textarea data-good maxlength="${MAX}" placeholder="예: 적이 점점 빨라져서 마지막 10초가 정말 긴장됐어요"></textarea>
        <label class="rv-lbl">💡 아쉬운 점 · 이렇게 하면 더 좋겠어요 <span>(선택) 무엇을, 어떻게</span></label>
        <textarea data-idea maxlength="${MAX}" placeholder="예: 처음엔 조작법을 몰라서 헤맸어요. 시작 화면에 ← → 키 그림이 있으면 좋겠어요"></textarea>
        <div class="rv-row"><button class="rv-btn" type="button" data-send>소감 올리기</button><span class="rv-tip" data-ver></span></div>
        <p class="rv-msg" data-msg></p>
      </div></div>`;
  }
  function cardHtml(t){
    const me = pickMe(), isMine = t.from === me;
    const reps = (t.replies || []).map(r => `<div><div class="rv-head"><b class="${r.from === gameRepo ? "owner" : ""}">${esc(who(r.from))}${r.from === gameRepo ? " (만든 사람)" : ""}</b><small>${fmt(r.at)}</small>
        ${r.from === me ? `<span class="sp"><button class="rv-btn ghost" type="button" data-del="${esc(r.id)}">삭제</button></span>` : ""}</div><p class="rv-p">${esc(r.text)}</p></div>`).join("");
    return `<article class="rv-card${isMine ? " mine" : ""}">
      <div class="rv-head"><b>${esc(who(t.from))}</b>${t.stars ? `<span class="st">${starTxt(t.stars)}</span>` : ""}<small>${fmt(t.at)}${t.ver ? " · " + esc(t.ver) + " 플레이" : ""}</small>
        <span class="sp">${me ? `<button class="rv-btn ghost" type="button" data-rep="${esc(t.id)}">💬 답글</button>` : ""}${isMine ? `<button class="rv-btn ghost" type="button" data-del="${esc(t.id)}">삭제</button>` : ""}</span></div>
      ${t.good ? `<p class="rv-p"><i>👍</i>${esc(t.good)}</p>` : ""}
      ${t.idea ? `<p class="rv-p"><i>💡</i>${esc(t.idea)}</p>` : ""}
      ${reps || (t.replies || []).length ? `<div class="rv-rep">${reps}</div>` : ""}
      <div data-repbox="${esc(t.id)}" hidden class="rv-rep"><textarea maxlength="${MAX}" placeholder="답글을 써요 (예: 고마워! 다음 버전에서 조작법 그림을 넣어 볼게)"></textarea>
        <div class="rv-row"><button class="rv-btn" type="button" data-repsend="${esc(t.id)}">답글 올리기</button><span class="rv-msg" data-repmsg></span></div></div>
    </article>`;
  }

  async function draw(reload){
    if(reload || !st.A){ box.innerHTML = `<section class="rv"><h2>💬 <b>플레이 소감 · 댓글</b></h2><p class="rv-none">불러오는 중…</p></section>`; st.A = await all(); }
    const tops = received(st.A, gameRepo), av = average(tops);
    box.innerHTML = `<section class="rv" id="reviews">
      <h2>💬 <b>플레이 소감 · 댓글</b></h2>
      <p class="rv-sum">${av ? `<span class="st">${starTxt(Math.round(av.avg))}</span> 평균 <b>${av.avg.toFixed(1)}</b> · ${av.n}명이 별점을 줬어요 · ` : ""}소감 ${tops.length}개 <button class="rv-btn ghost" type="button" data-reload style="margin-left:6px">↻ 새로고침</button></p>
      ${formHtml()}
      <div>${tops.length ? tops.map(cardHtml).join("") : `<p class="rv-none">아직 소감이 없어요. 플레이해 보고 첫 소감을 남겨 주세요!</p>`}</div>
      <p class="rv-tip">친구가 쓴 소감은 반영까지 몇 분 걸릴 수 있어요. 안 보이면 ↻ 새로고침을 눌러요.</p>
    </section>`;
    wire();
  }
  function wire(){
    const $ = s => box.querySelector(s);
    $("[data-reload]").onclick = () => draw(true);
    const sel = $("[data-me]"); if(sel) sel.onchange = () => { st.me = sel.value; try{ sessionStorage.setItem("rvMe", st.me); }catch(_){} draw(); };
    const other = $("[data-other]"); if(other) other.onclick = () => { $("[data-keyform]").hidden = false; const w = $("[data-write]"); if(w) w.hidden = true; other.hidden = true; };
    const kok = $("[data-kok]");
    if(kok){
      const kno = $("[data-kno]"), kcode = $("[data-kcode]"), kmsg = $("[data-kmsg]");
      const others = (R.students || []).filter(s => s.repo !== gameRepo);
      if(others[0] && !st.me) kno.value = others[0].repo;
      const go = async () => { kmsg.textContent = "코드를 확인하는 중…"; kmsg.className = "rv-msg";
        try{ await connect(kno.value, kcode.value, $("[data-krem]").checked); st.me = kno.value; try{ sessionStorage.setItem("rvMe", st.me); }catch(_){} draw(); }
        catch(e){ kmsg.textContent = e.message; kmsg.className = "rv-msg err"; } };
      kok.onclick = go; kcode.onkeydown = e => { e.stopPropagation(); if(e.key === "Enter") go(); };
    }
    box.querySelectorAll("[data-star]").forEach(b => b.onclick = () => { st.stars = +b.dataset.star; box.querySelectorAll("[data-star]").forEach(x => x.classList.toggle("on", +x.dataset.star <= st.stars)); });
    if(st.stars) box.querySelectorAll("[data-star]").forEach(x => x.classList.toggle("on", +x.dataset.star <= st.stars));
    const verEl = $("[data-ver]"); if(verEl) verEl.textContent = window.rvVersion ? `지금 플레이 중: ${window.rvVersion}` : "";
    box.querySelectorAll("textarea").forEach(t => t.addEventListener("keydown", e => e.stopPropagation()));
    const send = $("[data-send]");
    if(send) send.onclick = async () => {
      const msg = $("[data-msg]"), good = $("[data-good]").value.trim(), idea = $("[data-idea]").value.trim();
      if(!st.stars){ msg.textContent = "⭐ 별점을 먼저 골라 주세요."; msg.className = "rv-msg err"; return; }
      if(good.length < 5){ msg.textContent = "👍 좋았던 점을 한 문장 이상 써 주세요."; msg.className = "rv-msg err"; return; }
      send.disabled = true; msg.textContent = "올리는 중…"; msg.className = "rv-msg";
      const me = pickMe(), item = { id:newId(me), to:gameRepo, ver:window.rvVersion || "", stars:st.stars, good:good.slice(0, MAX), idea:idea.slice(0, MAX), at:new Date().toISOString() };
      try{ const d = await editMine(me, d => d.items.push(item)); st.A[me] = d.items.map(x => ({ ...x, from:me })); st.stars = 0; draw(); }
      catch(e){ msg.textContent = e.message; msg.className = "rv-msg err"; send.disabled = false; }
    };
    box.querySelectorAll("[data-rep]").forEach(b => b.onclick = () => { const r = box.querySelector(`[data-repbox="${CSS.escape(b.dataset.rep)}"]`); r.hidden = !r.hidden; if(!r.hidden) r.querySelector("textarea").focus(); });
    box.querySelectorAll("[data-repsend]").forEach(b => b.onclick = async () => {
      const wrap = b.closest("[data-repbox]"), ta = wrap.querySelector("textarea"), m = wrap.querySelector("[data-repmsg]");
      const text = ta.value.trim(); if(text.length < 2){ m.textContent = "답글을 써 주세요."; m.className = "rv-msg err"; return; }
      b.disabled = true; m.textContent = "올리는 중…"; m.className = "rv-msg";
      const me = pickMe(), item = { id:newId(me), to:gameRepo, reply:b.dataset.repsend, text:text.slice(0, MAX), at:new Date().toISOString() };
      try{ const d = await editMine(me, d => d.items.push(item)); st.A[me] = d.items.map(x => ({ ...x, from:me })); draw(); }
      catch(e){ m.textContent = e.message; m.className = "rv-msg err"; b.disabled = false; }
    });
    box.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
      if(!confirm("이 글을 지울까요?")) return;
      const me = pickMe(), id = b.dataset.del; b.disabled = true;
      try{ const d = await editMine(me, d => { d.items = d.items.filter(x => x.id !== id); }); st.A[me] = d.items.map(x => ({ ...x, from:me })); draw(); }
      catch(e){ alert(e.message); b.disabled = false; }
    });
  }
  init().then(() => draw(true));
}

window.Reviews = { mount, all, received, given, average, who, init, starTxt, getKey };
})();
