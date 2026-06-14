import { useState, useRef } from "react";
import {
  useGetProducts, getGetProductsQueryKey,
  useGetCategories,
  useCreateProduct, useUpdateProduct, useDeleteProduct, useDeleteProductImage,
  Product, Category,
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
import { Plus, Search, MoreHorizontal, Pencil, Trash2, ImagePlus, ImageOff, Package } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  categoryId: z.coerce.number().min(1, "Category is required"),
  description: z.string().optional(),
  sellingPrice: z.coerce.number().min(0, "Price must be ≥ 0"),
  status: z.enum(["active", "inactive"]).default("active"),
});
type FormValues = z.infer<typeof schema>;

export default function ProductsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Product | null>(null);
  const [deletingItem, setDeletingItem] = useState<Product | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading } = useGetProducts();
  const { data: categories = [] } = useGetCategories();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();
  const deleteImageMutation = useDeleteProductImage();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", code: "", categoryId: 0, description: "", sellingPrice: 0, status: "active" },
  });

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    (p.categoryName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function openCreate() {
    form.reset({ name: "", code: "", categoryId: 0, description: "", sellingPrice: 0, status: "active" });
    setIsCreateOpen(true);
  }

  function openEdit(item: Product) {
    form.reset({
      name: item.name, code: item.code, categoryId: item.categoryId,
      description: item.description ?? "", sellingPrice: item.sellingPrice,
      status: item.status as "active" | "inactive",
    });
    setEditingItem(item);
  }

  async function onSubmit(values: FormValues) {
    try {
      if (editingItem) {
        await updateMutation.mutateAsync({ id: editingItem.id, data: values });
        toast({ title: "Product updated" });
        setEditingItem(null);
      } else {
        await createMutation.mutateAsync({ data: values });
        toast({ title: "Product created" });
        setIsCreateOpen(false);
      }
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.error ?? "Something went wrong" });
    }
  }

  async function onDelete() {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync({ id: deletingItem.id });
      toast({ title: "Product deleted" });
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
      setDeletingItem(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.error ?? "Something went wrong" });
    }
  }

  function triggerImageUpload(productId: number) {
    setUploadingId(productId);
    fileInputRef.current?.click();
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const token = localStorage.getItem("pos_token");
      const res = await fetch(`/api/products/${uploadingId}/image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: "Image uploaded" });
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err?.message ?? "Error" });
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  }

  async function removeImage(id: number) {
    try {
      await deleteImageMutation.mutateAsync({ id });
      toast({ title: "Image removed" });
      queryClient.invalidateQueries({ queryKey: getGetProductsQueryKey() });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.error ?? "Something went wrong" });
    }
  }

  const ProductForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem className="col-span-2"><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g. Cappuccino" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="code" render={({ field }) => (
            <FormItem><FormLabel>Product Code</FormLabel><FormControl><Input placeholder="e.g. COFFEE-001" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="categoryId" render={({ field }) => (
            <FormItem><FormLabel>Category</FormLabel>
              <Select onValueChange={v => field.onChange(Number(v))} value={field.value ? String(field.value) : ""}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                <SelectContent>
                  {categories.filter(c => c.status === "active").map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="sellingPrice" render={({ field }) => (
            <FormItem><FormLabel>Selling Price (Rp)</FormLabel><FormControl><Input type="number" min={0} {...field} /></FormControl><FormMessage /></FormItem>
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
          <FormField control={form.control} name="description" render={({ field }) => (
            <FormItem className="col-span-2"><FormLabel>Description</FormLabel><FormControl><Input placeholder="Optional description" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => { setIsCreateOpen(false); setEditingItem(null); }}>Cancel</Button>
          <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {editingItem ? "Save Changes" : "Create Product"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImageFile} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{products.length} products total</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">{search ? "No products match" : "No products yet"}</p>
              {!search && <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>Add first product</Button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground w-16">Image</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Price</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">HPP</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3" />
                </tr></thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2">
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt={p.name} className="h-10 w-10 rounded-lg object-cover bg-muted" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <Package className="h-5 w-5 text-muted-foreground/40" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.code}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.categoryName ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">Rp {p.sellingPrice.toLocaleString("id")}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground hidden lg:table-cell">
                        {p.hpp > 0 ? `Rp ${p.hpp.toLocaleString("id")}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(p)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => triggerImageUpload(p.id)}><ImagePlus className="h-4 w-4 mr-2" />Upload Image</DropdownMenuItem>
                            {p.imageUrl && (
                              <DropdownMenuItem onClick={() => removeImage(p.id)}><ImageOff className="h-4 w-4 mr-2" />Remove Image</DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeletingItem(p)}><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent><DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader><ProductForm /></DialogContent>
      </Dialog>
      <Dialog open={!!editingItem} onOpenChange={v => !v && setEditingItem(null)}>
        <DialogContent><DialogHeader><DialogTitle>Edit Product</DialogTitle></DialogHeader><ProductForm /></DialogContent>
      </Dialog>
      <Dialog open={!!deletingItem} onOpenChange={v => !v && setDeletingItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Product</DialogTitle></DialogHeader>
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
