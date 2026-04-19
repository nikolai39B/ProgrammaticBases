// debugSource.ts
//
// Registers a "debug" external source with `window.programmaticBases`.
// Call `window.programmaticBases.debug.registerDebugSource()` from the
// browser console to make the "debug" template appear in the template picker.
//
// The template covers all param types and includes a shared param ("viewName")
// with the component to exercise multi-source merging and the Split button.

// ── Component: debug:view ────────────────────────────────────────────────────

/**
 * A minimal table view component.
 * Declares `viewName` — also declared at template level — to exercise the
 * multi-source merge scenario and Split button in the param modal.
 */
const COMPONENT_VIEW = `\
pb-metadata:
  params:
    viewName:
      label: View name
      description: Displayed as the tab title in the base.
      type: string
      default: Debug Table
    viewId:
      label: View id
      description: The id of the view
      type: number
      default: 0
      min: -1
      max: 9999
      step: 2
    sortDirection:
      label: Sort direction
      description: Direction to sort rows in the view.
      type: enum
      options:
        - Ascending
        - Descending
        - Invalid
      default: Ascending
type: table
name: !exp params.viewName
sort:
  - property: file.name
    direction: !fnc |
      const dir = params.sortDirection;
      if (dir === 'Ascending') return 'ASC';
      if (dir === 'Descending') return 'DESC';
      return 'ASC';
`;

// ── Template: debug ──────────────────────────────────────────────────────────

/**
 * A base template that covers every param type.
 * Includes the view component above via a qualified !sub ref.
 */
const TEMPLATE_DEBUG = `\
pb-metadata:
  params:
    viewName:
      label: View name
      description: Displayed as the tab title in the base. Also used by the view component.
      type: string
      default: Debug View
    enabled:
      label: Enabled
      description: Toggles whether the base is active.
      type: boolean
    targetFolder:
      label: Target folder
      description: Vault-relative folder to scope the base to.
      type: folder
    count:
      label: Count
      description: Maximum number of items to display.
      type: number
      default: 5
    sinceDate:
      label: Since date
      description: Only include items on or after this date.
      type: date
      optional: true
    sinceDateTime:
      label: Since date/time
      description: Only include items at or after this exact time.
      type: datetime
views:
  - !sub debug:view
`;

// ── Registration ─────────────────────────────────────────────────────────────

/**
 * Registers the "debug" external source.
 * Uses `append: true` so it's safe to call multiple times during a session
 * (e.g. after a hot-reload).
 */
export function registerDebugSource(): void {
  window.programmaticBases!.registerSource(
    {
      name: 'debug',
      components: {
        'view': COMPONENT_VIEW,
      },
      templates: {
        'debug': TEMPLATE_DEBUG,
      },
    },
    { append: true },
  );
  console.log('[programmatic-bases] debug source registered');
}
