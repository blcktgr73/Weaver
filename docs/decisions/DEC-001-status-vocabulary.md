# DEC-001: 상태 이름 체계 통일

- 상태: 확정
- 날짜: 2026-10-28
- 관련: `REQ-001`, `TASK-001`

## 배경

상태를 가리키는 문서가 둘이었고 서로 달랐다.

- `requirements-v0.1.md`는 `draft → … → accepted`를 밑줄 표기(`in_progress`)로 적었다.
- `github-issues-integration.md`는 `Backlog … Verified`를 하이픈 라벨(`status:in-progress`)로 적었다.
- `REQ-001`의 frontmatter는 하이픈 표기(`in-progress`)를 쓴다.

둘의 대응표가 없어서, 같은 작업이 문서마다 다른 상태로 읽힐 수 있었다.

## 결정

1. 모든 상태 값은 **소문자 하이픈 표기**(`in-progress`, `needs-human-decision`)로 쓴다. 밑줄은 쓰지 않는다.
2. 상태 모델은 두 층으로 나눈다.
   - **생명주기 상태**(Markdown frontmatter): 요구사항과 작업이 어디까지 갔는지를 나타낸다.
   - **칸반 열**(GitHub 라벨): 생명주기 상태를 여섯 열로 줄여 보여 주는 투영이다.
3. 대응표는 [Product Requirements v0.1](../product/requirements-v0.1.md#status-mapping)을 단일 기준으로 삼고, 다른 문서는 이를 링크한다.

## 결과

- `TASK-001`의 스키마 검증기는 하이픈 표기만 허용한다.
- 칸반 열에 대응하지 않는 상태(`cancelled`)는 보드에 표시하지 않는다.
