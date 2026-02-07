import ReactECharts from 'echarts-for-react'
import type { BalancePoint } from '@/db/queries/statistics'

interface BudgetBalanceTrendProps {
  data: BalancePoint[]
}

export function BudgetBalanceTrend({ data }: BudgetBalanceTrendProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No budget data for this period
      </div>
    )
  }

  const months = data.map((d) => d.month)
  const values = data.map((d) => +(d.total / 100).toFixed(2))

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: { name: string; value: number }[]) =>
        `${params[0]!.name}: ${params[0]!.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category' as const,
      data: months,
      axisLabel: {
        formatter: (v: string) => {
          const [, m] = v.split('-')
          const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
          return names[parseInt(m!) - 1]
        },
      },
    },
    yAxis: {
      type: 'value' as const,
      axisLabel: {
        formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
      },
    },
    series: [
      {
        type: 'line' as const,
        data: values,
        smooth: true,
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: '#3b82f6' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 250 }} />
}
