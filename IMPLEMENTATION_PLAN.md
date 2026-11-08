# Whatswatt — Savings-First Implementation Plan

## 1. Product and dashboard

Build the mobile-first React, TypeScript, Vite, and Tailwind application with the exact seven-step onboarding below, Toronto/GTA weather integration, conservative temperature recommendations, local profiles, and daily/weekly plans.

Official name: **Whatswatt**. Tagline: **“Know what's watt with your energy”**. Apply the name to the welcome screen, app header, relevant page titles, browser title, application branding, and documentation. The audience is Ontario residents, initially the Greater Toronto Area (GTA), with Toronto as the default weather location.

This revision follows the supplied Whatswatt requirements. No separate master-document comparison is required.

Flow:

**Open Whatswatt → Onboard with comfort and household occupancy → Retrieve Toronto weather → Calculate personalized recommendations → Monthly potential-savings ranges → Daily/weekly plans and relevant in-app alerts → Report Yes/Partly/No → Separate completed-action impact → Weekly recap**

### Two separate savings types

| Savings type | When displayed | Meaning |
| --- | --- | --- |
| Potential savings | Immediately after onboarding, including before any feedback | What the user could save by following the proposed thermostat schedule, expressed as a modeled monthly equivalent. |
| Completed-action impact | After the user marks recommendations Yes or Partly | Estimated savings associated with actions the user reports taking, over elapsed recommendation periods only. |

Keep potential savings visible after feedback begins. Show completed-action impact in a separately labeled card with its actual date range; never replace potential savings, add the two together, or present either as measured/verified savings. Accept responses only once a recommendation block has ended. Future and in-progress blocks cannot receive feedback or contribute completed-action impact. No/blank responses contribute no impact. With no Yes/Partly entries, use a short invitation to record actions rather than imply measured zero savings.

The results screen presents:

1. **Emissions avoided:** largest element in the first dashboard card, “You could avoid approximately LOW–HIGH kg CO₂e per month,” using the calculated range and a brief environmental-impact explanation.
2. **Money saved:** secondary sage-accented card, “You could save approximately $LOW–$HIGH per month,” using the calculated low/high potential-savings range.
3. **Recommended temperatures:** Home, Away, and Sleeping where applicable, each with a short reason.
4. **Cost comparison:** two accessible horizontal bars labeled “Assumed current habits” and “Recommended plan,” showing estimated CAD/month ranges; bar lengths use central estimates and visible labels show low/high values.
5. **How we calculated this:** collapsed details containing energy consumption, baseline behavior, model assumptions, rates, emissions factors, sources, and limitations.

All displayed numbers come from calculations. Never hardcode example savings figures. Below the primary content, show the separate completed-action impact card once Yes/Partly feedback exists. Place active weather alerts prominently before the temperature cards; safety alerts may precede the savings hero when needed.

Place **“Model-based estimates · 30-day equivalent of this week’s forecast”** immediately beneath the headline metrics. Explain that actual results depend on weather, equipment, building characteristics, and behavior. Use “Estimated heating/cooling energy-supply charges” for the cost comparison; fixed utility fees do not disappear.

Display calculated low–high ranges for money and emissions in both savings categories. Round display bounds outward to whole dollars/kilograms; for an entirely positive range below one unit, use “less than $1” or “less than 1 kg.” Dollar estimates whose lower rounded bound is zero use an upper-bound label such as “Less than $1” or “Less than $2,” without increasing calculated savings. Zero emissions remains 0 kg; an exactly equal positive pair may display one approximate value. Retain full precision internally and apply formatting only after aggregation. These are scenario ranges, not statistical confidence intervals.

Handle honest outcomes:

- Zero modeled savings: “Your plan already prioritizes steady comfort,” with “Less than $1” and the relevant explanation; retain the calculated zero internally.
- Unknown heating equipment: unavailable heating savings, never a fabricated fuel estimate.
- Partial estimates: explicitly identify included equipment; do not present a partial value as total household savings.
- No actionable thermostat control: guidance rather than invented settings or savings.

Use the established reference styling in section 6. Use clear typography, green accents, accessible contrast, large touch controls, and a neutral mobile card layout meanwhile.

## 2. Architecture and interfaces

Keep the application client-only. Separate profile storage, weather loading, recommendation rules, estimation calculations, and UI components. Use React state with hash navigation and lightweight HTML/CSS comparison bars.

Retain these domain contracts:

