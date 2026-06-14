import { useState } from "react";
import { 
  useGetRoles, getGetRolesQueryKey,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  Role
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Shield, Pencil, Trash2, Users as UsersIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const roleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters"),
  description: z.string().optional(),
});

export default function RolesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);

  // Queries
  const { data: roles, isLoading } = useGetRoles({ query: { queryKey: getGetRolesQueryKey() } });

  // Mutations
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();
  const deleteMutation = useDeleteRole();

  const form = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const handleCreateSubmit = async (values: z.infer<typeof roleSchema>) => {
    try {
      await createMutation.mutateAsync({
        data: values
      });
      toast({ title: "Role created successfully" });
      queryClient.invalidateQueries({ queryKey: getGetRolesQueryKey() });
      setIsCreateOpen(false);
      form.reset();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to create role", description: e.message });
    }
  };

  const handleEditSubmit = async (values: z.infer<typeof roleSchema>) => {
    if (!editingRole) return;
    try {
      await updateMutation.mutateAsync({
        id: editingRole.id,
        data: values
      });
      toast({ title: "Role updated successfully" });
      queryClient.invalidateQueries({ queryKey: getGetRolesQueryKey() });
      setEditingRole(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to update role", description: e.message });
    }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      await deleteMutation.mutateAsync({ id: deletingRole.id });
      toast({ title: "Role deleted successfully" });
      queryClient.invalidateQueries({ queryKey: getGetRolesQueryKey() });
      setDeletingRole(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to delete role", description: e.message });
    }
  };

  const openEdit = (role: Role) => {
    form.reset({
      name: role.name,
      description: role.description || "",
    });
    setEditingRole(role);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1">Manage system access levels and operational privileges.</p>
        </div>
        <Button onClick={() => { form.reset({ name: "", description: "" }); setIsCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New Role
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </>
        ) : roles?.map((role) => (
          <Card key={role.id} className="shadow-sm flex flex-col">
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-lg leading-none">{role.name}</h3>
                </div>
                {role.isSystem && (
                  <Badge variant="secondary" className="text-xs font-mono">SYSTEM</Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground mb-6 flex-1">
                {role.description || "No description provided."}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t">
                <div className="flex items-center text-sm font-medium text-slate-600 dark:text-slate-400">
                  <UsersIcon className="h-4 w-4 mr-2" />
                  {role.userCount} user{role.userCount !== 1 ? 's' : ''}
                </div>
                
                {!role.isSystem && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(role)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeletingRole(role)} disabled={role.userCount > 0}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>Define a new access level for operators.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Role Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Role"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update details for {editingRole?.name}.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Role Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingRole(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deletingRole} onOpenChange={(open) => !open && setDeletingRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Shield className="w-5 h-5" /> Delete Role
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the <strong>{deletingRole?.name}</strong> role? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingRole(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
