import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Search, MapPin, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Concorrente {
  id_posto: number;
  cnpj: string;
  razao_social: string;
  endereco: string;
  municipio: string;
  uf: string;
  bandeira: string;
  latitude: number;
  longitude: number;
}

interface SisEmpresa {
  nome: string;
  cnpj_cpf: string;
  municipio: string;
  uf: string;
  bandeira: string;
  latitude: number;
  longitude: number;
  rede: string;
  supervisor: string;
}

export default function RealDataTables() {
  const [concorrentes, setConcorrentes] = useState<Concorrente[]>([]);
  const [sisEmpresas, setSisEmpresas] = useState<SisEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar concorrentes
      const { data: concorrentesData, error: concorrentesError } = await supabase
        .from('concorrentes' as any)
        .select('*' as any)
        .limit(50);

      if (concorrentesError) {
        console.error('Erro ao carregar concorrentes:', concorrentesError);
      } else {
        setConcorrentes((concorrentesData as any[]) || []);
      }

      // Carregar sis_empresa
      const { data: sisData, error: sisError } = await supabase
        .from('sis_empresa' as any)
        .select('*' as any)
        .limit(50);

      if (sisError) {
        console.error('Erro ao carregar sis_empresa:', sisError);
      } else {
        setSisEmpresas((sisData as any[]) || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error("Erro ao carregar dados reais");
    } finally {
      setLoading(false);
    }
  };

  const filteredConcorrentes = concorrentes.filter(c =>
    searchTerm === "" ||
    c.razao_social?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.municipio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.bandeira?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSisEmpresas = sisEmpresas.filter(s =>
    searchTerm === "" ||
    s.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.municipio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.bandeira?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Buscar por nome, município ou bandeira..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabela de Concorrentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Concorrentes ({filteredConcorrentes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Bandeira</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConcorrentes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum concorrente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredConcorrentes.map((c) => (
                    <TableRow key={c.id_posto}>
                      <TableCell className="font-medium">{c.razao_social}</TableCell>
                      <TableCell>{c.endereco}</TableCell>
                      <TableCell>{c.municipio}</TableCell>
                      <TableCell>{c.uf}</TableCell>
                      <TableCell>{c.bandeira}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Sistema Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Sistema Empresa ({filteredSisEmpresas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead>UF</TableHead>
                  <TableHead>Bandeira</TableHead>
                  <TableHead>Rede</TableHead>
                  <TableHead>Supervisor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSisEmpresas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Nenhuma empresa encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSisEmpresas.map((s, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{s.nome}</TableCell>
                      <TableCell>{s.municipio}</TableCell>
                      <TableCell>{s.uf}</TableCell>
                      <TableCell>{s.bandeira}</TableCell>
                      <TableCell>{s.rede}</TableCell>
                      <TableCell>{s.supervisor}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
