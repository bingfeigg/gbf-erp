# ERP Frontend Regression Smoke

Run this quick checklist after UI changes:

1. Approval workbench
   - Load purchase/sales/pending views.
   - Verify stage filter, status filter, search, and sort all work together.
   - Use `填充当前筛选ID` and run batch approve/reject.
   - Verify failed rows export `approval_batch_failures_*.csv`.

2. Settlement linkage
   - Receipt: select AR bill -> customer auto-fills -> amount auto-fills.
   - Payment: select AP bill -> supplier auto-fills -> amount auto-fills.
   - Change customer/supplier first and verify bill list is filtered.

3. Execution guard
   - Input qty greater than remaining in purchase/sales execution.
   - Verify inline error appears and action buttons are disabled.
   - Submit one execution action and verify duplicate-click is blocked while running.

4. Reminder panel
   - Load reminder lists and switch sort mode.
   - Change warn/danger day values and save.
   - Refresh page and verify thresholds persist.

5. Export consistency
   - Export AR/AP CSV and verify `阶段` column exists and values are populated.
