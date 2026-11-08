# Whatswatt

Know what's watt with your energy.

Mobile-first React/TypeScript app with Toronto weather, household-aware temperature suggestions, modeled savings ranges, local feedback, and an isolated demo. See IMPLEMENTATION_PLAN.md for the assumptions and reference sources.

## Run

Requires Node 22.18+ (Node 24+ recommended).

```sh
npm install
npm run dev
```

```sh
npm test
npm run build
```

Select **Explore a sample home** for a fixed-clock walkthrough with two sample responses. Complete onboarding, open Plan, and record the ended Thursday away block. Weekly impact updates independently from potential monthly savings. Exit demo restores the normal household.

Data lives in this browser's local storage. Open-Meteo is the only remote data request. No accounts or thermostat controls.

## Model limits

All figures are illustrative estimates of heating/cooling energy-supply costs, not meter readings or full bills. Reference prices are flat; actual tariffs vary. The model omits thermal inertia, solar gains, humidity and auxiliary heating. Partly means assumed 50% adherence. Zero savings is valid for stable heat-pump settings and inaccessible heating controls.

If forecasts are unavailable, sample weather is labeled and real action impact is disabled. Explicit demo data has separate storage keys. Overlapping historical responses are rejected to prevent double-counting; edit the original response in Week.

## Verification in this workspace

Engine and feedback tests run using Node's built-in TypeScript support. Dependency installation and the production build require npm registry access. Browser rendering must be checked after installing dependencies.

## Deploy to Vercel

From this project folder, run:

```sh
npx vercel --prod
```

Sign in when prompted, choose your personal Hobby account, and create a project named `whatswatt` (or another available name). Use `./` as the project directory. Accept Vite detection with build command `npm run build` and output directory `dist`. No environment variables are required. The CLI prints the deployed URL. Run the same command for later updates.

Vercel's free Hobby plan is for personal, non-commercial use, subject to its usage limits. Sources: [Vite deployment](https://vercel.com/docs/frameworks/frontend/vite), [Vercel CLI](https://vercel.com/docs/cli/deploy), [Hobby plan](https://vercel.com/docs/plans/hobby).

Profiles remain local to each visitor's browser. Your localhost profile does not transfer to the deployed domain. The upload exclusions in `.vercelignore` keep workspace configuration and local dependencies out of the deployment.
