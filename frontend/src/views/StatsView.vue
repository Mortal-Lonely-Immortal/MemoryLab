<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '../api'
import EChart from '../components/EChart.vue'

const overview = ref(null)
const heat = ref([])
const forecast = ref([])
const leeches = ref([])
const daily = ref([])
const states = ref([])
const loading = ref(true)
const error = ref('')

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const heatOption = computed(() => {
  const end = today()
  const start = new Date(end)
  start.setDate(end.getDate() - 364)
  const counts = heat.value.map((x) => x.count)
  const max = Math.max(5, ...counts)
  return {
    tooltip: {
      formatter: (p) => `${p.value[0]}<br/>复习 ${p.value[1]} 张`
    },
    visualMap: {
      show: false,
      min: 0,
      max,
      inRange: { color: ['#ece7dc', '#d9e6f2', '#a9c6e0', '#6f9cc4', '#2e5a88'] }
    },
    calendar: {
      range: [iso(start), iso(end)],
      left: 42,
      right: 18,
      top: 24,
      bottom: 26,
      cellSize: ['auto', 13],
      splitLine: { show: false },
      itemStyle: { color: '#f0ece2', borderColor: '#ffffff', borderWidth: 2, borderRadius: 2 },
      yearLabel: { show: false },
      dayLabel: { firstDay: 1, nameMap: 'ZH', color: '#6b7280', fontSize: 12 },
      monthLabel: { nameMap: 'ZH', color: '#6b7280', fontSize: 12 }
    },
    series: [
      {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: heat.value.map((x) => [x.date, x.count]),
        itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 2 }
      }
    ]
  }
})

const dailyOption = computed(() => {
  const dates = daily.value.map((x) => x.date.slice(5))
  const reviews = daily.value.map((x) => x.reviewCount)
  const retention = daily.value.map((x) => (x.reviewCount > 0 ? Math.round(x.retention * 100) : null))
  return {
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['复习量', '保持率'],
      right: 0,
      top: 0,
      itemWidth: 10,
      itemHeight: 8,
      textStyle: { color: '#6b7280', fontSize: 12 }
    },
    grid: { left: 38, right: 42, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: dates,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e8e8e4' } },
      axisLabel: { interval: 4, color: '#6b7280', fontSize: 12 }
    },
    yAxis: [
      {
        type: 'value',
        name: '张',
        minInterval: 1,
        nameTextStyle: { color: '#9ca3af', fontSize: 12 },
        splitLine: { lineStyle: { color: '#ededed' } },
        axisLabel: { color: '#6b7280', fontSize: 12 }
      },
      {
        type: 'value',
        name: '%',
        min: 0,
        max: 100,
        nameTextStyle: { color: '#9ca3af', fontSize: 12 },
        splitLine: { show: false },
        axisLabel: { color: '#6b7280', fontSize: 12 }
      }
    ],
    series: [
      {
        name: '复习量',
        type: 'bar',
        data: reviews,
        barMaxWidth: 12,
        itemStyle: { color: '#a9c6e0', borderRadius: [3, 3, 0, 0] }
      },
      {
        name: '保持率',
        type: 'line',
        yAxisIndex: 1,
        data: retention,
        smooth: true,
        symbolSize: 4,
        connectNulls: false,
        lineStyle: { color: '#9a6a1f', width: 2 },
        itemStyle: { color: '#9a6a1f' }
      }
    ]
  }
})

const forecastOption = computed(() => {
  const map = {}
  for (const x of forecast.value) map[x.date] = x.count
  const labels = []
  const data = []
  const base = today()
  for (let i = 0; i < 30; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const key = iso(d)
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`)
    data.push(map[key] || 0)
  }
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (p) => `${p[0].axisValue}<br/>到期 ${p[0].value} 张`
    },
    grid: { left: 36, right: 16, top: 18, bottom: 28 },
    xAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e8e8e4' } },
      axisLabel: { interval: 4, color: '#6b7280', fontSize: 12 }
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      splitLine: { lineStyle: { color: '#ededed' } },
      axisLabel: { color: '#6b7280', fontSize: 12 }
    },
    series: [
      {
        type: 'bar',
        data,
        barMaxWidth: 16,
        itemStyle: { color: '#2e5a88', borderRadius: [3, 3, 0, 0] }
      }
    ]
  }
})

const stateOption = computed(() => {
  const names = { 0: '新卡', 1: '学习中', 2: '复习', 3: '重学' }
  const colors = { 0: '#c9c0b0', 1: '#e5c48c', 2: '#2e5a88', 3: '#c53030' }
  const data = states.value.map((x) => ({
    name: names[x.state] || '其他',
    value: x.count,
    itemStyle: { color: colors[x.state] || '#9ca3af' }
  }))
  return {
    tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 张（{d}%）' },
    legend: {
      bottom: 0,
      itemWidth: 9,
      itemHeight: 9,
      textStyle: { color: '#6b7280', fontSize: 12 }
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '68%'],
        center: ['50%', '43%'],
        data,
        label: { show: false },
        emphasis: { scale: true, scaleSize: 6 }
      }
    ]
  }
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [o, h, f, l, d, s] = await Promise.all([
      api.stats.overview(),
      api.stats.heatmap(365),
      api.stats.forecast(30),
      api.stats.leeches(),
      api.stats.daily(30),
      api.stats.cardStates()
    ])
    overview.value = o
    heat.value = h || []
    forecast.value = f || []
    leeches.value = l || []
    daily.value = d || []
    states.value = s || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">统计</h1>
      <button class="btn ghost small" @click="load" :disabled="loading">刷新</button>
    </div>

    <div v-if="error" class="error-line">{{ error }}</div>

    <div class="grid four" style="margin-bottom:16px">
      <div class="card stat-card">
        <div class="stat-label">今日到期</div>
        <div class="stat-value">{{ overview?.todayDue ?? 0 }}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">今日已复习</div>
        <div class="stat-value">{{ overview?.todayReviewed ?? 0 }}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">近 7 天保持率</div>
        <div class="stat-value">{{ Math.round((overview?.retention7d ?? 0) * 100) }}%</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">卡片总数</div>
        <div class="stat-value">{{ overview?.totalCards ?? 0 }}</div>
      </div>
    </div>

    <div class="card pad" style="margin-bottom:16px">
      <div class="strong">复习热力图</div>
      <div class="heat-scroll">
        <EChart :option="heatOption" height="230px" />
      </div>
    </div>

    <div class="grid two" style="margin-bottom:16px">
      <div class="card pad">
        <div class="strong">近 30 天复习量与保持率</div>
        <EChart :option="dailyOption" height="290px" />
      </div>
      <div class="card pad">
        <div class="strong">未来 30 天到期量</div>
        <EChart :option="forecastOption" height="290px" />
      </div>
    </div>

    <div class="grid two">
      <div class="card pad">
        <div class="strong">卡片状态分布</div>
        <EChart :option="stateOption" height="280px" />
      </div>

      <div class="card pad">
        <div class="strong">易忘卡</div>
        <div v-if="!leeches.length" class="empty">—</div>
        <div v-for="c in leeches.slice(0, 6)" :key="c.id" class="leech-row">
          <div class="small cell-clip">{{ c.front }}</div>
          <div class="sub">{{ c.lapses }} 次遗忘</div>
        </div>
      </div>
    </div>
  </div>
</template>
