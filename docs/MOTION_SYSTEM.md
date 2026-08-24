# Motion system

The current production experience deliberately ships without a hydrated motion
runtime. CSS transitions are used sparingly; Motion 13 is installed as the
approved advanced DOM layer when a future interaction earns it.

## Semantic motion vocabulary

| Meaning            | Character                     | Suggested duration |
| ------------------ | ----------------------------- | -----------------: |
| Invitation arrives | Gentle settle, slight depth   |         280–420 ms |
| Plan becomes real  | Decisive placement            |         180–260 ms |
| Approaching        | Quiet increase in presence    |         400–700 ms |
| Cancellation       | Fast, tactile, unambiguous    |         140–220 ms |
| Relief             | Space opens and settles       |         320–520 ms |
| Correspondence     | Slide, unfold, reveal         |         320–600 ms |
| Memory notation    | Small annotation              |         160–260 ms |
| Operator error     | Immediate functional response |           0–120 ms |

The sequence is semantic; it is not permission to animate every state.

## Rules

- CSS handles hover, focus and simple disclosure feedback.
- Motion handles future layout, gesture and coordinated domain-state changes.
- ThreeUI animation is admitted only with an approved spatial scene.
- Never duplicate the same state transition across competing animation loops.
- Nothing essential waits for animation to complete.
- Hidden/offscreen work pauses; unmounted work disposes resources.
- `prefers-reduced-motion: reduce` removes non-essential movement while
  retaining a complete, visually intentional state.
- Save-Data and low-capability tiers must receive the same content and outcome.

View Transitions may be tested later for plan-to-detail or letter-to-open-letter
continuity. They remain progressive enhancement and are not currently enabled.
