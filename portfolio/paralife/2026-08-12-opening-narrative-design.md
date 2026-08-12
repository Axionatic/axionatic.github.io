# Paralife opening narrative design

## Scope

Redesign only the scroll-driven opening runway on `/portfolio/paralife/`:

- replace the current `#narrative-panel` presentation;
- remove the current opening `Live server` HUD;
- replace the isolated `one entity — one socket` annotation with a complete fourth narrative beat;
- preserve the continuous simulation backdrop and existing transition into `#tech-content`.

The contents and ordering of `#tech-content` are explicitly out of scope. They will be reviewed separately after the opening is implemented and evaluated.

## Narrative

The opening uses four short lines, progressing from premise to emergent behaviour to the distributed-systems challenge:

1. **The world:** “Three species locked in a rock-paper-scissors battle for survival.”
2. **Perception:** “Every entity acts independently, seeing only what lies within reach.”
3. **Emergence:** “Simple local rules become spiral waves, shifting niches and population cycles.”
4. **Concurrency:** “They act concurrently, but the world must advance as one coherent reality.”

This is an engineering exploration, not a product-problem narrative. It follows the wider portfolio’s accessible-to-technical progression without inventing a customer problem.

## Four visual beats

### 1. Field typography

The first line becomes large field typography spanning the living simulation. A restrained dark band or equivalent local contrast treatment makes the text legible without enclosing it in a conventional panel. The species continue moving visibly behind it.

Purpose: establish the cyclical survival premise with maximum immediacy.

### 2. Perception window

The first treatment compresses into an entity-centred perception window. The rest of the world dims while the visible region remains legible. The second line sits inside this aperture alongside a subtle observed-entity marker.

Purpose: make limited local knowledge tangible instead of merely describing it.

### 3. Living legend

The perception boundary transforms into a minimal world-state frame. It identifies Catalyst, Membrane, and Spore, shows their cyclical relationship, and may display a lightweight changing population balance. The third line accompanies the visible spiral fronts and shifting species distribution.

Purpose: connect simple local rules to large-scale emergent patterns without turning the hero into a dashboard.

Any displayed population balance must be calculated from the running browser simulation. It must not imply production telemetry or benchmark evidence.

The balance is optional and should be omitted unless it materially improves the composition. Under `prefers-reduced-motion: reduce`, omit the changing balance and retain only the static species names and cyclical relationship.

### 4. Client/server constellation

The state frame expands or resolves into an authoritative server node surrounded by numerous small client nodes. Paths or pulses show real-time server-to-client communication. The fourth line sits to the left on desktop and above the illustration on mobile.

One or two clients visibly lag during a scroll-bound sequence. Its phase is a pure function of normalized runway progress rather than wall-clock time:

1. their incoming pulse slows or stops;
2. their connection changes to a warning state;
3. the link drops or fades while the server and healthy clients continue;
4. a reconnect path appears;
5. the same client node recovers and returns to its species colour.

Scrolling backward reverses these phases in order. Ambient pulses among healthy clients may remain time-driven, but they do not determine failure or recovery state.

The affected node must retain a stable position and identity marker (for example, a small ring, glyph, or short ID) throughout lag, disconnect, and recovery. Warning and disconnected treatments apply to that same marker, and the reconnect path returns to it. Species colour communicates restored health; it does not establish identity. A concise `same entity restored` label may reinforce the recovery event.

This is a conceptual illustration of the implemented bounded-queue, stalled-session, grace-window, and resume-token behaviour. It must not be labelled as live production telemetry. The server cadence may be labelled `2 Hz`; unsupported scale claims must not appear.

## Scroll choreography

The running world remains one continuous scene across all four beats. It is not reseeded, restarted, or swapped for separate illustrations.

Scroll progress directly controls the visual states and the transitions between them. The choreography must be deterministic and reversible: scrolling upward restores the preceding state without jumps or stale elements.

Target morph sequence:

1. field typography compresses and moves into the perception aperture;
2. the perception boundary becomes the living legend/status frame;
3. the frame expands or resolves into the server node while visible entities separate into client nodes and connection paths.

Elements with meaningful shared geometry should morph continuously. A short local crossfade is acceptable only where forcing shared geometry makes the transition confusing or fragile. The world itself must remain continuous even when a local crossfade is used.

Narrative lines should have readable hold periods between transitions. No two full lines should compete at normal scroll positions.

Do not reuse the current equal-slice narrative calculation. Begin with a `500vh` runway and explicit, unequal beat ranges:

- beat 1: `0.00–0.18`;
- beat 2: `0.18–0.40`;
- beat 3: `0.40–0.62`;
- beat 4: `0.62–1.00`.

Beat 4 deliberately owns the largest range so its layout morph and five failure/recovery phases have room to read. Adjust the total runway height only if representative browser testing shows the phases remain compressed; preserve the relative emphasis on beat 4.

## Responsive behaviour

Desktop:

- beats 1–3 use the simulation field as their full composition;
- beat 4 places text in roughly the left third and the client/server constellation in the right two-thirds;
- safe zones must account for the fixed header and navigation.

Mobile and narrow tablet:

- retain the same four-beat order and meaning;
- beat 4 places text above the constellation;
- keep labels and client nodes large enough to remain legible, reducing node count when necessary rather than shrinking them excessively;
- ensure the narrative never overlaps the fixed header, navigation, scroll hint, or the upcoming `#tech-content` transition.

## Motion and accessibility

- Respect `prefers-reduced-motion`.
- In reduced-motion mode, preserve all four semantic states but replace geometric morphs with short opacity transitions. Show static representative stalled and recovered clients in beat 4; do not animate the failure/recovery lifecycle.
- Decorative client/server graphics are hidden from assistive technology.
- Narrative text remains real DOM text in document order rather than canvas-rendered text.
- Colour is not the only signal for lag and recovery; preserve the stable identity marker and use state shape, line treatment, or a concise label as additional cues.
- Maintain sufficient text contrast against every simulation state.

## Technical boundaries

- Reuse the existing canvas simulation and GSAP/ScrollTrigger setup.
- Prefer a small number of DOM/SVG overlays for narrative and client/server graphics; do not introduce a new rendering library.
- Derive all beat state from a single normalized runway progress value so resize and reverse-scroll behaviour remain coherent.
- Resize handling must preserve the current world where feasible and recompute only layout-dependent geometry.
- The existing handoff to `#tech-content` remains visually and structurally intact.
- No changes to `#tech-content` markup, copy, illustrations, or ordering are included.

## Acceptance criteria

- All four approved narrative lines appear in order and remain readable at representative desktop and mobile widths.
- Each line has its distinct approved visual treatment.
- The transitions are scroll-controlled, continuous where sensible, and cleanly reversible.
- The underlying world never visibly resets between beats.
- The fourth beat clearly communicates many concurrent clients, continued server health during client lag, and recovery of the same visibly identified client/entity.
- No opening metric or label overstates the project’s committed benchmark evidence.
- Reduced-motion mode presents the same narrative without continuous geometric motion.
- The page enters the existing `#tech-content` without a blank gap, collision, or unintended change to that section.
