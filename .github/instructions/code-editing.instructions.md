---
description: "Use when editing TypeScript or JavaScript code in this repository. Covers minimal diffs, concise intent comments, local validation, and consistency with the existing architecture."
name: "Code Editing Rules"
applyTo: "apps/**/*.{ts,tsx,js,jsx}"
---
# Code Editing Rules

- SOLID原則に従い、責務を曖昧にしないようにします。
- 変更はタスク達成に必要な最小差分に留めます。
- 非自明な意図、制約、境界条件、既存仕様との整合理由が読み取りにくい箇所には、短いコメントを追加して構いません。
- 自明な代入や逐語的な説明コメントは追加しません。
- 局所修正のために必要な範囲を超えて責務分離や抽象化を増やしません。
- 既存の設計方針やフォルダ責務を尊重し、異なるView間の依存や不要な共有状態を増やしません。
- 実装後は、可能な限り変更範囲に対応した最小の検証を行います。