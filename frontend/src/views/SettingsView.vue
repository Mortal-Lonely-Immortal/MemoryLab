<script setup>
import { onMounted, reactive, ref } from 'vue'
import { api } from '../api'

const form = reactive({ dailyNewLimit: 20, dailyReviewLimit: 200, desiredRetention: 0.9 })
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const toast = ref('')

async function load() {
  loading.value = true
  try {
    const s = await api.settings.get()
    form.dailyNewLimit = s.dailyNewLimit
    form.dailyReviewLimit = s.dailyReviewLimit
    form.desiredRetention = s.desiredRetention
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    await api.settings.update(form)
    toast.value = '已保存'
    setTimeout(() => (toast.value = ''), 1500)
  } catch (e) {
    error.value = e.message
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">设置</h1>
    </div>

    <div v-if="error" class="error-line">{{ error }}</div>

    <div v-if="loading" class="empty">载入中…</div>

    <div v-else class="settings-form">
      <div class="field">
        <label>每日新卡</label>
        <input v-model.number="form.dailyNewLimit" type="number" min="0" max="200" class="input" />
      </div>
      <div class="field">
        <label>每日复习</label>
        <input v-model.number="form.dailyReviewLimit" type="number" min="0" max="1000" class="input" />
      </div>
      <div class="field">
        <label>目标保持率 {{ Math.round(form.desiredRetention * 100) }}%</label>
        <input v-model.number="form.desiredRetention" type="range" min="0.7" max="0.99" step="0.01" />
      </div>
      <div>
        <button class="btn" :disabled="saving" @click="save">保存</button>
      </div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>
