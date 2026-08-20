"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AMBER = "#f0a03c";
const SIGNAL = "#5ac8a8";
const ROSE = "#ef6a72";
const VIOLET = "#8b7ef0";
const GRID = "#26304290";
const AXIS = "#5c6b83";

const TOOLTIP = {
  contentStyle: {
    background: "#161d2b",
    border: "1px solid #2a3448",
    borderRadius: 8,
    fontSize: 12,
    fontFamily: "IBM Plex Mono, monospace",
  },
  labelStyle: { color: "#8797b0", marginBottom: 4 },
  itemStyle: { color: "#e6ebf4" },
} as const;

const axisProps = {
  stroke: AXIS,
  fontSize: 10,
  tickLine: false,
  axisLine: false,
  fontFamily: "IBM Plex Mono, monospace",
} as const;

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

export function GrowthChart({
  data,
}: {
  data: { date: string; newUsers: number; activeUsers: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AMBER} stopOpacity={0.35} />
            <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SIGNAL} stopOpacity={0.25} />
            <stop offset="100%" stopColor={SIGNAL} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} minTickGap={24} />
        <YAxis {...axisProps} width={44} allowDecimals={false} />
        <Tooltip {...TOOLTIP} labelFormatter={(v) => `Sana: ${v}`} />
        <Area
          type="monotone"
          dataKey="activeUsers"
          name="Faol"
          stroke={SIGNAL}
          strokeWidth={1.5}
          fill="url(#gActive)"
        />
        <Area
          type="monotone"
          dataKey="newUsers"
          name="Yangi"
          stroke={AMBER}
          strokeWidth={2}
          fill="url(#gNew)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BlockedChart({
  data,
}: {
  data: { date: string; blocked: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...axisProps} minTickGap={30} />
        <YAxis {...axisProps} width={44} allowDecimals={false} />
        <Tooltip {...TOOLTIP} />
        <Line
          type="monotone"
          dataKey="blocked"
          name="Bloklagan"
          stroke={ROSE}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const RANK_COLORS = [AMBER, SIGNAL, VIOLET, "#5aa9e6"];

export function RankChart({
  data,
  height = 200,
}: {
  data: { name: string; count: number }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
      >
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" {...axisProps} allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={110} {...axisProps} />
        <Tooltip {...TOOLTIP} cursor={{ fill: "#1e273950" }} />
        <Bar dataKey="count" name="Soni" radius={[0, 3, 3, 0]} barSize={14}>
          {data.map((_, i) => (
            <Cell key={i} fill={RANK_COLORS[i % RANK_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
