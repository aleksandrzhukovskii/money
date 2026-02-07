import ReactECharts from 'echarts-for-react'
import type { CategorySpending } from '@/db/queries/statistics'

interface SpendingByCategoryProps {
  data: CategorySpending[]
}

export function SpendingByCategory({ data }: SpendingByCategoryProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No spending data for this period
      </div>
    )
  }

  const option = {
    tooltip: {
      trigger: 'item' as const,
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ${(params.value / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} (${params.percent}%)`,
    },
    legend: {
      bottom: 0,
      type: 'scroll' as const,
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 4,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          label: { show: true, fontWeight: 'bold' as const },
        },
        data: data.map((d) => ({
          name: d.name,
          value: d.total,
          itemStyle: { color: d.color },
        })),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 300 }} />
}
