'use client';

import { useReducedMotion } from 'motion/react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney, formatShortDay } from '@/lib/format';

// Série unique : CA net par jour. Couleur des barres = vert foncé de la
// charte (#067a40, contraste ≥ 4,5:1 sur blanc) ; textes en encre neutre.
const BAR_COLOR = '#067a40'; // = --primary-strong
const GRID_COLOR = '#e2e5e9';
const TEXT_MUTED = '#5b6168';

const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

type Point = { day: string; net: number; gross: number; refunds: number; count: number };

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  currency: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{formatShortDay(point.day)}</p>
      <p>
        CA net : <strong className="tabular-nums">{formatMoney(point.net, currency)}</strong>
      </p>
      <p className="text-muted-foreground">
        {point.count} vente{point.count > 1 ? 's' : ''}
        {point.refunds > 0 ? ` · remboursé ${formatMoney(point.refunds, currency)}` : ''}
      </p>
    </div>
  );
}

export function RevenueTrendChart({ data, currency }: { data: Point[]; currency: string }) {
  const reduceMotion = useReducedMotion();
  const points = data.map((d) => ({
    ...d,
    net: Number(d.net),
    gross: Number(d.gross),
    refunds: Number(d.refunds),
    count: Number(d.count),
  }));
  const interval = points.length > 16 ? Math.ceil(points.length / 8) - 1 : 0;

  return (
    <div className="h-72 w-full" role="img" aria-label="Évolution du chiffre d’affaires net par jour">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeWidth={1} />
          <XAxis
            dataKey="day"
            tickFormatter={formatShortDay}
            interval={interval}
            tickLine={false}
            axisLine={{ stroke: GRID_COLOR }}
            tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v: number) => compact.format(v)}
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fill: TEXT_MUTED, fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(17,17,17,0.05)' }}
            content={(props) => (
              <ChartTooltip
                active={props.active}
                payload={props.payload as unknown as { payload: Point }[] | undefined}
                currency={currency}
              />
            )}
          />
          <Bar
            dataKey="net"
            fill={BAR_COLOR}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
            isAnimationActive={!reduceMotion}
            animationDuration={900}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
