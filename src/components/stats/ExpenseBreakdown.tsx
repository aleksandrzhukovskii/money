import ReactECharts from 'echarts-for-react'
import type { MonthlyExpense } from '@/db/queries/statistics'

interface ExpenseBreakdownProps {
  data: MonthlyExpense[]
}

export function ExpenseBreakdown({ data }: ExpenseBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No expense data for this period
      </div>
    )
  }

  const months = data.map((d) => d.month)
  const values = data.map((d) => Math.round(d.total) / 100)

  const option = {
    tooltip: { trigger: 'axis' as const },
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
        name: 'Expenses',
        type: 'bar' as const,
        data: values,
        itemStyle: { color: '#f87171' },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 300 }} />
}
