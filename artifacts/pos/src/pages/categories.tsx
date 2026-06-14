import { useState } from "react";
import {
  useGetCategories, getGetCategoriesQueryKey,
  useCreateCategory, useUpdateCategory, useDeleteCategory,
  Category,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Layers } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});
type FormValues = z.infer<typeof schema>;

export default function CategoriesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Category | null>(null);
  const [deletingItem, setDeletingItem] = useState<Category | null>(null);

  const { data: categories = [], isLoading } = useGetCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", description: "", status: "active" } });

  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  function openCreate() {
    form.reset({ name: "", description: "", status: "active" });
    setIsCreateOpen(true);
  }

  function openEdit(cat: Category) {
    form.reset({ name: cat.name, description: cat.description ?? "", status: cat.status as "active" | "inactive" });
    setEditingItem(cat);
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: values });
        toast({ title: "Category updated" });
        setEditingItem(null);
      } else {
        await createMutation.mutateAsync({ data: values });
        toast({ title: "Category created" });
        setIsCreateOpen(false);
      }
      queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.data?.error ?? err?.message ?? "Something went wrong" });
    }
  }

  async function onDelete() {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync({ id: deletingItem.id });
      toast({ title: "Category deleted" });
      queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
      setDeletingItem(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.data?.error ?? err?.message ?? "Something went wrong" });
    }
  }

  const CategoryForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. Coffee" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="Optional description" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="status" render={({ field }) => (
          <FormItem><FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select><FormMessage /></FormItem>
        )} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setEditingItem(null); }}>Cancel</Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {editingItem ? "Save Changes" : "Create Category"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{categories.length} categories total</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Category</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search categories..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Layers className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">{search ? "No categories match your search" : "No categories yet"}</p>
              {!search && <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>Add your first category</Button>}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Description</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Products</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr></thead>
              <tbody>
                {filtered.map(cat => (
                  <tr key={cat.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{cat.description ?? "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline">{cat.productCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={cat.status === "active" ? "default" : "secondary"}>{cat.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openEdit(cat)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeletingItem(cat)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
          <CategoryForm />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingItem} onOpenChange={v => !v && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          <CategoryForm />
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deletingItem} onOpenChange={v => !v && setDeletingItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Category</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deletingItem?.name}</strong>? This action cannot be undone.</p>
          {deletingItem && deletingItem.productCount > 0 && (
            <p className="text-sm text-destructive font-medium">⚠ This category has {deletingItem.productCount} product(s). Remove them first.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={onDelete} disabled={deleteMutation.isPending || (deletingItem?.productCount ?? 0) > 0}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
