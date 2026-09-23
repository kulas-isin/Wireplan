# Wireplan

需求規劃 PWA：報價單 → 需求卡 → 單元流程 → 頁面規格 → wireframe。
純前端（React + Vite），資料存 localStorage，無後端，GitHub Pages 部署。
使用者是接案公司的 PM，手機（iPhone PWA）用來思考與確認、電腦用來整理與繪製。

## 客戶專案的檔案不放這裡

這是**公開** repo，只放 app 程式碼。
客戶專案的產出（簡報、Excel、會議記錄、Wireplan 匯入 JSON、流程圖素材）一律放
**`kulas-isin/projects-data`**（私人）——用 `add_repo` 掛進 session 後 commit push，
不要只用聊天附件交付（連結會過期）。該 repo 的 CLAUDE.md 有完整規則。

## 開發流程（使用者的長期約定）

實作 → `npm run build` 驗證 → commit → push 到分支 `claude/quote-wireframe-generator-JncOH`
→ 開 PR 對 main → 立即 squash merge（GitHub Pages 自動部署）。
使用者在 PWA 上要關掉重開兩次才會更新。

GitHub 操作只能用 `mcp__github__*` 工具（proxy 擋掉直接 API）。
分支與 main 因 squash merge 分歧時：`git fetch origin main && git merge origin/main -X ours`
（之後檢查有無復活的已刪程式碼）。

## 設計原則

- **介面不能因功能增加變雜**：新功能收進既有動線，用漸進揭露（收合、模式切換）而非多加按鈕
- **UX 越簡單越好**：手機一隻拇指能完成的操作優先；編輯用清單不用畫布
- **不用 emoji**，圖示一律 lucide-react
- **Nuviq 檸檬橄欖配色**：背景漸層 `#F7FAEC→#EAF2D8→#DCEBC7`、橄欖 `#3A5D25`、
  檸檬 `#ECF5A6/#C6DC6A/#9CBD48`、第二強調（圖面/資訊）藍 `#2E5F96/#E1EDF9`、
  提醒 `#B0691F/#FBF0DC`
- 離線可用；所有功能在 iPhone PWA 上要能操作

## 常見陷阱（踩過的）

- iOS：React 的 touch 監聽是 passive，手勢要用原生非 passive 監聽才能 preventDefault
- iOS：點擊會回報 1–2px 位移，判斷 tap 要留 6px 容差
- iOS：button 內 flex 內容會被置中，要給文字區塊 `flex: 1` 才靠左
- pointerup 與 click 會雙觸發，需 stopPropagation
- 全域 `input { width: 100% }` 會撐爆 checkbox，需個別覆寫

## 驗證方式

這個環境沒有可用的 LibreOffice/pdftoppm。UI 改動用 Playwright（Chromium 在
`/opt/pw-browsers/chromium`）開 vite dev server 截圖驗證，測試頁寫在專案根目錄、用完刪除。
