<script setup>
import { ref } from 'vue'
import { api } from '../api'

const fileInput = ref(null)
const file = ref(null)
const uploading = ref(false)
const result = ref(null)
const error = ref('')

function pick(e) {
  file.value = e.target.files?.[0] || null
  result.value = null
  error.value = ''
}

function trigger() {
  fileInput.value?.click()
}

async function upload() {
  if (!file.value) {
    error.value = '先选择一个 docx 文件'
    return
  }
  uploading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await api.import.docx(file.value)
  } catch (e) {
    error.value = e.message
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div>
    <div class="page-head">
      <h1 class="page-title">导入手册</h1>
    </div>

    <div class="card pad import-panel">
      <input ref="fileInput" type="file" accept=".docx" hidden @change="pick" />
      <button class="upload" @click="trigger">
        {{ file ? file.name : '选择 docx 文件' }}
      </button>
      <button class="btn" :disabled="uploading || !file" @click="upload">
        {{ uploading ? '导入中…' : '导入' }}
      </button>

      <div v-if="error" class="error-line">{{ error }}</div>

      <div v-if="result" class="import-result">
        <div class="import-counts">
          <span>{{ result.totalNotes }}</span> 知识点
          <span>{{ result.createdCards }}</span> 卡片
        </div>
        <div class="row">
          <router-link to="/review" class="btn">去复习</router-link>
          <router-link to="/cards" class="btn ghost">看卡片</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
