import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RealDataTables from "@/components/RealDataTables";

export default function RealData() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button 
                variant="secondary" 
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Dashboard
              </Button>
              <div>
                <h1 className="text-3xl font-bold mb-2">Dados Reais</h1>
                <p className="text-slate-200">Visualize informações de concorrentes e empresas do sistema</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabelas de Dados Reais */}
        <RealDataTables />
      </div>
    </div>
  );
}
