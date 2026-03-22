import React from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function KPICard({ title, value, icon: Icon, trend, trendLabel, variant = "default" }) {
  const isPositive = trend > 0;
  const isNegative = trend < 0;
  const isNeutral = !trend || trend === 0;

  const variantStyles = {
    default: "bg-card",
    success: "bg-success/5 border-success/20",
    danger: "bg-destructive/5 border-destructive/20",
    primary: "bg-primary/5 border-primary/20",
  };

  return (
    <Card className={`p-5 ${variantStyles[variant]} transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trendLabel && (
            <div className="flex items-center gap-1.5">
              {isPositive && <TrendingUp className="w-3.5 h-3.5 text-success" />}
              {isNegative && <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
              {isNeutral && <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
              <span
                className={`text-xs font-medium ${
                  isPositive
                    ? "text-success"
                    : isNegative
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {trendLabel}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
        )}
      </div>
    </Card>
  );
}