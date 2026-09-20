# UI study: making the graph read as knowledge

Sources read for this study:

- graphify HTML exporter: `/private/tmp/claude-501/-Users-nikhilkrishnaswamy/a3bbe4c4-6e0c-430c-ba5f-8cff16fc7974/scratchpad/graphify/graphify/exporters/html.py` (called `graphify html.py` below)
- graphify palette: `.../graphify/exporters/base.py` (`graphify base.py`)
- graphify Obsidian and Canvas exporters: `.../graphify/export.py`, `to_obsidian` at line 686, `to_canvas` at line 1032 (`graphify export.py`)
- our graph view: `/Users/nikhilkrishnaswamy/Documents/GitHub/headstart/src/ui/graph.js` (`ours graph.js`)
- our data: `/Users/nikhilkrishnaswamy/Documents/GitHub/headstart/results/graph.json` and the builder `src/graph.ts`
- web references are listed by URL under each rule

## Our data, so the rules below have something to bind to

`results/graph.json` today: 108 nodes (90 session, 18 file), 400 edges (232 `similar`, 168 `wrote`), 13 communities (`clusters`), 5 shapes, a 90-entry timeline. `src/graph.ts` also emits `matrix` (90 by 90 compression distances, rows ordered by community) and `stats` (modularity, mean distance within and between communities). The published `results/graph.json` predates the `matrix` field.

Each session has: `task` (nine tasks, ten sessions each: flag-1..3, endpoint-1..3, bugfix-1..3), `calls`, `discovery` (tool calls before the first edit), `verified`, `files` written, `cluster`, `shape`. Edge weight `w` on `similar` edges is `1 - ncd`, range 0.48 to 0.93. Every session keeps its four nearest neighbours (`knn`), so degree is 4 to about 12 and carries little information on its own.

Community sizes are lopsided: ten communities of 8 to 10 sessions, three of 1 or 2. Shapes are lopsided too: shape 0 holds 5 communities and 49 sessions (`flag 29, endpoint 10, bugfix 10`), shape 2 holds one community of 2.


## 1. Fifteen rules for a graph that reads as knowledge

Each rule says what to do, where it comes from, and what our `graph.js` does today.

### Labels

