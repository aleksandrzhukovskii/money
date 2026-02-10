import ReactECharts from 'echarts-for-react'
import type { CurrencyHolding } from '@/db/queries/statistics'

interface CurrencyBreakdownProps {
  data: CurrencyHolding[]
  displayCurrency?: string
}

export function CurrencyBreakdown({ data, displayCurrency }: CurrencyBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No budget data available
      </div>
    )
  }

  const currencies = data.map((d) => d.currency)
  const values = data.map((d) => +(d.total / 100).toFixed(2))

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: { name: string; value: number }[]) => {
        const suffix = displayCurrency && params[0]!.name !== displayCurrency ? ` ${displayCurrency}` : ''
        return `${params[0]!.name}: ${params[0]!.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}${suffix}`
      },
    },
    grid: { left: 60, right: 20, top: 10, bottom: 20 },
    xAxis: {
      type: 'value' as const,
      axisLabel: {
        formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
      },
    },
    yAxis: {
      type: 'category' as const,
      data: currencies,
    },
    series: [
      {
        type: 'bar' as const,
        data: values,
        itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 30,
      },
    ],
  }

  return <ReactECharts option={option} style={{ height: Math.max(150, data.length * 40 + 40) }} />
}
