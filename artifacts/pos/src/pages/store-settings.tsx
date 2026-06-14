import { useState, useRef, useEffect } from "react";
import {
  useGetStoreSettings,
  getGetStoreSettingsQueryKey,
  useUpdateStoreSettings,
  useDeleteStoreLogo,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2, ImageIcon, Globe, Receipt, DollarSign, Info, Upload, X, Lock } from "lucide-react";

export default function StoreSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useGetStoreSettings({
    query: { queryKey: getGetStoreSettingsQueryKey() },
  });

  const updateMutation = useUpdateStoreSettings();
  const deleteLogoMutation = useDeleteStoreLogo();

  const [form, setForm] = useState({
    storeName: "",
    address: "",
    phoneNumber: "",
    email: "",
    instagram: "",
    facebook: "",
    website: "",
    taxPercentage: "",
    serviceChargePercentage: "",
    currencyCode: "",
    currencySymbol: "",
    receiptFooter: "",
  });

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        storeName: settings.storeName ?? "",
        address: settings.address ?? "",
        phoneNumber: settings.phoneNumber ?? "",
        email: settings.email ?? "",
        instagram: settings.instagram ?? "",
        facebook: settings.facebook ?? "",
        website: settings.website ?? "",
        taxPercentage: String(settings.taxPercentage ?? ""),
        serviceChargePercentage: String(settings.serviceChargePercentage ?? ""),
        currencyCode: settings.currencyCode ?? "",
        currencySymbol: settings.currencySymbol ?? "",
        receiptFooter: settings.receiptFooter ?? "",
      });
    }
  }, [settings]);

  const isOwner = user?.roleName === "Owner";

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleLogoUpload = async () => {
    if (!logoFile) return;
    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", logoFile);

      const token = localStorage.getItem("pos_token");
      const res = await fetch("/api/store-settings/logo", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || "Upload failed");
      }

      await queryClient.invalidateQueries({ queryKey: getGetStoreSettingsQueryKey() });
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      toast({ title: "Logo uploaded", description: "Store logo updated successfully." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      await deleteLogoMutation.mutateAsync();
      await queryClient.invalidateQueries({ queryKey: getGetStoreSettingsQueryKey() });
      setLogoFile(null);
      setLogoPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Logo removed" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to remove logo", description: err.message });
    }
  };

  const handleCancelLogoPreview = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        data: {
          storeName: form.storeName,
          address: form.address,
          phoneNumber: form.phoneNumber,
          email: form.email,
          instagram: form.instagram,
          facebook: form.facebook,
          website: form.website,
          taxPercentage: parseFloat(form.taxPercentage) || 0,
          serviceChargePercentage: parseFloat(form.serviceChargePercentage) || 0,
          currencyCode: form.currencyCode,
          currencySymbol: form.currencySymbol,
          receiptFooter: form.receiptFooter,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetStoreSettingsQueryKey() });
      toast({ title: "Settings saved", description: "Store settings updated successfully." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed to save", description: err.message });
    }
  };

  const handleReset = () => {
    if (settings) {
      setForm({
        storeName: settings.storeName ?? "",
        address: settings.address ?? "",
        phoneNumber: settings.phoneNumber ?? "",
        email: settings.email ?? "",
        instagram: settings.instagram ?? "",
        facebook: settings.facebook ?? "",
        website: settings.website ?? "",
        taxPercentage: String(settings.taxPercentage ?? ""),
        serviceChargePercentage: String(settings.serviceChargePercentage ?? ""),
        currencyCode: settings.currencyCode ?? "",
        currencySymbol: settings.currencySymbol ?? "",
        receiptFooter: settings.receiptFooter ?? "",
      });
    }
  };

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 space-y-4">
        <div className="rounded-full bg-red-100 p-4">
          <Lock className="h-8 w-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-sm">
          Store Settings are only accessible to users with the <strong>Owner</strong> role.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Store Settings</h1>
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const currentLogoUrl = logoPreview ?? settings?.logoUrl ?? null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900">Store Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your store profile, branding, and configuration.</p>
        </div>
      </div>

      {/* Section 1: General Information */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            General Information
          </CardTitle>
          <CardDescription>Basic store identity and contact details</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="storeName">Store Name <span className="text-red-500">*</span></Label>
            <Input
              id="storeName"
              value={form.storeName}
              onChange={(e) => handleChange("storeName", e.target.value)}
              disabled={!isOwner}
              placeholder="Your store name"
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              disabled={!isOwner}
              placeholder="Street address"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phoneNumber">Phone Number <span className="text-red-500">*</span></Label>
            <Input
              id="phoneNumber"
              value={form.phoneNumber}
              onChange={(e) => handleChange("phoneNumber", e.target.value)}
              disabled={!isOwner}
              placeholder="+62..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              disabled={!isOwner}
              placeholder="store@example.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Branding */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5 text-primary" />
            Branding
          </CardTitle>
          <CardDescription>Upload your store logo. Accepted: JPG, PNG, WEBP (max 5MB)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            <div className="flex-shrink-0">
              {currentLogoUrl ? (
                <div className="relative w-28 h-28 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50">
                  <img
                    src={currentLogoUrl}
                    alt="Store logo"
                    className="w-full h-full object-contain p-2"
                  />
                  {logoPreview && (
                    <div className="absolute top-1 right-1">
                      <span className="text-xs bg-amber-500 text-white rounded px-1">Preview</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50">
                  <ImageIcon className="h-8 w-8 text-slate-300" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileChange}
                disabled={!isOwner}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isOwner}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {settings?.logoUrl ? "Replace Logo" : "Upload Logo"}
                </Button>

                {logoFile && (
                  <>
                    <Button size="sm" onClick={handleLogoUpload} disabled={isUploadingLogo}>
                      {isUploadingLogo ? "Uploading..." : "Save Logo"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleCancelLogoPreview}>
                      Cancel
                    </Button>
                  </>
                )}

                {settings?.logoUrl && !logoFile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={handleRemoveLogo}
                    disabled={deleteLogoMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove Logo
                  </Button>
                )}
              </div>
              {logoFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: <span className="font-medium">{logoFile.name}</span> — click "Save Logo" to upload
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Social Media */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            Social Media & Web
          </CardTitle>
          <CardDescription>Online presence links for your store</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="instagram">Instagram</Label>
            <Input
              id="instagram"
              value={form.instagram}
              onChange={(e) => handleChange("instagram", e.target.value)}
              disabled={!isOwner}
              placeholder="@yourstorehandle"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="facebook">Facebook</Label>
            <Input
              id="facebook"
              value={form.facebook}
              onChange={(e) => handleChange("facebook", e.target.value)}
              disabled={!isOwner}
              placeholder="facebook.com/yourstore"
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={form.website}
              onChange={(e) => handleChange("website", e.target.value)}
              disabled={!isOwner}
              placeholder="https://yourstore.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Tax and Service */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5 text-primary" />
            Tax & Service Charge
          </CardTitle>
          <CardDescription>Rates applied to customer transactions</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="taxPercentage">Tax Percentage (%)</Label>
            <Input
              id="taxPercentage"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.taxPercentage}
              onChange={(e) => handleChange("taxPercentage", e.target.value)}
              disabled={!isOwner}
              placeholder="11"
            />
            <p className="text-xs text-muted-foreground">
              Example: <span className="font-medium">Tax {form.taxPercentage || 0}%</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="serviceCharge">Service Charge (%)</Label>
            <Input
              id="serviceCharge"
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.serviceChargePercentage}
              onChange={(e) => handleChange("serviceChargePercentage", e.target.value)}
              disabled={!isOwner}
              placeholder="5"
            />
            <p className="text-xs text-muted-foreground">
              Example: <span className="font-medium">Service Charge {form.serviceChargePercentage || 0}%</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 5: Currency */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Currency
          </CardTitle>
          <CardDescription>Currency format displayed on receipts and transactions</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="currencyCode">Currency Code</Label>
            <Input
              id="currencyCode"
              value={form.currencyCode}
              onChange={(e) => handleChange("currencyCode", e.target.value)}
              disabled={!isOwner}
              placeholder="IDR"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currencySymbol">Currency Symbol</Label>
            <Input
              id="currencySymbol"
              value={form.currencySymbol}
              onChange={(e) => handleChange("currencySymbol", e.target.value)}
              disabled={!isOwner}
              placeholder="Rp"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 6: Receipt Settings */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-primary" />
            Receipt Settings
          </CardTitle>
          <CardDescription>Message printed at the bottom of customer receipts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label htmlFor="receiptFooter">Receipt Footer Message</Label>
            <Textarea
              id="receiptFooter"
              value={form.receiptFooter}
              onChange={(e) => handleChange("receiptFooter", e.target.value)}
              disabled={!isOwner}
              placeholder="Thank you for visiting..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {isOwner && (
        <>
          <Separator />
          <div className="flex items-center gap-3 pb-8">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="min-w-[120px]"
            >
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={updateMutation.isPending}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
