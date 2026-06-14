---
name: Multi-Printer System
description: Architecture of the browser-based multi-printer system added to THREE NINE POS
---

## Print Architecture
- Browser-based (`window.print()` + CSS `@media print`) — NOT ESC/POS commands
- Each ticket type has a unique div ID; a `<style>` tag injected at print time hides everything except that div
- After `window.print()`, the style is removed (via `setTimeout 500ms`) and the print is logged to the server
- Ticket div IDs: `print-receipt-content`, `print-bar-ticket-content`, `print-kitchen-ticket-content`, `print-waiter-copy-content`

## New DB Tables
- `printer_settings`: one row per printer type (`customer`, `bar`, `kitchen`); seeded on init
- `print_logs`: log each print event; `reprint_count` = number of previous prints of same type for same tx
- `kds_orders`: created/updated when bar or kitchen ticket is printed; `station` = `bar` | `kitchen`

## New API Routes
- `GET /api/printer-settings` — list all 3 printer configs
- `PUT /api/printer-settings/:type` — update a specific printer config (`customer`, `bar`, `kitchen`)
- `POST /api/print-logs` — log a print; auto-creates KDS order for bar/kitchen types
- `GET /api/print-logs?transactionId=X` — summary of print counts per type for a transaction

## Product Production Station
- `production_station` column added to `products` table via `ALTER TABLE ... ADD COLUMN` (try-catch migration)
- Values: `none` | `bar` | `kitchen` | `both`
- Included in `TransactionItem` response via JOIN in `fmtTransactionDetail`
- Frontend ticket components filter items by productionStation to print only relevant items

## Key Components
- `artifacts/pos/src/components/print-tickets.tsx`: `usePrintTicket` hook + 4 ticket content components + `PrintTicketsContainer`
- `artifacts/pos/src/components/payment-success-modal.tsx`: shown after payment; has 6 print buttons
- `artifacts/pos/src/pages/printer-management.tsx`: admin UI for configuring 3 printers

**Why browser-based:** Zero native app dependency; works from any browser; CSS isolation per-ticket type is sufficient for thermal printer windows.

**How to apply:** When adding new ticket types, add a new `TICKET_DIV_IDS` entry and a new content component; the `usePrintTicket` hook works with any div ID/print type combination.
