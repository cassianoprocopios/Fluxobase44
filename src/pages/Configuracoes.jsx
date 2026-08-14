import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Tag, Building2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { DRE_ENTRY_GROUPS, DRE_EXIT_GROUPS } from "@/lib/constants";
import DataExport from "@/components/configuracoes/DataExport";

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", type: "entrada", dre_group: "" });
  const [newUnit, setNewUnit] = useState("");
  const [newBank, setNewBank] = useState("");

  const { data: costCenters = [] } = useQuery({
    queryKey: ["costCenters"],
    queryFn: () => base44.entities.CostCenter.list("name"),
  });

  const createUnit = useMutation({
    mutationFn: (name) => base44.entities.CostCenter.create({ name, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costCenters"] });
      setNewUnit("");
      toast.success("Unidade criada!");
    },
  });

  const deleteUnit = useMutation({
    mutationFn: (id) => base44.entities.CostCenter.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["costCenters"] });
      toast.success("Unidade excluída!");
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bankAccounts"],
    queryFn: () => base44.entities.BankAccount.list("name"),
  });

  const createBank = useMutation({
    mutationFn: (name) => base44.entities.BankAccount.create({ name, is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      setNewBank("");
      toast.success("Banco/Conta criado!");
    },
  });

  const deleteBank = useMutation({
    mutationFn: (id) => base44.entities.BankAccount.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
      toast.success("Banco/Conta excluído!");
    },
  });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => base44.entities.Category.list(),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const createCat = useMutation({
    mutationFn: (data) => base44.entities.Category.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setShowCatForm(false);
      setNewCat({ name: "", type: "entrada", dre_group: "" });
      toast.success("Categoria criada!");
    },
  });

  const deleteCat = useMutation({
    mutationFn: (id) => base44.entities.Category.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria excluída!");
    },
  });

  const isAdmin = me?.role === "admin";
  const isGerente = me?.role === "gerente";
  const canManage = isAdmin || isGerente;

  const entryCats = categories.filter((c) => c.type === "entrada").sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const exitCats = categories.filter((c) => c.type === "saida").sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const dreGroups = newCat.type === "entrada" ? DRE_ENTRY_GROUPS : DRE_EXIT_GROUPS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie categorias e preferências
        </p>
      </div>

      <DataExport />

      {/* Units */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Unidades / Lojas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Nome da nova unidade..."
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newUnit.trim() && createUnit.mutate(newUnit.trim())}
            />
            <Button
              size="sm"
              disabled={!newUnit.trim() || createUnit.isPending}
              onClick={() => createUnit.mutate(newUnit.trim())}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {costCenters.map((u) => (
              <div key={u.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted/40 text-sm font-medium">
                {u.name}
                {canManage && (
                  <button
                    onClick={() => deleteUnit.mutate(u.id)}
                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {costCenters.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma unidade cadastrada.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Banks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Landmark className="w-4 h-4 text-primary" />
            Bancos / Contas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <input
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Nome do banco ou conta..."
              value={newBank}
              onChange={(e) => setNewBank(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newBank.trim() && createBank.mutate(newBank.trim())}
            />
            <Button
              size="sm"
              disabled={!newBank.trim() || createBank.isPending}
              onClick={() => createBank.mutate(newBank.trim())}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {bankAccounts.map((b) => (
              <div key={b.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-muted/40 text-sm font-medium">
                {b.name}
                {canManage && (
                  <button
                    onClick={() => deleteBank.mutate(b.id)}
                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {bankAccounts.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum banco cadastrado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entry Categories */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-success" />
              Categorias de Entrada
            </CardTitle>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNewCat({ name: "", type: "entrada", dre_group: "" });
                  setShowCatForm(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Novo
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Grupo DRE</TableHead>
                  {canManage && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entryCats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.dre_group || "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteCat.mutate(c.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {entryCats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhuma categoria de entrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Exit Categories */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4 text-destructive" />
              Categorias de Saída
            </CardTitle>
            {canManage && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNewCat({ name: "", type: "saida", dre_group: "" });
                  setShowCatForm(true);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Novo
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Grupo DRE</TableHead>
                  {canManage && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {exitCats.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.dre_group || "—"}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteCat.mutate(c.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {exitCats.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      Nenhuma categoria de saída
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* New Category Dialog */}
      <Dialog open={showCatForm} onOpenChange={setShowCatForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createCat.mutate(newCat);
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                required
                placeholder="Ex: Receita c/ Serviços"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={newCat.type}
                onValueChange={(v) => setNewCat({ ...newCat, type: v, dre_group: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Grupo DRE</Label>
              <Select
                value={newCat.dre_group}
                onValueChange={(v) => setNewCat({ ...newCat, dre_group: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {dreGroups.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowCatForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createCat.isPending}>
                {createCat.isPending ? "Salvando..." : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}