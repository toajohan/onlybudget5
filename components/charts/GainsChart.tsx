"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatMajor } from "@/lib/currency";
import type { ChartPoint } from "@/lib/chart-data";

const LINE = "#f58b3f";

export function GainsChart({
  dayData,
  monthData,
  currencyCode,
}: {
  dayData: ChartPoint[];
  monthData: ChartPoint[];
  currencyCode: string;
}) {
  const [granularity, setGranularity] = useState<"day" | "month">("day");
  const data = granularity === "day" ? dayData : monthData;

  return (
    <div>
      <SegmentedControl
        label="Période du graphique"
        items={[
          { value: "day", label: "Par jour" },
          { value: "month", label: "Par mois" },
        ]}
        value={granularity}
        onChange={setGranularity}
      />
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="gainsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f2803a" stopOpacity={0.55} />
                <stop offset="100%" stopColor="#f2803a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.07)" vertical={false} />
            <XAxis dataKey="label" stroke="#a8a8a8" fontSize={12} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              stroke="#a8a8a8"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(v)}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.3)", strokeDasharray: "3 4" }}
              contentStyle={{
                background: "#262626",
                border: "1px solid rgba(255,255,255,0.16)",
                borderRadius: 12,
                color: "#ffffff",
                fontSize: 13,
              }}
              labelStyle={{ color: "#a8a8a8" }}
              formatter={(value) => [formatMajor(Number(value), currencyCode), "Gains"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={LINE}
              strokeWidth={2.5}
              fill="url(#gainsFill)"
              dot={false}
              activeDot={{ r: 5, fill: "#ffffff", stroke: LINE, strokeWidth: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
