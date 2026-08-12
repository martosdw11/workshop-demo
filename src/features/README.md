# `src/features` — Komponen per Domain

Komponen yang terikat pada satu domain bisnis. **Berjalan di client** — dilarang
import apa pun dari `server/**` (ditegakkan ESLint). Akses data hanya lewat
`lib/api-client.ts` (TDD §1.3).

Komponen generik yang dipakai lintas domain tinggal di `components/shared/`, bukan di
sini.

| Folder        | Epic | Komponen (TDD §6)                                                                                                                                                                                                 | Acuan mockup                            |
| ------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `auth/`       | 2    | `AuthSplitLayout`, `LoginForm`, `RegisterForm`, `SsoButtonsDisabled`                                                                                                                                              | `login_learning_study_ai/`              |
| `catalog/`    | 4    | `EventCard`, `EventStatusBadge`, `JoinConfirmDialog`, `CatalogFilterBar`, `EventCardAction`                                                                                                                       | `event_catalog/`                        |
| `player/`     | 5    | `LearningPathSidebar`, `LessonNavItem`, `MaterialContent`, `PointsBadge`, `ResponsePanel`, `ResponseTypeTabs`, `ResponseComposer`, `ResponseTimeline`, `PlayerFooterNav`, `FinishConfirmDialog`, `ReadOnlyBanner` | `learning_player_material_view/`        |
| `builder/`    | 3    | `EventInfoForm`, `CoverUploader`, `CurriculumBuilder`, `ModuleItem`, `LessonItem`, `RichTextEditor`, `PointsInput`, `CurriculumSummaryPanel`, `PublishBar`                                                        | `event_builder_material_creator_fixed/` |
| `monitoring/` | 6    | `KpiCard`, `KpiGrid`, `EventPipelineChart`, `PipelineDrilldownSheet`, `ActivityFeed`, `PeriodFilter`                                                                                                              | `admin_dashboard_monitoring/`           |
| `people/`     | 7    | `ParticipantTable`, `ParticipantDetailPanel`, `ScoreMatrixTable`, `UserAccessTable`, `RoleSelect`                                                                                                                 | `admin_participant_list/`               |

## Semantik warna wajib konsisten (TDD §6.1)

| Makna            | Token                                                |
| ---------------- | ---------------------------------------------------- |
| Jawaban          | `primary` / `primary-container`                      |
| Komentar         | `on-surface-variant` / `surface-container-high`      |
| Issue (blocker)  | `error` / `error-container`                          |
| Issue (pending)  | `tertiary-fixed-dim`                                 |
| Completed / Poin | `secondary` (progress) & `tertiary-container` (poin) |

**Dilarang menulis hex literal** di file `.tsx` — ESLint akan menolaknya.