- `HouseholdProfile`: version 2, heating system, thermostat control, home type, bedrooms, cooling equipment, occupancy, `othersHomeWhenAway`, optional wake/bedtime, preferred Celsius temperature.
- `Forecast`: source (`live`, `cached`, `demo`), retrieval timestamp, `America/Toronto` timezone, current conditions, hourly temperature/weather codes, seven daily highs/lows/conditions.
- `Recommendation`: stable ID, plan revision, equipment scope, start/end timestamps, heating/cooling mode, home/away/sleep period, nullable target temperature, action type, reason, energy-saving direction, assumptions, safety limitations.
- `EnergyEstimate`: fuel/unit; baseline, recommended, and saved consumption; corresponding costs/emissions; reduction percentage; low/central/high scenarios.
- `WeatherLocation`: shared location configuration containing latitude, longitude, display name, province, region key, and timezone. The prototype uses Toronto/GTA, Ontario, and `America/Toronto`.
- `CalculationConfig`: regional preset ID/version, dated and sourced Ontario rates, emissions factors, gas energy conversion, and separately documented prototype assumptions.
- `Outlook`: estimates, unavailable reasons, assumptions, and projection-period label.

Add a small presentation contract derived from the estimation output:

```ts
interface EstimateRange {
  low: number;
  central: number;
  high: number;
}

interface SavingsSummary {
  status: "available" | "partial" | "unavailable";
  monthlySavedCad: EstimateRange | null;
  monthlyAvoidedKgCO2e: EstimateRange | null;
  baselineMonthlyCad: EstimateRange | null;
  recommendedMonthlyCad: EstimateRange | null;
  includedSystems: string[];
  unavailableReasons: string[];
  periodLabel: string;
}
```

Calculate this summary centrally, not independently inside dashboard cards. Sum paired scenario results before deriving displayed ranges.

Add these small local data contracts:

```ts
type OthersHomeWhenAway = "yes" | "no" | "varies" | "alone" | "unknown";
type FeedbackResponse = "yes" | "partly" | "no";

interface RecommendationFeedback {
  recommendationId: string;
  response: FeedbackResponse;
  updatedAt: number; // epoch milliseconds
}

interface ActionSnapshot {
  recommendationId: string;
  planRevision: string;
  start: number; // epoch seconds
  end: number;
  equipmentScope: "home-heating" | "central-cooling" | "room-cooling";
  mode: "heating" | "cooling";
  targetC: number;
  forecastSource: "live" | "cached" | "demo";
  modelVersion: string;
  configurationVersion: string;
  intervals: Array<{
    start: number;
    end: number;
    savedEnergy: EstimateRange;
    savedCad: EstimateRange;
    avoidedKgCO2e: EstimateRange;
  }>;
}

interface CompletedActionImpact {
  periodStart: number;
  periodEnd: number;
  completedCount: number;
  partlyCompletedCount: number;
  savedCad: EstimateRange | null;
  avoidedKgCO2e: EstimateRange | null;
  limitations: string[];
}

interface WeatherAlert {
  id: string;
  kind: "cold" | "heat-wave" | "temperature-change";
  startsAt: number;
  endsAt: number;
  message: string;
  action: string;
  forecastSource: "live" | "cached" | "demo";
}
```

Keep `SavingsSummary` as the potential-savings output; do not overload it with completed-action totals. Store versioned feedback and immutable action snapshots separately from the editable household profile. Snapshot the per-interval paired-model differences when an actionable plan is presented, with enough provenance to explain historical figures. Persist alert dismissals separately. Validate timestamps, enums, IDs, and finite numeric ranges on storage reads.

Migrate version-1 profiles by setting `othersHomeWhenAway` to `unknown` and using conservative occupied-home rules until the answer is supplied through Profile. Invalidate weather caches for any previous location/timezone. Profile or forecast changes recalculate future recommendations but never rewrite historical impact snapshots.

Validate stored profiles and API responses. Persist completed profiles locally; editing them recalculates every screen. Storage failures retain the working profile in memory and explain that changes cannot be saved.

## 3. Weather and recommendation rules

Use Open-Meteo for Toronto (`43.6532, -79.3832`) with `America/Toronto`. Request Unix timestamps and format through `Intl.DateTimeFormat` to handle DST correctly. Retrieve current conditions, hourly temperatures/codes, and seven daily highs/lows.

Use the same `WeatherLocation` object for the weather request and regional rate selection. Its region key is `toronto-gta`; derive neither the utility territory nor the tariff from the timezone or forecast response. The default location is sufficient for the prototype: no GPS permission, location picker, reverse-geocoding service, or additional onboarding question is required.

