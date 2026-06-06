# Wireplan

從**報價單 / 需求清單**自動產出 **Wireframe**、**規格文件**與**流程設計文件**的網頁應用程式。
所有產出皆可即時編輯，方便因應客戶需求異動快速調整。

純前端 SPA（React + Vite），資料儲存在瀏覽器 `localStorage`，免後端、可離線使用。

## 主要功能

1. **匯入需求**：支援 Excel（`.xlsx`/`.xls`）、CSV、PDF，或直接貼上文字。
   - 試算表會自動辨識欄位（功能名稱／說明／工時／報價／分類…），並可手動調整對應。
   - 系統依關鍵字自動將每筆需求分類（登入、列表、表單、儀表板、報表、流程…）。
2. **需求編輯**：表格式增刪改、調整順序、變更分類與優先級、補充驗收條件。
3. **Wireframe 產生與編輯**：依分類套用對應版型，產出可編輯的線框畫面。
   - 點元件可改文字／欄位型別／按鈕／表格欄位；可新增、刪除、上下移動元件。
   - 支援桌機／行動裝置切換；可針對單一畫面「重新依分類產生」。
4. **規格文件**：自動產生 Markdown 規格（概述、功能總表、逐項詳述、非功能需求、異動紀錄），左編輯右預覽，可切換手動編輯並匯出 `.md`。
5. **流程設計**：自動產生整體操作流程，可編輯節點與步驟，匯出 Markdown 與 Mermaid 流程圖。
6. **專案管理**：多專案切換，整包專案可匯出／匯入 JSON 作為備份或交付。

## 需求異動的工作流

修改需求 → 回到對應分頁按「↻ 重新產生」即可同步版面／流程；
或直接在 Wireframe／規格／流程上手動微調。產出與原始需求解耦，調整有彈性。

## 開發

```bash
npm install
npm run dev      # 開發伺服器 http://localhost:5173
npm run build    # 產生 dist/ 靜態檔
npm run preview  # 預覽 build 結果
```

## 技術

- React 18 + Vite 6（純前端）
- [SheetJS (xlsx)](https://sheetjs.com/) 解析 Excel / CSV
- [pdf.js](https://mozilla.github.io/pdf.js/) 抽取 PDF 文字
- 內建極簡 Markdown 渲染（規格／流程預覽）

## 目錄結構

```
src/
  lib/            核心邏輯（匯入解析、需求抽取、範本、規格/流程產生、Markdown）
  store/          狀態管理 + localStorage 持久化
  components/     UI（匯入、需求、Wireframe、規格、流程）
  App.jsx         主框架與分頁
```
