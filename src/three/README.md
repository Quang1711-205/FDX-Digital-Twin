# Active 3D implementation

The running entry point is `src/main.tsx` ? `src/app/App.tsx` (imperative Three.js).
Active helpers: `LogisticsFleet.ts` (fleet/material ledger) and `FactoryFloor.ts` (floor/staging layout).

`FinishedGoodsFlow.ts` adds downstream packing workers, a packed-goods pickup bay,
warehouse and dedicated outbound AGVs. AGVs deliver directly from the packing
pickup bay to the warehouse, with no intermediate finished-goods staging area.
It receives one unit when a product exits
the live conveyor. Demo assumptions are in `demo_config.json` under
`resources.finishedGoods`: one worker per line, 60 simulated seconds per packed unit, up to
6 units per AGV load, 60 simulated seconds waiting at the packing pickup bay,
and 30 simulated seconds unloading at the warehouse dock. Packed units remain in the pickup
bay until the AGV collects them. Only main area and production-line labels stay
visible; vehicle and worker labels are revealed by pointer raycasting. Unpacked
products accumulate before the packing table. Adding a packing worker increases
both the forecast capacity and the 3D processing rate. Preview saves/restores the
downstream ledger; applying staffing retains goods already waiting. Forecast
scores penalize packing overload and recommendations include packing staffing.
Outbound AGVs match the movement speed of the supply AGV on the same line,
using its route length, cycle time and handling time (fallback: 6 scene units
per animation second). They follow an orthogonal rectangular route and carry
unused frame time across corners without stopping or dropping cargo. Only the
warehouse receiving dock unloads goods. Cargo lowers into the receiving bay
before stock is credited. These vehicles remain
separate from the material-supply fleet. Warehouse rendering shows at most 36
boxes per line, and the unpacked queue shows at most 48 products; the label
displays the full unpacked count.

Other R3F/TSX scene components in this directory are legacy prototypes. They are not imported by the active App; changing them does not change the running viewport. Retained as references, not as a second implementation path.