Use valid cached weather up to 24 hours old only when it covers the required dates; otherwise use clearly labeled demonstration weather. Display weather provenance and never silently combine live and demonstration forecasts.

### Exact onboarding questionnaire

Use the following wording and options. Steps 1–5 reproduce the supplied questions; steps 6–7 retain the previously agreed household-occupancy and preferred-temperature questions. Require one answer per selection group, including both home type and bedrooms; wake time and bedtime remain optional.

**1. What heats your home?**

- Gas furnace or boiler
- Electric baseboard heaters
- Heat pump

**2. Who controls your heat?**

- I have my own smart thermostat (Nest, ecobee, etc.)
- I have my own regular thermostat
- My building controls it
- I share it with roommates
- Not sure

**3. What kind of home do you live in?**

Home type: Apartment / Townhouse / House

Bedrooms: 1 / 2 / 3 / 4+

**4. How do you cool in summer?**

- Central AC
- Window or portable unit
- Fan only
- Nothing

**5. When are you usually out?**

- Home most of the day
- Out on weekdays
- It varies

Optional: wake time and bedtime

**6. Is anyone usually home when you're away?**

- Yes, someone is usually home.
- No, the home is usually empty.
- It varies.
- I live alone.

**7. What's your preferred indoor temperature?**

Use the Celsius selector specified below, defaulting to 21°C. This is the user's comfort preference. Allow all answers to be edited later in Profile. Show seven-step progress; do not add billing or location questions.

### Household occupancy rules

Only permit an away setback/increase when the user's schedule is away AND the answer is “No” or “I live alone.” For “Yes,” “It varies,” missing, or unknown answers, treat those periods as occupied and maintain the occupied comfort target. Apply this to heating and cooling, including room AC: without room-specific occupancy evidence, assume the room may be occupied. Existing “It varies” personal schedules remain occupied by default. Explain household-comfort reasoning in affected recommendations. Sleep guidance retains the existing conservative limits and notes the assumption that the household shares that sleeping routine.

Routine defaults:

- Preferred temperature 21°C; selector supports 18–26°C in 0.5°C increments.
- Default wake 07:00 and bedtime 23:00, disclosed when omitted.
- Weekday absences 09:00–17:00.
- “Home most of the day” and “It varies” assume occupied daytime.
- Sleep overrides overlapping away periods; support overnight sleep and reject equal wake/bedtimes.

Generate hourly rules and merge identical adjacent blocks:

- **Gas furnace/boiler:** preference while occupied; at most 1°C setback during sleep or absences lasting at least four hours.
- **Baseboard:** up to 2°C setback away and 1°C asleep.
- **Heat pump:** stable preferred temperature; no invented setback savings.
- **Unknown heating:** stable-temperature guidance and unavailable fuel-specific heating estimates.
- Minimum recommended heating target 18°C; suppress setbacks when any hour of the block is at or below −15°C.
- **Central AC:** preference occupied/asleep; up to 2°C warmer during extended absences, capped at 26°C.
- **Room AC:** equivalent guidance conditional on that room’s occupancy; explicitly model one room.
- Suppress cooling away increases when forecast highs reach 30°C.
- **Fan/no AC:** no fictional cooling temperatures or AC consumption; practical shading, ventilation, and heat-safety guidance.

Smart thermostats receive programming instructions; regular thermostats receive manual actions; shared thermostats receive schedules requiring agreement. Building/unknown control receives no actionable heating settings or quantified heating savings. Do not assume control of central AC in these profiles; room AC can remain independently actionable.

Use separate heating and cooling sections for mixed weather, with a 2°C neutral band above the comfort preference. Do not recommend simultaneous operation. Explain that prototype safety guardrails cannot guarantee indoor safety or building protection.

### In-app weather alerts

Keep configurable prototype thresholds in the rules configuration:

- **Extreme cold:** any forecast hour at or below −15°C; advise maintaining comfortable heating and apply the existing cold setback suppression.
- **Heat wave:** at least two consecutive local dates with daily highs at or above 30°C; advise indoor-temperature monitoring and safe cooling. The existing single-day 30°C cooling guardrail still applies even without a heat-wave alert.
- **Significant change:** an absolute change of at least 10°C between hourly forecasts 24 actual hours apart; state whether warming or cooling is expected and suggest reviewing the upcoming schedule. Do not introduce additional aggressive setpoints.

Evaluate the seven-day forecast, merge contiguous qualifying intervals by alert kind, and sort active alerts by safety relevance and onset. Label every card “Forecast-based advisory”; these thresholds are prototype settings, not official ECCC warnings. Do not claim official warning status. Show cached/demo provenance and never represent demonstration alerts as real weather events.

