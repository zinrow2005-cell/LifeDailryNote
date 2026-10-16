# 拾光記帳 Daybook V1.6 — Google Sheets & Apps Script 版

延續 V1.5 的記帳、分類、年度／任意區間統計、報表逐層點擊、預算及固定收支功能，將原本誤用的 Supabase 同步設計改為 **Google 試算表 + Google Apps Script**。

## 此版本組成

- `index.html`、`app.js`、`styles.css`、`sw.js`、`manifest.webmanifest`、`icons/`：靜態 GitHub Pages 網頁，仍使用同一個 IndexedDB `daybook_local_v1` 儲存資料。
- `AppsScript/Code.gs` 與 `AppsScript/Bridge.html`：**需另行部署到你自己的 Google Apps Script 專案**，它們不是 GitHub 網站的前端頁面。
- `Google試算表同步設定指南.md`：詳細部署流程、同步金鑰及試算表安全須知。

## 本版改善

1. 可同步每筆收支、刪除標記、分類、月份預算、固定收支模板（含略過期別）。
2. GitHub Pages → Apps Script 使用嵌入式受限橋接，避免跨網域 fetch / CORS 問題。
3. 每筆記錄都有雲端版本；發現同時異動時可選擇保留本機或使用雲端，不直接覆蓋。
4. 斷網仍保留本機記帳及待同步變更。
5. 完全移除原本 Supabase 連線與登入介面，無須執行 Supabase SQL。
6. 不改動你現有的 Google 試算表分頁，只新增 `DAYBOOK_records`、`DAYBOOK_planner`、`DAYBOOK_meta`。

**注意：** 這不是已連線完成的私人雲端。你尚未提供現有 Apps Script 或 Google Sheet ID，因此交付的是可自行部署的獨立整合模組，並不會直接讀寫你現有系統。同步程式經靜態檢查及本機模擬測試；真實 Apps Script 執行環境尚待部署後驗證。

## 更新及備份

建議先在 V1.5 下載 JSON 完整備份。將靜態網站檔案更新至原 GitHub Repo、保持相同網址，不要刪除 IndexedDB。接著依指南新增 Apps Script 專案、執行 `setupDaybook()`、部署 Web App 並在網站設定頁填入網址與同步金鑰。

**機密資料不包含於 GitHub 壓縮檔**，但未來輸入的雲端金鑰會儲存在各裝置本機網站資料中。請留意共用裝置風險。
