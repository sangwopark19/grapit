# Quick Task 260331-lt4 Summary

## Task
상세페이지 탭 전환 시 오른쪽 정보패널 너비 변동 수정

## Root Cause
`main` 요소에 `w-full`이 없어서 `mx-auto`가 flex stretch를 방지.
이전 레이아웃에서는 탭 섹션이 flex 외부에 full-width로 있어서 main이 넓어졌지만,
2컬럼 구조로 변경 후 탭이 왼쪽 컬럼(380px) 안으로 들어가면서
main이 콘텐츠 너비(511px)로 축소됨.

결과: 오른쪽 정보패널이 ~97px로 찌그러짐.

## Fix
`main` className에 `w-full` 추가:
```
- mx-auto max-w-[1200px] px-6 ...
+ mx-auto w-full max-w-[1200px] px-6 ...
```

## Verification (agent-browser)
| Tab | main | left col | right col |
|-----|------|----------|-----------|
| 캐스팅 | 1200px | 380px | 740px |
| 상세정보 | 1200px | 380px | 740px |
| 판매정보 | 1200px | 380px | 740px |

모든 탭에서 컬럼 너비 동일 확인.

## Commits
- `1534fa4` fix(detail): add w-full to main element to prevent flex column width collapse

## Files Changed
- `apps/web/app/performance/[id]/page.tsx` (1 line)
