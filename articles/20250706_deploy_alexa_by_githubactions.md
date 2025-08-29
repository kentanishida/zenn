---
title: "Alexa スキルを GitHub Actions でデプロイする"
emoji: "🚀"
type: "tech"
topics: ["alexa", "githubactions"]
published: false
---

Alexa のスキル開発において、毎度デプロイするのが面倒だったため GitHub Actions を用いて自動でデプロイする仕組みを作りました。

## 👤 想定読者

- ask deploy を GitHub Actions を用いて自動化したい人

## 📂 プロジェクト構成

プロジェクト構成は以下の通りです。この記事では特に、デプロイ用の設定がある `.github/workflows/` と `ask-resources.json` にフォーカスします。（なぜデプロイと関係なさそうな `ask-resources.json` が対象なのかは後述します）

```text:プロジェクト構成
.github
└── workflows
  ├── _deployAlexa.yml # 実際に処理を行うワークフロー
  └── ciForMaster.yml  # 実際に処理を呼び出すワークフロー
  
  # 以下関係ないので略記します
```

```text:ask 構成
.
├── .ask
│   └── ask-states.json # デプロイ後にここの値が書き換わるので commit して PR にします
├── ask-resources.json  # デプロイに関数メタ情報が書かれているファイル

# 以下関係ないので略記します
```

## 📄 Alexa スキルファイルについて

### デプロイするプロファイルの設定について （`ask-resources.json`）

