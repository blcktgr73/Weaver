# DEC-003: 공유 보드 상태와 Weaver 칸반 열의 관계

- 상태: 확정
- 날짜: 2026-10-30
- 관련: `REQ-001`, `TASK-005`, `TASK-007`, [DEC-001](./DEC-001-status-vocabulary.md)

## 배경

공유 보드(PALab Ops Kanban)의 `Status` 필드는 `Todo / In Progress / Done` 세 값이고, Weaver의 칸반은 여섯 열(Backlog, Ready, In progress, Blocked, Review, Verified)이다. 카드를 옮길 때 어느 쪽이 기준인지 정해야 했다.

## 결정 (A안)

- **여섯 열의 기준은 이슈 라벨(`status:*`)과 이슈 상태(열림/닫힘)다.**
- 보드의 `Status` 필드는 이 값에서 **파생되는 요약**이며, 보드 설정은 바꾸지 않는다.

| Weaver 열 | 이슈 라벨 | 이슈 상태 | 보드 Status |
| --- | --- | --- | --- |
| Backlog | `status:backlog` | open | Todo |
| Ready | `status:ready` | open | Todo |
| In progress | `status:in-progress` | open | In Progress |
| Blocked | `status:blocked` | open | In Progress |
| Review | `status:review` | open | In Progress |
| Verified | `status:verified` | closed | Done |

## 결과

- 카드를 옮기면 라벨, 이슈 상태, 보드 Status를 한 번에 맞춘다. 규칙은 `packages/markdown`의 `planMove`가 단일 기준이다.
- Blocked와 Review는 보드에서 구분되지 않는다. 구분이 필요하면 Weaver 화면을 본다.
- 사람이 보드에서 Status를 직접 바꾸면 라벨과 어긋날 수 있다. 이 불일치를 공백으로 표시하는 일은 후속 작업이다.
- 보드에 여섯 값을 가진 새 필드를 두는 B안은 채택하지 않았다. 필요해지면 새 결정으로 다시 다룬다.
