import { useState, useRef } from "react";
import {
  useGetQrisSettings, useUpdateQrisSettings,
  getGetQrisSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Upload, Trash2, Save, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function getToken() {
  return localStorage.getItem("pos_token") ?? "";
}

export default function QrisSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useGetQrisSettings();
  const updateSettings = useUpdateQrisSettings();

  const [merchantName, setMerchantName] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Sync form with loaded data
  const [initialized, setInitialized] = useState(false);
  if (settings && !initialized) {
    setMerchantName(settings.merchantName);
    setInitialized(true);
  }

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({ data: { merchantName } });
      await qc.invalidateQueries({ queryKey: getGetQrisSettingsQueryKey() });
      toast({ title: "QRIS settings saved" });
      setIsDirty(false);
    } catch (err: any) {
      toast({ title: "Failed to save", description: err?.message, variant: "destructive" });
    }
  }

  async function handleImageUpload(file: File) {
    setIsUploading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/qris-settings/image", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      await qc.invalidateQueries({ queryKey: getGetQrisSettingsQueryKey() });
      setPreviewUrl(null);
      toast({ title: "QRIS image uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDeleteImage() {
    setIsDeleting(true);
    try {
      const res = await fetch("/api/qris-settings/image", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(await res.text());
      await qc.invalidateQueries({ queryKey: getGetQrisSettingsQueryKey() });
      toast({ title: "QRIS image removed" });
    } catch (err: any) {
      toast({ title: "Failed to remove image", description: err?.message, variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    handleImageUpload(file);
    e.target.value = "";
  }

  const imageUrl = previewUrl ?? settings?.qrisImageUrl ?? null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">QRIS Settings</h1>
        <p className="text-muted-foreground mt-1">Configure QRIS payment details for your POS</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-10 bg-muted animate-pulse rounded-md" />
          <div className="h-48 bg-muted animate-pulse rounded-md" />
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-6 space-y-6">
          {/* Merchant Name */}
          <div className="space-y-2">
            <Label htmlFor="merchantName">Merchant Name</Label>
            <Input
              id="merchantName"
              value={merchantName}
              onChange={e => { setMerchantName(e.target.value); setIsDirty(true); }}
              placeholder="e.g. THREE NINE COFFEE & EATERY"
            />
            <p className="text-xs text-muted-foreground">This name will appear below the QR code on the payment screen</p>
          </div>

          {/* QRIS Image */}
          <div className="space-y-3">
            <Label>QRIS QR Code Image</Label>

            {imageUrl ? (
              <div className="space-y-3">
                <div className="flex items-start gap-4">
                  <div className="border rounded-xl overflow-hidden bg-white p-2 shadow-sm">
                    <img
                      src={imageUrl}
                      alt="QRIS QR Code"
                      className="h-48 w-48 object-contain"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Current QR Code</p>
                    <p className="text-xs text-muted-foreground">This QR code will be displayed to customers during QRIS payment</p>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                      >
                        <Upload className="h-4 w-4" />
                        {isUploading ? "Uploading…" : "Replace Image"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                        onClick={handleDeleteImage}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4" />
                        {isDeleting ? "Removing…" : "Remove Image"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                  isUploading ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                {isUploading ? (
                  <div className="space-y-2">
                    <div className="h-8 w-8 mx-auto rounded-full border-2 border-t-transparent border-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Uploading image…</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <QrCode className="h-10 w-10 mx-auto text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium">Upload QRIS QR Code</p>
                      <p className="text-xs text-muted-foreground mt-1">Click to select image (JPG, PNG, WEBP — max 5MB)</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button onClick={handleSave} disabled={!isDirty || updateSettings.isPending} className="gap-1.5">
              <Save className="h-4 w-4" />
              {updateSettings.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700 flex gap-3">
        <QrCode className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium mb-1">How QRIS works</p>
          <p className="text-xs text-blue-600">When a cashier selects QRIS as the payment method, the QR code image you upload here will be displayed full-screen for the customer to scan. The cashier manually confirms payment after the customer completes the transfer.</p>
        </div>
      </div>
    </div>
  );
}
