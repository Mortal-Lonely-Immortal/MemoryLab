<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { api } from '../api'

const queue = ref([])
const index = ref(0)
const flipped = ref(false)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const finished = ref(false)
const startedAt = ref(Date.now())

const current = computed(() => queue.value[index.value] || null)
const progress = computed(() => (queue.value.length ? Math.round((index.value / queue.value.length) * 100) : 0))
const ratings = [
  { rating: 1, name: '忘记', cls: 'again' },
  { rating: 2, name: '困难', cls: 'hard' },
  { rating: 3, name: '记得', cls: 'good' },
  { rating: 4, name: '轻松', cls: 'easy' }
]

function previewOf(rating) {
  const p = current.value?.previews?.find((x) => x.rating === rating)
  return p ? p.label : ''
}

async function load() {
  loading.value = true
  error.value = ''
  finished.value = false
  try {
    const q = await api.review.queue({ limit: 20, mode: 'mixed' })
    queue.value = q || []
    index.value = 0
    flipped.value = false
    startedAt.value = Date.now()
    finished.value = queue.value.length === 0
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function flip() {
  if (current.value) flipped.value = true
}

async function rate(rating) {
  if (!current.value || saving.value) return
  saving.value = true
  error.value = ''
  try {
    await api.review.score(current.value.card.id, {
      rating,
      durationMs: Date.now() - startedAt.value,
      clientReqId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
    })
    index.value += 1
    flipped.value = false
    startedAt.value = Date.now()
    if (index.value >= queue.value.length) finished.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

function onKey(e) {
  if (finished.value || loading.value) return
  if (e.code === 'Space') {
    e.preventDefault()
    if (!flipped.value) flip()
    return
  }
  if (flipped.value && ['1', '2', '3', '4'].includes(e.key)) {
    e.preventDefault()
    rate(Number(e.key))
  }
}

onMounted(() => {
  load()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="review-wrap">
    <div v-if="error" class="error-line">{{ error }}</div>

    <div v-if="loading" class="empty">正在载入…</div>

    <template v-else>
      <div class="progress-meta">
        <span v-if="!finished">{{ index + 1 }} / {{ queue.length }}</span>
        <span v-else>本轮完成</span>
      </div>
      <div class="progress"><i :style="{ width: (finished ? 100 : progress) + '%' }"></i></div>

      <div v-if="finished" class="card done-box">
        <div class="done-title">今日完成</div>
        <div class="row" style="justify-content:center;margin-top:22px">
          <button class="btn" @click="load">再刷一轮</button>
          <router-link to="/stats" class="btn ghost">统计</router-link>
        </div>
      </div>

      <template v-else-if="current">
        <div class="card flashcard">
          <div class="question">{{ current.card.front }}</div>
          <template v-if="flipped">
            <div class="answer">{{ current.card.back }}</div>
            <div v-if="current.card.extra" class="extra">{{ current.card.extra }}</div>
          </template>
        </div>

        <div v-if="!flipped" class="row" style="justify-content:center;margin-top:18px">
          <button class="btn" @click="flip">显示答案</button>
        </div>

        <div v-else class="rating-row">
          <button v-for="r in ratings" :key="r.rating" class="rate-btn" :class="r.cls"
                  :disabled="saving" @click="rate(r.rating)">
            <div class="rate-name">{{ r.name }}</div>
            <div class="rate-when">{{ previewOf(r.rating) }}</div>
          </button>
        </div>
      </template>

      <div v-else class="empty">今天没有到期卡片。</div>
    </template>
  </div>
</template>
