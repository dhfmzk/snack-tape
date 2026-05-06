# SnackTape MVP Goal

## 작업 목표

이 저장소에는 Manifest V3 Chrome Extension MVP `SnackTape`을 새로 구현한다.
목표는 YouTube 영상 여러 개에서 사용자가 고른 특정 시간 구간만 순서대로 이어 재생하는 로컬 확장 프로그램이다.

제품 컨셉은 `좋아하는 장면만 골라 만든 나만의 영상 믹스테이프`이다.

## 실제 참고 대상

1. 사용자 제공 작업 지시서를 최상위 구현 기준으로 삼는다.
2. Clip Playlist는 공개 제품 및 공개 저장소 기준으로 기능, UX 범위, 기술 스택, 확장 프로그램 구조를 분석하는 참고 사례로 본다.
3. Clip Playlist 또는 다른 확장 프로그램의 코드, UI, 에셋, 데이터 파일, 구현 세부 로직은 복제하거나 차용하지 않는다.

## Clip Playlist에서 확인한 참고 정보

- 실제 Chrome Web Store 등록 제품이며, start/end time 기반 클립 playlist 재생 문제를 다룬다.
- 공개 설명상 YouTube, Google Drive, TwitCasting을 지원한다.
- 공개 repo 기준 기술 스택은 TypeScript, Webpack 5, Bootstrap, SCSS 중심이다.
- Manifest V3, background service worker, popup, content script 구조를 사용한다.
- 내장 playlist, 랜덤 재생, 태그 필터, URL parameter 기반 재생, 자막/가사 등 SnackTape MVP보다 넓은 기능을 가진다.

## SnackTape의 의도적 차별점

- YouTube 중심 MVP로 범위를 줄인다.
- 한국어 UI를 기본으로 한다.
- 현재 YouTube 페이지에서 시작점/끝점을 빠르게 캡처한다.
- 세그먼트 카드 기반 편집, 순서 이동, JSON import/export를 제공한다.
- 로컬 저장만 사용하며 계정, 클라우드, 공유 링크, 자막/태그 시스템은 구현하지 않는다.

## 구현 범위

- Manifest V3 Chrome extension
- TypeScript source
- `dist/`에 loadable unpacked extension build output 생성
- Side Panel UI: 편집, 믹스테이프, 설정 탭과 재생 화면
- 편집 탭: 현재 YouTube 영상 정보, 저장 위치 선택, 시작점/끝점 캡처, 조각 추가, 구간 보정/삭제, 믹스테이프 삭제
- 믹스테이프 탭: sequence 생성/선택, 비어 있는 테이프 편집 이동, 구간이 있는 테이프 재생 이동
- Content script: YouTube video element 제어, SPA navigation 대응, 자동 재생 실패 overlay
- Background service worker: active playback state, tab navigation, segment sequence orchestration
- Storage: `chrome.storage.local`, `chrome.storage.session` 우선 playback state와 local fallback
- Unit tests: URL/time/validation/reorder/playback pure logic
- README: 설치, 빌드, Chrome load unpacked, 수동 QA, 한계, 안전 원칙

## 안전 원칙

- YouTube 광고, DRM, 로그인 벽, 지역 제한, 연령 제한, 비공개 접근 제어를 우회하지 않는다.
- 영상을 다운로드, 재업로드, 사적 콘텐츠 스크래핑하지 않는다.
- 사용자가 이미 브라우저에서 볼 수 있는 정상 영상의 재생 위치와 재생 흐름만 제어한다.
- 자동 재생 실패 시 최소 overlay `계속 재생` 버튼만 제공한다.

## 완료 기준

- `npx --yes --package typescript@5.9.3 tsc -p tsconfig.test.json`와 `node --test tests/*.test.mjs` 통과
- `npx --yes --package typescript@5.9.3 tsc --noEmit -p tsconfig.json`와 `node scripts/build.mjs` 통과
- `dist/manifest.json`과 manifest가 가리키는 파일들이 실제 존재
- 사이드 패널 편집 탭에서 YouTube 구간 캡처와 segment 추가 가능
- 사이드 패널에서 sequence와 segment 관리 가능
- playback이 같은 영상/다른 영상 segment를 순서대로 재생하고 final segment 후 상태를 정리
- UI/UX와 동작 피드백을 서브에이전트로 받아 필요한 수정 반영
