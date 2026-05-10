/** 首次启动时的建表与索引 DDL（由 initDb 执行；演进仍用 ensureColumn / rebuild*）。 */
export const ERP_INITIAL_TABLES_DDL = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      organization_id INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      entry_no TEXT NOT NULL UNIQUE,
      ref_type TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      memo TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS journal_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      account_code TEXT NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      UNIQUE (organization_id, code)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      contact TEXT,
      phone TEXT,
      UNIQUE (organization_id, code)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      sku TEXT NOT NULL,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      cost_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      UNIQUE (organization_id, sku)
    );

    CREATE TABLE IF NOT EXISTS stock_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      product_id INTEGER NOT NULL,
      qty_change REAL NOT NULL,
      unit_cost REAL,
      warehouse_id INTEGER,
      location_id INTEGER,
      batch_no TEXT,
      ref_type TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      organization_id INTEGER NOT NULL DEFAULT 1,
      supplier_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reversed_at TEXT,
      reversed_by INTEGER
    );

    CREATE TABLE IF NOT EXISTS ap_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      bill_no TEXT NOT NULL UNIQUE,
      supplier_id INTEGER NOT NULL,
      ref_type TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty REAL NOT NULL,
      received_qty REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT NOT NULL UNIQUE,
      organization_id INTEGER NOT NULL DEFAULT 1,
      customer_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reversed_at TEXT,
      reversed_by INTEGER
    );

    CREATE TABLE IF NOT EXISTS ar_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      invoice_no TEXT NOT NULL,
      customer_id INTEGER NOT NULL,
      ref_type TEXT NOT NULL,
      ref_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      received_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      UNIQUE (organization_id, invoice_no)
    );

    CREATE TABLE IF NOT EXISTS sales_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty REAL NOT NULL,
      delivered_qty REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES sales_orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE (organization_id, code)
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      warehouse_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE (organization_id, warehouse_id, code),
      FOREIGN KEY(warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS purchase_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      receipt_no TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      warehouse_id INTEGER,
      location_id INTEGER,
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES purchase_orders(id),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY(location_id) REFERENCES locations(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      amount REAL NOT NULL,
      batch_no TEXT,
      FOREIGN KEY(receipt_id) REFERENCES purchase_receipts(id) ON DELETE CASCADE,
      FOREIGN KEY(order_item_id) REFERENCES purchase_order_items(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      delivery_no TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      warehouse_id INTEGER,
      location_id INTEGER,
      total_amount REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES sales_orders(id),
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY(location_id) REFERENCES locations(id)
    );

    CREATE TABLE IF NOT EXISTS sales_delivery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      amount REAL NOT NULL,
      cost_amount REAL NOT NULL,
      batch_no TEXT,
      FOREIGN KEY(delivery_id) REFERENCES sales_deliveries(id) ON DELETE CASCADE,
      FOREIGN KEY(order_item_id) REFERENCES sales_order_items(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      return_no TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      warehouse_id INTEGER,
      location_id INTEGER,
      total_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES purchase_orders(id),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY(location_id) REFERENCES locations(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      amount REAL NOT NULL,
      batch_no TEXT,
      FOREIGN KEY(return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE,
      FOREIGN KEY(order_item_id) REFERENCES purchase_order_items(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      return_no TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL,
      customer_id INTEGER NOT NULL,
      warehouse_id INTEGER,
      location_id INTEGER,
      total_amount REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES sales_orders(id),
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(warehouse_id) REFERENCES warehouses(id),
      FOREIGN KEY(location_id) REFERENCES locations(id)
    );

    CREATE TABLE IF NOT EXISTS sales_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      qty REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit_cost REAL NOT NULL,
      amount REAL NOT NULL,
      cost_amount REAL NOT NULL,
      batch_no TEXT,
      FOREIGN KEY(return_id) REFERENCES sales_returns(id) ON DELETE CASCADE,
      FOREIGN KEY(order_item_id) REFERENCES sales_order_items(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS cash_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      receipt_no TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      ar_invoice_id INTEGER,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(ar_invoice_id) REFERENCES ar_invoices(id)
    );

    CREATE TABLE IF NOT EXISTS ar_receipt_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      receipt_id INTEGER NOT NULL,
      ar_invoice_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(receipt_id) REFERENCES cash_receipts(id) ON DELETE CASCADE,
      FOREIGN KEY(ar_invoice_id) REFERENCES ar_invoices(id)
    );

    CREATE TABLE IF NOT EXISTS cash_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      payment_no TEXT NOT NULL UNIQUE,
      supplier_id INTEGER NOT NULL,
      ap_bill_id INTEGER,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY(ap_bill_id) REFERENCES ap_bills(id)
    );

    CREATE TABLE IF NOT EXISTS ap_payment_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      payment_id INTEGER NOT NULL,
      ap_bill_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(payment_id) REFERENCES cash_payments(id) ON DELETE CASCADE,
      FOREIGN KEY(ap_bill_id) REFERENCES ap_bills(id)
    );

    CREATE TABLE IF NOT EXISTS auth_refresh_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_id TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auth_login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      attempted_at INTEGER NOT NULL,
      ok INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      level TEXT NOT NULL,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS approval_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      order_type TEXT NOT NULL,
      min_amount REAL NOT NULL DEFAULT 0,
      approver_role TEXT NOT NULL,
      UNIQUE (organization_id, order_type, min_amount)
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      rule_key TEXT NOT NULL,
      rule_value TEXT NOT NULL,
      UNIQUE (organization_id, rule_key)
    );

    CREATE TABLE IF NOT EXISTS api_idempotency (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      response_json TEXT NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, endpoint, idempotency_key)
    );

    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      url TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT '*',
      secret TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL DEFAULT 1,
      endpoint_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at TEXT,
      FOREIGN KEY(endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ar_invoice_no_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'order_no',
      prefix TEXT NOT NULL DEFAULT 'AR-',
      date_segment TEXT NOT NULL DEFAULT 'none',
      sequence_digits INTEGER NOT NULL DEFAULT 4,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id)
    );

    CREATE TABLE IF NOT EXISTS document_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      period_key TEXT NOT NULL DEFAULT '',
      current_value INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, doc_type, period_key)
    );
