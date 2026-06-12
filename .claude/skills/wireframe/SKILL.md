---
name: wireframe
description: 從文字需求產生 Wireplan 可直接匯入的 wireframe JSON。當使用者想「做一張畫面 / 設計 wireframe / 把需求變成線框圖 / 產生後台頁面 JSON」時使用。輸出符合匯入 schema 的 JSON，使用者貼進 app 的「匯入畫面 JSON」即可成形。
---

# Wireframe 產生器

把使用者的文字需求轉成 **Wireplan 線框圖 JSON**，再讓使用者匯入 app 還原成可編輯畫面。
你的工作只是「產生 JSON」——不需要改 app 程式碼、不需要後端、不花 API。

## 流程

1. **釐清畫面**：從需求拆出要做哪幾張畫面（每張一個 wireframe）。需求模糊時先問 1–2 個關鍵問題（哪些頁、前台或後台、桌機或手機）。
2. **選版面 `layout`**：
   - `sidebar` → 後台 / admin / 管理介面（左側欄選單 + 右內容兩欄）。
   - 省略（stack）→ 前台、登入、表單、結帳等單欄頁。
3. **組元件**：用下方「元件庫」拼出畫面樹，由上到下、由外到內。
4. **輸出 JSON**：用 `{ "wireframes": [ ... ] }`（多張）、陣列、或單一物件皆可。
5. **告訴使用者怎麼匯入**（見最後一節）。同時把 JSON 存成 `wireframes/<名稱>.json` 方便保存。

## JSON 結構

```jsonc
{
  "wireframes": [
    {
      "name": "歌曲管理",                  // 畫面名稱
      "device": "desktop",                // desktop | tablet | mobile（預設 desktop）
      "theme": "music",                   // music = 深色金色音樂主題；省略 = 預設淺色
      "layout": "sidebar",                // sidebar | 省略(=單欄)
      "components": [ /* 元件樹 */ ]
    }
  ]
}
```

每個元件：

```jsonc
{
  "type": "table",            // 必填，須為下方元件庫既有 type，未知 type 會降級成文字佔位
  "label": "歌曲列表",         // 標題 / 主要文字
  "width": "full",            // full | half | third | quarter | fill | hug | fixed
  "widthPx": 240,             // 僅 width:"fixed" 時
  "align": "left",            // left | center | right
  "region": "content",        // 僅最外層、且 layout:"sidebar" 時有意義：sidebar | content
  // …各 type 專屬欄位，見下表
  "children": [ /* 只有 type:"row" / "card" 容器才有 */ ]
}
```

## 元件庫（type 一覽）

- **版面**：`row`(列容器·並排) `card`(卡片容器) `header`(頁面標題) `pageHeader`(頁首·麵包屑+操作) `topbar`(頂部列·頭像) `divider` `text` `image` `link` `video` `map`
- **導覽**：`nav`(水平選單) `sidenav`(側邊選單) `breadcrumb` `tabs` `steps` `pagination` `dropdown`
- **資料輸入**：`field`(輸入欄位) `formgrid`(表單分欄) `searchbar` `filter` `toolbar`(搜尋+篩選+操作整列) `checkbox` `radio` `segmented` `datepicker` `daterange` `number` `slider` `rate` `upload` `buttonRow`
- **資料展示**：`table` `statcards` `chart` `cardlist` `carousel` `list` `descriptions` `tags` `avatar` `timeline` `progress` `collapse` `tree` `calendar` `empty`
- **回饋**：`alert` `modal` `drawer` `result` `skeleton`

## 各 type 的陣列欄位（用對的 key 放清單）

| type | 陣列 key | 範例 |
|---|---|---|
| `nav` `sidenav` `breadcrumb` `list` `descriptions` `timeline` `collapse` `dropdown` | `items` | `"items": ["儀表板","訂單","會員"]` |
| `buttonRow` | `buttons` | `"buttons": ["新增","匯出","刪除"]` |
| `table` | `columns` | `"columns": ["名稱","狀態","建立時間","操作"]` |
| `filter` `formgrid` | `fields` | `"fields": ["狀態","分類","負責人"]` |
| `statcards` `cardlist` | `cards` | `"cards": ["今日營收","訂單數","會員數"]` |
| `steps` | `steps` | `"steps": ["填寫","審核","完成"]` |
| `tabs` | `tabs` | `"tabs": ["基本資料","紀錄","附件"]` |
| `checkbox` `radio` `segmented` | `options` | `"options": ["全部","啟用","停用"]` |
| `tags` | `tags` | `"tags": ["VIP","已驗證"]` |

## 常用專屬欄位

- **`field`**：`control` = `input`(預設)｜`password`｜`textarea`｜`select`｜`toggle`；`required:true`、`placeholder`、`help`。
- **`formgrid`**：`cols`(1~4)；欄名後綴 `*`=必填、`:select`/`:date`/`:number`/`:textarea`=指定型別（如 `"狀態:select"`）。
- **`pageHeader`**：`sub`(麵包屑，逗號分隔)、`showActions:true` + `primaryText`/`secondaryText`，或 `actions:[...]`。
- **`topbar`**：`showSearch` `showNotify` `showAvatar`（皆 boolean）。
- **`toolbar`**：`showSearch` `searchText` `filters:[...]` `actions:[...]`。
- **`table`**：`rows`(列數) `size:"small"` `selectable` `pager` `sortable`；操作鈕：欄位含「操作」欄或 `showActions:true`，搭配 `actions:[...]` 與 `actionStyle` = `link`｜`button`｜`icon`。儲存格樣式依欄名自動對應（進度/評分/啟用/縮圖/連結/狀態/創作者…）。
- **`chart`**：`chartType` = `bar`(預設)｜`line`｜`area`｜`pie`。
- **`progress`**：`percent`(0~100)。
- **`alert`**：`alertType` = `info`｜`success`｜`warning`｜`error`。
- **`searchbar`**：`enterButton:true`。
- **`card`**（容器）：`label`=標題、`actions:[...]`=右上操作、`direction`、`gap`、`children:[...]`。
- **`row`**（列容器·並排）：`direction:"row"`、`wrap:true`、`gap`、`alignMain`/`alignCross`、`children:[...]`；子元件用 `width:"fill"`(撐滿剩餘) / `"hug"`(內容寬) 控制並排比例。

