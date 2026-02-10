import ReactECharts from 'echarts-for-react'
import type { CategorySpending } from '@/db/queries/statistics'

interface SpendingByCategoryProps {
  data: CategorySpending[]
}

const PALETTE = [
  '#a3c4f3', '#b5ead7', '#ffd6a5', '#ffadad', '#cdb4db',
  '#bde0fe', '#d4a5a5', '#c1fba4', '#ffc6ff', '#fdffb6',
  '#caffbf', '#9bf6ff', '#e4c1f9', '#f1c0e8', '#a2d2ff',
]

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
        data: data.map((d, i) => ({
          name: d.name,
          value: d.total,
          itemStyle: { color: PALETTE[i % PALETTE.length] },
        })),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 300 }} />
}