`;

export const ERP_INDEX_DDL = `
    CREATE INDEX IF NOT EXISTS idx_stock_ledger_product ON stock_ledger(product_id);
    CREATE INDEX IF NOT EXISTS idx_stock_ledger_wh_loc ON stock_ledger(organization_id, warehouse_id, location_id);
    CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch ON stock_ledger(organization_id, batch_no);
    CREATE INDEX IF NOT EXISTS idx_purchase_items_order ON purchase_order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_sales_items_order ON sales_order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_ar_customer_status ON ar_invoices(customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_ap_supplier_status ON ap_bills(supplier_id, status);
    CREATE INDEX IF NOT EXISTS idx_ar_receipt_lines_receipt ON ar_receipt_lines(receipt_id);
    CREATE INDEX IF NOT EXISTS idx_ar_receipt_lines_invoice ON ar_receipt_lines(ar_invoice_id);
    CREATE INDEX IF NOT EXISTS idx_ap_payment_lines_payment ON ap_payment_lines(payment_id);
    CREATE INDEX IF NOT EXISTS idx_ap_payment_lines_bill ON ap_payment_lines(ap_bill_id);
    CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
    CREATE INDEX IF NOT EXISTS idx_auth_refresh_user ON auth_refresh_sessions(user_id, revoked);
    CREATE INDEX IF NOT EXISTS idx_auth_attempt_username_time ON auth_login_attempts(username, attempted_at);
    CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_alert_created_at ON alert_events(created_at);
    CREATE INDEX IF NOT EXISTS idx_alert_event_type ON alert_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_purchase_org_status ON purchase_orders(organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_sales_org_status ON sales_orders(organization_id, status);
    CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
    CREATE INDEX IF NOT EXISTS idx_suppliers_org ON suppliers(organization_id);
    CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
    CREATE INDEX IF NOT EXISTS idx_customers_org_code ON customers(organization_id, code);
    CREATE INDEX IF NOT EXISTS idx_suppliers_org_code ON suppliers(organization_id, code);
    CREATE INDEX IF NOT EXISTS idx_products_org_sku ON products(organization_id, sku);
    CREATE INDEX IF NOT EXISTS idx_warehouses_org_code ON warehouses(organization_id, code);
    CREATE INDEX IF NOT EXISTS idx_locations_org_wh_code ON locations(organization_id, warehouse_id, code);
    CREATE INDEX IF NOT EXISTS idx_purchase_receipts_order ON purchase_receipts(organization_id, order_id);
    CREATE INDEX IF NOT EXISTS idx_sales_deliveries_order ON sales_deliveries(organization_id, order_id);
    CREATE INDEX IF NOT EXISTS idx_purchase_returns_order ON purchase_returns(organization_id, order_id);
    CREATE INDEX IF NOT EXISTS idx_sales_returns_order ON sales_returns(organization_id, order_id);
    CREATE INDEX IF NOT EXISTS idx_approval_rules_org_type ON approval_rules(organization_id, order_type, min_amount);
    CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON api_idempotency(organization_id, endpoint, idempotency_key);
    CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(organization_id, enabled);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status, next_attempt_at);
    CREATE INDEX IF NOT EXISTS idx_ar_invoice_org_no ON ar_invoices(organization_id, invoice_no);
    CREATE INDEX IF NOT EXISTS idx_doc_sequences_lookup ON document_sequences(organization_id, doc_type, period_key);
`;
