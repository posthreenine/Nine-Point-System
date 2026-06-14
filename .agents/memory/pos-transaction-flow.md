---
name: POS Transaction Flow
description: How the POS transaction lifecycle works — create, pay, void, stock deduction, table management
---

## Flow

1. `POST /api/transactions` — creates transaction (status: open), marks table occupied if dine_in
2. `POST /api/transactions/:id/pay` — processes payment, marks table available, deducts ingredient stock
3. `POST /api/transactions/:id/void` — cancels open transaction, marks table available

## Invoice Number Format
`TN-YYYY-NNNNNN` (zero-padded, auto-incremented per year from DB)

## Stock Deduction
On pay: for each transaction_item → lookup recipe_items → deduct ingredient.current_stock by (recipe_qty × item_qty) → insert stock_movement type='out'

## Table State
- Table status = 'occupied' when linked transaction is open
- Table status = 'available' when transaction is paid or voided
- Table.current_transaction_id tracks the active open transaction

**Why:** Separating create and pay allows "save order" without payment (open tab for table service). Single-step in frontend (create then pay immediately) covers the quick-sale flow.
