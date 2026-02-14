## MODIFIED Requirements

### Requirement: Extension version and changelog
Extension SHALL 維護 CHANGELOG.md 記錄每個版本的功能異動，且 package.json version 欄位 SHALL 與最新 CHANGELOG entry 一致。

#### Scenario: Version bump with new feature
- **WHEN** 新功能（sidebar toggle）已實作完成
- **THEN** package.json version 更新為 `0.2.0`，CHANGELOG.md 包含 `0.2.0` 區塊描述新功能
