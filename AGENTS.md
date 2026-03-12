# AGENTS

## Build Discipline

- When making code changes, iterate until `npm run build:main` completes with **no TypeScript errors**.
- If a change introduces a build error, fix it immediately and re-run the build.
- Do not leave the project in a failing TypeScript state.

## Output Expectations

- After changes, report whether `npm run build:main` succeeded or list remaining errors to address.
- Prefer small, incremental edits with validation after each significant change.
