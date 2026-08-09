## 1. Widen the signature

- [x] 1.1 In `packages/core/src/artifact-order.ts`, widen `byDefaultOrder` to take
      `Pick<ChangeArtifact, "id">` on both parameters
- [x] 1.2 Make `sortArtifacts` generic — `<T extends Pick<ChangeArtifact, "id" | "title">>(artifacts: T[],
      mode: ArtifactSortMode, schemaOrder?: string[]): T[]` — leaving every branch's body untouched
- [x] 1.3 Update the function's doc comment to state that the caller's element type is preserved and that
      the constraint is the fields the rule reads (`id`, `title`)

## 2. Guard it at the type level

- [x] 2.1 In `packages/core/src/artifact-order.test.ts`, add a local interface extending `ChangeArtifact`
      with a field of its own, sort it in each of the three modes, and assign each result back to that
      interface's array type without a cast
- [x] 2.2 In the same test, read the consumer's own field off the sorted result and assert at runtime that
      its value survived the sort
- [x] 2.3 Add the negative case: `@ts-expect-error` on a `sortArtifacts(..., "alpha")` call whose elements
      carry `id` but no `title`
- [x] 2.4 Confirm the guard actually bites — temporarily revert 1.2 and check `npm run type-check` fails on
      the new assertions, then restore it

## 3. Document the constraint

- [x] 3.1 In `packages/core/README.md`'s "Subpath exports" section, state that `sortArtifacts` returns the
      element type it is given and that the element must carry `id` and `title`

## 4. Gates

- [x] 4.1 `npm run build:core` (web imports core's `dist`, so its tests are meaningless without this)
- [x] 4.2 `npm run type-check` — includes core's test files via `tsconfig.test.json`, which is where the
      type-level guard is evaluated
- [x] 4.3 `npm test` (core + ui + web) and `npm run lint`
- [x] 4.4 Check the emitted `packages/core/dist/artifact-order.d.ts` carries the generic signature — that
      declaration is what a registry consumer actually resolves
