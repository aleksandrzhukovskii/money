import ReactECharts from 'echarts-for-react'
import type { MonthlyTotal } from '@/db/queries/statistics'

interface MonthlyTrendProps {
  data: MonthlyTotal[]
}

export function MonthlyTrend({ data }: MonthlyTrendProps) {
  const spendingData = data.filter((d) => d.type === 'spending')

  if (spendingData.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No spending data for this period
      </div>
    )
  }

  const months = spendingData.map((d) => d.month).sort()
  const values = months.map(
    (m) => (spendingData.find((d) => d.month === m)?.total ?? 0) / 100,
  )

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
        type: 'line' as const,
        data: values,
        smooth: true,
        areaStyle: { opacity: 0.15 },
        itemStyle: { color: '#ef4444' },
        lineStyle: { width: 2 },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 250 }} />
}
