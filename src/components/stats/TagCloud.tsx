import ReactECharts from 'echarts-for-react'
import type { TagTotal } from '@/db/queries/statistics'

interface TagCloudProps {
  data: TagTotal[]
}

export function TagCloud({ data }: TagCloudProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No tagged transactions for this period
      </div>
    )
  }

  const option = {
    tooltip: {
      formatter: (params: { name: string; value: number; data: { count: number } }) =>
        `${params.name}: ${(params.value / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} (${params.data.count} txns)`,
    },
    series: [
      {
        type: 'treemap' as const,
        breadcrumb: { show: false },
        roam: false,
        nodeClick: false,
        label: {
          show: true,
          formatter: '{b}',
        },
        data: data.map((d) => ({
          name: d.name,
          value: d.total,
          count: d.count,
          itemStyle: { color: d.color },
        })),
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: 250 }} />
}
