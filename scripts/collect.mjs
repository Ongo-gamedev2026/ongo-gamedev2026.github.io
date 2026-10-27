// 학생 저장소의 릴리스(제출)를 읽어 data/submissions.json에 "추가만" 합니다.
// 이미 기록된 제출은 절대 지우거나 바꾸지 않습니다.
import fs from "node:fs";

const ORG = JSON.parse(fs.readFileSync("config.json", "utf8")).org;
const students = JSON.parse(fs.readFileSync("students.json", "utf8")).students;
const FILE = "data/submissions.json";
const data = JSON.parse(fs.readFileSync(FILE, "utf8"));
data.records ??= [];
const seen = new Set(data.records.map(r => `${r.repo}@${r.tag}`));
const TAG = /^week(\d+)-v(\d+)$/;
const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

let added = 0;
for (const st of students) {
  let res;
  try { res = await fetch(`https://api.github.com/repos/${ORG}/${st.repo}/releases?per_page=100`, { headers }); }
  catch (e) { console.log(`${st.repo}: 연결 실패 (건너뜀)`); continue; }
  if (res.status === 404) { console.log(`${st.repo}: 저장소 없음 (건너뜀)`); continue; }
  if (!res.ok) { console.log(`${st.repo}: 오류 ${res.status} (건너뜀)`); continue; }
  for (const rel of await res.json()) {
    const m = TAG.exec(rel.tag_name || "");
    if (!m || rel.draft) continue;
    const key = `${st.repo}@${rel.tag_name}`;
    if (seen.has(key)) continue;
    data.records.push({
      repo: st.repo, tag: rel.tag_name, week: +m[1], version: +m[2],
      published_at: rel.published_at || rel.created_at, url: rel.html_url,
      notes: (rel.body || "").slice(0, 3000),
      recorded_at: new Date().toISOString()
    });
    seen.add(key); added++;
    console.log(`+ ${key}`);
  }
}
data.records.sort((a, b) => a.repo.localeCompare(b.repo) || a.week - b.week || a.version - b.version);
if (added) data.updated = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
console.log(`새 제출 ${added}건 기록`);
