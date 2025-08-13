# Git Workflow Checklist (1-Page)

팀/개인 프로젝트에서 안전하고 반복 가능한 Git 작업 흐름을 위한 체크리스트입니다.  
(기본 브랜치명이 `main`이라고 가정)

---

## 0) 준비 (1회 또는 작업 시작 전)
```bash
git status                      # 현재 상태 확인
git remote -v                   # 원격 저장소 확인 (origin)
git checkout main               # 기본 브랜치로 이동
git pull origin main            # 최신화
```

---

## 1) 작업 시작 (새 브랜치 생성)
> 기능/버그/작업 유형에 맞는 네이밍 사용 (예: feature/, fix/, hotfix/, chore/)
```bash
git checkout -b feature/awesome-thing
```

---

## 2) 변경/검증
- 코드 수정
- 테스트/린트/빌드(필요 시)
```bash
npm ci              # 최초 또는 lock이 바뀐 경우
npm run test        # 테스트가 있다면
npm run build       # 배포용 빌드가 필요하다면 (dist는 보통 커밋 X)
```

---

## 3) 커밋 (작고 의미 있는 단위)
```bash
git add .
git commit -m "feat: implement awesome thing (#123)"
# Convention 예: feat, fix, chore, docs, refactor, test, perf
```

---

## 4) 푸시 & PR 생성
```bash
git push -u origin feature/awesome-thing
```
- 깃허브(또는 GitLab 등)에서 **Pull Request** 생성  
  - Base: `main` ← Compare: `feature/awesome-thing`
  - PR 설명: 목적/변경 요약/테스트 방법/스크린샷(프론트)/이슈 연결

---

## 5) 코드 리뷰 & 머지
- 리뷰 반영 → 푸시 → PR 업데이트
- **머지 전략(팀 규칙 준수)**: Squash / Merge / Rebase
- CI 통과 확인 (테스트/빌드 등)

머지 완료 후 깃허브에서 **Delete branch**(원격) 클릭

---

## 6) 로컬/원격 브랜치 정리
```bash
git checkout main
git pull origin main
git branch -d feature/awesome-thing             # 로컬 삭제
git push origin --delete feature/awesome-thing  # 원격 삭제 (이미 PR에서 지웠으면 생략 가능)
```

---

## 7) 배포
- **CI/CD 연동(Vercel/Actions/Netlify 등)**: main에 머지되면 자동 빌드/배포
- **수동 배포(자동화 없음)**:
  ```bash
  git checkout main
  git pull origin main
  npm ci && npm run build    # dist 생성
  # 생성된 dist/를 서버나 호스팅에 업로드(예: S3/사내서버/GitHub Pages 워크플로)
  ```
- dist/는 보통 `.gitignore` 처리(소스만 버전 관리)

---

## (부록) 자주 쓰는 명령 요약
```bash
# 원격/브랜치
git remote -v
git branch                # 로컬 목록
git branch -r             # 원격 목록
git checkout <branch>
git checkout -b <new> [origin/<remote-branch>]
git push -u origin <branch>
git branch -d <branch>    # 안전 삭제(병합된 경우만)
git branch -D <branch>    # 강제 삭제
git push origin --delete <branch>

# 동기화
git pull origin main
git fetch origin
git merge <branch>        # 로컬에서 직접 머지 시

# 상태/로그
git status
git log --oneline --graph --decorate -n 20
git log -1 --name-status
```

---

## (부록) B 컴퓨터에서 A가 만든 브랜치 가져오기
```bash
git fetch origin
git branch -r                           # origin/<branch> 확인
git checkout -b hotfix/menu-item-sorting origin/hotfix/menu-item-sorting
git pull                                # 최신화
```

---

## (부록) .gitignore 권장 (프론트엔드 예시)
```
node_modules/
dist/
.env
.env.*
.DS_Store
```

---

### Tips
- 새 작업 전에는 항상 `main` 최신화 후 브랜치 생성.
- PR 제목/설명은 간결하고, 테스트 방법과 영향 범위 명시.
- 빌드 산출물(dist)은 **배포에만 사용**하고 Git에는 올리지 않는 것이 일반적.
- 긴급 수정은 `hotfix/` 브랜치로, 머지 후 즉시 배포 → 브랜치 정리.
