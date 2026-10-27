# UI development conventions

The user requires future features and custom tools to extend the existing canvas design consistently.

- Reuse theme tokens from `src/VisualSystem.css` (`--ui-panel`, `--ui-field`, `--ui-ink`, `--ui-secondary`, `--ui-muted`, `--ui-border`, `--ui-accent`, and shadow tokens). Support light and dark themes; do not hard-code light-only surfaces.
- Side panels use `ui-side-panel`, `ui-panel-header`, `ui-panel-tabs`, `ui-panel-card`, and `ui-panel-footer`. AssetLibrary and AssetCategoryHome demonstrate the structure. Separate the title, segmented categories, scrollable content, and footer actions.
- Custom feature panels may override scoped `--panel-radius`, `--panel-space`, `--panel-card-radius`, and `--panel-heading-size`, and provide their own labels, icons, content and actions. Preserve shared states and visual hierarchy. These are developer extension points, not a user-facing theme editor.
- Use CanvasSelect for React dropdowns. Use a single input surface, clear focus states, readable secondary text, and the shared Lucide icon family.
- UI-only work must preserve existing canvas data, generation behavior and keyboard shortcuts. Do not add fake controls or paid test generations.
- For new or changed UI, run the build and inspect the relevant view, including dark theme when changing colors. Keep customization within the shared system instead of creating a separate visual style.
- Canvas task failures and paused states reuse TaskNotice and the canvas-task-notice styles. Show a short summary with expandable details, retain theme tokens, and distinguish download failures from processing failures. Do not surface raw credentials, signed URLs, or stack traces in notices.

- Generated-image outputs from Add to canvas tools (excluding scene tone) default to the shared GenerationPlaceholder / TaskNotice generation failure variant: small warning icon, centered “生成失败”, “请重试或检查提示词”, no nested notice box or inline details/actions. Preserve separate transport, manual-stop and download notices, and the toolbar input-preview presentation.
