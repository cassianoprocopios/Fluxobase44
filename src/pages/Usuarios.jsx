import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, Shield, Users } from "lucide-react";
import { toast } from "sonner";
import { ROLES } from "@/lib/permissions";

const ROLE_LABELS = {
  admin: "Administrador",
  financeiro: "Financeiro",
  gestor: "Gestor",
  colaborador: "Colaborador",
};

const ROLE_COLORS = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  financeiro: "bg-primary/10 text-primary border-primary/20",
  gestor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  colaborador: "bg-muted text-muted-foreground border-border",
};

export default function Usuarios() {
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("colaborador");
  const [inviting, setInviting] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [showCreateDirect, setShowCreateDirect] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState("colaborador");
  const [creating, setCreating] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
      toast.success("Perfil atualizado com sucesso!");
    },
  });

  const handleInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      
      // Enviar email de convite
      try {
        await base44.functions.invoke('sendInviteEmail', { 
          email: inviteEmail, 
          role: inviteRole 
        });
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
        // Continua mesmo se o email falhar
      }

      toast.success(`Convite enviado para ${inviteEmail}!`);
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("colaborador");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error("Erro ao enviar convite. Verifique o e-mail e tente novamente.");
    }
    setInviting(false);
  };

  const handleCreateDirect = async () => {
    if (!createEmail || !createEmail.includes("@")) {
      toast.error("Informe um e-mail válido.");
      return;
    }
    setCreating(true);
    try {
      const res = await base44.functions.invoke('createDirectUser', {
        email: createEmail,
        full_name: createName,
        role: createRole,
      });
      toast.success(`Usuário ${createEmail} criado com sucesso!`);
      setShowCreateDirect(false);
      setCreateEmail("");
      setCreateName("");
      setCreateRole("colaborador");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error("Erro ao criar usuário. Verifique se o e-mail já existe.");
    }
    setCreating(false);
  };

  const openEdit = (user) => {
    setEditUser(user);
    setEditRole(user.role || "colaborador");
  };

  const roleCounts = users.reduce((acc, u) => {
    const r = u.role || "colaborador";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o acesso e os perfis dos usuários do sistema
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowCreateDirect(true)} 
            className="gap-2"
            disabled={me?.role !== 'admin'}
            title={me?.role !== 'admin' ? 'Apenas administradores podem criar usuários' : ''}
          >
            <UserPlus className="w-4 h-4" />
            Criar Usuário
          </Button>
          <Button 
            onClick={() => setShowInvite(true)} 
            variant="outline"
            className="gap-2"
            disabled={me?.role !== 'admin'}
            title={me?.role !== 'admin' ? 'Apenas administradores podem convidar usuários' : ''}
          >
            <Mail className="w-4 h-4" />
            Convidar
          </Button>
        </div>
      </div>

      {/* Resumo por role */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <Card key={role} className="border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${ROLE_COLORS[role]}`}>
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{roleCounts[role] || 0}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabela de usuários */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Carregando usuários…
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <Users className="w-6 h-6" />
              <p className="text-sm">Nenhum usuário cadastrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/80 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perfil</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cadastro</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => {
                    const role = user.role || "colaborador";
                    const isMe = user.email === me?.email;
                    return (
                      <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          {user.full_name || "—"}
                          {isMe && (
                            <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">Você</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS[role]}`}>
                            {ROLE_LABELS[role] || role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {user.created_date
                            ? new Date(user.created_date).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(user)}
                            disabled={isMe}
                          >
                            Alterar perfil
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Convidar usuário */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Convidar Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="usuario@empresa.com"
                  className="pl-9"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Perfil de acesso</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {inviteRole === "admin" && "Acesso total ao sistema, incluindo usuários e configurações."}
                {inviteRole === "financeiro" && "Pode lançar, editar, importar e conciliar transações."}
                {inviteRole === "gestor" && "Visualiza dashboards e relatórios, sem edição."}
                {inviteRole === "colaborador" && "Visualiza apenas lançamentos, sem acesso a relatórios."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={inviting} className="gap-2">
              <UserPlus className="w-4 h-4" />
              {inviting ? "Enviando…" : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Alterar perfil */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Perfil</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {(editUser.full_name || editUser.email || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{editUser.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">{editUser.email}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Novo perfil de acesso</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {editRole === "admin" && "Acesso total ao sistema, incluindo usuários e configurações."}
                  {editRole === "financeiro" && "Pode lançar, editar, importar e conciliar transações."}
                  {editRole === "gestor" && "Visualiza dashboards e relatórios, sem edição."}
                  {editRole === "colaborador" && "Visualiza apenas lançamentos, sem acesso a relatórios."}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button
              onClick={() => updateRoleMutation.mutate({ id: editUser.id, role: editRole })}
              disabled={updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}