Persist one dismissal per location, alert kind, and event. Match refreshed events of the same kind whose time windows overlap to retain IDs; do not repeat dismissed cards on routine refreshes. Keep dismissed active advisories available in the weekly view. Resurface only if the event crosses an additional safety threshold or a distinct new event begins. Safety rules still apply after dismissal. No push notifications, notification permission prompts, or background service are needed.

## 4. Estimation and transparency

Use a paired hourly heat-loss model with identical home, weather, and equipment assumptions in both scenarios.

Prototype assumptions:

- Bedroom-based area proxies: 50/75/100/125 m² for 1/2/3/4+ bedrooms.
- Heat-loss coefficients: apartment 0.8, townhouse 1.2, house 1.8 W/m²/K.
- Low/high effective heat-loss scenarios: 0.6×/1.6× central.
- Gas efficiency 85%; baseboard 100%.
- Heat-pump COP: 3 above 5°C, 2 from −10°C through 5°C, 1.5 below −10°C; disclose the electric-only assumption.
- Central AC COP 3; room AC COP 2.5 with modeled room area capped at 20 m².

Label these as prototype assumptions, not measured characteristics or Canadian housing averages.

```text
H = assumed area × heat-loss coefficient / 1000

Heating demand = H × max(0, heating target − outdoor temperature) × hours
Cooling demand = H × max(0, outdoor temperature − cooling target) × hours
```

Convert thermal demand using equipment efficiency/COP and documented gas energy content.

For consistency between temperatures shown and modeled:

- Baseline assumes the preferred temperature whenever heating or cooling is active.
- Recommended scenario uses the generated thermostat targets.
- Apply the same outdoor eligibility rule to both: heating below preference, cooling above preference + 2°C, neither inside the neutral band.
- Disclose this simplified equipment-operation model; it does not simulate indoor temperature, recovery, solar gains, or humidity.

Scale the forecast totals to a 720-hour equivalent, using actual timestamp durations. This is not a forecast of next month’s bill.

```text
Energy saved = baseline − recommended
Electricity savings = saved kWh × CAD/kWh
Gas savings = saved m³ × configured CAD/m³
If the source quotes CAD/GJ: CAD/m³ = kWh/m³ × 0.0036 × CAD/GJ
Emissions avoided = saved energy × matching emissions factor
```

Select a bundled regional rate preset using the same location configuration used for weather. For the prototype, map `toronto-gta` to one Toronto/GTA preset containing electricity and gas reference prices plus applicable emissions factors and gas energy content. Keep the mapping and constants in one small TypeScript module. Location selects a regional estimate; it does not identify the user's actual utility plan, contract, or precise gas service territory.

No utility APIs, live rate feeds, bill uploads, provider connections, rate-entry screens, or additional onboarding questions are needed. Developers can update the constants manually. The existing Open-Meteo weather integration remains the only external data integration. More regional presets may be added later without building a multi-region location interface now.

If a location has no matching preset, return unavailable cost/emissions estimates with an explanation rather than silently applying Toronto prices elsewhere. A weather-fetch failure for the supported location does not change its preset. Keep the preset ID/version in calculation provenance and historical action snapshots through `configurationVersion`, so future location or preset changes cannot rewrite completed-action impact.

### Bundled Toronto/GTA constants

Use preset ID `toronto-gta`, configuration version `ontario-reference-2026-11-07-v1`. The values below are selected reference assumptions, checked on 2026-11-07; they are not a household tariff or a promise to track future rate changes. Store full precision and source metadata in the constants module.

