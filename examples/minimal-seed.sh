#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export NODE_ENV="${NODE_ENV:-development}"
export LOG_LEVEL="${LOG_LEVEL:-fatal}"
export LOG_FORMAT="${LOG_FORMAT:-json}"
export DB_CLIENT="${DB_CLIENT:-sqlite}"
export DB_SQLITE_PATH="${DB_SQLITE_PATH:-./data/minimal-demo.db}"
export LLM_PROVIDER="${LLM_PROVIDER:-mock}"
export MOCK_LLM_MODE="${MOCK_LLM_MODE:-echo}"

run_json() {
  npm run --silent dev -- "$@" --json
}

extract_json_field() {
  local json="$1"
  local field="$2"
  node -e "const data = JSON.parse(process.argv[1]); console.log(data[process.argv[2]] ?? '');" "$json" "$field"
}

echo "==> init database: $DB_SQLITE_PATH"
npm run --silent dev -- db init

echo "==> create book"
BOOK_JSON="$(run_json book create --title '最小示例书' --summary '用于演示 AI 小说工具 V1 全流程' --targetChapters 20)"
BOOK_ID="$(extract_json_field "$BOOK_JSON" id)"

echo "==> create chapter"
run_json chapter create --book "$BOOK_ID" --chapter 1 --title '黑铁令'

echo "==> create outline/world/character/faction/relation/item/hook"
run_json outline create --book "$BOOK_ID" --title '入宗篇' --chapterStart 1 --chapterEnd 3 --storyCore '主角带着异常令牌进入宗门并引出旧案'
WORLD_JSON="$(run_json world create --book "$BOOK_ID" --title '宗门制度' --category '势力规则' --content '外门弟子需要凭令牌登记入门' --keywords '宗门,外门,令牌')"
CHARACTER_JSON="$(run_json character create --book "$BOOK_ID" --name '林夜' --background '出身寒门' --status alive --keywords '林夜,主角')"
FACTION_JSON="$(run_json faction create --book "$BOOK_ID" --name '青岳宗' --status active --keywords '青岳宗,外门')"
ITEM_JSON="$(run_json item create --book "$BOOK_ID" --name '黑铁令' --ownerType none --status active --keywords '黑铁令,令牌')"
HOOK_JSON="$(run_json hook create --book "$BOOK_ID" --title '黑铁令异常' --hookType mystery --status open --keywords '黑铁令,异常')"

CHARACTER_ID="$(extract_json_field "$CHARACTER_JSON" id)"
FACTION_ID="$(extract_json_field "$FACTION_JSON" id)"
ITEM_ID="$(extract_json_field "$ITEM_JSON" id)"
HOOK_ID="$(extract_json_field "$HOOK_JSON" id)"
WORLD_ID="$(extract_json_field "$WORLD_JSON" id)"

run_json relation create \
  --book "$BOOK_ID" \
  --sourceType character \
  --sourceId "$CHARACTER_ID" \
  --targetType faction \
  --targetId "$FACTION_ID" \
  --relationType member \
  --keywords '林夜,外门' >/dev/null

echo "==> seed completed"
echo "book_id=$BOOK_ID"
echo "chapter_no=1"
echo "character_id=$CHARACTER_ID"
echo "faction_id=$FACTION_ID"
echo "item_id=$ITEM_ID"
echo "hook_id=$HOOK_ID"
echo "world_setting_id=$WORLD_ID"
echo
echo "Try next:"
echo "npm run dev -- plan --book $BOOK_ID --chapter 1 --provider mock --authorIntent '让林夜带着黑铁令入宗，并引出宗门旧案线索。'"
