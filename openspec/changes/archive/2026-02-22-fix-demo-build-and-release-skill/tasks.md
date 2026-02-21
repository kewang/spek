## 1. Fix demo build script

- [x] 1.1 在 `scripts/build-demo.ts` 的 `scanOpenSpec(ROOT)` 呼叫前加上 `await`

## 2. Update release skill

- [x] 2.1 在 `.agents/skills/release/SKILL.md` 步驟 4（commit changelog）之後新增步驟 5：rebuild demo（`npm run build:demo` + commit）
- [x] 2.2 順延後續步驟編號（原 5→6, 6→7, 7→8）

## 3. Rebuild demo

- [x] 3.1 執行 `npm run build:demo` 確認成功
- [x] 3.2 確認 `docs/demo.html` 已更新