| Constant | Value | Basis and source |
| --- | --- | --- |
| `electricityCadPerKwh` | `0.112` CAD/kWh | OEB Tier 1, 11.2 cents/kWh, effective November 1, 2026; applied flat for the prototype. [OEB electricity rates](https://www.oeb.ca/consumer-information-and-protection/electricity-rates). |
| `gasCadPerM3` | `0.094741` CAD/m³ | Enbridge Rate 1 gas supply commodity charge, 9.4741 cents/m³, effective October 1, 2026. Excludes cost adjustments, transportation, delivery, fixed charges, and taxes. [Enbridge residential rate notice](https://www.enbridgegas.com/-/media/Extranet-Pages/ontario/residential/myaccount/rates/EGD---Rate-1---System-Notice.pdf). |
| `electricityKgCO2ePerKwh` | `0.073` kg CO₂e/kWh | Ontario consumption intensity, 73 g/kWh, Table 5.4/footnote 42, sourced to the 2026 National Inventory Report covering 2024. Use as a historical annual-average reference, not a measured 2026 or marginal factor. [ECCC reference values](https://www.canada.ca/en/environment-climate-change/services/climate-change/pricing-pollution-how-it-will-work/output-based-pricing-system/federal-greenhouse-gas-offset-system/emission-factors-reference-values.html). |
| `gasKgCO2ePerM3` | `1.931311` kg CO₂e/m³ | Derived from Ontario marketable-gas CO₂ (1,921 g/m³) and residential combustion CH₄/N₂O (0.037/0.035 g/m³), Tables 1.1/2.1, based on the 2023 inventory covering 2021. [ECCC factors](https://www.canada.ca/en/environment-climate-change/services/climate-change/pricing-pollution-how-it-will-work/output-based-pricing-system/federal-greenhouse-gas-offset-system/emission-factors-reference-values.html). |
| `gasKwhPerM3` | `0.0373 / 0.0036` (approximately `10.361111`) kWh/m³ | Approximate Canadian conversion of 0.0373 GJ/m³; retain the expression without rounding in calculations. [NRCan natural gas primer](https://natural-resources.canada.ca/energy-sources/fossil-fuels/natural-gas-primer). |

Gas CO₂e is `(1921 + 0.037 × 28 + 0.035 × 265) / 1000`. The 100-year GWP multipliers are 28 for CH₄ and 265 for N₂O ([ECCC GWP guidance](https://www.canada.ca/en/environment-climate-change/services/climate-change/greenhouse-gas-emissions/quantification-guidance/global-warming-potentials.html)). This covers combustion, excluding upstream gas leakage. Gas energy content varies; the conversion is an explicit approximation, with the gas efficiency assumption used on the same gross-energy basis.

Use the electricity source's published date and gas notice's effective date; emissions reference years are separate and must remain visible. ECCC Table 5.4 has a caption/applicability-year inconsistency; use the underlying 2024 inventory year identified by footnote 42, not its caption as a forecast year. These are prototype accounting references, not offset-credit calculations.

Show “Energy-supply cost estimate” beside the cost comparison. Exclude electricity delivery/regulatory charges, taxes, rebates, gas adjustments/transportation/delivery, and all fixed fees. Do not call the results full bill savings. No rates are fetched at runtime. Invalid/missing constants yield unavailable outputs, not invented savings; normal operation uses the populated preset above.

Label estimates “Estimated using reference rates for Toronto/GTA,” with the region name supplied by the selected preset. Show this explanation in calculation details: “We use regional reference prices and emissions factors based on your weather location. Your actual utility plan and home may differ.” Keep individual tariff and building uncertainty explicit. The home-size/heat-loss proxies above remain generic prototype assumptions, not Ontario housing measurements.

Explain that electricity emissions use average intensity, not verified marginal avoided emissions. Exclude fixed charges, taxes, and unmodeled delivery charges from the cost claim.

Derive low/high outputs from paired scenarios: calculate baseline minus recommended within each scenario, then apply its matching rate/factor. Never subtract unrelated low and high endpoints to manufacture a savings range. Sum matching scenario values before taking output bounds; preserve any negative outcomes rather than disguising cost increases as savings.

Keep kWh and m³ separate and inside methodology details. Never characterize modeled heating/cooling consumption as total household energy. Zero baseline yields an unavailable percentage rather than division by zero.

### Recommendation feedback and completed-action impact

Each actionable temperature recommendation includes **“Did you follow this recommendation?”** with **Yes / Partly / No**. Allow edits and show the selected response. Future and in-progress blocks remain visible with “Available after this period ends”; feedback is enabled only when `now >= effectiveEnd`, and the same condition is checked when saving or loading responses; guidance without an accessible thermostat action has no quantified savings feedback. Daily and weekly views reference the same recommendation ID.

- Use a deterministic ID based on plan revision, equipment scope, mode, start/end, and target. Store one current response per ID; changing a response replaces it rather than appending another credited action.
- Yes uses 100% of the snapshot's modeled saving for its ended, authoritative intervals; Partly uses 50%; No/unanswered uses 0%. The 50% is a disclosed hackathon assumption about adherence, not measured duration or energy. Do not ask an extra percentage question.
- Compute each interval's modeled difference once. Include only blocks that have ended, then clip their intervals to the reporting window and authoritative plan revision; prorate partial hours by actual seconds. Passing time alone must not create new reported impact from a response on an unfinished block. Apply the feedback multiplier to each low/central/high energy, cost, and emissions value before aggregation.
- Maintain one authoritative recommendation per equipment scope and instant. Split intervals at overlaps and revision boundaries; the newer plan applies only from its activation time onward. Older recommendations are superseded for future intervals. When an active block is superseded, its `effectiveEnd` becomes the revision activation time; preserve that ended segment for feedback and show its actual covered times. A wholly future superseded block is not eligible for feedback. Use the original end for unchanged blocks. Alerts and summary cards refer to these same actions and never create separate savings credits.
- Persist the plan revision's activation timestamp. IDs and interval ownership survive refresh/reload, so repeat responses, forecast updates, and profile edits cannot credit the same interval twice. Revising past feedback changes its associated historical total; refreshing weather/rates does not.
- Do not scale completed-action impact to 30 days. Label it **“Estimated impact of your reported actions”**, include actual dates, and explain that it uses forecast-based model snapshots and self-reported adherence, not meter readings. If required rate/factor inputs were unavailable for a snapshot, retain unavailable impact for that component rather than treating it as zero.
- Exclude demo-weather actions from normal impact totals and counts; if feedback is demonstrated on demo data, show a separate labeled demo recap. Historical real/cached actions retain their provenance.

### Weekly actions recap

Add an expandable recap within the existing weekly outlook and link the dashboard's impact card to it. Use the current Monday–Sunday week in `America/Toronto`, clipped to elapsed time.

Show unique ended recommendations marked Yes, unique ended recommendations marked Partly, and low/high CAD and kg CO₂e impact for the week's covered intervals. An action spanning a week boundary contributes impact only for the intersecting time; count it once in the week it ends. Show in-progress recommendations only in the temperature plan, with feedback disabled; they do not appear as completed or contribute provisional impact. Use `effectiveEnd` for superseded blocks and weekly count assignment. No/blank entries do not count as completed. Deduplicate by recommendation ID and exclude superseded, wholly unexecuted intervals.

Provide simple factual progress copy, such as completed and partly completed counts, without inventing streaks or measured improvements. Distinguish this recap from the future seven-day weather outlook. Corrected feedback updates the recap immediately. Show a useful empty state and retain the potential-savings dashboard unchanged.

### Repeatable demo scenario

Add “Try a demo” to Welcome and an always-visible “Demo — sample household and weather” banner with Exit/Reset actions. This is an explicitly separate session with isolated local-storage keys for profile, snapshots, feedback, and dismissals. Exiting restores the user's real data; reset clears only demo state. Offline weather fallback alone must not overwrite a real profile or inject sample feedback.

- Freeze the demo clock at **2026-11-05 18:00 America/Toronto** (`2026-11-05T18:00:00-05:00`). Inject this clock into rules, feedback eligibility, and recap calculations; the real app uses the actual clock.
- Sample profile: gas furnace/boiler, regular thermostat, house, three bedrooms, central AC, out on weekdays, home usually empty, wake 07:00, bedtime 23:00, comfort 21°C. Show these answers in onboarding and allow them to be edited.
- Bundle seven days of hourly demonstration weather for November 2–8, 2026. For each local day repeat six four-hour temperatures: −4, −3, −1, 2, 3, 1°C, with weather code 3 (overcast). Derive daily highs/lows and the current reading from those hours. Label all dates as sample dates and use the same Toronto/GTA rate preset; no weather request is required in explicit demo mode.
- Generate the initial sample plan from Monday November 2 at 00:00 using the normal engine. Seed only two sample feedback responses: Monday's 09:00–17:00 away block = Yes; Tuesday's corresponding block = Partly. Keep Thursday's ended away block unanswered for the live walkthrough. Generate snapshots and savings from the model, not hardcoded outcome figures.
- Walkthrough: finish the prefilled onboarding → see potential monthly ranges → open today's ended away recommendation → select Yes → see demo completed-action impact and the recap increase → change to Partly/No and observe replacement rather than duplication. Initial recap counts are one Yes and one Partly; future/in-progress blocks cannot be marked.
- Reuse the fixture with a cold variation (Friday 00:00–08:00 at −16°C) in tests to exercise alerts and setback suppression. Keep the normal demo mild enough to demonstrate nonzero heating savings.

Demo snapshots and counts remain excluded from normal completed-action totals. Reset returns the identical fixture and two sample responses. Demo outcome numbers use the same code paths and assumptions as normal estimates.

## 5. Implementation checklist and validation

1. Scaffold Whatswatt with the official tagline/browser title; implement the exact seven-step questionnaire in section 3, validation, and accessible controls.
2. Add versioned profile persistence/migration, editing, and immediate Outlook navigation.
3. Implement Toronto weather/timezone configuration, validated retrieval/cache, labeled demo fallback, and deduplicated in-app advisories.
4. Implement household-aware recommendation functions and equipment/control tests.
5. Bundle the populated Toronto/GTA constants in section 4 and select it from the shared weather location; implement paired scenarios and potential-savings ranges without utility integrations or user-supplied billing data.
6. Build the savings-first dashboard, collapsible methodology, daily plan, and weekly outlook; add stable action snapshots, editable local feedback, separate completed-action impact, and the weekly recap.
7. Add the isolated fixed-clock demo and reset/exit behavior. Preserve the reference palette/layout and apply it to range metrics, feedback controls, advisory cards, and recap; verify mobile responsiveness.
8. Run unit tests, TypeScript checking, production build, and an end-to-end onboarding walkthrough.

Required checks:

- Gas and electric setbacks; cold-weather suppression; stable heat pumps.
- Building-controlled/shared/unknown heating; fan-only and no-AC households.
- Room AC scope, extreme heat, mixed weather, and zero-demand cases.
- Toronto coordinates/timezone, Ontario-only configured factors, DST transitions, overnight sleep, weekends, and browsers outside Ontario.
- Shared weather-location selection resolves the Toronto/GTA preset; unsupported locations return unavailable estimates, weather fallback retains the preset, and historical action estimates retain their original configuration version.
- All four household-occupancy answers plus missing/unknown: away setbacks only when the home is explicitly empty; migration defaults to occupied.
- Potential ranges appear before any feedback and remain independent after responses; no completed-action monthly extrapolation or addition to potential savings.
- Yes/Partly/No edits, repeated clicks, reload persistence, missing rates, rejection of in-progress/future feedback, ended superseded segments, partial hours, overlapping revisions, and daily/weekly views cannot double-count impact.
- Weekly boundaries/DST, cross-week actions, zero/negative/unavailable ranges, demo isolation/reset, and immutable historical snapshots. Verify the seeded demo begins with one Yes and one Partly and the ended Thursday action can be recorded immediately. Advancing the clock without feedback must not accrue completed-action savings.
- Cold/heat-wave/change threshold boundaries, alert provenance, event deduplication/dismissal, safety escalation, and no official-warning claims.
- Matching baseline/recommended assumptions, fuel conversions, range aggregation, partial totals, and zero savings. Confirm money/emissions calculations use bundled constants without rate-network requests or utility setup.
- Offline weather, malformed responses, corrupt storage, and unavailable persistence.
- Dashboard shows emissions first, dollars second, temperatures third, cost bars fourth; technical consumption units appear only in details.
- Profile edits update headline savings, charts, and plans consistently.
- Within five seconds, a mobile user can identify potential dollar savings, emissions impact, and the recommended temperature.

Hackathon exclusions: implementation is not part of this document revision; no IoT, Green Button, authentication, payments, real thermostat controls, push notifications, complex backend, utility/rate integrations, bill uploads, tariff optimizer, or full building simulation. Keep the existing navigation and design system.  
Main risks: general reference prices, sparse household inputs, and assumed adherence make impact illustrative; bundled constants have dated source references and must be updated deliberately when the reference preset is revised.

## 6. Colour scheme and UI look — reference-based direction

This section resolves the earlier pending visual direction. Use `references/a.png` as the authoritative colour palette and the two WebP images as references for layout, shapes, typography, and visual softness. Preserve the savings-first content hierarchy and all functional requirements above.

### Colour palette

| Token | Hex | Application |
| --- | --- | --- |
| Deep teal | `#114B5F` | Primary text, main action buttons, navigation capsule, focus rings, and prominent money values. |
| Emerald | `#1A936F` | Savings accents, recommended-cost bars, progress indicators, and decorative environmental icons. |
| Soft green | `#88D498` | Selected answer backgrounds, active indicators, and soft highlights around recommended temperatures. |
| Sage | `#C6DABF` | Secondary surfaces, baseline-cost bars, subtle separators, and weather-card backgrounds. |
| Warm cream | `#F3E9D2` | Main page background and warm welcome-screen accents. |
| White | `#FFFFFF` | Primary card surfaces, inputs, and text on deep-teal buttons. |

Use deep-teal text on cream, sage, soft green, and white surfaces. Do not use emerald or soft green for small text on white, or assume white text on emerald has sufficient contrast. Use deep teal for labeled buttons and selected-control borders. Confirm WCAG AA contrast during implementation: 4.5:1 for normal text and 3:1 for large text and essential UI boundaries. Pair colour with labels, icons, or selection marks.

### Reference styling

- `references/original-5337689e1e8baf73acd771595516a8bf.webp`: use its airy rounded cards, generous whitespace, compact weather presentation, soft background colour, and pill-shaped navigation as the overall visual direction.
- `references/original-9d1c732ff36a1f78fe15af12234fac56.webp`: use its stacked mobile panels, oversized numbers, restrained line icons, rounded chart bars, and circular temperature emphasis for screen composition.
- Replace the references’ lime accents and black navigation with the supplied green palette and deep teal. Apply the style to Whatswatt content; do not copy appliance controls, account avatars, notification buttons, or device power controls.
- Render actual responsive screens, without decorative phone frames, fake status bars, or device mockups. Do not reproduce the reference branding.

### Layout, typography, and components

- Use a system sans-serif font stack with no external font dependency. Body text is 16px, supporting text 14px, screen titles 24–28px, and the main savings figure 44–56px. Use medium or semibold headings and tabular numerals for financial comparisons.
- Use a 4px spacing scale, 16px mobile page gutters, 16–24px card padding, and 12–16px gaps. Cards have 24–32px rounded corners and a very light shadow; inputs and answer tiles have 16px corners. Buttons and navigation use pill shapes.
- Keep one column on phones. At wider widths, centre the content within roughly 960px and allow supporting cards to form two columns while keeping emissions avoided first in reading order.
- Place the bottom navigation in a floating deep-teal capsule with four labeled destinations: Outlook, Plan, Week, Profile. Use a white active pill with deep-teal text and a soft-green indicator. Keep every target at least 44px tall, account for bottom safe-area insets, and pad page content so the navigation never obscures it.
- Use simple, consistent outline icons. Weather icons may use soft filled shapes. Avoid heavy gradients and elaborate animations; any transitions should be brief and respect reduced-motion preferences.

### Apply the style to each screen

- **Welcome:** warm cream background, a generous white rounded panel, concise Whatswatt introduction with “Know what's watt with your energy”, and a deep-teal start button. Optional subtle sage/soft-green background shapes can provide the softness of the reference without requiring new imagery.
- **Onboarding:** show one question per step in a white card, a slim progress indicator, and large rounded answer tiles. Selected answers use soft green with a deep-teal border and checkmark. Use a labeled native range control with minus/plus buttons for temperature and a large Celsius readout; preserve keyboard operation.
- **Savings dashboard:** place the emissions-avoided range in the first and most prominent white card, with kg CO₂e/month and its model-estimate label directly beneath it. Put monthly dollar savings in a smaller sage-accented card. Follow with Home/Away/Sleep temperature cards, then the two cost bars, then the collapsed methodology section. Energy units stay within methodology details. Use a separately labeled card for completed-action ranges and prominent, dismissible forecast-advisory cards; do not merge their figures into potential savings.
- **Temperature plan:** use a large circular temperature readout inspired by the reference dial, explicitly labeled as a recommendation. Keep it informational rather than suggesting live thermostat control. Below it, show rounded time-block cards with temperature, period, reason, and relevant limitations. Add an accessible Yes/Partly/No segmented radio group to actionable recommendations.
- **Weekly outlook:** use compact rounded daily cards with Toronto dates, weather icons, high/low temperatures, and short recommendations. Use text and an icon for special considerations rather than colour alone. Add an expandable weekly actions recap with separate Yes/Partly counts and self-reported impact ranges; no new navigation destination.
- **Profile:** reuse the onboarding controls and card styling, with a clear save action and feedback that recommendations have been updated.

### Visual acceptance checks

- Verify the palette matches `a.png`, while card composition and navigation visibly follow the WebP references.
- At 320px and 390px widths, verify readable labels, no horizontal overflow, usable controls, and unobscured content above navigation.
- Ensure the emissions estimate is the dominant element within the first viewport; monthly dollar savings and recommended temperatures follow in the specified order.
- Verify keyboard focus, selected states, contrast, text enlargement, reduced motion, and chart labels that remain understandable without colour.
- Check long range labels, feedback controls, advisory dismissals, and recap empty states on small screens without changing the palette or card system.
- Render unavailable, zero-savings, loading, and demonstration-weather states with the same polished card structure and clear explanatory text.

No application UI has been implemented as part of this plan update. Colour contrast and responsive rendering remain implementation acceptance checks.
