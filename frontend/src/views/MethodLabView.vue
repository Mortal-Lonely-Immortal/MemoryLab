<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { api } from '../api'
import EChart from '../components/EChart.vue'

const plan = ref(null)
const methods = ref([])
const loading = ref(true)
const error = ref('')
const toast = ref('')
const saving = ref(false)

const showEdit = ref(false)
const editItems = ref([])

const showReview = ref(false)
const decisions = reactive({})

const decisionText = { KEEP: '保留', DROP: '淘汰', TRIAL: '再试' }

const today = new Date()
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const weekDays = computed(() => {
  if (!plan.value) return []
  const start = new Date(plan.value.weekStart + 'T00:00:00')
  const names = ['一', '二', '三', '四', '五', '六', '日']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { iso, name: names[i], isToday: iso === todayIso }
  })
})

const radarOption = computed(() => {
  const items = plan.value?.items || []
  if (!items.length) return {}
  const names = items.map((i) => (i.name.length > 12 ? i.name.slice(0, 12) + '…' : i.name))
  return {
    tooltip: {},
    radar: {
      indicator: items.map((i, idx) => ({ name: names[idx], max: 5 })),
      radius: '55%',
      center: ['50%', '55%'],
      splitNumber: 5,
      axisName: { color: '#4b5563', fontSize: 12 },
      splitArea: { areaStyle: { color: ['#f7f7f5', '#ffffff'] } },
      splitLine: { lineStyle: { color: '#e8e8e4' } },
      axisLine: { lineStyle: { color: '#e8e8e4' } }
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: items.map((i) => i.avgScore ?? 0),
            name: '周均分',
            areaStyle: { color: 'rgba(46,90,136,.18)' },
            lineStyle: { color: '#2e5a88', width: 2 },
            itemStyle: { color: '#2e5a88' }
          }
        ]
      }
    ]
  }
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [p, m] = await Promise.all([api.methodLab.current(), api.methodLab.methods()])
    plan.value = p
    methods.value = m || []
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 1800)
}

function scoreOf(item, date) {
  return item.logs?.find((l) => l.date === date)?.score || 0
}

async function setScore(item, score) {
  try {
    saving.value = true
    plan.value = await api.methodLab.score({ itemId: item.id, date: todayIso, score })
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

function openEdit() {
  editItems.value = plan.value.items.map((i) => ({
    methodId: i.methodId,
    customName: i.methodId ? null : i.name,
    targetDays: i.targetDays || 5
  }))
  showEdit.value = true
}

function toggleEdit(item) {
  const idx = editItems.value.findIndex((i) => i.methodId === item.id)
  if (idx >= 0) editItems.value.splice(idx, 1)
  else if (editItems.value.length < 5) editItems.value.push({ methodId: item.id, targetDays: 5 })
}

function isSelected(id) {
  return editItems.value.some((i) => i.methodId === id)
}

async function saveEdit() {
  if (editItems.value.length < 3 || editItems.value.length > 5) {
    error.value = '请选择 3–5 个方法'
    return
  }
  saving.value = true
  try {
    plan.value = await api.methodLab.createPlan({
      weekStart: plan.value.weekStart,
      items: editItems.value
    })
    showEdit.value = false
    showToast('计划已更新')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

function openReview() {
  for (const item of plan.value.items) {
    decisions[item.id] = item.decision || suggest(item.avgScore)
  }
  showReview.value = true
}

function suggest(avg) {
  if (avg == null) return 'TRIAL'
  if (avg >= 3.5) return 'KEEP'
  if (avg <= 2.5) return 'DROP'
  return 'TRIAL'
}

async function saveReview() {
  saving.value = true
  try {
    plan.value = await api.methodLab.review({
      planId: plan.value.id,
      decisions: Object.entries(decisions).map(([itemId, decision]) => ({ itemId: Number(itemId), decision }))
    })
    showReview.value = false
    showToast('复盘已保存')
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

async function makeDraft() {
  try {
    await api.methodLab.nextDraft()
    showToast('下周草稿已准备')
  } catch (e) {
    error.value = e.message
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">方法实验室</h1>
      <div class="row">
        <button class="btn ghost" @click="makeDraft">准备下周</button>
        <button class="btn" @click="openEdit" :disabled="!plan">调整本周</button>
      </div>
    </div>

    <div v-if="error" class="error-line">{{ error }}</div>
    <div v-if="loading" class="empty">正在载入…</div>

    <template v-else-if="plan">
      <div class="plan-meta">
        <span>{{ plan.weekStart }} – {{ plan.weekEnd }}</span>
        <span v-if="plan.weekAvg != null">周均分 {{ plan.weekAvg }}</span>
        <span v-if="plan.daysScored > 0">{{ plan.daysScored }} 天</span>
        <span v-if="plan.status === 'REVIEWED'">已复盘</span>
      </div>

      <div v-if="plan.weekAvg != null" class="card pad" style="margin-bottom:16px">
        <div class="strong">本周方法对比</div>
        <EChart :option="radarOption" height="220px" />
      </div>

      <div class="grid two">
        <div v-for="item in plan.items" :key="item.id" class="card method-card">
          <div class="method-head">
            <div class="method-name">{{ item.name }}</div>
            <div v-if="item.avgScore != null" class="method-score">{{ item.avgScore }}</div>
          </div>

          <div class="stars">
            <button v-for="n in 5" :key="n" class="star" :class="{ on: scoreOf(item, todayIso) >= n }"
                    :disabled="saving" @click="setScore(item, n)">★</button>
          </div>

          <div class="days">
            <div v-for="d in weekDays" :key="d.iso" class="day-dot"
                 :class="{ has: scoreOf(item, d.iso) > 0, today: d.isToday }">
              {{ d.name }}
            </div>
          </div>

          <div v-if="item.decision" class="method-decision">{{ decisionText[item.decision] }}</div>
        </div>
      </div>

      <div class="review-row">
        <div class="strong">周日复盘</div>
        <span v-if="plan.status === 'REVIEWED'" class="sub">已复盘</span>
        <button v-else class="btn amber" @click="openReview">复盘</button>
      </div>
    </template>

    <div v-if="showEdit" class="modal-mask" @click.self="showEdit = false">
      <div class="modal">
        <h3>选择 3–5 个方法</h3>
        <div class="grid two">
          <button v-for="m in methods" :key="m.id" class="pick" :class="{ selected: isSelected(m.id) }"
                  @click="toggleEdit(m)">
            {{ m.name }}
          </button>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" @click="showEdit = false">取消</button>
          <button class="btn" :disabled="saving" @click="saveEdit">保存</button>
        </div>
      </div>
    </div>

    <div v-if="showReview" class="modal-mask" @click.self="showReview = false">
      <div class="modal">
        <h3>复盘</h3>
        <div v-for="item in plan.items" :key="item.id" class="review-item">
          <div>
            <div class="strong">{{ item.name }}</div>
            <div class="sub">{{ item.avgScore ?? '—' }}</div>
          </div>
          <select v-model="decisions[item.id]" class="input">
            <option value="KEEP">保留</option>
            <option value="TRIAL">再试</option>
            <option value="DROP">淘汰</option>
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn ghost" @click="showReview = false">取消</button>
          <button class="btn" :disabled="saving" @click="saveReview">保存</button>
        </div>
      </div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
