# 🎮 온고 게임제작반 메인 사이트

👉 https://ongo-gamedev2026.github.io

## 파일 구성
| 파일 | 내용 |
|---|---|
| `index.html` | 사이트 화면 전체 |
| `config.json` | 기본 설정 (`homeCardLink`: 홈 카드를 누르면 `student` = 학생 주차 페이지, `game` = 게임 화면) |
| `students.json` | 학생 번호·저장소 목록. **이름·학번은 절대 적지 않아요** (공개 저장소) |
| `weeks.json` | 주차별 주제, 성과물, 볼 문서 |
| `write.js` | 작성하기 화면 (입력·저장·제출, 코드로 열쇠 연결) |
| `keys.json` | 학생 코드로 잠근 열쇠. 직접 고치지 마세요 |
| `data/submissions.json` | 제출 기록. Actions가 자동으로 추가만 해요. **직접 고치지 마세요** |

## 작성하기 (사이트에서 바로 저장)
- 학생은 사이트의 **✏️ 작성하기**(마을의 책상·액자, 학생 주차 페이지)에서 양식에 바로 적고 **💾 저장하기**를 누르면 자기 저장소의 md 파일에 저장돼요.
- **📮 제출하기**를 누르면 지금 저장된 내용이 `week2-v1` 형식의 릴리스로 제출돼요. 버전 번호는 자동으로 다음 번호가 붙어요.
- 저장하려면 학생마다 **열쇠(fine-grained 토큰)**가 필요해요. 학생은 선생님께 받은 **코드**를 한 번 넣으면 되고, 공용 컴퓨터에서는 '이 컴퓨터에 기억하기'를 끄거나 다 쓴 뒤 **열쇠 빼기**를 누르세요.

### 열쇠 만드는 법 (학생 1명당 1개)
1. https://github.com/settings/personal-access-tokens/new 에 들어가요.
2. **Token name**: `game-01 작성용`처럼 학생 저장소 이름을 넣어요. **Expiration**: 과정이 끝나는 날짜로 정해요.
3. **Resource owner**: `Ongo-gamedev2026`
4. **Repository access**: *Only select repositories* → 그 학생의 저장소 **하나만** 골라요.
5. **Permissions → Repository permissions → Contents**: *Read and write*
6. **Generate token**을 누르고 나온 `github_pat_…` 값을 복사해 둬요. (이 화면을 벗어나면 다시 볼 수 없어요)

### 학생 코드 (keys.json)
- 열쇠는 공개 저장소에 그대로 올리면 안 돼요 (누구나 쓸 수 있고, GitHub가 발견하면 바로 폐기해요).
- 그래서 `keys.json`에는 열쇠를 **학생별 코드(예: ABCD-1234)로 잠근 것**만 들어 있어요. 코드 없이는 열 수 없어요.
- 학생은 작업실의 **🔑 내 열쇠** 버튼(또는 작성하기 화면)에 자기 코드를 넣으면 돼요.
- 열쇠를 새로 만들거나 기간이 끝나면 `keys.json`과 코드도 새로 만들어야 해요. 코드 목록은 선생님만 보관하세요.

처음 한 번은 조직 설정에서 fine-grained 토큰을 허용해야 할 수 있어요: **조직 Settings → Personal access tokens → Settings → Allow access via fine-grained personal access tokens**. '승인 필요'로 두면 만든 열쇠를 **Pending requests**에서 승인해야 써져요.

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
