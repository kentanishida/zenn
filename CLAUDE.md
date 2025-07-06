# CLAUDE.md

## 開発の進め方について

### MUST

- 新しい開発をする時は、必ず最新の master を取り込んだ master ブランチからブランチを切ること
- 作業した後、下記コマンドを必ずチェックして commit に盛り込むこと。これらが全て error を出さなくなるまで commit しないこと
  - `pnpm test` - Jest テストスイート実行
  - `pnpm check-format` - Biome フォーマット確認
  - `pnpm check-format-and-fix` - フォーマット自動修正
  - `pnpm lint` - リントチェック実行
  - `pnpm typecheck` - TypeScript 型チェック実行
- commit は、必ず下記のようにすること

```bash
git -c user.name="Claude" -c user.email="claude@anthropic.com" commit -m "$(cat <<'EOF'
[コミットメッセージ]

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <claude@anthropic.com>
EOF
)"
```

- push の前に、必ず `git pull origin master`で最新の修正を取り込むこと
- pnpm-lock.yamlの競合がある場合、必ず下記コマンドで直すこと

```bash
pnpm install
```

- commit を作った後、必ず push すること
- push した時、PR がない場合は必ず作ること
- issue が指定されている場合は、必ずそれを PR に明記すること
- push した後 CI の結果がわかるまで必ず確認し、失敗していたら必ず修正をすること
- PR にコメントがあった場合は、その回答を必ず書くこと
  - その際、該当する commit があれば下記のように必ずそのハッシュを記載すること

```txt
[具体的な対応内容]のため、
コミット [hash] で対応しました。

🤖 Generated with [Claude Code](https://claude.ai/code)
```

### BETTER

- コミットの粒度は細かくすること。1ファイル 1commit が望ましい
  - 異なるトピック（機能、依存関係、テスト、ドキュメント）は別々の PR にすること

## コード規約

### MUST

- any 型の使用は禁止
- unknown 型の使用の際は必ずその理由を明記すること