> 權威 schema：`src/lib/wireframeImport.js`；陣列 key 對照：`src/components/WireframeBlock.jsx` 的 `ARRAY_PROP`；範例：同檔的 `SAMPLE_WIREFRAME`。修改前先讀這幾處確認欄位名。

## 範例（後台·歌曲管理）

```json
{
  "name": "歌曲管理",
  "device": "desktop",
  "layout": "sidebar",
  "components": [
    { "type": "header", "label": "時大音樂", "region": "sidebar" },
    { "type": "sidenav", "region": "sidebar", "active": 1,
      "items": ["儀表板", "歌曲管理", "創作者管理", "歌單／專輯", "會員管理", "權限管理"] },
    { "type": "topbar", "label": "時大音樂 後台", "region": "content", "showSearch": true, "showNotify": true, "showAvatar": true },
    { "type": "pageHeader", "label": "歌曲管理", "region": "content", "sub": "首頁,內容管理,歌曲管理",
      "showActions": true, "primaryText": "＋ 新增歌曲", "secondaryText": "匯出 Excel" },
    { "type": "row", "region": "content", "direction": "row", "wrap": true, "gap": 8, "alignCross": "center",
      "children": [
        { "type": "searchbar", "label": "搜尋歌曲 / 創作者…", "width": "fill", "enterButton": true },
        { "type": "filter", "width": "hug", "fields": ["狀態", "所屬歌單", "創作者"] }
      ] },
    { "type": "buttonRow", "region": "content", "buttons": ["批量上架", "批量下架", "刪除"] },
    { "type": "table", "region": "content", "size": "small", "selectable": true, "pager": true, "rows": 8,
      "columns": ["歌曲", "歌曲編號", "創作者", "所屬歌單", "時長", "播放數", "狀態", "操作"],
      "actions": ["編輯", "下架", "刪除"], "actionStyle": "link" }
  ]
}
```

## 業務流程 `flows`（選填，會自動畫成流程圖）

JSON 頂層除了 `wireframes`，可再帶 `flows`：描述「某角色完成某任務」的步驟與判斷。匯入後 app 會在「流程設計」分頁**自動鋪成含判斷分支的流程圖**，並把 `page` 綁到對應 wireframe（找不到→紅色待補節點）。

```jsonc
"flows": [
  {
    "name": "購買訂閱",
    "role": "會員",                       // 訪客 | 會員 | 管理員（決定節點顏色）
    "nodes": [
      { "key": "s",    "type": "start",    "label": "開始" },
      { "key": "plan", "type": "page",     "page": "購買方案選擇" },   // page=要綁的頁名
      { "key": "pay",  "type": "decision", "label": "付款成功？" },
      { "key": "ok",   "type": "page",     "page": "付款結果" },
      { "key": "e",    "type": "end",      "label": "完成" }
    ],
    "edges": [
      ["s","plan"], ["plan","pay"],
      ["pay","ok","是"], ["pay","plan","否"],   // [from, to, 標籤?]；判斷用是/否、退回
      ["ok","e"]
    ]
  }
]
```

- 一條 flow 一個物件；`nodes` 的 `key` 僅供 `edges` 連線參照。
- `type`：`start`／`end`／`page`（綁頁，方框）／`decision`（判斷，菱形）。
- **務必含判斷點與失敗回圈**（如付款失敗→回方案、審核退回→回填寫），這正是 RD 要、頁面上看不出來的部分。
- 常見業務流程：登入、註冊、忘記密碼、購買/訂閱、資料增刪改查、審核/簽核、搜尋瀏覽、播放/收藏。產頁時若需求涵蓋這些，**順手把對應 flows 一起輸出**。

## 怎麼匯入

把產生的 JSON 給使用者後，請告訴他：

1. 開啟 Wireplan，進到 **Wireframe**（線框圖）分頁。
2. 點工具列的 **「匯入畫面 JSON」**（旁邊有「填入範例（歌曲管理）」可參考格式）。
3. **貼上 JSON → 按「匯入」**。畫面即會以現有元件庫還原，之後可直接拖拉編輯、復原/重做、匯出 PNG/HTML。

> 單張、陣列、或 `{ "wireframes": [...] }` 都收。未支援的 type 會自動降級成文字佔位，不會讓整批匯入失敗。

## 撰寫準則

- **務實佈局**：後台頁順序通常是 `側欄(header+sidenav)` → `topbar` → `pageHeader` → `搜尋/篩選列(row)` → `buttonRow` → `table` → `pagination`。
- **善用容器**：要並排（搜尋＋按鈕同列、左右分欄）就包 `row`；要區塊卡片就包 `card`。
- **清單給真實內容**：欄位、選單、按鈕文字都用貼近需求的中文，別留預設佔位字。
- **一次可給多張**：相關頁面（列表→表單→詳情）放進同一個 `wireframes` 陣列一起匯入。
- **主題**：音樂串流 / 影音娛樂類畫面可加 `"theme": "music"`（深底＋金色強調，仿 Spotify / KKBox）；一般後台 / 表單維持淺色（省略 theme）。
