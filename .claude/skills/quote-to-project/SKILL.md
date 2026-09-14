---
name: quote-to-project
description: 從報價單/需求描述展開成「單元 → 頁面 → 需求」三層結構：產出給客戶逐條確認的 Markdown 文件（含 mermaid 流程圖與量化總表），以及可直接用「匯入專案」進 Wireplan 的完整專案 JSON（單元清單＋需求卡＋頁面樹）。當使用者說「開案 / 依報價單展開需求 / 產需求確認文件 / 幫我建立專案資料 / 生成可匯入的專案」時使用。
---

# 報價單 → Wireplan 專案展開

把一份報價單（或口述需求）展開成兩份產出：
1. **需求確認文件（Markdown）**——給客戶逐條確認用
2. **Wireplan 專案 JSON**——用 app 的「匯入專案」一鍵建案（同 id 再匯入＝同步更新）

你的工作只是產生文件與 JSON，不需要改 app 程式碼。

## 展開規則（防漏心法）

1. 思考層級固定三層：**單元（模組）→ 頁面 → 需求**；一條需求常對應多個頁面。
2. 只依報價單推導、合理展開細節，不腦補未暗示的大功能；不確定的一律標【待確認】並收進問題清單。
3. 每個功能想到**配套頁面**：列表配 新增/編輯、詳情；流程配 完成頁、失敗頁；每頁考慮空狀態與錯誤狀態。
4. 頁面上每顆按鈕都要有去處（跳哪頁/開什麼彈窗/觸發什麼），不准有沒下文的按鈕。
5. mermaid 必須可直接渲染（特殊字元節點加引號）；全文繁體中文、非技術客戶看得懂。

## 產出一：需求確認文件（Markdown 章節固定）

1. **專案量化總覽**：單元數/頁面總數/各單元頁面數/需求條數/彈窗數/報表數 一張表。
2. **單元與頁面結構**：每單元一節，縮排列出頁面階層，標註（新畫面/彈窗/既有頁調整）。
3. **Mermaid**：一張全站 sitemap（graph TD）＋ 3~5 條核心流程 flowchart（含分支與失敗路徑）。
4. **逐頁規格表**：每頁一張表——頁面/用途/主要元件（欄位含必填、按鈕含去處、表格含欄名）/進入方式/空與錯誤狀態/驗收條件 3~5 條。
5. **待確認問題清單**：`Q1. 問題 →（建議：…）☐ 同意 ☐ 另議`。
6. **客戶確認區**：「共 N 單元、M 頁、K 條需求，確認後即為 v1 需求基準，後續變更另行評估。」

## 產出二：Wireplan 專案 JSON（匯入 schema）

單一 JSON 物件，欄位如下（省略的欄位給空陣列/空字串即可）：

```jsonc
{
  "id": "proj_案名代號",          // 固定 id：之後再匯入同 id ＝ 同步更新這個專案
  "name": "專案名稱",
  "units": ["託運單管理", "帳務管理"],   // 單元排序清單（單元牆順序）
  "parties": { "vendor": "", "client": "客戶名" },
  "requirements": [{
    "id": "req_唯一碼", "name": "需求名", "unit": "所屬單元",
    "category": "list|form|detail|dashboard|report|workflow|setting|auth|payment|generic",
    "priority": "高|中|低",
    "description": "故事句/2~3 句功能說明",
    "acceptance": "條件一\n條件二\n條件三",
    "note": "", "screen": "主要對應頁面名",
    "talks": [{ "at": 1710000000000, "who": "client|us", "text": "客戶原話" }],
    "versions": [],                 // 已確認的需求給 [{"v":1,"at":時間戳,"snapshot":{"name":"需求名"}}]，未確認給 []
    "pending": null,                // 異動中給 {"note":"異動原因","at":時間戳,"impact":[]}，並同步 changeLog
    "changeLog": [],
    "createdAt": 1710000000000,
    "estimate": "", "price": "",
    "pages": [{ "name": "頁名", "bricks": [{ "type": "field", "label": "欄位名" }] }],  // 畫面地圖（選）
    "elements": ["搜尋列", "匯出鈕"]    // 必備元件（選）
  }],
  "wireframes": [{
    "id": "wf_唯一碼", "unit": "所屬單元",
    "parentId": null,               // 子頁填父頁 wf id → 單元牆長成頁面樹
    "requirementId": "req_對應需求id或省略",
    "name": "頁面名", "device": "desktop", "layout": "stack",
    "template": "generic", "components": []   // 元件可留空，之後在 app 畫；或用 wireframe skill 的元件 schema
  }],
  "fields": [], "blocks": [],
  "flow": { "graph": { "nodes": [], "edges": [] } },
  "updatedAt": 1710000000000
}
```

要點：
- **狀態語意**：`versions` 有內容＝已蓋章（綠）；`pending` 有值＝異動中（橙）；兩者皆無＝待確認（藍）。開案初期通常全部待確認。
- 每條需求都要有 `unit`；頁面樹用 `wireframes` 的 `unit`＋`parentId` 組出來，關鍵頁掛 `requirementId`。
- id 用固定可讀的字串（如 `req_sc1`、`wf_sc1`），之後增量更新才對得上。

## 怎麼匯入

把 JSON 存成 `案名.wireplan.json` 給使用者：手機存到檔案 → Wireplan 完整工作區「匯入專案」選檔即可；或放進 GitHub 同步的資料 repo 拉回。匯入後到需求整理的「單元」檢視看單元牆。