**Rule 1. Label few nodes by default. Everything else gets its name on hover.**
Source: graphify html.py line 515, `font_size = 12 if deg >= max_deg * 0.15 else 0`, and every node carries a `title` tooltip (line 522). Cosmograph does the same with `showTopLabels` plus `showTopLabelsLimit` and `showHoveredPointLabel` (https://cosmograph.app/docs-lib/api/interfaces/CosmographConfig/). The Gephi tutorial goes further: "it is perfectly acceptable to not show labels at all" (https://jacomyma.github.io/mapping-controversies/1.8/).
Ours: `graph.js` labels nodes with `deg >= 0.5 * maxDeg`. In a 4-nearest-neighbour graph degree runs 4 to about 12, so this picks the sessions most often chosen as a neighbour. The label text is `n.task`, and ten sessions share each task name, so a hull labelled `flag x9` gets three nodes inside it that all say `flag-2`. The node label repeats the hull label and adds no fact.

**Rule 2. A label must earn its pixels: hide it when the node is small on screen, and keep labelled nodes apart.**
Source: Ogma `text.minVisibleSize`, default 24, "If the node diameter on screen is less than this value, the text will not be shown" (https://doc.linkurious.com/ogma/latest/api/types/nodeattributes.html). Cosmograph spaces dynamic labels with `pointSamplingDistance`, default 100 px between labelled points (https://raw.githubusercontent.com/cosmosgl/graph/main/src/config.ts). Obsidian exposes this as "Text fade threshold: controls the text transparency for the name of each note" (https://obsidian.md/help/plugins/graph).
Ours: labels are a fixed 10 px at every zoom, and nothing stops two labels landing on top of each other.

**Rule 3. Groups get a name. The name sits at the group, not in a legend only.**
Source: graphify html.py lines 128 to 133 draw each hyperedge label in bold 11 px at the hull centroid. Cosmograph has `showClusterLabels`. Kumu community detection: "we provide an easy way to override the community name and replace it with a descriptive one" (https://docs.kumu.io/llms-full.txt, section "Community detection"). graphify export.py `to_obsidian` writes one `_COMMUNITY_<name>.md` note per community so the name is a file you can open (line 869).
Ours: hull labels exist (`flag x9`) and that is right. The text is the majority task prefix, so the three flag communities in shape 0 are all labelled `flag x10`. Use the task id (`flag-2 x9`) or the centroid session's title. Shape labels in `graph.json` are histograms (`flag 29, endpoint 10, bugfix 10`), which is honest but not a name.

### Size

**Rule 4. Size encodes one number, with a floor and a ceiling, and the legend says which number.**
Source: graphify html.py line 513, `size = 10 + 30 * (deg / max_deg)`, so 10 to 40. The Gephi tutorial sets "Min size to 3 and the Max size to 15" by degree (https://jacomyma.github.io/mapping-controversies/1.8/). Kumu "Size by" takes any numeric field and warns that without numeric fields the dropdown is empty (https://docs.kumu.io/llms-full.txt, "Size by").
Ours: sessions `5 + 11 * (deg / maxDeg)`, files `3 + 4 * (deg / maxDeg)`. Degree in a k-nearest graph is nearly flat, so the size range says little, and no legend entry says what size means. Better candidates for size: `calls` (work done) or `discovery` (tool calls before the first edit, the number headstart cuts). Files sized by how many sessions wrote them is right and should be said in the legend.

**Rule 5. Label size follows node size.**
Source: Gephi tutorial, "Proportional size" so that "bigger nodes have a bigger label" (https://jacomyma.github.io/mapping-controversies/1.8/). Ogma `text.scaling` (https://doc.linkurious.com/ogma/latest/api/types/nodeattributes.html).
Ours: one size, 10 px.

### Colour

**Rule 6. One categorical palette, at most ten hues, applied to one grouping, and the same hue for that group in every panel.**
Source: graphify base.py `COMMUNITY_COLORS`, ten Tableau hues. html.py uses the same hue for node fill (line 519), legend dot (line 339), search result border (line 273) and neighbour link border (line 205); export.py writes the same hex into `.obsidian/graph.json` `colorGroups` (line 983) so Obsidian's graph matches. Kumu: "The default color scale, neon2, can support seven different colors" (https://docs.kumu.io/llms-full.txt, "Color by"). Gephi limits the partition palette to 8 by default (https://jacomyma.github.io/mapping-controversies/1.8/).
Ours: `SHAPE_COLORS` (six accents) colours shapes, and the legend, search results and inspector neighbours reuse it. That part is right.

**Rule 7. The interaction colour is never in the categorical palette.**
Source: graphify uses white for highlight (`highlight: {background: "#ffffff"}`, line 519) and `#6366f1` indigo for hull fill, neither of which is in `COMMUNITY_COLORS`. Cosmograph defaults `hoveredPointRingColor` and `focusedPointRingColor` to white (https://raw.githubusercontent.com/cosmosgl/graph/main/src/config.ts).
Ours: `#38bdf8` sky is shape 0 (49 of 90 sessions), the selected-edge colour, the new-node colour, the pulse ring, and the matrix crosshair. A new node arriving into shape 0 is invisible. Move interaction to white or a hue outside `SHAPE_COLORS`, or drop sky from the shape palette.

**Rule 8. A second attribute goes into the border, the ring, or the fill style. Never a second hue.**
Source: graphify html.py lines 497 to 548: learning status is a ring (`borderWidth: 3`, green preferred, amber contested), stale is grey plus `borderDashes [4, 4]`. Kumu paints multi-value fields as "flags (colored arcs around the outside of your elements)" (https://docs.kumu.io/llms-full.txt, "Color by"). Ogma has `badges`, `halo`, `outline`, `innerStroke` (https://doc.linkurious.com/ogma/latest/api/types/nodeattributes.html).
Ours: Devin sessions are hollow (`fill-opacity .18`, stroke 1.6). Right idea, but no legend row says so, and `verified` is not drawn at all. A thin white ring for verified, hollow for Devin, and both in the legend.

**Rule 9. Dim what is not in play. Hide only on an explicit filter.**
Source: Cosmograph `pointGreyoutOpacity` and `linkGreyoutOpacity`, default 0.1 (https://raw.githubusercontent.com/cosmosgl/graph/main/src/config.ts). Obsidian: "Hovering over any circle highlights that note's connections" (https://obsidian.md/help/plugins/graph). graphify hides filtered communities outright with `hidden: true` and dims the legend row to 0.35 (lines 57, 335).
Ours: selection dims non-neighbours to 0.25 and edges to 0.15, filter hides. Both fine. Hover does nothing to neighbours; only click does.

### Edges

**Rule 10. Weight goes to opacity or width. Type goes to dash. Long weak edges fade first.**
Source: graphify html.py lines 576 to 578, `dashes: confidence != "EXTRACTED"`, `width: 2 or 1`, `opacity 0.7 or 0.35`. The Observable hull notebook uses `stroke-width sqrt(value)` and `stroke-opacity 0.6` (https://observablehq.com/@sbryfcz/d3-force-directed-graph-with-convex-hull). Cosmograph fades edges by screen length: `linkVisibilityDistanceRange [50, 150]` down to `linkVisibilityMinTransparency 0.25` (https://raw.githubusercontent.com/cosmosgl/graph/main/src/config.ts).
Ours: similarity edges `opacity .06 + .3 * w * w`, wrote edges dashed at `.08`. Good. Cross-community edges (the ones that stretch between hulls) should fade further so the hulls stay separate to the eye.

**Rule 11. Arrows only when direction is a fact.**
Source: Obsidian "Arrows: toggles whether to show the direction of each link" (https://obsidian.md/help/plugins/graph). graphify draws arrows at `scaleFactor 0.5` and restores `_src/_tgt` because `calls` and `rationale_for` are directed (html.py lines 561 to 573).
Ours: compression distance is symmetric, no arrows. Correct. `wrote` is directed session to file, and the dash already says it is a different kind.

**Rule 12. Every edge answers "what is this line" on hover.**
Source: graphify html.py line 575, `title: f"{relation} [{confidence}]"` on every edge, and the neighbour list in the inspector (line 213).
Ours: no edge hover. The inspector lists the eight nearest with `1-ncd`. An edge tooltip should say `ncd 0.31, 2nd nearest of A, 4th nearest of B`, which also explains why the graph has that edge at all.

### Hulls

**Rule 13. Hulls are convex, padded, drawn under nodes, low-alpha fill, round joins, and they survive groups of one or two.**
Source: graphify html.py lines 83 to 127: Andrew monotone chain, expanded 1.15 from the centroid, fill alpha 0.12, stroke alpha 0.4, width 2, painted in `afterDrawing`; the comment at line 112 explains why perimeter order must be hull order. Observable: `stroke-width 15`, `stroke-linejoin round`, `stroke-opacity 0.3`, `fill-opacity 0.3`, and `d3.polygonHull` returns null under three points (https://observablehq.com/@sbryfcz/d3-force-directed-graph-with-convex-hull). The older gist pads with `stroke-width 40, opacity .2` and inserts paths before circles (https://gist.github.com/donaldh/2920551).
Ours: four corner points per node at `r + 10` so one-node groups still get a hull. Good. Fill `.07`, stroke `.35`, width 1, no round join. Add `stroke-linejoin: round` and a wide low-alpha stroke as the padding so hulls read as soft islands, not boxes.

**Rule 14. Communities need their own pull, and the picture must stop moving.**
Source: Cosmograph `simulationCluster` (default 0.1) with `pointClusterBy` (https://raw.githubusercontent.com/cosmosgl/graph/main/src/config.ts). graphify uses `forceAtlas2Based` with `gravitationalConstant -60`, `springLength 120`, `avoidOverlap 0.8`, runs 200 stabilisation iterations, then turns physics off on `stabilizationIterationsDone` (html.py lines 170 to 196). The Gephi tutorial: "Stronger gravity activated" and "Gravity set to 0.05" so stragglers do not drift (https://jacomyma.github.io/mapping-controversies/1.8/).
Ours: forceX/forceY to per-community seats on a ring, strength `.08`, seats sorted by shape so shapes are contiguous. 160 pre-ticks before first paint. `alphaDecay .03`, so it settles on its own. Good. `setData` restarts at `alpha(1)` for the whole graph every time a node arrives, which is the arrival problem in section 4.

### Interaction

**Rule 15. Hover shows, click commits, search jumps, legend filters with counts, focus walks out by degree, escape returns.**
Source: graphify html.py: hover sets the cursor and tooltip (lines 238 to 245); click shows the inspector with type, community, source, degree and a colour-coded neighbour list; a neighbour click runs `network.focus(nodeId, {scale: 1.4, animation: true})` (line 218); clicking empty canvas resets the panel to "Click a node to inspect it" (line 256); search matches substring, shows 20, colour bars each hit, and a hit focuses at scale 1.5 and clears the box (lines 260 to 284); the legend has a dot, name, count, a checkbox per community and a Select All with an indeterminate state (lines 290 to 349); a stats line reads `N nodes &middot; E edges &middot; C communities` (line 599). Kumu Focus: `focus: #jack out 2`, `+` and `-` to expand and contract, `esc` to bring the full map back (https://docs.kumu.io/llms-full.txt, "Focus"). Obsidian's local graph has a depth slider (https://obsidian.md/help/plugins/graph). Cosmograph: `selectPointOnClick`, `resetSelectionOnEmptyCanvasClick`, `renderHoveredPointRing`.
Ours: hover tooltip, click select, inspector with nearest list and click-through, search with colour bars, legend with counts and per-row toggles, focus zooms to 1.4, stats strip. Missing: hovered ring, hover-highlight of neighbours, Select All, keyboard (esc to clear, digits or +/- for focus depth), and a focus depth at all.

## 2. What graphify's page has that ours lacks

Checked against `graphify html.py` and `graphify export.py`. `[x]` we have it, `[ ]` we do not, `[~]` partly.

Graph page (`html.py`)

- [ ] Edge tooltip on every edge (`title: relation [confidence]`, line 575).
- [ ] Hovered-node cursor change and hover state tracked separately from click (lines 238 to 251). We change cursor via CSS only.
- [x] Click on empty canvas resets the inspector (line 256). Ours: `svg.on('click')` emits `select null`, app.js writes "Click a node."
- [x] Inspector neighbour list, colour-coded, click-through to focus (lines 201 to 213). Ours: `.nb` rows with `data-id`.
- [~] Inspector fields. graphify: label, type, community name, source file, degree. Ours: task, harness, recorded, tool calls, before first edit, verified, community id, shape id, files changed, nearest 8. Ours shows community and shape as bare integers; graphify shows the community name.
- [x] Search: substring, capped list, colour bar per hit, focus and select on click, input cleared (lines 260 to 284).
- [ ] Legend "Select All" with indeterminate state (lines 292 to 314).
- [x] Legend per group with dot, name, count, toggle (lines 316 to 349).
- [x] Stats line at the bottom (line 599). Ours adds modularity.
- [ ] Physics switched off after stabilisation so nothing drifts (line 194). Ours decays; a drag or a new node restarts everything.
- [x] Node size by degree with floor and ceiling (line 513). Same rule, see rule 4 for why it says less on our data.
- [x] Labels only on hubs (line 515).
- [~] Hull label at the centroid, bold (line 133). Ours has it; text repeats across hulls.
- [~] Status ring on nodes: green preferred, amber contested, grey dashed stale, with a "Lesson:" line in the tooltip (lines 497 to 558). Ours has a hollow ring for Devin only. Nothing marks verified, nothing marks a session that was recalled and helped (the learning overlay idea).
- [ ] Aggregated community meta-graph when the node count is too high: one node per community sized by member count, edges weighted by cross-community edge count (lines 421 to 474). We have 108 nodes and do not need the fallback, but the meta-graph is the natural picture of the shape layer and we have no such view.
- [x] HTML escaping of every label and id before innerHTML (`esc`, line 146). Ours: `esc` in shared.js.
- [x] Arrow only for directed relations. Ours draws none, correct for symmetric distance.

Obsidian export (`export.py to_obsidian`, line 686)

- [x] One note per node with frontmatter and `[[wikilinks]]`. Ours: `src/obsidian.ts`.
- [x] One `_COMMUNITY_` note per community with cohesion, members, tags. Ours: yes, plus a shape tag.
- [ ] "Connections to other communities" with edge counts per pair (lines 939 to 949). Not in our notes and not on our page.
- [ ] "Top bridge nodes": the five members with the highest reach into other communities, listed with degree and reach (lines 951 to 966). Not anywhere in ours. On our graph these are the sessions that sit between two hulls, which is exactly what a reader wants named.
- [x] `.obsidian/graph.json` `colorGroups` so Obsidian's own graph view uses the same palette (line 976). Ours writes colorGroups plus forces (`obsidian.ts` line 215).
- [ ] Dataview live query block per community (line 931). Minor.

Canvas export (`export.py to_canvas`, line 1032)

- [ ] Communities laid out as labelled groups in a grid, cards inside in `ceil(sqrt(n))` columns, only the 200 heaviest edges drawn (lines 1068 to 1204). We have no fixed-layout view. A grid of hulls is a cleaner way to show "13 communities inside 5 shapes" than a force layout when the point is the containment, not the distances.

## 3. Two layers and a distance matrix that explain each other

What we are showing: 90 sessions, a 90 by 90 table of compression distances, 13 communities (average-linkage clustering cut at 0.50 on that table), 5 shapes (the same clustering run again on the 13 community centroids, cut at 0.62). The graph is a picture of the table. The matrix is the table. The two layers are two cut lines on the same number.

### One order everywhere

`src/graph.ts` line 104 already orders the matrix rows by community. Sort communities by shape first, then by community id, and use that one order for: matrix rows and columns, the ring seats in `graph.js` (`clusterCenters`), and the legend rows. Then a hull on the graph, a block on the matrix diagonal, and a row in the legend are the same thing in three places, with one colour and one name. graphify keeps this discipline for colour only (rule 6); we can keep it for order as well because the data is small.

### Two boxes on the matrix

Today `matrix.js` draws one thin box per community on the diagonal and a coloured strip on the top and left. Add the second layer as a second box: a shape box that encloses its communities' blocks, drawn heavier or dashed. Now the reader can see the definition of a shape without being told it: inside a shape box the off-diagonal cells between two community blocks are lighter grey (centroids compress together) than the cells outside the box. Put the two cut values on the greyscale bar as ticks, `0.50` and `0.62`, with the labels "same community below this" and "same shape below this". The `mstats` strip already prints the cuts; the ticks put them on the scale where the eye is.

Source for the pattern: the sorted adjacency matrix is the standard companion to a community-coloured node-link diagram; Gephi's tutorial says to read clusters by "relative size, density, position, and distance between clusters" (https://jacomyma.github.io/mapping-controversies/1.8/), and every one of those four is a block property on a sorted matrix (block size, block darkness, block position, off-block lightness).

### The graph carries the same two levels

Community is the hull outline. Shape is the hull colour (rule 6). That is what `graph.js` does now. Two fixes so the shape level is visible on its own:

1. Draw a shape hull under the community hulls: one wide, very low alpha stroke (rule 13, the Observable padding trick with `stroke-width` about 40 and `stroke-opacity` 0.08, `stroke-linejoin round`) around all sessions of the shape. Adjacent same-colour community hulls then sit inside one soft outline instead of touching as separate blobs.
2. Label the shape once, at its hull, with the histogram we already compute (`flag 29, endpoint 10, bugfix 10`), and label each community with its task id and count. Two label sizes, 11 px and 10 px, in the same mono font.

### Linked hover and selection between the two

- Hover a community hull on the graph: outline its block on the matrix. Hover a block on the matrix: raise that hull's fill alpha on the graph.
- Select a session on the graph: on the matrix, highlight its row and column (already the crosshair on hover), and ring the four darkest cells in its row. Those four cells are its k-nearest edges. This is the sentence "each session keeps its four nearest neighbours" drawn instead of written.
- Hover a matrix cell: light the two nodes and, if a k-nearest edge exists between them, the edge. The cell tooltip already says `ncd = 0.31` and `same community`; add `edge` or `no edge`.
- The community centroid (`clusters[].centroid` in graph.json) gets a label on the graph and a small mark on its matrix row, since it is the session the shape layer was computed from.

Cosmograph's page pairs the graph with histograms and a timeline and filters across them (https://cosmograph.app/). Kumu's Focus walks out by degree (https://docs.kumu.io/llms-full.txt, "Focus"). The matrix row is the same idea: one row is one session's view of every other session, sorted.

### Put them side by side, not on tabs

The matrix at 3 px per cell is 270 px square, and the rail is 300 px wide. A mini matrix in the rail under the legend, always visible, is enough to show 13 blocks and 5 boxes. Clicking it opens the full Distances view. The point of side by side is that a hover on either one moves something on the other, and a tab switch throws that away.

### Numbers to print next to the pair

From `stats` in graph.json: `mean_ncd_within`, `mean_ncd_between`, `modularity`. From `obsidian.ts`: per-community cohesion. From `graph.ts`: the 1-nearest-neighbour agreement (90 of 90 sessions land on the same shape, 88 of 90 on the same task, from the comment at line 71). These are the numbers that say the picture is not an accident, and the page shows only the first three.

## 4. How to show a new node arriving so the eye follows it

What happens in the data: a session is recorded, `graph.ts` rebuilds the whole graph, the server pushes it on `/api/live` as a `graph` event, `app.js` calls `graph.setData(G)` again. `setData` gives the new node a random start within 100 px of the centre, restarts the simulation at `alpha(1)` for all 108 nodes, and colours the new node sky for 8 s (`born`). Separately, `lane:inject` pulses the recalled session, not the new one.

Why the eye cannot follow it today:

- Everything moves at once. Restarting at alpha 1 jiggles all 108 nodes, so the one node that should be the only moving thing is lost in the crowd. graphify avoids this class of problem by freezing physics after stabilisation (html.py line 194).
- The arrival colour is sky, which is also the colour of shape 0, 49 of 90 sessions (rule 7).
- It starts in the middle of the graph. There is no path from "outside" to "its place", so there is no motion to follow.
- Its edges appear all at once with the rest of the redraw. Nothing shows which neighbours it found, or in what order, or which three were folded into its prompt.

The sequence, one thing moving at a time, matching the step captions already in `graph.js`:

1. Freeze the old picture. On a `graph` event, keep every existing node where it is (`fx = x, fy = y` for old nodes) and run the simulation with only the new node free. Release the pins after step 6. graphify: physics off after `stabilizationIterationsDone`.
2. Dim everyone else. Old nodes to greyout opacity, old edges to 0.1, hulls stay. Cosmograph `pointGreyoutOpacity`, `linkGreyoutOpacity` default 0.1 (https://raw.githubusercontent.com/cosmosgl/graph/main/src/config.ts).
3. Enter from the edge that the event came from. The live lanes are in the bottom drawer, so the node enters from the bottom of the stage, at the x of its community seat, in the interaction colour, with a ring. Ogma `pulse`: `startRatio 1`, `endRatio 2`, `duration 1000` ms (https://doc.linkurious.com/ogma/latest/api/types/nodeattributes.html). Ours already has `pulse()` at 1600 ms out to `r + 40`; keep it, but use a colour that is not a shape colour.
4. Draw its four nearest edges one at a time, nearest first, about 250 ms apart, each with `1-ncd` as a label while it draws. The three that were folded into the prompt draw at width 2; the fourth at width 1. The inspector's "Nearest" list fills in the same order, top to bottom. This is the `arrival` caption ("the three closest are folded into what it is handed") drawn.
5. Let the community pull take it. Only now does the node move from the edge to its seat, on its own, with the cluster force at normal strength and the others pinned. The hull for its community grows to include it (the existing 400 ms hull transition does this). If it is a new community, a new hull fades in around one node (our corner-point hull handles a group of one).
6. Add its row to the matrix. Append the row and column at the end of its community block and flash them once. The row shows the four darkest cells lining up with the four edges just drawn.
7. Camera follows, gently. Pan so the node and its four neighbours are in view; do not re-fit the whole graph. graphify: `network.focus(nodeId, {scale: 1.4, animation: true})` (html.py line 218).
8. Fade to normal. Over the next 8 s the fill goes from the interaction colour to its shape colour (`born` already does this), the others come back from greyout, and the pins are released. The new node keeps its label until the next arrival, so "newest" is always readable.

Timing budget: steps 3 to 5 take about 3 s, which fits the 4.2 s per step in `play()`. Nothing else on the page moves during those 3 s.

Two things not to do: do not zoom out to fit (the change is one node, the frame should not change), and do not run this sequence when the tab is not on Graph; queue it and play when the tab opens, otherwise the pins and dims stack up.

The same sequence at half speed is the `sessions` step in the staged reveal: nodes entering one at a time in recorded order, each finding its neighbours, is how the whole graph should be built in front of a viewer, since it is exactly how the data was built.
