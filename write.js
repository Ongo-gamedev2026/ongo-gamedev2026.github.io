/* 작성하기 페이지
   학생 저장소의 md 문서를 입력칸이 있는 양식으로 보여 주고,
   저장하면 GitHub에 커밋, 제출하면 weekN-vN 릴리스를 만들어요.
   열쇠(fine-grained 토큰)는 학생 저장소 하나에만 쓸 수 있는 것을 사용해요. */
(function(){
const API = "https://api.github.com";
const W = { segs:[], dirty:false, sha:null, st:null, w:null, doc:null, busy:false };

/* ---------- 열쇠(토큰) ---------- */
const keyName = repo => "ghkey:" + repo;
function getKey(repo){
  try{ return sessionStorage.getItem(keyName(repo)) || localStorage.getItem(keyName(repo)) || ""; }catch(_){ return ""; }
}
function setKey(repo, k, remember){
  try{ sessionStorage.setItem(keyName(repo), k); if(remember) localStorage.setItem(keyName(repo), k); }catch(_){}
}
function clearKey(repo){
  try{ sessionStorage.removeItem(keyName(repo)); localStorage.removeItem(keyName(repo)); }catch(_){}
}
async function gh(path, opt = {}){
  const k = getKey(W.st.repo);
  const headers = { Accept:"application/vnd.github+json", "X-GitHub-Api-Version":"2022-11-28", ...(opt.headers||{}) };
  if(k) headers.Authorization = "Bearer " + k;
  return fetch(API + path, { ...opt, headers, cache:"no-store" });
}
const repoPath = () => `/repos/${S.cfg.org}/${W.st.repo}`;

/* ---------- base64 (UTF-8) ---------- */
function b64enc(str){
  const bytes = new TextEncoder().encode(str); let bin = "";
  for(let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64dec(b64){
  const bin = atob(b64.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

/* ---------- md → 조각 ---------- */
const isBlockStart = l => /^(#|>|\||[-*] |[-*]$|```|---|<|\d+\. )/.test(l);
const escLead = l => isBlockStart(l) ? "\\" + l : l;
const unescLead = l => l.replace(/^\\(?=[#>|\-*`<\d])/, "");
const PH = /^\((예[:：]\s*)?[^()]*\)$|^\d{4}\. ?\d{1,2}\. ?__$/;   // (이름), (예: 벽돌깨기), 2026. 10. __ 같은 자리표시
const reChk = /^(\s*[-*] )\[( |x|X)\][ ]?(.*)$/;
const reLabel = /^([-*] )(?!\[[ xX]\])((?:(?![:：]).){1,40}[:：])[ ]?(.*)$/;

function splitRow(line){
  let s = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  const cells = []; let cur = "";
  for(let i = 0; i < s.length; i++){
    if(s[i] === "\\" && s[i+1] === "|"){ cur += "\\|"; i++; continue; }
    if(s[i] === "|"){ cells.push(cur.trim()); cur = ""; continue; }
    cur += s[i];
  }
  cells.push(cur.trim()); return cells;
}
const cellToVal = c => c.replace(/<br\s*\/?>/gi, "\n").replace(/\\\|/g, "|");
const valToCell = v => v.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>");

function parseTable(lines){
  const head = splitRow(lines[0]);
  const exCols = head.map(h => /예시/.test(h));
  const rows = lines.slice(2).map(l => {
    const raw = splitRow(l); while(raw.length < head.length) raw.push("");
    const exRow = /^예\s*[:：]/.test(raw[0]);
    return raw.slice(0, head.length).map((c, ci) => {
      const ro = exRow || exCols[ci] || /\*\*/.test(c);
      if(ro) return { ro:true, text:c };
      const v = cellToVal(c);
      return PH.test(v.trim()) ? { ro:false, ph:v.trim(), val:"" } : { ro:false, ph:"", val:v };
    });
  });
  const last = rows[rows.length-1];
  return { t:"table", headLine:lines[0], sepLine:lines[1], head, rows, canAdd: !!last && last.every(c => !c.ro) };
}

function isFree(l){
  if(!/^[-*]( |$)/.test(l)) return false;
  const c = l.match(reChk); if(c) return !c[3].trim();
  return !reLabel.test(l);
}
const freeText = l => unescLead(l.replace(/^[-*] ?/, "").replace(/^\[[ xX]\] ?/, "")).trim();

function parseMd(md){
  const L = md.replace(/\r\n/g, "\n").split("\n");
  const segs = []; let raw = [];
  const flush = () => { if(raw.length){ segs.push({ t:"raw", lines:raw }); raw = []; } };
  let i = 0;
  while(i < L.length){
    const l = L[i]; let m;
    if(/^```/.test(l)){
      let j = i + 1; while(j < L.length && !/^```\s*$/.test(L[j])) j++;
      const body = L.slice(i + 1, j).join("\n");
      flush(); segs.push({ t:"code", open:l, close:"```", ph: PH.test(body.trim()) ? body.trim() : "", val: PH.test(body.trim()) ? "" : body });
      i = j + 1; continue;
    }
    if(/^\|/.test(l) && i + 1 < L.length && /^\|[\s:|-]+\|?\s*$/.test(L[i+1])){
      let j = i + 2; while(j < L.length && /^\|/.test(L[j])) j++;
      flush(); segs.push(parseTable(L.slice(i, j))); i = j; continue;
    }
    if((m = l.match(/^(\*\*[^*\n]+?[:：]\*\*)[ ]?(.*)$/) || l.match(/^(답\s*[:：])[ ]?(.*)$/))){
      const vals = [m[2]]; let j = i + 1;
      while(j < L.length && L[j].trim() && !isBlockStart(L[j])){ vals.push(L[j]); j++; }
      flush(); segs.push({ t:"ans", label:m[1], val: vals.map(v => unescLead(v.replace(/\s+$/, ""))).join("\n").trim() });
      i = j; continue;
    }
    if((m = l.match(reChk)) && m[3].trim()){ flush(); segs.push({ t:"chk", pre:m[1], on:m[2] !== " ", text:m[3] }); i++; continue; }
    if((m = l.match(reLabel))){ flush(); segs.push({ t:"field", pre:m[1], label:m[2], val:m[3].trim() }); i++; continue; }
    if(isFree(l)){
      const items = []; let j = i;
      while(j < L.length && isFree(L[j])){ items.push(freeText(L[j])); j++; }
      flush(); segs.push({ t:"list", val: items.filter(Boolean).join("\n") }); i = j; continue;
    }
    raw.push(l); i++;
  }
  flush(); return segs;
}

/* ---------- 조각 → md ---------- */
function toMd(){
  const out = [];
  for(const s of W.segs){
    if(s.t === "raw") out.push(...s.lines);
    else if(s.t === "code") out.push(s.open, (s.val.replace(/\s+$/, "") || s.ph), s.close);
    else if(s.t === "table"){
      out.push(s.headLine, s.sepLine);
      s.rows.forEach(r => out.push("| " + r.map(c => c.ro ? c.text : (valToCell(c.val.trim()) || c.ph)).join(" | ") + " |"));
    }
    else if(s.t === "ans"){
      const lines = s.val.split("\n").map(x => x.trim()).filter(Boolean);
      out.push(lines.length ? [s.label + " " + lines[0], ...lines.slice(1).map(escLead)].join("  \n") : s.label);
    }
    else if(s.t === "chk") out.push(`${s.pre}[${s.on ? "x" : " "}] ${s.text}`);
    else if(s.t === "field") out.push(s.pre + s.label + (s.val.trim() ? " " + s.val.replace(/\s*\n\s*/g, " ").trim() : ""));
    else if(s.t === "list"){
      const items = s.val.split("\n").map(x => x.trim()).filter(Boolean);
      out.push(...(items.length ? items.map(x => "- " + x) : ["- "]));
    }
  }
  return out.join("\n");
}

/* ---------- 화면 ---------- */
const mdHtml = t => DOMPurify.sanitize(marked.parse(t, { gfm:true, breaks:true }));
const inl = t => DOMPurify.sanitize(marked.parseInline(t, { gfm:true }));
function grow(el){ el.style.height = "auto"; el.style.height = (el.scrollHeight + 2) + "px"; }
function ta(val, ph, cls, onIn){
  const el = document.createElement("textarea");
  el.className = cls; el.rows = 1; el.value = val; el.placeholder = ph || "";
  el.addEventListener("input", () => { onIn(el.value); grow(el); markDirty(); });
  requestAnimationFrame(() => grow(el));
  return el;
}

function renderSegs(box){
  box.innerHTML = "";
  W.segs.forEach(s => {
    if(s.t === "raw"){
      const d = document.createElement("div"); d.className = "md wr-raw"; d.innerHTML = mdHtml(s.lines.join("\n"));
      d.querySelectorAll("p").forEach(p => { if(/^예\s*[:：)]/.test(p.textContent.trim())) p.classList.add("ex"); });
      d.querySelectorAll("a").forEach(a => { a.target = "_blank"; a.rel = "noopener"; });
      d.querySelectorAll("blockquote").forEach(b => { if(/작성 방법|Commit changes/.test(b.textContent)) b.remove(); });
      if(d.textContent.trim() || d.querySelector("img,hr,table")) box.appendChild(d);
      return;
    }
    if(s.t === "ans"){
      const d = document.createElement("div"); d.className = "wr-ans";
      d.innerHTML = `<div class="wr-label">${inl(s.label)}</div>`;
      d.appendChild(ta(s.val, "여기에 적어요", "wr-in", v => s.val = v));
      box.appendChild(d); return;
    }
    if(s.t === "field"){
      const d = document.createElement("label"); d.className = "wr-field";
      d.innerHTML = `<span class="wr-label">${inl(s.label)}</span>`;
      d.appendChild(ta(s.val, "", "wr-in", v => s.val = v));
      box.appendChild(d); return;
    }
    if(s.t === "list"){
      const d = document.createElement("div"); d.className = "wr-list";
      d.appendChild(ta(s.val, "한 줄에 하나씩 적어요 (Enter로 줄 바꾸기)", "wr-in", v => s.val = v));
      box.appendChild(d); return;
    }
    if(s.t === "code"){
      const d = document.createElement("div"); d.className = "wr-code";
      d.appendChild(ta(s.val, s.ph || "여기에 붙여 넣어요", "wr-in mono", v => s.val = v));
      box.appendChild(d); return;
    }
    if(s.t === "chk"){
      const d = document.createElement("label"); d.className = "wr-chk";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = s.on;
      cb.onchange = () => { s.on = cb.checked; markDirty(); };
      d.appendChild(cb); d.insertAdjacentHTML("beforeend", `<span>${inl(s.text)}</span>`);
      box.appendChild(d); return;
    }
    if(s.t === "table"){
      const wrap = document.createElement("div"); wrap.className = "wr-table";
      const tb = document.createElement("table");
      tb.innerHTML = `<thead><tr>${s.head.map(h => `<th>${inl(h)}</th>`).join("")}</tr></thead>`;
      const body = document.createElement("tbody");
      const addRow = r => {
        const tr = document.createElement("tr");
        r.forEach(c => {
          const td = document.createElement("td");
          if(c.ro){ td.className = /^예\s*[:：]/.test(r[0].text || "") ? "ro ex" : "ro"; td.innerHTML = inl(c.text); }
          else { td.className = "in"; td.appendChild(ta(c.val, c.ph, "wr-cell", v => c.val = v)); }
          tr.appendChild(td);
        });
        body.appendChild(tr);
      };
      s.rows.forEach(addRow);
      tb.appendChild(body); wrap.appendChild(tb);
      if(s.canAdd){
        const b = document.createElement("button"); b.type = "button"; b.className = "wr-add"; b.textContent = "+ 줄 추가";
        b.onclick = () => { const r = s.head.map(() => ({ ro:false, ph:"", val:"" })); s.rows.push(r); addRow(r); markDirty(); };
        wrap.appendChild(b);
      }
      box.appendChild(wrap);
    }
  });
}

/* ---------- 상태 표시 ---------- */
function setStatus(msg, kind){
  const el = document.getElementById("wrStatus"); if(!el) return;
  el.textContent = msg; el.className = "wr-status " + (kind || "");
}
function markDirty(){ if(!W.dirty){ W.dirty = true; setStatus("저장하지 않은 내용이 있어요", "warn"); } }
window.addEventListener("beforeunload", e => { if(W.dirty){ e.preventDefault(); e.returnValue = ""; } });

/* ---------- 불러오기 / 저장 / 제출 ---------- */
async function load(){
  const box = document.getElementById("wrDoc");
  box.innerHTML = `<div class="empty">문서를 불러오는 중…</div>`;
  W.dirty = false; W.sha = null;
  let text = null;
  try{
    if(getKey(W.st.repo)){
      const r = await gh(`${repoPath()}/contents/${encodeURI(W.doc.path)}?ref=main`);
      if(r.status === 401){ clearKey(W.st.repo); drawKey("열쇠가 맞지 않거나 기간이 끝났어요. 다시 넣어 주세요."); return load(); }
      if(r.ok){ const j = await r.json(); W.sha = j.sha; text = b64dec(j.content); }
      else if(r.status !== 404) throw new Error(r.status);
    }else{
      const r = await fetch(rawUrl(W.st, "main", W.doc.path) + "?t=" + Date.now());
      if(r.ok) text = await r.text(); else if(r.status !== 404) throw new Error(r.status);
    }
  }catch(e){ box.innerHTML = `<div class="empty">문서를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</div>`; return; }
  if(text == null){ box.innerHTML = `<div class="empty">아직 문서가 없어요. 선생님께 알려 주세요.</div>`; return; }
  W.segs = parseMd(text);
  renderSegs(box);
  setStatus(getKey(W.st.repo) ? "불러왔어요" : "열쇠를 넣으면 저장할 수 있어요", "");
}

async function save(quiet){
  if(!getKey(W.st.repo)){ setStatus("먼저 위에서 열쇠를 넣어 주세요", "err"); document.getElementById("wrKey").scrollIntoView({ behavior:"smooth" }); return false; }
  if(W.busy) return false;
  W.busy = true; setStatus("저장하는 중…", "");
  try{
    if(!W.sha){
      const g = await gh(`${repoPath()}/contents/${encodeURI(W.doc.path)}?ref=main`);
      if(g.ok) W.sha = (await g.json()).sha;
    }
    const body = { message:`${W.w.week}주차 ${W.doc.name} 저장 (사이트에서)`, content:b64enc(toMd()), branch:"main" };
    if(W.sha) body.sha = W.sha;
    const r = await gh(`${repoPath()}/contents/${encodeURI(W.doc.path)}`, { method:"PUT", body:JSON.stringify(body), headers:{ "Content-Type":"application/json" } });
    if(r.status === 409 || r.status === 422){ setStatus("다른 곳에서 이 문서가 바뀌었어요. 내 내용을 복사해 두고 새로고침해 주세요.", "err"); return false; }
    if(r.status === 401 || r.status === 403 || r.status === 404){ setStatus("저장 권한이 없어요. 열쇠를 확인해 주세요.", "err"); return false; }
    if(!r.ok) throw new Error(r.status);
    W.sha = (await r.json()).content.sha; W.dirty = false;
    const t = new Date(); setStatus(`저장했어요 · ${t.getHours()}:${String(t.getMinutes()).padStart(2, "0")}`, "ok");
    return true;
  }catch(e){ setStatus("저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.", "err"); return false; }
  finally{ W.busy = false; }
}

async function nextVersion(){
  const r = await gh(`${repoPath()}/releases?per_page=100`);
  if(!r.ok) throw new Error(r.status);
  const re = new RegExp(`^week${W.w.week}-v(\\d+)$`);
  return (await r.json()).reduce((m, x) => { const k = re.exec(x.tag_name || ""); return k ? Math.max(m, +k[1]) : m; }, 0) + 1;
}

async function openSubmit(){
  if(!getKey(W.st.repo)){ setStatus("먼저 위에서 열쇠를 넣어 주세요", "err"); document.getElementById("wrKey").scrollIntoView({ behavior:"smooth" }); return; }
  let v;
  try{ v = await nextVersion(); }catch(e){ setStatus("제출 기록을 확인하지 못했어요. 열쇠를 확인해 주세요.", "err"); return; }
  const memo = W.w.game ? "## 🛠 패치노트\n- 바뀐 점: \n- 고친 버그: \n- 다음 버전에서 할 일: " : "## 📝 제출 메모\n- 이번에 쓴 내용: \n- 선생님께 질문: ";
  const dlg = document.createElement("div"); dlg.className = "wr-modal";
  dlg.innerHTML = `<div class="wr-dialog" role="dialog" aria-modal="true">
    <h3>📮 ${W.w.week}주차 v${v} 제출하기</h3>
    <p>지금 저장된 내용이 <b>v${v}</b>로 제출돼요. 제출한 버전은 바꿀 수 없고, 고치고 싶으면 다음에 v${v + 1}로 다시 제출하면 돼요.</p>
    <label class="wr-label">${W.w.game ? "패치노트" : "제출 메모"}</label>
    <textarea class="wr-in" rows="5"></textarea>
    <div class="btns" style="justify-content:flex-end;margin-top:12px">
      <button class="btn" data-x>취소</button><button class="btn primary" data-go>v${v} 제출하기</button>
    </div><p class="wr-status" data-msg></p></div>`;
  document.body.appendChild(dlg);
  const memoEl = dlg.querySelector("textarea"); memoEl.value = memo;
  const close = () => dlg.remove();
  dlg.querySelector("[data-x]").onclick = close;
  dlg.onclick = e => { if(e.target === dlg) close(); };
  dlg.querySelector("[data-go]").onclick = async ev => {
    const btn = ev.currentTarget, msg = dlg.querySelector("[data-msg]");
    btn.disabled = true; msg.textContent = "제출하는 중…";
    if(W.dirty && !(await save(true))){ msg.textContent = "저장에 실패해서 제출하지 않았어요."; btn.disabled = false; return; }
    try{
      const r = await gh(`${repoPath()}/releases`, { method:"POST", headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({ tag_name:`week${W.w.week}-v${v}`, target_commitish:"main", name:`${W.w.week}주차 v${v} 제출`, body:memoEl.value }) });
      if(r.status === 422){ msg.textContent = `이미 v${v}가 제출되어 있어요. 창을 닫고 다시 눌러 주세요.`; btn.disabled = false; return; }
      if(!r.ok) throw new Error(r.status);
      dlg.querySelector(".wr-dialog").innerHTML = `<h3>🎉 v${v} 제출 완료!</h3><p>메인 사이트 액자에는 최대 1시간 뒤에 표시돼요.</p>
        <div class="btns" style="justify-content:flex-end"><button class="btn primary" data-x>확인</button></div>`;
      dlg.querySelector("[data-x]").onclick = close;
      setStatus(`v${v} 제출했어요`, "ok");
    }catch(e){ msg.textContent = "제출하지 못했어요. 열쇠 권한(Contents 읽기·쓰기)을 확인해 주세요."; btn.disabled = false; }
  };
}

/* ---------- 열쇠 상자 ---------- */
function drawKey(notice){
  const el = document.getElementById("wrKey"); if(!el) return;
  const k = getKey(W.st.repo);
  if(k){
    el.className = "wr-key on";
    el.innerHTML = `<span>🔑 열쇠가 연결되어 있어요. 저장하면 내 저장소(${esc(W.st.repo)})에 바로 기록돼요.</span>
      <button class="btn" data-out>열쇠 빼기</button>`;
    el.querySelector("[data-out]").onclick = () => { clearKey(W.st.repo); drawKey("열쇠를 뺐어요. 공용 컴퓨터라면 꼭 빼 두세요."); setStatus("열쇠를 넣으면 저장할 수 있어요", ""); };
    if(notice) el.insertAdjacentHTML("beforeend", `<p class="hint">${esc(notice)}</p>`);
    return;
  }
  el.className = "wr-key";
  el.innerHTML = `<div class="wr-key-title">🔑 내 열쇠 넣기</div>
    <p class="hint" style="margin:0 0 8px">선생님께 받은 열쇠(github_pat_로 시작)를 붙여 넣으면 이 화면에서 바로 저장·제출할 수 있어요.</p>
    <div class="wr-key-row"><input type="password" autocomplete="off" placeholder="github_pat_…" aria-label="열쇠">
    <button class="btn primary" data-ok>확인</button></div>
    <label class="wr-remember"><input type="checkbox"> 이 컴퓨터에 기억하기 (내 컴퓨터일 때만 체크)</label>
    <p class="wr-status" data-msg>${esc(notice || "")}</p>`;
  const inp = el.querySelector("input"), msg = el.querySelector("[data-msg]");
  const go = async () => {
    const k2 = inp.value.trim(); if(!k2) return;
    msg.textContent = "열쇠를 확인하는 중…"; msg.className = "wr-status";
    try{
      const r = await fetch(`${API}${repoPath()}`, { headers:{ Authorization:"Bearer " + k2, Accept:"application/vnd.github+json" }, cache:"no-store" });
      if(r.status === 401){ msg.textContent = "열쇠가 맞지 않거나 기간이 끝났어요."; msg.className = "wr-status err"; return; }
      if(r.status === 404){ msg.textContent = "이 열쇠로는 내 저장소에 들어갈 수 없어요. 저장소 이름을 확인해 주세요."; msg.className = "wr-status err"; return; }
      if(!r.ok) throw new Error(r.status);
      const j = await r.json();
      if(j.permissions && j.permissions.push === false){ msg.textContent = "이 열쇠는 읽기만 돼요. 쓰기 권한이 있는 열쇠가 필요해요."; msg.className = "wr-status err"; return; }
      setKey(W.st.repo, k2, el.querySelector(".wr-remember input").checked);
      drawKey(); if(!W.dirty) load(); else setStatus("열쇠를 넣었어요. 이제 저장할 수 있어요", "ok");
    }catch(e){ msg.textContent = "확인하지 못했어요. 인터넷 연결을 확인해 주세요."; msg.className = "wr-status err"; }
  };
  el.querySelector("[data-ok]").onclick = go;
  inp.onkeydown = e => { if(e.key === "Enter") go(); };
}

/* ---------- 페이지 ---------- */
function view(n, repo, docIdx){
  const w = findWeek(n), st = findStu(repo);
  if(!w || !st) return `<div class="empty">페이지를 찾을 수 없어요.</div>`;
  const di = Math.min(+docIdx || 0, w.docs.length - 1), d = w.docs[di];
  return `<div class="crumb"><a href="#/">홈</a> › <a href="#/week/${w.week}">${w.week}주차</a> › <a href="#/week/${w.week}/${esc(st.repo)}">${esc(label(st))}</a> › 작성하기</div>
    <div class="row-head"><h2>✏️ ${w.week}주차 · ${esc(d.name)} <em>${esc(label(st))}</em></h2></div>
    ${w.docs.length > 1 ? `<div class="doc-bar">${w.docs.map((x, i) => `<a class="tab ${i === di ? "on" : ""}" href="#/write/${w.week}/${esc(st.repo)}/${i}">${esc(x.name)}</a>`).join("")}</div>` : ""}
    <div id="wrKey"></div>
    <div class="paper wr"><div id="wrDoc"></div></div>
    <div class="wr-bar">
      <span id="wrStatus" class="wr-status"></span>
      <a class="btn" href="${repoUrl(st)}/edit/main/${esc(d.path)}" target="_blank" rel="noopener" title="GitHub 화면에서 직접 고치기">GitHub에서 열기</a>
      <button class="btn" id="wrSubmit">📮 제출하기</button>
      <button class="btn primary" id="wrSave">💾 저장하기</button>
    </div>`;
}
function mount(n, repo, docIdx){
  const w = findWeek(n), st = findStu(repo); if(!w || !st) return;
  W.w = w; W.st = st; W.doc = w.docs[Math.min(+docIdx || 0, w.docs.length - 1)];
  drawKey(); load();
  document.getElementById("wrSave").onclick = () => save();
  document.getElementById("wrSubmit").onclick = openSubmit;
}

window.Writer = { view, mount, isDirty: () => W.dirty, reset: () => { W.dirty = false; }, _parse: parseMd, _toMd: segs => { W.segs = segs; return toMd(); } };
})();
