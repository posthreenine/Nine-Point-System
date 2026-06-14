import { useState } from "react";
import {
  useGetIngredients, getGetIngredientsQueryKey,
  useCreateIngredient, useUpdateIngredient, useDeleteIngredient,
  Ingredient,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, FlaskConical } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  unit: z.string().min(1, "Unit is required"),
  purchasePrice: z.coerce.number().min(0, "Price must be ≥ 0"),
  currentStock: z.coerce.number().min(0).default(0),
  minimumStock: z.coerce.number().min(0).default(0),
});
type FormValues = z.infer<typeof schema>;

const STOCK_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  in_stock: { label: "In Stock", variant: "default" },
  low_stock: { label: "Low Stock", variant: "secondary" },
  out_of_stock: { label: "Out of Stock", variant: "destructive" },
};

export default function IngredientsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [deletingItem, setDeletingItem] = useState<Ingredient | null>(null);

  const { data: ingredients = [], isLoading } = useGetIngredients();
  const createMutation = useCreateIngredient();
  const updateMutation = useUpdateIngredient();
  const deleteMutation = useDeleteIngredient();

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", unit: "Gram", purchasePrice: 0, currentStock: 0, minimumStock: 0 } });

  const filtered = ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  function openCreate() {
    form.reset({ name: "", unit: "Gram", purchasePrice: 0, currentStock: 0, minimumStock: 0 });
    setIsCreateOpen(true);
  }

  function openEdit(item: Ingredient) {
    form.reset({ name: item.name, unit: item.unit, purchasePrice: item.purchasePrice, currentStock: item.currentStock, minimumStock: item.minimumStock });
    setEditingItem(item);
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: values });
        toast({ title: "Ingredient updated" });
        setEditingItem(null);
      } else {
        await createMutation.mutateAsync({ data: values });
        toast({ title: "Ingredient created" });
        setIsCreateOpen(false);
      }
      queryClient.invalidateQueries({ queryKey: getGetIngredientsQueryKey() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.data?.error ?? err?.message ?? "Something went wrong" });
    }
  }

  async function onDelete() {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync({ id: deletingItem.id });
      toast({ title: "Ingredient deleted" });
      queryClient.invalidateQueries({ queryKey: getGetIngredientsQueryKey() });
      setDeletingItem(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.data?.error ?? err?.message ?? "Something went wrong" });
    }
  }

  const IngredientForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="col-span-2"><FormLabel>Ingredient Name</FormLabel><FormControl><Input placeholder="e.g. Coffee Beans" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="unit" render={({ field }) => (
            <FormItem><FormLabel>Unit</FormLabel><FormControl><Input placeholder="e.g. Gram, Ml, Pcs" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="purchasePrice" render={({ field }) => (
            <FormItem><FormLabel>Purchase Price / Unit (Rp)</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="currentStock" render={({ field }) => (
            <FormItem><FormLabel>Current Stock</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="minimumStock" render={({ field }) => (
            <FormItem><FormLabel>Minimum Stock</FormLabel><FormControl><Input type="number" min={0} step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setEditingItem(null); }}>Cancel</Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {editingItem ? "Save Changes" : "Create Ingredient"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ingredients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{ingredients.length} ingredients total</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Ingredient</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search ingredients..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FlaskConical className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">{search ? "No ingredients match" : "No ingredients yet"}</p>
              {!search && <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>Add first ingredient</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Unit</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price/Unit</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Current Stock</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Min Stock</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {filtered.map(ing => {
                    const ss = STOCK_STATUS[ing.stockStatus] ?? STOCK_STATUS.in_stock;
                    return (
                      <tr key={ing.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{ing.name}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{ing.unit}</td>
                        <td className="px-4 py-3 text-right font-mono">Rp {ing.purchasePrice.toLocaleString("id")}</td>
                        <td className="px-4 py-3 text-center font-mono">{ing.currentStock.toLocaleString("id")}</td>
                        <td className="px-4 py-3 text-center font-mono text-muted-foreground">{ing.minimumStock.toLocaleString("id")}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={ss.variant}>{ss.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEdit(ing)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeletingItem(ing)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent><DialogHeader><DialogTitle>New Ingredient</DialogTitle></DialogHeader><IngredientForm /></DialogContent>
      </Dialog>
      <Dialog open={!!editingItem} onOpenChange={v => !v && setEditingItem(null)}>
        <DialogContent><DialogHeader><DialogTitle>Edit Ingredient</DialogTitle></DialogHeader><IngredientForm /></DialogContent>
      </Dialog>
      <Dialog open={!!deletingItem} onOpenChange={v => !v && setDeletingItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Ingredient</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Delete <strong>{deletingItem?.name}</strong>? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
