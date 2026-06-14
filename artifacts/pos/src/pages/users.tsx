import { useState, useMemo } from "react";
import { 
  useGetUsers, getGetUsersQueryKey,
  useGetRoles, getGetRolesQueryKey,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetUserPassword,
  User,
  Role
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Search, ShieldAlert, KeyRound, Pencil, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Schemas
const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  roleId: z.coerce.number().min(1, "Role is required"),
  isActive: z.boolean().default(true),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

export default function UsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [resettingUser, setResettingUser] = useState<User | null>(null);

  // Queries
  const { data: users, isLoading: isLoadingUsers } = useGetUsers({ query: { queryKey: getGetUsersQueryKey() } });
  const { data: roles, isLoading: isLoadingRoles } = useGetRoles({ query: { queryKey: getGetRolesQueryKey() } });

  // Mutations
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const resetMutation = useResetUserPassword();

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(u => 
      u.fullName.toLowerCase().includes(search.toLowerCase()) || 
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.roleName.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  // Forms
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      roleId: 0,
      isActive: true,
      password: "",
    },
  });

  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "" }
  });

  const getRoleColor = (roleName: string) => {
    const name = roleName.toLowerCase();
    if (name.includes('owner')) return "bg-red-500/10 text-red-700 hover:bg-red-500/20";
    if (name.includes('manager')) return "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20";
    if (name.includes('cashier')) return "bg-green-500/10 text-green-700 hover:bg-green-500/20";
    if (name.includes('kitchen')) return "bg-orange-500/10 text-orange-700 hover:bg-orange-500/20";
    return "bg-slate-500/10 text-slate-700 hover:bg-slate-500/20";
  };

  const handleCreateSubmit = async (values: z.infer<typeof userSchema>) => {
    if (!values.password) {
      form.setError("password", { message: "Password is required for new users" });
      return;
    }
    
    try {
      await createMutation.mutateAsync({
        data: {
          username: values.username,
          fullName: values.fullName,
          password: values.password,
          email: values.email || undefined,
          roleId: values.roleId,
          isActive: values.isActive
        }
      });
      toast({ title: "User created successfully" });
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
      setIsCreateOpen(false);
      form.reset();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to create user", description: e.message });
    }
  };

  const handleEditSubmit = async (values: z.infer<typeof userSchema>) => {
    if (!editingUser) return;
    
    try {
      await updateMutation.mutateAsync({
        id: editingUser.id,
        data: {
          username: values.username,
          fullName: values.fullName,
          email: values.email || undefined,
          roleId: values.roleId,
          isActive: values.isActive
        }
      });
      toast({ title: "User updated successfully" });
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
      setEditingUser(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to update user", description: e.message });
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    try {
      await deleteMutation.mutateAsync({ id: deletingUser.id });
      toast({ title: "User deleted successfully" });
      queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
      setDeletingUser(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to delete user", description: e.message });
    }
  };

  const handleResetPassword = async (values: z.infer<typeof resetPasswordSchema>) => {
    if (!resettingUser) return;
    try {
      await resetMutation.mutateAsync({
        id: resettingUser.id,
        data: { newPassword: values.newPassword }
      });
      toast({ title: "Password reset successfully" });
      setResettingUser(null);
      resetForm.reset();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Failed to reset password", description: e.message });
    }
  };

  const openEdit = (user: User) => {
    form.reset({
      username: user.username,
      fullName: user.fullName,
      email: user.email || "",
      roleId: user.roleId,
      isActive: user.isActive,
      password: "" // password not editable here
    });
    setEditingUser(user);
  };

  const UserFormFields = ({ isEdit = false }) => (
    <>
      <FormField control={form.control} name="fullName" render={({ field }) => (
        <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="username" render={({ field }) => (
        <FormItem><FormLabel>Username</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="email" render={({ field }) => (
        <FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
      )} />
      <FormField control={form.control} name="roleId" render={({ field }) => (
        <FormItem>
          <FormLabel>Role</FormLabel>
          <Select onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? field.value.toString() : ""}>
            <FormControl>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
            </FormControl>
            <SelectContent>
              {roles?.map(r => (
                <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
      {!isEdit && (
        <FormField control={form.control} name="password" render={({ field }) => (
          <FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
      )}
      <FormField control={form.control} name="isActive" render={({ field }) => (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
          <FormControl>
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>Active Account</FormLabel>
            <p className="text-sm text-muted-foreground">User can log into the system</p>
          </div>
        </FormItem>
      )} />
    </>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Users</h1>
        <Button onClick={() => { form.reset({ username: "", fullName: "", email: "", roleId: 0, isActive: true, password: "" }); setIsCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New User
        </Button>
      </div>

      <Card className="shadow-sm">
        <div className="p-4 border-b flex items-center gap-2">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="Search users..." 
            className="border-0 shadow-none focus-visible:ring-0 px-0 h-auto"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <CardContent className="p-0">
          {isLoadingUsers ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead className="[&_tr]:border-b bg-slate-50/50 dark:bg-slate-800/50">
                  <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Name</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Username</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Role</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                        <td className="p-4 align-middle font-medium">{user.fullName}</td>
                        <td className="p-4 align-middle text-muted-foreground">{user.username}</td>
                        <td className="p-4 align-middle">
                          <Badge variant="outline" className={`border-transparent ${getRoleColor(user.roleName)}`}>
                            {user.roleName}
                          </Badge>
                        </td>
                        <td className="p-4 align-middle">
                          {user.isActive ? 
                            <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50">Active</Badge> : 
                            <Badge variant="outline" className="border-slate-200 text-slate-700 bg-slate-50">Inactive</Badge>
                          }
                        </td>
                        <td className="p-4 align-middle text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEdit(user)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setResettingUser(user)}>
                                <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => setDeletingUser(user)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>Add a new operator to the system.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <UserFormFields isEdit={false} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update details for {editingUser?.fullName}.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditSubmit)} className="space-y-4">
              <UserFormFields isEdit={true} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingUser?.fullName}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resettingUser} onOpenChange={(open) => !open && setResettingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resettingUser?.fullName} ({resettingUser?.username}).
            </DialogDescription>
          </DialogHeader>
          <Form {...resetForm}>
            <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-4">
              <FormField control={resetForm.control} name="newPassword" render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResettingUser(null)}>Cancel</Button>
                <Button type="submit" disabled={resetMutation.isPending}>
                  {resetMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
