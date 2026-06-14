---
name: Generated Hook Signatures
description: How Orval-generated mutation hooks must be called — important for new features using api-client-react
---

## Mutation call shapes

Orval generates mutations with wrapped argument shapes (NOT direct spread):

```ts
// Single body (no path params):
useCreateTransaction().mutateAsync({ data: CreateTransactionInput })

// With path param + body:
usePayTransaction().mutateAsync({ id: number, data: PayTransactionInput })
useUpdateRestaurantTable().mutateAsync({ id: number, data: UpdateTableInput })
useUpdateQrisSettings().mutateAsync({ data: QrisSettingsUpdate })
```

## Query hook with enabled flag
```ts
useGetTransaction(id, {
  query: { enabled: !!id, queryKey: getGetTransactionQueryKey(id) }
})
```
Note: `queryKey` is required in the query options object.

**Why:** Orval wraps mutation args in a single object to allow discriminated union types and keep TData consistent. Passing args directly (without `data:` wrapper) fails TypeScript.
