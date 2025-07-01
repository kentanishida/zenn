# Zenn CLI

参考: [📘 How to use](https://zenn.dev/zenn/articles/zenn-cli-guide)

## 記事管理

### ファイル配置ルール
- 記事は個別のmarkdownファイル（`.md`）で管理
- ファイルは`articles`ディレクトリに配置する必要があります

### 記事の作成
新しい記事を作成するには：
```bash
$ npx zenn new:article
```

記事の構造例：
```yaml
---
title: "" # 記事のタイトル
emoji: "😸" # サムネイル用の絵文字
type: "tech" # techまたはidea
topics: [] # タグ
published: true # 公開状態
---
```

### 記事のプレビュー
ローカルで記事をプレビュー：
```bash
$ npx zenn preview
```

### 記事の公開
- 記事のfront matterで`published: true`を設定
- 連携したGitHubリポジトリにコミット・プッシュ

### 公開オプション
- `published_at`を設定して公開スケジュール指定
- 過去の公開日時の指定にも対応

## 本の管理

### 本のディレクトリ構造
```
books/
└── book-slug/
    ├── config.yaml
    ├── cover.png
    └── chapter-files.md
```

### 本の設定（`config.yaml`）
```yaml
title: "本のタイトル"
summary: "本の説明"
topics: ["tag1", "tag2"]
published: true
price: 0
chapters:
  - chapter1
  - chapter2
```

### 本の作成
```bash
$ npx zenn new:book
```

### 本の制限事項
- 1冊あたり最大100チャプター
- チャプターの順序は`config.yaml`またはファイル名の番号で管理可能

## 主要コマンド
- `npx zenn new:article`: 新しい記事を作成
- `npx zenn new:book`: 新しい本を作成
- `npx zenn preview`: コンテンツをローカルでプレビュー

## その他の注意点
- GitHubリポジトリを使用してコンテンツを管理
- 無料・有料の本やチャプターに対応
- 柔軟な公開オプション
