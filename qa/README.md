# QA

Checks that run against a **running** Stayora — a started API and a started
frontend — rather than against modules in isolation. They answer the questions
the unit and e2e suites cannot: does the screen show the number the API sent,
does a guard actually close a door, does one booking look the same to the
guest, the partner and the platform.

These lived in a temp directory for most of their life and were lost twice.
That is the whole reason this folder exists.

## Running

```
cd backend  && npm run dev        # :4000
cd frontend && npm run build && npx next start -p 3000
cd backend  && npm run db:seed    # the accounts below
cd qa && npm install
npm run all
```

`http://localhost:3000` and not 3100 or any other port: the API's CORS allows
exactly `WEB_ORIGIN`, so on another port every request fails preflight and the
suites measure CORS instead of the product.

The backend suite (`cd backend && npm test`) uses its own database
(`TEST_DATABASE_URL`), so it can no longer wipe the seed these checks need.

## Accounts

| role | email |
|---|---|
| guest | `guest@stayora.test` |
| partner | `owner@aurora.test` |
| admin | `admin@stayora.test` |

Password for all three: `correct horse battery staple`

## Suites

| file | asks |
|---|---|
| `smoke.mjs` | does one booking travel from guest to partner to platform intact |
| `guards.mjs` | every surface × every role, both directions |
| `boundaries.mjs` | can a signed-in account reach a record that is not theirs |
| `money.mjs` | does every figure on every screen match the API |

`boundaries.mjs` and `guards.mjs` need Chrome at the path in `env.mjs`.
