import ReactECharts from 'echarts-for-react'
import type { MonthlyTotal } from '@/db/queries/statistics'

interface IncomeVsExpenseProps {
  data: MonthlyTotal[]
}

export function IncomeVsExpense({ data }: IncomeVsExpenseProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No transaction data for this period
      </div>
    )
  }

  const months = [...new Set(data.map((d) => d.month))].sort()
  const earningByMonth = new Map<string, number>()
  const spendingByMonth = new Map<string, number>()

  for (const d of data) {
    if (d.type === 'earning') earningByMonth.set(d.month, Math.round(d.total) / 100)
    if (d.type === 'spending') spendingByMonth.set(d.month, Math.round(d.total) / 100)
  }

  const earningData = months.map((m) => earningByMonth.get(m) ?? 0)
  const spendingData = months.map((m) => spendingByMonth.get(m) ?? 0)

  const option = {
    tooltip: { trigger: 'axis' as const },
    legend: { bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
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
        name: 'Income',
        type: 'bar' as const,
        data: earningData,
        itemStyle: { color: '#22c55e' },
      },
      {
        name: 'Expenses',
        type: 'bar' as const,
        data: spendingData,
        itemStyle: { color: '#ef4444' },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 300 }} />
}
