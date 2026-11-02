# Daybook V1.9.8｜完整 GitHub Pages 更新流程

1. 使用既有 V1.9.7 頁面匯出完整 JSON 備份，妥善保存在電腦。保留原 ZIP 以利回退。
2. 開啟 GitHub Repository → Settings → Pages，確認 Build and deployment 的分支與資料夾 (`/(root)` 或 `/docs`)。
3. 將 V1.9.8 ZIP 解壓縮後所有網站檔案上傳到該資料夾**根層**，不是上傳 ZIP 到網頁目錄，也不要多一層資料夾。
4. 確認 `index.html` 同層包含 `app.v1.9.8.js`、`styles.v1.9.8.css`、`version.json`、`sw.js`、`check-update.html`；同時上傳 `icons/`。
5. GitHub Actions / Pages 顯示部署完成後，在網站根網址後開 `/check-update.html`，確定版本 1.9.8。若顯示 404，表示發布位置不正確；請先核對，不要清除本機記帳。
6. 進入記帳頁 → 預算與固定收支 → 編輯電信模板 → 設定終止日；或按「更換方案」一次建新舊兩筆。
7. 先檢查原先已入帳交易的總筆數與金額，然後測試待入帳清單只出現有效方案，最後確認雲端同步。

保留與原始相同的 Google Apps Script URL 與本機同步金鑰；此版**不用修改或重新部署 Apps Script**。

如果曾把同一帳單用「新增一筆記帳」手動記錄、且沒有 recurringKey，該交易仍會保留，系統也無法推斷它是某模板的已入帳期別；請逐筆核對，不要直接再次按「確認入帳」。
