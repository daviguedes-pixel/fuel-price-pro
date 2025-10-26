import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FileUploader } from "@/components/FileUploader";
import { useDatabase } from "@/hooks/useDatabase";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Save, AlertTriangle, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface NegotiatedRate {
  id: string;
  station_id: string;
  client_id: string;
  payment_method_id: string;
  rate_percentage: number;
  is_negotiated: boolean;
  negotiated_date: string | null;
  expiry_date: string | null;
  email_attachment: string | null;
  created_at: string;
  created_by: string;
  stations: { name: string; code: string };
  clients: { name: string; code: string };
  payment_methods: { name: string };
}

export default function RateManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { stations, clients, paymentMethods } = useDatabase();
  
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<NegotiatedRate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    station_id: "",
    client_id: "",
    payment_method_id: "",
    rate_percentage: "",
    is_negotiated: false,
    negotiated_date: new Date().toISOString().split('T')[0],
  });
  const [emailAttachment, setEmailAttachment] = useState<string[]>([]);

  useEffect(() => {
    loadRates();
  }, []); // Array vazio para executar apenas uma vez

  const loadRates = async () => {
    try {
      // Using direct query until types are updated
      const { data, error } = await supabase
        .from('taxas_negociadas' as any)
        .select(`
          *,
          stations!inner(name, code),
          clients!inner(name, code),
          payment_methods!inner(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading rates:', error);
        return;
      }

      setRates((data as any) || []);
    } catch (error) {
      console.error('Error loading rates:', error);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.station_id || !formData.client_id || !formData.payment_method_id || !formData.rate_percentage) {
      toast.error("Por favor, preencha todos os campos obrigatórios");
      return;
    }

    setLoading(true);
    try {
      const rateData = {
        station_id: formData.station_id,
        client_id: formData.client_id,
        payment_method_id: formData.payment_method_id,
        rate_percentage: parseFloat(formData.rate_percentage),
        is_negotiated: formData.is_negotiated,
        negotiated_date: formData.is_negotiated ? formData.negotiated_date : null,
        expiry_date: formData.is_negotiated 
          ? new Date(new Date(formData.negotiated_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          : null,
        email_attachment: emailAttachment.length > 0 ? emailAttachment[0] : null,
        created_by: user?.email || 'unknown',
      };

      const { error } = await supabase
        .from('taxas_negociadas' as any)
        .insert([rateData]);

      if (error) {
        toast.error("Erro ao salvar taxa: " + error.message);
        return;
      }

      toast.success("Taxa cadastrada com sucesso!");
      
      // Reset form
      setFormData({
        station_id: "",
        client_id: "",
        payment_method_id: "",
        rate_percentage: "",
        is_negotiated: false,
        negotiated_date: new Date().toISOString().split('T')[0],
      });
      setEmailAttachment([]);
      setShowForm(false);
      loadRates();
    } catch (error) {
      toast.error("Erro inesperado ao salvar taxa");
      console.error("Rate save error:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header moderno */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-3">Gestão de Taxas</h1>
              <p className="text-blue-100 text-lg">Configure taxas e margens negociadas</p>
            </div>
            <div className="flex gap-3">
              <Button 
                className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm h-12 px-6 rounded-xl font-semibold"
                onClick={() => setShowForm(true)}
              >
                <Save className="h-5 w-5 mr-2" />
                Nova Taxa
              </Button>
            </div>
          </div>
        </div>

      {/* Form Modal */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar Nova Taxa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Seção: Dados da Taxa */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      Dados da Taxa
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Informe o posto, cliente e tipo de pagamento</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="station" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Posto <span className="text-red-500">*</span>
                    </Label>
                  <Select value={formData.station_id} onValueChange={(value) => handleInputChange("station_id", value)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione o posto" />
                    </SelectTrigger>
                    <SelectContent>
                      {stations.map((station) => (
                        <SelectItem key={station.id} value={station.id}>
                          {station.name} ({station.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <svg className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Cliente <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.client_id} onValueChange={(value) => handleInputChange("client_id", value)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name} ({client.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    Tipo de Pagamento <span className="text-red-500">*</span>
                  </Label>
                  <Select value={formData.payment_method_id} onValueChange={(value) => handleInputChange("payment_method_id", value)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((method, index) => (
                        <SelectItem key={`payment-method-${index}`} value={method.ID_POSTO ? `${method.ID_POSTO}-${index}`}>
                          {method.CARTAO}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Seção: Valores e Negociação */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      Valor e Negociação
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Informe o percentual da taxa e opções de negociação</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="rate" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <svg className="h-4 w-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Taxa (%) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="0.00"
                      value={formData.rate_percentage}
                      onChange={(e) => handleInputChange("rate_percentage", e.target.value)}
                      className="h-11"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date" className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                      Data da Negociação
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.negotiated_date}
                      onChange={(e) => handleInputChange("negotiated_date", e.target.value)}
                      disabled={!formData.is_negotiated}
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <Checkbox
                    id="negotiated"
                    checked={formData.is_negotiated}
                    onCheckedChange={(checked) => handleInputChange("is_negotiated", checked)}
                  />
                  <Label htmlFor="negotiated" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    Taxa Negociada (com vencimento em 30 dias)
                  </Label>
                </div>
              </div>

              {formData.is_negotiated && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    E-mail Formalizado (Anexo)
                  </Label>
                  <FileUploader
                    onFilesUploaded={setEmailAttachment}
                    maxFiles={1}
                    acceptedTypes="image/*,.pdf,.doc,.docx"
                  />
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <Button 
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {loading ? "Salvando..." : "Salvar Taxa"}
                </Button>
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rates List */}
      <Card>
        <CardHeader>
          <CardTitle>Taxas Cadastradas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma taxa cadastrada ainda.
              </p>
            ) : (
              rates.map((rate) => (
                <div key={rate.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">
                          {rate.stations.name} → {rate.clients.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {rate.payment_methods.name} • {rate.rate_percentage}%
                        </p>
                      </div>
                      {rate.is_negotiated && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-500" />
                          <span className="text-sm text-blue-600">Taxa Negociada</span>
                        </div>
                      )}
                    </div>
                    {rate.expiry_date && isExpiringSoon(rate.expiry_date) && (
                      <div className="flex items-center gap-2 text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm">Vence em breve</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                    <span>Criado: {formatDate(rate.created_at)}</span>
                    {rate.negotiated_date && (
                      <span>Negociado: {formatDate(rate.negotiated_date)}</span>
                    )}
                    {rate.expiry_date && (
                      <span>Vence: {formatDate(rate.expiry_date)}</span>
                    )}
                    <span>Por: {rate.created_by}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}