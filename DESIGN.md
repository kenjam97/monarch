# Monarch design system

The approved reference is `public/study-film.html`. The application uses that sequence directly on Study. Original card artwork, Bordeaux felt, neutral light, Caslon titles and concise descriptions carry through the rest of the app.

## Foundations

| Element | Rule |
| --- | --- |
| Display type | Locally stored Libre Caslon Display, regular weight, mixed case. Usually 38 to 132 px. |
| Reading type | Arial or the platform sans-serif fallback. Body 13 to 14 px, controls 12 to 14 px. |
| Paper | `#f3f1ef`. Neutral page and decision-panel stock. |
| Ink | `#151419`. Text, menu and startup background. |
| Bordeaux | `#582234`; deep field `#340b1c`. Felt, selected actions and scene cuts. |
| Champagne | `#c6b9aa`. Small rules, progress and physical table trim. |
| Supporting text | `#746a73` on paper. Lighter muted rose on dark scenes. |
| Spacing | 8 px base rhythm, 24 px phone gutters, fluid desktop gutters from 24 to 100 px. |
| Edges | Rules separate records. Square form controls. Curves belong to cards, chips and the table. |

No uppercase display labels, condensed display faces, yellow overlays, decorative gradients, glass effects, glow, dashboard tiles or persistent sidebar. Poker abbreviations retain their normal spelling. Texture is confined to physical felt and card backs.

## Composition

- Study starts with the complete table film. The personal record below uses a ruled practice index and an asymmetric review count.
- Navigation is a full-screen ink page. Links form two columns, with real study counts below. The native dialog owns focus and Escape.
- Replay gives the table most of the frame. At a frozen decision, a paper panel contains the price, optional reasoning and actions. The complete board stays visible. Action history, hand facts, seats and notes retain their data detail.
- Practice uses a full-viewport card scene and the same left paper panel as a review. There is no separate dashboard header or inset card picture. Pot odds use large typeset amounts. Feedback replaces the answer controls in the same space.
- Ranges use a dense 13 by 13 matrix, explicit action colours and a ruled editor. On phones an action selector sits immediately above the matrix.
- Card frequencies pair a printed matrix with the shared felt, lighting and card artwork. The selected class uses suits from a matching history. Counts stay visible beside the cards on desktop; phones place the cards first and use a horizontally scrolling matrix with a live selection count. Unselected cells use dark text on pale ink, with Bordeaux reserved for the selected cell.
- Hands, reviews, sessions and opponents use open records, strong type and horizontal rules. Opponent names take priority over statistical classifications.
- Imports use a Bordeaux file area beside folder status. Settings and notes use paper, underlined fields and clear section divisions.

Phone layouts are composed separately. The replay table sits above a compact decision. Hand rows become readable records with the cards and result in view. Wide statistical tables scroll within their own container. The menu retains its two-column composition.

## Motion

A route cut lasts 540 ms and commits the destination at 180 ms. The latest navigation owns both timers. Filters do not replay the route cut. Titles and dialogs enter in 350 to 470 ms. Controls respond immediately.

The opening hand runs for about 23 seconds before stopping at the river decision. Its 3.5-second flop close-up travels across all three cards. Camera interpolation stays continuous through bets and street changes. Reviews and practice share the full-frame renderer and camera composer. An entry sequence settles the deal, then pans through a split-screen close-up before the paper question appears. Phones start close to the hole cards and pull back to the complete scene. An optional skip control exposes the question immediately. Manual Table, Your hand and Board views are always available after the entrance. Replay holds the flop for its complete pan. Within a street, bets and folds do not change the reserved framing bounds. Card movement settles quickly; idle scenes stop redrawing.

A review answer unlocks later actions. When automatic playback is enabled, the recorded hand continues after a short reading hold. Menus, background tabs, manual controls and leaving the table pause it. Draw and preflop exercises grade the chosen action directly. Pot-odds exercises retain an explicit submission because they contain multiple fields. Feedback stays visible until Next exercise.

System reduced motion and the app motion preference remove camera animation, entrances and cuts. The opening goes directly to the decision. Automatic practice playback is independently configurable.

## Loading, feedback and empty states

The initial HTML uses the same mixed-case wordmark before React loads. Real pending requests show the small moving rule and Caslon mark. Import activity is tied to the actual request. There are no invented percentages or interpolated financial amounts.

Empty pages state what is missing and provide a relevant action. Error pages keep the same type and navigation. Notices and completion messages use plain factual wording. Study levels and XP describe stored activity and never imply poker profitability.

## Implementation

`src/monarch.css` is the application's stylesheet. `Cinema.tsx` owns route cuts and preferences; `common.tsx` owns shared controls and states. `StudySequence.tsx` mounts the approved film with isolated styles and cleanup. `TableRoom.tsx` passes replay snapshots to `public/study-film/room.js`.

`public/study-film/art.js` owns all original card faces and backs. It supplies the film, the live table and compact card images. The table receives only visible snapshot cards. It never receives unrevealed opponent cards or future board cards.

Copy is written for one person's working tool. Use plain labels, specific amounts and direct instructions. No promotional claims, invented brands within the brand, motivational slogans or marketing language.

`room-camera.js` fits only visible subject information into the reserved scene area. The complete board footprint is reserved for replay before dealing, preventing a new street from pushing the river out of frame. No future card identities are passed to the renderer. Twenty camera tests cover wide, narrow and phone views, each street, multiway layouts and manual close-ups.
