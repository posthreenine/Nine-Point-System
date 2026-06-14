import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Printer, Wifi, Bluetooth, Save, RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface PrinterConfig {
  id: number;
  printerType: string;
  name: string;
  deviceName: string | null;
  ipAddress: string | null;
  port: number | null;
  isActive: boolean;
  updatedAt: string;
}

function getToken() {
  return localStorage.getItem("pos_token");
}

async function fetchPrinters(): Promise<PrinterConfig[]> {
  const res = await fetch("/api/printer-settings", {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch printer settings");
  return res.json();
}

async function savePrinter(type: string, data: Partial<PrinterConfig>): Promise<PrinterConfig> {
  const res = await fetch(`/api/printer-settings/${type}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save printer settings");
  return res.json();
}

function PrinterCard({
  config, onSave,
}: {
  config: PrinterConfig;
  onSave: (type: string, data: Partial<PrinterConfig>) => Promise<void>;
}) {
  const [name, setName] = useState(config.name);
  const [deviceName, setDeviceName] = useState(config.deviceName ?? "");
  const [ipAddress, setIpAddress] = useState(config.ipAddress ?? "");
  const [port, setPort] = useState(config.port?.toString() ?? "");
  const [isActive, setIsActive] = useState(config.isActive);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(config.name);
    setDeviceName(config.deviceName ?? "");
    setIpAddress(config.ipAddress ?? "");
    setPort(config.port?.toString() ?? "");
    setIsActive(config.isActive);
  }, [config]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(config.printerType, {
        name,
        deviceName: config.printerType === "customer" ? deviceName || null : undefined,
        ipAddress: config.printerType !== "customer" ? ipAddress || null : undefined,
        port: config.printerType !== "customer" ? (port ? Number(port) : null) : undefined,
        isActive,
      });
    } finally {
      setSaving(false);
    }
  }

  const isCustomer = config.printerType === "customer";
  const isLAN = !isCustomer;

  const typeLabel = isCustomer ? "Customer Receipt Printer" : config.printerType === "bar" ? "Bar Printer" : "Kitchen Printer";
  const typeDesc = isCustomer ? "Bluetooth thermal printer for customer receipts" : "LAN/Minipos printer for station tickets";
  const Icon = isCustomer ? Bluetooth : Wifi;
  const iconColor = isCustomer ? "text-blue-500" : config.printerType === "bar" ? "text-amber-500" : "text-orange-500";
  const borderColor = isCustomer ? "border-l-blue-400" : config.printerType === "bar" ? "border-l-amber-400" : "border-l-orange-400";

  return (
    <Card className={cn("border-l-4", borderColor)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("rounded-full p-2 bg-muted", iconColor)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{typeLabel}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{typeDesc}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isActive ? (
              <Badge className="gap-1 bg-green-100 text-green-700 border-green-300 border">
                <CheckCircle className="h-3 w-3" />Active
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <XCircle className="h-3 w-3" />Inactive
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Printer Name</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Customer Printer" className="h-9" />
        </div>

        {isCustomer && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Bluetooth Device Name</label>
            <Input value={deviceName} onChange={e => setDeviceName(e.target.value)} placeholder="e.g. RPP02N" className="h-9" />
          </div>
        )}

        {isLAN && (
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">LAN IP Address</label>
              <Input value={ipAddress} onChange={e => setIpAddress(e.target.value)} placeholder="e.g. 192.168.1.100" className="h-9" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Port</label>
              <Input type="number" value={port} onChange={e => setPort(e.target.value)} placeholder="9100" className="h-9" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-sm">Enable this printer</span>
          </label>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PrinterManagement() {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchPrinters();
      setPrinters(data);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSave(type: string, data: Partial<PrinterConfig>) {
    try {
      const updated = await savePrinter(type, data);
      setPrinters(prev => prev.map(p => p.printerType === type ? updated : p));
      toast({ title: "Printer settings saved" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Save failed", description: err.message });
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Printer className="h-7 w-7 text-primary" />
            Printer Management
          </h1>
          <p className="text-muted-foreground mt-1">Configure printers for receipts, bar, and kitchen tickets</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>Note:</strong> These settings store printer configurations. Bluetooth printing requires a native app or browser extension. LAN printers (Minipos) are accessed via ESC/POS over TCP from the server.
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-40" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {printers.map(p => (
            <PrinterCard key={p.printerType} config={p} onSave={handleSave} />
          ))}
          {printers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Printer className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No printer settings found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