一見この記事の内容に反していそうなのですが、実は 1点落とし穴があるためここで取り上げます。
それは、Github Actions でデプロイするに当たって指定するプロファイル名が、`__ENVIRONMENT_ASK_PROFILE__` という文字列でないと、ask deploy の後にコマンドで指定する秘匿情報が一切渡せないということです。（[参考](https://developer.amazon.com/en-US/blogs/alexa/alexa-skills-kit/2020/06/using-the-ask-cli-v2-0-to-continuously-deploy-your-skill)）

```json:infrastructure/ask/ask-resources.json
{
  "askcliResourcesVersion": "2020-03-31", # ASK CLI リソース定義スキーマのバージョン。 2020-03-31 の指定一択らしい
  "profiles": {                           # デプロイするプロファイル毎の設定を記載
    "local": {                            # プロファイル名。これは local からデプロイしていた名残です
      "skillMetadata": {                  # スキルメタデータ（どこの設定ファイルを参照させるのか）の設定を記載
        "src": "./skill-package"          # このプロファイルが参照するスキルパッケージのパス
      }
    },
    "__ENVIRONMENT_ASK_PROFILE__": {      # CI/CD でデプロイに関わるキーを command で指定する時に使うプロファイル名。この文字列を書かないと command 実行時に引数で渡す秘匿情報を読み込んでくれない
      "skillMetadata": {
        "src": "./skill-package"          # local 実行と別のものを指定する必要がないので同じものを指定する
      }
    }
  }
}
```

## ⚙️ GitHub Actions について

`master`ブランチに push されると、`ciForMaster.yml`ワークフローが実行されるようにしています。このワークフローはテストやフォーマットチェックの後、`_deployAlexa.yml`を呼び出して Alexa スキルのデプロイを行うものになっています。

### 呼び出しを行うワークフロー (`ciForMaster.yml`)

```yaml:.github/workflows/ciForMaster.yml
name: ciForMaster

on:
  push:
    branches:
      - master

jobs:

...中略

  deployAlexa: # ここで alexa のデプロイの設定があるワークフローを呼び出す
  needs: [format-check-and-fix, lint-check, spec-test]  # デプロイ前にテストの実行を保証するもの
    uses: ./.github/workflows/_deployAlexa.yml
    permissions:
      contents: write
      pull-requests: write
    secrets:
      ASK_ACCESS_TOKEN: ${{ secrets.ASK_ACCESS_TOKEN }}
      ASK_REFRESH_TOKEN: ${{ secrets.ASK_REFRESH_TOKEN }}
      ASK_VENDOR_ID: ${{ secrets.ASK_VENDOR_ID }}
      OAUTH_CLIENT_ID: ${{ secrets.OAUTH_CLIENT_ID }}
      OAUTH_CLIENT_SECRET: ${{ secrets.OAUTH_CLIENT_SECRET }}

...以下略
```

### 呼び出されるワークフロー (`_deployAlexa.yml`)

実際に Alexa スキルのデプロイとアカウントリンキング設定の更新を行うものです。
細かい設定はワークフロー内のコメントに書いているので適宜参考にしてください

```yaml:.github/workflows/_deployAlexa.yml
name: deployAlexa

on:
  workflow_call:
    secrets:
      ASK_ACCESS_TOKEN:
        required: true
      ASK_REFRESH_TOKEN:
        required: true
      ASK_VENDOR_ID:
        required: true
      OAUTH_CLIENT_ID:
        required: true
      OAUTH_CLIENT_SECRET:
        required: true

permissions:
  contents: write
  pull-requests: write

jobs:
  deployAlexa:
    name: deployAlexa
    runs-on: ubuntu-latest
    concurrency:
      group: deployAlexa
      cancel-in-progress: false
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
      
      - name: Install ask-cli
        # ask-cli はグローバルインストール推奨なのでそれに則る
        run: npm i ask-cli -g

      # 本来は ask configure コマンドを使って設定するデプロイ用の config だが、このコマンドはブラウザでのログインを求められてしまい CI では使えないので、jq を使って手動で作成する
      - name: Install jq
        run: sudo apt-get install -y jq

      - name: Create ask config using jq
        env:
          ASK_ACCESS_TOKEN:  ${{ secrets.ASK_ACCESS_TOKEN }}
          ASK_REFRESH_TOKEN: ${{ secrets.ASK_REFRESH_TOKEN }}
          ASK_VENDOR_ID:     ${{ secrets.ASK_VENDOR_ID }}
        run: |
          mkdir -p ~/.ask
          jq -n \
            --arg accessToken "$ASK_ACCESS_TOKEN" \
            --arg refreshToken "$ASK_REFRESH_TOKEN" \
            --arg vendorId "$ASK_VENDOR_ID" \
            '{
              "profiles": {
                "__ENVIRONMENT_ASK_PROFILE__":
                  "token": {
                    "access_token": $accessToken,
                    "refresh_token": $refreshToken
                  },
                  "vendor_id": $vendorId,
                  "aws_profile": "sample-pjt"
                }
              }
            }' > ~/.ask/cli_config

      - name: Deploy Alexa Skill
        env:
          ASK_DEFAULT_PROFILE:  sample-pjt
          ASK_ACCESS_TOKEN:     ${{ secrets.ASK_ACCESS_TOKEN }}
          ASK_REFRESH_TOKEN:    ${{ secrets.ASK_REFRESH_TOKEN }}
          ASK_VENDOR_ID:        ${{ secrets.ASK_VENDOR_ID }}
        run: cd infrastructure/ask && ask deploy --profile __ENVIRONMENT_ASK_PROFILE__ --debug

      # ここからは accountLinking （alexa スキル内での OPAuth 設定）のデプロイ設定。どういうわけか ask deploy ではまとめてデプロイされないので SMAPI という alexa スキルに使える API 群を用いてデプロイする
      - name: Deploy Account Linking
        env:
          ASK_DEFAULT_PROFILE:  sample-pjt
          ASK_ACCESS_TOKEN:     ${{ secrets.ASK_ACCESS_TOKEN }}
          ASK_REFRESH_TOKEN:    ${{ secrets.ASK_REFRESH_TOKEN }}
          ASK_VENDOR_ID:        ${{ secrets.ASK_VENDOR_ID }}
          OAUTH_CLIENT_ID:    ${{ secrets.OAUTH_CLIENT_ID }}
          OAUTH_CLIENT_SECRET: ${{ secrets.OAUTH_CLIENT_SECRET }}
        run: |
          cd infrastructure/ask
          
          # secret を埋め込みたいため skill-package 外部（/tmp）に deploy 用の accountLinking を作る
          jq -c \
            --arg clientId "$OAUTH_CLIENT_ID" \
            --arg clientSecret "$OAUTH_CLIENT_SECRET" \
            '.accountLinkingRequest.clientId = $clientId | .accountLinkingRequest.clientSecret = $clientSecret' \
            ./skill-package/accountLinking.json > /tmp/accountLinking_generated.json

          SKILL_ID=$(jq -r '.profiles."__ENVIRONMENT_ASK_PROFILE__".skillId' .ask/ask-states.json)
          echo "Deploying account linking for skill: $SKILL_ID"

          # 必須属性の -g にはなんとなく deploy 先の環境を入れたくなるが、 alexa の公開状況を指す情報を入れるのが正解の様子（development: 開発中、certified:審査完了・公開待ち、live:公開中）
          ask smapi update-account-linking-info \
            -s "$SKILL_ID" \
            -g "development" \
            --profile __ENVIRONMENT_ASK_PROFILE__ \
            --account-linking-request "$(cat /tmp/accountLinking_generated.json)" \
            --debug
          
          # この後 deploy で更新されたハッシュを含んだ commit を作るのだが、その時に秘匿情報を含んだファイルを紛れ込ませないようにするために一時ファイルを削除しておく
          rm -f /tmp/accountLinking_generated.json

      # デプロイが完了した場合、.ask/ask-states.json が書き換わるので、commit したい。そのための下準備を行う
      - name: Get git author info
        id: get_author
        run: echo "author=$(git log -1 --pretty=format:'%an <%ae>')" >> $GITHUB_OUTPUT

      - name: Commit and push changes
        env:
          GH_TOKEN: ${{ github.token }}
        # PR の作成が無限ループしないようにするため、条件分岐を挟む
        if: steps.get_author.outputs.author != 'gha-deploy-alexa[bot] <bot@nishiken.me>'
        run: |
          git config user.name "gha-deploy-alexa[bot]"
          git config user.email "bot@nishiken.me"
          git add .
          if git diff --staged --quiet; then
            echo "No changes to commit"
          else
            # 工数削減のため master ブランチの場合はPRを作成、他のブランチは直接プッシュする
            if [ "${{ github.ref_name }}" = "master" ]; then
              BRANCH_NAME="bot/alexa-deploy-$(date +%Y%m%d-%H%M%S)"
              git checkout -b "$BRANCH_NAME"
              git commit -m "[bot] fix .ask/ask-states.json to update hash after deploying alexa"
              git push origin "$BRANCH_NAME"
              
              # PR を作成する
              gh pr create \
                --title "[bot] Update Alexa skill deployment state" \
                --body "Auto-generated PR to update .ask/ask-states.json after Alexa skill deployment" \
                --base master \
                --head "$BRANCH_NAME"
            else
              git commit -m "[bot] fix .ask/ask-states.json to update hash after deploying alexa"
              git push origin ${{ github.ref_name }}
            fi
          fi
```

## 📌 最重要ポイント

私がハマったので再度書きますが、秘匿情報を CLI から実行時変数として渡す際、必ず `ask deploy --profile __ENVIRONMENT_ASK_PROFILE__` とする必要があります。なぜかこの値にしないと実行時変数が渡らないみたいです。（[参考](https://developer.amazon.com/en-US/blogs/alexa/alexa-skills-kit/2020/06/using-the-ask-cli-v2-0-to-continuously-deploy-your-skill)）
