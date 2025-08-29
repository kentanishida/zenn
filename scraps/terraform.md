# Terraform リソースの基礎まとめ

Terraform の「リソース」は、クラウド上の実体（例: VPC、サブネット、IAM、S3 など）をコードで管理する最小単位です。ここでは、リソースを扱ううえでの要点と、すぐ使えるコード例をコンパクトにまとめます。

## リソースの基本

- 定義形: `resource "<provider>_<type>" "<name>" { ... }`
- 参照形: `aws_s3_bucket.example.id` のように `resource_type.local_name.attribute`
- 依存: 参照に基づく暗黙依存が基本。強制順序は `depends_on` で明示

```hcl
# S3 バケット（最小例）
resource "aws_s3_bucket" "example" {
  bucket = "my-sample-bucket-123456"
  tags = {
    Project = "sample"
    Env     = "dev"
  }
}
```

## 初期化とプロバイダ

- 初回は `terraform init` が必須（プロバイダ/モジュール取得）
- バージョン固定やリージョンは `provider` ブロックで設定

```hcl
# providers.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region  # 例: ap-northeast-1
}
```

## 変数 / 出力 / ローカル値

- 変数: `variables.tf` で宣言し、tfvars/環境変数/CLI 引数で注入
- 出力: `output` で値を外に出す（他スタックやオペレータに）
- ローカル: `locals` で共通式/タグをまとめる

```hcl
# variables.tf
variable "env" {
  type        = string
  description = "Environment name"
  default     = "dev"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "ap-northeast-1"
}

# locals.tf
locals {
  common_tags = {
    Project = "sample"
    Env     = var.env
  }
}

# main.tf（利用例）
resource "aws_s3_bucket" "logs" {
  bucket = "${var.env}-logs-123456"
  tags   = local.common_tags
}

output "logs_bucket_name" {
  value = aws_s3_bucket.logs.bucket
}
```

## データソース（data）

既存のリソース情報を取得して参照に使う。

```hcl
data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "s3_readonly" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["*"]
  }
}
```

## 依存関係と apply 順序

- 暗黙依存: 参照（`resource.attr`）で自動的に依存関係が構築される
- 明示依存: `depends_on = [aws_iam_role.task]` のように強制順序付け

```hcl
resource "aws_iam_role" "task" {
  name               = "task-role"
  assume_role_policy = data.aws_iam_policy_document.s3_readonly.json
}

resource "aws_iam_role_policy_attachment" "attach_readonly" {
  role       = aws_iam_role.task.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
  depends_on = [aws_iam_role.task]  # 明示依存の例
}
```

## lifecycle（作成/置換/削除の制御）

- `create_before_destroy`: 置換時に先に新規作成してから旧リソースを消す
- `prevent_destroy`: 誤削除ガード（重要資産に）
- `ignore_changes`: 指定属性のドリフトを許容

```hcl
resource "aws_s3_bucket" "artifact" {
  bucket = "${var.env}-artifact-123456"

  lifecycle {
    create_before_destroy = true
    prevent_destroy       = false
    ignore_changes        = [tags]
  }
}
```

## 繰り返し（count / for_each）

- `count`: 単純な数ベースの複製
- `for_each`: マップ/セットをキーで展開（キー安定性が高く差分が安全）

```hcl
# count 例
resource "aws_s3_bucket" "multi" {
  count  = 3
  bucket = "${var.env}-multi-${count.index}"
}

# for_each 例
variable "buckets" {
  type    = set(string)
  default = ["assets", "logs", "backup"]
}

resource "aws_s3_bucket" "named" {
  for_each = var.buckets
  bucket   = "${var.env}-${each.key}-123456"
}
```

## モジュール（module）

- 複数リソースをひとまとめにして再利用
- 入出力（variables/outputs）で呼び出し側から差し替え

```hcl
# modules/s3_bucket/main.tf
variable "name" { type = string }
variable "tags" { type = map(string) }

resource "aws_s3_bucket" "this" {
  bucket = var.name
  tags   = var.tags
}

output "id" {
  value = aws_s3_bucket.this.id
}

# root/main.tf からの呼び出し
module "artifact_bucket" {
  source = "./modules/s3_bucket"
  name   = "${var.env}-artifact-123456"
  tags   = local.common_tags
}

output "artifact_bucket_id" {
  value = module.artifact_bucket.id
}
```

## プロビジョナー（provisioner）と代替

- `provisioner "local-exec"/"remote-exec"` は最終手段（冪等性・失敗時リカバリの観点で注意）
- 代替: Cloud-Init / User Data / Lambda-backed Custom Resource / 管理ツール（Ansibleなど）

```hcl
resource "null_resource" "notify" {
  triggers = {
    bucket = aws_s3_bucket.artifact.id
  }

  provisioner "local-exec" {
    command = "echo Created bucket ${self.triggers.bucket}"
  }
}
```

## 実行フロー（おさらい）

1) `init` でプロバイダやモジュールを取得
2) `plan` で差分を計算（リソースグラフ）
3) `apply` で実行（並列化＋依存考慮）
4) `destroy` で削除

```bash
terraform init
terraform plan -var env=dev
terraform apply -var env=dev -auto-approve
```

---

補足:

- 命名とタグ付けの一貫性は運用の生命線。`locals.common_tags` を活用
- `for_each` を優先（リソースの差分が読みやすく、削除時の誤爆を減らせる）
- 重要資産は `prevent_destroy` でガードし、`-target` は緊急時のみに
- 公式ドキュメント（Provider/Resource/Data Source）で各属性の「置換の有無」を都度確認
