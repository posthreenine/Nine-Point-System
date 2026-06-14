import { useState } from "react";
import {
  useGetRecipes, getGetRecipesQueryKey,
  useGetProducts, useGetIngredients,
  useUpsertRecipe,
  Recipe, Ingredient,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Pencil, Trash2, Plus, ChefHat, X } from "lucide-react";

interface RecipeItemDraft {
  ingredientId: number;
  quantity: number;
}

export default function RecipesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [draftItems, setDraftItems] = useState<RecipeItemDraft[]>([]);
  const [newIngId, setNewIngId] = useState<number>(0);
  const [newQty, setNewQty] = useState<string>("");

  const { data: recipes = [], isLoading } = useGetRecipes();
  const { data: products = [] } = useGetProducts();
  const { data: ingredients = [] } = useGetIngredients();
  const upsertMutation = useUpsertRecipe();

  const filtered = recipes.filter(r =>
    r.productName.toLowerCase().includes(search.toLowerCase())
  );

  function openEdit(recipe: Recipe) {
    setEditingRecipe(recipe);
    setDraftItems(recipe.items.map(i => ({ ingredientId: i.ingredientId, quantity: i.quantity })));
    setNewIngId(0);
    setNewQty("");
  }

  function openNew() {
    setEditingRecipe({ productId: 0, productName: "", items: [], totalHpp: 0 });
    setDraftItems([]);
    setNewIngId(0);
    setNewQty("");
  }

  function addItem() {
    if (!newIngId || !newQty || Number(newQty) <= 0) return;
    if (draftItems.find(i => i.ingredientId === newIngId)) {
      toast({ title: "Ingredient already added" }); return;
    }
    setDraftItems(prev => [...prev, { ingredientId: newIngId, quantity: Number(newQty) }]);
    setNewIngId(0);
    setNewQty("");
  }

  function removeItem(idx: number) {
    setDraftItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function saveRecipe(productId: number) {
    try {
      await upsertMutation.mutateAsync({ productId, data: { items: draftItems } });
      toast({ title: "Recipe saved" });
      queryClient.invalidateQueries({ queryKey: getGetRecipesQueryKey() });
      setEditingRecipe(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.error ?? "Something went wrong" });
    }
  }

  const ingById = (id: number) => ingredients.find(i => i.id === id);
  const draftHpp = draftItems.reduce((s, item) => {
    const ing = ingById(item.ingredientId);
    return s + (ing ? ing.purchasePrice * item.quantity : 0);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recipes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{recipes.length} recipes defined</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Recipe</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search recipes..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <ChefHat className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">{search ? "No recipes match" : "No recipes defined yet"}</p>
          {!search && <Button variant="outline" size="sm" className="mt-3" onClick={openNew}>Create first recipe</Button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(recipe => (
            <Card key={recipe.productId} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold leading-tight">{recipe.productName}</CardTitle>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => openEdit(recipe)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground font-mono">HPP: <span className="font-semibold text-foreground">Rp {recipe.totalHpp.toLocaleString("id")}</span></p>
              </CardHeader>
              <CardContent>
                {recipe.items.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No ingredients defined</p>
                ) : (
                  <ul className="space-y-1.5">
                    {recipe.items.map(item => (
                      <li key={item.ingredientId} className="flex items-center justify-between text-xs">
                        <span className="text-foreground">{item.ingredientName}</span>
                        <span className="text-muted-foreground font-mono">{item.quantity} {item.unit}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={!!editingRecipe} onOpenChange={v => !v && setEditingRecipe(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRecipe?.productId ? `Edit Recipe: ${editingRecipe.productName}` : "New Recipe"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Product selector for new recipe */}
            {editingRecipe && !editingRecipe.productId && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Product</label>
                <Select onValueChange={v => setEditingRecipe(prev => prev ? { ...prev, productId: Number(v), productName: products.find(p => p.id === Number(v))?.name ?? "" } : prev)}>
                  <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* HPP Preview */}
            <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-2.5">
              <span className="text-sm font-medium">Calculated HPP</span>
              <span className="font-bold text-sm font-mono">Rp {draftHpp.toLocaleString("id")}</span>
            </div>

            {/* Current items */}
            {draftItems.length > 0 && (
              <div className="border rounded-lg divide-y overflow-hidden">
                {draftItems.map((item, idx) => {
                  const ing = ingById(item.ingredientId);
                  const cost = ing ? ing.purchasePrice * item.quantity : 0;
                  return (
                    <div key={idx} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ing?.name ?? `ID ${item.ingredientId}`}</p>
                        <p className="text-xs text-muted-foreground">{item.quantity} {ing?.unit} — Rp {cost.toLocaleString("id")}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeItem(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add item */}
            <div className="flex gap-2">
              <Select value={newIngId ? String(newIngId) : ""} onValueChange={v => setNewIngId(Number(v))}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Add ingredient" /></SelectTrigger>
                <SelectContent>
                  {ingredients
                    .filter(i => !draftItems.find(d => d.ingredientId === i.id))
                    .map(i => <SelectItem key={i.id} value={String(i.id)}>{i.name} ({i.unit})</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="number" min={0.01} step="0.01" placeholder="Qty"
                value={newQty} onChange={e => setNewQty(e.target.value)}
                className="w-24"
                onKeyDown={e => e.key === "Enter" && addItem()}
              />
              <Button type="button" size="icon" onClick={addItem} disabled={!newIngId || !newQty}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecipe(null)}>Cancel</Button>
            <Button
              disabled={!editingRecipe?.productId || upsertMutation.isPending}
              onClick={() => editingRecipe?.productId && saveRecipe(editingRecipe.productId)}
            >
              Save Recipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
