import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency } from "@/lib/constants";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";


export default function TransactionTable({ transactions, onEdit, onDelete, userRole }) {
  const canEdit = userRole === "admin" || userRole === "gerente";

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10"></TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="hidden md:table-cell">Descrição</TableHead>
              <TableHead className="hidden lg:table-cell">Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
              {canEdit && <TableHead className="w-20">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  Nenhum lançamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center ${
                        t.type === "entrada" ? "bg-success/10" : "bg-destructive/10"
                      }`}
                    >
                      {t.type === "entrada" ? (
                        <ArrowUpRight className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.date && !isNaN(new Date(t.date.substring(0, 10)).getTime())
                      ? format(new Date(t.date.substring(0, 10)), "dd/MM/yy", { locale: ptBR })
                      : t.date?.substring(0, 10) || "—"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">{t.category}</TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell max-w-[200px] truncate">
                    {t.description || "—"}
                  </TableCell>
                  <TableCell className="text-sm hidden lg:table-cell capitalize">
                    {t.payment_method?.replace("_", " ") || "—"}
                  </TableCell>
                  <TableCell
                    className={`text-sm font-semibold text-right ${
                      t.type === "entrada" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {t.type === "entrada" ? "+" : "-"}
                    {formatCurrency(t.amount)}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit(t)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => onDelete(t)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}