import { useState } from "react";
import {
  useGetStockMovements, getGetStockMovementsQueryKey,
  useGetIngredients, getGetIngredientsQueryKey,
  useCreateStockMovement,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, ClipboardList } from "lucide-react";

const schema = z.object({
  ingredientId: z.coerce.number().min(1, "Select an ingredient"),
  movementType: z.enum(["in", "out", "adjustment", "opname"]),
  quantity: z.coerce.number().min(0.01, "Quantity must be > 0"),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const MOVEMENT_STYLES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  in:         { label: "Stock In",    variant: "default" },
  out:        { label: "Stock Out",   variant: "destructive" },
  adjustment: { label: "Adjustment", variant: "secondary" },
  opname:     { label: "Opname",     variant: "outline" },
};

export default function StockMovementsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const { data: movements = [], isLoading } = useGetStockMovements();
  const { data: ingredients = [] } = useGetIngredients();
  const createMutation = useCreateStockMovement();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ingredientId: 0, movementType: "in", quantity: 0, notes: "" },
  });

  const selectedType = form.watch("movementType");
  const selectedIngId = form.watch("ingredientId");
  const selectedIng = ingredients.find(i => i.id === Number(selectedIngId));

  const filtered = movements.filter(m =>
    m.ingredientName.toLowerCase().includes(search.toLowerCase()) ||
    m.movementType.toLowerCase().includes(search.toLowerCase())
  );

  async function onSubmit(values: FormValues) {
    try {
      await createMutation.mutateAsync({ data: { ...values, notes: values.notes || undefined } });
      toast({ title: "Stock movement recorded" });
      queryClient.invalidateQueries({ queryKey: getGetStockMovementsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetIngredientsQueryKey() });
      setIsOpen(false);
      form.reset();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.data?.error ?? err?.message ?? "Something went wrong" });
    }
  }

  const quantityLabel = {
    in: "Quantity to Add",
    out: "Quantity to Remove",
    adjustment: "New Stock Amount",
    opname: "Actual Count (New Balance)",
  }[selectedType] ?? "Quantity";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stock Movements</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{movements.length} records</p>
        </div>
        <Button onClick={() => { form.reset({ ingredientId: 0, movementType: "in", quantity: 0, notes: "" }); setIsOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Record Movement
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by ingredient or type..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">{search ? "No records match" : "No stock movements yet"}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ingredient</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Qty</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Before</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">After</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Notes</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">By</th>
                </tr></thead>
                <tbody>
                  {filtered.map(mv => {
                    const style = MOVEMENT_STYLES[mv.movementType] ?? MOVEMENT_STYLES.in;
                    return (
                      <tr key={mv.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {new Date(mv.createdAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td className="px-4 py-3 font-medium">{mv.ingredientName} <span className="text-muted-foreground font-normal">({mv.unit})</span></td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={style.variant}>{style.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          <span className={mv.movementType === "in" ? "text-green-600" : mv.movementType === "out" ? "text-red-500" : ""}>
                            {mv.movementType === "in" ? "+" : mv.movementType === "out" ? "-" : "="}{mv.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono text-muted-foreground">{mv.previousStock}</td>
                        <td className="px-4 py-3 text-center font-mono font-semibold">{mv.newStock}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{mv.notes ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{mv.userName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Stock Movement</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="ingredientId" render={({ field }) => (
                <FormItem><FormLabel>Ingredient</FormLabel>
                  <Select onValueChange={field.onChange} value={String(field.value)}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select ingredient" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ingredients.map(i => (
                        <SelectItem key={i.id} value={String(i.id)}>
                          {i.name} — {i.currentStock} {i.unit} remaining
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="movementType" render={({ field }) => (
                <FormItem><FormLabel>Movement Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="in">Stock In (add to stock)</SelectItem>
                      <SelectItem value="out">Stock Out (remove from stock)</SelectItem>
                      <SelectItem value="adjustment">Adjustment (set new balance)</SelectItem>
                      <SelectItem value="opname">Opname (physical count)</SelectItem>
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              {selectedIng && (
                <p className="text-sm text-muted-foreground bg-muted rounded-md px-3 py-2">
                  Current stock: <strong>{selectedIng.currentStock} {selectedIng.unit}</strong>
                </p>
              )}
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem><FormLabel>{quantityLabel}</FormLabel><FormControl><Input type="number" min={0.01} step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes (optional)</FormLabel><FormControl><Input placeholder="Reason or reference..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>Record</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
