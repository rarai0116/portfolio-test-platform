# Client Shared Rules

- shared には main と renderer の共有契約や型を置きます。
- renderer 専用または main 専用の責務は shared に混ぜません。
- 契約変更を伴う変更は重大変更に該当し得るため、影響範囲を意識して扱います。