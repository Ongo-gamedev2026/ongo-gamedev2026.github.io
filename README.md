# 🎮 온고 게임제작반 메인 사이트

👉 https://ongo-gamedev2026.github.io

## 파일 구성
| 파일 | 내용 |
|---|---|
| `index.html` | 사이트 화면 전체 |
| `config.json` | 기본 설정 (`homeCardLink`: 홈 카드를 누르면 `student` = 학생 주차 페이지, `game` = 게임 화면) |
| `students.json` | 학생 번호·저장소 목록. **이름·학번은 절대 적지 않아요** (공개 저장소) |
| `weeks.json` | 주차별 주제, 성과물, 볼 문서 |
| `data/submissions.json` | 제출 기록. Actions가 자동으로 추가만 해요. **직접 고치지 마세요** |

## 제출 기록
- `.github/workflows/collect.yml`이 매시간 학생 저장소의 릴리스(`week2-v1` 형식)를 확인해요.
- 바로 반영하려면 **Actions → 제출 기록 모으기 → Run workflow**를 누르세요.

## 출력할 때 이름·학번 넣기
선생님 PC에 아래 형식의 CSV 파일을 만들어 두고, 사이트 왼쪽 아래 **명단 불러오기**로 선택하세요.
파일은 업로드되지 않고, 브라우저 탭을 닫으면 지워져요.
```
번호,이름,학번
01,홍길동,10101
02,김철수,10102
```
